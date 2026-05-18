#!/usr/bin/env bash
#
# restore-smoketest.sh
# ────────────────────
# Verifica que un dump pueda restaurarse correctamente, SIN tocar la BD
# productiva. Crea una BD scratch (`capsula_erp_smoketest`), restaura ahí,
# valida row counts mínimos, y la dropea.
#
# Diseñado para correrse:
#   - Manual cuando el operador quiere validar un dump específico.
#   - Vía cron mensual / workflow Actions para alerta automática.
#
# CRÍTICO: este script NUNCA toca `capsula_erp_prod`. Si por error la BD
# scratch coincidiera con la productiva, aborta.
#
# Uso:
#   # Restaurar el dump más reciente:
#   sudo -u postgres ./restore-smoketest.sh
#
#   # Restaurar un dump específico:
#   sudo -u postgres ./restore-smoketest.sh /var/lib/postgresql/backups/capsula-2026-05-18.dump
#
# Exit codes:
#   0  = restore OK, row counts validados
#   1  = no se encontró dump
#   2  = pg_restore falló
#   3  = row counts insuficientes (BD restaurada parece vacía)

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/lib/postgresql/backups}"
SCRATCH_DB="${SCRATCH_DB:-capsula_erp_smoketest}"
PROD_DB="${PROD_DB:-capsula_erp_prod}"
DUMP_PATH="${1:-}"

# ── Safety: nunca tocar prod ──────────────────────────────────────────────
if [[ "$SCRATCH_DB" == "$PROD_DB" ]]; then
    echo "[FATAL] SCRATCH_DB == PROD_DB. Abortando." >&2
    exit 2
fi

# ── Elegir dump ───────────────────────────────────────────────────────────
if [[ -z "$DUMP_PATH" ]]; then
    DUMP_PATH="$(ls -1t "$BACKUP_DIR"/*.dump 2>/dev/null | head -1 || true)"
fi
if [[ -z "$DUMP_PATH" || ! -f "$DUMP_PATH" ]]; then
    echo "[ERROR] No se encontró dump." >&2
    exit 1
fi
echo "[INFO] Validando dump: $DUMP_PATH"
echo "[INFO] BD scratch:     $SCRATCH_DB (se borra al final)"

# ── Listado del contenido del dump (sanity check) ────────────────────────
echo "[INFO] Tablas en el dump:"
pg_restore --list "$DUMP_PATH" 2>/dev/null | grep "TABLE DATA" | head -5
TOTAL_OBJECTS=$(pg_restore --list "$DUMP_PATH" 2>/dev/null | wc -l)
echo "[INFO] Total objetos en dump: $TOTAL_OBJECTS"
if [[ "$TOTAL_OBJECTS" -lt 50 ]]; then
    echo "[WARN] Dump parece sospechosamente chico ($TOTAL_OBJECTS objetos)." >&2
fi

# ── Crear BD scratch ─────────────────────────────────────────────────────
psql -c "DROP DATABASE IF EXISTS $SCRATCH_DB;" 2>/dev/null || true
psql -c "CREATE DATABASE $SCRATCH_DB;"

# ── Restore ──────────────────────────────────────────────────────────────
echo "[INFO] Restaurando (puede tomar varios minutos)..."
START_TIME=$(date +%s)
if ! pg_restore --dbname="$SCRATCH_DB" --no-owner --no-acl --jobs=2 \
        --exit-on-error "$DUMP_PATH" 2>&1 | tail -20; then
    echo "[ERROR] pg_restore falló. Limpiando..." >&2
    psql -c "DROP DATABASE IF EXISTS $SCRATCH_DB;" 2>/dev/null || true
    exit 2
fi
ELAPSED=$(( $(date +%s) - START_TIME ))
echo "[OK] Restore completó en ${ELAPSED}s"

# ── Validar row counts mínimos ───────────────────────────────────────────
echo "[INFO] Validando contenido..."
TENANT_COUNT=$(psql -tAc "SELECT count(*) FROM \"Tenant\";" -d "$SCRATCH_DB")
USER_COUNT=$(psql -tAc "SELECT count(*) FROM \"User\";" -d "$SCRATCH_DB")
INVENTORY_COUNT=$(psql -tAc "SELECT count(*) FROM \"InventoryItem\";" -d "$SCRATCH_DB" 2>/dev/null || echo 0)

echo "  Tenants:        $TENANT_COUNT"
echo "  Users:          $USER_COUNT"
echo "  InventoryItems: $INVENTORY_COUNT"

if [[ "$TENANT_COUNT" -lt 1 || "$USER_COUNT" -lt 1 ]]; then
    echo "[ERROR] Row counts mínimos no cumplidos. BD restaurada parece vacía o corrupta." >&2
    psql -c "DROP DATABASE IF EXISTS $SCRATCH_DB;" 2>/dev/null || true
    exit 3
fi

# ── Cleanup ──────────────────────────────────────────────────────────────
psql -c "DROP DATABASE $SCRATCH_DB;"
echo "[OK] Smoke test exitoso. BD scratch dropeada."
