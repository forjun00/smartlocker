#include "ota.h"
#include "config.h"
#include "web.h"
#include <WiFi.h>
#include <ArduinoOTA.h>
#include <Update.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <HTTPUpdate.h>

static bool otaActive = false;

// Pull firmware from a URL (HTTP or HTTPS) and apply it.
// Returns true on success (device will reboot before returning, in practice).
static bool updateFromUrl(const String& url, String* err) {
  if (url.length() == 0) { if (err) *err = "no URL set"; return false; }
  Serial.printf("[OTA-url] fetching %s\n", url.c_str());

  WiFiClient   plain;
  WiFiClientSecure tls;
  tls.setInsecure();  // trust GitHub redirect chain without bundled CA

  httpUpdate.rebootOnUpdate(true);
  httpUpdate.setFollowRedirects(HTTPC_FORCE_FOLLOW_REDIRECTS);

  t_httpUpdate_return r;
  if (url.startsWith("https://")) r = httpUpdate.update(tls,   url);
  else                            r = httpUpdate.update(plain, url);

  switch (r) {
    case HTTP_UPDATE_FAILED:
      if (err) *err = httpUpdate.getLastErrorString();
      Serial.printf("[OTA-url] FAILED: %s\n", httpUpdate.getLastErrorString().c_str());
      return false;
    case HTTP_UPDATE_NO_UPDATES:
      if (err) *err = "no update available";
      return false;
    case HTTP_UPDATE_OK:
      return true;
  }
  return false;
}

void setupOTA() {
  // ----- ArduinoOTA (push from Arduino IDE / espota.py) -----
  ArduinoOTA.setHostname((String("smartlocker-") + cfg.cabId).c_str());
  if (cfg.otaPass.length()) ArduinoOTA.setPassword(cfg.otaPass.c_str());

  ArduinoOTA
    .onStart([]() {
      otaActive = true;
      Serial.println("[OTA] start");
    })
    .onEnd([]() {
      Serial.println("\n[OTA] done");
    })
    .onProgress([](unsigned int p, unsigned int t) {
      Serial.printf("[OTA] %u%%\r", (p * 100) / t);
    })
    .onError([](ota_error_t e) {
      otaActive = false;
      Serial.printf("[OTA] err %u\n", e);
    });
  ArduinoOTA.begin();

  // ----- Web upload (browser → /firmware) -----
  http.on("/firmware", HTTP_GET, []() {
    String html =
      "<!doctype html><meta charset=utf-8>"
      "<meta name=viewport content='width=device-width,initial-scale=1'>"
      "<title>Firmware</title>"
      "<style>body{font-family:system-ui,sans-serif;background:#FBFAF7;color:#2B2733;max-width:430px;margin:0 auto;padding:24px}"
      "h1{font-size:22px;margin:0 0 6px;letter-spacing:-.02em}"
      ".muted{color:#6E6880;font-size:13px}"
      ".card{background:#fff;border:1px solid rgba(43,39,51,.1);border-radius:16px;padding:16px;margin:14px 0}"
      "input[type=file]{width:100%;padding:10px;border:1px dashed rgba(43,39,51,.2);border-radius:12px;background:#FBFAF7}"
      "button{width:100%;margin-top:12px;padding:12px;border:none;border-radius:12px;background:#5a3da8;color:#fff;font-weight:600;font-size:14px;cursor:pointer}"
      "a{color:#5a3da8;font-size:12px}"
      "</style>"
      "<a href='/'>&larr; back</a>"
      "<h1>Firmware update</h1>"
      "<p class='muted'>Three ways to update: file upload, pull from URL, or Arduino IDE network port.</p>"
      "<form class='card' method='post' action='/firmware/upload' enctype='multipart/form-data'>"
      "<div style='font-weight:600;margin-bottom:8px'>1. Upload .bin file</div>"
      "<input type='file' name='fw' accept='.bin' required>"
      "<button type='submit'>Flash &amp; reboot</button>"
      "</form>"
      "<form class='card' method='post' action='/firmware/pull'>"
      "<div style='font-weight:600;margin-bottom:8px'>2. Pull from URL</div>"
      "<input type='url' name='url' placeholder='https://github.com/you/smartlocker/releases/latest/download/firmware.bin' value='" + cfg.updateUrl + "' style='font-size:12px'>"
      "<label style='display:flex;align-items:center;gap:6px;margin:8px 0;font-size:12px;color:#6E6880'><input type='checkbox' name='save' value='1' checked style='width:auto'> Save URL for next time</label>"
      "<button type='submit'>Check &amp; flash</button>"
      "</form>"
      "<p class='muted'>3. Arduino IDE: <i>Tools &rarr; Port &rarr; smartlocker-" + cfg.cabId + " at " + WiFi.localIP().toString() + "</i></p>";
    http.send(200, "text/html", html);
  });

  http.on("/firmware/pull", HTTP_POST, []() {
    String url = http.arg("url");
    if (http.hasArg("save")) { cfg.updateUrl = url; saveConfig(); }
    String err;
    bool ok = updateFromUrl(url, &err);
    if (ok) {
      http.send(200, "text/html",
        "<meta http-equiv='refresh' content='5;url=/'>"
        "<body style='font-family:sans-serif;padding:24px'><h2>OK &mdash; rebooting&hellip;</h2></body>");
    } else {
      http.send(500, "text/html",
        "<body style='font-family:sans-serif;padding:24px'>"
        "<h2>Update failed.</h2><p>" + err + "</p><a href='/firmware'>back</a></body>");
    }
  });

  http.on("/firmware/upload", HTTP_POST,
    // After upload completes:
    []() {
      bool ok = !Update.hasError();
      http.send(200, "text/html",
        ok
          ? "<meta http-equiv='refresh' content='4;url=/'><body style='font-family:sans-serif;padding:24px'><h2>OK &mdash; rebooting&hellip;</h2></body>"
          : "<body style='font-family:sans-serif;padding:24px'><h2>Update failed.</h2><a href='/firmware'>back</a></body>");
      delay(800);
      if (ok) ESP.restart();
    },
    // Streaming upload chunks:
    []() {
      HTTPUpload& u = http.upload();
      if (u.status == UPLOAD_FILE_START) {
        Serial.printf("[OTA-web] %s\n", u.filename.c_str());
        if (!Update.begin(UPDATE_SIZE_UNKNOWN)) Update.printError(Serial);
      } else if (u.status == UPLOAD_FILE_WRITE) {
        if (Update.write(u.buf, u.currentSize) != u.currentSize) Update.printError(Serial);
      } else if (u.status == UPLOAD_FILE_END) {
        if (Update.end(true)) Serial.printf("[OTA-web] %u bytes\n", u.totalSize);
        else                   Update.printError(Serial);
      }
    });
}

void serviceOTA() {
  ArduinoOTA.handle();
}
