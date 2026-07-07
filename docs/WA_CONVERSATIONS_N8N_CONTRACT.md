# Contrato n8n ↔ Kpsula — Módulo Conversaciones WhatsApp

Kpsula es la **fuente de verdad** de las conversaciones y el **panel humano**.
El bot ("Fabiola") vive en n8n. n8n consulta a Kpsula quién tiene el control
antes de responder.

## Autenticación

Todos los endpoints `/api/v1/wa/*` usan header `x-api-key` por tenant, igual
que `/api/v1/delivery/*`. La key se matchea contra la env var **`WA_API_KEYS`**
(JSON `{ "<tenantId>": "<key>" }`); si no está definida, cae a
`DELIVERY_API_KEYS` para reutilizar la misma key del workflow de delivery.
El tenant se **deriva** de la key. Respuestas de error: `401 {error:"Unauthorized"}`,
`403 {error:"wa_conversations disabled"}` (flag apagado), `400` (validación).

El módulo se activa por tenant con el feature flag **`waConversations`**
(`/dashboard/config/feature-flags`, solo OWNER). Con el flag apagado, módulo y
API quedan ocultos (403).

## Flujo por mensaje entrante

```
Webhook Meta → n8n
  │
  ├─ 1. POST /api/v1/wa/inbound   { waId, name?, kind, body?, mediaId?, location?, wamid? }
  │        ← { status, conversationId, optedOut }
  │
  ├─ 2a. status == "BOT"  → n8n corre el AI Agent (Fabiola) → envía a Meta
  │         → POST /api/v1/wa/outbound/bot  { waId | conversationId, kind?, body?, templateName?, wamid? }
  │
  └─ 2b. status == "HUMAN" → n8n TERMINA (no responde). El humano contesta desde Kpsula.

Webhooks de estado (statuses[]) de Meta → n8n → POST /api/v1/wa/status
```

**Optimización:** antes de invocar al AI Agent, n8n puede llamar
`GET /api/v1/wa/conversations/:waId/control` → `{ status, conversationId }`
(cache 5s, responde en <50ms). Si `status == "HUMAN"`, saltear el agente.
`/inbound` ya devuelve `status`, así que el `/control` es opcional (útil si n8n
tiene pasos intermedios entre recibir y responder).

## Endpoints (n8n)

### `POST /api/v1/wa/inbound`
Reporta cada mensaje entrante. Upsert de conversación (por `tenantId+waId`),
crea `WaMessage` INBOUND, **actualiza la ventana de 24h**, procesa opt-out
(BAJA/STOP → marca `optedOutAt`, responde confirmación única), descarga media
(los `mediaId` de Meta expiran → se guardan en storage local), incrementa
`unreadCount`. Dedupe por `wamid`.

```jsonc
// Request
{ "waId": "584121234567", "name": "María", "kind": "TEXT", "body": "Hola",
  "mediaId": null, "location": { "latitude": 10.5, "longitude": -66.9 },
  "wamid": "wamid.HBg..." }
// Response
{ "status": "BOT", "conversationId": "clx...", "optedOut": false }
```
`kind`: TEXT | IMAGE | DOCUMENT | LOCATION | AUDIO | UNSUPPORTED.

### `POST /api/v1/wa/outbound/bot`
Registra lo que Fabiola respondió (opción A: n8n ya lo envió a Meta).
```jsonc
{ "conversationId": "clx...", "kind": "TEXT", "body": "¡Hola!", "wamid": "wamid..." }
// ó por waId en vez de conversationId. Dedupe por wamid.
```

### `POST /api/v1/wa/status`
Reenvía los webhooks de estado de Meta. Actualiza `deliveryStatus` por `wamid`.
```jsonc
{ "statuses": [ { "id": "wamid...", "status": "read" } ] }
// ó forma simplificada: { "wamid": "...", "status": "delivered" }
```
`status`: sent | delivered | read | failed.

### `GET /api/v1/wa/conversations/:waId/control`
```jsonc
{ "status": "HUMAN", "conversationId": "clx...", "cached": true }
```

## Vínculo con la orden de delivery (§6.3)

El nodo que crea la orden (`POST /api/v1/delivery/ordenes`) ahora acepta un
campo opcional **`conversationId`** (el que devolvió `/inbound`). Kpsula setea
`WaConversation.lastOrderId` → la bandeja muestra el chip "Pedido" con link al
módulo de delivery. Es best-effort: si el id no es del tenant, no rompe la orden.

## Quién envía a Meta (§6.1)

**Fase actual — Opción A:** n8n envía las respuestas del bot a Meta (como hoy) y
las reporta a `/outbound/bot`. Kpsula solo envía los **mensajes humanos** (desde
la bandeja, vía el helper `sendWhatsAppMessage`). El helper ya está listo para la
Opción B (fase 2: todo sale por Kpsula), pero no está activada.

## Compliance (forzado por Kpsula, no por n8n)

- **Ventana 24h**: texto libre solo dentro de ventana; fuera, solo plantillas
  APPROVED. Aplica a los envíos humanos desde Kpsula.
- **Opt-out (BAJA/STOP)**: Kpsula lo detecta en `/inbound`, marca la conversación
  y responde la confirmación única. n8n no necesita manejarlo.
- **Opt-in marketing**: plantillas MARKETING solo con `marketingOptIn` y sin
  opt-out.

## Credenciales

`WaCredential` por tenant (phoneNumberId, wabaId, accessToken y appSecret
cifrados con AES-256-GCM, graphApiVersion). Se configuran en la UI del módulo
(solo OWNER/ADMIN). El token nunca se loggea ni se expone (se muestra
enmascarado). Env requerida para el cifrado: **`WA_TOKEN_ENC_KEY`** (64 hex,
`openssl rand -hex 32`).
