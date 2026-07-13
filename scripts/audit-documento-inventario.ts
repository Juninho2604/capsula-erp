/**
 * audit-documento-inventario.ts (§108.1) — Verifica que las cantidades de un
 * documento de proveedor (factura/nota) entraron EXACTAS al almacén:
 * compara cada línea del documento contra los movimientos PURCHASE con esa
 * referencia y contra el stock. SOLO LECTURA.
 *
 * Uso:
 *   npx tsx scripts/audit-documento-inventario.ts --tenant-slug=shanklish --docs=F-00123,NE-456
 *   npx tsx scripts/audit-documento-inventario.ts --tenant-slug=shanklish --last=5
 * (--docs = documentNumber; --last = últimos N documentos con entrada)
 */

import { PrismaClient } from '@prisma/client';

async function main() {
    const args: Record<string, string> = {};
    for (const a of process.argv.slice(2)) {
        if (!a.startsWith('--')) continue;
        const [k, ...rest] = a.slice(2).split('=');
        args[k] = rest.length ? rest.join('=') : 'true';
    }
    const slug = args['tenant-slug'];
    const docNums = (args['docs'] || '').split(',').map(t => t.trim()).filter(Boolean);
    const lastN = parseInt(args['last'] || '0', 10) || 0;
    if (!slug || (docNums.length === 0 && lastN === 0)) {
        console.error('Uso: --tenant-slug=shanklish --docs=F-00123  (o --last=5)');
        process.exit(2);
    }
    const prisma = new PrismaClient();
    const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true, name: true } });
    if (!tenant) { console.error('Tenant no existe'); process.exit(2); }

    const docs = await prisma.supplierDocument.findMany({
        where: {
            tenantId: tenant.id,
            ...(docNums.length > 0
                ? { documentNumber: { in: docNums } }
                : { inventoryStatus: 'ENTERED' }),
        },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        take: docNums.length > 0 ? undefined : lastN,
    });

    console.log(`\n═══ AUDITORÍA DOCUMENTO ↔ INVENTARIO · ${tenant.name} ═══ (solo lectura)\n`);
    if (docs.length === 0) {
        console.log('No se encontraron documentos con esos criterios.');
        await prisma.$disconnect();
        return;
    }

    const fq = (n: number) => n.toLocaleString('es-VE', { maximumFractionDigits: 4 });
    let allOk = true;

    for (const doc of docs) {
        console.log(`── ${doc.documentType} ${doc.documentNumber} · ${doc.supplierName ?? 's/prov'} · ${doc.documentDate.toISOString().slice(0, 10)}`);
        console.log(`   estado=${doc.status} · inventario=${doc.inventoryStatus} · total=$${doc.totalAmount.toFixed(2)} (${doc.currency})`);
        if (doc.notes) console.log(`   notas: ${doc.notes}`);
        if (doc.inventoryStatus !== 'ENTERED') {
            console.log('   ⚠ Aún sin entrada a inventario — nada que comparar.\n');
            continue;
        }

        // Movimientos PURCHASE con la referencia de este documento.
        const itemIds = doc.items.map(i => i.inventoryItemId);
        const movements = await prisma.inventoryMovement.findMany({
            where: {
                movementType: 'PURCHASE',
                referenceNumber: doc.documentNumber,
                inventoryItemId: { in: itemIds },
                ...(doc.inventoryEnteredAt ? {
                    createdAt: {
                        gte: new Date(doc.inventoryEnteredAt.getTime() - 10 * 60 * 1000),
                        lte: new Date(doc.inventoryEnteredAt.getTime() + 10 * 60 * 1000),
                    },
                } : {}),
            },
            select: { inventoryItemId: true, quantity: true, unit: true, unitCost: true, createdAt: true },
        });

        const items = await prisma.inventoryItem.findMany({
            where: { id: { in: itemIds } },
            select: { id: true, name: true, baseUnit: true },
        });
        const itemById = new Map(items.map(i => [i.id, i]));

        let docOk = true;
        for (const line of doc.items) {
            const it = itemById.get(line.inventoryItemId);
            const movs = movements.filter(m => m.inventoryItemId === line.inventoryItemId);
            const movedQty = movs.reduce((s, m) => s + Number(m.quantity), 0);
            const diff = Math.round((movedQty - line.quantity) * 10000) / 10000;
            const unitMismatch = it && line.unit && it.baseUnit !== line.unit;
            const ok = Math.abs(diff) < 0.0001 && !unitMismatch;
            if (!ok) { docOk = false; allOk = false; }
            console.log(`   ${ok ? '✓' : '✗'} ${line.itemName}`);
            console.log(`       documento: ${fq(line.quantity)} ${line.unit || '?'} @ $${line.unitCost.toFixed(4)}  →  almacén: ${fq(movedQty)} ${it?.baseUnit ?? '?'} en ${movs.length} movimiento(s)`);
            if (Math.abs(diff) >= 0.0001) console.log(`       ⚠ DESCUADRE de cantidad: ${diff > 0 ? '+' : ''}${fq(diff)}`);
            if (unitMismatch) console.log(`       ⚠ UNIDAD distinta a la base del insumo (doc=${line.unit}, base=${it!.baseUnit}) — revisar conversión`);
            if (movs.length === 0) console.log('       ⚠ Sin movimientos PURCHASE con esta referencia en la ventana de entrada');
        }
        console.log(`   VEREDICTO: ${docOk ? '✓ cantidades exactas' : '✗ HAY DESCUADRES — revisar arriba'}\n`);
    }

    console.log(`═══ RESULTADO GLOBAL: ${allOk ? '✓ todo cuadra' : '✗ hay descuadres'} ═══\n`);
    await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
