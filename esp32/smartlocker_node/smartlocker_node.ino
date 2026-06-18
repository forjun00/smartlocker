// SmartLocker ESP32 cabinet controller (modular).
// Files in this sketch folder:
//   smartlocker_node.ino  -- setup() / loop() glue
//   config.h/.cpp         -- Config struct + NVS load/save
//   slots.h/.cpp          -- slot wiring + relay control
//   net.h/.cpp            -- WiFi + MQTT
//   web.h/.cpp            -- web UI + JSON API
//
// Library: PubSubClient by Nick O'Leary (install via Library Manager).

#include "config.h"
#include "slots.h"
#include "net.h"
#include "web.h"
#include "ota.h"
#include "version.h"

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\nSmartLocker ESP32 node booting  " FW_VERSION);

  bootMs = millis();
  loadConfig();
  initSlots();

  if (!connectWiFi()) startAP();

  setupWeb();
  if (!apMode) setupOTA();

  if (!apMode) connectMQTT();
}

void loop() {
  serviceWeb();
  serviceWiFi();
  serviceMQTT();
  if (!apMode) serviceOTA();
}
