const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function undo() {
    const owner = await prisma.user.findFirst({ where: { role: 'OWNER' } });

    const auditIds = [
        'cmlyokngz0002bz17rpeqm3v6',
        'cmlyo3xxn00fxo5j1u028qvrt',
        'cmlynxm6y000267vrnu21zt39'
    ];

    for (let auditId of auditIds) {
        console.log('Undoing Audit', auditId);
        const audit = await prisma.inventoryAudit.findUnique({
            where: { id: auditId },
            include: { items: true }
        });
        if (!audit || audit.status !== 'APPROVED') {
            console.log('Skipping', audit?.status);
            continue;
        }

        await prisma.inventoryAudit.update({
            where: { id: auditId },
            data: {
                status: 'VOIDED',
                notes: (audit.notes || '') + `\n[ANULADO AUTO] Reversión por emergencia técnica.`
            }
        });

        for (const item of audit.items) {
            if (Math.abs(item.difference) > 0.0001) {
                const reversalType = item.difference > 0 ? 'ADJUSTMENT_OUT' : 'ADJUSTMENT_IN';
                const qty = Math.abs(item.difference);

                await prisma.inventoryMovement.create({
                    data: {
                        inventoryItemId: item.inventoryItemId,
                        movementType: reversalType,
                        quantity: qty,
                        unit: 'UNIT',
                        reason: `Anulación Auditoría: ${audit.name}`,
                        notes: `Reversión automática de auditoría #${audit.id}`,
                        createdById: owner.id,
                        totalCost: item.costSnapshot ? item.costSnapshot * qty : 0
                    }
                });

                if (audit.areaId) {
                    await prisma.inventoryLocation.updateMany({
                        where: {
                            inventoryItemId: item.inventoryItemId,
                            areaId: audit.areaId
                        },
                        data: {
                            currentStock: { increment: -item.difference }
                        }
                    });
                }
            }
        }
        console.log('Done', auditId);
    }
}

undo().catch(console.error).finally(() => prisma.$disconnect());
