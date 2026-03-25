
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Replica el grupo de Shanklish Preparado de Tabla x1 (configurado por la cajera)
 * hacia Tabla x2 y Tabla x4, con los límites correctos:
 *
 *   Tabla x1 → max 1 shanklish
 *   Tabla x2 → max 1 shanklish
 *   Tabla x4 → max 2 shanklish
 */
async function main() {
    console.log('🧀 Arreglando Shanklish Preparado en Tabla x2 y Tabla x4...\n');

    // ── Buscar los 3 items de Tabla ────────────────────────────────────────────
    const tablaX1 = await prisma.menuItem.findFirst({ where: { name: { contains: 'Tabla x1', mode: 'insensitive' } } });
    const tablaX2 = await prisma.menuItem.findFirst({ where: { name: { contains: 'Tabla x2', mode: 'insensitive' } } });
    const tablaX4 = await prisma.menuItem.findFirst({ where: { name: { contains: 'Tabla x4', mode: 'insensitive' } } });

    if (!tablaX1) { console.error('❌ No se encontró Tabla x1 en el menú.'); return; }
    if (!tablaX2) { console.error('❌ No se encontró Tabla x2 en el menú.'); return; }
    if (!tablaX4) { console.error('❌ No se encontró Tabla x4 en el menú.'); return; }

    console.log(`✅ Tabla x1: ${tablaX1.id}`);
    console.log(`✅ Tabla x2: ${tablaX2.id}`);
    console.log(`✅ Tabla x4: ${tablaX4.id}\n`);

    // ── Buscar el grupo de Shanklish vinculado a Tabla x1 ─────────────────────
    const x1Relations = await prisma.menuItemModifierGroup.findMany({
        where: { menuItemId: tablaX1.id },
        include: {
            modifierGroup: {
                include: { modifiers: true }
            }
        }
    });

    const shanklishGroup = x1Relations.find(r =>
        r.modifierGroup.name.toLowerCase().includes('shanklish')
    );

    if (!shanklishGroup) {
        console.error('❌ No se encontró un grupo de Shanklish vinculado a Tabla x1.');
        console.log('   Grupos actuales en x1:');
        x1Relations.forEach(r => console.log(`   - "${r.modifierGroup.name}"`));
        console.log('\n   ➡️  Verifica que la cajera haya creado y vinculado el grupo de Shanklish a Tabla x1 desde Modificadores.');
        return;
    }

    const sourceGroup = shanklishGroup.modifierGroup;
    console.log(`📋 Grupo Shanklish encontrado en x1: "${sourceGroup.name}"`);
    console.log(`   Opciones: ${sourceGroup.modifiers.map(m => m.name).join(', ')}`);
    console.log(`   max actual (x1): ${sourceGroup.maxSelections}\n`);

    // ── Configuración destino: x2=1, x4=2 ──────────────────────────────────────
    const targets = [
        { item: tablaX2, label: 'Tabla x2', max: 1 },
        { item: tablaX4, label: 'Tabla x4', max: 2 },
    ];

    for (const { item, label, max } of targets) {
        console.log(`🔧 Procesando ${label}...`);

        // Verificar si ya tiene un grupo de Shanklish
        const existingRelations = await prisma.menuItemModifierGroup.findMany({
            where: { menuItemId: item.id },
            include: { modifierGroup: true }
        });

        const existingShanklish = existingRelations.find(r =>
            r.modifierGroup.name.toLowerCase().includes('shanklish')
        );

        if (existingShanklish) {
            // Actualizar el maxSelections del grupo existente
            await prisma.menuModifierGroup.update({
                where: { id: existingShanklish.modifierGroup.id },
                data: {
                    minSelections: max,
                    maxSelections: max,
                }
            });
            console.log(`   ♻️  Grupo "${existingShanklish.modifierGroup.name}" ya existía → maxSelections actualizado a ${max}`);
        } else {
            // Crear un grupo nuevo copiando las opciones de x1
            const newGroup = await prisma.menuModifierGroup.create({
                data: {
                    name: `Shanklish Preparado (${label})`,
                    description: sourceGroup.description,
                    isRequired: true,
                    minSelections: max,
                    maxSelections: max,
                    sortOrder: sourceGroup.sortOrder,
                    modifiers: {
                        create: sourceGroup.modifiers.map(m => ({
                            name: m.name,
                            priceAdjustment: m.priceAdjustment,
                            sortOrder: m.sortOrder,
                            isAvailable: m.isAvailable,
                            linkedMenuItemId: m.linkedMenuItemId,
                        }))
                    }
                }
            });

            // Vincular el grupo al item
            await prisma.menuItemModifierGroup.create({
                data: {
                    menuItemId: item.id,
                    modifierGroupId: newGroup.id,
                }
            });

            console.log(`   ✅ Grupo "${newGroup.name}" creado y vinculado (max: ${max})`);
            console.log(`      Opciones copiadas: ${sourceGroup.modifiers.map(m => m.name).join(', ')}`);
        }
    }

    // ── Verificar resultado final ───────────────────────────────────────────────
    console.log('\n📊 Resumen final de modificadores por Tabla:');
    for (const { item, label } of [
        { item: tablaX1, label: 'Tabla x1' },
        { item: tablaX2, label: 'Tabla x2' },
        { item: tablaX4, label: 'Tabla x4' },
    ]) {
        const rels = await prisma.menuItemModifierGroup.findMany({
            where: { menuItemId: item.id },
            include: { modifierGroup: true }
        });
        console.log(`\n  ${label}:`);
        rels.forEach(r =>
            console.log(`    - ${r.modifierGroup.name} (min:${r.modifierGroup.minSelections} max:${r.modifierGroup.maxSelections})`)
        );
    }

    console.log('\n✅ Listo.');
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(async () => await prisma.$disconnect());
