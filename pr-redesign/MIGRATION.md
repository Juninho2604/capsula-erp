# Guía de migración — `feat/redesign-minimal`

## 1. Aplicar archivos del PR

```bash
cd capsula-erp
git checkout -b feat/redesign-minimal

# Copiá pr-redesign/ encima del repo real (respeta estructura idéntica)
rsync -av --exclude='APPLY.md' --exclude='MIGRATION.md' pr-redesign/ ./
```

Archivos que reemplaza:
- `tailwind.config.ts`
- `src/app/globals.css`
- `src/app/layout.tsx` ✅ incluido (mantiene `font-inter`/`font-nunito` como back-compat)
- `src/app/page.tsx` (landing)
- `src/components/ui/{button,Card,CapsulaLogo}.tsx`

Archivos nuevos:
- `src/components/brand/CapsulaAnimatedMark.tsx`
- `src/components/dashboard/{DashboardWelcome,KpiCard}.tsx` (KpiCard **sobreescribe** el existente)
- `src/components/layout/PageHeader.tsx`
- `src/components/ui/{DataTable,Badge}.tsx`
- `src/components/pos/POSKeypad.tsx`

## 2. Instalar dependencia faltante (si no existe)

```bash
pnpm add class-variance-authority
pnpm add -D tailwindcss-animate
```

(`lucide-react`, `react-hot-toast`, `@radix-ui/react-slot` ya están.)

## 3. Por qué no toco cada módulo uno por uno

El refactor es **token-driven**: al cambiar variables CSS (`--primary`, `--background`, `--radius`, `--font-body`, `--font-heading`) y utilidades `bg-capsula-*`, **todos los componentes que usan esas clases se ven nuevos automáticamente**. Los refactors componente-por-componente vienen después, dirigidos (no masivos).

## 4. Reemplazo de emojis → lucide icons

Ejecutá una vez:

```bash
# Ver dónde hay emojis en módulos
grep -rnE "📦|📋|💰|📊|🚚|👥|🛒|🍽|🔔" src/app/dashboard src/components
```

Por cada match, importá de `lucide-react` y reemplazá:

| Emoji | Lucide |
|-------|--------|
| 📦 | `Box` o `Package` |
| 📋 | `BookOpen` o `ClipboardList` |
| 💰 | `Coins` |
| 📊 | `BarChart3` |
| 🚚 | `Truck` |
| 👥 | `Users` |
| 🛒 | `ShoppingCart` |
| 🍽 | `UtensilsCrossed` |
| 🔔 | `Bell` |

Uso: `<Box className="h-4 w-4" strokeWidth={1.5} />` — el `strokeWidth={1.5}` mantiene el look minimal.

## 5. Sidebar.tsx (prohibido tocar)

Como me pediste no tocarlo, seguirá con sus estilos previos. Si después querés, te paso un patch pequeño que SOLO cambia colores/tipografía sin alterar lógica.

## 6. Módulos del dashboard — patrón a usar

Cada `*-view.tsx` puede adoptar este shell sin reescribir lógica de negocio:

```tsx
import { PageHeader } from '@/components/layout/PageHeader';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/button';
import { Package, Plus } from 'lucide-react';

export default function InventarioView() {
    return (
        <div className="mx-auto max-w-[1400px] px-8 py-10">
            <PageHeader
                kicker="Inventario"
                title="Stock y movimientos"
                description="Controla existencias por almacén en tiempo real."
                actions={
                    <Button variant="primary">
                        <Plus className="h-4 w-4" /> Nuevo ítem
                    </Button>
                }
            />

            <div className="mb-8 grid gap-4 md:grid-cols-4">
                <KpiCard label="SKUs activos" value="428" delta="+12" icon={Package} />
                <KpiCard label="Valor de stock" value="$ 38.420" delta="+2.1%" />
                <KpiCard label="Por reabastecer" value="17" trend="down" hint="umbral mínimo" />
                <KpiCard label="Rotación" value="4.3×" hint="promedio mensual" />
            </div>

            <DataTable
                caption="Ítems"
                search
                columns={[
                    { key: 'sku', header: 'SKU', mono: true, width: 120 },
                    { key: 'nombre', header: 'Producto' },
                    { key: 'stock', header: 'Stock', align: 'right', mono: true },
                    {
                        key: 'estado', header: 'Estado', align: 'right',
                        render: (r) => <Badge variant={r.stock < 10 ? 'warn' : 'ok'}>{r.stock < 10 ? 'Bajo' : 'OK'}</Badge>,
                    },
                ]}
                rows={items}
            />
        </div>
    );
}
```

## 7. POS — preservar táctil

En `src/components/pos/*` y `src/app/dashboard/pos/*`, reemplazá las clases de botones:

```diff
- <button className="bg-blue-600 text-white rounded-lg px-6 py-3 ...">
+ <button className="pos-btn">

- <button className="bg-white border rounded-lg ...">
+ <button className="pos-btn pos-btn-secondary">

- <button className="bg-red-500 text-white ...">
+ <button className="pos-btn pos-btn-danger">
```

Las clases `.pos-btn*` viven en `globals.css` y preservan el `border-b-4 + active:translate-y-[2px]`.

## 8. Deploy para ver los cambios

### Opción A — Vercel (recomendado, 5 min)
```bash
# Desde capsula-erp, en la rama feat/redesign-minimal
git push -u origin feat/redesign-minimal
```
Luego:
1. Entrá a https://vercel.com/new
2. Importá el repo `Juninho2604/capsula-erp`
3. En **Framework Preset** detecta Next.js automáticamente
4. Configurá variables de entorno (DATABASE_URL, NEXTAUTH_SECRET, etc. — lo que tu `.env.local` tenga)
5. Deploy. Vercel te da un **preview URL** específico para esa rama (`capsula-erp-git-feat-redesign-minimal.vercel.app`)
6. Cada `git push` a la rama actualiza el preview automáticamente

### Opción B — Local, en tu compu
```bash
pnpm install
pnpm prisma generate
pnpm dev
# Abrí http://localhost:3000
```

### Opción C — Preview de Vercel sin merge a `main`
Si tu repo ya está conectado a Vercel, **cualquier push a la rama** genera un preview. Abrí PR en GitHub y Vercel comenta con el link del preview.

### Si no tenés Vercel conectado aún
1. Loggeate en https://vercel.com con tu GitHub
2. "Add New → Project" → elegí `capsula-erp`
3. Importá. Primer deploy de `main` + cada rama futura genera preview.

## 9. Orden sugerido de verificación visual

1. `/` — landing nueva ✅ (ya está)
2. `/login` — NO toqué, debería seguir igual
3. `/dashboard` — aplicá `<DashboardWelcome />` desde `dashboard/page.tsx` (un solo import)
4. Primer módulo real: `/dashboard/inventario` con el patrón del punto 6
5. POS: reemplazá clases de botones
