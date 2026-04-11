/**
 * fix-movil-ng-amounts.ts
 *
 * Corrige las 25 órdenes históricas donde amountPaid fue guardado como
 * total_USD / exchangeRate en lugar de total_USD.
 *
 * Root cause: el cajero ingresaba el monto USD en el campo Bs, y el código
 * lo dividía por el tipo de cambio. Ej: $22.50 / 476 = $0.0472 guardado.
 *
 * Fix: amountPaid = total, change = 0 para todas las órdenes afectadas.
 *
 * Criterio de selección:
 *   - paymentMethod IN ('MOVIL_NG', 'PDV_SHANKLISH', 'PDV_SUPERFERRO', 'CASH_BS')
 *   - amountPaid > 0 AND amountPaid < 1
 *   - status != 'CANCELLED'
 *
 * Uso:
 *   npx ts-node --compiler-options '{"module":"commonjs"}' scripts/fix-movil-ng-amounts.ts
 *   # Agregar --dry-run para solo mostrar sin modificar:
 *   npx ts-node --compiler-options '{"module":"commonjs"}' scripts/fix-movil-ng-amounts.ts --dry-run
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
    console.log(`\n=== fix-movil-ng-amounts.ts ===`);
    console.log(`Modo: ${DRY_RUN ? 'DRY RUN (sin cambios)' : 'EJECUCIÓN REAL'}\n`);

    // 1. Encontrar todas las órdenes afectadas
    const affected = await prisma.salesOrder.findMany({
        where: {
            paymentMethod: { in: ['MOVIL_NG', 'PDV_SHANKLISH', 'PDV_SUPERFERRO', 'CASH_BS'] },
            amountPaid: { gt: 0, lt: 1 },
            status: { not: 'CANCELLED' },
        },
        select: {
            id: true,
            orderNumber: true,
            total: true,
            amountPaid: true,
            change: true,
            paymentMethod: true,
            createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
    });

    if (affected.length === 0) {
        console.log('✅ No se encontraron órdenes afectadas. Nada que corregir.');
        return;
    }

    console.log(`Órdenes a corregir: ${affected.length}\n`);
    console.log(
        'Orden'.padEnd(12) +
        'Método'.padEnd(18) +
        'Total'.padEnd(10) +
        'amountPaid (antes)'.padEnd(22) +
        'amountPaid (después)'.padEnd(22) +
        'Fecha'
    );
    console.log('─'.repeat(100));

    for (const o of affected) {
        const before = o.amountPaid?.toFixed(8) ?? 'null';
        const after = o.total.toFixed(2);
        const fecha = o.createdAt.toISOString().replace('T', ' ').substring(0, 19);

        console.log(
            o.orderNumber.padEnd(12) +
            (o.paymentMethod ?? '').padEnd(18) +
            `$${o.total.toFixed(2)}`.padEnd(10) +
            `$${before}`.padEnd(22) +
            `$${after}`.padEnd(22) +
            fecha
        );
    }

    console.log('─'.repeat(100));

    if (DRY_RUN) {
        console.log(`\n🔍 DRY RUN: ${affected.length} órdenes serían corregidas. Ejecutar sin --dry-run para aplicar.`);
        return;
    }

    // 2. Ejecutar correcciones en una transacción
    console.log(`\nAplicando correcciones...`);

    const result = await prisma.$transaction(async (tx) => {
        let updated = 0;
        for (const o of affected) {
            await tx.salesOrder.update({
                where: { id: o.id },
                data: {
                    amountPaid: o.total,
                    change: 0,
                },
            });
            updated++;
        }
        return updated;
    });

    console.log(`\n✅ ${result} órdenes corregidas exitosamente.`);

    // 3. Verificación post-fix
    const remaining = await prisma.salesOrder.count({
        where: {
            paymentMethod: { in: ['MOVIL_NG', 'PDV_SHANKLISH', 'PDV_SUPERFERRO', 'CASH_BS'] },
            amountPaid: { gt: 0, lt: 1 },
            status: { not: 'CANCELLED' },
        },
    });

    if (remaining === 0) {
        console.log('✅ Verificación: 0 órdenes afectadas restantes. Fix completo.');
    } else {
        console.warn(`⚠️  Verificación: aún quedan ${remaining} órdenes con amountPaid < $1. Revisar manualmente.`);
    }
}

main()
    .catch((e) => {
        console.error('❌ Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
