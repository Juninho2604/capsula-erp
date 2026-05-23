#!/bin/bash
#
# setup-cron-retry.sh
# -------------------
# Configura el cron job en el VPS que invoca /api/cron/retry-inventory-deductions
# cada 5 min. Crea un wrapper en /usr/local/bin/ que lee CRON_SECRET del .env
# (para no exponer el secret en la línea del crontab) y agrega la entry si
# no existe.
#
# Idempotente: si el cron ya está, no duplica. Si el wrapper ya existe, lo
# pisa con la versión actual (en caso de que cambien rutas o secrets).
#
# Uso (como root, en el VPS):
#   bash scripts/setup-cron-retry.sh
#
# Verificación post-instalación:
#   crontab -l | grep capsula-cron-retry
#   tail -f /var/log/capsula-cron.log
#
# Para deshabilitarlo después:
#   crontab -l | grep -v capsula-cron-retry | crontab -

set -euo pipefail

ENV_FILE=/var/www/capsula-erp/.env
WRAPPER=/usr/local/bin/capsula-cron-retry.sh
LOG_FILE=/var/log/capsula-cron.log
CRON_LINE="*/5 * * * * ${WRAPPER} >> ${LOG_FILE} 2>&1"

# ─── Pre-checks ─────────────────────────────────────────────────────────────

if [[ $EUID -ne 0 ]]; then
    echo "ABORT: este script debe correrse como root (necesita escribir en /usr/local/bin)."
    exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
    echo "ABORT: no encuentro $ENV_FILE"
    exit 1
fi

if ! grep -q '^CRON_SECRET=' "$ENV_FILE"; then
    echo "ABORT: CRON_SECRET no está seteado en $ENV_FILE"
    echo "Agregalo primero: echo \"CRON_SECRET=\$(openssl rand -hex 32)\" >> $ENV_FILE"
    exit 1
fi

# ─── 1. Crear wrapper ──────────────────────────────────────────────────────

cat > "$WRAPPER" <<'WRAPPER_EOF'
#!/bin/bash
# Wrapper del cron retry de outbox de Capsula ERP.
# Generado por scripts/setup-cron-retry.sh — no editar a mano.

set -e
ENV_FILE=/var/www/capsula-erp/.env
SECRET=$(grep '^CRON_SECRET=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")

# La URL se arma de pedazos para evitar problemas de copy/paste en docs.
PROTO=http
HOST=127.0.0.1
PORT=3000
ENDPOINT=/api/cron/retry-inventory-deductions

exec /usr/bin/curl -fsS \
    --max-time 60 \
    -H "Authorization: Bearer ${SECRET}" \
    "${PROTO}://${HOST}:${PORT}${ENDPOINT}"
WRAPPER_EOF

chmod +x "$WRAPPER"
echo "✓ Wrapper escrito en $WRAPPER"

# ─── 2. Asegurar log file ──────────────────────────────────────────────────

touch "$LOG_FILE"
chmod 644 "$LOG_FILE"
echo "✓ Log file: $LOG_FILE"

# ─── 3. Agregar al crontab si no existe ────────────────────────────────────

if crontab -l 2>/dev/null | grep -qF "$WRAPPER"; then
    echo "✓ Cron ya estaba configurado (no duplicado):"
    crontab -l | grep -F "$WRAPPER"
else
    (crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
    echo "✓ Cron agregado:"
    crontab -l | grep -F "$WRAPPER"
fi

# ─── 4. Smoke test inmediato ───────────────────────────────────────────────

echo ""
echo "──────────────── Smoke test ────────────────"
echo "Ejecutando wrapper una vez..."
if RESULT=$("$WRAPPER" 2>&1); then
    echo "✓ Endpoint respondió OK:"
    echo "  $RESULT"
    echo ""
    echo "Listo. El cron correrá cada 5 min."
    echo "  Ver logs:  tail -f $LOG_FILE"
    echo "  Forzar:    $WRAPPER"
else
    echo "✗ Endpoint respondió con error. Output:"
    echo "  $RESULT"
    echo ""
    echo "Verificaciones:"
    echo "  1. ¿pm2 está corriendo capsula-erp? → pm2 status"
    echo "  2. ¿CRON_SECRET en .env coincide con el deploy actual?"
    echo "  3. ¿curl localmente al endpoint manualmente?"
    exit 1
fi
