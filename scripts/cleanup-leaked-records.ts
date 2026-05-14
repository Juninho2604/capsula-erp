/**
 * cleanup-leaked-records.ts
 * --------------------------
 * Detecta y opcionalmente borra registros tenant-aware que tienen
 * tenantId=tnt_shanklish_caracas (default del schema) pero referencian
 * recursos (branches, tables, etc.) de OTRO tenant.
 *
 * Causa raíz: hasta PR de hoy, varios .create() en pos.actions.ts no
 * pasaban tenantId explícitamente y caían al default del schema. Si el
 * caller actuaba sobre un tenant != shanklish (ej. demo), el registro
 * quedaba con tenantId=shanklish + FKs apuntando a recursos de demo.
 *
 * Modos:
 *   --dry-run    (default) solo lista lo encontrado
 *   --apply      borra los registros leakeados (irreversible)
 *
 * Uso:
 *   set -a && source /var/www/capsula-erp/.env && set +a && \
 *   cd /var/www/capsula-erp && \
 *   npx tsx scripts/cleanup-leaked-records.ts --dry-run
 *
 * Cuando confirmes que la lista es razonable, re-correr con --apply.
 */

import { PrismaClient } from '@prisma/client';

const SHANKLISH_TENANT_ID = 'tnt_shanklish_caracas';

interface Args {
    apply: boolean;
}

function parseArgs(): Args {
    const args = process.argv.slice(2);
    return { apply: args.includes('--apply') };
}

async function main() {
    const args = parseArgs();
    const prisma = new PrismaClient();

    console.log('=========================================');
    console.log(' Cleanup de registros leakeados');
    console.log('=========================================');
    console.log(`Modo: ${args.apply ? 'APPLY (BORRA)' : 'dry-run (solo lista)'}`);
    console.log('');

    try {
        // ─── OpenTab leakeadas ──────────────────────────────────────────
        // OpenTab.tenantId = shanklish PERO la branch referenciada tiene
        // tenantId distinto → leak.
        const leakedTabs = await prisma.openTab.findMany({
            where: { tenantId: SHANKLISH_TENANT_ID },
            include: {
                branch: { select: { id: true, tenantId: true, name: true } },
            },
        });
        const reallyLeakedTabs = leakedTabs.filter(
            (t) => t.branch && t.branch.tenantId !== SHANKLISH_TENANT_ID,
        );

        console.log(`OpenTabs sospechosas (tenantId=shanklish, branch de otro tenant): ${reallyLeakedTabs.length}`);
        for (const t of reallyLeakedTabs) {
            console.log(`  - openTabId=${t.id} tabCode=${t.tabCode} branch=${t.branch?.name} (tenant real=${t.branch?.tenantId})`);
        }
        console.log('');

        // ─── SalesOrder leakeadas (vinculadas a esas OpenTabs) ─────────
        // Las SalesOrder se unen a OpenTab via OpenTabOrder (pivot sin
        // tenantId). Filtramos por openTabOrders.openTab.id en la lista.
        const leakedTabIds = new Set(reallyLeakedTabs.map((t) => t.id));
        const leakedOrders =
            leakedTabIds.size > 0
                ? await prisma.salesOrder.findMany({
                      where: {
                          tenantId: SHANKLISH_TENANT_ID,
                          openTabLinks: {
                              some: { openTabId: { in: Array.from(leakedTabIds) } },
                          },
                      },
                      include: { items: { select: { id: true } } },
                  })
                : [];

        console.log(`SalesOrders sospechosas (tenantId=shanklish, openTab de otro tenant): ${leakedOrders.length}`);
        for (const o of leakedOrders) {
            console.log(`  - orderId=${o.id} number=${o.orderNumber} total=${o.total} items=${o.items.length}`);
        }
        console.log('');

        if (!args.apply) {
            console.log('Sin --apply, no se borra nada. Re-correr con --apply para limpiar.');
            return;
        }

        // ─── APPLY: borrar children primero, luego parents ──────────────
        console.log('BORRANDO...');

        const orderIds = leakedOrders.map((o) => o.id);
        if (orderIds.length > 0) {
            const itemIds = leakedOrders.flatMap((o) => o.items.map((i) => i.id));
            // payment splits (apuntan a salesOrder)
            const pmt = await prisma.paymentSplit.deleteMany({
                where: { salesOrderId: { in: orderIds } },
            });
            console.log(`  - PaymentSplit borrados: ${pmt.count}`);

            const sai = await prisma.subAccountItem.deleteMany({
                where: { salesOrderItemId: { in: itemIds } },
            });
            console.log(`  - SubAccountItem borrados: ${sai.count}`);

            const oti = await prisma.salesOrderItem.deleteMany({
                where: { orderId: { in: orderIds } },
            });
            console.log(`  - SalesOrderItem borrados: ${oti.count}`);

            const oto = await prisma.openTabOrder.deleteMany({
                where: { salesOrderId: { in: orderIds } },
            });
            console.log(`  - OpenTabOrder pivots borrados: ${oto.count}`);

            const ord = await prisma.salesOrder.deleteMany({
                where: { id: { in: orderIds } },
            });
            console.log(`  - SalesOrder borrados: ${ord.count}`);
        }

        if (reallyLeakedTabs.length > 0) {
            const tabIds = reallyLeakedTabs.map((t) => t.id);
            const sub = await prisma.tabSubAccount.deleteMany({
                where: { openTabId: { in: tabIds } },
            });
            console.log(`  - TabSubAccount borrados: ${sub.count}`);

            const tab = await prisma.openTab.deleteMany({
                where: { id: { in: tabIds } },
            });
            console.log(`  - OpenTab borrados: ${tab.count}`);
        }

        console.log('');
        console.log('Cleanup completo.');
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((err) => {
    console.error('Error:', err instanceof Error ? err.message : err);
    process.exit(1);
});
