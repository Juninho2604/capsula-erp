#!/usr/bin/env bash
# ============================================================================
# Backup de la BD del servidor local → VPS (off-site) + copia local.
#
# Corre por cron cada 6 horas (instalado por install-local-server.sh).
# El VPS lo recibe vía la llave capsula-backup (forced command que guarda
# en /var/lib/postgresql/backups/local-server/ con retención 30 días).
# Con esto el VPS siempre tiene una copia reciente para el plan de
# contingencia (docs/LOCAL_SERVER.md).
# ============================================================================
set -euo pipefail

CONF_FILE="/etc/capsula-local.conf"
[ -f "$CONF_FILE" ] && source "$CONF_FILE"
DB_NAME="${DB_NAME:-capsula_erp_prod}"
DB_PORT="${DB_PORT:-5432}"
VPS_HOST="${VPS_HOST:?VPS_HOST no seteado en $CONF_FILE}"
VPS_TUNNEL_USER="${VPS_TUNNEL_USER:-capsula-tunnel}"
BACKUP_KEY="${BACKUP_KEY:-/root/.ssh/capsula-backup}"
LOCAL_DIR="/var/backups/capsula-local"

TS="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$LOCAL_DIR"
DUMP="$LOCAL_DIR/capsula-$TS.dump"

echo "[$(date -Is)] pg_dump $DB_NAME..."
sudo -u postgres pg_dump -p "$DB_PORT" -Fc "$DB_NAME" > "$DUMP"
echo "[$(date -Is)] dump local: $DUMP ($(du -h "$DUMP" | cut -f1))"

# Uploads (storage/ de la app: notas de entrega, comprobantes) — copia local.
# Solo la BD viaja al VPS; storage/ queda respaldado en este disco.
STORAGE_DIR="/var/www/capsula-erp/storage"
if [ -d "$STORAGE_DIR" ]; then
    tar -czf "$LOCAL_DIR/storage-$TS.tar.gz" -C "$(dirname "$STORAGE_DIR")" storage
fi

# Retención local: 14 días
find "$LOCAL_DIR" -name 'capsula-*.dump' -mtime +14 -delete
find "$LOCAL_DIR" -name 'storage-*.tar.gz' -mtime +14 -delete

# Push al VPS (la forced command del otro lado escribe el archivo).
# Si no hay internet, no es fatal: el dump local queda y el próximo cron
# vuelve a intentar con un dump fresco.
if ssh -T -i "$BACKUP_KEY" \
        -o ConnectTimeout=20 \
        -o StrictHostKeyChecking=accept-new \
        "$VPS_TUNNEL_USER@$VPS_HOST" < "$DUMP"; then
    echo "[$(date -Is)] push al VPS OK"
else
    echo "[$(date -Is)] ⚠️ push al VPS FALLÓ (¿sin internet?) — dump local conservado"
fi
