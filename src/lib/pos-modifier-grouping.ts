/**
 * pos-modifier-grouping.ts
 * ────────────────────────
 * Heurística para agrupar modifiers tipo "Sin X" / "Con X" / "+ X" del mismo
 * grupo en toggles SIN/CON por ingrediente. Sirve para que el POS muestre
 * una UI consolidada en lugar de una lista plana de checkbox separados.
 *
 * Convención de nombres detectada automáticamente (case-insensitive):
 *   "Sin Cebolla"        → ingrediente=Cebolla, action=SIN
 *   "Con Tabulé"         → ingrediente=Tabulé,  action=CON
 *   "+ Falafel"          → ingrediente=Falafel, action=CON
 *   "+ Hummus"           → ingrediente=Hummus,  action=CON
 *   "Extra Salsa"        → no matchea (passThrough, render normal)
 *   "Extra Proteína 250gr" → no matchea (passThrough)
 *
 * Si un mismo ingrediente (caseless) tiene variantes Sin y Con, se agrupan
 * en un toggle de 3 estados (SIN/NEUTRAL/CON). Si solo tiene una variante,
 * toggle de 2 estados (NEUTRAL/SIN ó NEUTRAL/CON).
 *
 * Modifiers que no matchean ninguna convención se devuelven en `passThrough`
 * para que la UI los renderice como antes.
 *
 * Esta lógica es PURA — no toca state ni Prisma. Testeable en isolation.
 */

export interface MinimalModifier {
    id: string;
    name: string;
    priceAdjustment: number;
    isAvailable?: boolean;
}

export type ModifierAction = 'SIN' | 'CON' | 'NONE';

export interface ParsedModifier {
    original: MinimalModifier;
    ingredient: string;
    action: ModifierAction;
}

export interface IngredientToggle {
    /** Ingrediente normalizado (lowercase, sin acentos), key para el map. */
    key: string;
    /** Nombre del ingrediente tal como aparece (preserva mayúsculas/acentos
     *  del primer modifier que lo definió). */
    label: string;
    /** Modifier original para "Sin X" si existe. */
    sin?: MinimalModifier;
    /** Modifier original para "Con X" / "+ X" si existe. */
    con?: MinimalModifier;
}

export interface GroupedModifiers {
    /** Toggles SIN/CON por ingrediente, ordenados por aparición. */
    toggles: IngredientToggle[];
    /** Modifiers que no matchean la convención — render normal. */
    passThrough: MinimalModifier[];
}

/**
 * Normaliza un nombre de ingrediente para usarlo como key:
 * - lowercase
 * - sin acentos
 * - colapsa espacios
 *
 * "Tabulé" y "tabule" colapsan a la misma key.
 */
function normalizeIngredientKey(s: string): string {
    return s
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '') // strip acentos
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Detecta el prefijo SIN/CON/+ y extrae el nombre del ingrediente.
 * Si no detecta nada, devuelve action=NONE.
 */
export function parseModifier(m: MinimalModifier): ParsedModifier {
    const name = m.name.trim();
    // "Sin X"
    const sinMatch = name.match(/^sin\s+(.+)$/i);
    if (sinMatch) {
        return { original: m, ingredient: sinMatch[1].trim(), action: 'SIN' };
    }
    // "Con X" (estricto: no matchea "Continental" o palabras que empiezan con "Con")
    const conMatch = name.match(/^con\s+(.+)$/i);
    if (conMatch) {
        return { original: m, ingredient: conMatch[1].trim(), action: 'CON' };
    }
    // "+ X" o "+X"
    const plusMatch = name.match(/^\+\s*(.+)$/);
    if (plusMatch) {
        return { original: m, ingredient: plusMatch[1].trim(), action: 'CON' };
    }
    return { original: m, ingredient: '', action: 'NONE' };
}

/**
 * Agrupa una lista de modifiers en toggles SIN/CON por ingrediente + un
 * passThrough con los que no encajan en la convención.
 *
 * Edge cases:
 * - Modifier con `isAvailable: false` se omite por completo.
 * - Si hay dos "Sin X" para el mismo X (improbable), gana el primero.
 * - Orden de los toggles: orden de aparición del PRIMER modifier que
 *   menciona ese ingrediente.
 */
export function groupModifiersForSinCon(
    modifiers: MinimalModifier[],
): GroupedModifiers {
    const available = modifiers.filter((m) => m.isAvailable !== false);
    const parsed = available.map(parseModifier);

    const togglesByKey = new Map<string, IngredientToggle>();
    const passThrough: MinimalModifier[] = [];

    for (const p of parsed) {
        if (p.action === 'NONE') {
            passThrough.push(p.original);
            continue;
        }
        const key = normalizeIngredientKey(p.ingredient);
        if (!key) {
            // "Sin " o "Con " sin nombre — defensivo, no debería pasar
            passThrough.push(p.original);
            continue;
        }
        let toggle = togglesByKey.get(key);
        if (!toggle) {
            toggle = { key, label: p.ingredient };
            togglesByKey.set(key, toggle);
        }
        if (p.action === 'SIN' && !toggle.sin) {
            toggle.sin = p.original;
        }
        if (p.action === 'CON' && !toggle.con) {
            toggle.con = p.original;
        }
    }

    return {
        toggles: Array.from(togglesByKey.values()),
        passThrough,
    };
}

/**
 * Dado un toggle y el set de modifier ids seleccionados, devuelve el estado
 * actual ('SIN' | 'CON' | 'NEUTRAL'). Útil para que la UI sepa cuál botón
 * pintar como activo.
 */
export function toggleStateFor(
    toggle: IngredientToggle,
    selectedModifierIds: ReadonlySet<string>,
): 'SIN' | 'CON' | 'NEUTRAL' {
    if (toggle.sin && selectedModifierIds.has(toggle.sin.id)) return 'SIN';
    if (toggle.con && selectedModifierIds.has(toggle.con.id)) return 'CON';
    return 'NEUTRAL';
}
