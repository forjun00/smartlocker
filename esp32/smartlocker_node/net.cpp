#include "net.h"
#include "config.h"
#include "slots.h"
#include <WiFi.h>
#include <DNSServer.h>

static WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);
bool apMode = false;

static DNSServer dns;
static unsigned long lastHeartbeat = 0;
static unsigned long lastDoorPoll  = 0;
static unsigned long lastWifiCheck = 0;

String topicBase() { return String("smartlocker/") + cfg.cabId + "/"; }
String slotTopic(int id, const char* leaf) {
  return topicBase() + "slot/" + id + "/" + leaf;
}

void publishState(int idx, bool retain) {
  if (!mqtt.connected()) return;
  mqtt.publish(slotTopic(slots[idx].id, "state").c_str(),
               lockedState[idx] ? "locked" : "open", retain);
}
void publishDoor(int idx, bool retain) {
  if (!mqtt.connected()) return;
  mqtt.publish(slotTopic(slots[idx].id, "door").c_str(),
               doorClosed[idx] ? "closed" : "ajar", retain);
}

static void onMessage(char* tpc, byte* payload, unsigned int len) {
  String t = String(tpc);
  String body; body.reserve(len);
  for (unsigned int i = 0; i < len; i++) body += (char)payload[i];

  int slotMark = t.indexOf("/slot/");
  int cmdMark  = t.indexOf("/cmd");
  if (slotMark < 0 || cmdMark < 0) return;
  int id = t.substring(slotMark + 6, cmdMark).toInt();
  Slot* s = findSlotById(id);
  if (!s) return;
  int idx = s - slots;

  Serial.printf("[MQTT] slot %d <- %s\n", id, body.c_str());

  if      (body == "unlock" || body == "pulse") doUnlock(idx);
  else if (body == "lock")                       doLock(idx);
  else if (body == "release")                    driveRelay(idx, false);
}

bool connectWiFi(uint32_t timeoutMs) {
  if (cfg.wifiSsid.length() == 0) return false;
  Serial.printf("WiFi connecting to %s\n", cfg.wifiSsid.c_str());
  WiFi.mode(WIFI_STA);
  if (cfg.useStatic && cfg.staticIp.length() && cfg.staticGw.length()) {
    IPAddress ip, gw, mask, dns;
    if (ip.fromString(cfg.staticIp) && gw.fromString(cfg.staticGw) &&
        mask.fromString(cfg.staticMask)) {
      if (!dns.fromString(cfg.staticDns)) dns = gw;
      WiFi.config(ip, gw, mask, dns);
      Serial.printf("static IP %s\n", ip.toString().c_str());
    }
  }
  WiFi.begin(cfg.wifiSsid.c_str(), cfg.wifiPass.c_str());
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < timeoutMs) {
    delay(300); Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf(" OK %s\n", WiFi.localIP().toString().c_str());
    return true;
  }
  Serial.println(" FAILED");
  return false;
}

void startAP() {
  apMode = true;
  WiFi.mode(WIFI_AP);
  WiFi.softAP("SmartLocker-Setup", "smartlocker");
  dns.start(53, "*", WiFi.softAPIP());
  Serial.printf("AP mode. http://%s\n", WiFi.softAPIP().toString().c_str());
}

void connectMQTT() {
  if (cfg.mqttHost.length() == 0) return;
  mqtt.setServer(cfg.mqttHost.c_str(), cfg.mqttPort);
  mqtt.setCallback(onMessage);
  mqtt.setBufferSize(512);
  mqtt.setKeepAlive(30);

  String clientId = String("smartlocker-") + cfg.cabId + "-" +
                    String((uint32_t)ESP.getEfuseMac(), HEX);
  String willTopic = topicBase() + "status";

  uint32_t t0 = millis();
  while (!mqtt.connected() && millis() - t0 < 5000) {
    Serial.print("MQTT...");
    bool ok = mqtt.connect(
      clientId.c_str(),
      cfg.mqttUser.length() ? cfg.mqttUser.c_str() : nullptr,
      cfg.mqttPass.length() ? cfg.mqttPass.c_str() : nullptr,
      willTopic.c_str(), 1, true, "offline"
    );
    if (ok) {
      Serial.println(" connected");
      mqtt.publish(willTopic.c_str(), "online", true);
      mqtt.subscribe((topicBase() + "slot/+/cmd").c_str(), 1);
      for (int i = 0; i < slotCount; i++) {
        publishState(i);
        if (slots[i].doorPin >= 0) publishDoor(i);
      }
    } else {
      Serial.printf(" rc=%d\n", mqtt.state());
      delay(1500);
    }
  }
}

void serviceWiFi() {
  if (apMode) { dns.processNextRequest(); return; }
  if (WiFi.status() != WL_CONNECTED && millis() - lastWifiCheck > 5000) {
    lastWifiCheck = millis();
    Serial.println("WiFi dropped, retrying");
    connectWiFi(8000);
  }
}

void serviceMQTT() {
  if (apMode) return;
  if (!mqtt.connected() && cfg.mqttHost.length()) connectMQTT();
  mqtt.loop();

  unsigned long now = millis();
  if (now - lastDoorPoll > 100) { lastDoorPoll = now; pollDoors(); }
  if (now - lastHeartbeat > 30000) {
    lastHeartbeat = now;
    if (mqtt.connected()) mqtt.publish((topicBase() + "heartbeat").c_str(), "alive");
  }
}
