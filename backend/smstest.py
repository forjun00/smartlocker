import requests
import base64

payload = {
    "phone": "0647971041",
    "msg": base64.b64encode("Test SMS".encode()).decode()
}

headers = {
    "User-Agent": "curl/7.88.1"
}

r = requests.post(
    "http://innovations.asefa.co.th/cdn/sms/",
    data=payload,
    headers=headers,
    timeout=30
)

print(r.status_code)
print(r.text)