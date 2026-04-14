# CÁPSULA — Identidad de Marca y Redes Sociales

**Sección para agregar al CÁPSULA MASTER CONTENT (después de sección 11)**

-----

## 12-B. IDENTIDAD VISUAL — BRAND SYSTEM

### Concepto de marca

CÁPSULA = algo pequeño que contiene algo poderoso. La identidad visual refleja esto:
compacta, modular, energética, hospitalaria.

**Tono:** Friendly SaaS — cálido, accesible, cercano. Similar a Toast/Square.
**Idioma de marca:** 100% español (LATAM).

### Logo — "Barras Modulares"

El isotipo es una forma de cápsula (pill shape) que contiene 3 barras verticales
de diferente altura. Las barras representan los módulos del ERP — cada barra es
un pilar del sistema (POS, Inventario, Analítica).

```
Variantes del logo:
├── full      → Isotipo + texto "CÁPSULA" (navbar, headers, documentos)
├── icon      → Isotipo solo (avatares de redes, app icon)
└── favicon   → Isotipo a 32px (pestaña del navegador)

Versiones de color:
├── Color     → Coral sobre blanco (uso principal)
├── White     → Blanco sobre fondo oscuro (banners, headers dark)
├── Navy      → Navy sobre blanco (documentos formales)
└── Mono      → Gris sobre blanco (impresión B&W)
```

### Paleta: Coral Energy

```
PRIMARIO:
  #FF6B4A  Coral           → Botones, links, CTAs, acciones principales
  #E85A3A  Coral hover     → Estados hover
  #FF8A6F  Coral claro     → Badges, highlights
  #FFF0EC  Coral sutil     → Backgrounds de énfasis

SECUNDARIO:
  #1B2D45  Navy profundo   → Textos, headers, fondos oscuros
  #2A4060  Navy claro      → Subheadings
  #F0F2F5  Navy sutil      → Backgrounds

ACCENT:
  #FFD93D  Dorado          → Alertas positivas, destacados, premium
  #F0C830  Dorado hover
  #FFFBEB  Dorado sutil    → Banners informativos

FONDOS:
  #FFFFFF  Blanco          → Fondo principal
  #FFF8F5  Warm            → Landing, onboarding, secciones highlight
  #FFE8E0  Muted           → Cards, secciones alternas

SEMÁNTICOS:
  #10B981  Verde           → Éxito, stock OK, completado
  #F59E0B  Ámbar           → Advertencia, stock bajo
  #EF4444  Rojo            → Error, void, eliminar
  #3B82F6  Azul            → Info, sync, neutral
```

### Tipografía

```
HEADINGS:  Nunito (800 ExtraBold, 700 Bold)
  → Redondeada, friendly, alta legibilidad
  → Google Fonts: family=Nunito:wght@400;600;700;800;900

BODY:      Inter (400 Regular, 500 Medium, 600 SemiBold)
  → Profesional, legible, estándar en SaaS
  → Google Fonts: family=Inter:wght@400;500;600;700

MONOSPACE: JetBrains Mono
  → Para código, IDs, valores numéricos en dashboards
```

### Archivos de marca en el codebase

```
src/config/branding.ts            ← Configuración central de marca
src/config/capsula-theme.css      ← CSS variables para Shadcn/ui
src/components/brand/CapsulaLogo.tsx  ← Componente React del logo
src/hooks/useBranding.ts          ← Hook para acceder al branding
tailwind.config.ts                ← Colores CÁPSULA en Tailwind
public/brand/logo-full-color.svg  ← Logo completo (color)
public/brand/logo-full-white.svg  ← Logo completo (blanco)
public/brand/logo-icon-color.svg  ← Isotipo solo (color)
```

-----

## 12-C. ESTRATEGIA DE REDES SOCIALES

### Presencia digital

```
Handle universal: @capsulapp

PLATAFORMAS:
├── TikTok    → PRIORIDAD 1 — Adquisición, demos, viralización
├── Instagram → PRIORIDAD 2 — Vitrina, credibilidad, carruseles
├── Facebook  → PRIORIDAD 3 — Comunidad, restauranteros 35+
├── X         → PRIORIDAD 4 — Building in public, networking tech
└── LinkedIn  → FUTURO — B2B, decisores corporativos
```

### Pilares de contenido

```
1. DEMOS RÁPIDAS (40%)
   "Mira cómo se registra una venta en 3 toques"
   "Así se ve tu inventario en tiempo real"
   → Videos 15-30s, screen recording + voz/texto

2. PAIN POINTS (30%)
   "¿Todavía cuentas inventario en Excel?"
   "Fin de mes y no sabes cuánto ganaste"
   → Formato meme/relatable → solución con CÁPSULA

3. EDUCATIVO (20%)
   "3 métricas que todo restaurante debe medir"
   "Qué es food cost y por qué te está matando"
   → Posicionamiento como experto en gestión

4. BUILDING IN PUBLIC (10%)
   Detrás de cámaras, journey de Omar, tech decisions
   → Humaniza la marca, atrae talento
```

### Calendario de lanzamiento

```
SEMANA 1-2:  Crear identidad visual (logo, paleta, templates)     ✅
SEMANA 3:    Abrir cuentas, subir banners y bio
SEMANA 4-5:  Pre-lanzamiento — 5 TikToks de pain points (sin producto)
SEMANA 6:    Reveal — "Esto es CÁPSULA" con demo completa
SEMANA 7+:   Ritmo sostenido (4-5 TikToks/sem, 3-4 IG/sem)
```

### Frecuencia por plataforma

```
TikTok:    4-5 videos/semana
Instagram: 3-4 posts/semana + stories diarias
Facebook:  3 posts/semana (reposts de IG)
X:         3-5 tweets/semana + 1 hilo técnico/mes
```

### Reglas de diseño para posts

```
TEMPLATE DE POST:
├── Logo siempre arriba a la izquierda (isotipo + "CÁPSULA")
├── Fondo = color primario en gradiente
├── Título en blanco, máx 8 palabras, Nunito 800
├── Un emoji o ícono central como anchor visual
├── Subtítulo en blanco al 85% de opacidad
└── Sin texto fuera del safe area (bordes TikTok/IG)

TEMPLATE DE CARRUSEL (Instagram):
├── Slide 1: Hook visual + pregunta provocadora
├── Slides 2-6: Contenido educativo, 1 dato por slide
├── Último slide: CTA + @capsulapp
└── Colores: fondo warm (#FFF8F5) + texto navy + accent coral
```

-----

*Sección agregada: Abril 2026*
*Decisiones de marca: Logo "Barras Modulares" + Paleta "Coral Energy"*
*Aprobado por: Omar (Juninho2604)*
