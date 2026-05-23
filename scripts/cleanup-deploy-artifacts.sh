#!/bin/bash
#
# cleanup-deploy-artifacts.sh
# ---------------------------
# Limpia builds OLD acumulados, builds NEW residuales (de deploys que
# fallaron a mitad) y backups BD viejos. Mantiene los últimos N para
# permitir rollback rápido.
#
# Idempotente. Dry-run por default. Diseñado para correrse:
#   1. Manualmente cuando el operador quiera limpiar
#   2. Al final de cada deploy (deploy-vps.sh lo invoca con --apply)
#   3. Vía cron diario (defensa en profundidad)
#
# Uso:
#   bash scripts/cleanup-deploy-artifacts.sh                 # dry-run
#   bash scripts/cleanup-deploy-artifacts.sh --apply         # ejecuta
#   bash scripts/cleanup-deploy-artifacts.sh --keep-builds=5 # retener 5 (default 3)
#   bash scripts/cleanup-deploy-artifacts.sh --keep-dumps=30 # retener 30 (default 14)

set -euo pipefail

# ─── Args ──────────────────────────────────────────────────────────────────

APPLY=false
KEEP_BUILDS=3
KEEP_DUMPS=14
KEEP_PM2_LOG_MB=200

for arg in "$@"; do
    case "$arg" in
        --apply)             APPLY=true ;;
        --keep-builds=*)     KEEP_BUILDS="${arg#*=}" ;;
        --keep-dumps=*)      KEEP_DUMPS="${arg#*=}" ;;
        --keep-pm2-log-mb=*) KEEP_PM2_LOG_MB="${arg#*=}" ;;
        --help|-h)
            sed -n '2,20p' "$0"
            exit 0
            ;;
        *)
            echo "Arg desconocido: $arg" >&2
            exit 1
            ;;
    esac
done

# ─── Helpers ───────────────────────────────────────────────────────────────

WWW=/var/www
BACKUPS=/root/backups
PM2_LOGS=/root/.pm2/logs

prefix() {
    if [[ "$APPLY" == "true" ]]; then echo "[APPLY] "; else echo "[DRY]   "; fi
}

do_rm() {
    local target="$1"
    if [[ "$APPLY" == "true" ]]; then
        rm -rf "$target"
    fi
}

do_truncate() {
    local target="$1"
    if [[ "$APPLY" == "true" ]]; then
        : > "$target"
    fi
}

human_size() {
    du -sh "$1" 2>/dev/null | awk '{print $1}'
}

# ─── 1. Builds NEW residuales (deploy interrumpido) ────────────────────────

echo "============================================="
echo " 1. Builds NEW residuales"
echo "============================================="
echo "Cualquier capsula-erp-NEW-* es residuo de un deploy que no completó"
echo "el swap atómico. Se borran SIEMPRE — no son fuente de rollback."
echo ""

NEW_FOUND=0
for d in "$WWW"/capsula-erp-NEW-*; do
    [[ -d "$d" ]] || continue
    NEW_FOUND=$((NEW_FOUND + 1))
    SIZE=$(human_size "$d")
    echo "$(prefix)rm -rf $d  ($SIZE)"
    do_rm "$d"
done
if [[ "$NEW_FOUND" -eq 0 ]]; then
    echo "  (ninguno — OK)"
fi
echo ""

# ─── 2. Builds OLD: retener los N más recientes ────────────────────────────

echo "============================================="
echo " 2. Builds OLD — retener $KEEP_BUILDS más recientes"
echo "============================================="

# Listar ordenados por nombre (timestamp en el nombre garantiza orden cronológico).
# Reverse para tener los más nuevos primero.
mapfile -t OLD_BUILDS < <(ls -1d "$WWW"/capsula-erp-OLD-* 2>/dev/null | sort -r)
TOTAL=${#OLD_BUILDS[@]}
echo "Total encontrados: $TOTAL"

if [[ "$TOTAL" -le "$KEEP_BUILDS" ]]; then
    echo "  (≤ $KEEP_BUILDS, nada para borrar)"
else
    echo "Retenidos (los $KEEP_BUILDS más nuevos):"
    for i in $(seq 0 $((KEEP_BUILDS - 1))); do
        b="${OLD_BUILDS[$i]}"
        SIZE=$(human_size "$b")
        echo "  KEEP  $b  ($SIZE)"
    done
    echo "A borrar:"
    for i in $(seq "$KEEP_BUILDS" $((TOTAL - 1))); do
        b="${OLD_BUILDS[$i]}"
        SIZE=$(human_size "$b")
        echo "$(prefix)rm -rf $b  ($SIZE)"
        do_rm "$b"
    done
fi
echo ""

# ─── 3. Backups BD: retener los N más recientes ────────────────────────────

echo "============================================="
echo " 3. Backups BD — retener $KEEP_DUMPS más recientes"
echo "============================================="

if [[ ! -d "$BACKUPS" ]]; then
    echo "  ($BACKUPS no existe — OK)"
else
    mapfile -t DUMPS < <(ls -1 "$BACKUPS"/*.dump 2>/dev/null | sort -r)
    TOTAL_D=${#DUMPS[@]}
    echo "Total encontrados: $TOTAL_D"

    if [[ "$TOTAL_D" -le "$KEEP_DUMPS" ]]; then
        echo "  (≤ $KEEP_DUMPS, nada para borrar)"
    else
        echo "Retenidos (los $KEEP_DUMPS más nuevos):"
        for i in $(seq 0 $((KEEP_DUMPS - 1))); do
            f="${DUMPS[$i]}"
            SIZE=$(human_size "$f")
            echo "  KEEP  $(basename "$f")  ($SIZE)"
        done
        echo "A borrar:"
        for i in $(seq "$KEEP_DUMPS" $((TOTAL_D - 1))); do
            f="${DUMPS[$i]}"
            SIZE=$(human_size "$f")
            echo "$(prefix)rm $f  ($SIZE)"
            do_rm "$f"
        done
    fi
fi
echo ""

# ─── 4. pm2 logs grandes ───────────────────────────────────────────────────

echo "============================================="
echo " 4. pm2 logs — truncar si > ${KEEP_PM2_LOG_MB}MB"
echo "============================================="

if [[ ! -d "$PM2_LOGS" ]]; then
    echo "  ($PM2_LOGS no existe — OK, pm2 corriendo bajo otro user?)"
else
    THRESHOLD_B=$((KEEP_PM2_LOG_MB * 1024 * 1024))
    TRUNCATED=0
    for f in "$PM2_LOGS"/*.log; do
        [[ -f "$f" ]] || continue
        SZ=$(stat -c%s "$f" 2>/dev/null || echo 0)
        if [[ "$SZ" -gt "$THRESHOLD_B" ]]; then
            HUMAN=$(human_size "$f")
            echo "$(prefix)truncate $f  ($HUMAN)"
            do_truncate "$f"
            TRUNCATED=$((TRUNCATED + 1))
        fi
    done
    if [[ "$TRUNCATED" -eq 0 ]]; then
        echo "  (ningún log supera ${KEEP_PM2_LOG_MB}MB — OK)"
    fi
fi
echo ""

# ─── 5. Resumen ────────────────────────────────────────────────────────────

echo "============================================="
echo " Espacio en disco DESPUÉS"
echo "============================================="
df -h | grep -E "Filesystem|/$"
echo ""

if [[ "$APPLY" == "false" ]]; then
    echo "Dry-run. Para aplicar:"
    echo "  bash scripts/cleanup-deploy-artifacts.sh --apply"
fi
