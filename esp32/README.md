# SmartLocker ESP32 firmware

Modular sketch for the ESP32 cabinet controller.

## Folder layout

```
smartlocker_node/
├── smartlocker_node.ino  -- setup() / loop() glue
├── config.h / .cpp       -- Config struct + NVS persistence
├── slots.h / .cpp        -- slot wiring + relay control
├── net.h / .cpp          -- WiFi + MQTT
├── web.h / .cpp          -- web UI + JSON API
└── ota.h / .cpp          -- ArduinoOTA + browser OTA
```

## Build options

### A) Arduino IDE (local)
1. Open `smartlocker_node/smartlocker_node.ino`.
2. Boards Manager: install **esp32 by Espressif Systems** (≥3.0.7).
3. Library Manager: install **PubSubClient** by Nick O'Leary.
4. Board: `ESP32 Dev Module`. Flash once via USB.
5. Subsequent flashes: **Tools → Port → smartlocker-cabX at 192.168.x.x** (OTA).

### B) GitHub Actions (cloud build)
Every push to `esp32/**` triggers `.github/workflows/build-esp32.yml`. The job:
- Installs the ESP32 core + PubSubClient via arduino-cli
- Compiles the sketch
- Uploads the compiled `.bin` as a workflow artifact

Download the artifact from the **Actions** tab → flash via the device's
`http://<esp-ip>/firmware` page (drag-and-drop).

### C) arduino-cli (local CLI, optional)
```bash
arduino-cli core install esp32:esp32
arduino-cli lib install PubSubClient
arduino-cli compile --fqbn esp32:esp32:esp32 --export-binaries esp32/smartlocker_node
```
Binary lands in `esp32/smartlocker_node/build/esp32.esp32.esp32/smartlocker_node.ino.bin`.

## First-time provisioning

1. Flash once via USB.
2. ESP32 starts AP `SmartLocker-Setup` (pass `smartlocker`).
3. Connect, open `http://192.168.4.1/config`, fill in WiFi + MQTT + cabinet ID.
4. Save → reboots into Station mode.
5. After that, all future flashes go through `/firmware` (browser) or Arduino IDE network port.
