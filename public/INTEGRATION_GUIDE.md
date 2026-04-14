# CÁPSULA — Brand System Integration Guide

## Archivos incluidos

```
capsula-brand/
├── tailwind.config.ts                    ← REEMPLAZA el actual
├── src/
│   ├── config/
│   │   ├── branding.ts                   ← REEMPLAZA el actual
│   │   ├── capsula-theme.css             ← NUEVO — importar en globals.css
│   │   └── social-brand.ts              ← NUEVO — constantes de redes
│   ├── components/
│   │   └── brand/
│   │       └── CapsulaLogo.tsx          ← NUEVO — componente del logo
│   └── hooks/
│       └── useBranding.ts               ← REEMPLAZA el actual
├── public/
│   └── brand/
│       ├── logo-full-color.svg          ← Logo completo (color)
│       ├── logo-full-white.svg          ← Logo completo (blanco)
│       └── logo-icon-color.svg          ← Isotipo solo
└── docs/
    └── BRAND_IDENTITY_OPUS_CONTEXT.md   ← Agregar al CÁPSULA MASTER CONTENT
```

## Pasos de integración

### 1. Instalar fuentes (ya debería estar Inter, agregar Nunito)

En `src/app/layout.tsx`:
```tsx
import { Inter, Nunito } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-body' });
const nunito = Nunito({ subsets: ['latin'], variable: '--font-heading' });

// En el <body>:
<body className={`${inter.variable} ${nunito.variable}`}>
```

### 2. Importar tema CSS

En `src/app/globals.css`, agregar al inicio:
```css
@import '../config/capsula-theme.css';
```

O copiar el contenido de `capsula-theme.css` dentro de `globals.css` 
reemplazando las variables `:root` actuales.

### 3. Reemplazar archivos

- Copiar `tailwind.config.ts` a la raíz del proyecto
- Copiar `src/config/branding.ts` (reemplaza el existente)
- Copiar `src/hooks/useBranding.ts` (reemplaza el existente)
- Copiar `src/components/brand/CapsulaLogo.tsx` (nuevo)
- Copiar `src/config/social-brand.ts` (nuevo)
- Copiar `public/brand/*.svg` (nuevos)

### 4. Usar el logo en la app

```tsx
import CapsulaLogo, { CapsulaNavbarLogo } from '@/components/brand/CapsulaLogo';

// En el navbar:
<CapsulaNavbarLogo />

// En la landing:
<CapsulaLogo variant="full" size={64} />

// Sobre fondo oscuro:
<CapsulaLogo color="white" textColor="white" />
```

### 5. Usar colores en Tailwind

```tsx
// Colores CÁPSULA directos
<button className="bg-capsula-coral text-white hover:bg-capsula-coral-hover">
  Guardar
</button>

// Fondo cálido
<div className="bg-capsula-warm">
  Sección de onboarding
</div>

// Usando Shadcn (mapean a los mismos colores)
<Button variant="default">Acción</Button>  // → Coral
```

### 6. Actualizar OPUS Context

Copiar el contenido de `docs/BRAND_IDENTITY_OPUS_CONTEXT.md` y agregarlo
al documento CÁPSULA_MASTER_CONTENT como secciones 12-B y 12-C.

---

**Paleta elegida:** Coral Energy  
**Logo elegido:** Barras Modulares  
**Handle:** @capsulapp  
**Generado:** Abril 2026  
