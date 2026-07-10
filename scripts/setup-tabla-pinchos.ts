/**
 * setup-tabla-pinchos.ts (§90, rediseñado 10/07)
 * ──────────────────────────────────────────────
 * Configura la selección de varas de pincho en las tablas con el flujo
 * ANIDADO (§82) que pidió Omar: al seleccionar "Pincho Mixto" dentro de los
 * principales de la tabla se DESPLIEGA la selección de varas, limitada a la
 * cantidad exacta según el tamaño:
 *
 *   Tabla x1 → Pincho Mixto despliega 1 vara   (min=max=1)
 *   Tabla x2 → Pincho Mixto despliega 2 varas  (min=max=2)
 *   Tabla x4 → Pincho Mixto despliega 4 varas  (min=max=4)
 *
 * Varas: Pincho de Pollo, Pincho de Carne, Pincho de Kafta, Pincho Mixto
 * (la VARA mixta — distinta de la ración mixta que la despliega), con
 * stepper para repetir sabores.
 *
 * Problema de fondo: las tablas COMPARTEN el grupo "Platos Principales
 * (Tabla)" y el childGroup vive en el modificador → un solo "Pincho Mixto"
 * no puede desplegar 1 vara en la x1 y 4 en la x4. Solución: cuando el
 * grupo de principales es compartido, el script lo CLONA por tabla
 * (modificadores + receta propia + linkedMenuItem incluidos), asigna al
 * "Pincho Mixto" del clon su sub-grupo dedicado, vincula la tabla al clon y
 * la desvincula del compartido. Si el grupo ya es exclusivo de la tabla,
 * solo le asigna el sub-grupo (sin clonar). Idempotente: IDs deterministas
 * (`<origId>--<sku>`); re-correr actualiza en vez de duplicar.
 *
 * LIMPIEZA que también hace:
 *   - Desvincula de las tablas el grupo "PINCHOS" (mín. 3) de la ración si
 *     quedó vinculado directo (el grupo queda intacto para la ración).
 *   - Desvincula el grupo dedicado si una corrida anterior (v1) lo dejó
 *     vinculado DIRECTO a la tabla (ahora es anidado bajo Pincho Mixto).
 *   - "Pincho Mixto" duplicado dentro de un mismo grupo → soft-delete del
 *     duplicado (el POS filtra deletedAt; el histórico de ventas no se toca).
 *
 * Los modificadores de vara se crean SIN descargo de inventario (se
 * configura después con receta propia §80). La receta propia de los
 * modificadores clonados SÍ se copia del original.
 *
 * Uso:
 *   npx tsx scripts/setup-tabla-pinchos.ts --tenant-slug=shanklish          # dry-run
 *   npx tsx scripts/setup-tabla-pinchos.ts --tenant-slug=shanklish --apply  # aplica
 */

import { PrismaClient } from '@prisma/client';

const TABLAS: Array<{ sku: string; label: string; varas: number }> = [
    { sku: 'TABLA-X1', label: 'Tabla x1', varas: 1 },
    { sku: 'TABLA-X2', label: 'Tabla x2', varas: 2 },
    { sku: 'TABLA-X4', label: 'Tabla x4', varas: 4 },
];

// Varas seleccionables (mismas 4 para las 3 tablas). ID determinista por
// tabla+sabor → idempotente. "Pincho Mixto" acá es la VARA mixta.
const SABORES: Array<{ key: string; name: string }> = [
    { key: 'pollo', name: 'Pincho de Pollo' },
    { key: 'carne', name: 'Pincho de Carne' },
    { key: 'kafta', name: 'Pincho de Kafta' },
    { key: 'mixto', name: 'Pincho Mixto' },
];

/** ¿El modificador es la ración "Pincho Mixto" (la que despliega varas)? */
const PINCHO_MIXTO_RE = /^\s*pincho\s+mixto\s*$/i;
/** ¿El grupo es un grupo de selección de pinchos (ej. "PINCHOS" de la ración)? */
const PINCHO_GROUP_RE = /pincho/i;

interface Args { tenantSlug: string; apply: boolean; }

function parseArgs(): Args {
    const map: Record<string, string> = {};
    for (const arg of process.argv.slice(2)) {
        if (!arg.startsWith('--')) continue;
        const [k, ...rest] = arg.slice(2).split('=');
        map[k] = rest.length > 0 ? rest.join('=') : 'true';
    }
    const tenantSlug = map['tenant-slug'];
    if (!tenantSlug) {
        console.error('Falta --tenant-slug. Ej: --tenant-slug=shanklish');
        process.exit(2);
    }
    return { tenantSlug, apply: map['apply'] === 'true' };
}

async function main() {
    const args = parseArgs();
    const prisma = new PrismaClient();

    console.log('\n=== setup-tabla-pinchos (§90 anidado) ===');
    console.log('Tenant:', args.tenantSlug, '| Modo:', args.apply ? 'APPLY' : 'DRY-RUN');

    const tenant = await prisma.tenant.findUnique({
        where: { slug: args.tenantSlug },
        select: { id: true, name: true },
    });
    if (!tenant) { console.error(`Tenant "${args.tenantSlug}" no existe.`); process.exit(2); }
    console.log(`Tenant: ${tenant.name} (${tenant.id})`);

    const tablas = await prisma.menuItem.findMany({
        where: { tenantId: tenant.id, sku: { in: TABLAS.map(t => t.sku) } },
        select: { id: true, sku: true, name: true },
    });
    const bySku = new Map(tablas.map(t => [t.sku, t]));
    const missing = TABLAS.filter(t => !bySku.has(t.sku));
    if (missing.length > 0) {
        console.error(`\nFaltan tablas: ${missing.map(t => t.sku).join(', ')}. Verificá los SKUs del menú.`);
        process.exit(2);
    }

    for (const t of TABLAS) {
        const item = bySku.get(t.sku)!;
        const skuLower = t.sku.toLowerCase();
        const dedicatedId = `mod-group-pinchos-${skuLower}`;
        const dedicatedName = `Pinchos (${t.label})`;

        console.log(`\n══ ${t.label} (${item.name}) ══`);

        // ── 1. Sub-grupo dedicado de varas (min=max según tabla) ─────────
        console.log(`   Sub-grupo "${dedicatedName}" min=max=${t.varas} · varas: ${SABORES.map(s => s.name).join(', ')}`);
        if (args.apply) {
            await prisma.menuModifierGroup.upsert({
                where: { id: dedicatedId },
                create: {
                    id: dedicatedId, tenantId: tenant.id, name: dedicatedName,
                    isRequired: true, minSelections: t.varas, maxSelections: t.varas, sortOrder: 50,
                },
                update: {
                    tenantId: tenant.id, name: dedicatedName,
                    isRequired: true, minSelections: t.varas, maxSelections: t.varas,
                },
            });
            for (let i = 0; i < SABORES.length; i++) {
                const s = SABORES[i];
                const modId = `mod-pincho-${skuLower}-${s.key}`;
                await prisma.menuModifier.upsert({
                    where: { id: modId },
                    create: { id: modId, tenantId: tenant.id, name: s.name, priceAdjustment: 0, groupId: dedicatedId, sortOrder: i },
                    update: { tenantId: tenant.id, name: s.name, priceAdjustment: 0, groupId: dedicatedId, sortOrder: i, deletedAt: null, isAvailable: true },
                });
            }
        }

        // ── 2. Si una corrida v1 vinculó el dedicado DIRECTO a la tabla,
        //       quitarlo: ahora se despliega anidado bajo "Pincho Mixto". ──
        const directLink = await prisma.menuItemModifierGroup.findUnique({
            where: { menuItemId_modifierGroupId: { menuItemId: item.id, modifierGroupId: dedicatedId } },
        });
        if (directLink) {
            console.log(`   ✂ quitar vínculo DIRECTO del sub-grupo dedicado (v1) — pasa a anidado`);
            if (args.apply) await prisma.menuItemModifierGroup.delete({ where: { id: directLink.id } });
        }

        // ── 3. Grupos vinculados a la tabla: limpiar legacy y anidar ─────
        const links = await prisma.menuItemModifierGroup.findMany({
            where: { menuItemId: item.id },
            include: {
                modifierGroup: {
                    include: {
                        modifiers: {
                            where: { deletedAt: null },
                            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
                            include: { ingredients: true },
                        },
                        menuItems: { select: { menuItemId: true } },
                    },
                },
            },
        });

        let anidado = false;
        for (const link of links) {
            const g = link.modifierGroup;
            if (g.id === dedicatedId) continue;

            // 3a. Grupo de pinchos vinculado directo (ej. "PINCHOS" mín. 3 de
            // la ración) → desvincular SOLO de la tabla; el grupo no se toca.
            if (PINCHO_GROUP_RE.test(g.name)) {
                console.log(`   ✂ desvincular grupo "${g.name}" (min ${g.minSelections}) — lo reemplaza el despliegue anidado`);
                if (args.apply) await prisma.menuItemModifierGroup.delete({ where: { id: link.id } });
                continue;
            }

            // 3b. Grupo con la ración "Pincho Mixto" adentro (principales).
            const mixtos = g.modifiers.filter(m => PINCHO_MIXTO_RE.test(m.name));
            if (mixtos.length === 0) continue;

            const sharedWithOthers = g.menuItems.some(mi => mi.menuItemId !== item.id);

            if (!sharedWithOthers) {
                // Exclusivo de esta tabla (o clon de corrida previa) → in place.
                const keep = mixtos[0];
                for (const dup of mixtos.slice(1)) {
                    console.log(`   ✂ "${g.name}": soft-delete "Pincho Mixto" DUPLICADO (id ${dup.id})`);
                    if (args.apply) await prisma.menuModifier.update({ where: { id: dup.id }, data: { deletedAt: new Date() } });
                }
                if (keep.childGroupId !== dedicatedId) {
                    console.log(`   ⚓ "${g.name}" → "Pincho Mixto" despliega "${dedicatedName}" (${t.varas} vara${t.varas > 1 ? 's' : ''})`);
                    if (args.apply) await prisma.menuModifier.update({ where: { id: keep.id }, data: { childGroupId: dedicatedId } });
                } else {
                    console.log(`   ✓ "${g.name}" → "Pincho Mixto" ya despliega el sub-grupo correcto`);
                }
                anidado = true;
                continue;
            }

            // Compartido (las 3 tablas u otros items) → CLONAR para esta tabla.
            const cloneId = `${g.id}--${skuLower}`;
            const cloneName = g.name.includes(t.label) ? g.name : `${g.name} (${t.label})`;
            const seenMixto = new Set<string>();
            const modPlan = g.modifiers.filter(m => {
                if (!PINCHO_MIXTO_RE.test(m.name)) return true;
                if (seenMixto.has('mixto')) return false; // dedupe duplicado
                seenMixto.add('mixto');
                return true;
            });
            const dupes = g.modifiers.length - modPlan.length;
            console.log(`   ⧉ clonar "${g.name}" (compartido) → "${cloneName}" [${modPlan.length} modificadores${dupes > 0 ? `, ${dupes} "Pincho Mixto" duplicado descartado` : ''}]`);
            console.log(`     ⚓ en el clon, "Pincho Mixto" despliega "${dedicatedName}" (${t.varas} vara${t.varas > 1 ? 's' : ''})`);
            console.log(`     ↪ ${t.sku} pasa a usar el clon; el grupo original queda para los demás`);

            if (args.apply) {
                await prisma.menuModifierGroup.upsert({
                    where: { id: cloneId },
                    create: {
                        id: cloneId, tenantId: tenant.id, name: cloneName,
                        isRequired: g.isRequired, minSelections: g.minSelections,
                        maxSelections: g.maxSelections, sortOrder: g.sortOrder, isActive: g.isActive,
                    },
                    update: {
                        tenantId: tenant.id, name: cloneName,
                        isRequired: g.isRequired, minSelections: g.minSelections,
                        maxSelections: g.maxSelections, sortOrder: g.sortOrder, isActive: g.isActive,
                    },
                });
                for (const mod of modPlan) {
                    const isMixto = PINCHO_MIXTO_RE.test(mod.name);
                    const cloneModId = `${mod.id}--${skuLower}`;
                    await prisma.menuModifier.upsert({
                        where: { id: cloneModId },
                        create: {
                            id: cloneModId, tenantId: tenant.id, groupId: cloneId,
                            name: mod.name, priceAdjustment: mod.priceAdjustment,
                            isAvailable: mod.isAvailable, sortOrder: mod.sortOrder,
                            linkedMenuItemId: mod.linkedMenuItemId,
                            childGroupId: isMixto ? dedicatedId : mod.childGroupId,
                        },
                        update: {
                            tenantId: tenant.id, groupId: cloneId,
                            name: mod.name, priceAdjustment: mod.priceAdjustment,
                            isAvailable: mod.isAvailable, sortOrder: mod.sortOrder,
                            linkedMenuItemId: mod.linkedMenuItemId,
                            childGroupId: isMixto ? dedicatedId : mod.childGroupId,
                            deletedAt: null,
                        },
                    });
                    // Receta propia (§80): refrescar desde el original.
                    await prisma.menuModifierIngredient.deleteMany({ where: { modifierId: cloneModId } });
                    if (mod.ingredients.length > 0) {
                        await prisma.menuModifierIngredient.createMany({
                            data: mod.ingredients.map(ing => ({
                                modifierId: cloneModId,
                                ingredientItemId: ing.ingredientItemId,
                                quantity: ing.quantity,
                                unit: ing.unit,
                            })),
                        });
                    }
                }
                await prisma.menuItemModifierGroup.upsert({
                    where: { menuItemId_modifierGroupId: { menuItemId: item.id, modifierGroupId: cloneId } },
                    create: { menuItemId: item.id, modifierGroupId: cloneId },
                    update: {},
                });
                await prisma.menuItemModifierGroup.delete({ where: { id: link.id } });
            }
            anidado = true;
        }

        if (!anidado) {
            console.log(`   ⚠ ${t.sku}: ningún grupo vinculado contiene la ración "Pincho Mixto" — revisar en /dashboard/menu/modificadores`);
        }
    }

    if (!args.apply) {
        console.log('\n[DRY-RUN] No se escribió nada. Re-correr con --apply para aplicar.');
    } else {
        console.log('\nListo. Probá cada tabla en el POS: al seleccionar "Pincho Mixto" debe');
        console.log('desplegarse la selección de varas con la cantidad exacta (1/2/4).');
        console.log('La ración individual de Pincho Mixto no cambia (sigue con su grupo de 3).');
        console.log('Descargo por vara: /dashboard/menu/modificadores (receta propia §80).');
    }
    await prisma.$disconnect();
}

main().catch(async (err) => { console.error('\nError:', err); process.exit(1); });
