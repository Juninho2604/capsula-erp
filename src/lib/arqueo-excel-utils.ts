/**
 * Rellena la plantilla Excel de arqueo con los datos de ventas.
 * Preserva el formato, colores y estructura original de la plantilla.
 * La plantilla debe estar en: public/templates/arqueo-plantilla.xlsx
 */
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import type { ArqueoSaleRow } from '@/app/actions/sales.actions';

const DATA_START_ROW = 16;
const COLS = {
    item: 1,           // A
    descripcion: 2,    // B
    correlativo: 3,    // C
    totalIngreso: 4,   // D
    totalGasto: 5,     // E
    cashUsdIngreso: 6, // F
    cashUsdEgreso: 7,  // G
    zelle: 12,         // L
    pdvShanklishUsd: 20,   // T
    pdvSuperferroUsd: 22,  // V
    pmShanklishUsd: 16,   // P
    pmNourUsd: 18,        // R
    servicio10: 23,       // W
    propinaExtra: 24,     // X
};

function getTemplatePath(): string {
    return path.join(process.cwd(), 'public', 'templates', 'arqueo-plantilla.xlsx');
}

/** Genera un workbook de arqueo desde cero sin necesitar plantilla. */
async function buildArqueoWorkbookSimple(sales: ArqueoSaleRow[]): Promise<ExcelJS.Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Restaurante');

    const headers = [
        'Item', 'Descripción', 'Correlativo', 'Total ($)',
        'Cash USD', 'Zelle', 'PDV Shanklish ($)', 'PDV Superferro ($)',
        'PM Shanklish ($)', 'PM Nour ($)', 'Servicio 10%',
    ];
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };

    sales.forEach((sale, idx) => {
        sheet.addRow([
            idx + 1,
            sale.description,
            sale.correlativo,
            sale.total,
            sale.paymentBreakdown.cashUsd   || null,
            sale.paymentBreakdown.zelle     || null,
            sale.paymentBreakdown.cardPdVShanklish  || null,
            sale.paymentBreakdown.cardPdVSuperferro || null,
            sale.paymentBreakdown.mobileShanklish   || null,
            sale.paymentBreakdown.mobileNour        || null,
            sale.serviceFee > 0 ? sale.serviceFee : null,
        ]);
    });

    // Fila de totales
    const totalRow = sheet.rowCount + 1;
    const t = sheet.addRow([
        '', 'TOTAL', '',
        sales.reduce((s, r) => s + r.total, 0),
        sales.reduce((s, r) => s + r.paymentBreakdown.cashUsd, 0) || null,
        sales.reduce((s, r) => s + r.paymentBreakdown.zelle, 0) || null,
        sales.reduce((s, r) => s + r.paymentBreakdown.cardPdVShanklish, 0) || null,
        sales.reduce((s, r) => s + r.paymentBreakdown.cardPdVSuperferro, 0) || null,
        sales.reduce((s, r) => s + r.paymentBreakdown.mobileShanklish, 0) || null,
        sales.reduce((s, r) => s + r.paymentBreakdown.mobileNour, 0) || null,
        sales.reduce((s, r) => s + r.serviceFee, 0) || null,
    ]);
    t.font = { bold: true };
    void totalRow; // suppress unused warning

    sheet.columns = [
        { width: 6 }, { width: 36 }, { width: 18 }, { width: 12 },
        { width: 12 }, { width: 12 }, { width: 18 }, { width: 18 },
        { width: 16 }, { width: 16 }, { width: 14 },
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as ExcelJS.Buffer;
}

function fillSheetWithSales(sheet: ExcelJS.Worksheet, sales: ArqueoSaleRow[]) {
    sales.forEach((sale, idx) => {
        const rowNum = DATA_START_ROW + idx;
        const row = sheet.getRow(rowNum);
        row.getCell(COLS.item).value          = idx + 1;
        row.getCell(COLS.descripcion).value   = sale.description;
        row.getCell(COLS.correlativo).value   = sale.correlativo;
        row.getCell(COLS.totalIngreso).value  = sale.total;
        row.getCell(COLS.cashUsdIngreso).value        = sale.paymentBreakdown.cashUsd           || null;
        row.getCell(COLS.zelle).value                 = sale.paymentBreakdown.zelle             || null;
        row.getCell(COLS.pdvShanklishUsd).value       = sale.paymentBreakdown.cardPdVShanklish  || null;
        row.getCell(COLS.pdvSuperferroUsd).value      = sale.paymentBreakdown.cardPdVSuperferro || null;
        row.getCell(COLS.pmShanklishUsd).value        = sale.paymentBreakdown.mobileShanklish   || null;
        row.getCell(COLS.pmNourUsd).value             = sale.paymentBreakdown.mobileNour        || null;
        row.getCell(COLS.servicio10).value            = sale.serviceFee > 0 ? sale.serviceFee  : null;
    });
}

export async function buildArqueoWorkbookFromTemplate(sales: ArqueoSaleRow[]): Promise<ExcelJS.Buffer> {
    const templatePath = getTemplatePath();

    // Si la plantilla no existe, generar workbook simple como fallback
    if (!fs.existsSync(templatePath)) {
        return buildArqueoWorkbookSimple(sales);
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    const sheet = workbook.getWorksheet('Restaurante');
    if (!sheet) {
        // Hoja no encontrada → fallback
        return buildArqueoWorkbookSimple(sales);
    }

    fillSheetWithSales(sheet, sales);

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as ExcelJS.Buffer;
}

export function getArqueoFileName(dateStr: string): string {
    return `Arqueo_Caja_Shanklish_${dateStr.replace(/\//g, '-')}.xlsx`;
}
