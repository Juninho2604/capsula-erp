/**
 * §109.1 — Normalización de cantidades a la unidad BASE del insumo.
 *
 * Contexto: el stock (`InventoryLocation.currentStock`) vive en la unidad
 * base del insumo, pero las recetas guardaban la unidad que eligió el
 * usuario y NINGÚN camino downstream convertía (validación de stock,
 * descargo de venta, reversión por anulación, consumo teórico). Una receta
 * con "200 G" de un insumo en KG descontaba 200 KG.
 *
 * Estrategia: normalizar EN EL ORIGEN — `createRecipeAction` /
 * `updateRecipeAction` convierten cada ingrediente a la unidad base del
 * insumo antes de persistir. Así todo lo demás recibe siempre unidad base
 * sin tocar el código crítico de ventas.
 *
 * Solo se convierte dentro de la MISMA familia (masa↔masa, volumen↔volumen,
 * conteo↔conteo). Familias distintas o unidades desconocidas se devuelven
 * SIN cambiar (comportamiento legacy — nunca inventar una conversión).
 */

type Family = 'MASS' | 'VOLUME' | 'COUNT';

/** Multiplicador a la unidad canónica de su familia (KG, L, UNIT). */
const UNIT_TABLE: Record<string, { family: Family; toCanonical: number }> = {
    KG: { family: 'MASS', toCanonical: 1 },
    G: { family: 'MASS', toCanonical: 0.001 },
    LB: { family: 'MASS', toCanonical: 0.453592 },
    OZ: { family: 'MASS', toCanonical: 0.0283495 },
    L: { family: 'VOLUME', toCanonical: 1 },
    ML: { family: 'VOLUME', toCanonical: 0.001 },
    GAL: { family: 'VOLUME', toCanonical: 3.78541 },
    UNIT: { family: 'COUNT', toCanonical: 1 },
    DOZEN: { family: 'COUNT', toCanonical: 12 },
    // PORTION es deliberadamente ambigua (depende de la receta) — identidad.
};

/**
 * §127 — Alias comunes (español / variantes) → código canónico de UNIT_TABLE.
 * Caso real: "pan de shawarma está en unidades y la receta me lo quiere poner
 * en kilos" — el insumo tenía baseUnit no canónica (ej. 'UND'); la tabla de
 * familias no la reconocía y el selector caía visualmente en KG.
 */
const UNIT_ALIASES: Record<string, string> = {
    UND: 'UNIT', UNID: 'UNIT', UNIDAD: 'UNIT', UNIDADES: 'UNIT', U: 'UNIT',
    PZ: 'UNIT', PZA: 'UNIT', PIEZA: 'UNIT', PIEZAS: 'UNIT',
    KGS: 'KG', KILO: 'KG', KILOS: 'KG', KILOGRAMO: 'KG', KILOGRAMOS: 'KG',
    GR: 'G', GRS: 'G', GRAMO: 'G', GRAMOS: 'G',
    LT: 'L', LTS: 'L', LITRO: 'L', LITROS: 'L',
    MLS: 'ML', CC: 'ML', MILILITRO: 'ML', MILILITROS: 'ML',
    DOC: 'DOZEN', DOCENA: 'DOZEN', DOCENAS: 'DOZEN',
    PORCION: 'PORTION', PORCIONES: 'PORTION', PORCIÓN: 'PORTION',
};

/**
 * §127 — Devuelve el código canónico de una unidad (resuelve alias y
 * mayúsculas/espacios). Unidades desconocidas se devuelven en mayúsculas
 * tal cual (nunca inventa).
 */
export function normalizeUnitCode(unit: string | null | undefined): string {
    const u = (unit ?? '').toUpperCase().trim();
    return UNIT_ALIASES[u] ?? u;
}

export interface NormalizedQty {
    quantity: number;
    unit: string;
    /** true si hubo conversión real (unidades distintas de la misma familia). */
    converted: boolean;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * Convierte `quantity unit` a la unidad base del insumo cuando es seguro.
 * - unit === baseUnit → identidad.
 * - misma familia → convierte y devuelve unit = baseUnit.
 * - familia distinta / unidad desconocida / inputs vacíos → sin cambios.
 */
export function qtyToBaseUnit(
    quantity: number,
    unit: string | null | undefined,
    baseUnit: string | null | undefined
): NormalizedQty {
    // §127: resolver alias ANTES de comparar/convertir ('UND'≡'UNIT', 'GR'≡'G').
    // Los alias son 1:1 con su canónico → normalizar nunca cambia cantidades.
    const u = normalizeUnitCode(unit);
    const b = normalizeUnitCode(baseUnit);
    if (!u || !b || u === b) {
        return { quantity, unit: u || b, converted: false };
    }
    const from = UNIT_TABLE[u];
    const to = UNIT_TABLE[b];
    if (!from || !to || from.family !== to.family) {
        return { quantity, unit: u, converted: false };
    }
    return {
        quantity: round6(quantity * (from.toCanonical / to.toCanonical)),
        unit: b,
        converted: true,
    };
}
