/**
 * Backfill: corrige fechas de promociones afectadas por el bug de zona horaria.
 *
 * Las promos guardadas antes del fix tienen startDate/endDate ancladas a
 * MEDIANOCHE UTC. En Caracas (UTC-4) eso cae el día anterior, así que el motor
 * las interpreta vencidas/iniciadas un día antes de lo que el usuario eligió.
 *
 * El formulario mostraba la fecha vía `toISOString().slice(0,10)` (componentes
 * UTC), así que la fecha que el usuario CREE haber puesto es justamente la
 * Y-M-D UTC del valor guardado. Este script re-ancla esa misma fecha calendario
 * al MEDIODÍA de Caracas (16:00 UTC), que es como las guarda el código corregido.
 *
 * Solo toca filas con hora UTC < 4 (las viejas/buggeadas); las nuevas (16:00)
 * se saltan. Idempotente.
 *
 * Uso (en el VPS, con DATABASE_URL de producción):
 *   npx tsx scripts/fix-promo-dates.ts            # DRY-RUN (no escribe)
 *   npx tsx scripts/fix-promo-dates.ts --apply    # aplica los cambios
 */
import { PrismaClient } from '@prisma/client';

const APPLY = process.argv.includes('--apply');

/** Re-ancla una fecha vieja (UTC midnight) al mediodía de Caracas, conservando
 *  el día calendario que el usuario veía en el formulario. null si no aplica. */
function fixedDate(d: Date | null): Date | null {
    if (!d) return null;
    if (d.getUTCHours() >= 4) return null; // ya corregida (16:00 UTC) → no tocar
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 16, 0, 0, 0));
}

const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '—');

async function main() {
    const prisma = new PrismaClient();
    const promos = await prisma.promotion.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, tenantId: true, startDate: true, endDate: true },
    });

    console.log(`\n${APPLY ? '🛠  APLICANDO' : '👀 DRY-RUN (sin escribir)'} · ${promos.length} promos\n`);

    let changed = 0;
    for (const p of promos) {
        const ns = fixedDate(p.startDate);
        const ne = fixedDate(p.endDate);
        if (!ns && !ne) continue;
        changed++;
        const sTxt = ns ? `inicio ${ymd(p.startDate)} → ${ymd(ns)}` : '';
        const eTxt = ne ? `fin ${ymd(p.endDate)} → ${ymd(ne)}` : '';
        console.log(`• "${p.name}" (tenant ${p.tenantId}) · ${[sTxt, eTxt].filter(Boolean).join(' · ')}`);
        if (APPLY) {
            await prisma.promotion.update({
                where: { id: p.id },
                data: { ...(ns ? { startDate: ns } : {}), ...(ne ? { endDate: ne } : {}) },
            });
        }
    }

    console.log(`\n${changed} promo(s) ${APPLY ? 'corregidas' : 'a corregir'}.${APPLY ? '' : '  Re-corré con --apply para aplicar.'}\n`);
    await prisma.$disconnect();
}
main().catch((e) => { console.error('❌', e); process.exit(1); });
