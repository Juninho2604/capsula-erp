#!/usr/bin/env bash
#
# upload-backup-offsite.sh
# ────────────────────────
# Sube el dump más reciente de /var/lib/postgresql/backups/ a S3 (o R2 vía
# S3-compat API). Diseñado para correrse DESDE EL VPS, después del cron de
# pg_dump (7am Caracas).
#
# NO modifica nada existente: solo lee dumps que ya están + sube.
#
# Pre-requisitos en el VPS:
#   1. aws-cli v2 instalado: `apt install awscli` o el binario oficial.
#   2. Credenciales seteadas via env vars o `~/.aws/credentials`:
#        - BACKUP_S3_BUCKET           (ej. capsula-backups)
#        - BACKUP_S3_PREFIX           (ej. full, default: full)
#        - BACKUP_S3_ENDPOINT         (opcional, para R2: https://<acc>.r2.cloudflarestorage.com)
#        - AWS_ACCESS_KEY_ID
#        - AWS_SECRET_ACCESS_KEY
#        - AWS_DEFAULT_REGION         (para AWS S3; ignorar para R2)
#   3. Directorio /var/lib/postgresql/backups/ legible para el user que corre.
#
# Uso:
#   # Dry-run (no sube, solo muestra qué subiría):
#   ./upload-backup-offsite.sh --dry-run
#
#   # Real:
#   ./upload-backup-offsite.sh
#
#   # Especificar dump particular en vez del más reciente:
#   ./upload-backup-offsite.sh --file /var/lib/postgresql/backups/capsula-2026-05-18.dump
#
# Exit codes:
#   0  = upload OK (o dry-run OK)
#   1  = no se encontró dump para subir
#   2  = configuración inválida (faltan env vars)
#   3  = upload falló
#
# IDEMPOTENCIA: si el archivo ya existe en S3 con el mismo tamaño, no re-sube.

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/lib/postgresql/backups}"
DRY_RUN=0
FILE_OVERRIDE=""

# ── parsear flags ────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run)    DRY_RUN=1; shift ;;
        --file)       FILE_OVERRIDE="$2"; shift 2 ;;
        --help|-h)
            sed -n '/^# Uso:/,/^# Exit codes:/p' "$0" | sed 's/^# \?//'
            exit 0
            ;;
        *) echo "[ERROR] Flag desconocido: $1" >&2; exit 2 ;;
    esac
done

# ── validar env ──────────────────────────────────────────────────────────
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET no seteado}"
BACKUP_S3_PREFIX="${BACKUP_S3_PREFIX:-full}"

AWS_EXTRA_FLAGS=()
if [[ -n "${BACKUP_S3_ENDPOINT:-}" ]]; then
    AWS_EXTRA_FLAGS+=(--endpoint-url "$BACKUP_S3_ENDPOINT")
fi

# ── elegir dump a subir ──────────────────────────────────────────────────
if [[ -n "$FILE_OVERRIDE" ]]; then
    DUMP_PATH="$FILE_OVERRIDE"
else
    DUMP_PATH="$(ls -1t "$BACKUP_DIR"/*.dump 2>/dev/null | head -1 || true)"
fi

if [[ -z "$DUMP_PATH" || ! -f "$DUMP_PATH" ]]; then
    echo "[ERROR] No se encontró dump en $BACKUP_DIR" >&2
    exit 1
fi

DUMP_NAME="$(basename "$DUMP_PATH")"
DUMP_SIZE="$(stat -c%s "$DUMP_PATH")"
S3_URI="s3://${BACKUP_S3_BUCKET}/${BACKUP_S3_PREFIX}/${DUMP_NAME}"

echo "[INFO] Dump local:    $DUMP_PATH (${DUMP_SIZE} bytes)"
echo "[INFO] Destino S3:    $S3_URI"
[[ -n "${BACKUP_S3_ENDPOINT:-}" ]] && echo "[INFO] Endpoint:      $BACKUP_S3_ENDPOINT"

# ── chequear si ya existe (idempotencia) ─────────────────────────────────
REMOTE_SIZE=""
if REMOTE_INFO="$(aws "${AWS_EXTRA_FLAGS[@]}" s3api head-object \
        --bucket "$BACKUP_S3_BUCKET" \
        --key "${BACKUP_S3_PREFIX}/${DUMP_NAME}" 2>/dev/null)"; then
    REMOTE_SIZE="$(echo "$REMOTE_INFO" | grep -oP '"ContentLength":\s*\K\d+' || true)"
fi

if [[ -n "$REMOTE_SIZE" && "$REMOTE_SIZE" == "$DUMP_SIZE" ]]; then
    echo "[OK] Ya existe en S3 con mismo tamaño. Skip upload."
    exit 0
fi

if [[ "$DRY_RUN" == "1" ]]; then
    echo "[DRY-RUN] Subiría $DUMP_NAME a $S3_URI"
    exit 0
fi

# ── upload real ──────────────────────────────────────────────────────────
echo "[INFO] Subiendo..."
aws "${AWS_EXTRA_FLAGS[@]}" s3 cp "$DUMP_PATH" "$S3_URI" \
    --storage-class STANDARD_IA \
    --only-show-errors

# ── verificar ────────────────────────────────────────────────────────────
VERIFY="$(aws "${AWS_EXTRA_FLAGS[@]}" s3api head-object \
    --bucket "$BACKUP_S3_BUCKET" \
    --key "${BACKUP_S3_PREFIX}/${DUMP_NAME}" 2>&1 || true)"
VERIFY_SIZE="$(echo "$VERIFY" | grep -oP '"ContentLength":\s*\K\d+' || true)"

if [[ "$VERIFY_SIZE" != "$DUMP_SIZE" ]]; then
    echo "[ERROR] Upload sin verificar: local=$DUMP_SIZE remote=$VERIFY_SIZE" >&2
    exit 3
fi

echo "[OK] Upload verificado: $S3_URI ($DUMP_SIZE bytes)"
