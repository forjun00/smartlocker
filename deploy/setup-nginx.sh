#!/usr/bin/env bash
#
# SmartLocker — one-shot nginx + PHP-FPM deploy for Ubuntu/Debian.
#
# Usage (run from the repo root on the server, as a sudo-capable user):
#   sudo bash deploy/setup-nginx.sh
#
# It installs nginx + php-fpm + php-curl, copies the php/ app to
# /var/www/smartlocker, writes the nginx site (with the right FPM socket),
# fixes data/ permissions, and reloads nginx.
#
set -euo pipefail

APP_DIR="/var/www/smartlocker"
SERVER_NAME="${SERVER_NAME:-_}"          # export SERVER_NAME=locker.example.com to set a domain
SRC="$(cd "$(dirname "$0")/../php" && pwd)"

echo "==> Source app:   $SRC"
echo "==> Install dir:  $APP_DIR"
echo "==> Server name:  $SERVER_NAME"

# The built frontend must be present (it's git-ignored — upload it or build it).
if [ ! -f "$SRC/index.html" ] || [ ! -d "$SRC/assets" ]; then
  echo "!! $SRC is missing index.html / assets/ (the built frontend)."
  echo "   On your dev PC: cd frontend && npm run build, then copy dist/index.html"
  echo "   and dist/assets/ into php/, and re-upload. Aborting."
  exit 1
fi

echo "==> Installing packages..."
apt-get update -y
apt-get install -y nginx php-fpm php-curl

# Detect the PHP-FPM unix socket (version-agnostic)
FPM_SOCK="$(ls /run/php/php*-fpm.sock 2>/dev/null | head -1 || true)"
if [ -z "$FPM_SOCK" ]; then
  echo "!! Could not find a php-fpm socket in /run/php/. Is php-fpm running?"
  systemctl status "php*-fpm" --no-pager || true
  exit 1
fi
echo "==> PHP-FPM socket: $FPM_SOCK"

echo "==> Copying app to $APP_DIR..."
mkdir -p "$APP_DIR"
cp -r "$SRC"/. "$APP_DIR"/
# nginx ignores these; remove to avoid confusion
rm -f "$APP_DIR/.htaccess" "$APP_DIR/data/.htaccess"

echo "==> Permissions (web server must write data/)..."
mkdir -p "$APP_DIR/data"
chown -R www-data:www-data "$APP_DIR"
chmod -R 755 "$APP_DIR"
chmod -R 775 "$APP_DIR/data"

echo "==> Writing nginx site..."
cat > /etc/nginx/sites-available/smartlocker <<NGINX
server {
    listen 80;
    server_name ${SERVER_NAME};
    root ${APP_DIR};
    index index.html;
    client_max_body_size 2m;

    location /api/ {
        try_files \$uri /api.php?\$query_string;
    }

    location = /api.php {
        include fastcgi_params;
        fastcgi_pass unix:${FPM_SOCK};
        fastcgi_param SCRIPT_FILENAME \$document_root/api.php;
        fastcgi_param HTTP_AUTHORIZATION \$http_authorization;
    }

    location ^~ /data/ { deny all; return 403; }

    location /assets/ {
        try_files \$uri =404;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files \$uri /index.html;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/smartlocker /etc/nginx/sites-enabled/smartlocker
rm -f /etc/nginx/sites-enabled/default

echo "==> Testing + reloading nginx..."
nginx -t
systemctl reload nginx
systemctl enable nginx php*-fpm >/dev/null 2>&1 || true

echo ""
echo "==> Done. SmartLocker is live on http://${SERVER_NAME%_}/  (admin: see api.php)"
echo "    Next: edit ${APP_DIR}/api.php for ADMIN_PASSWORD / CAB_ID, and add TLS (certbot)."
