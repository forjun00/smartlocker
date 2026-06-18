from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from functools import wraps
import bcrypt
import json
import os
import uuid
import time
import datetime
import paho.mqtt.client as mqtt

app = Flask(__name__, static_folder='../frontend/dist', static_url_path='')
CORS(app)

DATA_FILE = os.path.join(os.path.dirname(__file__), 'lockers.json')
LOG_FILE = os.path.join(os.path.dirname(__file__), 'events.json')
NUM_LOCKERS = 10


def load_lockers():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r') as f:
            return json.load(f)
    lockers = {str(i): {'locked': False, 'password_hash': None} for i in range(1, NUM_LOCKERS + 1)}
    save_lockers(lockers)
    return lockers


def save_lockers(lockers):
    with open(DATA_FILE, 'w') as f:
        json.dump(lockers, f, indent=2)


lockers = load_lockers()

ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin1234')

MQTT_HOST = os.environ.get('MQTT_HOST', 'localhost')
MQTT_PORT = int(os.environ.get('MQTT_PORT', 1883))
CAB_ID    = os.environ.get('CAB_ID', 'cab1')

# ---------------------------------------------------------------------------
# Activity log
# ---------------------------------------------------------------------------
MAX_EVENTS = 500
events = []
if os.path.exists(LOG_FILE):
    try:
        with open(LOG_FILE, 'r') as f:
            events = json.load(f)
    except Exception:
        events = []


def log_event(slot, action, method, ok=True):
    events.append({
        'time': datetime.datetime.now().isoformat(timespec='seconds'),
        'slot': slot,
        'action': action,     # lock | unlock | open | pickup | reset
        'method': method,     # passcode | link | rider | admin
        'ok': ok,
        'ip': request.remote_addr if request else None,
    })
    del events[:-MAX_EVENTS]
    try:
        with open(LOG_FILE, 'w') as f:
            json.dump(events, f, indent=2)
    except Exception as e:
        print(f'[LOG] write failed: {e}')


# ---------------------------------------------------------------------------
# Admin sessions (server-side tokens)
# ---------------------------------------------------------------------------
SESSION_TTL = 12 * 3600
admin_tokens = {}   # token -> expires_at


def require_admin(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        auth = request.headers.get('Authorization', '')
        token = auth[7:] if auth.startswith('Bearer ') else ''
        exp = admin_tokens.get(token)
        if not exp or time.time() > exp:
            admin_tokens.pop(token, None)
            return jsonify({'error': 'Not authorized'}), 401
        return fn(*args, **kwargs)
    return wrapper


# ---------------------------------------------------------------------------
# MQTT: publish lock/unlock commands
# ---------------------------------------------------------------------------
mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2,
                          client_id=f'smartlocker-backend-{uuid.uuid4().hex[:6]}')
try:
    mqtt_client.connect_async(MQTT_HOST, MQTT_PORT, 30)
    mqtt_client.loop_start()
    print(f'[MQTT] connecting to {MQTT_HOST}:{MQTT_PORT}')
except Exception as e:
    print(f'[MQTT] connect failed: {e}')


def mqtt_pub(slot_id, cmd):
    topic = f'smartlocker/{CAB_ID}/slot/{slot_id}/cmd'
    try:
        mqtt_client.publish(topic, cmd, qos=1)
        print(f'[MQTT] -> {topic} {cmd}')
    except Exception as e:
        print(f'[MQTT] publish failed: {e}')


# token -> {locker_id, expires_at}  (in-memory pickup links)
pickup_tokens = {}
TOKEN_TTL = 8 * 3600


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
@app.post('/api/admin/login')
def admin_login():
    password = request.json.get('password', '')
    if password != ADMIN_PASSWORD:
        return jsonify({'error': 'Wrong password'}), 401
    token = uuid.uuid4().hex
    admin_tokens[token] = time.time() + SESSION_TTL
    return jsonify({'success': True, 'token': token})


# ---------------------------------------------------------------------------
# Public locker status
# ---------------------------------------------------------------------------
@app.get('/api/lockers')
def get_all_lockers():
    return jsonify([{'id': k, 'locked': v['locked']} for k, v in lockers.items()])


@app.get('/api/locker/<id>')
def get_locker(id):
    if id not in lockers:
        return jsonify({'error': 'Locker not found'}), 404
    return jsonify({'id': id, 'locked': lockers[id]['locked']})


# ---------------------------------------------------------------------------
# Lock / open / unlock  (public; gated by passcode or slot state)
# ---------------------------------------------------------------------------
@app.post('/api/locker/<id>/lock')
def lock_locker(id):
    if id not in lockers:
        return jsonify({'error': 'Locker not found'}), 404
    if lockers[id]['locked']:
        return jsonify({'error': 'Already locked'}), 400

    password = request.json.get('password', '')
    if len(password) < 4:
        return jsonify({'error': 'Password must be at least 4 characters'}), 400

    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    lockers[id] = {'locked': True, 'password_hash': hashed}
    save_lockers(lockers)
    log_event(id, 'lock', 'passcode')
    return jsonify({'success': True})


@app.post('/api/locker/<id>/open')
def open_door(id):
    if id not in lockers:
        return jsonify({'error': 'Locker not found'}), 404
    if lockers[id]['locked']:
        return jsonify({'error': 'Locker is locked — enter passcode to unlock'}), 400
    mqtt_pub(id, 'unlock')
    log_event(id, 'open', 'rider')
    return jsonify({'success': True})


@app.post('/api/locker/<id>/unlock')
def unlock_locker(id):
    if id not in lockers:
        return jsonify({'error': 'Locker not found'}), 404
    if not lockers[id]['locked']:
        return jsonify({'error': 'Not locked'}), 400

    password = request.json.get('password', '')
    stored_hash = lockers[id]['password_hash'].encode()

    if not bcrypt.checkpw(password.encode(), stored_hash):
        log_event(id, 'unlock', 'passcode', ok=False)
        return jsonify({'error': 'Wrong password'}), 401

    lockers[id] = {'locked': False, 'password_hash': None}
    save_lockers(lockers)
    mqtt_pub(id, 'unlock')
    log_event(id, 'unlock', 'passcode')
    return jsonify({'success': True})


# ---------------------------------------------------------------------------
# One-time pickup links  (generate = admin only; use = public via token)
# ---------------------------------------------------------------------------
@app.post('/api/locker/<id>/generate-token')
@require_admin
def generate_token(id):
    if id not in lockers:
        return jsonify({'error': 'Locker not found'}), 404
    if not lockers[id]['locked']:
        return jsonify({'error': 'Locker is not locked'}), 400
    token = uuid.uuid4().hex
    pickup_tokens[token] = {'locker_id': id, 'expires_at': time.time() + TOKEN_TTL}
    return jsonify({'token': token})


@app.get('/api/pickup/<token>')
def use_token(token):
    entry = pickup_tokens.get(token)
    if not entry:
        return jsonify({'error': 'Invalid or already used link'}), 404
    if time.time() > entry['expires_at']:
        del pickup_tokens[token]
        return jsonify({'error': 'Link has expired'}), 410
    locker_id = entry['locker_id']
    if not lockers[locker_id]['locked']:
        del pickup_tokens[token]
        return jsonify({'error': 'Locker already unlocked'}), 400
    lockers[locker_id] = {'locked': False, 'password_hash': None}
    save_lockers(lockers)
    del pickup_tokens[token]
    mqtt_pub(locker_id, 'unlock')
    log_event(locker_id, 'pickup', 'link')
    return jsonify({'success': True, 'locker_id': locker_id})


# ---------------------------------------------------------------------------
# Admin: reset + activity log
# ---------------------------------------------------------------------------
@app.post('/api/locker/<id>/reset')
@require_admin
def reset_locker(id):
    if id not in lockers:
        return jsonify({'error': 'Locker not found'}), 404
    lockers[id] = {'locked': False, 'password_hash': None}
    save_lockers(lockers)
    mqtt_pub(id, 'unlock')
    log_event(id, 'reset', 'admin')
    return jsonify({'success': True})


@app.get('/api/log')
@require_admin
def get_log():
    return jsonify(list(reversed(events[-100:])))


# Serve React frontend (SPA fallback)
@app.errorhandler(404)
def serve_frontend(e):
    dist = os.path.join(os.path.dirname(__file__), '../frontend/dist')
    return send_from_directory(dist, 'index.html')


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3001, debug=True)
