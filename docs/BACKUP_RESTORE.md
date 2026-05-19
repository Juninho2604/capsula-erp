# Backup & Restore — Capsula ERP

> **Última actualización**: 2026-05-18 (sesión hardening multitenant).
> Para infraestructura general ver `INFRASTRUCTURE.md`.

---

## TL;DR — qué hay y qué falta

| Capa | Estado |
|---|---|
| Cron diario `pg_dump` en VPS | ✅ Activo (`/usr/local/bin/capsula-backup.sh`, 7am, 30d retención) |
| Off-site copy a S3/R2 | 🟡 Código listo (PR pendiente activar — ver §3) |
| Per-tenant dump | 🔴 Pendiente código |
| Test de restore documentado | ✅ Este doc |
| Test de restore automatizado mensual | 🟡 Script listo (`scripts/restore-smoketest.sh`), workflow pendiente |
| AWS RDS snapshot histórico | 🔴 Pendiente |

---

## 1. Backups locales en el VPS

### Cómo funciona

Cron de root corre `/usr/local/bin/capsula-backup.sh` cada día a las 7am hora Caracas. El script hace:

```bash
pg_dump --format=custom --no-owner --no-acl \
    "postgresql://capsula:***@localhost:5433/capsula_erp_prod?sslmode=require" \
    > /var/lib/postgresql/backups/capsula-$(date +%F).dump
# Elimina dumps con más de 30 días
find /var/lib/postgresql/backups/ -name "*.dump" -mtime +30 -delete
```

### Verificar que está corriendo

Desde el VPS como root:

```bash
# El cron está activo?
crontab -l | grep capsula-backup

# Hay dumps recientes?
ls -lh /var/lib/postgresql/backups/ | tail -5

# El último dump no está corrupto?
sudo -u postgres pg_restore --list \
    /var/lib/postgresql/backups/$(ls -1t /var/lib/postgresql/backups | head -1) \
    | head -5
```

Esperar ver:
- Cron con horario `0 7 * * *` (o similar) corriendo el script.
- Al menos 1 archivo `.dump` con fecha de hoy o ayer.
- `pg_restore --list` muestra tablas sin errores.

### Hueco crítico

**Los dumps viven en el mismo disco que la BD productiva.** Si el VPS se compromete (disco, ransomware, error humano que borre `/var/lib/postgresql`), perdemos BD y backup en el mismo evento. La capa §3 (off-site) cierra esto.

---

## 2. Restore — procedimiento manual

### Escenario A: restaurar TODO desde un dump local (BD corrupta / borrada)

⚠️ **Esto sobrescribe `capsula_erp_prod`. Solo correr en emergencia con confirmación del operador.**

```bash
# Como root en el VPS:

# 1. Pausar la app para que no escriba durante el restore.
pm2 stop capsula-erp

# 2. Asegurar conexiones cerradas a la BD productiva.
sudo -u postgres psql -c "
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = 'capsula_erp_prod' AND pid <> pg_backend_pid();
"

# 3. Dropear y recrear (NO usar --clean en pg_restore, falla con FKs).
sudo -u postgres psql -c "DROP DATABASE capsula_erp_prod;"
sudo -u postgres psql -c "CREATE DATABASE capsula_erp_prod OWNER capsula;"

# 4. Restaurar el dump elegido.
DUMP=/var/lib/postgresql/backups/capsula-2026-05-18.dump   # ← ajustar fecha
sudo -u postgres pg_restore \
    --dbname=capsula_erp_prod \
    --no-owner --no-acl \
    --jobs=4 \
    --exit-on-error \
    "$DUMP"

# 5. Re-asignar ownership al user `capsula`.
sudo -u postgres psql -d capsula_erp_prod -c "
    DO \$\$ DECLARE r record; BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname='public') LOOP
            EXECUTE format('ALTER TABLE public.%I OWNER TO capsula', r.tablename);
        END LOOP;
    END \$\$;
"

# 6. Reanudar la app.
pm2 start capsula-erp
pm2 logs capsula-erp --lines 50
```

**Tiempo estimado**: 5-15 min para una BD de tamaño medio. Confirmar que la app responde y los user pueden loggear antes de declarar OK.

### Escenario B: validar un dump sin tocar prod (smoke test)

```bash
sudo -u postgres /var/www/capsula-erp/scripts/restore-smoketest.sh
```

El script:
1. Crea `capsula_erp_smoketest` (BD scratch).
2. Restaura ahí el dump más reciente (o el que pases por arg).
3. Valida row counts mínimos (`Tenant ≥ 1`, `User ≥ 1`).
4. Dropea la BD scratch.

Salida esperada: `[OK] Smoke test exitoso.`

### Escenario C: restaurar SOLO un tenant (cuando exista per-tenant backup)

Pendiente — script `scripts/backup-tenant.ts` no implementado todavía. Ver `OPUS_CONTEXT_CAPSULA.md` §40.2.

---

## 3. Off-site backup — activación

Ver `OPUS_CONTEXT_CAPSULA.md` §40.1 para el plan completo. El código vive en este PR pero **no está activado** todavía.

### Checklist para activar (en orden)

1. **Operador**: crear bucket S3 o Cloudflare R2 dedicado.
   - Nombre sugerido: `capsula-backups`
   - Región: la más cercana al VPS (us-east-2 / eu-central).
   - Versionado: habilitar para tener historial.
   - Lifecycle: 90d retención hot, archivo a IA/Glacier después de 90d.

2. **Operador**: agregar GitHub Secrets:
   - `BACKUP_S3_BUCKET=capsula-backups`
   - `BACKUP_S3_ACCESS_KEY_ID=...`
   - `BACKUP_S3_SECRET_ACCESS_KEY=...`
   - `BACKUP_S3_REGION=us-east-2` (si AWS)
   - `BACKUP_S3_ENDPOINT=https://<acc>.r2.cloudflarestorage.com` (si R2)

3. **Operador o agente**: correr el workflow en dry-run:
   - GitHub → Actions → "Backup — Off-site upload" → Run workflow → `dry_run=true`
   - Esperar OK. Verifica que las credentials funcionan y que el dump del VPS se encuentra.

4. **Operador o agente**: correr en real:
   - Mismo workflow con `dry_run=false`
   - Confirmar que el archivo aparece en el bucket con el tamaño correcto.

5. **Agente**: activar el cron automático editando `.github/workflows/backup-offsite.yml` y descomentando el bloque `schedule:`. Hacer PR aparte.

6. **Agente**: agendar smoke test mensual (workflow separado pendiente).

---

## 4. AWS RDS — dump histórico (pendiente)

Ver `OPUS_CONTEXT_CAPSULA.md` §40.4. La instancia AWS RDS sigue activa sin uso desde el cutover (2026-05-08). Antes de terminate:

1. `pg_dump` final de RDS comprimido, subir a `s3://capsula-archive/aws-rds-final/`.
2. STOP la instancia 7 días para confirmar que nada externo la usa.
3. Si OK: terminate + bajar snapshots a S3 + delete.

---

## 5. Reglas no negociables

1. **Antes de cualquier cambio que toque la BD productiva**: confirmar dump del día existe y no está corrupto (`pg_restore --list`).
2. **Antes de ejecutar `restore` en producción**: confirmar con el operador. Restore = sobrescribir = pérdida de cualquier dato escrito después del dump.
3. **Smoke test mensual**: el primer día de cada mes correr `restore-smoketest.sh`. Si falla, escalar inmediatamente.
4. **El operador debe saber este procedimiento**: este doc se actualiza si cambia el flow. Si vos sos el operador, leelo entero al menos una vez.
