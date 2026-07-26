# Shanklish On-Premise — Registro "as-built" de la instalación

> **Qué es este documento:** el relato exacto de cómo se instaló el servidor
> local de Shanklish el 2026-07-25, qué falló, por qué, y cómo se resolvió.
> Sirve para (a) repetir la instalación en otro local sin repetir los errores,
> y (b) entender por qué las cosas están como están.
>
> Para **operar** el sistema día a día → `docs/LOCAL_SERVER.md` (runbook).
> Para el **estado de seguridad** → `docs/SECURITY_POSTURE.md`.
> Topología vigente → `docs/INFRASTRUCTURE.md`. Bitácora → `OPUS_CONTEXT_CAPSULA.md` §118.

---

## 1. Qué se construyó

Shanklish dejó de depender de internet para facturar. La fuente de verdad
(base de datos + aplicación) vive ahora en un equipo dentro del restaurante;
kpsula.app sigue existiendo y muestra **los mismos datos en vivo** a través de
un túnel saliente hacia el VPS.

```
        RESTAURANTE (LAN 192.168.1.x)                VPS Contabo
┌──────────────────────────────────────┐      ┌────────────────────────────┐
│ KPSULA-LOCAL  ·  HP EliteDesk 800 G2 │      │ nginx :443 kpsula.app      │
│ Debian 13 · i5 6ta · 8 GB · SSD 256  │      │  └ include capsula-proxy-  │
│                                      │      │    target.conf → :3210     │
│ nginx :80  ◄── tablets · cajas       │      │                            │
│ pm2 → Next.js standalone :3000       │◄─────┤ túnel SSH reverso          │
│ PostgreSQL 18 (PGDG) :5432  ★FUENTE  │ SSH  │  :3210 → local :3000 (app) │
│ print-agent → impresoras AON         │ salie│  :2223 → local :22  (admin)│
│                                      │ nte  │                            │
│ cron: backup 6h · watchdog 2min      │─────►│ backups/local-server/ (30d)│
└──────────────────────────────────────┘      │ app pm2 DETENIDA (conting.)│
                                              └────────────────────────────┘
```

**Decisión de arquitectura:** una sola base de datos, nunca dos. Se descartó
replicar bidireccionalmente porque las escrituras concurrentes de un POS
(mismo cobro en dos lados, correlativos duplicados, inventario descontado dos
veces) producen conflictos sin solución automática limpia.

## 2. Hardware y datos del equipo

| Dato | Valor |
|---|---|
| Equipo | HP EliteDesk 800 G2 DM 35W (refurbished, ~US$185) |
| CPU / RAM | Intel i5 6ta gen / 8 GB |
| Disco | SSD 256 GB (anunciado 128 — venía el doble). SMART `PASSED`, 0 sectores realocados, **62 horas** de uso |
| SO | Debian 13 (trixie), hostname `KPSULA-LOCAL` |
| IP LAN | `192.168.1.164` (reserva DHCP) |
| MAC | `ec:8e:b5:77:cf:22` |
| Usuario | `kpsula` (único usuario humano; root sin contraseña, se usa `sudo`) |

## 3. Instalación paso a paso (lo que efectivamente funcionó)

### 3.1 Arranque del instalador — el obstáculo del Secure Boot

**Falló:** Ubuntu Server 24.04. La ISO (2,7 GB) no cabía en el pendrive
disponible (2,1 GB), y el arranque por red con netboot.xyz **rebotaba en
silencio** al menú de inicio: su iPXE no está firmado y el BIOS del EliteDesk
**no aplicaba el cambio de Secure Boot** (nunca mostró el código de
confirmación que este modelo exige).

**Funcionó:** **Debian netinst** (~700 MB): cabe en pendrives chicos y su
instalador está *shim-signed*, así que **arranca con Secure Boot activo, sin
tocar el BIOS**.

- Grabado con **balenaEtcher** (Rufus falló con "tamaño de clúster no válido"
  y "falló la extracción de la imagen ISO" sobre ISOs pequeñas).
- Instalación: contraseña de **root vacía** (para que `kpsula` tenga sudo),
  ✅ servidor SSH, ❌ sin entorno de escritorio, disco completo.
- GRUB no preguntó por `/dev/sda`: en modo UEFI se instala solo.

**Bucle de arranque post-instalación:** el equipo mostraba una pantalla azul
"Boot Option Restoration" y se reiniciaba en ciclo. Es la protección de HP
ante una entrada de arranque nueva: hay que pulsar una tecla y elegir
**"Always continue boot"** (la opción por defecto es *Reset system*, de ahí el
bucle).

### 3.2 Provisioning

```bash
git clone https://github.com/Juninho2604/capsula-erp.git /var/www/capsula-erp
bash /var/www/capsula-erp/scripts/local-server/install-local-server.sh
```

Instala Node 20 + pm2, **PostgreSQL 18 vía repo PGDG** (misma major que el
VPS: un dump de `pg_dump` 18 puede no restaurar en el PG 16 de la distro),
nginx sirviendo la LAN en `:80`, ufw (solo SSH + 80), `unattended-upgrades` y
`fail2ban`, y los crons de watchdog (2 min) y backup (6 h).

Luego, en `/var/www/capsula-erp/.env`:

| Variable | Valor | Por qué |
|---|---|---|
| `EXTRA_TRUSTED_HOSTS` | `192.168.1.164` | sin esto el middleware redirige a `localhost:3000` y el navegador no conecta |
| `COOKIE_SECURE` | `false` | una cookie `secure` no se guarda sobre http:// → login imposible en LAN |
| `JWT_SECRET` | **idéntico al del VPS** | sesiones intercambiables en un failover |
| `PRINT_AGENT_API_KEY` | **idéntico al del VPS** | el print-agent no se reconfigura, solo cambia de URL |

> Comparar secretos entre servidores sin exponerlos:
> `grep '^JWT_SECRET' .env | cut -d= -f2- | tr -d '" ' | md5sum` en ambos.

### 3.3 Base de datos en instalación nueva

`prisma migrate deploy` **falla sobre una base vacía** (P3018: `no existe la
relación «PurchaseOrder»`): el historial de migraciones no es autocontenido
porque la base productiva evolucionó con `db push` en su etapa temprana. El
instalador ahora detecta el caso y usa `prisma db push`; con historial
(post-cutover) usa `migrate deploy`.

### 3.4 Túnel con el VPS

```bash
# LOCAL — genera llaves e instala el servicio systemd
bash scripts/local-server/setup-tunnel-local.sh 147.93.6.70
# VPS — registra las dos llaves públicas que imprimió el anterior
bash setup-tunnel-vps.sh '<pubkey-tunel>' '<pubkey-backup>'
```

Detalles aprendidos:

- **Puerto 3210, no 3100.** El VPS es multiproyecto y ya tenía otra app en
  `:3100`; el `curl` de verificación devolvía el sitio de una barbería y el
  servicio moría en bucle (`ExitOnForwardFailure`, status 255).
- **El usuario del túnel necesita `/bin/sh`**, no `nologin`: sshd ejecuta las
  *forced commands* a través del shell, y con `nologin` el receptor de backups
  moría con `This account is currently not available`. Se compensa con
  `command="/bin/false"` en la llave del túnel.
- El túnel lleva **dos** forwards: `:3210` (app) y `:2223` (administración
  remota — `ssh root@VPS` y luego `ssh -p 2223 kpsula@127.0.0.1`).

### 3.5 Cutover (ventana real: ~3 minutos)

Tiempos medidos con BD de 9,5 MB / 16.144 ventas: **dump 31 s · restore 5,5 s**.

```bash
# TODO desde el servidor LOCAL. El dump va a /tmp, NO a /root:
# pg_restore corre como usuario `postgres` y no puede leer /root.
rsync -az root@VPS:/var/www/capsula-erp/storage/ /var/www/capsula-erp/storage/  # previo
ssh root@VPS 'pm2 stop capsula-erp'            # ← empieza la ventana
ssh root@VPS 'sudo -u postgres pg_dump -p 5433 -Fc capsula_erp_prod' > /tmp/cutover.dump
chmod 644 /tmp/cutover.dump
systemctl stop cron && pm2 stop capsula-erp
sudo -u postgres dropdb capsula_erp_prod
sudo -u postgres createdb -O capsula capsula_erp_prod
sudo -u postgres pg_restore -p 5432 -d capsula_erp_prod --no-owner --role=capsula /tmp/cutover.dump
cd /var/www/capsula-erp && npx prisma migrate deploy
pm2 restart capsula-erp && systemctl start cron
ssh root@VPS 'capsula-route-local.sh'          # ← switch, fin de la ventana
```

`rsync` **no viene** en Debian netinst (`apt install rsync`). `storage/` no
existía en el VPS: nunca hubo uploads.

> **La app pm2 del VPS queda detenida a propósito.** Es la contingencia; si
> se reactivara aceptaría escrituras en paralelo (split brain).

### 3.6 Actualizaciones sin cortar el servicio

`update-local-server.sh` recompila **en el sitio** — aceptable fuera de
horario. Con el restaurante operando se usa **construir en paralelo y cambiar
en 10 segundos** (patrón del deploy del VPS):

```bash
git clone --branch main <repo> /var/www/capsula-erp-NEW
cp /var/www/capsula-erp/{.env,ecosystem.config.js,start-server.sh} /var/www/capsula-erp-NEW/
cd /var/www/capsula-erp-NEW && npm ci --include=dev
set -a && source .env && set +a && npm run build
cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/
# — cambio atómico —
pm2 stop capsula-erp
mv /var/www/capsula-erp /var/www/capsula-erp-OLD
mv /var/www/capsula-erp-NEW /var/www/capsula-erp
pm2 restart capsula-erp
```

Reversa: invertir los dos `mv`. Conservar `-OLD` unos días.
Compilar consume CPU del mismo equipo que atiende el POS → hacerlo en un valle.

## 4. Incidentes durante la puesta en marcha (y su causa raíz)

| # | Síntoma | Causa raíz | Solución |
|---|---|---|---|
| 1 | SSH al VPS: `Connection timed out` desde la casa | **fail2ban del VPS había baneado la IP** (2.856 baneos históricos: el puerto 22 está bajo ataque constante) | `fail2ban-client set sshd unbanip <ip>` + whitelist en `jail.d/` |
| 2 | `curl` al túnel devolvía **otro sitio web** | puerto `:3100` ya ocupado por otro proyecto del VPS | mover el túnel a `:3210` |
| 3 | Backup al VPS: `This account is currently not available` | usuario del túnel con `nologin`; sshd necesita shell para forced commands | `usermod -s /bin/sh` + `command="/bin/false"` en la llave del túnel |
| 4 | **kpsula.app abría pero no cargaba nada** | nginx del VPS servía `/_next/static/` **desde su propio disco** (build viejo) mientras el HTML venía del local → **todos los JS daban 404** | desactivar los `location /_next/static/` y `/public/` del VPS para que pasen por el túnel |
| 5 | **"Abrir Pickup" no hacía nada** en la LAN, pero **sí funcionaba en kpsula.app** | `crypto.randomUUID()` **solo existe en secure context**. Sobre `http://<ip-lan>` es `undefined` → el handler moría sin feedback | helper `localId()` con cascada; de paso `copyToClipboard()` (7 usos) y guardas de `Notification` — misma clase de bug |
| 6 | La caja no abría el sitio salvo en incógnito | perfil de Chrome con HSTS/upgrade-to-HTTPS memorizado para esa IP | usar Edge o acceso directo `--app=` (no pasa por la barra de direcciones) |
| 7 | Tablet mostraba un login verde ajeno | dirección mal tecleada en el APK → cargaba otro aparato de la red | Ajustes → Apps → KPSULA → Borrar datos → reescribir la IP |
| 8 | Build del APK fallaba con `Value is null` | Groovy parsea `versionCode (X).toInteger()` como `versionCode(X).toInteger()` → setter con String y `.toInteger()` sobre su retorno nulo | resolver `versionCode`/`versionName` en variables antes del bloque `android` |

### 4.1 La lección transversal: HTTPS → HTTP rompe APIs del navegador

Al pasar de `https://kpsula.app` a `http://192.168.1.164`, el navegador
**retira** las APIs de *secure context*. Afectadas y corregidas:
`crypto.randomUUID`, `navigator.clipboard`, `Notification`,
`navigator.serviceWorker` (ya tenía guarda), instalación de PWA.

**Antes de exponer cualquier pantalla nueva por HTTP en LAN**, verificar que no
dependa de esas APIs — o resolver el punto 8 de `SECURITY_POSTURE.md` (HTTPS
interno), que las devuelve todas.

## 5. Puestos de trabajo

**Cajas (PC Windows)** — acceso directo en modo aplicación (ventana sin barra
de navegador; además evita el problema de HSTS):

```
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app=http://192.168.1.164/dashboard/caja
```

Rutas por estación: `/dashboard/caja`, `/dashboard/pos/restaurante`,
`/dashboard/pos/mesero`, `/dashboard/pos/delivery`, `/kitchen`,
`/kitchen/barra`. Icono: `public/icons/kpsula.ico`. Autoarranque: copiar el
acceso directo a `shell:startup`.

**Tablets (Android)** — APK **KPSULA Local** (`android-local/`), compilado con
el workflow *Android Local APK Build* → artifact `kpsula-local-apk`. Al primer
arranque pide la dirección: `http://192.168.1.164`. Pantalla completa,
reconexión automática silenciosa, pantalla siempre encendida.

> El TWA antiguo (`android/`, `app.kpsula.erp`) está amarrado a
> `https://kpsula.app` y **no puede** apuntar a la LAN: si se usa dentro del
> local, el tráfico sale a internet y vuelve por el túnel (lento y dependiente
> de la conexión).

## 6. Sincronización entre pantallas

Los POS **refrescan el plano de mesas cada 5 s** (`pollLayout`), y de ahí sale
el detalle de la mesa activa. No hay copias locales de datos.

El refresco **se pausa** cuando `document.hidden` (tablet bloqueada o app en
segundo plano) o cuando `isProcessing` está activo. Si una petición queda
colgada, la bandera no se libera y **esa pantalla deja de actualizarse**.

- **Remedio operativo:** recargar la pantalla (cerrar y abrir el APK / Ctrl+Shift+R).
- **Pendiente de código:** refrescar al recuperar visibilidad, watchdog para
  `isProcessing`, e indicador de "actualizado hace N s".

## 7. Verificación rápida del sistema

```bash
# En el servidor local
pm2 status
curl -s http://127.0.0.1:3000/api/health
systemctl is-active capsula-tunnel nginx
sudo -u postgres psql -d capsula_erp_prod -tAc 'SELECT count(*) FROM "SalesOrder";'
tail -5 /var/log/capsula-watchdog.log     # solo escribe cuando algo falló

# Desde fuera — que kpsula.app sirva la app COMPLETA, no solo el HTML
CHUNK=$(curl -sk https://kpsula.app/login | grep -o '/_next/static/chunks/[^"]*\.js' | head -1)
curl -sk -o /dev/null -w "%{http_code}\n" "https://kpsula.app$CHUNK"   # debe ser 200
```

> El último comando es el que detecta el incidente #4. Un `curl` a
> `/api/health` **no basta**: responde 200 aunque la página no cargue.
