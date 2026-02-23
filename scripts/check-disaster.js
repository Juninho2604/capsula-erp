const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDisaster() {
    const locs = await prisma.inventoryLocation.findMany({ include: { area: true, inventoryItem: true } });

    const areaMap = {};
    for (let l of locs) {
        if (!areaMap[l.area.name]) areaMap[l.area.name] = [];
        areaMap[l.area.name].push({ name: l.inventoryItem.name, stock: l.currentStock });
    }

    for (let area in areaMap) {
        console.log('Area:', area, '- Items count:', areaMap[area].length);
        if (areaMap[area].length > 0) {
            console.log('  Sample:', areaMap[area].slice(0, 5));
        }
    }

    const movs = await prisma.inventoryMovement.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { inventoryItem: true, createdBy: true }
    });
    console.log('\nRecent 10 movements:');
    for (let m of movs) {
        console.log(m.id, m.inventoryItem.name, m.movementType, m.quantity, m.reason, m.createdAt);
    }
}

checkDisaster().catch(console.error).finally(() => prisma.$disconnect());
