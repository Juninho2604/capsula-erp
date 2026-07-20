#!/usr/bin/env bash
# ============================================================================
# Túnel SSH reverso permanente: servidor local → VPS (lado LOCAL).
#
# Deja un servicio systemd que mantiene 24/7:
#   VPS 127.0.0.1:3210  ──►  local 127.0.0.1:3000 (la app)
# Con eso, nginx del VPS puede servir kpsula.app DESDE el servidor local
# (una sola fuente de verdad, sin sincronización de BDs).
#
# Uso (como root, después de install-local-server.sh):
#   bash setup-tunnel-local.sh [vps_host]
#
# Genera dos llaves ed25519 y las imprime; hay que registrarlas en el VPS
# corriendo setup-tunnel-vps.sh con ambas públicas como argumentos.
# Runbook: docs/LOCAL_SERVER.md
# ============================================================================
set -euo pipefail

CONF_FILE="/etc/capsula-local.conf"
[ -f "$CONF_FILE" ] && source "$CONF_FILE"
VPS_HOST="${1:-${VPS_HOST:-147.93.6.70}}"
VPS_TUNNEL_USER="${VPS_TUNNEL_USER:-capsula-tunnel}"
TUNNEL_KEY="/root/.ssh/capsula-tunnel"
BACKUP_KEY="${BACKUP_KEY:-/root/.ssh/capsula-backup}"

[ "$(id -u)" -eq 0 ] || { echo "ERROR: correr como root"; exit 1; }

# 1. Llaves (una para el túnel, otra para empujar backups)
mkdir -p /root/.ssh && chmod 700 /root/.ssh
[ -f "$TUNNEL_KEY" ] || ssh-keygen -t ed25519 -N '' -C 'capsula-tunnel' -f "$TUNNEL_KEY"
[ -f "$BACKUP_KEY" ] || ssh-keygen -t ed25519 -N '' -C 'capsula-backup' -f "$BACKUP_KEY"

# 2. Servicio systemd del túnel
cat > /etc/systemd/system/capsula-tunnel.service <<EOF
[Unit]
Description=Tunel SSH reverso capsula-erp local -> VPS (kpsula.app)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/ssh -NT \\
    -o ServerAliveInterval=15 \\
    -o ServerAliveCountMax=3 \\
    -o ExitOnForwardFailure=yes \\
    -o StrictHostKeyChecking=accept-new \\
    -i $TUNNEL_KEY \\
    -R 127.0.0.1:3210:127.0.0.1:3000 \\
    $VPS_TUNNEL_USER@$VPS_HOST
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable capsula-tunnel.service

# 3. Persistir config
grep -q '^VPS_HOST=' "$CONF_FILE" 2>/dev/null \
    && sed -i "s|^VPS_HOST=.*|VPS_HOST=$VPS_HOST|" "$CONF_FILE" \
    || echo "VPS_HOST=$VPS_HOST" >> "$CONF_FILE"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Llaves generadas. AHORA, EN EL VPS, correr:"
echo ""
echo "  bash setup-tunnel-vps.sh \\"
echo "      '$(cat "$TUNNEL_KEY.pub")' \\"
echo "      '$(cat "$BACKUP_KEY.pub")'"
echo ""
echo "  Y cuando el VPS esté listo, acá:  systemctl start capsula-tunnel"
echo "  Verificar:                        systemctl status capsula-tunnel"
echo "═══════════════════════════════════════════════════════════════"
