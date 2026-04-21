# Aplicación del PR `feat/redesign-minimal`

Los archivos están en `pr-redesign/` replicando la estructura del repo `capsula-erp`.

## 1. Crear rama y copiar

```bash
cd capsula-erp
git checkout -b feat/redesign-minimal

# Desde la raíz del proyecto de diseño:
rsync -av pr-redesign/ /ruta/a/capsula-erp/
```

## 2. Fuentes — agregar en `src/app/layout.tsx`

No toqué `layout.tsx` (prohibido). Agregá estos imports:

```ts
import { Inter_Tight, Instrument_Serif, JetBrains_Mono } from 'next/font/google';

const interTight = Inter_Tight({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
    variable: '--font-body',
    display: 'swap',
});
const instrumentSerif = Instrument_Serif({
    subsets: ['latin'],
    weight: '400',
    style: ['normal', 'italic'],
    variable: '--font-heading',
    display: 'swap',
});
const jetbrains = JetBrains_Mono({
    subsets: ['latin'],
    weight: ['400', '500'],
    variable: '--font-mono',
    display: 'swap',
});
```

Y aplicá las tres variables al `<html>` o `<body>`:
```tsx
<body className={`${interTight.variable} ${instrumentSerif.variable} ${jetbrains.variable}`}>
```

## 3. Commits sugeridos

```bash
git add tailwind.config.ts src/app/globals.css
git commit -m "chore(design): tokens Minimal Navy + fuentes editoriales"

git add src/components/ui/button.tsx src/components/ui/Card.tsx src/components/ui/CapsulaLogo.tsx src/components/brand/CapsulaAnimatedMark.tsx
git commit -m "feat(ui): primitives + logo + animated mark"

git add src/app/page.tsx
git commit -m "feat(landing): redesign minimal navy"
```

## 4. Próximas fases (sin código aún)

- Refactor de módulos `dashboard/*` para usar `capsula-card`, nuevas `Button` variants y lucide icons en lugar de emojis.
- Refactor de `src/components/pos/*` preservando `.pos-btn` táctil pero con paleta nueva.
- Reemplazo de emojis en toda la app (búsqueda: `grep -r "📦\|📋\|💰\|📊\|🚚" src/`).

## Pendientes fuera de este lote

Por tamaño, NO incluyo aquí: refactor de cada módulo individual del dashboard, componentes POS, parsers WhatsApp. Los abordamos en la siguiente tanda una vez validés la base.
