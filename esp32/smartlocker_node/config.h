#pragma once
#include <Arduino.h>

struct Config {
  String   wifiSsid;
  String   wifiPass;
  String   mqttHost;
  uint16_t mqttPort;
  String   mqttUser;
  String   mqttPass;
  String   cabId;
  bool     useStatic;
  String   staticIp;
  String   staticGw;
  String   staticMask;
  String   staticDns;
  String   otaPass;     // empty = no OTA password
  String   updateUrl;   // direct .bin URL (e.g. GitHub release "latest" asset)
  bool     apAlways;    // always broadcast own AP (AP+STA), even when on WiFi
  String   apPass;      // password for the always-on AP (>=8 chars, or open)
};

extern Config cfg;

void loadConfig();
void saveConfig();
