#!/usr/bin/env bash
# ============================================================================
# Build script para Vercel — protege la BD productiva.
#
# Lógica:
#   - prisma generate: SIEMPRE (necesario para que el client compile).
#   - prisma migrate deploy: SOLO cuando VERCEL_ENV=production.
#   - next build: SIEMPRE.
#
# Por qué: Vercel construye un Preview Deployment por cada PR. Sin esta
# protección, abrir un PR aplica migraciones a la BD productiva inmediatamente
# (porque Vercel-DATABASE_URL apunta a producción). Eso elimina la posibilidad
# de revisar el SQL antes de impactar producción.
#
# Con este script, las migrations se aplican únicamente cuando hacemos merge a
# main (= deploy production), nunca desde un preview o un PR.
# ============================================================================

set -e

echo "[vercel-build] VERCEL_ENV=${VERCEL_ENV:-unset}"

echo "[vercel-build] Step 1/3 — prisma generate"
npx prisma generate

if [ "$VERCEL_ENV" = "production" ]; then
    echo "[vercel-build] Step 2/3 — prisma migrate deploy (production env)"
    npx prisma migrate deploy
else
    echo "[vercel-build] Step 2/3 — SKIPPING prisma migrate deploy (env != production)"
    echo "[vercel-build]   Razón: este es un preview/dev deployment. Las migrations"
    echo "[vercel-build]   se aplican únicamente al hacer merge a main."
fi

echo "[vercel-build] Step 3/3 — next build"
npx next build

echo "[vercel-build] OK"
