#!/usr/bin/env bash
# ============================================================================
# Instalación del SERVIDOR LOCAL del restaurante (capsula-erp on-premise).
#
# Target: Ubuntu Server 24.04 LTS o Debian 12/13 en el computador dedicado
# del local (mismo script para ambos; postgres viene del repo PGDG).
# Correr como root. Idempotente: se puede re-correr si un paso falla.
#
#   bash install-local-server.sh [branch]
#   branch defaults to 'main'.
#
# Qué instala:
#   - Node.js 20 + pm2 (app Next.js standalone en 127.0.0.1:3000)
#   - PostgreSQL 18 vía PGDG (BD capsula_erp_prod, role capsula, :5432)
#     — misma major version que el VPS para que el dump del cutover
#     restaure sin problemas de compatibilidad
#   - nginx sirviendo la app a la LAN por el puerto 80
#   - ufw (solo SSH y 80 abiertos hacia la LAN)
#   - Crons de watchdog (cada 2 min) y backup→VPS (cada 6 horas)
#
# Después de esto correr setup-tunnel-local.sh para conectar con el VPS.
# Runbook completo: docs/LOCAL_SERVER.md
# ============================================================================
set -euo pipefail

BRANCH="${1:-main}"
REPO_URL="https://github.com/Juninho2604/capsula-erp.git"
APP_DIR="/var/www/capsula-erp"
DB_NAME="capsula_erp_prod"
DB_USER="capsula"
DB_PORT="5432"
CONF_FILE="/etc/capsula-local.conf"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

[ "$(id -u)" -eq 0 ] || { echo "ERROR: correr como root"; exit 1; }

echo "═══════════════════════════════════════════════════════════════"
echo "  Instalación servidor local capsula-erp (branch: $BRANCH)"
echo "═══════════════════════════════════════════════════════════════"

# ── [1/9] Sistema base ──────────────────────────────────────────────────────
echo ""
echo "[1/9] Timezone + paquetes base..."
timedatectl set-timezone America/Caracas
apt-get update -qq
apt-get install -y -qq git curl nginx ufw openssh-client ca-certificates \
    postgresql-common sudo openssl cron unattended-upgrades fail2ban

# Hardening base: parches de seguridad automáticos + anti brute-force SSH.
# unattended-upgrades: solo security updates (default Debian/Ubuntu), sin
# reinicios automáticos — los updates de la app van por update-local-server.sh.
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
systemctl enable --now unattended-upgrades 2>/dev/null || true
# fail2ban: jail sshd activo con defaults (5 intentos → ban 10 min).
systemctl enable --now fail2ban

# ── [2/9] Node 20 + pm2 ─────────────────────────────────────────────────────
echo ""
echo "[2/9] Node.js 20 + pm2..."
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
fi
command -v pm2 >/dev/null || npm install -g pm2
node -v && pm2 -v

# ── [3/9] PostgreSQL ────────────────────────────────────────────────────────
echo ""
echo "[3/9] PostgreSQL 18 (BD $DB_NAME, role $DB_USER, puerto $DB_PORT)..."
# PostgreSQL 18 vía repo PGDG — la MISMA major version que corre el VPS.
# Importante: el cutover restaura un dump hecho con pg_dump 18; restaurarlo
# en el postgres que trae la distro (16 en Ubuntu 24.04, 15/17 en Debian)
# puede fallar por incompatibilidad de versiones. PGDG funciona igual en
# Ubuntu y Debian.
if ! psql --version 2>/dev/null | grep -q ' 18'; then
    /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
    apt-get install -y -qq postgresql-18
    apt-get install -y -qq postgresql-contrib-18 2>/dev/null || true
fi
systemctl enable --now postgresql
DB_PASS_FILE="/root/.capsula-db-pass"
if [ ! -f "$DB_PASS_FILE" ]; then
    openssl rand -hex 24 > "$DB_PASS_FILE"
    chmod 600 "$DB_PASS_FILE"
fi
DB_PASS="$(cat "$DB_PASS_FILE")"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 \
    || sudo -u postgres psql -c "CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASS';"
sudo -u postgres psql -c "ALTER ROLE $DB_USER PASSWORD '$DB_PASS';"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 \
    || sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"

# ── [4/9] Código ────────────────────────────────────────────────────────────
echo ""
echo "[4/9] Clone/actualización del repo..."
if [ -d "$APP_DIR/.git" ]; then
    git -C "$APP_DIR" fetch origin "$BRANCH"
    git -C "$APP_DIR" checkout -B "$BRANCH" "origin/$BRANCH"
else
    git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

# ── [5/9] .env local ────────────────────────────────────────────────────────
echo ""
echo "[5/9] Configuración .env..."
if [ ! -f "$APP_DIR/.env" ]; then
    JWT_SECRET_GEN="$(openssl rand -hex 32)"
    sed -e "s|__DB_PASS__|$DB_PASS|" \
        -e "s|__DB_PORT__|$DB_PORT|" \
        -e "s|__DB_NAME__|$DB_NAME|" \
        -e "s|__DB_USER__|$DB_USER|" \
        -e "s|__JWT_SECRET__|$JWT_SECRET_GEN|" \
        "$SCRIPT_DIR/env.example" > "$APP_DIR/.env"
    chmod 600 "$APP_DIR/.env"
    echo "    .env creado desde template."
    echo "    ⚠️  EDITAR $APP_DIR/.env: EXTRA_TRUSTED_HOSTS con la IP fija de"
    echo "        esta máquina, y JWT_SECRET/PRINT_AGENT_API_KEY copiados del"
    echo "        VPS si quieren mantener credenciales idénticas."
else
    echo "    .env ya existe — no se toca."
fi

# ── [6/9] Build + migraciones ───────────────────────────────────────────────
echo ""
echo "[6/9] npm ci + build + prisma migrate deploy..."
unset NODE_ENV
npm ci --include=dev
set -a; source .env; set +a
export PATH="$PWD/node_modules/.bin:$PATH"
npm run build
[ -f .next/standalone/server.js ] || { echo "ERROR: build no produjo standalone"; exit 1; }
npx prisma migrate deploy
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/

# ── [7/9] pm2 ───────────────────────────────────────────────────────────────
echo ""
echo "[7/9] pm2 (app en 127.0.0.1:3000)..."
cat > "$APP_DIR/start-server.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
cd /var/www/capsula-erp
set -a; source .env; set +a
export NODE_ENV=production
export HOSTNAME=127.0.0.1
export PORT=3000
exec node .next/standalone/server.js
EOF
chmod +x "$APP_DIR/start-server.sh"
cat > "$APP_DIR/ecosystem.config.js" <<'EOF'
module.exports = {
    apps: [{
        name: 'capsula-erp',
        script: '/var/www/capsula-erp/start-server.sh',
        interpreter: 'bash',
        max_restarts: 50,
        restart_delay: 3000,
        out_file: '/var/log/capsula-erp.out.log',
        error_file: '/var/log/capsula-erp.err.log',
    }],
};
EOF
pm2 delete capsula-erp >/dev/null 2>&1 || true
pm2 start "$APP_DIR/ecosystem.config.js"
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null || true

# ── [8/9] nginx + firewall ──────────────────────────────────────────────────
echo ""
echo "[8/9] nginx (LAN :80) + ufw..."
cp "$SCRIPT_DIR/nginx-local.conf" /etc/nginx/sites-available/capsula-local
ln -sf /etc/nginx/sites-available/capsula-local /etc/nginx/sites-enabled/capsula-local
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw --force enable >/dev/null
echo "    ufw activo: solo SSH y 80 expuestos."

# ── [9/9] Config compartida + crons ─────────────────────────────────────────
echo ""
echo "[9/9] /etc/capsula-local.conf + crons de watchdog y backup..."
if [ ! -f "$CONF_FILE" ]; then
    cat > "$CONF_FILE" <<EOF
# Config compartida de los scripts del servidor local (docs/LOCAL_SERVER.md)
DB_NAME=$DB_NAME
DB_PORT=$DB_PORT
VPS_HOST=147.93.6.70
VPS_TUNNEL_USER=capsula-tunnel
BACKUP_KEY=/root/.ssh/capsula-backup
EOF
    chmod 600 "$CONF_FILE"
fi
install -m 755 "$SCRIPT_DIR/watchdog.sh" /usr/local/bin/capsula-watchdog.sh
install -m 755 "$SCRIPT_DIR/push-backup-to-vps.sh" /usr/local/bin/capsula-push-backup.sh
cat > /etc/cron.d/capsula-local <<'EOF'
# Watchdog del servidor local (app, BD, túnel) — cada 2 minutos
*/2 * * * * root /usr/local/bin/capsula-watchdog.sh >> /var/log/capsula-watchdog.log 2>&1
# Backup local → VPS — cada 6 horas
15 */6 * * * root /usr/local/bin/capsula-push-backup.sh >> /var/log/capsula-backup.log 2>&1
EOF

LAN_IP="$(hostname -I | awk '{print $1}')"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✅ Instalación completa."
echo ""
echo "  App LAN:      http://$LAN_IP  (tablets y cajas apuntan acá)"
echo "  Health:       curl -s http://127.0.0.1:3000/api/health"
echo ""
echo "  Próximos pasos (docs/LOCAL_SERVER.md):"
echo "   1. Editar $APP_DIR/.env (EXTRA_TRUSTED_HOSTS=$LAN_IP, secrets del VPS)"
echo "      y luego: pm2 restart capsula-erp"
echo "   2. Restaurar el dump de producción del VPS (sección 'Migración de datos')"
echo "   3. bash setup-tunnel-local.sh  (conexión 24/7 con kpsula.app)"
echo "═══════════════════════════════════════════════════════════════"
