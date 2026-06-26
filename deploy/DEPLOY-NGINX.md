# Deploy SmartLocker on an nginx server (PHP edition)

This runs the dependency-free PHP backend ([../php/](../php/)) behind **nginx + PHP-FPM**.
No Python needed. Targets **Ubuntu/Debian**; adapt package names for other distros.

What you deploy = the **`php/` folder** (it already contains the built frontend).

---

## 0. Build the frontend (on your dev PC, once)
The web UI in `php/` is a build artifact (git-ignored), so make sure it's current:
```bash
cd frontend
npm run build
cp dist/index.html ../php/
cp -r dist/assets ../php/
```
(They're already there from this session — only redo this if you change the frontend.)

## 1. Upload to the server
Copy the repo (or at least `php/` and `deploy/`) to the server, e.g.:
```bash
scp -r php deploy youruser@YOUR_SERVER:/home/youruser/smartlocker/
```

## 2. Run the installer (Ubuntu/Debian)
```bash
cd /home/youruser/smartlocker
sudo bash deploy/setup-nginx.sh
# optional: give it a domain
sudo SERVER_NAME=locker.example.com bash deploy/setup-nginx.sh
```
The script installs nginx + php-fpm + php-curl, copies the app to
`/var/www/smartlocker`, writes the nginx site with the correct FPM socket,
fixes `data/` permissions, and reloads nginx.

## 3. Configure
Edit `/var/www/smartlocker/api.php` (top of file):
| Constant | Set to |
|----------|--------|
| `ADMIN_PASSWORD` | a strong password |
| `CAB_ID` | must match the ESP32's CABINET ID |
| `MQTT_HOST` | `mqtt.mdbiot.com` (already) |
| `ASEFA_URL` | `https://innovations.asefa.co.th/cdn/sms/` (already) |
| `PUBLIC_BASE_URL` | leave blank — it derives from the request host (so SMS links match your domain automatically) |

## 4. HTTPS (recommended)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d locker.example.com
```
certbot edits the nginx site to add `listen 443 ssl;` and an HTTP→HTTPS redirect.
Pickup links then become `https://…` automatically (PUBLIC_BASE_URL is host-derived).

---

## Manual setup (if you don't use the script)
1. `sudo apt install -y nginx php-fpm php-curl`
2. Copy `php/` contents to `/var/www/smartlocker` (drop the two `.htaccess` files — nginx ignores them).
3. `sudo chown -R www-data:www-data /var/www/smartlocker && sudo chmod -R 775 /var/www/smartlocker/data`
4. Copy [nginx-php.conf](nginx-php.conf) to `/etc/nginx/sites-available/smartlocker`, set `root` and the
   `fastcgi_pass` socket (`ls /run/php/php*-fpm.sock`), then:
   ```bash
   sudo ln -s /etc/nginx/sites-available/smartlocker /etc/nginx/sites-enabled/
   sudo rm -f /etc/nginx/sites-enabled/default
   sudo nginx -t && sudo systemctl reload nginx
   ```

## Checklist after deploy
- `http://YOUR_SERVER/` shows the locker UI.
- Admin login works (`/`, then admin page).
- Lock a slot → SMS arrives (gateway returns `202 Accepted`).
- ESP32 CONFIG → set the same `CAB_ID` and `MQTT HOST = mqtt.mdbiot.com`; INFO shows `MQTT: connected`.

## Notes
- **Storage** is JSON files in `/var/www/smartlocker/data/` — back these up.
- **Firewall**: open ports 80/443 (`sudo ufw allow 'Nginx Full'`).
- **Other distros**: RHEL/CentOS use `dnf install nginx php-fpm php-cli`, socket at
  `/run/php-fpm/www.sock`; set `fastcgi_pass` accordingly.
- Prefer the **Python/Flask** backend instead? Use [nginx-flask.conf](nginx-flask.conf)
  with gunicorn — see comments in that file.
