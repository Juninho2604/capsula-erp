const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixOscar() {
    const oscar = await prisma.user.findFirst({ where: { firstName: { contains: 'Oscar' } } });
    const movs = await prisma.inventoryMovement.findMany({
        where: { createdById: oscar.id, movementType: 'PURCHASE' },
        include: { inventoryItem: true }
    });
    for (const m of movs) {
        // Find area updated near this movement for this item
        const locs = await prisma.inventoryLocation.findMany({
            where: { inventoryItemId: m.inventoryItemId, currentStock: { gt: 0 } },
            include: { area: true }
        });
        if (locs.length > 0) {
            const areaName = locs[0].area.name;
            if (!m.reason.includes('Almacén')) {
                const newReason = m.reason + ` (${areaName})`;
                await prisma.inventoryMovement.update({
                    where: { id: m.id },
                    data: { reason: newReason }
                });
                console.log('Fixed:', m.inventoryItem.name, '->', newReason);
            }
        }
    }
}
fixOscar().catch(console.error).finally(() => prisma.$disconnect());
