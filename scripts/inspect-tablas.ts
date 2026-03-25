
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const groups = await prisma.menuModifierGroup.findMany({
        where: { name: { contains: 'Tabla', mode: 'insensitive' } },
        include: { modifiers: true, menuItems: { include: { menuItem: true } } }
    });
    for (const g of groups) {
        console.log(`\n--- "${g.name}" (min:${g.minSelections} max:${g.maxSelections})`);
        console.log(`    Vinculado a: ${g.menuItems.map(r => r.menuItem.name).join(', ') || '(ninguno)'}`);
        g.modifiers.forEach(m => console.log(`    + ${m.name}`));
    }

    // También grupos con "Arma" o "Shanklish" o "Pan"
    const extra = await prisma.menuModifierGroup.findMany({
        where: { name: { in: [
            'Principales Arma tu tabla', 'Cremas Arma tu Tabla',
            'Ensalada Arma tu Tabla', 'Shanklish Arma tu tabla', 'Pan Arma tu Shanklish'
        ]}},
        include: { modifiers: true, menuItems: { include: { menuItem: true } } }
    });
    for (const g of extra) {
        console.log(`\n--- "${g.name}" (min:${g.minSelections} max:${g.maxSelections})`);
        console.log(`    Vinculado a: ${g.menuItems.map(r => r.menuItem.name).join(', ') || '(ninguno)'}`);
        g.modifiers.forEach(m => console.log(`    + ${m.name}`));
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
