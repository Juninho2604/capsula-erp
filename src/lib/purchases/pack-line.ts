/**
 * §108.1 — Matemática de líneas de documento con presentación por bulto.
 *
 * Caso canónico: "5 bultos × 12 paquetes a $30 el bulto" →
 *   - unidades que entran al almacén: 5 × 12 = 60 (unidad base del insumo)
 *   - costo por unidad base: 30 / 12 = 2.50
 *   - total de la línea: 5 × 30 = 150
 *
 * Reglas:
 *   - `unitsPerPack` vacío/0/inválido ⇒ 1 (compra por unidad suelta, se
 *     comporta idéntico al flujo previo a §108).
 *   - `packUnits` se redondea a 4 decimales para matar ruido de punto
 *     flotante (0.1 × 3 = 0.30000000000000004 → 0.3). Lo que entra al
 *     almacén es EXACTAMENTE bultos × unid/bulto.
 *   - `packUnitCost` se redondea a 6 decimales (granularidad de costeo).
 *
 * Compartido por la UI (documentos-view) y testeado en pack-line.test.ts.
 */

const num = (v: string | number | null | undefined): number => {
  const n = typeof v === 'string' ? parseFloat(v) : (v ?? 0);
  return isFinite(n) ? n : 0;
};

export interface PackLine {
  /** Cantidad de bultos (o unidades sueltas si unitsPerPack queda vacío). */
  quantity: string | number;
  /** Unidades del insumo por bulto. Vacío/0 ⇒ 1. */
  unitsPerPack?: string | number;
  /** Costo POR BULTO en la moneda del documento. */
  unitCost: string | number;
}

/** Unidades por bulto efectivas (default 1). */
export function effectiveUnitsPerPack(line: PackLine): number {
  const n = num(line.unitsPerPack);
  return n > 0 ? n : 1;
}

/** Unidades totales que entran al almacén: bultos × unid/bulto (4 dec). */
export function packUnits(line: PackLine): number {
  const raw = num(line.quantity) * effectiveUnitsPerPack(line);
  return Math.round(raw * 10000) / 10000;
}

/** Total de la línea en la moneda del documento: bultos × costo bulto (2 dec). */
export function packLineTotal(line: PackLine): number {
  return Math.round(num(line.quantity) * num(line.unitCost) * 100) / 100;
}

/** Costo por unidad base: costo bulto / unid por bulto (6 dec). */
export function packUnitCost(line: PackLine): number {
  const raw = num(line.unitCost) / effectiveUnitsPerPack(line);
  return Math.round(raw * 1e6) / 1e6;
}
