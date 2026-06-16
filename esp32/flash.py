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

import argparse, os, sys, json, urllib.request, urllib.error, tempfile, subprocess, time, shutil

REPO = "forjun00/smartlocker"
ASSET = "firmware.bin"

def _gh_available():
    return shutil.which("gh") is not None

def _gh_download(tag, asset_name, dest_dir):
    """Use 'gh' CLI for private repos (uses user's existing auth)."""
    args = ["gh", "release", "download"]
    if tag: args += [tag]
    args += ["--repo", REPO, "--pattern", asset_name, "--dir", dest_dir, "--clobber"]
    print("$ " + " ".join(args))
    subprocess.check_call(args)
    return os.path.join(dest_dir, asset_name)

def fetch_release_asset(tag, dest_dir):
    """Returns path to downloaded firmware.bin. tag=None means latest."""
    dest = os.path.join(dest_dir, ASSET)
    # Try public API first
    try:
        api = (f"https://api.github.com/repos/{REPO}/releases/latest" if tag is None
               else f"https://api.github.com/repos/{REPO}/releases/tags/{tag}")
        with urllib.request.urlopen(api) as r:
            rel = json.load(r)
        for a in rel.get("assets", []):
            if a["name"] == ASSET:
                print(f"  downloading {a['name']} ({a['size']} bytes) from public API")
                urllib.request.urlretrieve(a["browser_download_url"], dest)
                return dest
        raise SystemExit(f"asset '{ASSET}' not found in release {rel.get('tag_name')}")
    except urllib.error.HTTPError as e:
        if e.code not in (401, 404):
            raise
    # Private repo (or no release) — fall back to gh CLI
    if not _gh_available():
        raise SystemExit(
            f"\nCould not reach release on {REPO} unauthenticated (probably a private repo).\n"
            f"Options:\n"
            f"  - Install GitHub CLI (winget install GitHub.cli) and run `gh auth login`\n"
            f"  - Or pass --file <path>.bin to flash a locally built binary\n"
            f"  - Or make the repo public so anyone can download releases")
    return _gh_download(tag, ASSET, dest_dir)

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
        tmpdir = tempfile.mkdtemp(prefix="smartlocker-")
        bin_path = fetch_release_asset(args.tag, tmpdir)

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
