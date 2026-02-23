const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAudits() {
    const audits = await prisma.inventoryAudit.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { createdBy: true }
    });
    for (let m of audits) {
        console.log('Audit:', m.id, m.name, m.status, 'Area:', m.areaId);
    }
}

checkAudits().catch(console.error).finally(() => prisma.$disconnect());
