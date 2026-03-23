/**
 * Parsea hojas tipo inventario Shanklish:
 * - Fila encabezado: primera celda "PRODUCTO"
 * - Modo 1 almacén: PRODUCTO | CANTIDAD EN STOCK (o similar)
 * - Modo 2 almacenes: PRODUCTO | CANT. ALMACÉN PRINCIPAL | CANT. PRODUCCIÓN (3ª columna con texto, no vacía)
 */
import * as XLSX from 'xlsx';

export type ParsedCountRow = {
  productName: string;
  qtyPrincipal: number | null;
  qtyProduction: number | null;
};

function norm(s: string) {
  return String(s || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function parseNum(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  if (Number.isNaN(n)) return null;
  return n;
}

export function parseInventoryWorksheet(rows: unknown[][]): ParsedCountRow[] {
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (norm(String(row[0] || '')) === 'PRODUCTO') {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx < 0) {
    throw new Error(
      'No se encontró la fila con "PRODUCTO" en la primera columna. Copie el formato de su Excel o descargue la plantilla.'
    );
  }

  const header = rows[headerIdx] as unknown[];
  const h2Raw = String(header[2] ?? '').trim();
  /** Tercera columna con encabezado de texto → dos almacenes */
  const isDual =
    h2Raw.length > 0 &&
    Number.isNaN(parseFloat(h2Raw)) &&
    !/^[\d.,\s]+$/.test(h2Raw);

  const out: ParsedCountRow[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const name = String(row[0] || '').trim();
    if (!name) continue;
    if (norm(name) === 'PRODUCTO') continue;
    const n = norm(name);
    if (n.startsWith('TOTAL') || n === 'SUMA') continue;

    const q1 = parseNum(row[1]);
    const q2 = isDual ? parseNum(row[2]) : null;

    if (isDual) {
      if (q1 === null && q2 === null) continue;
      out.push({
        productName: name,
        qtyPrincipal: q1 ?? 0,
        qtyProduction: q2 ?? 0,
      });
    } else {
      if (q1 === null) continue;
      out.push({
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
