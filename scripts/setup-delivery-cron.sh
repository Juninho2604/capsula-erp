#!/bin/bash

# Setup Delivery Cron Job
# ─────────────────────────────────────────────────────────────────────────
# Configura el cron job que entrega webhooks cada 30 segundos.
# Uso: bash scripts/setup-delivery-cron.sh
#
# Prerequisitos:
#  - /var/www/capsula-erp/.env con DELIVERY_WEBHOOK_SECRET
#  - /var/www/capsula-erp configurado con permisos de lectura

set -e

REPO_PATH="/var/www/capsula-erp"
SERVICE_NAME="capsula-delivery-webhook-cron"
CRON_SECRET=$(grep '^CRON_SECRET=' "$REPO_PATH/.env" 2>/dev/null | cut -d'=' -f2 || echo "CHANGE_ME_$(date +%s)")

if [ -z "$CRON_SECRET" ] || [ "$CRON_SECRET" = "CHANGE_ME_$(date +%s)" ]; then
    echo "⚠️  WARNING: CRON_SECRET no encontrado en .env"
    echo "   Agregá a $REPO_PATH/.env:"
    echo "   CRON_SECRET=$(openssl rand -base64 32)"
    echo ""
fi

echo "==========================================================="
echo " Configurando cron job de delivery webhooks"
echo "==========================================================="
echo ""

# Option 1: systemd timer (recomendado para VPS moderno)
if command -v systemctl &> /dev/null; then
    echo "✓ systemd detectado. Configurando timer..."

    cat > /etc/systemd/system/capsula-delivery-webhook.service << 'EOF'
[Unit]
Description=KPSULA Delivery Webhook Cron
After=network.target
Requires=capsula-delivery-webhook.timer

[Service]
Type=oneshot
ExecStart=/usr/bin/curl -s -X GET "http://127.0.0.1:3000/api/cron/deliver-webhooks" \
  -H "Authorization: Bearer %CRON_SECRET%" \
  -m 30 \
  -o /dev/null
StandardOutput=journal
StandardError=journal
EOF

    # Reemplazar placeholder
    sed -i "s|%CRON_SECRET%|$CRON_SECRET|g" /etc/systemd/system/capsula-delivery-webhook.service

    cat > /etc/systemd/system/capsula-delivery-webhook.timer << 'EOF'
[Unit]
Description=KPSULA Delivery Webhook Cron Timer
Requires=capsula-delivery-webhook.service

[Timer]
OnBootSec=10s
OnUnitActiveSec=30s
Persistent=true

[Install]
WantedBy=timers.target
EOF

    systemctl daemon-reload
    systemctl enable capsula-delivery-webhook.timer
    systemctl start capsula-delivery-webhook.timer

    echo "✓ Timer systemd instalado y activo"
    echo ""
    echo "   Ver status:"
    echo "   systemctl status capsula-delivery-webhook.timer"
    echo "   systemctl status capsula-delivery-webhook.service"
    echo ""
    echo "   Ver logs:"
    echo "   journalctl -u capsula-delivery-webhook.service -f"
    echo ""
else
    echo "⚠️  systemd no encontrado. Configurando con crontab..."

    # Option 2: crontab (fallback)
    CRONTAB_ENTRY="*/1 * * * * curl -s -X GET \"http://127.0.0.1:3000/api/cron/deliver-webhooks\" -H \"Authorization: Bearer $CRON_SECRET\" -m 30 > /dev/null 2>&1"
    CRONTAB_ENTRY2="*/1 * * * * sleep 30 && curl -s -X GET \"http://127.0.0.1:3000/api/cron/deliver-webhooks\" -H \"Authorization: Bearer $CRON_SECRET\" -m 30 > /dev/null 2>&1"

    (crontab -l 2>/dev/null | grep -v "deliver-webhooks" || true; echo "$CRONTAB_ENTRY"; echo "$CRONTAB_ENTRY2") | crontab -

    echo "✓ Cron entries agregados"
    echo ""
    echo "   Ver crontab:"
    echo "   crontab -l | grep deliver-webhooks"
    echo ""
fi

echo "==========================================================="
echo " Setup completado"
echo "==========================================================="
echo ""
echo "📝 PRÓXIMOS PASOS:"
echo ""
echo "1. En el VPS, agregar a /var/www/capsula-erp/.env:"
echo "   CRON_SECRET=$CRON_SECRET"
echo ""
echo "2. Reiniciar el backend (si es necesario):"
echo "   cd /var/www/capsula-erp && npm run start"
echo ""
echo "3. En n8n Workflow 3, configurar el webhook URL:"
echo "   POST http://<vps-ip>:3000/api/cron/deliver-webhooks"
echo "   (o si usan n8n cloud con tunel, usar https://n8n.kpsula.app/webhook/poke-pok-webhook)"
echo ""
echo "4. Verificar que los webhooks se entregan:"
echo "   curl -X POST http://127.0.0.1:3000/api/cron/deliver-webhooks \\\"
echo "     -H 'Authorization: Bearer $CRON_SECRET'"
echo ""
