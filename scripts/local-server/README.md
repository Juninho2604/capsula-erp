# scripts/local-server

Instalación y operación del **servidor local del restaurante** (computador
dedicado que sirve capsula-erp a las tablets por LAN, con túnel 24/7 hacia
kpsula.app en el VPS).

**Runbook completo: [`docs/LOCAL_SERVER.md`](../../docs/LOCAL_SERVER.md)** — leer eso primero.

| Script | Dónde corre | Qué hace |
|---|---|---|
| `install-local-server.sh` | Local | Provisiona todo (node, postgres, nginx, pm2, crons) |
| `env.example` | Local | Template del `.env` on-premise |
| `nginx-local.conf` | Local | Sitio nginx que sirve la app a la LAN por :80 |
| `setup-tunnel-local.sh` | Local | Llaves + servicio systemd del túnel SSH reverso |
| `setup-tunnel-vps.sh` | **VPS** | Usuario restringido, receptor de backups, helpers de ruteo nginx |
| `push-backup-to-vps.sh` | Local (cron 6h) | `pg_dump` local + push off-site al VPS |
| `watchdog.sh` | Local (cron 2min) | Auto-restart de app, postgres y túnel |
| `update-local-server.sh` | Local | Actualiza la app a la última `main` (el CI no llega acá) |
