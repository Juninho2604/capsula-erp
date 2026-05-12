# KPSULA Print Agent

Daemon Node.js que corre en una PC del restaurante. Pollea cada segundo el ERP en Vercel y traduce los `PrintJob` pendientes a comandos ESC/POS sobre TCP/IP hacia las impresoras térmicas AON conectadas por Ethernet.

Resuelve el problema de que las tablets (Android, sin driver de impresora) no pueden imprimir directamente a las térmicas. El POS encola, el agent imprime.

## Arquitectura

```
Tablet (POS)                ERP (Vercel)              Print Agent (PC local)         Impresora AON
─────────────              ──────────────             ──────────────────────         ─────────────
enqueuePrintJob()  ──►   crea PrintJob (DB)    ◄──   GET /jobs?status=PENDING
                                                ──►   POST /jobs/:id/claim
                                                                                ──►   ESC/POS TCP:9100
                                                ◄──   POST /jobs/:id/complete
```

## Requisitos

- **Node.js 20+** ([download](https://nodejs.org/en/download)).
- **Windows 10/11** (también corre en Linux/macOS, pero la guía aquí es para Windows porque es donde lo desplegamos).
- **La PC host debe estar SIEMPRE encendida** durante el servicio. Si se reinicia, el Windows Service lo levanta solo al boot.
- **Conectividad LAN**: la PC host debe poder hacer `ping <ip-de-cada-impresora>` y conectar al puerto 9100.
- **Conectividad WAN**: la PC host debe poder llegar a `https://shanklish-erp-main.vercel.app` (HTTPS).
- Las impresoras AON deben tener **IP fija** en la LAN (asignada vía DHCP reservation o configurada directamente en el panel de la impresora).

## Setup paso a paso

### 1. Asignar IPs fijas a cada impresora AON (Jonathan)

Cada AON tiene un panel de configuración accesible desde su menú físico. Asignar:

- IP estática (ej. `192.168.1.50`, `192.168.1.51`, etc.)
- Máscara: `255.255.255.0` (típicamente)
- Gateway: la IP del router

Verificar desde la PC host:

```cmd
ping 192.168.1.50
```

Si responde 4 paquetes ok, está alcanzable.

### 2. Verificar puerto 9100

Las AON aceptan ESC/POS RAW por TCP puerto 9100 (estándar). En PowerShell:

```powershell
Test-NetConnection -ComputerName 192.168.1.50 -Port 9100
```

Debe decir `TcpTestSucceeded : True`.

### 3. Instalar Node.js 20 en la PC host

Bajar el instalador LTS de https://nodejs.org/en/download y ejecutarlo con defaults. Verificar:

```cmd
node --version
npm --version
```

### 4. Clonar el agent

Si el repo está clonado en `C:\kpsula-erp`:

```cmd
cd C:\kpsula-erp\print-agent
npm install
```

### 5. Configurar `.env`

Crear `C:\kpsula-erp\print-agent\.env` con:

```env
ERP_URL=https://shanklish-erp-main.vercel.app
API_KEY=<una-clave-larga-aleatoria-que-tambien-este-en-vercel>
TENANT_ID=tnt_shanklish_caracas
POLL_INTERVAL_MS=1000
PRINTERS_JSON=[{"station":"kitchen-1","ip":"192.168.1.50","port":9100}]
DEFAULT_STATION=kitchen-1
```

> **API_KEY**: Es un secreto compartido. La misma clave debe estar en las variables de entorno de Vercel como `PRINT_AGENT_API_KEY`. Generarla con `openssl rand -hex 32` o un password manager.

> **PRINTERS_JSON**: Mapping de estación → IP. Para añadir más impresoras, simplemente agregar más objetos. Ej:
> ```json
> [
>   {"station":"kitchen-1","ip":"192.168.1.50","port":9100},
>   {"station":"kitchen-2","ip":"192.168.1.51","port":9100},
>   {"station":"bar","ip":"192.168.1.52","port":9100},
>   {"station":"cajera-1","ip":"192.168.1.53","port":9100}
> ]
> ```

### 6. Test print (sin pasar por el ERP)

Antes de arrancar el daemon completo, verificar que la impresora responde:

```cmd
cd C:\kpsula-erp\print-agent
npx tsx src/cli-test-print.ts --ip=192.168.1.50 --station=kitchen-1
```

Si todo va bien, sale un recibo de prueba "KPSULA PRINT AGENT — Test de conectividad".

Si falla:

| Síntoma | Causa probable | Solución |
|---|---|---|
| `no responde` / timeout | IP incorrecta o printer apagada | Verificar IP con `ping`, prender printer |
| Sin papel / LED rojo | Sin rollo o atascado | Recargar papel |
| Caracteres raros (ñ, ácentos) | Codepage | Cambiar `CharacterSet.WPC1252` a `PC850_MULTILINGUAL` en `printer-adapter.ts` |
| Imprime símbolos basura | No es ESC/POS | Verificar manual de la AON, puede usar otro protocolo |

### 7. Arrancar el agent en modo dev

Para ver logs en vivo mientras probamos:

```cmd
cd C:\kpsula-erp\print-agent
npm run dev
```

Debe imprimir:

```
[2026-05-12T...Z] [INFO] KPSULA Print Agent v0.1.0 arrancando…
[2026-05-12T...Z] [INFO] ERP: https://shanklish-erp-main.vercel.app
[2026-05-12T...Z] [INFO] Tenant: tnt_shanklish_caracas
[2026-05-12T...Z] [INFO] Polling cada 1000ms
[2026-05-12T...Z] [INFO] 1 impresora(s) configurada(s):
[2026-05-12T...Z] [INFO]   - kitchen-1 → 192.168.1.50:9100
```

Si encolas un job desde el POS, debe procesarlo en menos de 2 segundos.

### 8. Instalar como Windows Service (producción)

Una vez verificado que el agent funciona en modo dev, registrarlo como servicio para que arranque solo al boot:

```cmd
cd C:\kpsula-erp\print-agent
npm run build
npx tsx scripts/install-service.ts
```

Esto crea un servicio "KPSULA Print Agent" en Windows. Verificar en `services.msc` que esté en estado "Running" y "Startup Type: Automatic".

Para desinstalar:

```cmd
npx tsx scripts/uninstall-service.ts
```

### 9. Logs del servicio

Cuando corre como Windows Service, los logs van a:

```
C:\kpsula-erp\print-agent\daemon\<nombre>.out.log
C:\kpsula-erp\print-agent\daemon\<nombre>.err.log
```

Para ver en vivo:

```powershell
Get-Content -Path "C:\kpsula-erp\print-agent\daemon\*.out.log" -Wait -Tail 50
```

## Troubleshooting

### El agent muestra "fetch pending: HTTP 401"

API_KEY no coincide entre el `.env` local y `PRINT_AGENT_API_KEY` en Vercel. Verificar que sean idénticas.

### El agent muestra "ECONNREFUSED 192.168.1.50:9100"

La impresora no responde. Verificar:
1. Está prendida.
2. Tiene IP correcta (puede haber cambiado si el router se reinició).
3. Firewall de Windows permite conexión saliente al puerto 9100.

### Jobs se quedan en PRINTING para siempre

El agent crasheó después de hacer claim. Reiniciar el servicio:

```cmd
net stop "KPSULA Print Agent"
net start "KPSULA Print Agent"
```

Y para limpiar jobs huérfanos (opcional, desde el ERP):
- UI futura: panel `/dashboard/admin/print-jobs` con botón "Reset huérfanos".
- Por ahora: borrar manualmente desde la DB.

### Cambiar la IP de una impresora sin reiniciar el agent

Editar `.env`, reiniciar el servicio:

```cmd
net stop "KPSULA Print Agent"
net start "KPSULA Print Agent"
```

## Versionado

- `v0.1.0` — MVP. Polling cada 1s, ESC/POS por TCP, single tenant, sin UI de monitoreo.
- `v0.2.0` — Pendiente. WebSocket en vez de polling para latencia <100ms. UI de monitoreo en /dashboard/admin/print-jobs.
