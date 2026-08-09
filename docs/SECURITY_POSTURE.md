# Estado de seguridad — Capsula / Shanklish

> **Auditoría de situación al 2026-07-25**, revisada el 2026-07-27 con
> verificación de bindings reales (§1). Solo análisis: nada de lo aquí descrito
> se ha modificado todavía.
> Este documento **no contiene secretos**; nombra dónde viven, nunca su valor.

---

## Resumen ejecutivo

La pieza nueva —el servidor del restaurante— es **la mejor protegida de toda
la plataforma**: sin puertos abiertos a internet, firewall activo, parches
automáticos y llaves SSH restringidas.

El riesgo principal es que el **repositorio es público**. En el **VPS** —que
además de kpsula.app aloja varios proyectos— la superficie real resultó **menor
de lo que sugerían las reglas del firewall**: se verificó que los servicios
sensibles escuchan solo en `localhost` (ver §1). Lo que sí queda pendiente ahí
es el SSH con autenticación por contraseña.

| Ámbito | Estado |
|---|---|
| Servidor local (Shanklish) | 🟢 Bien |
| Túnel local ↔ VPS | 🟢 Bien diseñado |
| Aplicación (sesiones, PINs, multi-tenant) | 🟡 Correcto con una salvedad grave |
| Red del restaurante | 🟡 Tráfico en claro dentro de la LAN |
| **VPS** | 🟠 **SSH con contraseña** (los puertos que parecían abiertos escuchan solo en localhost — verificado) |
| **Repositorio público** | 🔴 **Código y detalles de infraestructura visibles** |

---

## 1. 🟠 VPS — reglas de firewall innecesarias (verificado: sin exposición real)

> **Corrección del 2026-07-27.** La primera versión de este documento marcó
> `5432` y `11434` como críticos leyendo **solo** `ufw status`. La verificación
> del *binding* real (`ss -tlnp`) demostró que **no hay exposición**: los
> servicios escuchan en `localhost`. Regla aprendida: **una regla de firewall
> abierta no implica un servicio expuesto — hay que mirar la dirección de
> escucha, no solo el puerto.**

Estado verificado con `ss -tlnp`:

| Puerto | Escucha en | Servicio | Riesgo real |
|---|---|---|---|
| 5432/tcp | `127.0.0.1` y `[::1]` | PostgreSQL | 🟢 **Inalcanzable desde fuera.** La regla ufw sobra |
| 11434/tcp | — (no escucha) | Ollama | 🟢 No está corriendo. La regla sobra |
| 8080/tcp | `127.0.0.1` | docker-proxy | 🟢 Solo local. La regla sobra |
| 8501/tcp | `127.0.0.1` | docker-proxy | 🟢 Solo local. La regla sobra |
| **22/tcp** | público | SSH | 🟠 **Riesgo real:** autenticación por contraseña, fail2ban acumula **2.856 baneos** — bajo ataque permanente |
| 60000-61000/udp | público | mosh | 🟢 Aceptable |
| 80, 443 | público | nginx | 🟢 Esperado |

**Qué queda por hacer, y por qué:** las reglas de 5432/11434/8080/8501 pueden
retirarse como **defensa en profundidad** — hoy no exponen nada, pero si alguno
de esos servicios se reconfigurara mañana para escuchar en `0.0.0.0`, el
firewall lo dejaría pasar sin que nadie lo note. Retirarlas es higiene, no
urgencia.

**La prioridad real del VPS es el SSH con contraseña** (sección 7, P1).

Además corre **mailcow** (servidor de correo), que añade su propia superficie
e interviene el firewall con su propia cadena de iptables.

**Por qué importa para Shanklish:** el VPS es la puerta pública de kpsula.app y
recibe los backups del restaurante. Un compromiso ahí expone las copias de la
base de datos y permite manipular a quién sirve kpsula.app.

## 2. 🔴 Repositorio público

Verificado: `capsula-erp` es **público**. Consecuencias medidas:

**a) Secreto de sesión con valor por defecto conocido.**
`src/lib/auth.ts` define un `FALLBACK_SECRET` en el código. Si algún despliegue
arranca **sin** `JWT_SECRET` o con uno de menos de 32 caracteres, las sesiones
se firman con un secreto **que cualquiera puede leer en GitHub** → se pueden
**falsificar sesiones de administrador**. Hoy el VPS y el local tienen secretos
fuertes (verificado por huella), así que **no hay exposición activa**; el
peligro es el patrón: un despliegue futuro mal configurado no falla, degrada en
silencio.

**b) `.env.copy` versionado** con una cadena de conexión antigua a Google Cloud
SQL. Está en `.gitignore` (línea 59) pero fue commiteado antes, así que **sigue
en el repositorio y en el historial**. La instancia parece muerta, pero la
credencial es pública y podría estar reutilizada.

**c) Detalles de infraestructura** en 5 documentos markdown: IP del VPS, IP y
MAC del servidor local, rutas, puertos del túnel, diseño de la contingencia.
Es un mapa útil para un atacante. *(Parte de esta información la añadimos al
documentar el despliegue — asumiendo un repositorio privado.)*

**Verificado como correcto:** nunca se commiteó un `.env` real, no hay
contraseñas ni tokens embebidos en `src/`.

### ➜ Sí, el repositorio debería ser privado

Es la acción de mayor impacto y menor esfuerzo. Con el repo privado, (b) y (c)
dejan de ser exposición pública, y el código del negocio deja de ser legible
por terceros.

**Al hacerlo, el servidor local pierde el acceso anónimo** que usa hoy para
clonar/actualizar. Ya está preparada la solución: hay una llave de solo lectura
generada en `/root/.ssh/github-deploy` — falta **registrarla** en
*Settings → Deploy keys* (sin permiso de escritura) y apuntar el remoto a SSH:

```bash
git -C /var/www/capsula-erp remote set-url origin git@github.com:Juninho2604/capsula-erp.git
git -C /var/www/capsula-erp fetch origin   # debe funcionar sin pedir nada
```

El VPS necesita el mismo tratamiento (su deploy CI clona el repo).

## 3. 🟡 Red del restaurante — tráfico en claro

Las tablets y cajas hablan con el servidor por **HTTP sin cifrar**. Dentro de
la LAN, cualquiera con acceso al WiFi puede, con herramientas comunes:

- Leer las **cookies de sesión** y suplantar a una cajera o a un administrador.
- Ver y alterar el tráfico del POS.

El vector realista no es un hacker externo: es **el WiFi del local**. Si
clientes o personal usan la misma red que el POS, la exposición es real.

Mitigaciones, de menor a mayor esfuerzo:

1. **Separar redes** — SSID/VLAN exclusiva para POS e impresoras, distinta de
   la de invitados. Es la medida con mejor relación esfuerzo/beneficio.
2. **Contraseña WPA2/WPA3 fuerte** en la red del POS, no compartida con nadie.
3. **HTTPS interno** (sección 8) — resuelve el cifrado *y* devuelve las APIs de
   navegador que perdimos.

## 4. 🟢 Servidor local — bien protegido

| Control | Estado |
|---|---|
| Firewall (ufw) | Activo: solo SSH y `:80`, alcanzables únicamente desde la LAN |
| Exposición a internet | **Ninguna.** Sin puertos abiertos en el router; el túnel es **saliente** |
| PostgreSQL | Escucha solo en `localhost` — inalcanzable desde la red |
| fail2ban | Activo (jail sshd) |
| Parches de seguridad | `unattended-upgrades` automático, sin reinicios |
| Usuarios | Uno solo (`kpsula`); root sin contraseña, acceso vía sudo |
| Disco | SMART `PASSED`, prácticamente nuevo |

**Puntos a mejorar:** el acceso SSH es por contraseña (mejor llaves), y el
disco **no está cifrado** — si roban el equipo, la base de datos es legible.

## 5. 🟢 Túnel — diseño correcto

La llave del túnel tiene `restrict`, `command="/bin/false"` y `permitlisten`
limitado a dos puertos: **no puede ejecutar nada** en el VPS. La llave de
backup solo puede correr el receptor de dumps. Ninguna otorga shell.

**Mejora pendiente:** los dumps viajan cifrados por SSH, pero **se guardan sin
cifrar** en el VPS. Quien comprometa el VPS obtiene la base de datos completa
del restaurante (clientes, teléfonos, ventas). → cifrar en origen.

## 6. 🟡 Aplicación

**Correcto:** contraseñas y PINs con PBKDF2-SHA256 · JWT con versión revocable
(`tokenVersion`) · cookies `httpOnly` · guardia anti cross-tenant en el
middleware · aislamiento por tenant en las consultas · `print-agent` con API key.

**A vigilar:**

- `MULTI_TENANT_STRICT` no está activo. Con un solo tenant es inocuo (hay
  fallback a Shanklish), pero **debe activarse antes de onboardear el segundo**
  o una resolución fallida podría servir datos del tenant equivocado.
- `COOKIE_SECURE=false` es correcto para la LAN, pero **jamás debe aparecer en
  el `.env` del VPS**. Conviene una verificación automática en el deploy.
- Sesiones de 24 h sin caducidad por inactividad: una tablet olvidada queda
  operativa. Considerar bloqueo por PIN tras N minutos ociosos.

## 7. Plan recomendado, por prioridad

### P0 — esta semana

1. ~~Cerrar PostgreSQL del VPS a internet.~~ **Verificado: no estaba
   expuesto** (escucha en localhost). Retirar la regla ufw sigue siendo buena
   higiene, pero baja a P2.
2. ~~Cerrar Ollama (11434).~~ **No está corriendo.** Ídem.
3. **Repositorio a privado** + registrar la deploy key en el servidor local y
   en el VPS (sección 2).
4. **Eliminar `.env.copy` del repositorio** y rotar cualquier credencial suya
   que siga viva.

### P1 — este mes

5. **SSH del VPS solo con llaves** (`PasswordAuthentication no`) — deja sin
   efecto la fuerza bruta que hoy llena fail2ban. Probar el acceso por llave
   **antes** de desactivar la contraseña, y tener a mano la consola de Contabo.
6. **Whitelist en fail2ban** de la IP del restaurante y de la oficina, para que
   un dedo torpe no deje a nadie fuera en plena operación.
7. **Segmentar el WiFi** del local (POS separado de invitados).
8. **Cifrar los backups** antes de enviarlos al VPS (`gpg -c` o `age` en
   `push-backup-to-vps.sh`), guardando la clave fuera del VPS.
9. **Identificar y cerrar** los puertos 8080 y 8501, o ponerles autenticación.

### P2 — cuando haya calma

10. **HTTPS interno en la LAN** — un certificado propio instalado en tablets y
    cajas. Cifra el tráfico **y** recupera las APIs de navegador perdidas
    (`crypto.randomUUID`, portapapeles, notificaciones, instalación de PWA).
11. **Cifrado de disco** en el servidor local (requiere reinstalar, o cifrar
    solo el directorio de PostgreSQL).
12. **2FA en GitHub** y revisión periódica de deploy keys y colaboradores.
13. **Caducidad por inactividad** en sesiones del POS.
14. **Simulacro de restauración** documentado: probar que un dump del VPS
    levanta un sistema funcional (hoy nunca se ha ensayado en frío).

---

## 8. Sobre "aprovechar el disco de 250 GB" y el puente de datos

Hoy se usa una fracción mínima (la base pesa ~10 MB). Opciones reales, de
menor a mayor ambición — **ninguna implementada, todas viables**:

**A. Retención larga y recuperación a un punto en el tiempo.**
Activar archivado de WAL en el PostgreSQL local: permite restaurar la base
"tal como estaba a las 15:42 del martes", no solo al último dump de hace 6 h.
Es la mejora de seguridad de datos con mejor relación costo/beneficio y consume
disco, que es justo lo que sobra.

**B. Réplica de solo lectura en el VPS** ← *esto es el "puente" que intuías*.
Replicación lógica de PostgreSQL del local hacia el VPS, **en un solo sentido**.
El VPS tendría una copia **viva** (segundos de retraso) para reportes,
analítica o consultas del auditor, **sin poder escribir** — así que no hay
riesgo de split brain. Ventajas: si el equipo local muere, la pérdida de datos
es de segundos en vez de horas; y las consultas pesadas de reportería dejarían
de competir con el POS. Es la evolución natural de la arquitectura actual.

**C. Multi-tenant distribuido** (el modelo hacia el que ya está preparado el
diseño). Cuando exista un segundo cliente: nginx del VPS enruta **por
subdominio** — `shanklish.kpsula.app` → túnel al servidor local;
`otrocliente.kpsula.app` → app del VPS. Cada restaurante grande puede tener su
propio servidor local con el mismo kit de scripts. Requisito previo: activar
`MULTI_TENANT_STRICT`.

**D. El disco como espacio operativo:** históricos de inventario, respaldos de
las fotos/comprobantes, y capacidad para años de crecimiento sin tocar hardware.

> Recomendación de secuencia: **A** (bajo riesgo, alto valor) → **B** cuando se
> quiera el puente en vivo → **C** cuando llegue el segundo cliente.

---

## 9. Checklist: pasar el repositorio a privado sin romper nada

Hacer el repo privado **rompe tres cosas** que hoy clonan de forma anónima.
Preparar esto **ANTES** de cambiar la visibilidad:

| Qué se rompe | Dónde | Solución |
|---|---|---|
| `git clone/fetch` del servidor local | `/var/www/capsula-erp` | deploy key + remoto SSH |
| `git clone` del deploy | `scripts/deploy-vps.sh` en el VPS | resuelto: el CI **empaqueta y sube** el árbol; el VPS ya no clona |
| Descarga del script de deploy | `ci.yml` bajaba de `raw.githubusercontent.com` | resuelto: ahora se **sube** desde el runner vía `scp-action` |

> **El VPS ya no necesita deploy key.** El paso 2 de la lista de abajo quedó
> obsoleto: entre el 3 y el 8 de agosto de 2026 el deploy murió seis veces
> seguidas en `[2/9] Clone` con `git@github.com: Permission denied (publickey)`
> porque esa llave nunca se registró, y el CI igual reportaba verde el job de
> validación. Desde entonces el runner manda el código empaquetado
> (`capsula-src.tgz`) y `deploy-vps.sh` lo desempaqueta. El VPS no guarda
> ninguna credencial de GitHub. El `git clone` sigue existiendo como camino
> manual, sólo si se corre el script a mano desde el servidor con una llave
> propia.

### Orden de ejecución

**1. Deploy key en el SERVIDOR LOCAL** (la llave ya existe):
```bash
cat /root/.ssh/github-deploy.pub     # copiar la línea completa
```
GitHub → repo → *Settings* → *Deploy keys* → *Add deploy key* →
título `servidor-local-restaurante`, pegar, **sin** "Allow write access".

```bash
git -C /var/www/capsula-erp remote set-url origin git@github.com:Juninho2604/capsula-erp.git
git -C /var/www/capsula-erp fetch origin && echo "ACCESO OK"
```

**2. Deploy key en el VPS** — ~~crearla~~ **ya no hace falta**: el CI le manda
el código empaquetado (ver la nota de arriba). Sólo si alguna vez se quiere
correr `deploy-vps.sh` a mano desde el propio VPS:
```bash
ssh-keygen -t ed25519 -N '' -C 'vps-deploy' -f /root/.ssh/github-deploy
printf 'Host github.com\n  User git\n  IdentityFile /root/.ssh/github-deploy\n' >> /root/.ssh/config
cat /root/.ssh/github-deploy.pub
```
Registrarla igual (título `vps-produccion`, sin write access) y probar:
```bash
ssh -T git@github.com                # debe saludar por nombre de usuario
```

**3. Recién entonces**, cambiar la visibilidad a privado.

**4. Verificar** que el pipeline sigue vivo: hacer un merge cualquiera a `main`
y comprobar que el job **`Deploy to Contabo VPS`** termina en verde — no
alcanza con ver verde el job `Validate`, que corre antes y es el que engañó
durante la semana del 3 al 8 de agosto.

> Si algo falla tras el cambio, el remedio inmediato es volver el repo a
> público, corregir las llaves con calma, y repetir.
