# Guía de trabajo híbrido oficina ↔ casa — Proyecto Cápsula

> **Objetivo de este documento**: mover el desarrollo de Cápsula / Shanklish ERP
> a la PC de casa como **máquina primaria canónica**, sin perder el estado
> actual ni crear drift entre máquinas. Incluye transición gradual, SSH a
> Contabo desde casa, y reglas para trabajar híbrido mientras dure.

---

## 0. Snapshot del estado actual (2026-04-19)

**Fija este bloque en la mente antes de salir de la oficina. Si mañana
todo se borra y solo tienes este doc, puedes recuperar dónde estabas.**

- **Repo canónico:** `github.com/Juninho2604/capsula-erp` — branch `main`
- **HEAD:** `ec37b51` (docs(OPUS): update 19.11 + add 19.13...)
- **Repo legacy:** `github.com/Juninho2604/shanklish-erp-main` — master
  sigue sirviendo producción Shanklish Caracas en Vercel/AWS RDS
- **Safety tag:** `pre-cutover-2026-04-19` en `capsula-erp` (rollback
  disponible: `git push -f origin pre-cutover-2026-04-19:main`)
- **Último hito completado:** Fase 4 — Cutover repo
- **Decisión pendiente de ejecutar:** Interpretación B confirmada —
  próximos pasos son:
  1. Primer deploy del código consolidado a Contabo (dev/staging)
  2. Switch del proyecto Vercel de Shanklish Caracas de
     `shanklish-erp-main` → `capsula-erp` (unifica el trabajo doble)
- **Producción intocada:** Vercel + AWS RDS de Shanklish Caracas sigue
  100% operativa en `shanklish-erp-main/master`.
- **Contabo dev:** `147.93.6.70`, Ubuntu 24, `/var/www/capsula-erp`,
  Node 22, Postgres local (DB `capsula_db`), PM2.
- **BD backups:** `/var/backups/capsula/` en Contabo.

Archivos clave del contexto (su ubicación hoy):
- `OPUS_CONTEXT_CAPSULA.md` → dentro del repo `capsula-erp` (L1-L3899).
- `DIVERGENCE_REPORT.md` → **fuera del repo**, en
  `C:\Users\Usuario\capsula-migration\`. Hay que rescatarlo.
- `prompts/*.md` (9 archivos) → **fuera del repo**, en
  `C:\Users\Usuario\capsula-migration\prompts\`. Hay que rescatarlos.

---

## Parte 1 — Antes de salir de la oficina HOY

Haz estos 5 pasos antes de apagar la laptop de la oficina. Son
irreversibles en el sentido de que si no los haces hoy, mañana desde
casa te falta algo.

### 1.1 Confirmar que GitHub tiene todo

```powershell
cd C:\Users\Usuario\capsula-migration\shanklish-erp-main
git status
```

Debe decir: `On branch main`, `Your branch is up to date with 'origin/main'`,
`nothing to commit, working tree clean`.

Si hay cambios sin commitear → hacer commit + push antes de seguir.

### 1.2 Archivar `prompts/` y `DIVERGENCE_REPORT.md` dentro del repo

Estos archivos viven **fuera** del repo ahora mismo, pero son parte de la
historia del proyecto. Si no los commiteas, desde casa no los tendrás.

```powershell
# Crear carpeta de archivo dentro del repo
cd C:\Users\Usuario\capsula-migration\shanklish-erp-main
mkdir docs\consolidation-archive
mkdir docs\consolidation-archive\prompts

# Copiar los archivos
copy ..\DIVERGENCE_REPORT.md docs\consolidation-archive\DIVERGENCE_REPORT.md
copy ..\prompts\*.md docs\consolidation-archive\prompts\

# Commit
git add docs/consolidation-archive/
git commit -m "docs(archive): import DIVERGENCE_REPORT + prompts history"
git push origin main
```

Después de este paso, desde casa al clonar el repo tendrás toda la
historia de prompts y el diagnóstico original.

### 1.3 SSH a Contabo — generar key dedicada para casa

**Regla:** NO copies la private key de la oficina a la casa. Cada máquina
tiene su propia key. Más seguro y más fácil de revocar si un día pierdes
una de las dos máquinas.

**Desde la oficina** (la máquina que YA tiene acceso a Contabo):

```powershell
# Conéctate a Contabo como haces normalmente
ssh root@147.93.6.70
# (o el usuario que uses — cambia 'root' en todo el doc si es otro)
```

Una vez dentro de Contabo, NO hagas nada. Abre una segunda ventana de
PowerShell en la oficina. Desde ahí vamos a preparar un archivo para
llevarte a casa:

```powershell
# Este archivo lo vas a usar en la casa
notepad C:\Users\Usuario\capsula-migration\CASA_SETUP_INSTRUCCIONES.txt
```

Pega esto adentro y guarda:

```
SSH PARA CONTABO DESDE CASA

Paso 1 (en la PC de casa, una sola vez):
  ssh-keygen -t ed25519 -C "casa-omar-2026"
  # Acepta default location (~/.ssh/id_ed25519)
  # Passphrase: pon una (la vas a recordar o guardar en tu password manager)

Paso 2 (en la PC de casa):
  cat ~/.ssh/id_ed25519.pub
  # Copia el output ENTERO (empieza con "ssh-ed25519 AAAA...")

Paso 3 (desde casa, contáctame por WhatsApp/Telegram con el output del paso 2):
  Yo (Omar desde la oficina) agrego ese public key a Contabo así:

  ssh root@147.93.6.70
  echo "PEGAR_AQUI_EL_PUBLIC_KEY_DE_CASA" >> ~/.ssh/authorized_keys
  exit

Paso 4 (en la PC de casa, verificar):
  ssh root@147.93.6.70
  # Debe entrar sin pedir password (solo la passphrase de la key si la pusiste)
```

**Importante:** si no puedes enviarte el public key a ti mismo el día
que llegues a casa (sin internet, sin chat contigo mismo, etc.), hay
alternativa: lleva el public key en el archivo `CASA_SETUP_INSTRUCCIONES.txt`
que creamos arriba, copiado a un USB o email personal. **Nunca el
private key, solo el public.**

### 1.4 Credenciales y cuentas — checklist mental

Haz este inventario en tu cabeza antes de salir. Si algo falla en casa,
lo primero que te preguntarás es "¿tengo acceso a X?":

- [ ] **GitHub** (`Juninho2604`): password / passkey / 2FA method
      accesible desde casa
- [ ] **Vercel**: misma cuenta, misma 2FA, accesible
- [ ] **AWS Console** (si tienes que tocar RDS en emergencia): usuario
      + 2FA accesible
- [ ] **Password manager** (si usas uno) sincronizado
- [ ] **Contabo billing/panel** (si un día tienes que reiniciar el server
      desde la consola web)
- [ ] **Dominio / DNS** (si Shanklish Caracas tiene dominio propio que
      apunta a Vercel)

Los 2 primeros son críticos. Sin GitHub no puedes clonar el repo. Sin
Vercel no puedes ejecutar el switch de Fase 5.

### 1.5 Push final de este documento

Cuando termines de completar los pasos 1.1-1.4, este documento debe
viajar contigo también. Lo más seguro es commitearlo al repo:

```powershell
cd C:\Users\Usuario\capsula-migration\shanklish-erp-main
# Copia este archivo al repo
copy C:\Users\Usuario\Downloads\guia-trabajo-remoto.md docs\guia-trabajo-remoto.md
git add docs/guia-trabajo-remoto.md
git commit -m "docs: guia de trabajo hibrido oficina-casa"
git push origin main
```

Después de este push, desde casa al clonar tienes: código + OPUS +
prompts history + DIVERGENCE + esta guía. **Todo en un solo lugar.**

---

## Parte 2 — Setup inicial en casa (primera vez, ~45 min)

### 2.1 Verificar lo básico

```powershell
git --version       # debe ser >= 2.40
node --version      # debe ser v22.x
code --version      # VS Code instalado
claude --version    # Claude Code instalado
```

Si algo falla, instalar antes de seguir.

### 2.2 Configurar Git identity (una vez)

```powershell
git config --global user.name "Omar Juninho"
# (usa el mismo nombre que usas en commits de la oficina — chequea uno
#  reciente con `git log -1` si dudas)
git config --global user.email "TU_EMAIL_DE_GITHUB"
git config --global core.autocrlf true    # maneja LF/CRLF en Windows
```

### 2.3 Crear la estructura de carpetas

Réplica idéntica de la estructura en la oficina, para que todos los
paths absolutos de los prompts y del OPUS sean válidos sin cambios:

```powershell
# Usa la misma ruta que en la oficina para que los paths en los .md
# funcionen sin editar
mkdir C:\Users\Usuario\capsula-migration
cd C:\Users\Usuario\capsula-migration
```

Si tu usuario de Windows en casa NO es `Usuario`, considera dos opciones:
- **Opción recomendada**: crea un junction para fingir el path:
  ```powershell
  # Como administrador
  mklink /J C:\Users\Usuario C:\Users\<TU_USUARIO_REAL>
  ```
  Así los paths `C:\Users\Usuario\...` en los prompts siguen funcionando.
- **Opción alternativa**: usa tu usuario real y haz un find+replace en
  los prompts `.md` cuando los uses. Más trabajo manual.

### 2.4 Clonar el repo canónico

```powershell
cd C:\Users\Usuario\capsula-migration
git clone https://github.com/Juninho2604/capsula-erp.git
cd capsula-erp
git log --oneline -3
# Debes ver ec37b51 o más nuevo como HEAD
```

### 2.5 Recuperar los archivos archivados

Los prompts y el DIVERGENCE_REPORT están ahora dentro del repo (los
commiteaste en el paso 1.2). Para que los paths de los prompts viejos
sigan funcionando, réplica la estructura local externa:

```powershell
cd C:\Users\Usuario\capsula-migration

# Copiar DIVERGENCE_REPORT fuera del repo (como estaba en la oficina)
copy capsula-erp\docs\consolidation-archive\DIVERGENCE_REPORT.md .

# Crear prompts/ y poblarla
mkdir prompts
copy capsula-erp\docs\consolidation-archive\prompts\*.md prompts\
```

Verificación:
```powershell
dir C:\Users\Usuario\capsula-migration
# Debe mostrar: capsula-erp\, prompts\, DIVERGENCE_REPORT.md, CASA_SETUP_INSTRUCCIONES.txt
dir prompts
# Debe mostrar los 9+ prompts .md
```

### 2.6 Variables de entorno `.env`

Esto es delicado. Las `.env*` **NO están en git** (correcto, son secrets).
Necesitas recrearlas en casa.

```powershell
cd C:\Users\Usuario\capsula-migration\capsula-erp
# Revisar si existe .env.example como plantilla
dir .env*
```

Si hay un `.env.example`, úsalo como plantilla. Si no, crea tú mismo un
`.env` con al menos estas variables (los valores exactos los tienes en
tu password manager o en la oficina):

```
DATABASE_URL="..."             # AWS RDS conn string de Shanklish (o Postgres local si dev)
NEXTAUTH_SECRET="..."          # rotado 2026-04-19
JWT_SECRET="..."               # rotado 2026-04-19
# + cualquier otra variable que uses (NEXTAUTH_URL, etc.)
```

**Si no te llevaste los secrets de la oficina hoy**, los puedes obtener
en casa accediendo al dashboard de Vercel (Settings → Environment
Variables del proyecto de Shanklish Caracas). Solo los ves si tienes
2FA listo — por eso 1.4 arriba insistió en eso.

### 2.7 Instalar dependencias

```powershell
cd C:\Users\Usuario\capsula-migration\capsula-erp
npm ci
# ~1-2 min. Usa el package-lock.json exacto, NO `npm install`
```

Al terminar, validación rápida:
```powershell
npx tsc --noEmit
npm run test
# Debe pasar: tsc sin output (exit 0), 27/27 tests verdes
```

Si alguno falla, PARA y diagnostica antes de hacer cualquier otra cosa.
Probablemente sea un mismatch de versión de Node (chequea que sea 22,
no 18 ni 20).

### 2.8 Configurar SSH a Contabo

Sigue las instrucciones que preparaste en el paso 1.3 (archivo
`CASA_SETUP_INSTRUCCIONES.txt`):

1. Generar key par con `ssh-keygen -t ed25519`.
2. Obtener public key (`~/.ssh/id_ed25519.pub`).
3. Contactarte a ti mismo (desde oficina u otra vía) para autorizar esa
   key en Contabo via `~/.ssh/authorized_keys`.
4. Probar: `ssh root@147.93.6.70`. Debe entrar.

Si no puedes autorizar la key (ej. te vas el mismo día a casa y no
vuelves a la oficina antes), alternativa: **mete el public key manualmente
via el panel web de Contabo** (si tiene consola VNC o similar), o
haz la autorización vía un cliente que YA tenga acceso (tu teléfono con
Termux y la key vieja, por ejemplo). En el peor caso, queda para
resolver la primera hora en casa antes de empezar a codear.

### 2.9 Claude Code auth

```powershell
claude
# Primera vez te pide loguear. Usa la misma cuenta Anthropic que usas
# en la oficina. Si tienes Plan Max en la oficina, te funciona en casa
# con la misma cuenta.
```

Prueba rápida con el prompt trivial:
```
echo "hola"
```

Si responde, estás listo.

---

## Parte 3 — Flujo día a día híbrido

Mientras trabajes en ambas máquinas (oficina y casa en días distintos),
sigue estas 3 reglas SIN EXCEPCIÓN:

### 3.1 Regla de oro — GitHub es la fuente de verdad

Tu código **vive en GitHub, no en ninguna de tus dos máquinas.** Las
máquinas son clones locales efímeros. Si una de las dos se pierde o
se corrompe, el daño es cero mientras tengas lo que esté pusheado.

### 3.2 Secuencia al EMPEZAR cada sesión (en cualquier máquina)

```powershell
cd C:\Users\Usuario\capsula-migration\capsula-erp
git fetch origin
git status
git log --oneline -5
```

Antes de escribir UN SOLO caracter de código, confirma:
- Estás en `main`.
- `origin/main` no tiene commits más nuevos que tu HEAD (si los tiene,
  haz `git pull` antes de trabajar).
- Working tree limpio.

Si el `git pull` trae conflictos, significa que commiteaste en una máquina
y no pusheaste, o que las dos máquinas tienen trabajo divergente. Ver 3.4.

### 3.3 Secuencia al TERMINAR cada sesión

Nunca apagues una máquina con código sin commitear. Regla absoluta.

```powershell
git status
# Si hay cambios:
git add <archivos>
git commit -m "mensaje"
git push origin main
# Solo después de `git push` exitoso puedes apagar.
```

Si no vas a terminar la feature pero tienes código WIP, commitealo con
mensaje `wip: ...` y pushea igual. Más vale un commit feo que trabajo
perdido.

### 3.4 Qué NO hacer (errores que drenan horas)

- ❌ **Trabajar en la misma branch desde ambas máquinas sin push entre medio.**
      Resultado: conflictos de merge. Solución: SIEMPRE pull antes de trabajar,
      push al terminar.
- ❌ **Asumir que los `.env` de la oficina y casa están sincronizados.**
      No lo están. Si cambias una variable en una, apúntalo para replicarlo
      manualmente en la otra.
- ❌ **Commitear secrets por accidente.** `.gitignore` debe incluir `.env*`
      (revisa en 2.4 después de clonar).
- ❌ **Usar `git push -f` sin pensar.** En una branch compartida (aunque
      sea contigo mismo) puedes borrar commits. Si alguna vez necesitas
      force-push, primero haz un tag del estado actual como red de seguridad
      (igual que hicimos con `pre-cutover-2026-04-19`).
- ❌ **Editar `docs/consolidation-archive/prompts/*.md` directamente.**
      Esos son historia. Prompts nuevos van en `../prompts/` (fuera del
      repo) y después, si vale la pena archivarlos, se mueven a
      `docs/consolidation-archive/prompts/` con commit explícito.

---

## Parte 4 — Transición a casa como máquina primaria

Tu objetivo es que casa sea "el lugar del proyecto" en ~2 semanas.
Aquí está el path.

### 4.1 Semana 1 — Ambas activas, casa en prueba

- Trabajas principal en casa.
- Usas la oficina solo si algo falla en casa (SSH a Contabo cae, algún
  acceso se pierde, etc.).
- Al final de semana 1, haz este check: ¿hay algo que SOLO puedes hacer
  desde la oficina? Si sí, listarlo y resolverlo (suelen ser: VPN,
  certificados guardados solo ahí, acceso físico a un dispositivo).

### 4.2 Cuando estés 100% cómodo en casa

- **No archives ni apagues la oficina todavía.** Déjala como "backup
  vivo" durante 1 mes más.
- Después de 1 mes de operación estable en casa, puedes:
  - Limpiar `C:\Users\Usuario\capsula-migration` de la oficina (borra
    la carpeta — GitHub tiene todo).
  - Revocar la SSH key de la oficina en Contabo:
    ```bash
    # En Contabo
    ssh root@147.93.6.70
    nano ~/.ssh/authorized_keys
    # Borra la línea de la key de oficina (la vieja)
    # La de casa (casa-omar-2026) queda.
    ```
  - Loggear de GitHub/Vercel en la oficina (Settings → Applications →
    Revocar sesión de esa máquina).

### 4.3 Rollback si algo sale mal

- **Si el setup de casa tiene problemas y necesitas volver rápido a la
  oficina:** tu máquina de oficina sigue funcional tal cual la dejaste.
  Solo `git pull` y retomás.
- **Si perdiste algo crítico que no pusheaste:** check en la oficina
  con `git stash list` y `git reflog` — a veces Git recuerda trabajo
  olvidado.
- **Si alguien (tú mismo en pánico) borró algo en GitHub:** el safety
  tag `pre-cutover-2026-04-19` protege el estado previo al cutover.
  Para el estado posterior, GitHub tiene un "Restore deleted branches"
  por 90 días en la configuración del repo.

---

## Apéndice A — Árbol de carpetas esperado en casa

```
C:\Users\Usuario\capsula-migration\           ← root de trabajo
├── capsula-erp\                              ← el repo clonado (canónico)
│   ├── .git\
│   ├── src\
│   ├── prisma\
│   ├── docs\
│   │   ├── consolidation-archive\
│   │   │   ├── DIVERGENCE_REPORT.md
│   │   │   └── prompts\                      ← historia archivada
│   │   └── guia-trabajo-remoto.md            ← este documento
│   ├── OPUS_CONTEXT_CAPSULA.md
│   └── package.json
├── prompts\                                  ← prompts activos para Claude Code
│   └── (archivos .md nuevos que vayas creando)
├── DIVERGENCE_REPORT.md                      ← copia para referencia rápida
└── CASA_SETUP_INSTRUCCIONES.txt              ← el checklist SSH
```

## Apéndice B — Comandos de emergencia

**"Mi working tree está desastroso, quiero empezar de cero"**
```powershell
cd C:\Users\Usuario\capsula-migration\capsula-erp
git fetch origin
git reset --hard origin/main
git clean -fd
# CUIDADO: borra cambios no commiteados. Asegúrate de no perder nada.
```

**"Perdí acceso SSH a Contabo"**
Desde la oficina (o cualquier máquina con acceso): autorizar nueva key,
ver paso 1.3.

**"Mi .env local se corrompió"**
Copiar de Vercel → Project → Settings → Environment Variables →
Descargar como .env (Vercel tiene botón).

**"Accidentalmente commitée un secret"**
1. Rota el secret (cambiar el valor en Vercel/AWS/donde sea).
2. Corre `git filter-repo` o BFG Repo Cleaner para borrarlo del historial.
3. Force push — pero primero safety tag del estado actual.
4. Avisa a cualquier co-colaborador que re-clone.

## Apéndice C — Contactos y URLs rápidas

- **Repo principal:** https://github.com/Juninho2604/capsula-erp
- **Repo legacy (producción Shanklish):** https://github.com/Juninho2604/shanklish-erp-main
- **Vercel dashboard:** https://vercel.com/dashboard
- **Contabo panel:** https://my.contabo.com (IP `147.93.6.70`)
- **Claude Code docs:** https://docs.claude.com
- **OPUS_CONTEXT (dentro del repo):** `OPUS_CONTEXT_CAPSULA.md` — léelo
  al arrancar cualquier sesión nueva de Claude Code. Es la fuente de
  verdad del sistema.

---

*Guía creada 2026-04-19 durante Fase 4 del cutover Cápsula. Actualizar
esta sección si cambia algo estructural del setup.*
