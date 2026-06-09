# n8n + KPSULA Integration — Quick Start

## 🎯 What You Have

Complete **production-ready n8n integration** for the Poke Pok delivery bot:

| File | Purpose |
|------|---------|
| `n8n-setup-guide.md` | Detailed setup instructions (free tier workaround + upgrade path) |
| `n8n-workflow-1-bot-telegram.json` | Bot listens → AI Agent → Create order |
| `n8n-workflow-2-comprobante.json` | Photo proof → Upload → Validate payment |
| `n8n-workflow-3-webhook-listener.json` | Webhook → HMAC verify → Notify user |
| `scripts/setup-delivery-cron.sh` | VPS cron job setup (systemd timer or crontab) |
| `n8n-integration-testing.md` | Unit tests → E2E → Troubleshooting |

---

## ⚡ 5-Minute Setup (for testing)

### Prerequisites
- n8n running (self-hosted or cloud)
- VPS with KPSULA backend (`https://pokepok.kpsula.app`)
- Telegram bot token (BotFather)
- OpenAI API key

### Steps

**1. Gather credentials**
```bash
# From KPSULA dashboard → Settings → API Keys
KPSULA_API_KEY=sk_test_...

# From BotFather
TELEGRAM_BOT_TOKEN=123456:ABCDef...

# From OpenAI
OPENAI_API_KEY=sk-proj-...

# From VPS .env
grep DELIVERY_WEBHOOK_SECRET /var/www/capsula-erp/.env
```

**2. Import Workflow 1 (Bot)**
- n8n UI → Workflows → Import from JSON
- Paste `docs/n8n-workflow-1-bot-telegram.json`
- Edit "Set Config" node → fill in the 4 credentials above
- Activate workflow
- Send a message to your Telegram bot — should respond

**3. Import Workflow 2 (Comprobante)**
- Repeat import with `docs/n8n-workflow-2-comprobante.json`
- Edit "Set Config" with same credentials
- Activate

**4. Import Workflow 3 (Webhook)**
- Repeat import with `docs/n8n-workflow-3-webhook-listener.json`
- Edit "Set Config" with same credentials
- Copy the Webhook URL from the trigger node
- Activate

**5. Configure webhook in KPSULA**
- Dashboard → Delivery → Settings → Webhook URL
- Paste the n8n webhook URL from step 4
- Save

**6. Enable VPS cron**
```bash
cd /var/www/capsula-erp
bash scripts/setup-delivery-cron.sh
```

**7. Test E2E**
- Send message to bot: "Quiero una orden"
- Bot responds with sedes
- You: "Dirección: Av Principal 123, Teléfono: 04121234567, Nombre: Test, Items: 1x Poke"
- Bot: "✅ Orden creada! Correlativo: PP-0001"
- Dashboard should show order in ESPERANDO_PAGO state

✅ Done! You have a working delivery bot.

---

## 🔐 Free Tier Issue (Solved)

**Problem:** n8n free tier doesn't support Environment Variables.

**Solution:** All workflows use "Set Config" code node instead. Credentials are stored locally in each workflow.

**When you upgrade to Pro/Enterprise:**
1. Create n8n Variables in UI (same names)
2. Replace "Set Config" node with:
   ```javascript
   return {
     config: {
       KPSULA_HOST: $env.KPSULA_HOST,
       KPSULA_API_KEY: $env.KPSULA_API_KEY,
       // ... etc
     }
   };
   ```

That's it. Your entire integration scales without touching code again.

---

## 📋 Complete Checklist

### Pre-Setup
- [ ] KPSULA backend running (`curl https://pokepok.kpsula.app/api/health`)
- [ ] Tenant pokepok exists with `deliveryOps: true` flag
- [ ] Database migrations applied (`npx prisma migrate status` → "up to date")
- [ ] All required APIs available (Telegram BotFather, OpenAI)

### Setup Phase 1: Workflows
- [ ] Workflow 1 imported, tested (bot responds)
- [ ] Workflow 2 imported, tested (photo handling)
- [ ] Workflow 3 imported, tested (webhook trigger accessible)
- [ ] All "Set Config" nodes have real credentials

### Setup Phase 2: VPS Integration
- [ ] `CRON_SECRET` added to VPS `.env`
- [ ] `DELIVERY_WEBHOOK_SECRET` in VPS `.env` (same value as Workflow 3)
- [ ] Cron script ran successfully (`bash scripts/setup-delivery-cron.sh`)
- [ ] Webhook URL configured in dashboard

### Testing Phase 1: Unit Tests
- [ ] Test 1a: Conversational message (no order)
- [ ] Test 1b: Create order (with [CREAR_ORDEN] marker)
- [ ] Test 2a: Photo without active order (error)
- [ ] Test 2b: Photo with active order (upload)
- [ ] Test 3a: Invalid HMAC signature (rejected)
- [ ] Test 3b: Valid event (notification sent)

### Testing Phase 2: E2E
- [ ] Full order flow: create → upload proof → validate → in kitchen → ready → en route → delivered
- [ ] All 4 notifications reach user
- [ ] Dashboard reflects correct order state at each step

### Pre-Production
- [ ] Sensitive credentials rotated (never use dev keys in prod)
- [ ] Backup strategy in place (database, n8n workflows exported)
- [ ] Monitoring configured (error alerts, webhook delivery logs)
- [ ] Load testing done (concurrent orders, rapid events)
- [ ] Rollback procedure documented

---

## 🚀 Integration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Telegram User                                                   │
└────────────────────────────────────────────────────────────────┘
                              │
                              ├─→ [MESSAGE]
                              │
                              └─→ [PHOTO]
                              │
                              └─→ [NOTIFICATION]
                                  (from VPS)

┌─────────────────────────────────────────────────────────────────┐
│ n8n Workflows (3 parallel)                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Workflow 1: Bot Trigger                                       │
│  ├─ Parse message                                              │
│  ├─ GET /contexto (sedes, agotados)                            │
│  ├─ Load session (previous orden_id)                           │
│  ├─ AI Agent (OpenAI)                                          │
│  ├─ IF [CREAR_ORDEN]: POST /ordenes → save orden_id           │
│  └─ Respond (correlativo or conversational)                    │
│                                                                 │
│  Workflow 2: Comprobante Handler                               │
│  ├─ Detect photo trigger                                       │
│  ├─ Load orden_id from session                                 │
│  ├─ Download image from Telegram                               │
│  ├─ POST /ordenes/{id}/comprobante (multipart)                │
│  └─ Respond "received for validation"                          │
│                                                                 │
│  Workflow 3: Webhook Listener                                  │
│  ├─ Webhook trigger (from VPS cron)                            │
│  ├─ Validate HMAC-SHA256                                       │
│  ├─ Switch by event type                                       │
│  ├─ notify-en-cocina / notify-lista / notify-en-camino / ...   │
│  └─ Send Telegram message to user                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↕
                        (HTTP Requests)
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│ KPSULA Backend (VPS: pokepok.kpsula.app)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  /api/v1/delivery/contexto                                    │
│  ├─ Returns: sedes, agotados, tasa, notas, reglas             │
│  └─ Auth: X-API-Key header                                     │
│                                                                 │
│  /api/v1/delivery/ordenes [POST]                              │
│  ├─ Create order (atomic correlative)                          │
│  ├─ Idempotent by channel+chatId                               │
│  └─ Returns: orden.id, orden.correlativo                       │
│                                                                 │
│  /api/v1/delivery/ordenes/{id}/comprobante [POST multipart]  │
│  ├─ Upload proof image                                         │
│  ├─ Transition to PAGO_POR_VALIDAR                             │
│  └─ Returns: success or error                                  │
│                                                                 │
│  /api/v1/delivery/ordenes/{id} [PATCH]                        │
│  ├─ Transition state (admin dashboard)                         │
│  ├─ Enqueue webhook event                                      │
│  └─ Returns: updated order                                     │
│                                                                 │
│  /api/cron/deliver-webhooks [GET]                             │
│  ├─ Called every 30s by VPS cron                               │
│  ├─ Fetch PENDING webhooks from outbox                         │
│  ├─ Sign with HMAC-SHA256                                      │
│  ├─ POST to n8n webhook URL                                    │
│  └─ Mark as SENT (with retry logic)                            │
│                                                                 │
│  Dashboard UI                                                   │
│  ├─ View orders by state (Kanban)                              │
│  ├─ Validate payment                                           │
│  ├─ Manage drivers                                             │
│  └─ Configure webhook URL & secrets                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↕
                         PostgreSQL
                              ↕
       [DeliveryOrder, DeliveryZone, DeliveryWebhookOutbox]
```

---

## 🔧 Common Configurations

### Use different AI provider (not OpenAI)

In Workflow 1, replace "AI Agent" node:
- **Anthropic Claude:** Use "Anthropic Claude" node (if available)
- **Google Gemini:** Use "Google Gemini" node
- **Local LLM:** Use HTTP Request to your LM Studio / Ollama

Just ensure the prompt injection (contexto) works the same way.

### Custom state machine

Edit `/src/lib/delivery/state-machine.ts`:
- Add/modify states
- Adjust transitions
- Update webhook event names

Then update Workflow 3 switch statement to match new events.

### Different payment provider

Instead of photo-based validation:
1. Remove Workflow 2
2. Integrate with Stripe / Mercado Pago / PayPal via API
3. POST to `/api/v1/delivery/ordenes/{id}` with state=PAGO_POR_VALIDAR directly

### Multi-language bot

In Workflow 1 "Set Config", add locale detection:
```javascript
const locale = msg.from.language_code; // 'es', 'en', etc.
config.LOCALE = locale;
```

Then in AI Agent system prompt, add: "Responde en idioma: {{ config.LOCALE }}"

---

## 📞 Support Matrix

| Issue | Check | Solution |
|-------|-------|----------|
| Bot doesn't respond | Telegram trigger node active? | n8n UI → Workflows → Activate |
| Order not created | API Key correct? | Test: `curl -H "X-API-Key: ..."` to /contexto |
| Photo upload fails | Telegram token valid? | Test in n8n: "GET File Info" node output |
| Webhook rejected | HMAC signature valid? | Check VPS env vars match between Workflow 3 and backend |
| Notifications not sent | Cron running? | `systemctl status capsula-delivery-webhook.timer` |
| Can't access webhook URL | Firewall blocking? | Whitelist n8n IP in VPS security group |

---

## 📚 Documentation Map

```
docs/
├── N8N_QUICKSTART.md ← You are here
├── n8n-setup-guide.md ← Detailed setup (free tier workaround)
├── n8n-integration-testing.md ← Testing checklist & troubleshooting
├── n8n-workflow-1-bot-telegram.json ← Import into n8n
├── n8n-workflow-2-comprobante.json ← Import into n8n
└── n8n-workflow-3-webhook-listener.json ← Import into n8n

scripts/
└── setup-delivery-cron.sh ← Run on VPS

src/
├── lib/delivery/ ← Core business logic
│  ├── state-machine.ts
│  ├── webhook-sign.ts
│  └── ...
├── app/api/v1/delivery/ ← REST endpoints
│  ├── contexto/
│  ├── ordenes/
│  └── ...
└── app/dashboard/delivery/ ← Admin UI
   ├── page.tsx
   └── sedes/

prisma/
└── migrations/ ← Database schema

.env ← DELIVERY_WEBHOOK_SECRET, CRON_SECRET
```

---

## ✅ Success = You Can...

- [ ] Send "Hola" to bot → get sedes list
- [ ] Create order with AI-driven flow → get correlativo
- [ ] Upload photo proof → marked PAGO_POR_VALIDAR
- [ ] Admin validates → bot notifies "en cocina"
- [ ] Admin marks ready → bot notifies "lista"
- [ ] Admin assigns driver → bot notifies "en camino"
- [ ] Admin marks delivered → bot notifies "entregada"
- [ ] See all orders in dashboard with correct states
- [ ] Export workflows from n8n → re-import in another n8n instance

---

## 🎓 Next Steps

1. **Immediate:** Follow 5-minute setup above
2. **Testing:** Run through n8n-integration-testing.md checklist
3. **Production:** Review CLAUDE.md security section + setup backups
4. **Enhancement:** Add payment provider integration (Stripe, etc.)
5. **Scaling:** If > 100 orders/day, consider:
   - n8n Pro plan with premium nodes
   - Dedicated PostgreSQL read replica
   - Redis for session caching
   - Webhook retry queue in separate service

---

**Ready? Start with n8n-setup-guide.md**
