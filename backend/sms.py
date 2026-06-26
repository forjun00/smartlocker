"""
SMS sender for SmartLocker.

Default provider is the ASEFA gateway — real texts go out with no extra config.

Override with SMS_PROVIDER:
  SMS_PROVIDER=mock     # dev: don't send, just log to backend/sms_outbox.txt
  SMS_PROVIDER=twilio   # needs TWILIO_SID / TWILIO_TOKEN / TWILIO_FROM

  (optional) ASEFA_URL=http://innovations.asefa.co.th/cdn/sms/
"""
import os
import base64
import datetime

PROVIDER = os.environ.get('SMS_PROVIDER', 'asefa')
OUTBOX = os.path.join(os.path.dirname(__file__), 'sms_outbox.txt')

# Asefa SMS gateway. The official PHP sample POSTs phone + base64(msg) as
# multipart/form-data over http://, with SSL verification disabled.
# Must be https: http gets 301-redirected and the POST body is dropped, so the
# gateway never receives phone/msg. https delivers (returns "202 Accepted").
ASEFA_URL = os.environ.get('ASEFA_URL', 'https://innovations.asefa.co.th/cdn/sms/')


def _log_mock(to, body):
    line = f'[{datetime.datetime.now().isoformat(timespec="seconds")}] SMS -> {to}\n  {body}\n'
    print('[SMS]', to, '|', body)
    try:
        with open(OUTBOX, 'a', encoding='utf-8') as f:
            f.write(line)
    except Exception as e:
        print(f'[SMS] outbox write failed: {e}')


def _send_asefa(to, body):
    """Send via the Asefa gateway (multipart POST of phone + base64(msg)).

    Must use https: posting to http makes Cloudflare 301-redirect to https and
    the POST body is lost. The gateway returns HTTP 200 even on failure and puts
    the real status in the XML body, so success = an "ack" with "202 Accepted"
    (a dropped/empty request comes back "400 Bad Request"). Never retry.
    """
    import requests
    requests.packages.urllib3.disable_warnings()  # verify=False is intentional here
    msg_b64 = base64.b64encode(body.encode('utf-8')).decode('ascii')
    files = {'phone': (None, to), 'msg': (None, msg_b64)}  # multipart, like PHP's array
    r = requests.post(ASEFA_URL, files=files, timeout=20, verify=False)
    accepted = (r.status_code < 400) and ('202 Accepted' in r.text) and ('type="ack"' in r.text)
    if not accepted:
        raise RuntimeError(f'asefa not accepted: HTTP {r.status_code} body={r.text[:200]}')
    print(f'[SMS] asefa -> {to} accepted (HTTP {r.status_code})', flush=True)


def _send_twilio(to, body):
    import requests
    sid = os.environ['TWILIO_SID']
    token = os.environ['TWILIO_TOKEN']
    sender = os.environ['TWILIO_FROM']
    r = requests.post(
        f'https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json',
        auth=(sid, token),
        data={'From': sender, 'To': to, 'Body': body},
        timeout=10,
    )
    r.raise_for_status()


def send_sms(to, body):
    """Send an SMS. Returns True on success, False on failure (never raises)."""
    try:
        if PROVIDER == 'asefa':
            _send_asefa(to, body)
        elif PROVIDER == 'twilio':
            _send_twilio(to, body)
        else:
            _log_mock(to, body)
        return True
    except Exception as e:
        print(f'[SMS] send failed: {e}')
        return False
