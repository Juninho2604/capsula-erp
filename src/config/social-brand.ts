// ============================================================================
// KPSULA — Social Media Brand Config
// ============================================================================
// Constantes de marca para generación de contenido de redes sociales.
// Especificaciones por plataforma, templates de post, pilares de contenido.
// ============================================================================

export const SOCIAL_BRAND = {
  // ─── HANDLES ───────────────────────────────────────────────
  handle: '@kpsula',
  hashtags: {
    primary: ['#KPSULA', '#Kpsula', '#ERPRestaurante'],
    secondary: ['#GestiónDeRestaurantes', '#TechParaRestaurantes', '#FoodCost'],
    viral: ['#RestaurantesTech', '#DueñoDeRestaurante', '#SaaS', '#ERPLatam'],
  },

  // ─── PLATAFORMAS ───────────────────────────────────────────
  platforms: {
    tiktok: {
      handle: '@kpsula',
      url: 'https://tiktok.com/@kpsula',
      priority: 1,
      frequency: '4-5 videos/semana',
      dimensions: {
        video: { width: 1080, height: 1920 },       // 9:16
        profile: { width: 200, height: 200 },
      },
      bestTimes: ['12:00', '17:00', '20:00'],        // Hora Caracas (VET)
      contentMix: { demos: 40, painPoints: 30, educational: 20, bts: 10 },
    },
    instagram: {
      handle: '@kpsula',
      url: 'https://instagram.com/kpsula',
      priority: 2,
      frequency: '3-4 posts/semana + stories diarias',
      dimensions: {
        post: { width: 1080, height: 1080 },         // 1:1
        story: { width: 1080, height: 1920 },         // 9:16
        reel: { width: 1080, height: 1920 },          // 9:16
        carousel: { width: 1080, height: 1350 },      // 4:5
        profilePic: { width: 320, height: 320 },
      },
      bestTimes: ['11:00', '14:00', '19:00'],
    },
    facebook: {
      handle: '@kpsula',
      url: 'https://facebook.com/kpsula',
      priority: 3,
      frequency: '3 posts/semana',
      dimensions: {
        post: { width: 1200, height: 630 },
        cover: { width: 820, height: 312 },
        profilePic: { width: 170, height: 170 },
      },
    },
    x: {
      handle: '@kpsula',
      url: 'https://x.com/kpsula',
      priority: 4,
      frequency: '3-5 tweets/semana + 1 hilo/mes',
      dimensions: {
        post: { width: 1200, height: 675 },          // 16:9
        header: { width: 1500, height: 500 },
        profilePic: { width: 400, height: 400 },
      },
    },
  },

  // ─── BIO UNIVERSAL ─────────────────────────────────────────
  bio: {
    short: 'El ERP inteligente para tu restaurante 🧡',
    medium: 'POS • Inventario • Recetas • Producción • IA\nTu negocio completo en una kpsula 💊',
    full: 'KPSULA es el ERP todo-en-uno para restaurantes.\nPOS · Inventario · Recetas · Producción · IA nativa\n🧡 Tu negocio completo en una kpsula\n👇 kpsula.app',
    cta: 'kpsula.app',
  },

  // ─── PILARES DE CONTENIDO ──────────────────────────────────
  contentPillars: [
    {
      id: 'demos',
      name: 'Demos Rápidas',
      percentage: 40,
      description: 'Screen recordings mostrando features del producto',
      examples: [
        'Mira cómo se registra una venta en 3 toques',
        'Así se ve tu inventario en tiempo real',
        'Tu mesero toma el pedido desde el celular',
        'Cierre de caja en 30 segundos',
        'Receta con costos automáticos — así se ve',
      ],
      format: 'Video 15-30s, screen recording + texto animado o voz',
    },
    {
      id: 'painPoints',
      name: 'Pain Points',
      percentage: 30,
      description: 'Problemas reales de restauranteros → solución con KPSULA',
      examples: [
        '¿Todavía cuentas inventario en Excel?',
        'Cuando el mesero anota mal y cocina prepara otra cosa',
        'Fin de mes y no sabes cuánto ganaste realmente',
        'Tu proveedor te cobró de más y no te diste cuenta',
        '¿Sabes cuál es tu plato más rentable? Apuesto que no',
      ],
      format: 'Video meme/relatable → reveal de solución',
    },
    {
      id: 'educational',
      name: 'Educativo',
      percentage: 20,
      description: 'Tips y métricas para gestión de restaurantes',
      examples: [
        '3 métricas que todo restaurante debe medir',
        'Qué es food cost y por qué te está matando',
        'Cómo saber si un plato te da ganancia o pérdida',
        'Los 5 errores que más dinero le cuestan a un restaurante',
        'Diferencia entre facturar mucho y ser rentable',
      ],
      format: 'Carrusel IG / Video corto TikTok con datos',
    },
    {
      id: 'buildingInPublic',
      name: 'Building in Public',
      percentage: 10,
      description: 'Journey del founder, decisiones técnicas, behind the scenes',
      examples: [
        'Así construí un ERP completo desde Venezuela',
        'Hoy deployé el sync engine — ahora funciona offline',
        'Mi restaurante fue mi primer beta tester',
        'Por qué elegí Next.js + PostgreSQL para un ERP',
        'El problema de conectar IA con un sistema real',
      ],
      format: 'Talking head / Screenshots de código / Threads en X',
    },
  ],

  // ─── REGLAS DE DISEÑO PARA POSTS ──────────────────────────
  designRules: {
    post: {
      logoPosition: 'top-left',
      logoSize: 'isotipo + KPSULA, 20px height',
      background: 'gradiente de color primario (#FF6B4A → #E85A3A)',
      titleColor: '#FFFFFF',
      titleFont: 'Nunito 800',
      titleMaxWords: 8,
      subtitleOpacity: 0.85,
      anchorVisual: 'emoji o ícono central',
      safeMargin: '10% en todos los bordes',
    },
    carousel: {
      slide1: 'Hook visual + pregunta provocadora',
      slides2to6: '1 dato por slide, fondo warm (#FFF8F5)',
      lastSlide: 'CTA + @kpsula',
      textColor: '#1B2D45 (navy)',
      accentColor: '#FF6B4A (coral)',
    },
    story: {
      background: 'gradiente coral o foto con overlay',
      textPosition: 'centro',
      cta: 'Sticker de link a kpsula.app',
    },
  },
} as const;

export type Platform = keyof typeof SOCIAL_BRAND.platforms;
export type ContentPillar = typeof SOCIAL_BRAND.contentPillars[number]['id'];
