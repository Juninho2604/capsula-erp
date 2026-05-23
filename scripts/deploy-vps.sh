#!/usr/bin/env bash
# ============================================================================
# Deploy script para capsula-erp en VPS Contabo (kpsula.app).
#
# Uso:
#   bash /root/deploy-capsula.sh [branch]
#   branch defaults to 'main'.
#
# Flujo:
#   1. Backup pg_dump preventivo de capsula_erp_prod
#   2. Clone fresh del repo en /var/www/capsula-erp-NEW-<timestamp>
#   3. Copia .env, ecosystem.config.js y start-server.sh desde la instalación viva
#   4. npm ci --include=dev (devDeps necesarios para build)
#   5. npm run build (prisma generate + next build standalone)
#   6. Copia public/ y .next/static/ al standalone (nginx los sirve)
#   7. Smoke test Prisma vs BD productiva
#   8. Swap atómico: mv viejo → OLD-<timestamp>, mv nuevo → activo
#   9. pm2 restart con ecosystem
#  10. Verificación post-swap (curl :3000 + pm2 status)
#
# Rollback en ~30 segundos si algo falla:
#   pm2 delete capsula-erp
#   mv /var/www/capsula-erp /var/www/capsula-erp-BROKEN
#   mv /var/www/capsula-erp-OLD-<timestamp> /var/www/capsula-erp
#   pm2 start /var/www/capsula-erp/ecosystem.config.js
#
# Prereqs en el VPS (one-time setup):
#   - /var/www/capsula-erp/.env con DATABASE_URL, NEXTAUTH_SECRET, etc.
#   - /var/www/capsula-erp/ecosystem.config.js (pm2 config)
#   - /var/www/capsula-erp/start-server.sh (wrapper que source .env + exec node)
#   - postgres 18 corriendo en :5433 con capsula_erp_prod
#   - pm2 instalado y corriendo capsula-erp
# ============================================================================
set -euo pipefail

BRANCH="${1:-main}"
REPO_URL="https://github.com/Juninho2604/capsula-erp.git"
APP_DIR="/var/www/capsula-erp"
TS=$(date +%Y%m%d-%H%M%S)
NEW_DIR="/var/www/capsula-erp-NEW-$TS"
OLD_BACKUP="/var/www/capsula-erp-OLD-$TS"
DB_BACKUP="/root/backups/capsula_erp_prod-deploy-$TS.dump"

echo "═══════════════════════════════════════════════════════════════"
echo "  Deploy capsula-erp"
echo "  Branch:  $BRANCH"
echo "  Target:  $APP_DIR"
echo "  Staging: $NEW_DIR"
echo "═══════════════════════════════════════════════════════════════"

# 1. Verificar prereqs
[ -f "$APP_DIR/.env" ]                || { echo "ERROR: $APP_DIR/.env no existe"; exit 1; }
[ -f "$APP_DIR/ecosystem.config.js" ] || { echo "ERROR: $APP_DIR/ecosystem.config.js no existe"; exit 1; }
[ -f "$APP_DIR/start-server.sh" ]     || { echo "ERROR: $APP_DIR/start-server.sh no existe"; exit 1; }
command -v pm2 >/dev/null             || { echo "ERROR: pm2 no instalado"; exit 1; }

# 2. Backup BD
echo ""
echo "[1/9] Backup BD productiva..."
mkdir -p /root/backups
sudo -u postgres pg_dump -p 5433 -Fc capsula_erp_prod > "$DB_BACKUP"
ls -lh "$DB_BACKUP"

# 3. Clone
echo ""
echo "[2/9] Clone $BRANCH..."
git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$NEW_DIR"
cd "$NEW_DIR"
COMMIT=$(git rev-parse HEAD)
echo "    Commit: $COMMIT"

# 4. Copiar config de la instalación viva
echo ""
echo "[3/9] Copiar .env / ecosystem / wrapper..."
cp "$APP_DIR/.env"                "$NEW_DIR/.env"
cp "$APP_DIR/ecosystem.config.js" "$NEW_DIR/ecosystem.config.js"
cp "$APP_DIR/start-server.sh"     "$NEW_DIR/start-server.sh"
chmod 600 "$NEW_DIR/.env"
chmod +x  "$NEW_DIR/start-server.sh"

# 5. npm ci con devDeps
echo ""
echo "[4/9] npm ci (con devDeps)..."
unset NODE_ENV
npm ci --include=dev

# 6. Build
echo ""
echo "[5/9] npm run build..."
set -a; source .env; set +a
export PATH="$PWD/node_modules/.bin:$PATH"
npm run build
[ -f .next/standalone/server.js ] || { echo "ERROR: build no produjo standalone"; exit 1; }

# 7. Assets al standalone
echo ""
echo "[6/10] Copiar public/ y .next/static al standalone..."
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/

# 7.5 Aplicar migraciones Prisma pendientes ANTES del smoke test y del swap.
# Crítico: si el código nuevo agrega columnas o tablas, la BD debe tenerlas
# antes de que pm2 reciba la primera request. `prisma migrate deploy` solo
# aplica migraciones NUEVAS (las ya aplicadas las saltea), así que es
# idempotente y safe correrlo en cada deploy.
# Si una migración falla, abortamos antes del swap — la app vieja sigue
# atendiendo tráfico sin downtime.
# Historial: PR #216 (21 mayo 2026) agregó scheduledDeliveryTime — la
# migración no corrió en el deploy original y la cajera vio el error
# "column does not exist" al cobrar. Fix retroactivo en este commit.
echo ""
echo "[7/10] prisma migrate deploy..."
set -a; source .env; set +a
if ! npx prisma migrate deploy; then
    echo "ERROR: migración Prisma falló. Abort sin swap. $NEW_DIR queda para inspección."
    exit 1
fi

# 8. Smoke test Prisma
echo ""
echo "[8/10] Smoke test Prisma vs BD..."
unset DATABASE_URL
if ! node --env-file="$NEW_DIR/.env" -e '
const { PrismaClient } = require("./.next/standalone/node_modules/@prisma/client");
const p = new PrismaClient();
p.$queryRaw`SELECT 1 as ok`.then(r => { console.log("PRISMA OK:", JSON.stringify(r)); return p.$disconnect(); }).catch(e => { console.error("PRISMA FAIL:", e.message.split("\n")[0]); process.exit(1); });
'; then
  echo "ERROR: Prisma no conectó — abort sin swap. $NEW_DIR queda para inspección."
  exit 1
fi

# 9. Swap
echo ""
echo "[9/10] Swap directorios + restart pm2..."
pm2 stop capsula-erp
mv "$APP_DIR" "$OLD_BACKUP"
mv "$NEW_DIR" "$APP_DIR"

unset PORT NODE_ENV DATABASE_URL NEXTAUTH_URL NEXTAUTH_SECRET JWT_SECRET CRON_SECRET HOSTNAME

pm2 delete capsula-erp 2>/dev/null || true
pm2 start "$APP_DIR/ecosystem.config.js"
pm2 save

sleep 5

# 10. Verificación
echo ""
echo "[10/10] Verificación post-swap..."
pm2 status | grep capsula-erp
echo ""
echo "--- Curl ---"
curl -s -o /dev/null -w "GET / :3000           HTTP %{http_code}\n" http://127.0.0.1:3000/
curl -s -o /dev/null -w "GET /login :3000      HTTP %{http_code}\n" http://127.0.0.1:3000/login
curl -s -o /dev/null -w "GET https://kpsula.app HTTP %{http_code}\n" https://kpsula.app/

echo ""
echo "[11/11] Cleanup de artefactos acumulados..."
# Limpia builds OLD/NEW residuales y backups viejos. Retiene los últimos
# 3 builds y 14 backups por seguridad de rollback. Si falla, NO bloquea
# el éxito del deploy — solo loggea.
if [[ -x "$APP_DIR/scripts/cleanup-deploy-artifacts.sh" ]]; then
    bash "$APP_DIR/scripts/cleanup-deploy-artifacts.sh" --apply || \
        echo "[!] Cleanup falló pero deploy OK — revisar manualmente."
else
    echo "[!] scripts/cleanup-deploy-artifacts.sh no encontrado o no ejecutable, skip."
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✓ Deploy completado"
echo "  Commit:    $COMMIT"
echo "  Backup BD: $DB_BACKUP"
echo "  Old build: $OLD_BACKUP"
echo ""
echo "  Rollback en caso de problemas:"
echo "    pm2 delete capsula-erp"
echo "    mv $APP_DIR ${APP_DIR}-BROKEN-\$(date +%Y%m%d-%H%M)"
echo "    mv $OLD_BACKUP $APP_DIR"
echo "    pm2 start $APP_DIR/ecosystem.config.js"
echo "═══════════════════════════════════════════════════════════════"
