#include "web.h"
#include "config.h"
#include "slots.h"
#include "net.h"
#include "version.h"
#include <WiFi.h>

WebServer http(80);
unsigned long bootMs = 0;

static String htmlEscape(const String& s) {
  String o; o.reserve(s.length());
  for (size_t i = 0; i < s.length(); i++) {
    char c = s[i];
    if      (c == '<')  o += "&lt;";
    else if (c == '>')  o += "&gt;";
    else if (c == '&')  o += "&amp;";
    else if (c == '"')  o += "&quot;";
    else                o += c;
  }
  return o;
}

static const char PAGE_HEAD[] PROGMEM = R"HTML(
<!doctype html><html><head><meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1">
<title>SmartLocker Node</title>
<style>
:root{--bg:#FBFAF7;--ink:#2B2733;--muted:#6E6880;--mint-bg:#d6f0e2;--mint-fg:#1f6b48;
      --rose-bg:#f5d9d0;--rose-fg:#7a3320;--violet:#5a3da8;--card:rgba(255,255,255,.9);
      --border:rgba(43,39,51,.1)}
*{box-sizing:border-box}body{font-family:system-ui,'Space Grotesk',sans-serif;background:var(--bg);color:var(--ink);margin:0;padding:18px;max-width:430px;margin:0 auto}
h1{font-size:24px;margin:0 0 4px;letter-spacing:-.02em}
.muted{color:var(--muted);font-size:13px}
.tag{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:.16em;color:var(--violet)}
.card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:12px 14px;margin:8px 0;box-shadow:0 2px 8px rgba(0,0,0,.03)}
.row{display:flex;align-items:center;justify-content:space-between;gap:10px}
.bullet{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;font-family:'Space Mono',monospace;font-weight:700;font-size:14px}
.pill{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:.12em;padding:5px 10px;border-radius:999px}
.mint{background:var(--mint-bg);color:var(--mint-fg)}
.rose{background:var(--rose-bg);color:var(--rose-fg)}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
button{font:inherit;border:1px solid var(--border);background:#fff;color:var(--ink);padding:10px;border-radius:12px;cursor:pointer;font-weight:600;font-size:13px}
button.primary{background:var(--violet);color:#fff;border-color:transparent}
input{font:inherit;width:100%;padding:11px 13px;border-radius:12px;border:1px solid var(--border);background:#fff;outline:none}
label{display:block;font-family:'Space Mono',monospace;font-size:10px;letter-spacing:.14em;color:var(--muted);margin:10px 0 5px}
nav{display:flex;gap:6px;margin-bottom:14px}
nav a{flex:1;text-align:center;padding:9px;border-radius:10px;text-decoration:none;color:var(--muted);background:#fff;border:1px solid var(--border);font-size:12px;font-weight:600}
nav a.active{background:var(--ink);color:#fff;border-color:transparent}
.kv{display:flex;justify-content:space-between;font-size:13px;padding:4px 0}
.kv span:first-child{color:var(--muted)}
.dot{width:9px;height:9px;border-radius:50%;display:inline-block;margin-right:6px;vertical-align:middle}
.on{background:#1f9a55}.off{background:#bcb6c8}
</style></head><body>
)HTML";

static void sendNav(const char* active) {
  http.sendContent("<nav>");
  http.sendContent(String("<a class='") + (strcmp(active,"status")==0?"active":"") + "' href='/'>STATUS</a>");
  http.sendContent(String("<a class='") + (strcmp(active,"config")==0?"active":"") + "' href='/config'>CONFIG</a>");
  http.sendContent(String("<a class='") + (strcmp(active,"pins")==0?"active":"")   + "' href='/pins'>PINS</a>");
  http.sendContent(String("<a class='") + (strcmp(active,"info")==0?"active":"")   + "' href='/info'>INFO</a>");
  http.sendContent("</nav>");
  http.sendContent("<div style='text-align:center;font-family:\"Space Mono\",monospace;font-size:10px;letter-spacing:.12em;color:#ABA4BC;margin:-6px 0 14px'>FIRMWARE " FW_VERSION "</div>");
}

static void handleRoot() {
  http.setContentLength(CONTENT_LENGTH_UNKNOWN);
  http.send(200, "text/html", "");
  http.sendContent_P(PAGE_HEAD);
  sendNav("status");
  http.sendContent("<div class='tag'>CABINET &middot; ");
  http.sendContent(htmlEscape(cfg.cabId));
  http.sendContent("</div><h1>Slot status</h1><p class='muted' id='liveTag'>Live &mdash; updating every 1s.</p>");

  for (int i = 0; i < slotCount; i++) {
    String id  = String(slots[i].id);
    String id2 = slots[i].id < 10 ? ("0" + id) : id;
    String c; c.reserve(900);
    c += "<div class='card' id='slot" + id + "'><div class='row'>";
    c += "<div style='display:flex;align-items:center;gap:10px'>";
    c += "<div class='bullet mint' data-bullet>" + id2 + "</div>";
    c += "<div><div style='font-weight:700;font-size:15px'>Slot " + id2 + "</div>";
    c += "<div class='muted' style='font-size:11px'>relay GPIO " + String(slots[i].relayPin) + "</div></div></div>";
    c += "<div class='pill mint' data-pill>OPEN</div></div>";
    c += "<div class='kv'><span>Digital output</span><span><span class='dot off' data-dot></span><span data-relay>OFF</span></span></div>";
    c += "<div class='grid'>";
    c += "<button type='button' data-act='lock' data-id='" + id + "'>Lock</button>";
    c += "<button class='primary' type='button' data-act='unlock' data-id='" + id + "'>Unlock</button>";
    c += "</div></div>";
    http.sendContent(c);
  }

  http.sendContent(
    "<script>"
    "let fails=0;"
    "async function poll(){"
      "try{const r=await fetch('/api/state',{cache:'no-store'});"
      "if(!r.ok)throw 0;const d=await r.json();fails=0;"
      "document.getElementById('liveTag').textContent='Live \\u00b7 cabinet '+d.cab;"
      "for(const s of d.slots){const el=document.getElementById('slot'+s.id);if(!el)continue;"
      "const pill=el.querySelector('[data-pill]'),bul=el.querySelector('[data-bullet]'),"
      "dot=el.querySelector('[data-dot]'),rel=el.querySelector('[data-relay]');"
      "const cls=s.locked?'rose':'mint';"
      "pill.className='pill '+cls;pill.textContent=s.locked?'LOCKED':'OPEN';"
      "bul.className='bullet '+cls;"
      "dot.className='dot '+(s.relay?'on':'off');rel.textContent=s.relay?'ON':'OFF';}"
      "}catch(e){fails++;if(fails>3)document.getElementById('liveTag').textContent='Offline \\u2014 reconnecting\\u2026';}"
    "}"
    "async function act(ev){const b=ev.target.closest('button[data-act]');if(!b)return;"
      "b.disabled=true;const fd=new FormData();fd.append('id',b.dataset.id);"
      "try{await fetch('/api/'+b.dataset.act,{method:'POST',body:fd});}finally{b.disabled=false;poll();}}"
    "document.addEventListener('click',act);"
    "poll();setInterval(poll,1000);"
    "</script></body></html>");
  http.sendContent("");
}

static void handleConfig() {
  http.setContentLength(CONTENT_LENGTH_UNKNOWN);
  http.send(200, "text/html", "");
  http.sendContent_P(PAGE_HEAD);
  sendNav("config");
  http.sendContent("<h1>Config</h1><p class='muted'>WiFi &amp; MQTT settings. Saved to flash. Reboots after save.</p>");
  http.sendContent("<form method='post' action='/save' class='card'>");
  String form;
  form += "<label>WIFI SSID</label><input name='ssid' value='" + htmlEscape(cfg.wifiSsid) + "'>";
  form += "<label>WIFI PASSWORD</label><input name='pass' type='password' value='" + htmlEscape(cfg.wifiPass) + "'>";
  form += "<label>MQTT HOST</label><input name='mhost' value='" + htmlEscape(cfg.mqttHost) + "'>";
  form += "<label>MQTT PORT</label><input name='mport' value='" + String(cfg.mqttPort) + "'>";
  form += "<label>MQTT USER (optional)</label><input name='muser' value='" + htmlEscape(cfg.mqttUser) + "'>";
  form += "<label>MQTT PASSWORD (optional)</label><input name='mpass' type='password' value='" + htmlEscape(cfg.mqttPass) + "'>";
  form += "<label>CABINET ID</label><input name='cabid' value='" + htmlEscape(cfg.cabId) + "'>";
  form += "<label style='margin-top:18px'>NETWORK MODE</label>";
  form += "<label style='display:flex;align-items:center;gap:8px;letter-spacing:0;font-size:13px;color:var(--ink);font-family:inherit;margin:6px 0 4px'>";
  form += "<input type='checkbox' name='ustatic' value='1' style='width:auto'";
  if (cfg.useStatic) form += " checked";
  form += "> Use static IP (otherwise DHCP)</label>";
  form += "<label>STATIC IP</label><input name='sip' placeholder='192.168.1.50' value='" + htmlEscape(cfg.staticIp) + "'>";
  form += "<label>GATEWAY</label><input name='sgw' placeholder='192.168.1.1' value='" + htmlEscape(cfg.staticGw) + "'>";
  form += "<label>SUBNET MASK</label><input name='smask' value='" + htmlEscape(cfg.staticMask) + "'>";
  form += "<label>DNS</label><input name='sdns' value='" + htmlEscape(cfg.staticDns) + "'>";
  form += "<label style='margin-top:18px'>OTA PASSWORD (optional, blank = open)</label>";
  form += "<input name='otap' type='password' value='" + htmlEscape(cfg.otaPass) + "'>";
  form += "<label>UPDATE URL (direct .bin link)</label>";
  form += "<input name='uurl' placeholder='https://github.com/.../releases/latest/download/firmware.bin' value='" + htmlEscape(cfg.updateUrl) + "' style='font-size:12px'>";
  form += "<label style='margin-top:18px'>DIRECT ACCESS AP</label>";
  form += "<label style='display:flex;align-items:center;gap:8px;letter-spacing:0;font-size:13px;color:var(--ink);font-family:inherit;margin:6px 0 4px'>";
  form += "<input type='checkbox' name='apalw' value='1' style='width:auto'";
  if (cfg.apAlways) form += " checked";
  form += "> Always broadcast own Wi-Fi (AP+STA)</label>";
  form += "<div style='font-size:11px;color:#6E6880;margin-bottom:4px'>SSID will be <b>SmartLocker-" + htmlEscape(cfg.cabId) + "</b>. Connect to it to reach this page directly even if the router is down.</div>";
  form += "<label>AP PASSWORD (min 8 chars, blank/short = open)</label>";
  form += "<input name='appass' value='" + htmlEscape(cfg.apPass) + "'>";
  form += "<div style='height:14px'></div><button class='primary' type='submit' style='width:100%'>Save &amp; reboot</button>";
  form += "</form>";
  http.sendContent(form);
  http.sendContent("</body></html>");
  http.sendContent("");
}

static void handleSave() {
  if (http.hasArg("ssid"))  cfg.wifiSsid = http.arg("ssid");
  if (http.hasArg("pass"))  cfg.wifiPass = http.arg("pass");
  if (http.hasArg("mhost")) cfg.mqttHost = http.arg("mhost");
  if (http.hasArg("mport")) cfg.mqttPort = (uint16_t)http.arg("mport").toInt();
  if (http.hasArg("muser")) cfg.mqttUser = http.arg("muser");
  if (http.hasArg("mpass")) cfg.mqttPass = http.arg("mpass");
  if (http.hasArg("cabid")) cfg.cabId    = http.arg("cabid");
  cfg.useStatic = http.hasArg("ustatic");
  if (http.hasArg("sip"))   cfg.staticIp   = http.arg("sip");
  if (http.hasArg("sgw"))   cfg.staticGw   = http.arg("sgw");
  if (http.hasArg("smask")) cfg.staticMask = http.arg("smask");
  if (http.hasArg("sdns"))  cfg.staticDns  = http.arg("sdns");
  if (http.hasArg("otap"))  cfg.otaPass    = http.arg("otap");
  if (http.hasArg("uurl"))  cfg.updateUrl  = http.arg("uurl");
  cfg.apAlways = http.hasArg("apalw");
  if (http.hasArg("appass")) cfg.apPass    = http.arg("appass");
  saveConfig();
  http.send(200, "text/html",
    "<meta http-equiv='refresh' content='3;url=/'>"
    "<body style='font-family:sans-serif;padding:24px'><h2>Saved.</h2><p>Rebooting&hellip;</p></body>");
  delay(800);
  ESP.restart();
}

static void handleInfo() {
  http.setContentLength(CONTENT_LENGTH_UNKNOWN);
  http.send(200, "text/html", "");
  http.sendContent_P(PAGE_HEAD);
  sendNav("info");
  http.sendContent("<h1>Info</h1>");
  String body = "<div class='card'>";
  body += "<div class='kv'><span>Firmware</span><span style='font-weight:700'>" FW_VERSION "</span></div>";
  body += "<div class='kv'><span>Mode</span><span>" + String(apMode ? "AP (setup)" : (cfg.apAlways ? "AP+STA" : "Station")) + "</span></div>";
  body += "<div class='kv'><span>IP</span><span>" + (apMode ? WiFi.softAPIP().toString() : WiFi.localIP().toString()) + "</span></div>";
  if (cfg.apAlways && !apMode) {
    body += "<div class='kv'><span>Shared AP</span><span>SmartLocker-" + htmlEscape(cfg.cabId) + "</span></div>";
    body += "<div class='kv'><span>AP IP</span><span>" + WiFi.softAPIP().toString() + "</span></div>";
  }
  body += "<div class='kv'><span>MAC</span><span>" + WiFi.macAddress() + "</span></div>";
  body += "<div class='kv'><span>WiFi RSSI</span><span>" + String(WiFi.RSSI()) + " dBm</span></div>";
  body += "<div class='kv'><span>MQTT</span><span>" + String(mqtt.connected() ? "connected" : "disconnected") + "</span></div>";
  body += "<div class='kv'><span>Cabinet</span><span>" + htmlEscape(cfg.cabId) + "</span></div>";
  body += "<div class='kv'><span>Uptime</span><span>" + String((millis() - bootMs) / 1000) + " s</span></div>";
  body += "<div class='kv'><span>Free heap</span><span>" + String(ESP.getFreeHeap()) + " B</span></div>";
  body += "</div>";
  body += "<a href='/firmware' style='display:block;text-align:center;width:100%;padding:11px;border:1px solid var(--border);border-radius:12px;text-decoration:none;color:var(--ink);font-weight:600;font-size:13px;margin-bottom:8px'>Firmware update (OTA)</a>";
  body += "<form method='post' action='/reboot'><button style='width:100%' type='submit'>Reboot</button></form>";
  http.sendContent(body);
  http.sendContent("</body></html>");
  http.sendContent("");
}

static void handleApiLock()   { Slot* s = findSlotById(http.arg("id").toInt()); if (s) manualPulse(s - slots); http.send(200, "application/json", "{\"ok\":true}"); }
static void handleApiUnlock() { Slot* s = findSlotById(http.arg("id").toInt()); if (s) manualPulse(s - slots); http.send(200, "application/json", "{\"ok\":true}"); }

static void handleApiState() {
  String j = "{\"cab\":\"" + cfg.cabId + "\",\"slots\":[";
  for (int i = 0; i < slotCount; i++) {
    if (i) j += ",";
    j += "{\"id\":" + String(slots[i].id) +
         ",\"relay\":" + (relayOn[i] ? "true" : "false") +
         ",\"locked\":" + (lockedState[i] ? "true" : "false") +
         ",\"door\":\"" + String(slots[i].doorPin < 0 ? "na" : (doorClosed[i] ? "closed" : "ajar")) + "\"}";
  }
  j += "]}";
  http.send(200, "application/json", j);
}

static void handlePins() {
  http.setContentLength(CONTENT_LENGTH_UNKNOWN);
  http.send(200, "text/html", "");
  http.sendContent_P(PAGE_HEAD);
  sendNav("pins");
  http.sendContent("<h1>Pin mapping</h1><p class='muted'>Set how many slots this cabinet has and which GPIO drives each relay. Saved to flash. Reboots after save.</p>");
  http.sendContent("<form method='post' action='/pins/save' class='card'>");
  String s;
  s += "<label>SLOT COUNT (1&ndash;" + String(MAX_SLOTS) + ")</label>";
  s += "<input name='count' type='number' min='1' max='" + String(MAX_SLOTS) + "' value='" + String(slotCount) + "'>";
  s += "<div style='font-size:11px;color:#6E6880;margin-top:8px;line-height:1.5'>Safe GPIOs: 4, 5, 13, 14, 16&ndash;19, 21&ndash;23, 25&ndash;27, 32, 33. Avoid 0, 2, 6&ndash;11, 12, 15, 34&ndash;39.</div>";
  s += "<div style='display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px'>";
  for (int i = 0; i < MAX_SLOTS; i++) {
    String id2 = i + 1 < 10 ? ("0" + String(i + 1)) : String(i + 1);
    s += "<div><label style='margin:0 0 4px'>SLOT " + id2 + "</label>";
    s += "<input name='p" + String(i) + "' type='number' min='0' max='39' value='" + String(slots[i].relayPin) + "'></div>";
  }
  s += "</div>";
  s += "<div style='height:14px'></div><button class='primary' type='submit' style='width:100%'>Save &amp; reboot</button>";
  s += "</form>";
  http.sendContent(s);
  http.sendContent("</body></html>");
  http.sendContent("");
}

static void handlePinsSave() {
  if (http.hasArg("count")) {
    int c = http.arg("count").toInt();
    if (c < 1)          c = 1;
    if (c > MAX_SLOTS)  c = MAX_SLOTS;
    slotCount = c;
  }
  for (int i = 0; i < MAX_SLOTS; i++) {
    String rk = "p" + String(i);
    if (http.hasArg(rk)) {
      int p = http.arg(rk).toInt();
      if (p < 0)  p = 0;
      if (p > 39) p = 39;
      slots[i].relayPin = p;
    }
  }
  saveSlotMapping();
  http.send(200, "text/html",
    "<meta http-equiv='refresh' content='3;url=/'>"
    "<body style='font-family:sans-serif;padding:24px'><h2>Saved.</h2><p>Rebooting&hellip;</p></body>");
  delay(800);
  ESP.restart();
}

static void handleReboot() {
  http.send(200, "text/html", "<meta http-equiv='refresh' content='2;url=/'><body><h2>Rebooting&hellip;</h2></body>");
  delay(500); ESP.restart();
}

void setupWeb() {
  http.on("/",           HTTP_GET,  handleRoot);
  http.on("/config",     HTTP_GET,  handleConfig);
  http.on("/save",       HTTP_POST, handleSave);
  http.on("/pins",       HTTP_GET,  handlePins);
  http.on("/pins/save",  HTTP_POST, handlePinsSave);
  http.on("/info",       HTTP_GET,  handleInfo);
  http.on("/reboot",     HTTP_POST, handleReboot);
  http.on("/api/lock",   HTTP_POST, handleApiLock);
  http.on("/api/unlock", HTTP_POST, handleApiUnlock);
  http.on("/api/state",  HTTP_GET,  handleApiState);
  http.onNotFound([]() {
    if (apMode) { http.sendHeader("Location", String("http://") + WiFi.softAPIP().toString() + "/config"); http.send(302); }
    else        { http.send(404, "text/plain", "not found"); }
  });
  http.begin();
}

void serviceWeb() { http.handleClient(); }
