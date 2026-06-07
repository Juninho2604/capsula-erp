/**
 * Parsea hojas tipo inventario.
 *
 * Detecta columnas por encabezado (más robusto que orden hardcoded):
 *   - SKU / CÓDIGO  → identificador único (preferido para match exacto)
 *   - PRODUCTO       → nombre legible (fallback para fuzzy match)
 *   - CANTIDAD       → cantidad principal (alias: CANT., STOCK)
 *   - PRODUCCIÓN / COCINA → cantidad del segundo almacén (modo dual)
 *
 * Backward compat: si solo hay "PRODUCTO" + columna de cantidad sin
 * encabezado claro, usa el formato antiguo (PRODUCTO en col 0, cant en col 1,
 * producción opcional en col 2).
 */
import * as XLSX from 'xlsx';

export type ParsedCountRow = {
    /** SKU/código si la plantilla lo trae — habilita match exacto sin fuzzy. */
    sku: string | null;
    productName: string;
    qtyPrincipal: number | null;
    qtyProduction: number | null;
};

function norm(s: string) {
    return String(s || '')
        .trim()
        .toUpperCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '');
}

function parseNum(v: unknown): number | null {
    if (v === '' || v === null || v === undefined) return null;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    if (Number.isNaN(n)) return null;
    return n;
}

interface ColumnMap {
    sku: number | null;
    product: number;
    qtyPrincipal: number;
    qtyProduction: number | null;
}

/**
 * Encuentra la fila de encabezado y mapea las columnas relevantes por su
 * etiqueta. Si no detecta cantidad por etiqueta, asume el formato legacy
 * (cantidad en col después del PRODUCTO).
 */
function findHeaderAndMap(rows: unknown[][]): { headerIdx: number; map: ColumnMap } {
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i] as unknown[];
        // Necesita al menos una celda PRODUCTO en alguna columna razonable
        let productCol = -1;
        let skuCol: number | null = null;
        let qtyPrincipalCol = -1;
        let qtyProductionCol: number | null = null;

        for (let c = 0; c < Math.min(row.length, 12); c++) {
            const cell = norm(String(row[c] ?? ''));
            if (cell === 'PRODUCTO' || cell === 'NOMBRE' || cell === 'DESCRIPCION') {
                if (productCol === -1) productCol = c;
            } else if (cell === 'SKU' || cell === 'CODIGO' || cell === 'COD') {
                if (skuCol === null) skuCol = c;
            } else if (
                cell === 'CANTIDAD' || cell === 'CANT' || cell === 'CANT.' ||
                cell === 'STOCK' || cell === 'CANT EN STOCK' || cell === 'CANTIDAD EN STOCK' ||
                cell === 'CANT ALMACEN PRINCIPAL' || cell === 'CANT. ALMACEN PRINCIPAL' ||
                cell === 'PRINCIPAL'
            ) {
                if (qtyPrincipalCol === -1) qtyPrincipalCol = c;
            } else if (
                cell === 'PRODUCCION' || cell === 'COCINA' ||
                cell === 'CANT PRODUCCION' || cell === 'CANT. PRODUCCION' ||
                cell === 'CANT COCINA'
            ) {
                if (qtyProductionCol === null) qtyProductionCol = c;
            }
        }

        if (productCol === -1) continue;

        // Legacy fallback: si no detectamos cantidad por etiqueta, asumir
        // que la cantidad está justo a la derecha del PRODUCTO (formato viejo).
        if (qtyPrincipalCol === -1) {
            qtyPrincipalCol = productCol + 1;
            // Tercera columna con texto no numérico → modo dual legacy
            const thirdHeader = String(row[productCol + 2] ?? '').trim();
            if (thirdHeader && Number.isNaN(parseFloat(thirdHeader)) && !/^[\d.,\s]+$/.test(thirdHeader)) {
                qtyProductionCol = productCol + 2;
            }
        }

        return {
            headerIdx: i,
            map: {
                sku: skuCol,
                product: productCol,
                qtyPrincipal: qtyPrincipalCol,
                qtyProduction: qtyProductionCol,
            },
        };
    }
    throw new Error(
        'No se encontró la fila de encabezado con "PRODUCTO". Descargue la plantilla del sistema o copie ese formato.'
    );
}

export function parseInventoryWorksheet(rows: unknown[][]): ParsedCountRow[] {
    const { headerIdx, map } = findHeaderAndMap(rows);
    const out: ParsedCountRow[] = [];

    for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i] as unknown[];
        const name = String(row[map.product] || '').trim();
        if (!name) continue;
        const nameUpper = norm(name);
        if (nameUpper === 'PRODUCTO' || nameUpper === 'NOMBRE' || nameUpper === 'DESCRIPCION') continue;
        if (nameUpper.startsWith('TOTAL') || nameUpper === 'SUMA') continue;

        // Filas separadoras de categoría: solo nombre y nada más → skip silencio
        // (cuando la plantilla agrupa por categoría con filas "## CATEGORÍA ##").
        if (nameUpper.startsWith('##') || nameUpper.startsWith('CATEGORÍA:') || nameUpper.startsWith('CATEGORIA:')) {
            continue;
        }

        const skuRaw = map.sku !== null ? String(row[map.sku] ?? '').trim() : '';
        const sku = skuRaw.length > 0 ? skuRaw : null;

        const q1 = parseNum(row[map.qtyPrincipal]);
        const q2 = map.qtyProduction !== null ? parseNum(row[map.qtyProduction]) : null;

        const isDual = map.qtyProduction !== null;

        if (isDual) {
            if (q1 === null && q2 === null) continue;
            out.push({
                sku,
                productName: name,
                qtyPrincipal: q1 ?? 0,
                qtyProduction: q2 ?? 0,
            });
        } else {
            if (q1 === null) continue;
            out.push({
                sku,
                productName: name,
                qtyPrincipal: q1,
                qtyProduction: null,
            });
        }
    }

    return out;
}

export function parseInventoryExcelBuffer(buffer: Buffer): ParsedCountRow[] {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
    return parseInventoryWorksheet(rows);
}
