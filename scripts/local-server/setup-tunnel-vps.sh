#!/usr/bin/env bash
# ============================================================================
# Túnel SSH reverso permanente: servidor local → VPS (lado VPS).
#
# Correr EN EL VPS como root, con las dos llaves públicas que imprimió
# setup-tunnel-local.sh:
#
#   bash setup-tunnel-vps.sh '<pubkey-tunel>' '<pubkey-backup>'
#
# Qué hace:
#   1. Crea el usuario restringido `capsula-tunnel` (sin shell útil).
#   2. Registra la llave del túnel SOLO para port-forwarding a 127.0.0.1:3210.
#   3. Registra la llave de backup con forced-command que recibe dumps
#      por stdin y los guarda en /var/lib/postgresql/backups/local-server/.
#   4. Crea el snippet de nginx para rutear kpsula.app al túnel, y los
#      helpers capsula-route-local.sh / capsula-route-vps.sh para cambiar
#      de upstream en segundos (cutover y contingencia).
#
# ⚠️ Este script NO toca el sitio nginx activo. El cutover es manual y está
#    documentado en docs/LOCAL_SERVER.md (sección "Cutover").
# ============================================================================
set -euo pipefail

TUNNEL_PUBKEY="${1:?Falta pubkey del túnel (argumento 1)}"
BACKUP_PUBKEY="${2:?Falta pubkey de backup (argumento 2)}"
TUNNEL_USER="capsula-tunnel"
BACKUP_DIR="/var/lib/postgresql/backups/local-server"
SNIPPET="/etc/nginx/snippets/capsula-proxy-target.conf"

[ "$(id -u)" -eq 0 ] || { echo "ERROR: correr como root"; exit 1; }

# 1. Usuario restringido. Shell /bin/sh (NO nologin): sshd ejecuta las
#    forced commands vía el shell del usuario — con nologin el receptor de
#    backups muere con "This account is currently not available". El acceso
#    real lo limitan las opciones de authorized_keys (command= en ambas
#    llaves), no el shell.
id "$TUNNEL_USER" >/dev/null 2>&1 \
    || useradd -m -s /bin/sh "$TUNNEL_USER"
usermod -s /bin/sh "$TUNNEL_USER"

# 2. Receptor de backups (forced command: escribe stdin a archivo con timestamp)
cat > /usr/local/bin/capsula-receive-backup.sh <<EOF
#!/usr/bin/env bash
# Forced command de la llave capsula-backup: recibe un pg_dump -Fc por stdin.
set -euo pipefail
DIR="$BACKUP_DIR"
mkdir -p "\$DIR"
OUT="\$DIR/capsula-local-\$(date +%Y%m%d-%H%M%S).dump"
cat > "\$OUT"
# Retención: 30 días (mismo criterio que los backups del VPS)
find "\$DIR" -name 'capsula-local-*.dump' -mtime +30 -delete
echo "OK \$OUT (\$(du -h "\$OUT" | cut -f1))"
EOF
chmod 755 /usr/local/bin/capsula-receive-backup.sh
mkdir -p "$BACKUP_DIR"
chown "$TUNNEL_USER" "$BACKUP_DIR"

# 3. authorized_keys: túnel solo puede abrir 127.0.0.1:3210; backup solo
#    puede ejecutar el receptor. Nada más.
AK_DIR="/home/$TUNNEL_USER/.ssh"
mkdir -p "$AK_DIR"
cat > "$AK_DIR/authorized_keys" <<EOF
restrict,command="/bin/false",port-forwarding,permitlisten="127.0.0.1:3210" $TUNNEL_PUBKEY
restrict,command="/usr/local/bin/capsula-receive-backup.sh" $BACKUP_PUBKEY
EOF
chmod 700 "$AK_DIR"
chmod 600 "$AK_DIR/authorized_keys"
chown -R "$TUNNEL_USER:$TUNNEL_USER" "$AK_DIR"

# 4. Snippet de nginx + helpers de ruteo
[ -f "$SNIPPET" ] || cat > "$SNIPPET" <<'EOF'
# Destino actual de kpsula.app. Cambiar con capsula-route-local.sh /
# capsula-route-vps.sh — NO editar el sitio principal.
proxy_pass http://127.0.0.1:3000;
EOF

cat > /usr/local/bin/capsula-route-local.sh <<'EOF'
#!/usr/bin/env bash
# kpsula.app → SERVIDOR LOCAL del restaurante (vía túnel :3210)
set -euo pipefail
echo 'proxy_pass http://127.0.0.1:3210;' > /etc/nginx/snippets/capsula-proxy-target.conf
sed -i '1i # Destino actual de kpsula.app. Cambiar con capsula-route-*.sh' /etc/nginx/snippets/capsula-proxy-target.conf
nginx -t && systemctl reload nginx
echo "kpsula.app ahora sirve desde el SERVIDOR LOCAL (túnel :3210)"
EOF

cat > /usr/local/bin/capsula-route-vps.sh <<'EOF'
#!/usr/bin/env bash
# kpsula.app → stack del VPS (contingencia, :3000)
set -euo pipefail
echo 'proxy_pass http://127.0.0.1:3000;' > /etc/nginx/snippets/capsula-proxy-target.conf
sed -i '1i # Destino actual de kpsula.app. Cambiar con capsula-route-*.sh' /etc/nginx/snippets/capsula-proxy-target.conf
nginx -t && systemctl reload nginx
echo "⚠️  kpsula.app ahora sirve desde el VPS. La BD del VPS puede estar"
echo "    desactualizada — ver 'Contingencia' en docs/LOCAL_SERVER.md antes"
echo "    de cobrar nada contra este stack."
EOF
chmod 755 /usr/local/bin/capsula-route-local.sh /usr/local/bin/capsula-route-vps.sh

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✅ VPS listo para recibir el túnel y los backups."
echo ""
echo "  ÚNICO paso manual pendiente (una sola vez): en el server block de"
echo "  kpsula.app (/etc/nginx/sites-*/...), reemplazar la línea"
echo "      proxy_pass http://localhost:3000;"
echo "  por"
echo "      include snippets/capsula-proxy-target.conf;"
echo "  y correr: nginx -t && systemctl reload nginx"
echo ""
echo "  Después el cutover es:   capsula-route-local.sh"
echo "  Y la vuelta atrás:       capsula-route-vps.sh"
echo "═══════════════════════════════════════════════════════════════"
