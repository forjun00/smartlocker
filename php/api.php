<?php
/**
 * SmartLocker backend — PHP / XAMPP edition.
 *
 * A drop-in replacement for the Flask backend (app.py). Same JSON API the React
 * frontend already calls. No Python, no Composer — just PHP + Apache (XAMPP).
 *
 * Routing: .htaccess sends every /api/* request here. Static files (the built
 * frontend) are served by Apache directly, with an SPA fallback to index.html.
 */

// ---------------------------------------------------------------------------
// Config  (edit these for your deployment)
// ---------------------------------------------------------------------------
const ADMIN_PASSWORD = 'admin1234';
const NUM_LOCKERS    = 10;
const TOKEN_TTL      = 8 * 3600;     // pickup link lifetime (seconds)
const SESSION_TTL    = 12 * 3600;    // admin token lifetime
const CAB_ID         = 'cab1';

// SMS gateway (Asefa). https avoids the http->https redirect that drops the body.
const SMS_ENABLED_DEFAULT = true;
const ASEFA_URL      = 'https://innovations.asefa.co.th/cdn/sms/';

// MQTT broker for the ESP32 cabinet (lock/unlock/LED). Blank host = MQTT off.
const MQTT_HOST      = 'mqtt.mdbiot.com';
const MQTT_PORT      = 1883;

// Base URL used inside the SMS pickup link. For a hash-routed subfolder deploy
// it must point at the real index.html + '#'. Blank = derive scheme+host only.
const PUBLIC_BASE_URL = 'https://app.mdbiot.com/smartlocker/#';

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
// Never cache API responses — otherwise the browser/CDN serves a stale lock state
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$DATA = __DIR__ . '/data';
if (!is_dir($DATA)) @mkdir($DATA, 0777, true);

// Data is stored as *.php files with a PHP guard on the first line, so if anyone
// requests them over the web (where .htaccess is ignored, e.g. nginx) PHP runs
// the guard and returns 403 instead of leaking phone numbers / tokens.
// A closing PHP tag keeps the JSON below as inert text (not parsed), so a direct
// web hit just runs exit then 403 with no body. api.php strips this first line.
const DATA_GUARD = "<?php http_response_code(403); exit; ?>\n";

function data_path($name) { global $DATA; return $DATA . '/' . $name . '.php'; }

function load_json($name, $default) {
    $p = data_path($name);
    if (!file_exists($p)) return $default;
    $raw = file_get_contents($p);
    $nl = strpos($raw, "\n");                 // strip the guard line
    $json = $nl !== false ? substr($raw, $nl + 1) : '';
    $val = json_decode($json, true);
    return $val === null ? $default : $val;
}

function save_json($name, $data) {
    $p = data_path($name);
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    file_put_contents($p, DATA_GUARD . $json, LOCK_EX);
}

function send_json($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// ---------------------------------------------------------------------------
// Lockers
// ---------------------------------------------------------------------------
function load_lockers() {
    $lk = load_json('lockers.json', null);
    if (!is_array($lk)) {
        $lk = [];
        for ($i = 1; $i <= NUM_LOCKERS; $i++) $lk["$i"] = ['locked' => false, 'phone' => null];
        save_json('lockers.json', $lk);
    }
    return $lk;
}
function save_lockers($lk) { save_json('lockers.json', $lk); }

// ---------------------------------------------------------------------------
// Settings (SMS toggle)
// ---------------------------------------------------------------------------
function load_settings() {
    $s = load_json('settings.json', ['sms_enabled' => SMS_ENABLED_DEFAULT]);
    if (!isset($s['sms_enabled'])) $s['sms_enabled'] = SMS_ENABLED_DEFAULT;
    return $s;
}
function save_settings($s) { save_json('settings.json', $s); }

// ---------------------------------------------------------------------------
// Activity log
// ---------------------------------------------------------------------------
function log_event($slot, $action, $method, $ok = true) {
    $events = load_json('events.json', []);
    $events[] = [
        'time'   => date('Y-m-d\TH:i:s'),
        'slot'   => $slot,
        'action' => $action,
        'method' => $method,
        'ok'     => $ok,
        'ip'     => $_SERVER['REMOTE_ADDR'] ?? null,
    ];
    if (count($events) > 500) $events = array_slice($events, -500);
    save_json('events.json', $events);
}

// ---------------------------------------------------------------------------
// Admin sessions (file-backed tokens)
// ---------------------------------------------------------------------------
function load_tokens() { return load_json('tokens.json', []); }
function save_tokens($t) { save_json('tokens.json', $t); }

function require_admin() {
    $hdr = '';
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) $hdr = $_SERVER['HTTP_AUTHORIZATION'];
    elseif (function_exists('apache_request_headers')) {
        $h = apache_request_headers();
        foreach ($h as $k => $v) if (strtolower($k) === 'authorization') $hdr = $v;
    }
    $token = (stripos($hdr, 'Bearer ') === 0) ? substr($hdr, 7) : '';
    $tokens = load_tokens();
    $now = time();
    // prune expired
    $tokens = array_filter($tokens, fn($exp) => $exp > $now);
    if (!$token || !isset($tokens[$token])) {
        save_tokens($tokens);
        send_json(['error' => 'Not authorized'], 401);
    }
    save_tokens($tokens);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function digits_only($s) { return preg_replace('/\D/', '', $s ?? ''); }

function mask_phone($phone) {
    $d = digits_only($phone);
    if ($d === '') return $phone;
    $tail = substr($d, -4);
    return str_repeat("\u{2022}", max(0, strlen($d) - 4)) . $tail;
}

function base_url_from_request() {
    if (PUBLIC_BASE_URL !== '') return rtrim(PUBLIC_BASE_URL, '/');
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    return $scheme . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
}

function uuid_hex() { return bin2hex(random_bytes(16)); }

// ---------------------------------------------------------------------------
// SMS via Asefa  (multipart POST of phone + base64(msg), like the PHP sample)
// ---------------------------------------------------------------------------
function send_sms($to, $body) {
    if (!function_exists('curl_init')) return false;
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => ASEFA_URL,
        CURLOPT_RETURNTRANSFER => 1,
        CURLOPT_HEADER         => 1,        // gateway puts the real status in the body
        CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_SSL_VERIFYPEER => 0,
        CURLOPT_POST           => 1,
        CURLOPT_POSTFIELDS     => ['phone' => $to, 'msg' => base64_encode($body)],
        CURLOPT_TIMEOUT        => 20,
    ]);
    $resp = curl_exec($ch);
    curl_close($ch);
    // success = the gateway acknowledged with "202 Accepted"
    return $resp !== false && strpos($resp, '202 Accepted') !== false && strpos($resp, 'type="ack"') !== false;
}

// ---------------------------------------------------------------------------
// Minimal MQTT publish (QoS 0) — no library needed
// ---------------------------------------------------------------------------
function mqtt_remaining_len($n) {
    $s = '';
    do { $d = $n % 128; $n = intdiv($n, 128); if ($n > 0) $d |= 0x80; $s .= chr($d); } while ($n > 0);
    return $s;
}
function mqtt_pub($slot_id, $cmd) {
    if (MQTT_HOST === '') return false;
    $topic = 'smartlocker/' . CAB_ID . '/slot/' . $slot_id . '/cmd';
    $fp = @fsockopen(MQTT_HOST, MQTT_PORT, $errno, $errstr, 3);
    if (!$fp) return false;
    stream_set_timeout($fp, 3);
    // CONNECT
    $cid = 'smartlocker-php-' . substr(bin2hex(random_bytes(3)), 0, 6);
    $vh  = chr(0) . chr(4) . 'MQTT' . chr(4) . chr(2) . chr(0) . chr(60); // proto, level4, clean session, keepalive 60
    $pl  = chr(strlen($cid) >> 8) . chr(strlen($cid) & 0xFF) . $cid;
    $body = $vh . $pl;
    fwrite($fp, chr(0x10) . mqtt_remaining_len(strlen($body)) . $body);
    @fread($fp, 4); // CONNACK (best-effort)
    // PUBLISH (QoS 0)
    $pvh = chr(strlen($topic) >> 8) . chr(strlen($topic) & 0xFF) . $topic;
    $ppl = $pvh . $cmd;
    fwrite($fp, chr(0x30) . mqtt_remaining_len(strlen($ppl)) . $ppl);
    // DISCONNECT
    fwrite($fp, chr(0xE0) . chr(0x00));
    fclose($fp);
    return true;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
// Route resolution. Two modes:
//   1) ?p=locker/1/lock   -> hosts WITHOUT URL rewriting (nginx/FTP, no .htaccess)
//   2) /api/locker/1/lock -> clean URLs when a rewrite/.htaccess routes here
if (isset($_GET['p'])) {
    $route = $_GET['p'];
} else {
    $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $pos = strpos($uri, '/api/');
    $route = $pos !== false ? substr($uri, $pos + 5) : '';
}
$parts = array_values(array_filter(explode('/', trim($route, '/')), fn($p) => $p !== ''));
$method = $_SERVER['REQUEST_METHOD'];
$body = json_decode(file_get_contents('php://input'), true) ?: [];

// GET /api/lockers
if ($method === 'GET' && $parts === ['lockers']) {
    $lk = load_lockers();
    $out = [];
    foreach ($lk as $id => $v) $out[] = ['id' => $id, 'locked' => (bool)$v['locked']];
    send_json($out);
}

// /api/admin/login
if ($method === 'POST' && $parts === ['admin', 'login']) {
    if (($body['password'] ?? '') !== ADMIN_PASSWORD) send_json(['error' => 'Wrong password'], 401);
    $token = uuid_hex();
    $tokens = load_tokens();
    $tokens[$token] = time() + SESSION_TTL;
    save_tokens($tokens);
    send_json(['success' => true, 'token' => $token]);
}

// /api/admin/settings
if ($parts === ['admin', 'settings']) {
    require_admin();
    $s = load_settings();
    if ($method === 'POST') {
        if (array_key_exists('sms_enabled', $body)) $s['sms_enabled'] = (bool)$body['sms_enabled'];
        save_settings($s);
        log_event('-', 'settings', 'sms ' . ($s['sms_enabled'] ? 'on' : 'off'));
    }
    send_json($s);
}

// /api/log
if ($method === 'GET' && $parts === ['log']) {
    require_admin();
    $events = load_json('events.json', []);
    send_json(array_reverse(array_slice($events, -100)));
}

// /api/pickup/<token>
if ($method === 'GET' && count($parts) === 2 && $parts[0] === 'pickup') {
    $token = $parts[1];
    $tokens = load_json('pickup.json', []);
    if (!isset($tokens[$token])) send_json(['error' => 'Invalid or already used link'], 404);
    $entry = $tokens[$token];
    if (time() > $entry['expires_at']) { unset($tokens[$token]); save_json('pickup.json', $tokens); send_json(['error' => 'Link has expired'], 410); }
    $lid = $entry['locker_id'];
    $lk = load_lockers();
    if (!$lk[$lid]['locked']) { unset($tokens[$token]); save_json('pickup.json', $tokens); send_json(['error' => 'Locker already unlocked'], 400); }
    $lk[$lid] = ['locked' => false, 'phone' => null];
    save_lockers($lk);
    unset($tokens[$token]); save_json('pickup.json', $tokens);
    mqtt_pub($lid, 'unlock');
    log_event($lid, 'pickup', 'link');
    send_json(['success' => true, 'locker_id' => $lid]);
}

// /api/locker/<id>/...
if (count($parts) >= 2 && $parts[0] === 'locker') {
    $id = $parts[1];
    $action = $parts[2] ?? '';
    $lk = load_lockers();
    if (!isset($lk[$id])) send_json(['error' => 'Locker not found'], 404);

    // GET /api/locker/<id>
    if ($method === 'GET' && $action === '') {
        send_json(['id' => $id, 'locked' => (bool)$lk[$id]['locked']]);
    }

    // POST /api/locker/<id>/lock
    if ($method === 'POST' && $action === 'lock') {
        if ($lk[$id]['locked']) send_json(['error' => 'Already locked'], 400);
        $phone = trim($body['phone'] ?? '');
        $d = digits_only($phone);
        if (strlen($d) !== 10) send_json(['error' => 'Enter a 10-digit phone number'], 400);

        $lk[$id] = ['locked' => true, 'phone' => $d];
        save_lockers($lk);
        mqtt_pub($id, 'lock');   // cabinet: slot occupied -> LED off

        // No link in the SMS — the recipient opens at the locker with their phone.
        $msg = "SmartLocker: มีพัสดุอยู่ในช่อง $id สแกน QR ที่ตู้แล้วใส่เบอร์โทรนี้เพื่อเปิด";

        $s = load_settings();
        $sms_on = $s['sms_enabled'];
        $sent = $sms_on ? send_sms($phone, $msg) : false;

        log_event($id, 'lock', $sms_on ? 'sms' : 'no-sms', $sent);
        send_json(['success' => true, 'sms_sent' => $sent, 'sms_enabled' => $sms_on, 'phone' => mask_phone($phone)]);
    }

    // POST /api/locker/<id>/open
    if ($method === 'POST' && $action === 'open') {
        if ($lk[$id]['locked']) send_json(['error' => 'Locker is locked — enter passcode to unlock'], 400);
        mqtt_pub($id, 'unlock');
        log_event($id, 'open', 'rider');
        send_json(['success' => true]);
    }

    // POST /api/locker/<id>/unlock
    if ($method === 'POST' && $action === 'unlock') {
        if (!$lk[$id]['locked']) send_json(['error' => 'Not locked'], 400);
        $d = digits_only($body['phone'] ?? '');
        $stored = $lk[$id]['phone'] ?? null;
        if (!$stored) send_json(['error' => 'This slot has no phone on file — use the SMS link'], 400);
        $match = ($d === $stored) || (strlen($d) >= 9 && substr($d, -9) === substr($stored, -9));
        if (!$match) { log_event($id, 'unlock', 'phone', false); send_json(['error' => 'Phone number does not match'], 401); }
        $lk[$id] = ['locked' => false, 'phone' => null];
        save_lockers($lk);
        mqtt_pub($id, 'unlock');
        log_event($id, 'unlock', 'phone');
        send_json(['success' => true]);
    }

    // POST /api/locker/<id>/generate-token  (admin)
    if ($method === 'POST' && $action === 'generate-token') {
        require_admin();
        if (!$lk[$id]['locked']) send_json(['error' => 'Locker is not locked'], 400);
        $token = uuid_hex();
        $pk = load_json('pickup.json', []);
        $pk[$token] = ['locker_id' => $id, 'expires_at' => time() + TOKEN_TTL];
        save_json('pickup.json', $pk);
        send_json(['token' => $token]);
    }

    // POST /api/locker/<id>/reset  (admin)
    if ($method === 'POST' && $action === 'reset') {
        require_admin();
        $lk[$id] = ['locked' => false, 'phone' => null];
        save_lockers($lk);
        mqtt_pub($id, 'unlock');
        log_event($id, 'reset', 'admin');
        send_json(['success' => true]);
    }
}

send_json(['error' => 'Not found', 'route' => $route, 'method' => $method], 404);
