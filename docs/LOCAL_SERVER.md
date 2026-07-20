# Servidor Local del Restaurante — Arquitectura y Runbook

> Cómo instalar y operar el computador dedicado del restaurante que corre
> capsula-erp **on-premise**, sirviendo a tablets y cajas por la LAN, con
> comunicación 24/7 con la versión web (kpsula.app en el VPS Contabo).
>
> Scripts: `scripts/local-server/`. Contexto histórico: `OPUS_CONTEXT_CAPSULA.md` §118.

---

## 1. Decisión de arquitectura

**Una sola fuente de verdad: la BD del servidor local.** No hay sincronización
bidireccional de bases de datos (eso genera conflictos irresolubles con ventas
concurrentes). En su lugar:

- **En el local**: el computador dedicado corre el stack completo
  (PostgreSQL + Next.js + nginx). Tablets, cajas y el print-agent apuntan a
  `http://<ip-fija-del-servidor>` por la LAN. **El servicio funciona aunque
  se caiga internet** — esa es la razón de ser de todo esto.
- **En internet**: kpsula.app sigue viva en el VPS, pero nginx del VPS ya no
  proxea a su propio Next.js sino a un **túnel SSH reverso** que llega al
  servidor local. Quien entra a kpsula.app desde cualquier parte ve y opera
  **los mismos datos en vivo** del restaurante.
- **Respaldo**: cada 6 horas el servidor local empuja un `pg_dump` al VPS.
  Si el computador del local muere, el VPS puede levantar su propio stack
  con el último dump en minutos (plan de contingencia, sección 7). Esto
  además cierra el hueco de backup off-site del VPS (§40.1 al revés: ahora
  la BD viva está en el local y el off-site es el VPS).

```
        RESTAURANTE (LAN)                          VPS Contabo (147.93.6.70)
┌────────────────────────────────┐          ┌──────────────────────────────────┐
│  Computador dedicado (24/7)    │          │  nginx :443 (kpsula.app, SSL)    │
│                                │          │   └─ include capsula-proxy-      │
│  nginx :80 ◄── tablets/cajas   │          │      target.conf                 │
│   └─ proxy 127.0.0.1:3000      │          │        ├─ :3210 = túnel → LOCAL  │
│  pm2: Next.js standalone :3000 │          │        └─ :3000 = stack VPS      │
│  postgres :5432 (FUENTE ÚNICA) │          │            (solo contingencia)   │
│  print-agent → localhost       │          │                                  │
│                                │  túnel   │  sshd ◄─ user capsula-tunnel     │
│  capsula-tunnel.service ───────┼──SSH ───►│   -R 127.0.0.1:3210 → local:3000 │
│  (systemd, reconexión auto)    │  reverso │                                  │
│                                │          │  backups/local-server/           │
│  cron backup cada 6h ──────────┼──push───►│   (pg_dump, retención 30d)       │
│  cron watchdog cada 2min       │          │                                  │
└────────────────────────────────┘          └──────────────────────────────────┘
```

Qué pasa en cada escenario:

| Escenario | POS en el local | kpsula.app remoto |
|---|---|---|
| Todo normal | ✅ LAN, rápido | ✅ datos en vivo vía túnel |
| Internet del local caído | ✅ sigue operando (LAN pura) | ❌ 502 hasta que vuelva (el túnel reconecta solo) |
| VPS caído | ✅ sigue operando | ❌ hasta que el VPS vuelva |
| Computador local muerto | ❌ | 🟡 contingencia manual: VPS levanta con último dump (sección 7) |

## 2. Hardware y red (requisitos)

- **Computador dedicado**: cualquier mini-PC/desktop con 8+ GB RAM, SSD 128+ GB,
  Ethernet (no WiFi). Instalar **Ubuntu Server 24.04 LTS** o **Debian 12/13**
  (mismo procedimiento; el instalador de Debian está firmado para Secure Boot,
  útil en equipos cuyo BIOS no deja deshabilitarlo — caso real: HP EliteDesk
  800 G2 del primer despliegue). En Debian, dejar la contraseña de root vacía
  durante la instalación para que el usuario creado tenga sudo.
- **UPS obligatorio**: el equipo debe sobrevivir cortes de luz (mínimo el
  tiempo de apagado limpio; ideal 30+ min para seguir cobrando).
- **IP fija en la LAN** (reserva DHCP en el router o estática), ej. `192.168.1.10`.
  Las impresoras AON ya tienen IPs fijas (ver `print-agent/README.md`).
- **BIOS**: activar "Restore on AC Power Loss" para que arranque solo al volver
  la luz. Todo el stack levanta solo al boot (systemd + pm2 startup).
- Router: no hace falta abrir NINGÚN puerto hacia internet. El túnel es
  saliente (local → VPS).

## 3. Instalación (día de setup)

En el computador del local, como root:

```bash
git clone https://github.com/Juninho2604/capsula-erp.git /var/www/capsula-erp
cd /var/www/capsula-erp/scripts/local-server
bash install-local-server.sh          # ~10-20 min (build incluido)
```

El script instala **PostgreSQL 18 desde el repo PGDG** (no el de la distro):
misma major version que el VPS, para que el `pg_restore` del cutover no
tropiece con incompatibilidades de versión.

Al terminar:

1. **Editar `/var/www/capsula-erp/.env`**:
   - `EXTRA_TRUSTED_HOSTS="192.168.1.10"` (la IP fija real de la máquina).
   - `JWT_SECRET` y `PRINT_AGENT_API_KEY`: copiar los valores del `.env` del
     VPS para mantener credenciales idénticas.
   - `COOKIE_SECURE=false` ya viene seteado (necesario para login por http
     en la LAN — **nunca** copiar este flag al VPS).
2. `pm2 restart capsula-erp`
3. Verificar desde una tablet: `http://192.168.1.10` debe mostrar el login.

## 4. Migración de datos (cutover desde el VPS)

Hacer **fuera de horario de servicio**. Orden exacto:

```bash
# EN EL VPS — dump fresco de producción
sudo -u postgres pg_dump -p 5433 -Fc capsula_erp_prod > /root/cutover.dump
scp /root/cutover.dump root@<ip-local-por-vpn-o-lan>:/root/   # o pendrive

# EN EL LOCAL — restaurar
systemctl stop cron && pm2 stop capsula-erp
sudo -u postgres dropdb capsula_erp_prod && sudo -u postgres createdb -O capsula capsula_erp_prod
sudo -u postgres pg_restore -p 5432 -d capsula_erp_prod --no-owner --role=capsula /root/cutover.dump
cd /var/www/capsula-erp && npx prisma migrate deploy   # por si el local trae migraciones más nuevas
pm2 restart capsula-erp && systemctl start cron
curl -fsS http://127.0.0.1:3000/api/health             # debe responder OK
```

También copiar `storage/` del VPS (uploads: notas de entrega, comprobantes):
`rsync -az root@147.93.6.70:/var/www/capsula-erp/storage/ /var/www/capsula-erp/storage/`

**Congelar escrituras en el VPS durante el cutover** (parar pm2 del VPS o
poner nginx en maintenance) para no perder ventas entre el dump y el switch.

## 5. Túnel 24/7 con kpsula.app

```bash
# EN EL LOCAL
bash scripts/local-server/setup-tunnel-local.sh 147.93.6.70
# → imprime 2 llaves públicas

# EN EL VPS (pegar las llaves impresas)
bash setup-tunnel-vps.sh '<pubkey-tunel>' '<pubkey-backup>'
# → una sola vez: reemplazar en el server block de kpsula.app la línea
#   `proxy_pass http://localhost:3000;` por
#   `include snippets/capsula-proxy-target.conf;`  y recargar nginx

# EN EL LOCAL
systemctl start capsula-tunnel

# EN EL VPS — el switch final
capsula-route-local.sh     # kpsula.app pasa a servir desde el local
```

Verificación: entrar a kpsula.app desde un celular con datos móviles, abrir
una mesa de prueba desde una tablet en la LAN, y confirmar que aparece en
kpsula.app. **Misma BD = mismo dato al instante.**

Después del switch, apuntar el **print-agent** de la PC de impresión a
`http://192.168.1.10` (o correrlo en el mismo servidor dedicado) — así la
impresión tampoco depende de internet.

## 6. Operación diaria

| Qué | Cómo |
|---|---|
| Estado general | `pm2 status`, `systemctl status capsula-tunnel`, `curl -s localhost:3000/api/health` |
| Logs de la app | `pm2 logs capsula-erp` / `/var/log/capsula-erp.err.log` |
| Watchdog (auto-restart app/BD/túnel cada 2 min) | `/var/log/capsula-watchdog.log` — solo escribe cuando algo falló |
| Backups (cada 6h local + push al VPS) | `/var/log/capsula-backup.log`, dumps en `/var/backups/capsula-local/` y en el VPS `/var/lib/postgresql/backups/local-server/` |
| **Actualizar la app** (el CI solo despliega al VPS) | `bash scripts/local-server/update-local-server.sh` — fuera de horario; hace backup previo, build, `migrate deploy` y restart |
| Reinicio de la máquina | Todo levanta solo (pm2 startup + systemd). Verificar con los 3 comandos de estado. |

**Regla de migraciones (§9 de CLAUDE.md) extendida:** el servidor local corre
`prisma migrate deploy` en cada `update-local-server.sh`. Actualizar el local
**y** el VPS en el mismo bloque de trabajo cuando haya migraciones, para que
el dump que viaja al VPS nunca tenga un schema más nuevo que el código del
stack de contingencia.

## 7. Contingencia: murió el computador del local

kpsula.app en el VPS queda 502 (túnel muerto) y las tablets sin servidor.
Para reactivar el servicio con el stack del VPS mientras se repara/reemplaza
la máquina:

```bash
# EN EL VPS
ls -t /var/lib/postgresql/backups/local-server/ | head -1   # último dump recibido
sudo -u postgres dropdb -p 5433 capsula_erp_prod
sudo -u postgres createdb -p 5433 -O capsula capsula_erp_prod
sudo -u postgres pg_restore -p 5433 -d capsula_erp_prod --no-owner --role=capsula \
    /var/lib/postgresql/backups/local-server/<ultimo>.dump
cd /var/www/capsula-erp && npx prisma migrate status        # debe estar al día
pm2 restart capsula-erp
capsula-route-vps.sh        # kpsula.app vuelve a servir desde el VPS
```

Las tablets vuelven a apuntar a `https://kpsula.app` (necesitan internet).
**Se pierden como máximo las últimas ~6 horas de datos** (frecuencia del
backup; se puede subir a cada hora editando `/etc/cron.d/capsula-local`).

Cuando el local se repare: mismo flujo de la sección 4 pero en sentido
VPS → local, y `capsula-route-local.sh` para devolver el ruteo.

## 8. Seguridad

- **Usuarios del SO vs usuarios de la app**: en Linux existe UN solo usuario
  humano (`capsula`, el administrador). El personal del restaurante usa
  exclusivamente la aplicación web (sus usuarios/PINs/roles de siempre, que
  viajan con la BD en el cutover). No crear cuentas Linux adicionales.
- **Hardening base** (lo instala `install-local-server.sh`):
  `unattended-upgrades` (parches de seguridad automáticos, sin auto-reboot) y
  `fail2ban` (jail sshd, 5 intentos → ban). Verificar con
  `fail2ban-client status sshd`.
- El túnel usa el usuario `capsula-tunnel` **restringido**: la llave del túnel
  solo puede abrir `127.0.0.1:3210` en el VPS (`restrict,permitlisten`), y la
  llave de backup solo puede ejecutar el receptor de dumps (forced command).
  Ninguna da shell.
- `ufw` en el local: solo SSH y :80 (LAN). Postgres y :3000 no se exponen.
- `COOKIE_SECURE=false` y `EXTRA_TRUSTED_HOSTS` son **exclusivos del .env
  local**. En el VPS no van — el middleware y las cookies siguen exactamente
  igual que siempre si esas vars no existen.
- El tráfico LAN va por http plano: aceptable dentro de la red del local
  (mismo modelo de confianza que las impresoras ESC/POS). No exponer el :80
  del servidor local a internet jamás — para acceso remoto está kpsula.app.
