const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkOscar() {
    const oscar = await prisma.user.findFirst({ where: { firstName: { contains: 'Oscar' } } });
    if (!oscar) {
        console.log('Oscar not found');
        return;
    }
    console.log('Oscar ID:', oscar.id);
    const movs = await prisma.inventoryMovement.findMany({
        where: { createdById: oscar.id, movementType: 'PURCHASE' },
        include: { inventoryItem: true }
    });
    console.log('Movimientos:', movs.length);
    for (const m of movs) {
        console.log(m.id, m.inventoryItem.name, m.reason);
    }
}
checkOscar().catch(console.error).finally(() => prisma.$disconnect());
