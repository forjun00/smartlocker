# SmartLocker — PHP / XAMPP edition

A complete PHP port of the SmartLocker backend that runs under **XAMPP's Apache** —
no Python required. Same JSON API the React frontend uses, the same Asefa SMS
sending (your `sendSMS`), file-based storage, admin login + SMS toggle, and a
dependency-free MQTT publisher for the ESP32 cabinet.

## What's in this folder
```
api.php        the whole backend (all /api/* endpoints)
index.html     the built React frontend (entry)
assets/        the built JS/CSS
.htaccess      Apache routing: /api -> api.php, everything else -> SPA
data/          JSON storage (lockers, events, settings, tokens) — auto-created
```

## Requirements
- **XAMPP** with Apache (PHP 7.4+; tested on PHP 8.0).
- Apache **mod_rewrite** enabled (on by default in XAMPP).
- PHP **curl** extension (on by default — used for SMS).

## Install (5 minutes)
The frontend calls the API at the **absolute** path `/api/...`, so the app must be
served from the **document root** (not a subfolder).

**Option A — use htdocs as the root (simplest):**
1. Copy **everything in this `php/` folder** into `C:\xampp\htdocs\`
   (so `htdocs\api.php`, `htdocs\index.html`, `htdocs\assets\`, `htdocs\.htaccess`, `htdocs\data\`).
2. Start **Apache** from the XAMPP Control Panel.
3. Open **http://localhost/** (or `http://<this-pc-ip>/` from another device).

**Option B — a dedicated virtual host (keeps htdocs free):**
1. In `C:\xampp\apache\conf\extra\httpd-vhosts.conf` add:
   ```apache
   <VirtualHost *:80>
       DocumentRoot "C:/Users/forju/Desktop/smartlocker/php"
       ServerName smartlocker.local
       <Directory "C:/Users/forju/Desktop/smartlocker/php">
           AllowOverride All
           Require all granted
       </Directory>
   </VirtualHost>
   ```
2. Add `127.0.0.1 smartlocker.local` to `C:\Windows\System32\drivers\etc\hosts`.
3. Restart Apache, open **http://smartlocker.local/**.

## Configure
Edit the constants at the top of **`api.php`**:
| Constant | Default | Meaning |
|----------|---------|---------|
| `ADMIN_PASSWORD` | `admin1234` | admin dashboard password |
| `NUM_LOCKERS` | `10` | number of slots |
| `MQTT_HOST` / `MQTT_PORT` | `mqtt.mdbiot.com` / `1883` | broker for the cabinet (blank host = MQTT off) |
| `CAB_ID` | `cab1` | must match the ESP32's CABINET ID |
| `ASEFA_URL` | `https://innovations.asefa.co.th/cdn/sms/` | SMS gateway |
| `PUBLIC_BASE_URL` | `` (derive) | base URL inside the SMS link; blank = use the request host |

## Notes
- **Admin:** go to `/` then the admin page, password `admin1234`.
- **SMS toggle** lives on the admin page (BASE URL card) — off = no real texts.
- **Storage** is plain JSON in `data/` (protected from web access by `data/.htaccess`).
- **MQTT** uses a tiny built-in QoS-0 publisher (no PHP extension/Composer needed).
- If you change the frontend, rebuild it (`npm run build` in `frontend/`) and copy
  `dist/index.html` + `dist/assets/` here again.
- To regenerate a clean state, delete the JSON files in `data/` (they re-create).
