/**
 * Export Excel (xlsx — mismo patrón que §51.B/§51.C) y PDF (ventana
 * imprimible, patrón print-command.ts) para los reportes.
 * Los botones que llaman esto van gateados por reportes.exportar.
 */

import * as XLSX from 'xlsx';

export interface ExcelExportMeta {
    tenantName: string;
    reportTitle: string;
    /** 'YYYY-MM-DD' → se muestran como rango en el encabezado. */
    from: string;
    to: string;
    branchLabel?: string;
}

export type Aoa = (string | number)[][];

/** Genera y descarga un .xlsx con encabezado estándar (tenant + rango). */
export function exportAoaToExcel(meta: ExcelExportMeta, body: Aoa, fileBase: string) {
    const aoa: Aoa = [
        [meta.reportTitle.toUpperCase()],
        [meta.tenantName, meta.branchLabel ?? 'Todas las sucursales'],
        [`Rango: ${meta.from} → ${meta.to}`, `Generado: ${new Date().toLocaleString('es-VE')}`],
        [],
        ...body,
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = (body.find(r => r.length > 1) ?? []).map((_, i) => ({ wch: i === 1 ? 34 : 16 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
    XLSX.writeFile(wb, `${fileBase}_${meta.from}_${meta.to}.xlsx`);
}

/**
 * PDF vía ventana imprimible: clona el nodo del reporte en un documento
 * limpio (sin chrome del dashboard) y dispara el diálogo de impresión —
 * el usuario elige "Guardar como PDF". Cero dependencias nuevas.
 */
export function exportElementToPdf(meta: ExcelExportMeta, elementId: string) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${meta.reportTitle}</title>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; color: #18202F; padding: 24px; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .meta { font-size: 11px; color: #5B6779; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 14px; }
  th, td { border: 1px solid #E3E0D8; padding: 4px 8px; text-align: left; }
  th { background: #F2F0EA; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  tfoot td, tr.total td { font-weight: 600; background: #F7F5F0; }
  h2, h3 { font-size: 13px; margin: 14px 0 6px; }
  button, input, select, svg, .no-print { display: none !important; }
  @media print { body { padding: 0; } }
</style></head><body>
<h1>${meta.reportTitle}</h1>
<div class="meta">${meta.tenantName} · ${meta.branchLabel ?? 'Todas las sucursales'} · Rango: ${meta.from} → ${meta.to} · Generado: ${new Date().toLocaleString('es-VE')}</div>
${el.innerHTML}
</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 350);
}
