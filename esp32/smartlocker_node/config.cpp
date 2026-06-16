#include "config.h"
#include <Preferences.h>

Config cfg;
static Preferences prefs;

void loadConfig() {
  prefs.begin("locker", true);
  cfg.wifiSsid   = prefs.getString("ssid",    "");
  cfg.wifiPass   = prefs.getString("pass",    "");
  cfg.mqttHost   = prefs.getString("mhost",   "");
  cfg.mqttPort   = prefs.getUShort("mport",   1883);
  cfg.mqttUser   = prefs.getString("muser",   "");
  cfg.mqttPass   = prefs.getString("mpass",   "");
  cfg.cabId      = prefs.getString("cabid",   "cab1");
  cfg.useStatic  = prefs.getBool  ("ustatic", false);
  cfg.staticIp   = prefs.getString("sip",     "");
  cfg.staticGw   = prefs.getString("sgw",     "");
  cfg.staticMask = prefs.getString("smask",   "255.255.255.0");
  cfg.staticDns  = prefs.getString("sdns",    "8.8.8.8");
  cfg.otaPass    = prefs.getString("otap",    "");
  cfg.updateUrl  = prefs.getString("uurl",    "");
  prefs.end();
}

void saveConfig() {
  prefs.begin("locker", false);
  prefs.putString("ssid",    cfg.wifiSsid);
  prefs.putString("pass",    cfg.wifiPass);
  prefs.putString("mhost",   cfg.mqttHost);
  prefs.putUShort("mport",   cfg.mqttPort);
  prefs.putString("muser",   cfg.mqttUser);
  prefs.putString("mpass",   cfg.mqttPass);
  prefs.putString("cabid",   cfg.cabId);
  prefs.putBool  ("ustatic", cfg.useStatic);
  prefs.putString("sip",     cfg.staticIp);
  prefs.putString("sgw",     cfg.staticGw);
  prefs.putString("smask",   cfg.staticMask);
  prefs.putString("sdns",    cfg.staticDns);
  prefs.putString("otap",    cfg.otaPass);
  prefs.putString("uurl",    cfg.updateUrl);
  prefs.end();
}
