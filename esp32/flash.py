#!/usr/bin/env python3
"""
Flash a SmartLocker ESP32 over USB.

Usage:
    python flash.py                   # download latest release, ask for port
    python flash.py --port COM5       # skip the port prompt
    python flash.py --tag v1.0.0      # flash a specific release
    python flash.py --file fw.bin     # flash a local .bin instead of downloading
    python flash.py --erase           # full chip erase before flashing
    python flash.py --monitor         # open serial monitor at 115200 after flashing

Requires:  pip install esptool requests
"""

import argparse, os, sys, json, urllib.request, tempfile, subprocess, time

REPO = "forjun00/smartlocker"
ASSET = "firmware.bin"

def latest_release():
    url = f"https://api.github.com/repos/{REPO}/releases/latest"
    try:
        with urllib.request.urlopen(url) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            raise SystemExit(
                f"\nNo releases yet on {REPO}.\n"
                f"Cut one with:\n"
                f"  git tag v0.1.0\n"
                f"  git push origin v0.1.0\n"
                f"GitHub Actions will build and publish firmware.bin in a few minutes.\n"
                f"Or pass --file <path>.bin to flash a locally built binary.")
        raise

def release_by_tag(tag):
    url = f"https://api.github.com/repos/{REPO}/releases/tags/{tag}"
    with urllib.request.urlopen(url) as r:
        return json.load(r)

def download_asset(release, asset_name, dest):
    for a in release.get("assets", []):
        if a["name"] == asset_name:
            print(f"  downloading {a['name']} ({a['size']} bytes)")
            urllib.request.urlretrieve(a["browser_download_url"], dest)
            return dest
    raise SystemExit(f"asset '{asset_name}' not found in release {release['tag_name']}")

def list_ports():
    try:
        from serial.tools import list_ports
        return [(p.device, p.description) for p in list_ports.comports()]
    except ImportError:
        return []

def pick_port():
    ports = list_ports()
    if not ports:
        return input("Enter serial port (e.g. COM5 or /dev/ttyUSB0): ").strip()
    print("\nDetected serial ports:")
    for i, (dev, desc) in enumerate(ports):
        print(f"  [{i}] {dev:10s}  {desc}")
    choice = input("Pick a port [0]: ").strip() or "0"
    try:
        return ports[int(choice)][0]
    except (ValueError, IndexError):
        return choice

def run(cmd):
    print("$ " + " ".join(cmd))
    subprocess.check_call(cmd)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port")
    ap.add_argument("--tag", help="release tag, e.g. v1.0.0 (default: latest)")
    ap.add_argument("--file", help="path to local .bin (skip download)")
    ap.add_argument("--erase", action="store_true")
    ap.add_argument("--monitor", action="store_true")
    ap.add_argument("--baud", default="921600")
    ap.add_argument("--addr", default="0x10000",
                    help="flash offset (0x10000 = app partition, default)")
    args = ap.parse_args()

    if args.file:
        bin_path = args.file
    else:
        rel = release_by_tag(args.tag) if args.tag else latest_release()
        print(f"Release: {rel['tag_name']}  ({rel['published_at']})")
        tmpdir = tempfile.mkdtemp(prefix="smartlocker-")
        bin_path = os.path.join(tmpdir, ASSET)
        download_asset(rel, ASSET, bin_path)

    port = args.port or pick_port()
    print(f"\nFlashing {bin_path} to {port}\n")

    base = [sys.executable, "-m", "esptool",
            "--chip", "esp32", "--port", port, "--baud", args.baud]

    if args.erase:
        run(base + ["erase_flash"])
        time.sleep(1)

    run(base + ["write_flash", "-z", args.addr, bin_path])

    if args.monitor:
        print("\nOpening serial monitor (Ctrl+C to exit)...")
        try:
            import serial
            with serial.Serial(port, 115200, timeout=0.2) as s:
                while True:
                    data = s.read(256)
                    if data:
                        sys.stdout.write(data.decode("utf-8", "replace"))
                        sys.stdout.flush()
        except KeyboardInterrupt:
            pass

if __name__ == "__main__":
    main()
