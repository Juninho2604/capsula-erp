/**
 * IMPORTADOR DE INSUMOS DESDE CSV — carga inicial del catálogo de inventario.
 *
 * Formato (mismas columnas que la hoja INSUMOS_NUEVOS de la plantilla):
 *   nombre,categoria,unidad_base,punto_reorden,minimo_stock,costo_unitario_inicial,es_critico,descripcion
 *
 * Comportamiento:
 *  - Crea InventoryItem RAW_MATERIAL por fila. Si ya existe un item ACTIVO
 *    con el mismo nombre normalizado (minúsculas, sin acentos), lo SALTA —
 *    idempotente, se puede correr dos veces sin duplicar.
 *  - SKU: prefijo de 3 letras de la categoría + correlativo, verificando
 *    contra TODOS los SKUs del tenant (activos e inactivos/archivados del
 *    wipe §75) para no chocar con el unique (tenantId, sku).
 *  - Dedupe defensivo dentro del archivo por nombre normalizado.
 *  - costo_unitario_inicial > 0 → crea CostHistory; vacío/0 → sin costo
 *    (Shanklish no usa costos por ahora).
 *  - es_critico: SI/SÍ → isCritical=true.
 *  - Unidades válidas: KG, L, UNIT (otra cosa → UNIT con aviso).
 *
 * Uso (en el VPS, desde /var/www/capsula-erp, dry-run por defecto):
 *   SEED_TENANT_SLUG=shanklish npx tsx scripts/import-insumos-csv.ts scripts/data/insumos-shanklish-2026-07.csv
 *   SEED_TENANT_SLUG=shanklish npx tsx scripts/import-insumos-csv.ts scripts/data/insumos-shanklish-2026-07.csv --apply
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';

const FILE = process.argv[2];
const APPLY = process.argv.includes('--apply');

if (!FILE || FILE.startsWith('--')) {
    console.error('Uso: npx tsx scripts/import-insumos-csv.ts <archivo.csv> [--apply]');
    process.exit(1);
}

function norm(s: string): string {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Split CSV simple con soporte de comillas (los nombres no traen comas, pero por si acaso). */
function splitCsvLine(line: string): string[] {
    const out: string[] = [];
    let cur = '', inQ = false;
    for (const c of line) {
        if (inQ) {
            if (c === '"') inQ = false;
            else cur += c;
        } else if (c === '"') inQ = true;
        else if (c === ',') { out.push(cur); cur = ''; }
        else cur += c;
    }
    out.push(cur);
    return out;
}

const VALID_UNITS = new Set(['KG', 'L', 'UNIT']);

async function main() {
    const prisma = new PrismaClient();
    try {
        const slug = process.env.SEED_TENANT_SLUG;
        const tenant = slug
            ? await prisma.tenant.findUnique({ where: { slug } })
            : await prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } });
        if (!tenant) throw new Error('Tenant no encontrado');

        console.log(`${APPLY ? '🔴 APLICAR' : '🟡 ENSAYO (no escribe)'} — tenant: ${tenant.name} (${tenant.slug}) — archivo: ${FILE}\n`);

        // ── Parsear CSV ──────────────────────────────────────────────────────
        const lines = readFileSync(FILE, 'utf8').split(/\r?\n/).filter(l => l.trim());
        const headers = splitCsvLine(lines[0]).map(h => h.trim());
        const idx = (name: string) => headers.indexOf(name);
        for (const required of ['nombre', 'categoria', 'unidad_base']) {
            if (idx(required) === -1) throw new Error(`Falta la columna "${required}" en el CSV`);
        }

        interface Row { nombre: string; categoria: string; unidad: string; reorden: number; minimo: number; costo: number; critico: boolean; descripcion: string }
        const rows: Row[] = [];
        const seenInFile = new Set<string>();
        let fileDups = 0;
        for (const line of lines.slice(1)) {
            const cols = splitCsvLine(line);
            const nombre = (cols[idx('nombre')] ?? '').trim().replace(/\s+/g, ' ');
            if (!nombre) continue;
            const k = norm(nombre);
            if (seenInFile.has(k)) { fileDups++; console.log(`  ⚠ dup en archivo, omitida: ${nombre}`); continue; }
            seenInFile.add(k);
            const unidadRaw = (cols[idx('unidad_base')] ?? '').trim().toUpperCase();
            if (unidadRaw && !VALID_UNITS.has(unidadRaw)) {
                console.log(`  ⚠ unidad no estándar "${unidadRaw}" en "${nombre}" → UNIT`);
            }
            rows.push({
                nombre,
                categoria: (cols[idx('categoria')] ?? '').trim().replace(/\s+/g, ' ') || 'GENERAL',
                unidad: VALID_UNITS.has(unidadRaw) ? unidadRaw : 'UNIT',
                reorden: parseFloat(cols[idx('punto_reorden')] ?? '') || 0,
                minimo: parseFloat(cols[idx('minimo_stock')] ?? '') || 0,
                costo: parseFloat((cols[idx('costo_unitario_inicial')] ?? '').replace(',', '.')) || 0,
                critico: ['SI', 'SÍ', 'YES', 'TRUE', '1'].includes((cols[idx('es_critico')] ?? '').trim().toUpperCase()),
                descripcion: (cols[idx('descripcion')] ?? '').trim(),
            });
        }
        console.log(`Filas útiles: ${rows.length}${fileDups ? ` (+${fileDups} duplicadas en archivo, omitidas)` : ''}\n`);

        // ── Estado actual del tenant ─────────────────────────────────────────
        const existing = await prisma.inventoryItem.findMany({
            where: { tenantId: tenant.id },
            select: { name: true, sku: true, isActive: true },
        });
        const activeByName = new Map<string, string>();
        for (const it of existing) if (it.isActive) activeByName.set(norm(it.name), it.sku);
        const takenSkus = new Set(existing.map(it => it.sku)); // TODOS (activos + archivados §75)
        console.log(`Catálogo actual: ${existing.length} items (${activeByName.size} activos) — los SKUs archivados se respetan\n`);

        // ── Generación de SKU: PREFIJO-### por categoría, sin chocar ─────────
        const counters = new Map<string, number>();
        function nextSku(categoria: string): string {
            const prefix = categoria.normalize('NFD').replace(/[̀-ͯ]/g, '')
                .replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase() || 'INS';
            let n = counters.get(prefix) ?? 0;
            let sku: string;
            do { n++; sku = `${prefix}-${String(n).padStart(3, '0')}`; } while (takenSkus.has(sku));
            counters.set(prefix, n);
            takenSkus.add(sku);
            return sku;
        }

        // ── Crear ────────────────────────────────────────────────────────────
        let created = 0, skipped = 0;
        const byCategory = new Map<string, number>();
        for (const r of rows) {
            const already = activeByName.get(norm(r.nombre));
            if (already) {
                skipped++;
                console.log(`  = ya existe activo: ${r.nombre} [${already}] — omitido`);
                continue;
            }
            const sku = nextSku(r.categoria);
            byCategory.set(r.categoria, (byCategory.get(r.categoria) ?? 0) + 1);
            if (APPLY) {
                const item = await prisma.inventoryItem.create({
                    data: {
                        tenantId: tenant.id,
                        name: r.nombre,
                        sku,
                        type: 'RAW_MATERIAL',
                        baseUnit: r.unidad,
                        category: r.categoria,
                        minimumStock: r.minimo,
                        reorderPoint: r.reorden,
                        isCritical: r.critico,
                        description: r.descripcion || null,
                        isActive: true,
                    },
                });
                if (r.costo > 0) {
                    await prisma.costHistory.create({
                        data: { inventoryItemId: item.id, costPerUnit: r.costo, currency: 'USD', reason: 'Costo inicial — import CSV insumos' },
                    });
                }
            }
            created++;
        }

        console.log('\n──────────────────────────────────────────────');
        console.log(`${APPLY ? 'Creados' : 'Se crearían'}: ${created} · Ya existían (omitidos): ${skipped}`);
        console.log('\nPor categoría:');
        for (const [cat, n] of Array.from(byCategory.entries()).sort()) {
            console.log(`  ${String(n).padStart(4)} · ${cat}`);
        }
        if (!APPLY) console.log('\n🟡 ENSAYO — nada fue escrito. Repetí con --apply para ejecutar.');
        else console.log('\n✅ Import completo. Verificá en /dashboard/inventario (tarjeta Insumos).');
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(e => { console.error(e); process.exit(1); });
