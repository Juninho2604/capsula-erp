/**
 * Modificadores anidados (§82) — helpers PUROS compartidos por los 5 POS.
 *
 * Un MenuModifier puede tener `childGroup`: al seleccionarlo se despliega
 * ese grupo como sub-selección (ej. "Pincho Mixto" → elegir sabores de las
 * varas). UN solo nivel de anidación. Las selecciones hijas viven en el
 * MISMO array `currentModifiers` de la página (con groupId = childGroup.id),
 * así el precio, la persistencia, la impresión y el descargo de inventario
 * funcionan sin ningún cambio: son modifiers normales.
 *
 * Estas funciones no conocen React ni Prisma — reciben shapes mínimos
 * (compatibles estructuralmente con los tipos locales de cada página POS).
 */

export interface ChildModifierData {
    id: string;
    name: string;
    priceAdjustment: number;
    isAvailable: boolean;
}

export interface ChildGroupData {
    id: string;
    name: string;
    isActive?: boolean;
    isRequired: boolean;
    minSelections: number;
    maxSelections: number;
    modifiers: ChildModifierData[];
}

interface ParentModifierShape {
    id: string;
    childGroup?: ChildGroupData | null;
}

interface SelectionShape {
    groupId: string;
    id: string;
    quantity: number;
}

/** ¿Este modificador despliega un sub-grupo utilizable? (activo y con opciones) */
export function hasChildGroup(mod: { childGroup?: ChildGroupData | null }): mod is { childGroup: ChildGroupData } {
    const cg = mod.childGroup;
    return Boolean(cg && cg.isActive !== false && cg.modifiers.length > 0);
}

/**
 * Limpia selecciones hijas huérfanas: si el modificador padre de un
 * childGroup ya no está seleccionado dentro de `group`, sus selecciones
 * hijas se eliminan. Llamar después de CADA mutación de selección de un
 * grupo (radio replace incluido).
 */
export function purgeChildSelections<T extends SelectionShape>(
    selections: T[],
    group: { id: string; modifiers: ParentModifierShape[] },
): T[] {
    let out = selections;
    for (const mod of group.modifiers) {
        const cg = mod.childGroup;
        if (!cg) continue;
        const parentSelected = out.some(s => s.groupId === group.id && s.id === mod.id && s.quantity > 0);
        if (!parentSelected) {
            out = out.filter(s => s.groupId !== cg.id);
        }
    }
    return out;
}

/**
 * Valida los sub-grupos de los modificadores SELECCIONADOS: para cada padre
 * elegido cuyo childGroup es requerido (isRequired o minSelections > 0), la
 * suma de cantidades del sub-grupo debe alcanzar el mínimo. Sub-grupos de
 * padres NO seleccionados no exigen nada.
 */
export function childGroupsValid(
    selections: SelectionShape[],
    groups: Array<{ id: string; modifiers: ParentModifierShape[] }>,
): boolean {
    for (const group of groups) {
        for (const mod of group.modifiers) {
            const cg = mod.childGroup;
            if (!cg || cg.isActive === false || cg.modifiers.length === 0) continue;
            const parentSelected = selections.some(s => s.groupId === group.id && s.id === mod.id && s.quantity > 0);
            if (!parentSelected) continue;
            const min = Math.max(cg.minSelections, cg.isRequired ? 1 : 0);
            if (min <= 0) continue;
            const total = selections
                .filter(s => s.groupId === cg.id)
                .reduce((sum, s) => sum + s.quantity, 0);
            if (total < min) return false;
        }
    }
    return true;
}

/** Total seleccionado dentro de un sub-grupo (para el badge n/max). */
export function childGroupSelectedTotal(selections: SelectionShape[], childGroupId: string): number {
    return selections.filter(s => s.groupId === childGroupId).reduce((sum, s) => sum + s.quantity, 0);
}

/**
 * IDs de los modificadores PADRE (los que despliegan un sub-grupo) de un item.
 * Se usan para marcar `hideFromKitchen` (§90): el renglón del padre (ej.
 * "Pincho Mixto") no se imprime en la comanda; solo las varas/hijos.
 */
export function collectParentModifierIds(
    modifierGroups: Array<{ modifierGroup: { modifiers: Array<{ id: string; childGroup?: ChildGroupData | null }> } }>,
): Set<string> {
    const ids = new Set<string>();
    for (const g of modifierGroups) {
        for (const m of g.modifierGroup.modifiers) {
            if (hasChildGroup(m)) ids.add(m.id);
        }
    }
    return ids;
}
