#!/usr/bin/env python3
"""
Generate printable QR code PNGs for locker slots.

Each QR encodes  <base>/locker/<id>  so scanning it opens that slot's page.
For the hash-routed deploy the base ends with ".../index.html#", giving e.g.
  https://app.mdbiot.com/smartlocker/index.html#/locker/1

Requires:  pip install qrcode pillow

Usage:
    python make_qr.py all                     # slots 1..10, default base
    python make_qr.py 1 2 3                    # specific slots
    python make_qr.py all --base "http://172.16.110.115:3001"   # LAN/Flask (clean URLs)
    python make_qr.py 1 --base "https://app.mdbiot.com/smartlocker/index.html#"
"""
import argparse, os
import qrcode
from PIL import Image, ImageDraw, ImageFont

# Hash-routed subfolder deploy. For the Flask/clean-URL setup use e.g.
# "http://172.16.110.115:3001" instead (no "/index.html#").
DEFAULT_BASE = "https://app.mdbiot.com/smartlocker/index.html#"
OUT_DIR = os.path.dirname(os.path.abspath(__file__))


def make(slot, base):
    url = f"{base}/locker/{slot}"
    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_M,
                       box_size=10, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="#2B2733", back_color="white").convert("RGB")

    # add a label strip under the QR
    label = f"SLOT {int(slot):02d}"
    w, h = qr_img.size
    strip = 70
    canvas = Image.new("RGB", (w, h + strip), "white")
    canvas.paste(qr_img, (0, 0))
    draw = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.truetype("arialbd.ttf", 34)
        small = ImageFont.truetype("arial.ttf", 16)
    except Exception:
        font = ImageFont.load_default()
        small = ImageFont.load_default()
    tb = draw.textbbox((0, 0), label, font=font)
    draw.text(((w - (tb[2]-tb[0]))/2, h + 6), label, fill="#2B2733", font=font)
    ub = draw.textbbox((0, 0), url, font=small)
    draw.text(((w - (ub[2]-ub[0]))/2, h + 46), url, fill="#8A8499", font=small)

    path = os.path.join(OUT_DIR, f"slot_{int(slot):02d}.png")
    canvas.save(path)
    print(f"wrote {path}  ->  {url}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slots", nargs="+", help="slot numbers, or 'all'")
    ap.add_argument("--base", default=DEFAULT_BASE)
    a = ap.parse_args()
    slots = range(1, 11) if a.slots == ["all"] else a.slots
    for s in slots:
        make(s, a.base)


if __name__ == "__main__":
    main()
