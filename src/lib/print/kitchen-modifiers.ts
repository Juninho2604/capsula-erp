/**
 * Filtro server-side del modificador PADRE en comandas (§90/§93) — PURO.
 *
 * En el POS, el flag `hideFromKitchen` viaja en el carrito y `buildKitchenItems`
 * lo filtra ANTES de encolar la comanda. Pero las superficies que imprimen o
 * muestran comanda desde datos GUARDADOS (display /kitchen y /kitchen/barra
 * con auto-print, reimpresión de comandas del día) no tienen ese flag: leen
 * `SalesOrderItemModifier`, que sí referencia al `MenuModifier` vivo.
 *
 * Regla (espejo de collectParentModifierIds, pero por-orden y más precisa):
 * un modificador guardado se OCULTA de la comanda si su MenuModifier despliega
 * un sub-grupo (`childGroupId`) Y en el MISMO item hay al menos un hermano
 * elegido de ese sub-grupo (su MenuModifier.groupId === childGroupId). Si no
 * hay hijos seleccionados (edge: sub-grupo opcional vacío), el padre se
 * muestra — ocultarlo perdería información.
 *
 * El recibo del cliente NO usa este filtro: el padre lleva el precio.
 */

export interface StoredModifierRow {
    /** Relación viva al MenuModifier (nullable: modificadores legacy/borrados). */
    modifier?: { groupId: string; childGroupId?: string | null } | null;
}

/** ¿La fila es un padre con hijos presentes en el mismo item? */
export function isParentWithChildren(row: StoredModifierRow, siblings: StoredModifierRow[]): boolean {
    const cg = row.modifier?.childGroupId;
    if (!cg) return false;
    return siblings.some(s => s !== row && s.modifier?.groupId === cg);
}

/** Filtra las filas de modificadores que NO deben salir en la comanda. */
export function filterKitchenModifiers<T extends StoredModifierRow>(rows: T[]): T[] {
    return rows.filter(r => !isParentWithChildren(r, rows));
}
