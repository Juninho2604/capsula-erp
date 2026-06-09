# n8n Integration Setup — Poke Pok Delivery Bot

## Problema: Plan n8n Free sin Variables

El plan free de n8n no permite usar la feature "Environment Variables". Soluciones:

### Opción 1: Upgrade n8n (recomendado para producción)
- Cambiar a plan Pro o Enterprise
- Usar Variables UI para almacenar `API_KEY`, `WEBHOOK_SECRET`, `KPSULA_HOST` con encriptación

### Opción 2: Hardcoded Config Node (rápido, para testing)
- Cada workflow inicia con un nodo "Set Config" que define valores locales
- **No es seguro para secretos en producción**, pero funciona para desarrollo
- Reemplazar valores antes de compartir workflows

### Opción 3: External Secrets Manager
- Usar Vault, AWS Secrets Manager, o similar
- HTTP request al init para recuperar secretos
- Más robusto pero requiere infraestructura extra

## Plan: Usar Opción 2 + instrucciones para Opción 1

Proporcionaré workflows con un "Set Config" node que ustedes deben ajustar con valores reales. Cuando upgradeen a plan pagado, migren esos valores a n8n Variables.

---

## Configuración Necesaria

Antes de importar workflows, recopilar:

| Variable | Valor | Fuente |
|----------|-------|--------|
| `KPSULA_HOST` | `https://pokepok.kpsula.app` | URL del tenant |
| `KPSULA_API_KEY` | (solicitar al user) | Dashboard → Config → API Keys |
| `KPSULA_WEBHOOK_SECRET` | (en VPS env) | `/var/www/capsula-erp/.env` → `DELIVERY_WEBHOOK_SECRET` |
| `TELEGRAM_BOT_TOKEN` | (del bot demo) | Botfather |
| `OPENAI_API_KEY` | (API key OpenAI) | OpenAI dashboard |

---

## Workflow 1: Bot Telegram → Crear Orden

**Flujo:**
1. Trigger Telegram (mensaje texto/foto)
2. Parse Telegram message (chatId, userId, mensaje, isPhoto)
3. IF texto:
   - GET `/contexto` (sedes, agotados, tasa, notas)
   - Cargar orden_id de sesión (si existe)
   - AI Agent con contexto inyectado
   - IF "[CREAR_ORDEN]" en response: POST `/ordenes` → guardar orden_id en sesión
   - Responder con correlativo
4. IF foto:
   - Cargar orden_id de sesión → Workflow 2

**Instalaciones n8n necesarias:**
- Telegram
- HTTP Request
- OpenAI (o similar IA)
- Code (para parseado y transformación)
- Set (para guardar datos)

---

## Workflow 2: Foto Comprobante → Validar Pago

**Flujo:**
1. Trigger: foto detectada en Workflow 1
2. Cargar orden_id de sesión
3. Descargar imagen de Telegram
4. POST `/ordenes/{id}/comprobante` (multipart: file + tipo)
5. Responder "Comprobante recibido, esperando validación"

**Notas:**
- Usar node "HTTP Request" con modo `form-data`
- Enviar `files[]=<image>` + `tipo=manual`

---

## Workflow 3: Webhook Listener → Notificar Cliente

**Flujo:**
1. Trigger Webhook HTTP POST (desde `/api/cron/deliver-webhooks` del backend)
2. Validar firma HMAC-SHA256 (header `X-Kpsula-Signature`)
3. Switch por event.type:
   - `orden.en_cocina` → "Tu orden está en cocina 🍳"
   - `orden.lista` → "Tu orden está lista para entrega"
   - `orden.en_camino` → "Tu motorizado está en camino"
   - `orden.entregada` → "Orden entregada ✓"
4. Enviar respuesta Telegram al `chat_id` (del payload webhook)

**Notas:**
- Validación HMAC: `crypto.createHmac('sha256', secret).update(body).digest('hex')`
- Header esperado: `X-Kpsula-Signature: <hex>`
- Body en JSON, no re-serializar

---

## Setup Step-by-Step

### 1. Crear nodo "Set Config" compartido (para todos los workflows)

En cada workflow, al inicio, agregar un nodo "Code" llamado "Set Config":

```javascript
// Set Config (Code node)
// Este nodo define variables locales accesibles en todo el workflow

$input.first().json = {
  config: {
    KPSULA_HOST: "https://pokepok.kpsula.app",
    KPSULA_API_KEY: "TU_API_KEY_AQUI",  // ⚠️ Cambiar antes de usar en producción
    KPSULA_WEBHOOK_SECRET: "TU_SECRET_AQUI",
    TELEGRAM_BOT_TOKEN: "TU_BOT_TOKEN_AQUI",
    OPENAI_API_KEY: "TU_OPENAI_KEY_AQUI",
  }
};

return $input.first();
```

Luego, en cualquier nodo, acceder a la config:

```javascript
// En HTTP Request node parameter:
{{ $workflow.activeExecution.data.config.KPSULA_HOST }}
{{ $workflow.activeExecution.data.config.KPSULA_API_KEY }}

// O en Code node:
const config = $input.first().json.config;
const apiKey = config.KPSULA_API_KEY;
```

### 2. Importar Workflow 1 (Bot Telegram)

Ver archivo: `n8n-workflow-1-bot-telegram.json`

Pasos:
- n8n UI → Workflows → Import
- Pegar JSON
- Editar nodo "Set Config" con valores reales
- Editar nodo "Telegram Trigger" con tu `TELEGRAM_BOT_TOKEN`
- Test: mandar un mensaje al bot demo

### 3. Importar Workflow 2 (Comprobante Handler)

Ver archivo: `n8n-workflow-2-comprobante.json`

Pasos:
- Repetir import
- Editar "Set Config"
- El nodo "Cargar orden_id desde sesión" retrieves workflow data del Workflow 1
- Test: enviar una foto al bot después de crear orden

### 4. Importar Workflow 3 (Webhook Listener)

Ver archivo: `n8n-workflow-3-webhook.json`

Pasos:
- Repetir import
- Editar nodo "Webhook Trigger" → copiar URL pública
- En dashboard delivery → Config → agregar esa URL como `webhookUrl`
- En VPS, editar `/var/www/capsula-erp/.env`:
  ```
  DELIVERY_WEBHOOK_SECRET="TU_SECRET_AQUI"
  ```
- Reiniciar backend (el cron `/api/cron/deliver-webhooks` comenzará a enviar eventos)

### 5. Habilitar cron en VPS

En `/var/www/capsula-erp`, agregar a `crontab -e`:

```bash
# Cada 30 segundos, entregar webhooks pendientes
* * * * * curl -s -X GET "http://127.0.0.1:3000/api/cron/deliver-webhooks" \
  -H "Authorization: Bearer ${CRON_SECRET}" > /dev/null 2>&1
* * * * * sleep 30 && curl -s -X GET "http://127.0.0.1:3000/api/cron/deliver-webhooks" \
  -H "Authorization: Bearer ${CRON_SECRET}" > /dev/null 2>&1
```

O usar systemd timer (recomendado). Ver: `/var/www/capsula-erp/scripts/setup-cron.sh` (crear si no existe).

---

## Migración a n8n Plan Pagado

Cuando upgradeen:

1. Crear Variables en n8n UI:
   - `KPSULA_HOST` = "https://pokepok.kpsula.app"
   - `KPSULA_API_KEY` = "xxxx" (marked as secret)
   - `KPSULA_WEBHOOK_SECRET` = "xxxx" (marked as secret)
   - `TELEGRAM_BOT_TOKEN` = "xxxx" (marked as secret)
   - `OPENAI_API_KEY` = "xxxx" (marked as secret)

2. En cada workflow, reemplazar el "Set Config" node por:
   ```javascript
   return {
     config: {
       KPSULA_HOST: $env.KPSULA_HOST,
       KPSULA_API_KEY: $env.KPSULA_API_KEY,
       KPSULA_WEBHOOK_SECRET: $env.KPSULA_WEBHOOK_SECRET,
       TELEGRAM_BOT_TOKEN: $env.TELEGRAM_BOT_TOKEN,
       OPENAI_API_KEY: $env.OPENAI_API_KEY,
     }
   };
   ```

3. Listo. No más cambios de código, solo actualizar variables en UI.

---

## Testing Checklist

- [ ] Workflow 1 importado, `Set Config` actualizado
- [ ] Bot responde en Telegram
- [ ] AI agent genera "[CREAR_ORDEN]" cuando usuario menciona orden
- [ ] POST a `/ordenes` crea la orden
- [ ] orden_id se guarda en sesión n8n
- [ ] Workflow 2 importado
- [ ] Usuario envía foto, comprobante se sube a `/ordenes/{id}/comprobante`
- [ ] Dashboard muestra orden en estado `PAGO_POR_VALIDAR`
- [ ] Workflow 3 importado, webhook URL configurada en dashboard
- [ ] Cron está activo en VPS
- [ ] Admin valida pago en dashboard → orden pasa a `EN_COCINA`
- [ ] Webhook del cron envía evento al Workflow 3
- [ ] Bot responde al usuario: "Tu orden está en cocina"
- [ ] Estados subsecuentes (LISTA, EN_CAMINO, ENTREGADA) se propagan igual

---

## Troubleshooting

**"No se conecta a KPSULA"**
- Verificar `KPSULA_HOST` y `KPSULA_API_KEY` en "Set Config"
- Test manual: `curl -s https://pokepok.kpsula.app/api/v1/delivery/contexto -H "X-API-Key: TU_KEY"`
- Si falla, verificar que el tenant pokepok existe y tiene flag `deliveryOps: true`

**"orden_id no se guarda entre mensajes"**
- n8n guarda workflow data en BD, pero se limpia si workflow completa sin errors
- Usar "Set" node al final de Workflow 1: `{ sessionData: { orden_id } }`
- Recuperar en Workflow 2: "Get" node antes de comprobante

**"Comprobante no sube"**
- Verificar que el nodo HTTP es multipart form-data
- Enviar: `files[0]` (la imagen) + `tipo: manual`
- Chequear headers de Telegram en code node

**"Webhooks no llegan"**
- Verificar que webhook URL en dashboard es accesible desde VPS
- Test: `curl -X POST <webhook-url> -H "Content-Type: application/json" -d '{...}'`
- Chequear logs del cron: `tail -f /var/www/capsula-erp/logs/cron.log`
- Validar HMAC en Workflow 3: cabecera esperada es `X-Kpsula-Signature`

**"AI agent no entiende contexto"**
- Ajustar system prompt en nodo "AI Agent"
- Incluir instrucción explícita: "Si usuario menciona orden, dinero, envío → outputear [CREAR_ORDEN]"
- Inyectar contexto en user message: `"Sedes disponibles: ${JSON.stringify(sedes)}..."`

---

## Notas de Seguridad

⚠️ **Free tier + hardcoded values es solo para desarrollo local.**

Para producción:
- Usar n8n plan pagado con Variables encriptadas
- Nunca compartir workflows con API keys visibles
- Rotary claves después de testing
- VPS env vars (`DELIVERY_WEBHOOK_SECRET`) nunca en código
- HMAC validation en Workflow 3 es **crítica** para rechazar requests falsos

---

## Referencias

- Dashboard delivery: `https://pokepok.kpsula.app/dashboard/delivery`
- API docs: `/src/app/api/v1/delivery/` (endpoint specs)
- Schema delivery: `/prisma/schema.prisma` (modelos DeliveryOrder, DeliveryZone, etc.)
- n8n docs: https://docs.n8n.io/
