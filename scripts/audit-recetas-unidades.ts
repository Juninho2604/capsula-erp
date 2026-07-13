/**
 * audit-recetas-unidades.ts (§109.1) — Detecta ingredientes de recetas y de
 * modificadores cuya unidad NO coincide con la unidad base del insumo.
 * Esos registros descargan stock SIN conversión (200 G descuentan 200 KG).
 *
 * Por defecto SOLO LECTURA. Con --apply normaliza los convertibles
 * (misma familia: G→KG, ML→L, DOZEN→UNIT) actualizando quantity + unit.
 * Los NO convertibles (familia distinta, ej. UNIT vs KG) solo se reportan —
 * requieren corrección manual de la receta.
 *
 * Uso:
 *   npx tsx scripts/audit-recetas-unidades.ts --tenant-slug=shanklish
 *   npx tsx scripts/audit-recetas-unidades.ts --tenant-slug=shanklish --apply
 */

import { PrismaClient } from '@prisma/client';
import { qtyToBaseUnit } from '../src/lib/inventory/unit-conversion';

async function main() {
    const args: Record<string, string> = {};
    for (const a of process.argv.slice(2)) {
        if (!a.startsWith('--')) continue;
        const [k, ...rest] = a.slice(2).split('=');
        args[k] = rest.length ? rest.join('=') : 'true';
    }
    const slug = args['tenant-slug'];
    const apply = args['apply'] === 'true';
    if (!slug) {
        console.error('Uso: --tenant-slug=shanklish [--apply]');
        process.exit(2);
    }
    const prisma = new PrismaClient();
    const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true, name: true } });
    if (!tenant) { console.error('Tenant no existe'); process.exit(2); }

    console.log(`\n═══ AUDITORÍA UNIDADES RECETA ↔ INSUMO · ${tenant.name} ═══ ${apply ? '(APLICANDO CAMBIOS)' : '(solo lectura)'}\n`);

    // ── Ingredientes de recetas ────────────────────────────────────────────
    const recipeRows = await prisma.recipeIngredient.findMany({
        where: { recipe: { tenantId: tenant.id } },
        include: {
            recipe: { select: { name: true, isActive: true } },
            ingredientItem: { select: { name: true, baseUnit: true } },
        },
    });

    // ── Ingredientes directos de modificadores ─────────────────────────────
    const modRows = await prisma.menuModifierIngredient.findMany({
        where: { modifier: { tenantId: tenant.id } },
        include: {
            modifier: { select: { name: true } },
            ingredientItem: { select: { name: true, baseUnit: true } },
        },
    });

    let mismatches = 0, fixed = 0, manual = 0;

    const fq = (n: number) => n.toLocaleString('es-VE', { maximumFractionDigits: 6 });

    for (const r of recipeRows) {
        const base = r.ingredientItem.baseUnit;
        if ((r.unit ?? '').toUpperCase() === (base ?? '').toUpperCase()) continue;
        mismatches++;
        const norm = qtyToBaseUnit(r.quantity, r.unit, base);
        const tag = `[receta${r.recipe.isActive ? '' : ' INACTIVA'}] ${r.recipe.name} · ${r.ingredientItem.name}`;
        if (norm.converted) {
            console.log(`✎ ${tag}: ${fq(r.quantity)} ${r.unit} → ${fq(norm.quantity)} ${norm.unit}`);
            if (apply) {
                await prisma.recipeIngredient.update({
                    where: { id: r.id },
                    data: { quantity: norm.quantity, unit: norm.unit },
                });
                fixed++;
            }
        } else {
            manual++;
            console.log(`⚠ ${tag}: ${fq(r.quantity)} ${r.unit} vs base ${base} — FAMILIA DISTINTA, corregir a mano en la receta`);
        }
    }

    for (const m of modRows) {
        const base = m.ingredientItem.baseUnit;
        if ((m.unit ?? '').toUpperCase() === (base ?? '').toUpperCase()) continue;
        mismatches++;
        const norm = qtyToBaseUnit(m.quantity, m.unit, base);
        const tag = `[modificador] ${m.modifier.name} · ${m.ingredientItem.name}`;
        if (norm.converted) {
            console.log(`✎ ${tag}: ${fq(m.quantity)} ${m.unit} → ${fq(norm.quantity)} ${norm.unit}`);
            if (apply) {
                await prisma.menuModifierIngredient.update({
                    where: { id: m.id },
                    data: { quantity: norm.quantity, unit: norm.unit },
                });
                fixed++;
            }
        } else {
            manual++;
            console.log(`⚠ ${tag}: ${fq(m.quantity)} ${m.unit} vs base ${base} — FAMILIA DISTINTA, corregir a mano`);
        }
    }

    console.log(`\nRevisados: ${recipeRows.length} ingredientes de receta + ${modRows.length} de modificadores`);
    console.log(`Descalces: ${mismatches} · ${apply ? `normalizados: ${fixed}` : `normalizables con --apply: ${mismatches - manual}`} · requieren corrección manual: ${manual}`);
    if (mismatches === 0) console.log('✓ Todas las recetas están en la unidad base de sus insumos.');
    console.log('');
    await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
