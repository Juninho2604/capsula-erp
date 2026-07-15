#!/usr/bin/env bash
# ============================================================================
# Watchdog del servidor local — corre por cron cada 2 minutos.
# Mantiene vivas las 3 piezas: app (pm2), BD (postgres) y túnel al VPS.
# Log: /var/log/capsula-watchdog.log (solo escribe cuando algo anda mal).
# ============================================================================
set -uo pipefail

CONF_FILE="/etc/capsula-local.conf"
[ -f "$CONF_FILE" ] && source "$CONF_FILE"
DB_PORT="${DB_PORT:-5432}"

ts() { date -Is; }

# 1. ¿Postgres responde?
if ! sudo -u postgres pg_isready -p "$DB_PORT" -q; then
    echo "[$(ts)] postgres NO responde — restarting postgresql"
    systemctl restart postgresql || echo "[$(ts)] ❌ restart de postgres falló"
fi

# 2. ¿La app responde? (health real, no solo proceso vivo)
if ! curl -fsS -m 10 http://127.0.0.1:3000/api/health >/dev/null; then
    echo "[$(ts)] app NO responde en :3000 — pm2 restart capsula-erp"
    pm2 restart capsula-erp >/dev/null 2>&1 || echo "[$(ts)] ❌ pm2 restart falló"
fi

# 3. ¿El túnel al VPS está activo? (systemd ya lo reintenta solo; esto
#    cubre el caso "quedó disabled/failed por intervención manual")
if systemctl list-unit-files capsula-tunnel.service >/dev/null 2>&1; then
    if ! systemctl is-active --quiet capsula-tunnel.service; then
        echo "[$(ts)] túnel caído — systemctl restart capsula-tunnel"
        systemctl restart capsula-tunnel.service \
            || echo "[$(ts)] ❌ restart del túnel falló (¿sin internet? systemd seguirá reintentando)"
    fi
fi
