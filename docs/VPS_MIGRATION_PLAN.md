# Plan de Migración Vercel → VPS Contabo

> **Estado**: borrador para ejecutar en día tranquilo. NO ejecutar en día crítico.
> **Objetivo**: servir la app desde el VPS de Contabo (mismo servidor que la BD), apagar Vercel, dominio público en `kpsula.app`.
> **Restricción dura**: cero downtime perceptible. Si algo falla, rollback en <5 min.

## Tabla de contenidos

1. [Estado actual](#1-estado-actual)
2. [Estado objetivo](#2-estado-objetivo)
3. [Decisiones a confirmar](#3-decisiones-a-confirmar)
4. [Variables y secretos](#4-variables-y-secretos)
5. [Fase 0 — Pre-requisitos en el VPS](#5-fase-0--pre-requisitos-en-el-vps)
6. [Fase 1 — DNS en Cloudflare (sin tocar nada en producción)](#6-fase-1--dns-en-cloudflare)
7. [Fase 2 — nginx + SSL wildcard (sin tocar nada en producción)](#7-fase-2--nginx--ssl-wildcard)
8. [Fase 3 — CI/CD GitHub → VPS](#8-fase-3--cicd-github--vps)
9. [Fase 4 — Validación end-to-end (con Vercel todavía activo)](#9-fase-4--validación-end-to-end)
10. [Fase 5 — Cambio DNS (punto de no retorno controlado)](#10-fase-5--cambio-dns)
11. [Fase 6 — Apagar Vercel (días después de validar)](#11-fase-6--apagar-vercel)
12. [Plan de rollback](#12-plan-de-rollback)
13. [Checklist final](#13-checklist-final)

---

## 1. Estado actual

| Pieza | Dónde | Detalles |
|---|---|---|
| App Next.js (productiva) | **Vercel** | URL: `shanklish-erp-main.vercel.app`. Auto-deploy en push a `main`. |
| BD Postgres (productiva) | **VPS Contabo** | `localhost:5433/capsula_erp_prod` desde el VPS. IP pública usada por Vercel. |
| App Next.js (staging idle) | **VPS Contabo** | pm2 corriendo `node /var/www/capsula-erp/.next/standalone/server.js`. Apunta a una BD distinta (`capsula_db` puerto 5432) — **vacía**. |
| Backups BD | **VPS Contabo** | Cron diario 7am: `/usr/local/bin/capsula-backup.sh` → `/var/lib/postgresql/backups/`. Retiene 30 días. |
| Dominio | **GoDaddy** | `kpsula.app`, nameservers default de GoDaddy, todavía no apunta a nada. |
| CI/CD | **GitHub Actions** | `.github/workflows/ci.yml` tiene job `validate` (tsc + tests) en push y un job `deploy` SSH a Contabo, condicionado a `workflow_dispatch` (no se dispara en push, solo manual). Falta configurar secrets `CONTABO_HOST`, `CONTABO_USER`, `CONTABO_SSH_KEY`, `DATABASE_URL_PROD`. |

## 2. Estado objetivo

| Pieza | Dónde | Detalles |
|---|---|---|
| App Next.js (productiva) | **VPS Contabo** | pm2 corriendo `node server.js` apuntando a la BD productiva (`capsula_erp_prod` puerto 5433, localhost). |
| BD Postgres | VPS Contabo | Sin cambios. |
| Frontend público | **nginx** en VPS | Termina SSL wildcard en `*.kpsula.app`, hace `proxy_pass` a Next.js en `localhost:3000`. |
| DNS | **Cloudflare** (free) | `kpsula.app` y `*.kpsula.app` → IP del VPS. Nameservers de Cloudflare configurados en GoDaddy. |
| SSL | **Let's Encrypt** wildcard | Certbot con DNS-01 challenge vía API de Cloudflare. Renovación automática cada 60 días. |
| CI/CD | **GitHub Action** | En push a `main`: tsc + tests + deploy SSH al VPS. |
| Vercel | **Apagado** | Después de 1-2 semanas de validación con VPS. |

## 3. Decisiones a confirmar antes de empezar

1. **DNS**: ¿Cloudflare DNS (gratis, recomendado para wildcard SSL) o quedarnos en GoDaddy?
   - **Recomendación: Cloudflare**. La transferencia de DNS es gratis y no transfiere ownership del dominio (sigue tuyo en GoDaddy). Simplifica wildcard SSL automático.

2. **Reverse proxy**: ¿nginx (estándar, ya seguro instalado) o caddy (auto-SSL pero menos común)?
   - **Recomendación: nginx**. Más documentado, más usuarios, control granular.

3. **Manejo de assets estáticos**: Next.js en standalone copia imágenes/JS a `.next/static`. Pueden servirse por nginx directamente (más rápido) o por Next.js (más simple).
   - **Recomendación: nginx con `try_files`**. Next.js no necesita ver requests a `_next/static/*`.

4. **Sesión de mantenimiento durante el switch DNS**: Vercel y VPS sirven simultáneamente durante propagación DNS. Algunos users verán Vercel, otros VPS. Si la BD es la misma (sí lo es: `capsula_erp_prod` en Contabo), no hay split-brain. Solo cosas en memoria (sessions de pm2 vs Vercel) podrían quedar pegadas a una IP. **Aceptable**, los users se relogean si hace falta.

5. **Vercel-build script**: el actual ejecuta `prisma migrate deploy` solo si `VERCEL_ENV=production`. En el VPS, el GitHub Action hará lo equivalente con `npm run build` + `prisma migrate deploy` directo. **No hay riesgo** porque las migrations son idempotentes (Prisma las trackea en `_prisma_migrations`).

6. **Cron jobs**: Vercel cron está deshabilitado en plan Hobby (commit reciente). El cron `/api/cron/retry-inventory-deductions` debe re-implementarse como crontab en el VPS si lo usábamos. **A confirmar si se está usando**.

## 4. Variables y secretos

### En el `.env` del VPS (`/var/www/capsula-erp/.env`)

Ya configurados (verificados en sesiones anteriores):
- `DATABASE_URL` — apunta a `capsula_db` (la staging vacía). **Hay que cambiarla a `capsula_erp_prod`** antes del switch.
- `JWT_SECRET` — 43 chars, robusto.
- `NEXTAUTH_URL` — actualizar a `https://kpsula.app`.
- `NEXTAUTH_SECRET` — verificar.

### En Vercel Environment Variables (a inventariar)

Vercel tiene env vars que el VPS quizá no. Antes del switch hay que **inventariarlas**:

```
Vercel Dashboard → tu proyecto → Settings → Environment Variables → exportar
```

Variables comunes a verificar/copiar al `.env` del VPS:
- `DATABASE_URL` — apunta al VPS por IP pública. En el VPS, será localhost.
- `JWT_SECRET` — debe ser el mismo que el del VPS para no invalidar sesiones vivas durante el switch.
- `NEXT_PUBLIC_*` — todas las que existan.
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`.
- Cualquier otra variable de servicios externos (OCR, etc.).

### En GitHub Secrets (a configurar)

Para activar el deploy automático:
- `CONTABO_HOST` — IP pública del VPS (`147.93.6.70` u otra).
- `CONTABO_USER` — `root` (o un user `deploy` si se crea uno dedicado, recomendado).
- `CONTABO_SSH_KEY` — clave privada SSH del usuario que hace deploy.
- `DATABASE_URL_PROD` — `postgresql://user:pass@localhost:5433/capsula_erp_prod`.

---

## 5. Fase 0 — Pre-requisitos en el VPS

**Riesgo: cero.** Solo verifica e instala herramientas. El sitio actual sigue corriendo en Vercel sin tocar.

### 5.1 Verificar versiones

```bash
# Conectado al VPS:
node --version       # esperar v22.x
npm --version        # esperar v10.x o más
pm2 --version        # esperar 5.x
nginx -v             # esperar 1.18+ (si no instalado, instalar abajo)
certbot --version    # esperar 1.20+ (si no instalado, instalar abajo)
psql --version       # esperar 16+
git --version        # 2.x
```

### 5.2 Si nginx no está instalado

```bash
apt update
apt install -y nginx
systemctl enable nginx
systemctl start nginx
nginx -t   # verificar config OK
```

### 5.3 Si certbot no está instalado

```bash
apt install -y certbot python3-certbot-nginx python3-certbot-dns-cloudflare
```

(El paquete `python3-certbot-dns-cloudflare` es para wildcard SSL vía Cloudflare DNS API.)

### 5.4 Crear usuario `deploy` (opcional, recomendado)

En vez de SSH como `root`, crear un usuario dedicado con permisos limitados:

```bash
adduser deploy
usermod -aG sudo deploy
# Configurar sudo sin password para los comandos del deploy:
echo "deploy ALL=(ALL) NOPASSWD: /usr/bin/systemctl reload nginx, /usr/bin/pm2" | tee /etc/sudoers.d/deploy
chown -R deploy:deploy /var/www/capsula-erp
```

### 5.5 Verificar que pm2 tiene el proceso configurado para sobrevivir reboots

```bash
pm2 list                # debe mostrar capsula-erp
pm2 startup            # genera el comando para systemd
pm2 save               # guarda el dump
```

---

## 6. Fase 1 — DNS en Cloudflare

**Riesgo: cero.** Cloudflare se setea sin afectar el dominio mientras los nameservers de GoDaddy no cambien.

### 6.1 Crear cuenta Cloudflare (si no tienes)

https://dash.cloudflare.com/sign-up — gratis.

### 6.2 Añadir el sitio

1. Cloudflare Dashboard → **Add a site** → escribir `kpsula.app` → **Add**.
2. Cloudflare ofrece planes — elegir **Free**.
3. Cloudflare escanea registros DNS existentes (no encontrará nada porque GoDaddy no tiene records aún, y aunque tuviera no los están sirviendo todavía).
4. Cloudflare muestra **2 nameservers asignados** a tu dominio. Ejemplo:
   ```
   alex.ns.cloudflare.com
   robin.ns.cloudflare.com
   ```
   Anotarlos. Cada cuenta Cloudflare tiene nameservers distintos.

### 6.3 Crear registros DNS (en Cloudflare, NO en GoDaddy todavía)

En Cloudflare → tu sitio → **DNS** → **Records** → **Add record**:

```
Type:    A
Name:    @                              (representa kpsula.app root)
IPv4:    <IP-pública-del-VPS>
Proxy:   DNS only (nube gris, NO naranja por ahora)
TTL:     Auto
```

```
Type:    A
Name:    *
IPv4:    <IP-pública-del-VPS>
Proxy:   DNS only
TTL:     Auto
```

> **Importante**: dejar el proxy como **DNS only (gris)**. El proxy naranja de Cloudflare añade caching y otros features que pueden complicar Next.js + Server Actions. Activar después si se quiere, no ahora.

### 6.4 Crear API token para el certbot DNS-01

Cloudflare → tu perfil (esquina superior) → **My Profile** → **API Tokens** → **Create Token**.

Plantilla: **Edit zone DNS**. Permisos:
- Zone — DNS — Edit.
- Zone Resources — Include — Specific zone — `kpsula.app`.

**Copiar el token** generado. Lo guardamos en el VPS para certbot:

```bash
# En el VPS:
mkdir -p /etc/letsencrypt
cat > /etc/letsencrypt/cloudflare.ini <<'EOF'
dns_cloudflare_api_token = <PEGAR_TOKEN_AQUÍ>
EOF
chmod 600 /etc/letsencrypt/cloudflare.ini
```

> **No hacer push de este archivo al repo, contiene secret.**

### 6.5 NO cambiar nameservers en GoDaddy todavía

Hasta que la Fase 2 (nginx + SSL) y la Fase 3 (deploy) estén validadas, los nameservers de GoDaddy siguen apuntando a default. **El dominio `kpsula.app` no resuelve a nada todavía** — lo cual es perfecto, no rompe nada.

---

## 7. Fase 2 — nginx + SSL wildcard

**Riesgo: cero.** Configuramos nginx en el VPS, pero como el dominio aún no apunta al VPS (Fase 5), nadie llega ahí externamente. Probamos localmente.

### 7.1 Crear el archivo de site nginx

```bash
cat > /etc/nginx/sites-available/kpsula.app <<'EOF'
# Redirección HTTP → HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name kpsula.app *.kpsula.app;
    return 301 https://$host$request_uri;
}

# Servidor HTTPS principal
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name kpsula.app *.kpsula.app;

    # SSL — paths se llenan tras certbot (paso 7.3)
    ssl_certificate     /etc/letsencrypt/live/kpsula.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/kpsula.app/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Buffering y tamaños
    client_max_body_size 25m;

    # Compresión
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_min_length 1000;

    # Assets estáticos de Next.js — se sirven directo desde nginx (más rápido)
    location /_next/static/ {
        alias /var/www/capsula-erp/.next/standalone/.next/static/;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }

    # Public folder
    location /public/ {
        alias /var/www/capsula-erp/.next/standalone/public/;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }

    # Resto: proxy a Next.js standalone en localhost:3000
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
    }
}
EOF

ln -sf /etc/nginx/sites-available/kpsula.app /etc/nginx/sites-enabled/kpsula.app
```

> **No hacer `nginx -t` ni reload todavía** — los certificados SSL no existen aún. Causaría error.

### 7.2 Generar certificado SSL wildcard

```bash
certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
  -d kpsula.app \
  -d "*.kpsula.app" \
  --email <tu-email-real> \
  --agree-tos \
  --non-interactive
```

Esto:
1. Le dice a Cloudflare por API: "creá un registro TXT temporal en `_acme-challenge.kpsula.app`".
2. Let's Encrypt verifica ese registro.
3. Si verifica, emite el certificado wildcard.
4. Renovación automática cada 60 días vía cron de certbot.

Output esperado:
```
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/kpsula.app/fullchain.pem
Key is saved at:         /etc/letsencrypt/live/kpsula.app/privkey.pem
```

### 7.3 Validar nginx y reload

```bash
nginx -t           # debe decir "test is successful"
systemctl reload nginx
```

Si `nginx -t` falla, leer el error, ajustar `/etc/nginx/sites-available/kpsula.app` y reintentar. **No hacer reload sin que el test pase.**

### 7.4 Probar localmente que nginx sirve

Como el dominio aún no apunta al VPS, simulamos con `curl --resolve`:

```bash
# Esto simula que kpsula.app resuelve al VPS:
curl -k --resolve kpsula.app:443:127.0.0.1 https://kpsula.app -I
# Debería responder con headers de Next.js (200 OK o redirect a /login).

curl -k --resolve shanklish.kpsula.app:443:127.0.0.1 https://shanklish.kpsula.app -I
# Mismo resultado.
```

Si responde, **nginx está OK**. Si falla:
- Verificar que pm2 tiene `capsula-erp` corriendo (`pm2 list`).
- Verificar que escucha en `127.0.0.1:3000` (`ss -tlnp | grep 3000`).
- Verificar logs nginx: `tail /var/log/nginx/error.log`.

---

## 8. Fase 3 — CI/CD GitHub → VPS

**Riesgo: cero.** El job `deploy` ya existe en `ci.yml` esperando `workflow_dispatch`. Solo le faltan secrets para correrse manualmente. **No activamos auto-deploy en push hasta haber validado todo**.

### 8.1 Generar SSH keypair para el deploy

En el VPS, como user `deploy` (o root si no creaste deploy):

```bash
ssh-keygen -t ed25519 -f ~/.ssh/github-deploy -N ""
# Genera dos archivos:
# ~/.ssh/github-deploy       (privada, va a GitHub Secrets)
# ~/.ssh/github-deploy.pub   (pública, va a authorized_keys)

# Añadir la pública a authorized_keys:
cat ~/.ssh/github-deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Mostrar la privada para copiarla a GitHub Secrets:
cat ~/.ssh/github-deploy
# Copia TODO el output (incluye -----BEGIN... y -----END...)
```

### 8.2 Configurar secrets en GitHub

GitHub → tu repo `capsula-erp` → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.

Añadir 4:

```
CONTABO_HOST          = <IP-pública-VPS>
CONTABO_USER          = deploy   (o root)
CONTABO_SSH_KEY       = <pegar-contenido-de-github-deploy-privada>
DATABASE_URL_PROD     = postgresql://<user>:<pass>@localhost:5433/capsula_erp_prod
```

> El `DATABASE_URL_PROD` debe ser el de la BD productiva (puerto 5433, db `capsula_erp_prod`), no la staging.

### 8.3 Probar deploy manual desde GitHub

1. GitHub → tu repo → pestaña **Actions** → click en el workflow **"CI"**.
2. Botón **Run workflow** → branch `main` → **Run**.
3. El job `validate` corre primero (tsc + tests). Toma ~3 min.
4. El job `deploy` corre después solo si validate pasa.
5. Verificar logs: SSH al VPS → git pull → npm ci → prisma migrate deploy → npm run build → pm2 reload.

> **Importante**: este deploy actualiza `/var/www/capsula-erp/` en el VPS al último commit de `main`, lo cual es lo deseado. Pero si el `.env` del VPS apunta a la BD staging vacía (`capsula_db` puerto 5432), el sitio del VPS funcionará pero **estará desconectado de la BD productiva**. Eso se arregla en la Fase 4.

### 8.4 Apuntar el `.env` del VPS a la BD productiva

**SOLO cuando estés listo para la Fase 4**, no antes.

```bash
# Backup del .env actual
cp /var/www/capsula-erp/.env /var/www/capsula-erp/.env.bak.$(date +%Y%m%d-%H%M)

# Editar:
nano /var/www/capsula-erp/.env

# Cambiar:
# DATABASE_URL="postgresql://...@localhost:5432/capsula_db"
# por:
# DATABASE_URL="postgresql://<user>:<pass>@localhost:5433/capsula_erp_prod"

# JWT_SECRET debe ser EL MISMO que el de Vercel (verificar).
# NEXTAUTH_URL debe quedar como "https://kpsula.app".

# Reiniciar pm2 para que tome el nuevo .env:
cd /var/www/capsula-erp
pm2 restart capsula-erp --update-env
```

> Tras este cambio, el VPS sirve la app usando la BD productiva. Pero el dominio `kpsula.app` aún no está apuntado al VPS (los nameservers siguen en GoDaddy default). El sitio público sigue 100% en Vercel.

### 8.5 Activar auto-deploy en push (opcional, después de validar)

Editar `.github/workflows/ci.yml` línea ~78:
```yaml
if: github.event_name == 'workflow_dispatch'
```
Cambiar a:
```yaml
if: github.event_name == 'workflow_dispatch' || (github.event_name == 'push' && github.ref == 'refs/heads/main')
```

Después de eso, cada merge a main dispara el deploy en VPS. **Solo activarlo cuando todo lo demás esté validado.**

---

## 9. Fase 4 — Validación end-to-end

**Riesgo: cero.** Vercel sigue activo y sirviendo el dominio público. Validamos el VPS en paralelo via su IP/curl simulado.

### 9.1 Pre-validación: BD apunta a la productiva

- `.env` del VPS apunta a `capsula_erp_prod` puerto 5433.
- pm2 reiniciado con `--update-env`.
- `pm2 logs capsula-erp` no muestra errores.

### 9.2 Validar via `--resolve` que el VPS responde correctamente

Desde tu máquina local:

```bash
# Reemplaza <IP-VPS> con la IP real del VPS
IP=<IP-VPS>

# Health check
curl -k --resolve kpsula.app:443:$IP https://kpsula.app/api/health
# Esperar: {"status":"ok"} o similar.

# Login page carga
curl -k --resolve kpsula.app:443:$IP https://kpsula.app/login -I
# Esperar: HTTP/2 200

# Subdomain también
curl -k --resolve shanklish.kpsula.app:443:$IP https://shanklish.kpsula.app/login -I
# Esperar: HTTP/2 200
```

### 9.3 Validar visualmente en el navegador

Truco: añadir entrada temporal a `/etc/hosts` (Mac/Linux) o `C:\Windows\System32\drivers\etc\hosts` (Windows) en tu máquina:

```
<IP-VPS> kpsula.app shanklish.kpsula.app
```

Después en tu navegador:
- `https://kpsula.app` → página login (acepta certificado SSL).
- Login con tu OWNER → dashboard carga.
- POS de prueba.
- Verifica que ves los **mismos datos** que en `shanklish-erp-main.vercel.app` (sí los verás, ambos apuntan a la misma BD).

Tras validar, **quitar la entrada de `/etc/hosts`**.

### 9.4 Lista de validación

- [ ] `kpsula.app` carga.
- [ ] `shanklish.kpsula.app` carga.
- [ ] SSL válido en ambos (no warning de certificado).
- [ ] Login con OWNER → entra al dashboard.
- [ ] Dashboard carga sin errores.
- [ ] POS abre.
- [ ] Login con CASHIER → POS Restaurante (sin loop).
- [ ] Login con WAITER → POS Mesero.
- [ ] Crear una orden de prueba → se guarda y se ve en Vercel también (misma BD).
- [ ] Logs del VPS limpios (`pm2 logs capsula-erp`).
- [ ] Logs nginx limpios (`tail /var/log/nginx/error.log`).

Si algo falla, **NO avanzar a Fase 5**. Diagnosticar primero.

---

## 10. Fase 5 — Cambio DNS

**Riesgo: medio.** Es el punto donde el dominio público pasa a apuntar al VPS. Vercel sigue activo y accesible por su URL `*.vercel.app` como red de seguridad.

### 10.1 Antes de cambiar DNS, doble check

- [ ] Fase 4 100% validada.
- [ ] Backup BD reciente (cron 7am del día o manual).
- [ ] Vercel sigue funcionando (sirve `shanklish-erp-main.vercel.app`).
- [ ] Tienes acceso SSH al VPS y al dashboard de GoDaddy listos en pestañas.

### 10.2 Cambiar nameservers en GoDaddy

1. Login GoDaddy → My Products → `kpsula.app` → **DNS**.
2. Sección **Nameservers** → **Change** → **I'll use my own nameservers**.
3. Borrar los actuales de GoDaddy.
4. Pegar los **2 de Cloudflare** (los que copiaste en Fase 1.2).
5. **Save**.

### 10.3 Esperar propagación

GoDaddy procesa el cambio inmediato pero la propagación global toma 5-60 min. Mientras tanto:
- Algunos users que resuelvan via DNS nuevo verán el sitio en VPS.
- Otros que tengan caché del DNS viejo verán **nada** (porque GoDaddy default no servía nada — el dominio era nuevo).
- **NO hay split-brain** porque ambos sirven la misma BD.

Verificar propagación:

```bash
dig kpsula.app +short
# Después de propagar: muestra la IP del VPS.

dig shanklish.kpsula.app +short
# Misma IP.
```

O en el navegador en una ventana privada (sin caché): https://kpsula.app debe cargar.

### 10.4 Activar SSL strict en Cloudflare (opcional)

En Cloudflare → tu sitio → **SSL/TLS** → modo **Full (strict)**. Cloudflare valida que el certificado del VPS sea válido (Let's Encrypt lo es).

> Si activas el proxy naranja de Cloudflare (en lugar de DNS only), Cloudflare también termina SSL en su edge y reencripta al VPS. Eso da CDN + DDoS protection. Pero **puede romper Server Actions de Next.js** por el caching agresivo. Recomendación: dejar **DNS only (gris)** hasta validar bien con proxy.

---

## 11. Fase 6 — Apagar Vercel

**No el mismo día del switch.** Esperar 1-2 semanas viendo logs y métricas. Si todo sigue OK:

1. Vercel Dashboard → tu proyecto → **Settings** → **General** → scroll abajo → **Delete Project**.
2. O simplemente **pausar deploys** desactivando el GitHub integration:
   Vercel → Settings → Git → Disconnect.

Esto NO borra la BD (está en Contabo, no en Vercel). Solo apaga la app de Vercel.

---

## 12. Plan de rollback

Si algo falla, escenarios y recuperación:

### 12.1 Rollback durante Fase 1-3 (preparación)

**No hay impacto en producción** — Vercel sigue sirviendo todo. Simplemente no avanzar a Fase 5.

### 12.2 Rollback durante Fase 4 (validación)

**No hay impacto en producción** — el dominio `kpsula.app` aún no apunta al VPS. Vercel sirve `shanklish-erp-main.vercel.app` normal.

### 12.3 Rollback durante Fase 5 (DNS cambiado, problemas)

**Sitio público parcialmente roto.** Algunos users ven el VPS roto, otros aún ven Vercel via cache DNS.

Acción inmediata:
1. **Cloudflare DNS** → cambiar los registros A de `kpsula.app` y `*.kpsula.app` para que apunten al CNAME de Vercel:
   - Type: CNAME
   - Name: @
   - Target: cname.vercel-dns.com
2. Esto redirige `kpsula.app` a Vercel mientras el VPS se arregla.
3. Pero Vercel necesita conocer el dominio. En Vercel: Settings → Domains → Add `kpsula.app` y `*.kpsula.app` (eso ya estaba previsto en el plan original que paramos).

**Tiempo estimado de rollback**: 5-30 min (propagación DNS).

### 12.4 Rollback completo a estado pre-migración

Si todo va mal:
1. En GoDaddy: cambiar nameservers de Cloudflare → default GoDaddy (sin records). El dominio no resuelve, pero `shanklish-erp-main.vercel.app` sigue accesible.
2. Avisar a los usuarios que entren via la URL de Vercel temporalmente.
3. Diagnosticar VPS sin presión.

---

## 13. Checklist final

### Pre-migración (antes de iniciar)
- [ ] Confirmar decisiones de la sección 3.
- [ ] Inventariar env vars de Vercel y comparar con `.env` del VPS.
- [ ] Verificar que las versiones de Node/npm coinciden entre Vercel build y VPS.
- [ ] Backup BD reciente confirmado.

### Fase 0 — VPS pre-requisitos
- [ ] Node 22.x, npm, pm2, nginx, certbot, psql, git instalados.
- [ ] Usuario `deploy` creado (opcional).
- [ ] pm2 startup configurado (sobrevive reboot).

### Fase 1 — Cloudflare DNS
- [ ] Cuenta Cloudflare con `kpsula.app` agregado.
- [ ] Registros A creados (`@` y `*` apuntando a IP VPS, gris).
- [ ] API token Cloudflare generado y guardado en `/etc/letsencrypt/cloudflare.ini` con permisos 600.
- [ ] **Nameservers en GoDaddy NO cambiados todavía**.

### Fase 2 — nginx + SSL
- [ ] `/etc/nginx/sites-available/kpsula.app` creado.
- [ ] Symlink en `sites-enabled/` creado.
- [ ] Certificado wildcard emitido por certbot.
- [ ] `nginx -t` pasa.
- [ ] `systemctl reload nginx` exitoso.
- [ ] `curl --resolve` desde local responde 200.

### Fase 3 — CI/CD
- [ ] SSH keypair generado en VPS.
- [ ] Pública añadida a `authorized_keys`.
- [ ] 4 secrets configurados en GitHub.
- [ ] Deploy manual via `workflow_dispatch` exitoso.
- [ ] `.env` del VPS apunta a BD productiva (`capsula_erp_prod` 5433).
- [ ] pm2 reiniciado con `--update-env`.

### Fase 4 — Validación
- [ ] Health endpoint responde.
- [ ] Login OWNER OK.
- [ ] Login CASHIER → POS sin loop.
- [ ] Login WAITER → POS Mesero.
- [ ] Orden de prueba creada y visible en ambos (VPS y Vercel).
- [ ] Logs limpios en pm2 y nginx.

### Fase 5 — Cambio DNS
- [ ] Backup fresh de BD.
- [ ] Nameservers en GoDaddy → Cloudflare.
- [ ] `dig kpsula.app +short` muestra IP VPS.
- [ ] `https://kpsula.app` carga en navegador limpio.
- [ ] Login + POS funcionan en kpsula.app.

### Fase 6 — Apagar Vercel
- [ ] 1-2 semanas de uptime VPS confirmado.
- [ ] Métricas: pm2 monit, logs, response times OK.
- [ ] Pausar deploys de Vercel (disconnect GitHub).
- [ ] Eventualmente borrar el proyecto de Vercel.

### Auto-deploy en push (opcional, último paso)
- [ ] `ci.yml` actualizado para disparar `deploy` en push a main.
- [ ] Probar con un commit pequeño.

---

## Resumen ejecutivo

| Fase | Riesgo | Producción afectada | Tiempo estimado |
|---|---|---|---|
| 0. Pre-requisitos | Cero | No | 30 min |
| 1. Cloudflare DNS | Cero | No | 15 min |
| 2. nginx + SSL | Cero | No | 30 min |
| 3. CI/CD | Cero | No (deploy manual a paths nuevos) | 30 min |
| 4. Validación | Cero | No | 1 hora |
| 5. **Cambio DNS** | **Medio** | **Sí (transición)** | 5-60 min propagación |
| 6. Apagar Vercel | Bajo | No (es cleanup) | 5 min |

**Total trabajo activo**: ~3-4 horas. **Total real con esperas**: 1 día tranquilo.

Día ideal: domingo o cualquier día con baja operación del restaurante, sin urgencias programadas.
