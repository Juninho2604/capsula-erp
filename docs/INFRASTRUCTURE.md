# Infraestructura — Capsula ERP

> **Fuente única de verdad** sobre dónde corre cada pieza en producción.
> Última verificación operativa: **2026-05-18**.
> Para detalle histórico del cutover ver `OPUS_CONTEXT_CAPSULA.md` §18.43.

---

## Regla operativa (no negociable)

**Toda la stack de producción vive en el VPS Contabo.** BD, app server, reverse proxy, backups, crons — todo en el mismo host. No agregar deploys nuevos, jobs, crons, ni backups en otros providers (AWS, Vercel, Render, etc.) sin discutirlo y documentarlo acá primero.

**Excepción planificada — servidor local del restaurante**: existe tooling y runbook (`docs/LOCAL_SERVER.md`, `scripts/local-server/`) para mover la fuente de verdad a un computador dedicado on-premise que sirve el POS por LAN, con kpsula.app ruteada por túnel SSH reverso desde el VPS y backups off-site local→VPS cada 6 h. **Cuando ese cutover se ejecute, actualizar esta página**: la BD viva pasa al local y el stack del VPS queda como contingencia.

`.env.example` apunta a AWS RDS solo como referencia histórica — **no se carga en runtime**. El `.env` real del VPS apunta a localhost (verificable con `grep DATABASE_URL /var/www/capsula-erp/.env`).

---

## Topología

```
                    ┌─────────────────────────────────────┐
                    │       VPS Contabo (147.93.6.70)     │
                    │                                     │
   Internet ──────► │  nginx :443                         │
   (Cloudflare DNS) │   ├── SSL wildcard Let's Encrypt    │
                    │   │   (*.kpsula.app, kpsula.app)    │
                    │   └── proxy_pass localhost:3000     │
                    │                                     │
                    │  pm2: node server.js (Next.js)      │
                    │   └── lee/escribe :5433             │
                    │                                     │
                    │  postgres :5433                     │
                    │   ├── DB: capsula_erp_prod          │
                    │   ├── owner: capsula                │
                    │   ├── SSL self-signed sslmode=require│
                    │   └── PG 18.3                       │
                    │                                     │
                    │  /var/lib/postgresql/backups/       │
                    │   └── cron 7am, retención 30 días   │
                    └─────────────────────────────────────┘
```

---

## Piezas

| Pieza | Ubicación | Detalle | Estado |
|---|---|---|---|
| **BD productiva** | VPS `localhost:5433` | `capsula_erp_prod`, role `capsula`, PG 18.3 | ✅ Operativa |
| **App Next.js** | VPS, pm2 | `/var/www/capsula-erp/.next/standalone/server.js` en `localhost:3000` | ✅ Operativa |
| **Reverse proxy** | VPS, nginx | Termina SSL wildcard, proxy_pass a Next | ✅ Operativo |
| **DNS** | Cloudflare | `kpsula.app` + `*.kpsula.app` → VPS | ✅ Operativo |
| **SSL** | Let's Encrypt wildcard | Renovación cron certbot cada 60d | ✅ Operativo |
| **CI/CD** | GitHub Actions | `.github/workflows/ci.yml` job `deploy` → SSH al VPS | ✅ Operativo |
| **Cron BD backups** | VPS, crontab root | `/usr/local/bin/capsula-backup.sh` 7am diario, 30d retención | ✅ Operativo |
| **Cron app (outbox)** | VPS, crontab root | `/api/cron/retry-inventory-deductions` cada 5min | ⚠️ Verificar |
| **Print agent** | PC del local | Daemon Node.js consume `/api/print-agent/jobs` | ✅ Operativo |
| **AWS RDS** | AWS us-east-2 | Instancia `shanklisherp.*` desconectada del runtime | 🟡 Pendiente terminate |
| **Vercel** | vercel.com | Proyecto sigue existiendo sin tráfico desde cutover 2026-05-08 | 🟡 Pendiente apagar |
| **Backups off-site** | — | No existe todavía. Dumps solo en el VPS. | 🔴 Hueco |

---

## Variables de entorno críticas (en `/var/www/capsula-erp/.env` del VPS)

| Variable | Valor (redactado) | Usado por |
|---|---|---|
| `DATABASE_URL` | `postgresql://capsula:***@localhost:5433/capsula_erp_prod?sslmode=require` | Prisma |
| `JWT_SECRET` | (43 chars) | `src/lib/auth.ts` |
| `NEXTAUTH_URL` | `https://kpsula.app` | NextAuth (legacy, no usado en runtime) |
| `NEXTAUTH_SECRET` | (set) | NextAuth (legacy) |
| `PRINT_AGENT_API_KEY` | (set) | Single-tenant legacy. Migrar a `PRINT_AGENT_TENANT_KEYS` cuando haya ≥2 tenants. |
| `MULTI_TENANT_STRICT` | NO seteada (default `false`) | `src/lib/tenant-context.server.ts`. Activar cuando haya ≥2 tenants onboardeados. |

---

## Backups — estado real

### Lo que existe hoy

- **Cron en VPS**: 7am diario, dump completo de `capsula_erp_prod`, deja en `/var/lib/postgresql/backups/`.
- **Retención**: 30 días.
- **Verificable**: `crontab -l` en VPS muestra la entrada. `ls -lh /var/lib/postgresql/backups/ | tail -5` muestra los dumps recientes.

### El hueco crítico

**Los dumps viven en el MISMO disco que la BD.** Si el VPS pierde el disco (físico, ransomware, error humano que borre `/var/lib/postgresql`), perdemos BD y backup en un solo evento.

### Plan para cerrar (sin tocar producción hoy)

Ver `OPUS_CONTEXT_CAPSULA.md` §40.1 — off-site copy a S3 / Cloudflare R2, retention 90 días hot + 365 días archive.

---

## Comandos de diagnóstico rápido

Desde el VPS como root:

```bash
# ¿Qué DB usa la app?
grep -E "^DATABASE" /var/www/capsula-erp/.env

# ¿El cron de backup está activo?
crontab -l | grep capsula-backup

# ¿Hay dumps recientes?
ls -lh /var/lib/postgresql/backups/ | tail -5

# ¿La app está corriendo?
pm2 status

# ¿nginx OK?
nginx -t && systemctl status nginx

# ¿Postgres OK?
systemctl status postgresql@18-capsula
sudo -u postgres psql -c "SELECT version();"

# Conexiones activas a la BD
sudo -u postgres psql -d capsula_erp_prod -c "SELECT count(*) FROM pg_stat_activity WHERE datname='capsula_erp_prod';"
```

---

## Pendientes operativos

Ver `OPUS_CONTEXT_CAPSULA.md` §40 para el inventario completo. Resumen:

| # | Tarea | Prioridad |
|---|---|---|
| 40.1 | Off-site backup copy a S3 / R2 | 🔴 Alta |
| 40.2 | Per-tenant backup script | 🟠 Media |
| 40.3 | Apagar Vercel | 🟡 Baja (revisar mañana) |
| 40.4 | AWS RDS dump final + terminate | 🟡 Baja |
| 40.5 | Doc + smoke test de restore | 🟠 Media |

**Regla**: nada de esto se ejecuta sin off-site backups activos (§40.1) y confirmación del operador.
