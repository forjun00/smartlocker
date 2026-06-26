#!/usr/bin/env python3
"""
Test POST to the Asefa SMS gateway.

API contract:
    POST https://innovations.asefa.co.th/cdn/sms/
    fields:
        phone = recipient number (e.g. 0812345678)
        msg   = the message, BASE64-encoded (UTF-8)

Examples
--------
python test_sms_api.py --phone 0812345678 --message "Test from SmartLocker"
python test_sms_api.py --phone 0812345678 --message "ทดสอบภาษาไทย"
python test_sms_api.py --phone 0812345678 --message "hi" --json   # send as JSON instead of form
python test_sms_api.py --phone 0812345678 --message "hi" --dry     # show payload, do not send
"""
import argparse
import base64
import json
import sys

try:
    import requests
except ImportError:
    sys.exit("pip install requests")

# NB: the official PHP sample uses http:// (not https) and passes an array to
# CURLOPT_POSTFIELDS, which makes cURL send multipart/form-data. We mirror that
# exactly by default so this behaves identically to their reference code.
DEFAULT_URL = "https://innovations.asefa.co.th/cdn/sms/"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--phone", required=True, help="recipient phone number")
    ap.add_argument("--message", "--msg", "-m", dest="message", required=True,
                    help="message text (will be base64-encoded)")
    ap.add_argument("--url", default=DEFAULT_URL)
    ap.add_argument("--encoding", choices=["multipart", "form", "json"], default="multipart",
                    help="multipart = same as the PHP sample (default); form = urlencoded; json")
    ap.add_argument("--dry", action="store_true", help="print payload but do NOT send")
    ap.add_argument("--timeout", type=float, default=20)
    a = ap.parse_args()

    msg_b64 = base64.b64encode(a.message.encode("utf-8")).decode("ascii")
    payload = {"phone": a.phone, "msg": msg_b64}

    print(f"--> POST {a.url}")
    print(f"    phone : {a.phone}")
    print(f"    text  : {a.message}")
    print(f"    msg   : {msg_b64}  (base64)")
    print(f"    encoding: {a.encoding}")
    print("-" * 60)

    if a.dry:
        print("(dry run — nothing sent)")
        return

    try:
        if a.encoding == "json":
            r = requests.post(a.url, json=payload, timeout=a.timeout, verify=False)
        elif a.encoding == "form":
            r = requests.post(a.url, data=payload, timeout=a.timeout, verify=False)
        else:  # multipart — matches PHP's array CURLOPT_POSTFIELDS
            files = {k: (None, v) for k, v in payload.items()}
            r = requests.post(a.url, files=files, timeout=a.timeout, verify=False)
    except requests.RequestException as e:
        sys.exit(f"request failed: {e}")

    dump_response(r)


def dump_response(r):
    # ---- what we actually sent ----
    req = r.request
    print("=== REQUEST ===")
    print(f"{req.method} {req.url}")
    for k, v in req.headers.items():
        print(f"  {k}: {v}")
    if req.body:
        body = req.body.decode("utf-8", "replace") if isinstance(req.body, bytes) else req.body
        print(f"  body: {body}")
    print()

    # ---- any redirects along the way ----
    if r.history:
        print("=== REDIRECTS ===")
        for h in r.history:
            print(f"  {h.status_code} {h.reason} -> {h.headers.get('Location', '?')}")
        print()

    # ---- the final response ----
    print(f"=== RESPONSE: HTTP {r.status_code} {r.reason}  ({r.elapsed.total_seconds():.2f}s) ===")
    print("--- headers ---")
    for k, v in r.headers.items():
        print(f"  {k}: {v}")

    print("--- body ---")
    raw = r.content or b""
    print(f"(len={len(raw)} bytes, encoding={r.encoding})")
    if not raw:
        print("(empty body)")
        return
    try:
        print(json.dumps(r.json(), ensure_ascii=False, indent=2))
    except ValueError:
        text = r.text
        if text.strip():
            print(text)
        else:
            # not valid text — show the raw bytes so nothing is hidden
            print(f"(non-text body) repr: {raw!r}")
            print(f"hex: {raw.hex()}")


if __name__ == "__main__":
    main()
