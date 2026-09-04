/**
 * §169.1 — Reverso pendiente de las producciones canceladas antes de §169.
 *
 * Hasta §169, cancelar una orden de producción sólo escribía
 * `status = 'CANCELLED'`: el inventario quedaba como si la producción hubiera
 * ocurrido. Esas órdenes siguen inflando el stock. Este script las encuentra y
 * aplica el reverso que les faltó.
 *
 * Cómo detecta lo pendiente, sin depender de una lista de números:
 * suma TODOS los movimientos de producción de cada orden cancelada. Una orden
 * ya revertida netea en cero (lo que entró salió). Si el neto de un insumo es
 * distinto de cero, ese resto es exactamente lo que falta revertir. Eso lo
 * vuelve idempotente: correrlo dos veces no descuenta dos veces, y las órdenes
 * canceladas después de §169 (que ya se revirtieron solas) quedan fuera.
 *
 * SIMULACIÓN POR DEFECTO. Sin `--apply` no escribe nada.
 *
 *   npx tsx scripts/reverso-producciones-canceladas.ts
 *   npx tsx scripts/reverso-producciones-canceladas.ts --area "CENTRO DE PRODUCCION"
 *   npx tsx scripts/reverso-producciones-canceladas.ts --area "CENTRO DE PRODUCCION" --apply
 *
 * `--area` sólo hace falta para órdenes viejas: sus movimientos no guardaban
 * `areaId` (se empezó a guardar en §169), así que el almacén no se puede
 * deducir. Sin ese dato el script NO adivina: lista las órdenes afectadas y se
 * detiene.
 *
 * Opciones:
 *   --area "<nombre exacto>"  Almacén para las órdenes sin areaId.
 *   --desde YYYY-MM-DD        Sólo órdenes canceladas desde esa fecha.
 *   --apply                   Escribe. Sin esto, sólo simula.
 */

import { PrismaClient } from '@prisma/client';
import { buildProductionReversal } from '../src/lib/inventory/production-reversal';

const prisma = new PrismaClient();

const arg = (name: string): string | undefined => {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 ? process.argv[i + 1] : undefined;
};
const APPLY = process.argv.includes('--apply');
const AREA_NAME = arg('area');
const DESDE = arg('desde');

const n = (x: number) => x.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function main() {
    console.log(`\n  MODO: ${APPLY ? 'APLICAR (escribe en la base)' : 'SIMULACIÓN (no escribe nada)'}\n`);

    const cancelled = await prisma.productionOrder.findMany({
        where: {
            status: 'CANCELLED',
            ...(DESDE ? { createdAt: { gte: new Date(DESDE) } } : {}),
        },
        select: { id: true, orderNumber: true, tenantId: true, createdAt: true, notes: true },
        orderBy: { createdAt: 'desc' },
    });
    console.log(`  Órdenes canceladas encontradas: ${cancelled.length}`);
    if (cancelled.length === 0) return;

    // Almacén de respaldo para las órdenes sin areaId en sus movimientos.
    let fallbackAreaId: string | null = null;
    if (AREA_NAME) {
        const areas = await prisma.area.findMany({ where: { name: AREA_NAME } });
        if (areas.length !== 1) {
            console.error(`\n  "${AREA_NAME}": ${areas.length === 0 ? 'no existe' : 'hay más de uno con ese nombre'}. Abortado.`);
            process.exit(1);
        }
        fallbackAreaId = areas[0].id;
        console.log(`  Almacén de respaldo: "${AREA_NAME}"`);
    }

    const pendientes: {
        order: typeof cancelled[number];
        lines: { inventoryItemId: string; delta: number; unit: string; movementType: 'PRODUCTION_IN' | 'PRODUCTION_OUT' }[];
        areaId: string;
    }[] = [];
    const sinArea: string[] = [];
    let yaRevertidas = 0;

    for (const order of cancelled) {
        const movements = await prisma.inventoryMovement.findMany({
            where: {
                movementType: { in: ['PRODUCTION_IN', 'PRODUCTION_OUT'] },
                inventoryItem: { tenantId: order.tenantId },
                OR: [
                    { productionOrderId: order.id },
                    { notes: { contains: `Orden: ${order.orderNumber}` } },
                ],
            },
            select: {
                id: true, inventoryItemId: true, movementType: true,
                quantity: true, unit: true, areaId: true,
            },
        });
        if (movements.length === 0) continue;

        // El neto incluye cualquier reverso ya aplicado: si netea cero, no
        // queda nada pendiente.
        const plan = buildProductionReversal(movements, fallbackAreaId);
        if (!plan.ok) {
            if (plan.reason === 'NO_MOVEMENTS') { yaRevertidas++; continue; }
            if (plan.reason === 'AREA_UNKNOWN') { sinArea.push(order.orderNumber); continue; }
            console.log(`  ! ${order.orderNumber}: movimientos en varios almacenes — se omite, revisar a mano.`);
            continue;
        }
        pendientes.push({ order, lines: plan.lines, areaId: plan.areaId });
    }

    console.log(`  Ya revertidas (netean en cero): ${yaRevertidas}`);
    console.log(`  Con reverso PENDIENTE: ${pendientes.length}`);
    if (sinArea.length > 0) {
        console.log(`\n  ${sinArea.length} orden(es) sin almacén registrado. Volvé a correr con --area "<nombre>":`);
        console.log(`    ${sinArea.join(', ')}`);
    }
    if (pendientes.length === 0) {
        console.log('\n  Nada que aplicar.\n');
        return;
    }

    // Nombres de insumo y stock actual, para mostrar el impacto.
    const itemIds = Array.from(new Set(pendientes.flatMap(p => p.lines.map(l => l.inventoryItemId))));
    const items = await prisma.inventoryItem.findMany({
        where: { id: { in: itemIds } },
        select: { id: true, name: true, baseUnit: true },
    });
    const itemById = Object.fromEntries(items.map(i => [i.id, i]));

    console.log('\n  ── Detalle ─────────────────────────────────────────────');
    const netoPorInsumo = new Map<string, number>();
    for (const p of pendientes) {
        console.log(`\n  ${p.order.orderNumber}  (cancelada ${p.order.createdAt.toISOString().slice(0, 10)})`);
        for (const l of p.lines) {
            const it = itemById[l.inventoryItemId];
            const signo = l.delta > 0 ? '+' : '';
            console.log(`      ${signo}${n(l.delta)} ${it?.baseUnit ?? ''}  ${it?.name ?? l.inventoryItemId}`);
            netoPorInsumo.set(l.inventoryItemId, (netoPorInsumo.get(l.inventoryItemId) ?? 0) + l.delta);
        }
    }

    console.log('\n  ── Efecto total por insumo ─────────────────────────────');
    const stockRows = await prisma.inventoryLocation.findMany({
        where: {
            areaId: { in: Array.from(new Set(pendientes.map(p => p.areaId))) },
            inventoryItemId: { in: itemIds },
        },
        select: { inventoryItemId: true, currentStock: true },
    });
    const stockByItem: Record<string, number> = {};
    for (const r of stockRows) {
        stockByItem[r.inventoryItemId] = (stockByItem[r.inventoryItemId] ?? 0) + Number(r.currentStock);
    }
    const negativos: string[] = [];
    for (const [itemId, delta] of Array.from(netoPorInsumo.entries()).sort((a, b) => a[1] - b[1])) {
        const it = itemById[itemId];
        const antes = stockByItem[itemId] ?? 0;
        const despues = Math.round((antes + delta) * 10000) / 10000;
        const marca = despues < -0.0001 ? '  <-- QUEDA NEGATIVO' : '';
        if (marca) negativos.push(it?.name ?? itemId);
        console.log(`      ${(it?.name ?? itemId).padEnd(34)} ${n(antes)} → ${n(despues)} ${it?.baseUnit ?? ''}${marca}`);
    }
    if (negativos.length > 0) {
        console.log(`\n  ${negativos.length} insumo(s) quedan en negativo. Es esperable si lo producido ya`);
        console.log('  se consumió o se vendió: el negativo se salda con la próxima entrada.');
    }

    if (!APPLY) {
        console.log('\n  Simulación terminada. Nada fue modificado.');
        console.log('  Para aplicarlo, repetí el comando agregando --apply\n');
        return;
    }

    const owner = await prisma.user.findFirst({
        where: { tenantId: pendientes[0].order.tenantId, role: 'OWNER' },
        select: { id: true },
    });
    if (!owner) { console.error('No se encontró un OWNER para firmar los movimientos.'); process.exit(1); }

    let aplicadas = 0;
    for (const p of pendientes) {
        await prisma.$transaction(async (tx) => {
            for (const l of p.lines) {
                await tx.inventoryLocation.upsert({
                    where: {
                        inventoryItemId_areaId: { inventoryItemId: l.inventoryItemId, areaId: p.areaId },
                    },
                    update: { currentStock: { increment: l.delta } },
                    create: { inventoryItemId: l.inventoryItemId, areaId: p.areaId, currentStock: l.delta },
                });
                // Nada se borra: el reverso es un movimiento nuevo, explicado.
                await tx.inventoryMovement.create({
                    data: {
                        inventoryItemId: l.inventoryItemId,
                        movementType: l.movementType,
                        quantity: l.delta,
                        unit: l.unit,
                        areaId: p.areaId,
                        productionOrderId: p.order.id,
                        reason: `Reverso por cancelación de producción ${p.order.orderNumber}`,
                        notes: `Orden: ${p.order.orderNumber} · reverso retroactivo §169.1`,
                        createdById: owner.id,
                    },
                });
            }
            await tx.productionOrder.updateMany({
                where: { id: p.order.id },
                data: {
                    notes: [p.order.notes, 'Inventario revertido retroactivamente (§169.1)']
                        .filter(Boolean).join(' · '),
                },
            });
        }, { timeout: 120_000 });
        aplicadas++;
        console.log(`  ✓ ${p.order.orderNumber}`);
    }

    console.log(`\n  Listo. ${aplicadas} orden(es) revertidas, con movimientos trazables en el Kardex.\n`);
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
