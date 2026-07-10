#!/usr/bin/env bash
# ============================================================================
# diagnose-vps.sh — Diagnóstico de salud del VPS de KPSULA (SOLO LECTURA)
# ============================================================================
# NO modifica, reinicia ni borra NADA. Solo lee métricas del sistema, pm2,
# PostgreSQL y nginx, y las imprime. Guarda una copia en /tmp para compartir.
#
# Uso (en el VPS):
#   bash /var/www/capsula-erp/scripts/diagnose-vps.sh
#
# Cada sección tiene timeout — si algo no está disponible, sigue de largo.
# Las credenciales de la BD se usan internamente pero NUNCA se imprimen.
# ============================================================================

set -u
REPORT="/tmp/kpsula-diagnostico-$(date +%Y%m%d-%H%M%S).txt"
exec > >(tee "$REPORT") 2>&1

APP_DIR="${APP_DIR:-/var/www/capsula-erp}"
T() { timeout "${2:-10}" bash -c "$1" 2>&1 || echo "  (no disponible)"; }
section() { echo; echo "══════════════════════════════════════════════════"; echo "▓ $1"; echo "══════════════════════════════════════════════════"; }

echo "KPSULA — Diagnóstico VPS · $(date '+%Y-%m-%d %H:%M:%S') · host: $(hostname)"
echo "(solo lectura — ningún cambio aplicado)"

section "1. CARGA Y UPTIME"
T "uptime"
CORES=$(nproc 2>/dev/null || echo "?")
echo "  Cores: $CORES  ← load average por encima de este número = CPU saturada"

section "2. MEMORIA RAM Y SWAP"
T "free -h"
echo "  → Si 'available' es bajo y swap 'used' es alto, hay presión de memoria."
T "vmstat 1 3 | tail -4" 8

section "3. TOP 12 PROCESOS POR MEMORIA"
T "ps aux --sort=-%mem | head -13"

section "4. TOP 12 PROCESOS POR CPU"
T "ps aux --sort=-%cpu | head -13"

section "5. DISCO"
T "df -h | grep -vE 'tmpfs|udev|overlay'"
echo "  — Tamaño de directorios clave:"
T "du -sh $APP_DIR 2>/dev/null" 30
T "du -sh $APP_DIR/.next 2>/dev/null" 20
T "du -sh /root/.pm2/logs 2>/dev/null" 20
T "du -sh /var/log 2>/dev/null" 30
T "du -sh /var/lib/postgresql 2>/dev/null" 30
echo "  — Backups/builds viejos del deploy:"
T "ls -dlh ${APP_DIR}* 2>/dev/null | head -10" 10

section "6. PM2 — ESTADO Y REINICIOS"
T "pm2 status" 15
echo "  → '↺' alto = la app se reinicia sola (memoria/crashes)."
T "pm2 describe capsula-erp | grep -E 'restarts|uptime|memory|created|status'" 15
echo "  — Últimos errores de la app (30 líneas, sin stream):"
T "pm2 logs capsula-erp --err --lines 30 --nostream" 15

section "7. POSTGRESQL"
# La URL se lee del .env pero NO se imprime.
DB_URL=$(grep -m1 '^DATABASE_URL=' "$APP_DIR/.env" 2>/dev/null | cut -d= -f2- | tr -d '"' | sed 's/?schema=.*//')
if [ -n "${DB_URL:-}" ] && command -v psql >/dev/null; then
    PSQL="psql \"$DB_URL\" -X -q -t -A -F' | '"
    echo "  — Tamaño de la base de datos:"
    T "$PSQL -c \"SELECT pg_size_pretty(pg_database_size(current_database()));\"" 15
    echo "  — Conexiones actuales (máx. permitidas / en uso / por estado):"
    T "$PSQL -c \"SELECT current_setting('max_connections');\"" 10
    T "$PSQL -c \"SELECT state, count(*) FROM pg_stat_activity GROUP BY state ORDER BY 2 DESC;\"" 10
    echo "  → 'idle in transaction' alto = conexiones colgadas (fuga del pool)."
    echo "  — Queries corriendo hace más de 30s:"
    T "$PSQL -c \"SELECT pid, now()-query_start AS dur, left(query,90) FROM pg_stat_activity WHERE state='active' AND now()-query_start > interval '30 seconds' ORDER BY dur DESC LIMIT 8;\"" 10
    echo "  — Top 10 tablas por tamaño total:"
    T "$PSQL -c \"SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) FROM pg_catalog.pg_statio_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 10;\"" 15
    echo "  — Cache hit ratio (ideal > 0.99):"
    T "$PSQL -c \"SELECT round(sum(blks_hit)::numeric/nullif(sum(blks_hit)+sum(blks_read),0),4) FROM pg_stat_database;\"" 10
    echo "  — Filas en tablas operativas de alto churn:"
    T "$PSQL -c \"SELECT 'PrintJob' t, count(*) FROM \\\"PrintJob\\\" UNION ALL SELECT 'PrintJob PENDING', count(*) FROM \\\"PrintJob\\\" WHERE status='PENDING' UNION ALL SELECT 'InventoryMovement', count(*) FROM \\\"InventoryMovement\\\" UNION ALL SELECT 'AuditLog', (SELECT count(*) FROM \\\"AuditLog\\\") ;\"" 20
    echo "  — Dead tuples (necesitan VACUUM si son muchos vs filas vivas):"
    T "$PSQL -c \"SELECT relname, n_live_tup, n_dead_tup FROM pg_stat_user_tables ORDER BY n_dead_tup DESC LIMIT 8;\"" 15
else
    echo "  (psql o DATABASE_URL no disponibles — sección omitida)"
fi

section "8. NGINX"
T "systemctl is-active nginx && echo '  nginx: activo'" 10
echo "  — Últimos errores de nginx:"
T "tail -20 /var/log/nginx/error.log" 10
echo "  — Requests por minuto (últimos 5 min del access log):"
T "awk -v d=\"\$(date -d '5 minutes ago' '+%d/%b/%Y:%H:%M' 2>/dev/null)\" 'index(\$0,d)>0' /var/log/nginx/access.log 2>/dev/null | wc -l" 15

section "9. RED — PUERTOS ESCUCHANDO"
T "ss -tlnp | head -15"

section "10. ERRORES RECIENTES DEL SISTEMA (journal, prioridad err)"
T "journalctl -p err -n 20 --no-pager --since '24 hours ago'" 15

section "11. SEGURIDAD RÁPIDA — intentos SSH fallidos (24h)"
T "journalctl -u ssh -u sshd --since '24 hours ago' --no-pager 2>/dev/null | grep -c 'Failed password'" 20
echo "  → Miles de intentos = bots golpeando SSH (consume CPU/log). Normal en VPS públicos, mitigable con fail2ban."

echo
echo "══════════════════════════════════════════════════"
echo "Diagnóstico completo. Copia guardada en: $REPORT"
echo "Compártelo completo para el análisis (no contiene credenciales)."
echo "══════════════════════════════════════════════════"
