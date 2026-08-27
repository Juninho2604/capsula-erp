/**
 * §166 — Unificar dos almacenes duplicados en uno.
 *
 * Caso que lo motiva: Shanklish tiene `Almacén Principal` (194 ítems) y
 * `ALMACÉN PRINCIPAL` (21 ítems). Son el mismo depósito escrito de dos formas;
 * lo que entra en uno no aparece en el otro.
 *
 * Qué hace, en una transacción:
 *   1. Mueve el stock del almacén ORIGEN al DESTINO (suma sobre lo existente).
 *   2. Deja DOS movimientos por ítem — TRANSFER de salida y de entrada, con
 *      `areaId` puesto — para que el Kardex explique el traslado. No se toca
 *      ningún saldo sin dejar rastro.
 *   3. Repunta al destino las referencias de otras tablas (conteos, auditorías,
 *      requisiciones, etc.) para no dejar registros huérfanos.
 *   4. Desactiva el almacén origen, para que nadie vuelva a recibir ahí.
 *
 * SIMULACIÓN POR DEFECTO. Sin `--apply` sólo imprime lo que haría.
 *
 *   npx tsx scripts/unificar-almacenes.ts --origen "ALMACÉN PRINCIPAL" --destino "Almacén Principal"
 *   npx tsx scripts/unificar-almacenes.ts --origen "..." --destino "..." --apply
 *
 * El match del nombre es EXACTO y distingue mayúsculas — justamente porque el
 * problema es que dos nombres se parecen. Si hay ambigüedad, aborta.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 ? process.argv[i + 1] : undefined;
}

const APPLY = process.argv.includes('--apply');
const ORIGEN = arg('origen');
const DESTINO = arg('destino');
const n = (x: number) => x.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function findArea(name: string) {
    // findMany + filtro exacto en JS: Postgres puede tener collation
    // case-insensitive y devolver los dos duplicados con `equals`.
    const rows = await prisma.area.findMany({ where: { name: { contains: name, mode: 'insensitive' } } });
    const exact = rows.filter(r => r.name === name);
    if (exact.length === 1) return exact[0];
    if (exact.length === 0) {
        console.error(`\n  No existe un almacén con el nombre EXACTO "${name}".`);
        if (rows.length) console.error('   Parecidos:', rows.map(r => `"${r.name}"`).join(', '));
        return null;
    }
    console.error(`\n  Hay ${exact.length} almacenes con el nombre exacto "${name}". Ambiguo, abortado.`);
    return null;
}

async function main() {
    if (!ORIGEN || !DESTINO) {
        console.error('Uso: --origen "<nombre exacto>" --destino "<nombre exacto>" [--apply]');
        process.exit(1);
    }
    if (ORIGEN === DESTINO) {
        console.error('Origen y destino son el mismo almacén.');
        process.exit(1);
    }

    const origen = await findArea(ORIGEN);
    const destino = await findArea(DESTINO);
    if (!origen || !destino) process.exit(1);
    if (origen.tenantId !== destino.tenantId) {
        console.error('Los almacenes son de negocios distintos. Abortado.');
        process.exit(1);
    }

    const locs = await prisma.inventoryLocation.findMany({
        where: { areaId: origen.id },
        include: { inventoryItem: { select: { name: true, baseUnit: true } } },
    });

    console.log(`\n  ORIGEN   "${origen.name}"  (${locs.length} ubicaciones)`);
    console.log(`  DESTINO  "${destino.name}"`);
    console.log(`  MODO     ${APPLY ? 'APLICAR (escribe en la base)' : 'SIMULACIÓN (no escribe nada)'}\n`);

    const conStock = locs.filter(l => Number(l.currentStock) !== 0);
    console.log(`  Ubicaciones con stock distinto de cero: ${conStock.length}`);
    for (const l of conStock) {
        console.log(`    ${l.inventoryItem.name}: ${n(Number(l.currentStock))} ${l.inventoryItem.baseUnit}`);
    }

    // Referencias en otras tablas que apuntan al origen.
    const refs = {
        movimientos:    await prisma.inventoryMovement.count({ where: { areaId: origen.id } }),
        requisicionesO: await prisma.requisition.count({ where: { sourceAreaId: origen.id } }),
        requisicionesD: await prisma.requisition.count({ where: { targetAreaId: origen.id } }),
        inventDiarios:  await prisma.dailyInventory.count({ where: { areaId: origen.id } }),
        auditorias:     await prisma.inventoryAudit.count({ where: { areaId: origen.id } }),
    };
    console.log('\n  Referencias que se repuntan al destino:');
    for (const [k, v] of Object.entries(refs)) console.log(`    ${k}: ${v}`);

    if (!APPLY) {
        console.log('\n  Simulación terminada. Nada fue modificado.');
        console.log('  Para aplicarlo de verdad, repetí el comando agregando --apply\n');
        return;
    }

    const userId = (await prisma.user.findFirst({
        where: { tenantId: origen.tenantId, role: 'OWNER' },
        select: { id: true },
    }))?.id;
    if (!userId) { console.error('No se encontró un usuario OWNER para firmar los movimientos.'); process.exit(1); }

    await prisma.$transaction(async (tx) => {
        for (const l of locs) {
            const qty = Number(l.currentStock);

            if (qty !== 0) {
                // Salida del origen e entrada al destino: el traslado queda
                // explicado en el Kardex, no es un saldo que cambió solo.
                await tx.inventoryMovement.create({
                    data: {
                        inventoryItemId: l.inventoryItemId,
                        movementType: 'TRANSFER',
                        quantity: -qty,
                        unit: l.inventoryItem.baseUnit,
                        areaId: origen.id,
                        reason: `Unificación de almacenes: ${origen.name} → ${destino.name}`,
                        notes: `Almacén: ${origen.name} (origen)`,
                        createdById: userId,
                    },
                });
                await tx.inventoryMovement.create({
                    data: {
                        inventoryItemId: l.inventoryItemId,
                        movementType: 'TRANSFER',
                        quantity: qty,
                        unit: l.inventoryItem.baseUnit,
                        areaId: destino.id,
                        reason: `Unificación de almacenes: ${origen.name} → ${destino.name}`,
                        notes: `Almacén: ${destino.name} (destino)`,
                        createdById: userId,
                    },
                });

                await tx.inventoryLocation.upsert({
                    where: { inventoryItemId_areaId: { inventoryItemId: l.inventoryItemId, areaId: destino.id } },
                    update: { currentStock: { increment: qty } },
                    create: { inventoryItemId: l.inventoryItemId, areaId: destino.id, currentStock: qty },
                });
            }

            await tx.inventoryLocation.delete({ where: { id: l.id } });
        }

        // Los movimientos históricos del origen se quedan donde están: son
        // hechos pasados y repuntarlos falsearía el Kardex. Sólo se repuntan
        // los registros operativos que seguirían usándose.
        await tx.requisition.updateMany({ where: { sourceAreaId: origen.id }, data: { sourceAreaId: destino.id } });
        await tx.requisition.updateMany({ where: { targetAreaId: origen.id }, data: { targetAreaId: destino.id } });

        await tx.area.update({
            where: { id: origen.id },
            data: {
                isActive: false,
                description: `Unificado con "${destino.name}" el ${new Date().toISOString().slice(0, 10)}`,
            },
        });
    }, { timeout: 120_000 });

    const restante = await prisma.inventoryLocation.count({ where: { areaId: origen.id } });
    console.log(`\n  Listo. "${origen.name}" quedó desactivado con ${restante} ubicaciones.`);
    console.log(`  El stock se sumó a "${destino.name}" con movimientos TRANSFER trazables en el Kardex.\n`);
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
