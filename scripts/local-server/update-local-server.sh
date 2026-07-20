#!/usr/bin/env bash
# ============================================================================
# Actualización del servidor local a la última versión de main.
#
# El CI del repo solo despliega al VPS — el servidor local se actualiza
# corriendo esto (como root, en la máquina del restaurante):
#
#   bash /var/www/capsula-erp/scripts/local-server/update-local-server.sh [branch]
#
# Hace backup previo de la BD, actualiza código, build, migraciones y
# reinicia pm2. Si el build falla, la app vieja sigue corriendo (pm2 no se
# reinicia hasta que todo esté OK). Correr FUERA del horario de servicio.
# ============================================================================
set -euo pipefail

# Auto-reexec desde /tmp: el git checkout de abajo REEMPLAZA este mismo
# archivo mientras bash lo está leyendo (bash lee los scripts por pedazos)
# → comportamiento indefinido. Corriendo la copia, el checkout es inocuo.
if [ "${CAPSULA_UPDATE_REEXEC:-}" != "1" ]; then
    TMP_SELF=$(mktemp /tmp/update-local-server-XXXXXX.sh)
    cp "${BASH_SOURCE[0]}" "$TMP_SELF"
    CAPSULA_UPDATE_REEXEC=1 exec bash "$TMP_SELF" "$@"
fi

BRANCH="${1:-main}"
APP_DIR="/var/www/capsula-erp"
CONF_FILE="/etc/capsula-local.conf"
[ -f "$CONF_FILE" ] && source "$CONF_FILE"
DB_NAME="${DB_NAME:-capsula_erp_prod}"
DB_PORT="${DB_PORT:-5432}"
TS="$(date +%Y%m%d-%H%M%S)"

[ "$(id -u)" -eq 0 ] || { echo "ERROR: correr como root"; exit 1; }
cd "$APP_DIR"

echo "[1/5] Backup preventivo de la BD..."
mkdir -p /var/backups/capsula-local
sudo -u postgres pg_dump -p "$DB_PORT" -Fc "$DB_NAME" \
    > "/var/backups/capsula-local/capsula-pre-update-$TS.dump"

echo "[2/5] git fetch + checkout $BRANCH..."
git fetch origin "$BRANCH"
git checkout -B "$BRANCH" "origin/$BRANCH"
echo "    Commit: $(git rev-parse --short HEAD)"

echo "[3/5] npm ci + build..."
unset NODE_ENV
npm ci --include=dev
set -a; source .env; set +a
export PATH="$PWD/node_modules/.bin:$PATH"
npm run build
[ -f .next/standalone/server.js ] || { echo "ERROR: build no produjo standalone — la app vieja sigue corriendo"; exit 1; }

echo "[4/5] esquema de BD + assets..."
# Misma lógica que install-local-server.sh: antes del cutover la BD local
# no tiene _prisma_migrations (nació con db push) → migrate deploy fallaría.
# Post-cutover (dump del VPS con historial) usa migrate deploy normal.
if sudo -u postgres psql -d "$DB_NAME" -p "$DB_PORT" -tAc \
        "SELECT 1 FROM information_schema.tables WHERE table_name='_prisma_migrations'" | grep -q 1; then
    npx prisma migrate deploy
else
    echo "    BD sin historial de migraciones (pre-cutover) → prisma db push"
    npx prisma db push --skip-generate
fi
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/

echo "[5/5] pm2 restart..."
pm2 restart capsula-erp
sleep 3
curl -fsS -m 10 http://127.0.0.1:3000/api/health >/dev/null \
    && echo "✅ Actualizado y respondiendo." \
    || { echo "❌ La app no responde tras el restart — revisar pm2 logs capsula-erp"; exit 1; }
