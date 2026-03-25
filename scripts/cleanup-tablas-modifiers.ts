
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Limpieza definitiva de modificadores de Tablas.
 *
 * Estado objetivo:
 *
 * Tabla x1:
 *   - Principales Arma tu tabla     (max:3) — compartido
 *   - Cremas Arma tu Tabla          (max:2) — compartido
 *   - Ensalada Arma tu Tabla        (max:1) — compartido
 *   - Shanklish Arma tu tabla (x1)  (max:1) — propio
 *   - Pan Arma tu Shanklish         (max:1) — compartido
 *
 * Tabla x2 (mismas cantidades que x1):
 *   - Principales Arma tu tabla     (max:3) — compartido
 *   - Cremas Arma tu Tabla          (max:2) — compartido
 *   - Ensalada Arma tu Tabla        (max:1) — compartido
 *   - Shanklish Arma tu tabla (x2)  (max:1) — propio
 *   - Pan Arma tu Shanklish         (max:1) — compartido
 *
 * Tabla x4 (4 cremas, 2 shanklish):
 *   - Principales Arma tu tabla     (max:3) — compartido
 *   - Cremas (Tabla x4)             (max:4) — propio (ya existe, mejores opciones)
 *   - Ensalada Arma tu Tabla        (max:1) — compartido
 *   - Shanklish Arma tu tabla (x4)  (max:2) — propio
 *   - Pan Arma tu Shanklish         (max:1) — compartido
 */
async function main() {
    console.log('🔧 Limpieza definitiva de modificadores de Tablas...\n');

    // ── Buscar los items ───────────────────────────────────────────────────────
    const [x1, x2, x4] = await Promise.all([
        prisma.menuItem.findFirst({ where: { name: { contains: 'Tabla x1', mode: 'insensitive' } } }),
        prisma.menuItem.findFirst({ where: { name: { contains: 'Tabla x2', mode: 'insensitive' } } }),
        prisma.menuItem.findFirst({ where: { name: { contains: 'Tabla x4', mode: 'insensitive' } } }),
    ]);
    if (!x1 || !x2 || !x4) { console.error('❌ No se encontraron los items de Tabla.'); return; }

    // ── Buscar el Shanklish compartido actual ──────────────────────────────────
    const shanklishShared = await prisma.menuModifierGroup.findFirst({
        where: { name: 'Shanklish Arma tu tabla' },
        include: { modifiers: true }
    });
    if (!shanklishShared) { console.error('❌ No se encontró "Shanklish Arma tu tabla".'); return; }
    const shanklishOpciones = shanklishShared.modifiers;

    // ── PASO 1: Desvincullar el Shanklish compartido de x1, x2, x4 ────────────
    console.log('1️⃣  Desvinculando Shanklish compartido de las 3 tablas...');
    await prisma.menuItemModifierGroup.deleteMany({
        where: {
            menuItemId: { in: [x1.id, x2.id, x4.id] },
            modifierGroupId: shanklishShared.id
        }
    });

    // ── PASO 2: Crear Shanklish propio para cada tabla ─────────────────────────
    const shanklishDefs = [
        { item: x1, label: 'Tabla x1', max: 1 },
        { item: x2, label: 'Tabla x2', max: 1 },
        { item: x4, label: 'Tabla x4', max: 2 },
    ];

    console.log('2️⃣  Creando grupos de Shanklish propios...');
    for (const { item, label, max } of shanklishDefs) {
        // Borrar si ya existe uno propio (evitar duplicados en re-runs)
        const existing = await prisma.menuModifierGroup.findFirst({
            where: { name: `Shanklish Arma tu tabla (${label})` }
        });
        if (existing) {
            await prisma.menuItemModifierGroup.deleteMany({ where: { modifierGroupId: existing.id } });
            await prisma.menuModifier.deleteMany({ where: { groupId: existing.id } });
            await prisma.menuModifierGroup.delete({ where: { id: existing.id } });
        }

        const newGroup = await prisma.menuModifierGroup.create({
            data: {
                name: `Shanklish Arma tu tabla (${label})`,
                isRequired: true,
                minSelections: max,
                maxSelections: max,
                sortOrder: 3,
                modifiers: {
                    create: shanklishOpciones.map(m => ({
                        name: m.name,
                        priceAdjustment: m.priceAdjustment,
                        sortOrder: m.sortOrder,
                        isAvailable: m.isAvailable,
                        linkedMenuItemId: m.linkedMenuItemId,
                    }))
                }
            }
        });
        await prisma.menuItemModifierGroup.create({
            data: { menuItemId: item.id, modifierGroupId: newGroup.id }
        });
        console.log(`   ✅ "${newGroup.name}" creado (max:${max})`);
    }

    // ── PASO 3: Eliminar duplicados del script viejo en x2 ────────────────────
    console.log('3️⃣  Eliminando grupos duplicados viejos de x2...');
    const oldX2Groups = await prisma.menuModifierGroup.findMany({
        where: { name: { in: ['Principales (Tabla x2)', 'Cremas (Tabla x2)', 'Ensalada (Tabla x2)'] } }
    });
    for (const g of oldX2Groups) {
        await prisma.menuItemModifierGroup.deleteMany({ where: { modifierGroupId: g.id } });
        await prisma.menuModifier.deleteMany({ where: { groupId: g.id } });
        await prisma.menuModifierGroup.delete({ where: { id: g.id } });
        console.log(`   🗑️  Eliminado "${g.name}"`);
    }

    // ── PASO 4: Limpiar duplicados en x4 ──────────────────────────────────────
    // x4 debe quedar con: Principales (compartido), Cremas (Tabla x4) propio max:4,
    // Ensalada (compartido), Shanklish propio max:2, Pan (compartido)
    console.log('4️⃣  Limpiando duplicados en x4...');

    // Desvincular la "Cremas Arma tu Tabla" (max:2) de x4 — x4 usa su propia con max:4
    const cremasCompartida = await prisma.menuModifierGroup.findFirst({
        where: { name: 'Cremas Arma tu Tabla' }
    });
    if (cremasCompartida) {
        await prisma.menuItemModifierGroup.deleteMany({
            where: { menuItemId: x4.id, modifierGroupId: cremasCompartida.id }
        });
        console.log('   ✅ "Cremas Arma tu Tabla" (compartida) desvinculada de x4');
    }

    // Eliminar grupos viejos duplicados de x4 (Principales y Ensalada del viejo script)
    const oldX4Groups = await prisma.menuModifierGroup.findMany({
        where: { name: { in: ['Principales (Tabla x4)', 'Ensalada (Tabla x4)'] } }
    });
    for (const g of oldX4Groups) {
        await prisma.menuItemModifierGroup.deleteMany({ where: { modifierGroupId: g.id } });
        await prisma.menuModifier.deleteMany({ where: { groupId: g.id } });
        await prisma.menuModifierGroup.delete({ where: { id: g.id } });
        console.log(`   🗑️  Eliminado "${g.name}"`);
    }

    // Asegurar que "Cremas (Tabla x4)" tenga max:4
    const cremasX4 = await prisma.menuModifierGroup.findFirst({
        where: { name: 'Cremas (Tabla x4)' }
    });
    if (cremasX4) {
        await prisma.menuModifierGroup.update({
            where: { id: cremasX4.id },
            data: { minSelections: 4, maxSelections: 4, isRequired: true }
        });
        console.log('   ✅ "Cremas (Tabla x4)" confirmada en max:4');
    }

    // ── RESULTADO FINAL ────────────────────────────────────────────────────────
    console.log('\n📊 Estado final:');
    for (const { item, label } of [
        { item: x1, label: 'Tabla x1' },
        { item: x2, label: 'Tabla x2' },
        { item: x4, label: 'Tabla x4' },
    ]) {
        const rels = await prisma.menuItemModifierGroup.findMany({
            where: { menuItemId: item.id },
            include: { modifierGroup: true },
            orderBy: { modifierGroup: { sortOrder: 'asc' } }
        });
        console.log(`\n  ${label}:`);
        rels.forEach(r =>
            console.log(`    [min:${r.modifierGroup.minSelections} max:${r.modifierGroup.maxSelections}] ${r.modifierGroup.name}`)
        );
    }

    console.log('\n✅ Limpieza completada.');
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(async () => await prisma.$disconnect());
