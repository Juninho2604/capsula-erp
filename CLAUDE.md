# CLAUDE.md — capsula-erp

Instrucciones permanentes para cualquier agente de Claude trabajando en este repo.
**Lee esto antes de editar UI.** Para contexto funcional completo, ver `OPUS_CONTEXT_CAPSULA.md`.

---

## 🚨 Reglas críticas (no negociables)

### 1. Tipografía — Inter Tight en todo

- **Única fuente visible:** Inter Tight sans (`var(--font-body)`), la misma que el sidebar.
- **Nunca** usar `font-heading` ni Instrument Serif en UI nueva. El token existe solo por compatibilidad; los `h1/h2/h3` globales ya aplican `var(--font-body)` con `font-weight: 600`.
- Para jerarquía usar `font-semibold` (+ `tracking-[-0.02em]` en titulares grandes), no familias distintas.
- Si ves `font-heading`, `font-black` o `font-bold` legacy en un archivo que tocas, migra a `font-semibold` en el mismo commit.

### 2. Sin emojis en chrome de UI

- Reemplazar emojis (🍸 🛒 🔥 ✅ 🧾 🪑 🍽️ 🍺 🌿 🎁 📞 👤 ✏️ 🔄 ❌ etc.) por iconos `lucide-react`.
- Excepciones permitidas: contenido dinámico del usuario (nombres de productos, notas), traces de debug, y payload de `printReceipt`/`printKitchenCommand` (impresoras térmicas).
- Tabla de mapeo usado en la app:

| Emoji | Icono lucide       | Uso típico                        |
|-------|--------------------|-----------------------------------|
| 🍸    | `Wine`             | Header POS Restaurante            |
| 🛒 🛍️ | `ShoppingCart` / `ShoppingBag` | Carrito / pickup       |
| 🍳 🧑‍🍳 | `ChefHat`         | Enviar a cocina / Mesero          |
| 🔥    | `Flame`            | Estado "en cocina"                |
| ✅ ✓  | `Check`            | Confirmaciones                    |
| ❌    | `Ban`              | Anular                            |
| 🔄    | `RefreshCw`        | Cambiar / refrescar               |
| ✏️    | `Pencil`           | Editar / ajustar                  |
| 🔐 🔒 | `Lock`             | PIN / autorización                |
| 🔓    | `Unlock`           | Cuenta abierta                    |
| 🧾    | `Receipt`          | Cuenta / factura                  |
| 🖨️    | `Printer`          | Pre-cuenta / reimprimir           |
| 🪑    | `Armchair`         | Mesas                             |
| 🍽️    | `UtensilsCrossed`  | Menú                              |
| 🍺    | `Beer`             | Zona bar                          |
| 🌿    | `Leaf`             | Zona jardín                       |
| 🎁    | `Gift`             | Cortesía                          |
| 📞    | `Phone`            | Teléfono cliente                  |
| 👤    | `UserCircle2` / `UserCog` | Mesonero / cajera          |
| 🏷️    | `Tag`              | Código / tabCode                  |
| ÷     | `Divide`           | Subcuentas                        |
| ↔     | `ArrowLeftRight`   | Transferir mesa                   |
| 💵    | `DollarSign`       | Cash USD                          |
| €     | `Euro`             | Cash EUR                          |
| ⚡     | `Zap`              | Zelle                             |
| 💳    | `CreditCard`       | PDV                               |
| 📱    | `Smartphone`       | Pago móvil                        |
| 💴    | `Banknote`         | Efectivo Bs                       |
| ⚠️    | `AlertTriangle`    | Advertencia                       |
| 🚪 🚶 | `LogOut`           | Salir                             |
| 🔍    | `Search`           | Buscar                            |
| ←     | `ArrowLeft`        | Volver                            |
| ✕ ×   | `X as XIcon`       | Cerrar                            |

### 3. Paleta Minimal Navy — usa tokens, nunca hex sueltos

Clases Tailwind disponibles (definidas en `tailwind.config.ts` como `rgb(var(--capsula-X-rgb) / <alpha-value>)`, con overrides `.dark` en `globals.css`):

```
bg-capsula-ivory              bg-capsula-ivory-surface    bg-capsula-ivory-alt
bg-capsula-navy-deep          bg-capsula-navy             bg-capsula-navy-soft
bg-capsula-coral              bg-capsula-coral-hover
bg-capsula-gold               bg-capsula-gold-subtle

text-capsula-ink              text-capsula-ink-soft
text-capsula-ink-muted        text-capsula-ink-faint
text-capsula-ivory            text-capsula-coral
text-capsula-navy-deep

border-capsula-line           border-capsula-line-strong
```

**Prohibido** en código nuevo:
- `text-emerald-*` / `text-amber-*` / `text-sky-*` / `text-red-*` / `text-blue-*` / `text-purple-*` / `text-indigo-*` como **foreground**. Usa `text-capsula-ink` o `text-capsula-coral`.
- `bg-emerald-*` / `bg-amber-*` / `bg-red-*` / etc. Usa `bg-capsula-navy-soft`, `bg-capsula-ivory-alt`, `bg-capsula-coral/10`.
- `text-capsula-navy-deep` / `text-capsula-navy` para texto largo — se pierde en dark mode. Usa `text-capsula-ink`.
- `bg-primary text-white` — en dark el botón desaparece. Usa `bg-capsula-navy-deep text-capsula-ivory`.
- `bg-card`, `bg-secondary`, `bg-muted`, `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border` en componentes nuevos del ERP. Estos siguen funcionando (shadcn tokens) pero preferimos capsula-* porque tenemos control total del dark mode.
- `font-black`, `font-bold`, `font-heading`, `capsula-btn`, `capsula-card` en UI nueva — usa `font-semibold`, `pos-btn`, `pos-card`.
- `glass-panel` en código nuevo — usa `bg-capsula-ivory border border-capsula-line`.
- Colores inline como `bg-[#...]` salvo para los 4 tonos sutiles autorizados (ok/warn/danger/info) documentados abajo.

**4 tonos sutiles de estado** (ok/warn/danger/info) cuando hace falta señalización cromática — escribir hex directo con `dark:` override, NO abrir nuevos tokens:

```
ok:      bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]
warn:    bg-[#F3EAD6] text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8]
danger:  bg-[#F7E3DB] text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8]
info:    bg-[#E6ECF4] text-[#2A4060] dark:bg-[#1A2636] dark:text-[#D1DCE9]
```

### 4. Helpers POS táctiles

Para botones/tiles/cards del POS usar helpers de `globals.css`:

- `pos-btn` — CTA primario navy con feedback táctil (border-bottom 4px → 0 on :active).
- `pos-btn-secondary` — ivory con border.
- `pos-btn-danger` — coral.
- `pos-tile` — card táctil (ivory-surface, border capsula-line, hover navy).
- `pos-card` — card con sombra sutil.
- `pos-panel` — panel de agrupación.
- `pos-input` — input estándar.
- `pos-label` / `pos-kicker` / `pos-amount` — tipografía consistente.

No añadir clases `shadow-*` dramáticas (`shadow-2xl`, `shadow-lg shadow-primary/20`) sobre estos helpers; ya tienen `--tactile-shadow` calibrada.

### 5. Dark mode obligatorio

- Cada cambio debe verse bien en light **y** dark. Los tokens `capsula-*` ya son dark-aware (vía `rgb(var() / alpha)`).
- Si escribes un hex inline, siempre incluir variante `dark:` — excepto ink overlays transparentes (`bg-capsula-ink/60` para modales).
- Backdrop de modales: `bg-capsula-ink/60 backdrop-blur-sm`. Nunca `bg-black/70` ni `bg-background/90`.

### 6. Jerarquía de texto (uppercase)

- Labels/kickers: `text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted`.
- Table headers: `text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted`.
- Títulos H1/H2: `font-semibold tracking-[-0.02em] text-capsula-ink`.
- Números y saldos: siempre `tabular-nums`.

### 7. Modales estándar

```
<div className="fixed inset-0 z-[60] bg-capsula-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
  <div className="bg-capsula-ivory border border-capsula-line w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl">
    <div className="border-b border-capsula-line p-5 flex items-center justify-between">
      <h3 className="font-semibold text-lg tracking-[-0.02em] text-capsula-ink">Título</h3>
      <button className="h-8 w-8 rounded-full hover:bg-capsula-coral/10 hover:text-capsula-coral text-capsula-ink-muted flex items-center justify-center">
        <XIcon className="h-4 w-4" />
      </button>
    </div>
    <div className="p-5 space-y-4">…</div>
    <div className="border-t border-capsula-line p-4 flex gap-3">
      <button className="pos-btn-secondary flex-1 py-3">Cancelar</button>
      <button className="pos-btn flex-[2] py-3 inline-flex items-center justify-center gap-2">
        <Check className="h-4 w-4" /> Confirmar
      </button>
    </div>
  </div>
</div>
```

Respetar el z-index stack (sección 18.1 de OPUS_CONTEXT): modales POS en `z-[60]`, BellPanel/HelpPanel en `z-[70]`.

---

## ✅ Gates antes de commitear

```bash
npx tsc --noEmit            # debe salir con exit 0
npx vitest run              # debe quedar 27/27 (o el total vigente)
```

No commitear nada sin tsc limpio. Es producción activa, Render auto-deploy desde `main`.

---

## 🔁 Flujo de trabajo

- Desarrollar en la rama asignada por la sesión (ver header del prompt de agente).
- **Commits pequeños y temáticos**, uno por sección/área visible. Los POS se migraron en 5a–5g (mesero) y 6a–6g (restaurante) — mismo patrón para futuras migraciones.
- Mensaje de commit: `feat(design): <área> — <cambio breve> (Minimal Navy)` con cuerpo en bullets.
- Push: `git push -u origin <branch>`. Render desplegará solo cuando la rama se mergee a `main`.
- No abrir PRs sin pedido explícito del usuario.

---

## 📚 Referencias

- **Paleta completa y CSS vars:** `src/app/globals.css` (`:root` y `.dark`).
- **Tailwind tokens:** `tailwind.config.ts` (colors.capsula, fontFamily).
- **Helpers POS:** `globals.css` a partir de `.pos-btn`.
- **Iconos de módulos:** `src/lib/module-icons.ts` (44 mapeos).
- **Contexto de negocio:** `OPUS_CONTEXT_CAPSULA.md` — sección 18 tiene todas las convenciones acumuladas; la 18.38 es el índice Minimal Navy.

Cuando dudes entre dos patrones, elige el que coincide con `pos/mesero/page.tsx` o `pos/restaurante/page.tsx` — son las referencias vivas de la paleta.
