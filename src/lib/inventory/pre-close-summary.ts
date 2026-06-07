/**
 * Análisis pre-cierre del Inventario Diario.
 *
 * Cuando el usuario va a "Finalizar Día", le mostramos un resumen para que no
 * cierre a ciegas. Como `finalCount` es `Float? @default(0)` en BD, no
 * distinguimos "no contado" vs "contado en 0" — usamos heurísticas explícitas:
 *
 *   - Item sospechoso de "no contado": `finalCount === 0` Y (`sales > 0` o es
 *     crítico). Si vendiste de él o lo marcaste crítico, debería tener stock
 *     residual; verlo en 0 es señal de que olvidaste contarlo.
 *
 *   - Cierre completamente vacío: TODOS los items tienen `finalCount === 0`.
 *     Caso típico del usuario que apretó "Finalizar" sin contar nada. El
 *     server rechaza este caso a menos que venga `force: true`.
 *
 * Función pura, testeable sin Prisma.
 */

export interface PreCloseInputItem {
    inventoryItemId: string;
    name: string;
    unit: string;
    finalCount: number | null | undefined;
    sales: number;
    variance: number | null | undefined;
    isCritical: boolean;
}

export interface PreCloseSummary {
    totalItems: number;
    itemsCountedNonZero: number;
    itemsZero: number;
    /** Items críticos o con ventas que están en 0 → sospechoso de "olvidé contar". */
    suspectedNotCounted: Array<{
        inventoryItemId: string;
        name: string;
        unit: string;
        sales: number;
        reason: 'CRITICAL_AT_ZERO' | 'SOLD_BUT_ZERO';
    }>;
    /** Top N varianzas más negativas (faltante real / pérdida). */
    topNegativeVariances: Array<{
        inventoryItemId: string;
        name: string;
        unit: string;
        variance: number;
    }>;
    totalVariance: number;
    /** True si TODOS los items están en finalCount=0 — cierre "vacío", peligroso. */
    allItemsAtZero: boolean;
    /** Recomendación del análisis. Lo usa la UI para semáforo y el server para bloqueo. */
    severity: 'OK' | 'WARN' | 'BLOCK';
}

function safeNum(n: number | null | undefined): number {
    return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

export function analyzePreCloseSummary(
    items: PreCloseInputItem[],
    options: { topVariancesLimit?: number } = {},
): PreCloseSummary {
    const topLimit = options.topVariancesLimit ?? 5;
    const totalItems = items.length;

    let itemsCountedNonZero = 0;
    let itemsZero = 0;
    let totalVariance = 0;
    const suspectedNotCounted: PreCloseSummary['suspectedNotCounted'] = [];

    for (const it of items) {
        const fc = safeNum(it.finalCount);
        const sales = safeNum(it.sales);
        totalVariance += safeNum(it.variance);

        if (fc > 0) {
            itemsCountedNonZero++;
        } else {
            itemsZero++;
            // Heurísticas de "olvidé contar":
            if (it.isCritical) {
                suspectedNotCounted.push({
                    inventoryItemId: it.inventoryItemId,
                    name: it.name,
                    unit: it.unit,
                    sales,
                    reason: 'CRITICAL_AT_ZERO',
                });
            } else if (sales > 0) {
                suspectedNotCounted.push({
                    inventoryItemId: it.inventoryItemId,
                    name: it.name,
                    unit: it.unit,
                    sales,
                    reason: 'SOLD_BUT_ZERO',
                });
            }
        }
    }

    const topNegativeVariances = items
        .map(it => ({
            inventoryItemId: it.inventoryItemId,
            name: it.name,
            unit: it.unit,
            variance: safeNum(it.variance),
        }))
        .filter(v => v.variance < -0.01)
        .sort((a, b) => a.variance - b.variance)   // más negativo primero
        .slice(0, topLimit);

    const allItemsAtZero = totalItems > 0 && itemsCountedNonZero === 0;

    let severity: PreCloseSummary['severity'];
    if (allItemsAtZero) {
        severity = 'BLOCK';
    } else if (suspectedNotCounted.length > 0 || topNegativeVariances.length > 0) {
        severity = 'WARN';
    } else {
        severity = 'OK';
    }

    return {
        totalItems,
        itemsCountedNonZero,
        itemsZero,
        suspectedNotCounted,
        topNegativeVariances,
        totalVariance: Math.round(totalVariance * 100) / 100,
        allItemsAtZero,
        severity,
    };
}
