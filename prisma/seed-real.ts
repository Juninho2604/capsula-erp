/**
 * SHANKLISH CARACAS ERP - SEED DE DATOS REALES
 * 
 * Carga inicial de:
 * - Áreas (Almacenes reales)
 * - Catálogo maestro de insumos (Categorizado)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// DATOS MAESTROS
// ============================================================================

const AREAS = [
    { name: 'ALMACEN PRINCIPAL', description: 'Inventario general de materias primas' },
    { name: 'CENTRO DE PRODUCCION', description: 'Área de transformación y cocina' },
    { name: 'RESTAURANTE', description: 'Inventario de venta directa y servicio' },
    { name: 'COMIDA PERSONAL', description: 'Insumos exclusivos para personal' },
    { name: 'NOUR', description: 'Barra / Área de café y postres' },
    { name: 'TABLE PONG', description: 'Área de entretenimiento' },
    { name: 'EVENTO', description: 'Inventario transitorio para eventos externos' },
    { name: 'CARLOS', description: 'Custodia especial' },
    { name: 'DEPOSITO ESTACIONAMIENTO', description: 'Almacenamiento de bajo movimiento y limpieza' },
];

// Lista cruda proporcionada (Limpiada y estructurada para carga)
// Se intenta inferir unidad y categoría por el nombre.
const RAW_ITEMS = [
    // --- MATERIA PRIMA / DESPENSA ---
    { name: 'ACEITE COAMO', unit: 'UND', category: 'MATERIA_PRIMA' },
    { name: 'ACEITE DE OLIVA', unit: 'UND', category: 'MATERIA_PRIMA' },
    { name: 'ACEITE DE TRUFA', unit: 'UND', category: 'MATERIA_PRIMA' },
    { name: 'ACEITE MI ACEITE', unit: 'UND', category: 'MATERIA_PRIMA' },
    { name: 'ACEITE DE PALMA', unit: 'L', category: 'MATERIA_PRIMA' },
    { name: 'MOSTAZA PREPARADA 4KG', unit: 'UND', category: 'MATERIA_PRIMA' },
    { name: 'PASTA DE TOMATE', unit: 'KG', category: 'MATERIA_PRIMA' },
    { name: 'SALSA KETCHUP', unit: 'UND', category: 'MATERIA_PRIMA' },
    { name: 'ARROZ DORADO 800GR', unit: 'UND', category: 'MATERIA_PRIMA' },
    { name: 'ARROZ TRADICION 900GR', unit: 'UND', category: 'MATERIA_PRIMA' },
    { name: 'ARROZ PARA SERVICIO', unit: 'KG', category: 'MATERIA_PRIMA' },
    { name: 'ARROZ MARY SUPERIOR', unit: 'UND', category: 'MATERIA_PRIMA' },
    { name: 'AZUCAR DE 1KG', unit: 'UND', category: 'MATERIA_PRIMA' },
    { name: 'AZUCAR EN SOBRE', unit: 'UND', category: 'MATERIA_PRIMA' },
    { name: 'SPLENDA', unit: 'UND', category: 'MATERIA_PRIMA' },
    { name: 'GELATINA SIN SABOR', unit: 'KG', category: 'MATERIA_PRIMA' },
    { name: 'AZUCAR MORENA', unit: 'KG', category: 'MATERIA_PRIMA' },
    { name: 'CAFE', unit: 'KG', category: 'MATERIA_PRIMA' },
    { name: 'HARINA DE TRIGO', unit: 'KG', category: 'MATERIA_PRIMA' },
    { name: 'HARINA PAN', unit: 'KG', category: 'MATERIA_PRIMA' },
    { name: 'HARINA DE YUCA', unit: 'KG', category: 'MATERIA_PRIMA' },
    { name: 'PAN MOLIDO', unit: 'KG', category: 'MATERIA_PRIMA' },
    { name: 'SAL', unit: 'KG', category: 'MATERIA_PRIMA' },
    { name: 'SAL GRUESA', unit: 'KG', category: 'MATERIA_PRIMA' },
    { name: 'SAL DE LIMON', unit: 'KG', category: 'MATERIA_PRIMA' },
    { name: 'VINAGRE', unit: 'KG', category: 'MATERIA_PRIMA' },
    { name: 'MAYONESA', unit: 'UND', category: 'MATERIA_PRIMA' },

    // --- ESPECIAS Y CONDIMENTOS ---
    { name: 'AJONJOLI', unit: 'KG', category: 'ESPECIAS' },
    { name: 'AJONJOLI NEGRO', unit: 'KG', category: 'ESPECIAS' },
    { name: 'ANIS ESTRELLADO', unit: 'KG', category: 'ESPECIAS' },
    { name: 'CANELA EN RAMA', unit: 'KG', category: 'ESPECIAS' },
    { name: 'CANELA MOLIDA', unit: 'KG', category: 'ESPECIAS' },
    { name: 'CARDAMOMO', unit: 'KG', category: 'ESPECIAS' },
    { name: 'CLAVO DE OLOR', unit: 'KG', category: 'ESPECIAS' },
    { name: 'COMINO', unit: 'KG', category: 'ESPECIAS' },
    { name: 'LAUREL', unit: 'KG', category: 'ESPECIAS' },
    { name: 'NUEZ MOSCADA', unit: 'KG', category: 'ESPECIAS' },
    { name: 'OREGANO', unit: 'KG', category: 'ESPECIAS' },
    { name: 'PAPRIKA', unit: 'KG', category: 'ESPECIAS' },
    { name: 'PIMIENTA NEGRA', unit: 'KG', category: 'ESPECIAS' },
    { name: 'PIMIENTA BLANCA', unit: 'KG', category: 'ESPECIAS' },
    { name: 'PIMIENTA CAYENA', unit: 'KG', category: 'ESPECIAS' },
    { name: 'PIMIENTA GUAYABITA', unit: 'KG', category: 'ESPECIAS' },
    { name: 'SUMAC', unit: 'KG', category: 'ESPECIAS' },
    { name: 'ZAATAR', unit: 'KG', category: 'ESPECIAS' },
    { name: 'SIETE ESPECIES', unit: 'KG', category: 'ESPECIAS' },
    { name: 'TRUFA EN POLVO', unit: 'KG', category: 'ESPECIAS' },
    { name: 'MIEL', unit: 'KG', category: 'ESPECIAS' },
    { name: 'TAHINI', unit: 'KG', category: 'ESPECIAS' },

    // --- PROTEINAS ---
    { name: 'POLLO ENTERO', unit: 'KG', category: 'PROTEINA' },
    { name: 'MUSLO DE POLLO', unit: 'KG', category: 'PROTEINA' },
    { name: 'POLLO DE SHAWARMA', unit: 'KG', category: 'PROTEINA' },
    { name: 'CARNE DE SHAWARMA', unit: 'KG', category: 'PROTEINA' },
    { name: 'CARNE MOLIDA', unit: 'KG', category: 'PROTEINA' },
    { name: 'LOMITO', unit: 'KG', category: 'PROTEINA' },
    { name: 'CHOCOZUELA', unit: 'KG', category: 'PROTEINA' },
    { name: 'LAGARTO', unit: 'KG', category: 'PROTEINA' },
    { name: 'CARNE ANGUS', unit: 'KG', category: 'PROTEINA' },
    { name: 'CORDERO', unit: 'KG', category: 'PROTEINA' },
    { name: 'TOCINETA', unit: 'KG', category: 'PROTEINA' },
    { name: 'JAMON', unit: 'KG', category: 'PROTEINA' },
    { name: 'CHULETA AHUMADA', unit: 'KG', category: 'PROTEINA' },

    // --- LACTEOS ---
    { name: 'QUESO MOZARELLA', unit: 'KG', category: 'LACTEOS' },
    { name: 'QUESO BLANCO', unit: 'KG', category: 'LACTEOS' },
    { name: 'QUESO PARMESANO', unit: 'KG', category: 'LACTEOS' },
    { name: 'LECHE COMPLETA', unit: 'L', category: 'LACTEOS' },
    { name: 'LECHE EN POLVO', unit: 'KG', category: 'LACTEOS' },
    { name: 'MANTEQUILLA SIN SAL', unit: 'KG', category: 'LACTEOS' },
    { name: 'YOGURT NATURAL', unit: 'KG', category: 'LACTEOS' },
    { name: 'CREMA DE LECHE', unit: 'L', category: 'LACTEOS' },
    { name: 'HUEVOS', unit: 'UND', category: 'LACTEOS' },

    // --- VEGETALES ---
    { name: 'AJO PELADO', unit: 'KG', category: 'VEGETALES' },
    { name: 'CEBOLLA BLANCA', unit: 'KG', category: 'VEGETALES' },
    { name: 'CEBOLLA MORADA', unit: 'KG', category: 'VEGETALES' },
    { name: 'CEBOLLIN', unit: 'KG', category: 'VEGETALES' },
    { name: 'CILANTRO', unit: 'KG', category: 'VEGETALES' },
    { name: 'PEREJIL', unit: 'KG', category: 'VEGETALES' },
    { name: 'HIERBABUENA', unit: 'KG', category: 'VEGETALES' },
    { name: 'ALBAHACA', unit: 'KG', category: 'VEGETALES' },
    { name: 'LECHUGA ROMANA', unit: 'KG', category: 'VEGETALES' },
    { name: 'TOMATE', unit: 'KG', category: 'VEGETALES' },
    { name: 'TOMATE CHERRY', unit: 'KG', category: 'VEGETALES' },
    { name: 'TOMATE SECO', unit: 'KG', category: 'VEGETALES' },
    { name: 'PIMENTON ROJO', unit: 'KG', category: 'VEGETALES' },
    { name: 'PIMENTON VERDE', unit: 'KG', category: 'VEGETALES' },
    { name: 'PEPINO', unit: 'KG', category: 'VEGETALES' },
    { name: 'BERENJENA', unit: 'KG', category: 'VEGETALES' },
    { name: 'ZANAHORIA', unit: 'KG', category: 'VEGETALES' },
    { name: 'PAPA', unit: 'KG', category: 'VEGETALES' },
    { name: 'YUCA', unit: 'KG', category: 'VEGETALES' },
    { name: 'LIMON', unit: 'KG', category: 'VEGETALES' },
    { name: 'NARANJA', unit: 'KG', category: 'VEGETALES' },
    { name: 'PIÑA', unit: 'UND', category: 'VEGETALES' },
    { name: 'PARCHITA', unit: 'KG', category: 'VEGETALES' },
    { name: 'FRESA', unit: 'KG', category: 'VEGETALES' },
    { name: 'MORA', unit: 'KG', category: 'VEGETALES' },
    { name: 'COCO', unit: 'KG', category: 'VEGETALES' },
    { name: 'GARBANZOS', unit: 'KG', category: 'VEGETALES' },
    { name: 'LENTEJAS', unit: 'KG', category: 'VEGETALES' },
    { name: 'CARAOTAS', unit: 'KG', category: 'VEGETALES' },

    // --- FRUTOS SECOS ---
    { name: 'ALMENDRAS', unit: 'KG', category: 'FRUTOS_SECOS' },
    { name: 'NUECES', unit: 'KG', category: 'FRUTOS_SECOS' },
    { name: 'PISTACHO', unit: 'KG', category: 'FRUTOS_SECOS' },
    { name: 'MEREY', unit: 'KG', category: 'FRUTOS_SECOS' },
    { name: 'PIÑONES', unit: 'KG', category: 'FRUTOS_SECOS' },

    // --- LICORES ---
    { name: 'CERVEZA POLARCITA', unit: 'UND', category: 'LICOR' },
    { name: 'CERVEZA SOLERA', unit: 'UND', category: 'LICOR' },
    { name: 'CERVEZA HEINEKEN', unit: 'UND', category: 'LICOR' },
    { name: 'CERVEZA ZULIA', unit: 'UND', category: 'LICOR' },
    { name: 'RON DIPLOMATICO', unit: 'UND', category: 'LICOR' },
    { name: 'RON SANTA TERESA', unit: 'UND', category: 'LICOR' },
    { name: 'WHISKY 12 AÑOS', unit: 'UND', category: 'LICOR' },
    { name: 'WHISKY 18 AÑOS', unit: 'UND', category: 'LICOR' },
    { name: 'VODKA', unit: 'UND', category: 'LICOR' },
    { name: 'GIN', unit: 'UND', category: 'LICOR' },
    { name: 'TEQUILA', unit: 'UND', category: 'LICOR' },
    { name: 'VINO TINTO', unit: 'UND', category: 'LICOR' },
    { name: 'VINO BLANCO', unit: 'UND', category: 'LICOR' },
    { name: 'ESPUMANTE', unit: 'UND', category: 'LICOR' },

    // --- BEBIDAS ---
    { name: 'AGUA MINERAL', unit: 'UND', category: 'BEBIDA' },
    { name: 'AGUA CON GAS', unit: 'UND', category: 'BEBIDA' },
    { name: 'REFRESCO PEPSI', unit: 'UND', category: 'BEBIDA' },
    { name: 'REFRESCO 7UP', unit: 'UND', category: 'BEBIDA' },
    { name: 'MALTA', unit: 'UND', category: 'BEBIDA' },
    { name: 'GATORADE', unit: 'UND', category: 'BEBIDA' },
    { name: 'TE LIPTON', unit: 'UND', category: 'BEBIDA' },

    // --- EMPAQUE ---
    { name: 'BOLSAS DELIVERY', unit: 'UND', category: 'EMPAQUE' },
    { name: 'BOLSAS PAPELERA', unit: 'UND', category: 'EMPAQUE' },
    { name: 'BOLSAS BASURA GRANDES', unit: 'UND', category: 'EMPAQUE' },
    { name: 'ENVASES ALUMINIO PEQ', unit: 'UND', category: 'EMPAQUE' },
    { name: 'ENVASES ALUMINIO MED', unit: 'UND', category: 'EMPAQUE' },
    { name: 'ENVASES ALUMINIO GRA', unit: 'UND', category: 'EMPAQUE' },
    { name: 'ENVASES PLASTICO MENU', unit: 'UND', category: 'EMPAQUE' },
    { name: 'ENVASES SALSAS', unit: 'UND', category: 'EMPAQUE' },
    { name: 'VASOS PLASTICO', unit: 'UND', category: 'EMPAQUE' },
    { name: 'VASOS CAFE', unit: 'UND', category: 'EMPAQUE' },
    { name: 'SERVILLETAS', unit: 'UND', category: 'EMPAQUE' },
    { name: 'PAPEL ALUMINIO', unit: 'UND', category: 'EMPAQUE' },
    { name: 'ENVOPLAST', unit: 'UND', category: 'EMPAQUE' },

    // --- LIMPIEZA ---
    { name: 'CLORO', unit: 'L', category: 'LIMPIEZA' },
    { name: 'DESINFECTANTE', unit: 'L', category: 'LIMPIEZA' },
    { name: 'JABON LIQUIDO', unit: 'L', category: 'LIMPIEZA' },
    { name: 'DETERGENTE POLVO', unit: 'KG', category: 'LIMPIEZA' },
    { name: 'ESPONJAS', unit: 'UND', category: 'LIMPIEZA' },
    { name: 'GUANTES', unit: 'UND', category: 'LIMPIEZA' },
    { name: 'PAPEL HIGIENICO', unit: 'UND', category: 'LIMPIEZA' },
    { name: 'TOALLIN', unit: 'UND', category: 'LIMPIEZA' }
];

async function main() {
    console.log('🌱 Iniciando carga de datos REALES...');

    // 1. Limpiar base de datos (Orden específico por Foreign Keys)
    console.log('🧹 Limpiando datos anteriores...');
    await prisma.recipeIngredient.deleteMany();
    await prisma.productionOrder.deleteMany();
    await prisma.recipe.deleteMany();
    await prisma.costHistory.deleteMany();
    await prisma.inventoryMovement.deleteMany();
    await prisma.inventoryLocation.deleteMany();
    await prisma.inventoryItem.deleteMany();
    await prisma.area.deleteMany();

    // NOTA: No borramos usuarios para no perder acceso

    // 2. Crear Áreas Reales
    console.log('🏭 Creando almacenes...');
    for (const area of AREAS) {
        await prisma.area.create({
            data: area,
        });
    }

    // 3. Cargar Insumos
    console.log(`📦 Cargando ${RAW_ITEMS.length} items de inventario...`);

    // Generar SKU único: 3 letras categoría + 001
    const categoryCounters: Record<string, number> = {};

    for (const item of RAW_ITEMS) {
        const cat = item.category || 'GENERAL';
        if (!categoryCounters[cat]) categoryCounters[cat] = 0;
        categoryCounters[cat]++;

        const skuPrefix = cat.substring(0, 3).toUpperCase();
        const skuNum = String(categoryCounters[cat]).padStart(3, '0');
        const sku = `${skuPrefix}-${skuNum}`;

        await prisma.inventoryItem.create({
            data: {
                sku: sku,
                name: item.name,
                type: 'RAW_MATERIAL',
                category: item.category,
                baseUnit: item.unit,
                purchaseUnit: item.unit, // Por defecto igual
                conversionRate: 1,
            },
        });
    }

    console.log('✅ Carga completa exitosa!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
