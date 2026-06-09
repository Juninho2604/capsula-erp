# n8n Integration Testing & Troubleshooting — Poke Pok

## Pre-Integration Checklist

Before wiring the workflows together, verify:

- [ ] KPSULA backend está corriendo en VPS: `https://pokepok.kpsula.app`
- [ ] Tenant "pokepok" existe con flag `deliveryOps: true`
- [ ] API Key generada en dashboard → Config
- [ ] `DELIVERY_WEBHOOK_SECRET` está en `.env` del VPS
- [ ] Todas las migraciones aplicadas: `npx prisma migrate status` → "up to date"
- [ ] n8n está accesible (local o cloud)
- [ ] Bot demo de Telegram creado (BotFather)
- [ ] OpenAI API key disponible

---

## Phase 1: Test Individual Workflows

### Workflow 1 — Bot Telegram + Crear Orden

**Setup:**
1. Importar `n8n-workflow-1-bot-telegram.json`
2. Editar nodo "Set Config":
   - `KPSULA_HOST`: `https://pokepok.kpsula.app`
   - `KPSULA_API_KEY`: (del dashboard)
   - `TELEGRAM_BOT_TOKEN`: (del BotFather)
   - `OPENAI_API_KEY`: (del API OpenAI)
3. Activate workflow

**Test Case 1a: Mensaje conversacional**
```
User sends: "Hola, ¿qué sedes tienen?"
Expected:
  - Agent fetches /contexto → lista de sedes
  - Bot responde con sedes disponibles
  - orden_id NO se guarda (no hay [CREAR_ORDEN])
```

**Test Case 1b: Crear orden**
```
User sends: "Quiero una orden. Dirección: Av. Principal 123, Teléfono: 04121234567, Nombre: Juan, Items: 2x Poke Bowl a $5 c/u"
Expected:
  - Agent genera respuesta con [CREAR_ORDEN]
  - Workflow 1 extrae: direccion, telefono, nombre, items
  - POST /ordenes crea orden
  - Response includes: orden.correlativo, orden.id
  - orden_id se guarda en sesión n8n
  - Bot responde: "✅ Orden creada! Correlativo: PP-0001"
```

**Validation:**
- [ ] Check dashboard → Tablero: orden aparece en estado ESPERANDO_PAGO
- [ ] orden.correlativo matches la respuesta del bot

---

### Workflow 2 — Comprobante Handler

**Setup:**
1. Importar `n8n-workflow-2-comprobante.json`
2. Editar nodo "Set Config":
   - `KPSULA_API_KEY`: mismo que Workflow 1
   - `TELEGRAM_BOT_TOKEN`: mismo que Workflow 1
3. Activate workflow

**Test Case 2a: Foto sin orden activa**
```
User sends: imagen (sin previa orden creada)
Expected:
  - Workflow 2 intenta cargar orden_id → no existe en sesión
  - Error: "No hay orden activa"
  - Bot responde: "❌ Error: No tienes una orden activa"
```

**Test Case 2b: Foto con orden activa**
```
Prerequisito: Ejecutar Test Case 1b primero
User sends: foto del comprobante
Expected:
  - Workflow 2 carga orden_id de sesión (PP-0001)
  - Descarga imagen de Telegram
  - POST /ordenes/{id}/comprobante con multipart
  - Backend sube archivo a storage/uploads/<tenantId>/delivery-comprobantes/
  - orden transiciona a estado PAGO_POR_VALIDAR
  - Bot responde: "✅ Comprobante recibido!"
```

**Validation:**
- [ ] Check dashboard → Tablero: orden ahora está en PAGO_POR_VALIDAR
- [ ] Storage: archivo debe existir en `/var/www/capsula-erp/storage/uploads/<tenant-id>/delivery-comprobantes/`

---

### Workflow 3 — Webhook Listener

**Setup:**
1. Importar `n8n-workflow-3-webhook-listener.json`
2. Copiar URL pública del webhook (desde nodo "Webhook Listener")
3. En dashboard delivery → Config:
   - Agregar `webhookUrl`: (URL pública del webhook)
4. En VPS `/var/www/capsula-erp/.env`:
   - Agregar `DELIVERY_WEBHOOK_SECRET`: (mismo valor que en Workflow 1 "Set Config")
5. Activate workflow

**Test Case 3a: Validar firma HMAC**
```
Simular webhook con firma inválida:
curl -X POST "http://n8n.local:5678/webhook/poke-pok-webhook" \
  -H "Content-Type: application/json" \
  -H "X-Kpsula-Signature: invalid-sig" \
  -d '{"event": {"type": "orden.en_cocina"}, "order": {"chat_id": 123456}}'

Expected:
  - Workflow 3 rechaza: "Invalid signature"
  - No se envía mensaje a Telegram
```

**Test Case 3b: Evento válido**
```
Prerequisito: Completar Test Case 2b
Desde dashboard → Tablero:
  Admin hace click "Validar pago" en orden PP-0001
Expected:
  - Backend transitiona orden a EN_COCINA
  - Cron entrega webhook a Workflow 3
  - HMAC validado exitosamente
  - Workflow 3 envía mensaje Telegram: "🍳 Tu orden está en cocina!"
  - orden.chat_id resuelve al chat_id original del usuario
```

**Validation:**
- [ ] Bot responde al usuario con mensaje de evento
- [ ] Dashboard: orden está EN_COCINA
- [ ] Workflow 3 logs muestran exécución exitosa

---

## Phase 2: End-to-End Integration

**Complete flow (simular orden completa):**

1. **Usuario inicia conversación:**
   ```
   User → Telegram: "Quiero pedir una orden de Poke"
   Bot ← Workflow 1: lista sedes y precios
   ```

2. **Usuario especifica orden:**
   ```
   User → Telegram: "Dirección: Calle 1, Teléfono: 04121234567, Nombre: Ana, Items: 1x Poke Bowl"
   Bot ← Workflow 1: "✅ Orden creada! Correlativo: PP-0001. Envía foto del comprobante."
   ```

3. **Usuario sube comprobante:**
   ```
   User → Telegram: [foto del pago]
   Bot ← Workflow 2: "✅ Comprobante recibido! Tu orden está en validación."
   ```

4. **Admin valida en dashboard:**
   ```
   Admin: clicks "Validar pago" en orden PP-0001
   Backend: transiciona a EN_COCINA
   Cron: ejecuta /api/cron/deliver-webhooks
   Webhook: POST a Workflow 3
   Bot ← Workflow 3: "🍳 Tu orden está en cocina!"
   User: recibe mensaje
   ```

5. **Cocina marca como lista:**
   ```
   Admin: clicks "Marcar como lista" en orden PP-0001
   Backend: transiciona a LISTA
   Webhook: POST a Workflow 3
   Bot ← Workflow 3: "✅ Tu orden está LISTA!"
   ```

6. **Admin asigna motorizado:**
   ```
   Admin: selecciona motorizado en estado LISTA
   Backend: transiciona a EN_CAMINO
   Webhook: POST a Workflow 3
   Bot ← Workflow 3: "🚗 Tu orden está EN CAMINO!"
   ```

7. **Motorizado entrega:**
   ```
   Admin: clicks "Marcar como entregada"
   Backend: transiciona a ENTREGADA
   Webhook: POST a Workflow 3
   Bot ← Workflow 3: "🎉 ¡Tu orden fue ENTREGADA!"
   User: fin de conversación
   ```

**Success Criteria:**
- [ ] Cada transición genera webhook
- [ ] Workflow 3 valida HMAC correctamente
- [ ] Usuario recibe 4 notificaciones (en_cocina, lista, en_camino, entregada)
- [ ] Dashboard muestra orden en ENTREGADA
- [ ] Tiempos: del click admin al mensaje usuario < 2 seg

---

## Troubleshooting

### Error: "No se conecta a KPSULA"

**Síntoma:**
```
Error in HTTP Request node: connect ECONNREFUSED 127.0.0.1:3000
```

**Causas posibles:**
1. Backend no está corriendo en VPS
2. URL incorrecta en "Set Config" (localhost en vez de https://pokepok.kpsula.app)
3. API Key incorrecta o expirada

**Fix:**
```bash
# En VPS
curl -s https://pokepok.kpsula.app/api/v1/delivery/contexto \
  -H "X-API-Key: TU_API_KEY" | jq .

# Debe responder con sedes, agotados, tasa, etc.
```

---

### Error: "ordenId is null"

**Síntoma:**
```
"No hay orden activa para el chat 123456"
```

**Causas posibles:**
1. Usuario envía foto sin pasar por Workflow 1 primero
2. Sesión n8n fue borrada (timeout > 8 horas)
3. orden_id no se guardó correctamente en sesión

**Fix:**
1. Verificar que usuario ejecutó Workflow 1 primero (crear orden)
2. Chequear logs de Workflow 1 → nodo "Guardar orden_id en sesión":
   - Debe ejecutarse sin errores
   - `$setWorkflowData()` must complete
3. En n8n UI → Executions → revisar último run de Workflow 1

---

### Error: "Invalid signature"

**Síntoma:**
```
Error in Validar HMAC-SHA256: Invalid signature
```

**Causas posibles:**
1. `KPSULA_WEBHOOK_SECRET` diferente en VPS y en Workflow 3
2. Body no es JSON válido cuando se firma
3. Firma se calcula sobre body re-serializado (debe ser original)

**Fix:**
```bash
# En VPS, verificar que CRON_SECRET existe
grep CRON_SECRET /var/www/capsula-erp/.env

# Verificar que backend calcula HMAC correctamente
# Ver src/lib/delivery/webhook-sign.ts
```

---

### Error: "File not found" en Telegram

**Síntoma:**
```
Error downloading image: 404 Not Found
```

**Causas posibles:**
1. `TELEGRAM_BOT_TOKEN` incorrecto
2. `photoId` es inválido o expirado (>24 horas)
3. Telegram rateimit

**Fix:**
1. Test token manualmente:
   ```bash
   curl -s "https://api.telegram.org/botTU_TOKEN/getMe" | jq .
   ```
2. Foto debe ser reciente (misma sesión)

---

### Webhook no llega a n8n

**Síntoma:**
```
Dashboard: orden en EN_COCINA
Cron ejecutado correctamente
Pero Workflow 3 nunca ejecuta
```

**Causas posibles:**
1. Webhook URL no es accesible desde VPS
2. n8n webhook trigger está desactivo
3. Firewall bloquea conexión saliente desde VPS

**Fix:**
```bash
# En VPS, test manual
curl -X POST "http://n8n.local:5678/webhook/poke-pok-webhook" \
  -H "Content-Type: application/json" \
  -d '{"event": {"type": "test"}, "order": {"chat_id": 123}}'

# Debe responder con 200 OK

# Ver logs del cron
tail -f /var/log/syslog | grep "deliver-webhooks"
```

---

### Múltiples notificaciones al usuario

**Síntoma:**
```
Usuario recibe 2-3 mensajes Telegram por mismo evento
```

**Causas posibles:**
1. Webhook se entrega 2 veces (retry del cron)
2. Workflow 3 ejecuta sin error pero también sin stop

**Fix:**
1. En Workflow 3, asegurar que cada rama (notify-*) "responds" sin continuar
2. Cron debe tener de-duplication: en `/api/cron/deliver-webhooks`, usar `{ status: 'PENDING' }` query y update a 'SENT' antes de responder

---

## Logs & Debugging

### n8n Logs

```bash
# Docker
docker logs n8n-container -f

# Systemd
journalctl -u n8n -f

# Local dev
npm run dev (ve en console)
```

### VPS Cron Logs

```bash
# systemd timer
journalctl -u capsula-delivery-webhook.service -f

# crontab
grep deliver-webhooks /var/log/syslog
```

### KPSULA Backend Logs

```bash
cd /var/www/capsula-erp
tail -f logs/app.log
tail -f logs/webhook.log (si existe)
```

### Database Inspection

```bash
# En VPS
psql $DATABASE_URL

# Revisar órdenes
SELECT correlativo, status, created_at FROM "DeliveryOrder" WHERE "tenantId" = '<tenant-id>' LIMIT 5;

# Revisar webhooks pendientes
SELECT event_type, order_id, status FROM "DeliveryWebhookOutbox" WHERE status = 'PENDING' LIMIT 5;
```

---

## Performance Benchmarks

**Target metrics:**
- Crear orden: < 500ms (POST /ordenes)
- Validar comprobante: < 1s (Telegram download + POST /ordenes/{id}/comprobante)
- Entregar webhook: < 500ms (cron → n8n → Telegram)
- Total (click a mensaje usuario): < 2 seg

**Monitor:**
```bash
# En VPS, agregar timing logs en src/app/api/v1/delivery/ordenes/route.ts
console.time('create-order');
// ... logic
console.timeEnd('create-order');
```

---

## Rollback Plan

Si algo falla en producción:

1. **Deshabilitar Workflow 3 (webhook listener):**
   - n8n UI → Workflow 3 → Deactivate
   - Órdenes no se notifican, pero no fallan

2. **Deshabilitar cron:**
   ```bash
   systemctl stop capsula-delivery-webhook.timer
   # o
   crontab -e → comentar línea deliver-webhooks
   ```

3. **Revisar BD:**
   ```bash
   # Ver órdenes en estado PAGO_POR_VALIDAR (posible issue)
   SELECT * FROM "DeliveryOrder" WHERE status = 'PAGO_POR_VALIDAR' LIMIT 10;
   ```

4. **Revertir cambios:**
   ```bash
   git revert <commit-hash>
   npm run build
   npm run start
   ```

---

## Checklist Final Pre-Producción

- [ ] Todos los workflows importados y testeados
- [ ] Valores de "Set Config" son reales (no placeholders)
- [ ] CRON_SECRET está en VPS .env
- [ ] Webhook URL configurada en dashboard → Config
- [ ] Cron job está activo (systemd timer o crontab)
- [ ] Todas las migraciones aplicadas
- [ ] Base de datos tiene espacio libre (> 5GB)
- [ ] n8n está en plan pagado o funciona con workaround gratuito
- [ ] Backups de BD configurados
- [ ] Monitoreo de errores activo (Sentry, LogRocket, etc.)
- [ ] Documentación actualizada para el equipo

---

## Soporte

Si todo falla:

1. Revisar logs en orden: n8n → VPS backend → PostgreSQL
2. Hacer test manual de cada componente (curl /contexto, POST /ordenes, etc.)
3. Validar firmas HMAC manualmente
4. Resetear workflows desde JSON en repo (no confiar en UI exports)
5. Contactar a soporte n8n si hay issue con Variables (si upgradearon a plan pagado)
