/**
 * Genera el workbook Excel de arqueo con formato Shanklish:
 *  - Sección 1 (filas 1-14): Resumen por método de pago
 *  - Sección 2 (fila 15+): Detalle fila por fila, agrupado por tipo
 *
 * Usa ExcelJS para generar el archivo directamente en el servidor.
 * No depende de una plantilla .xlsx externa.
 */
import ExcelJS from 'exceljs';
import type { ArqueoSaleRow } from '@/app/actions/sales.actions';

// ─────────────────────────────────────────────────────────────
//  Paleta de colores (ARGB, 8 dígitos)
// ─────────────────────────────────────────────────────────────
const BG = {
    title:      'FF0D1117',  // casi negro — fila título
    section:    'FF161B22',  // fila de labels sección 1
    value:      'FF0D1117',  // fila de valores auto-calculados
    blank:      'FF21262D',  // celda para entrada manual
    colHdr:     'FF1B3A5C',  // encabezados de columna (azul oscuro)
    groupHdr:   'FF1A2A3A',  // encabezado de bloque (mesa / pickup / etc.)
    dataEven:   'FF0D1117',  // fila de datos par
    dataOdd:    'FF161B22',  // fila de datos impar
    subtotal:   'FF0A3D2B',  // verde oscuro — subtotal de bloque
    grandTotal: 'FF052E16',  // verde muy oscuro — total general
    separator:  'FF1F2937',  // fila separadora entre secciones
};
const FG = {
    white:   'FFFFFFFF',
    amber:   'FFFBBF24',
    green:   'FF86EFAC',
    red:     'FFFCA5A5',
    gray:    'FF8B949E',
    blue:    'FF93C5FD',
    cyan:    'FF67E8F9',
};

const TOTAL_COLS = 24;
const HDR_ROW    = 15;   // fila con los nombres de columna
const DATA_START = 16;   // primera fila de datos

// ─────────────────────────────────────────────────────────────
//  Índices de columna (1-based, para ExcelJS)
// ─────────────────────────────────────────────────────────────
const C = {
    item:           1,
    desc:           2,
    corr:           3,
    ingreso:        4,
    gasto:          5,
    cashUsdIn:      6,
    cashUsdOut:     7,
    cashEurIn:      8,
    cashEurOut:     9,
    cashBsIn:      10,
    cashBsOut:     11,
    zelle:         12,
    vueltoPmBs:    13,
    vueltoPmUsd:   14,
    pmShanklishBs: 15,
    pmShanklishUsd:16,
    pmNourBs:      17,
    pmNourUsd:     18,
    pdvShanklishBs:19,
    pdvShanklishUsd:20,
    pdvSuperferroBs:21,
    pdvSuperferroUsd:22,
    servicio10:    23,
    propinaExtra:  24,
};

const COL_NAMES = [
    'Item', 'Descripción / Nombre', 'Correlativo',
    'Total Ingreso $', 'Total Gasto $',
    'Cash $ Ingreso', 'Cash $ Egreso',
    'Cash € Ingreso (EN $)', 'Cash € Egreso (EN $)',
    'Cash Bs Ingreso (EN $)', 'Cash Bs Egresos (EN $)',
    'Zelle (EN $)',
    'Vuelto PM en Bs', 'Vuelto PM (EN $)',
    'PM Bs Terminal 1', 'PM (EN $) Terminal 1',
    'PM Bs Terminal 2', 'PM (EN $) Terminal 2',
    'PDV Terminal 1 Bs', 'PDV Terminal 1 (EN $)',
    'PDV Terminal 2 Bs', 'PDV Terminal 2 (EN $)',
    'SERVICIO 10%', 'PROPINA EXTRA',
];

const COL_WIDTHS = [
     5,  // A: Item
    38,  // B: Descripción
    18,  // C: Correlativo
    14,  // D: Total Ingreso
    14,  // E: Total Gasto
    13,  // F: Cash USD In
    13,  // G: Cash USD Out
    15,  // H: Cash EUR In
    15,  // I: Cash EUR Out
    15,  // J: Cash Bs In
    15,  // K: Cash Bs Out
    13,  // L: Zelle
    13,  // M: Vuelto PM Bs
    13,  // N: Vuelto PM $
    15,  // O: PM Shanklish Bs
    15,  // P: PM Shanklish $
    15,  // Q: PM Nour Bs
    15,  // R: PM Nour $
    17,  // S: PDV Shanklish Bs
    17,  // T: PDV Shanklish $
    17,  // U: PDV Superferro Bs
    17,  // V: PDV Superferro $
    13,  // W: Servicio 10%
    13,  // X: Propina Extra
];

// ─────────────────────────────────────────────────────────────
//  Helpers de estilo
// ─────────────────────────────────────────────────────────────
function fill(argb: string): ExcelJS.Fill {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function thinBorder(argb = 'FF30363D'): Partial<ExcelJS.Borders> {
    const s: ExcelJS.BorderStyle = 'thin';
    const c = { style: s, color: { argb } };
    return { top: c, bottom: c, left: c, right: c };
}

type CellOpts = {
    bg?:     string;
    fg?:     string;
    bold?:   boolean;
    size?:   number;
    align?:  ExcelJS.Alignment['horizontal'];
    numFmt?: string;
    border?: boolean;
    wrap?:   boolean;
    italic?: boolean;
};

function styleCell(cell: ExcelJS.Cell, opts: CellOpts) {
    if (opts.bg)     cell.fill   = fill(opts.bg);
    cell.font = {
        name:   'Calibri',
        color:  { argb: opts.fg || FG.white },
        bold:   opts.bold   ?? false,
        italic: opts.italic ?? false,
        size:   opts.size   || 9,
    };
    cell.alignment = {
        horizontal: opts.align || 'left',
        vertical:   'middle',
        wrapText:   opts.wrap ?? false,
    };
    if (opts.numFmt) cell.numFmt = opts.numFmt;
    if (opts.border) cell.border = thinBorder() as ExcelJS.Borders;
}

function fillRow(row: ExcelJS.Row, bgArgb: string) {
    for (let col = 1; col <= TOTAL_COLS; col++) {
        row.getCell(col).fill = fill(bgArgb);
    }
}

function numV(v: number | null | undefined): number | null {
    return (v && v !== 0) ? v : null;
}

function s(rows: ArqueoSaleRow[], fn: (r: ArqueoSaleRow) => number): number {
    return rows.reduce((acc, r) => acc + fn(r), 0);
}

// ─────────────────────────────────────────────────────────────
//  Sección 1 — Resumen (filas 1-14)
// ─────────────────────────────────────────────────────────────
function buildSummary(sheet: ExcelJS.Worksheet, sales: ArqueoSaleRow[], dateStr: string) {
    const T = {
        cashUsd:      s(sales, r => r.paymentBreakdown.cashUsd),
        cashEur:      s(sales, r => r.paymentBreakdown.cashEur),
        cashBs:       s(sales, r => r.paymentBreakdown.cashBs),
        zelle:        s(sales, r => r.paymentBreakdown.zelle),
        pdvShanklish: s(sales, r => r.paymentBreakdown.cardPdVShanklish),
        pdvSuperferro:s(sales, r => r.paymentBreakdown.cardPdVSuperferro),
        pmShanklish:  s(sales, r => r.paymentBreakdown.mobileShanklish),
        pmNour:       s(sales, r => r.paymentBreakdown.mobileNour),
        serviceFee:   s(sales, r => r.serviceFee),
        pedidosYa:    s(sales.filter(r => r.orderType === 'PEDIDOSYA'), r => r.total),
        totalIngreso: s(sales, r => r.total),
    };

    const NUM = '"$"#,##0.00';

    // ── Fila 1: Título ───────────────────────────────────────
    const r1 = sheet.getRow(1);
    r1.height = 32;
    fillRow(r1, BG.title);
    const titleCell = r1.getCell(1);
    titleCell.value = `ARQUEO DE CAJA — SHANKLISH RESTAURANTE, PICKUP Y DELIVERY — ${dateStr}`;
    styleCell(titleCell, { bg: BG.title, fg: FG.amber, bold: true, size: 12, align: 'center' });
    sheet.mergeCells(1, 1, 1, TOTAL_COLS);

    // ── Fila 2: Labels de sub-secciones de efectivo ──────────
    const r2 = sheet.getRow(2);
    r2.height = 18;
    fillRow(r2, BG.section);
    const sec2: [number, string, string][] = [
        [C.item,      'RESUMEN TOTALES DEL DÍA', FG.amber],
        [C.cashUsdIn, 'CASH DÓLARES ($) — CAJA FUERTE', FG.blue],
        [C.cashEurIn, 'CASH EUROS (€) — CAJA FUERTE', FG.cyan],
        [C.cashBsIn,  'CASH BOLÍVARES (Bs) — EN $ — CAJA FUERTE', FG.cyan],
    ];
    for (const [col, text, fg] of sec2) {
        const cell = r2.getCell(col);
        cell.value = text;
        styleCell(cell, { bg: BG.section, fg, bold: true, size: 8 });
    }

    // ── Filas 3-4: Cash USD ──────────────────────────────────
    const r3 = sheet.getRow(3);
    r3.height = 26;
    fillRow(r3, BG.section);
    const lbl3: [number, string][] = [
        [1, 'Capital Dólares ($)\nInicio Cash'],
        [3, 'Cash Dólares ($)\nIngreso'],
        [4, 'Cash Dólares ($)\nEgreso'],
        [5, 'Capital Dólares ($)\nCerrado Cash'],
    ];
    for (const [col, txt] of lbl3) {
        r3.getCell(col).value = txt;
        styleCell(r3.getCell(col), { bg: BG.section, fg: FG.white, bold: true, size: 8, wrap: true });
    }

    const r4 = sheet.getRow(4);
    r4.height = 22;
    fillRow(r4, BG.blank);
    // A4: manual (initial $), C4: auto, D4: manual (egreso), E4: manual (cerrado)
    r4.getCell(C.corr).value = numV(T.cashUsd);
    styleCell(r4.getCell(C.corr), { bg: BG.value, fg: FG.green, bold: true, numFmt: NUM, align: 'right' });

    // ── Filas 5-6: Cash EUR ──────────────────────────────────
    const r5 = sheet.getRow(5);
    r5.height = 26;
    fillRow(r5, BG.section);
    const lbl5: [number, string][] = [
        [1, 'Capital Euro (€)\nInicio'],
        [3, 'Cash Euros (€)\nIngreso (EN $)'],
        [4, 'Cash Euros (€)\nEgreso (EN $)'],
        [5, 'Capital Euros (€)\nCerrado Cash'],
    ];
    for (const [col, txt] of lbl5) {
        r5.getCell(col).value = txt;
        styleCell(r5.getCell(col), { bg: BG.section, fg: FG.white, bold: true, size: 8, wrap: true });
    }

    const r6 = sheet.getRow(6);
    r6.height = 22;
    fillRow(r6, BG.blank);
    r6.getCell(C.corr).value = numV(T.cashEur);
    styleCell(r6.getCell(C.corr), { bg: BG.value, fg: FG.green, bold: true, numFmt: NUM, align: 'right' });

    // ── Filas 7-8: Cash Bs ───────────────────────────────────
    const r7 = sheet.getRow(7);
    r7.height = 26;
    fillRow(r7, BG.section);
    const lbl7: [number, string][] = [
        [1, 'Capital Bolívares (Bs)\nen $ Inicio'],
        [3, 'Cash Bolívares (Bs)\nIngreso (EN $)'],
        [4, 'Cash Bolívares (Bs)\nEgresos (EN $)'],
        [5, 'Capital Bolívares (Bs)\nen $ Cerrado Cash'],
    ];
    for (const [col, txt] of lbl7) {
        r7.getCell(col).value = txt;
        styleCell(r7.getCell(col), { bg: BG.section, fg: FG.white, bold: true, size: 8, wrap: true });
    }

    const r8 = sheet.getRow(8);
    r8.height = 22;
    fillRow(r8, BG.blank);
    r8.getCell(C.corr).value = numV(T.cashBs);
    styleCell(r8.getCell(C.corr), { bg: BG.value, fg: FG.green, bold: true, numFmt: NUM, align: 'right' });

    // ── Filas 9-10: Pago Móvil Shanklish + Vuelto ────────────
    const r9 = sheet.getRow(9);
    r9.height = 26;
    fillRow(r9, BG.section);
    const lbl9: [number, string][] = [
        [1, 'Vuelto PM\nen Bs'],
        [3, 'Vuelto PM\n(EN $)'],
        [4, 'Pago Móvil Bs\nSHANKLISH'],
        [5, 'Pago Móvil ($)\nSHANKLISH'],
        [7, 'Total $\nPM SHANKLISH'],
    ];
    for (const [col, txt] of lbl9) {
        r9.getCell(col).value = txt;
        styleCell(r9.getCell(col), { bg: BG.section, fg: FG.white, bold: true, size: 8, wrap: true });
    }

    const r10 = sheet.getRow(10);
    r10.height = 22;
    fillRow(r10, BG.blank);
    // E10: PM Shanklish EN$ (auto), G10: same value as total cross-check
    r10.getCell(C.gasto).value = numV(T.pmShanklish);
    styleCell(r10.getCell(C.gasto), { bg: BG.value, fg: FG.green, bold: true, numFmt: NUM, align: 'right' });
    r10.getCell(7).value = numV(T.pmShanklish);
    styleCell(r10.getCell(7), { bg: BG.value, fg: FG.green, bold: true, numFmt: NUM, align: 'right' });

    // ── Filas 11-12: PDV + Zelle + Propina ───────────────────
    const r11 = sheet.getRow(11);
    r11.height = 26;
    fillRow(r11, BG.section);
    const lbl11: [number, string][] = [
        [1,  'PDV Provincial\nTerminal 1 en Bs'],
        [3,  'PDV Provincial\nTerminal 1 (EN $)'],
        [4,  'PDV Provincial\nSuperferro SC en Bs'],
        [5,  'PDV Provincial\nSuperferro SC (EN $)'],
        [6,  'Zelle\n(EN $)'],
        [8,  'PROPINA\nEXTRA'],
        [9,  'SERVICIO\n10%'],
    ];
    for (const [col, txt] of lbl11) {
        r11.getCell(col).value = txt;
        styleCell(r11.getCell(col), { bg: BG.section, fg: FG.white, bold: true, size: 8, wrap: true });
    }

    const r12 = sheet.getRow(12);
    r12.height = 22;
    fillRow(r12, BG.blank);
    const vals12: [number, number | null, string][] = [
        [C.corr,   numV(T.pdvShanklish),  FG.green],
        [C.gasto,  numV(T.pdvSuperferro), FG.green],
        [6,        numV(T.zelle),         FG.green],
        [9,        numV(T.serviceFee),    FG.amber],
    ];
    for (const [col, val, fg] of vals12) {
        if (val !== null) {
            r12.getCell(col).value = val;
            styleCell(r12.getCell(col), { bg: BG.value, fg, bold: true, numFmt: NUM, align: 'right' });
        }
    }

    // ── Filas 13-14: PM Nour + PedidosYA + TOTAL GENERAL ─────
    const r13 = sheet.getRow(13);
    r13.height = 26;
    fillRow(r13, BG.section);
    const lbl13: [number, string][] = [
        [2,  'TOTAL INGRESO $'],
        [4,  'TOTAL GASTO'],
        [6,  'PM Bs\nNOUR'],
        [7,  'PM ($)\nNOUR'],
        [8,  'PEDIDOS YA\n($)'],
        [9,  'BCV\n(Bs/$)'],
    ];
    for (const [col, txt] of lbl13) {
        r13.getCell(col).value = txt;
        styleCell(r13.getCell(col), { bg: BG.section, fg: FG.white, bold: true, size: 8, wrap: true });
    }

    const r14 = sheet.getRow(14);
    r14.height = 26;
    fillRow(r14, BG.blank);
    r14.getCell(C.desc).value = T.totalIngreso;
    styleCell(r14.getCell(C.desc), { bg: BG.grandTotal, fg: FG.green, bold: true, size: 12, numFmt: NUM, align: 'right' });
    // C14: total gasto → manual entry (blank)
    r14.getCell(7).value = numV(T.pmNour);
    styleCell(r14.getCell(7), { bg: BG.value, fg: FG.green, bold: true, numFmt: NUM, align: 'right' });
    r14.getCell(8).value = numV(T.pedidosYa);
    styleCell(r14.getCell(8), { bg: BG.value, fg: FG.green, bold: true, numFmt: NUM, align: 'right' });
    // F14: BCV rate → manual entry (blank)
}

// ─────────────────────────────────────────────────────────────
//  Encabezados de columna (fila 15)
// ─────────────────────────────────────────────────────────────
function buildColHeaders(sheet: ExcelJS.Worksheet) {
    const row = sheet.getRow(HDR_ROW);
    row.height = 55;
    COL_NAMES.forEach((name, i) => {
        const cell = row.getCell(i + 1);
        cell.value = name;
        styleCell(cell, {
            bg:     BG.colHdr,
            fg:     FG.amber,
            bold:   true,
            size:   8,
            align:  'center',
            wrap:   true,
            border: true,
        });
    });
}

// ─────────────────────────────────────────────────────────────
//  Filas de datos, agrupadas por tipo (fila 16+)
// ─────────────────────────────────────────────────────────────
function buildDataRows(sheet: ExcelJS.Worksheet, sales: ArqueoSaleRow[]) {
    type GroupDef = { label: string; type: ArqueoSaleRow['orderType']; rows: ArqueoSaleRow[] };
    const groups: GroupDef[] = ([
        { label: 'MESAS — RESTAURANTE',   type: 'RESTAURANT' as const, rows: sales.filter(r => r.orderType === 'RESTAURANT') },
        { label: 'PICKUP / PARA LLEVAR',  type: 'PICKUP'     as const, rows: sales.filter(r => r.orderType === 'PICKUP') },
        { label: 'DELIVERY',              type: 'DELIVERY'   as const, rows: sales.filter(r => r.orderType === 'DELIVERY') },
        { label: 'PEDIDOS YA',            type: 'PEDIDOSYA'  as const, rows: sales.filter(r => r.orderType === 'PEDIDOSYA') },
    ] as GroupDef[]).filter(g => g.rows.length > 0);

    const NUM  = '#,##0.00';
    let rowNum = DATA_START;
    let itemN  = 1;

    for (const group of groups) {
        // ── Encabezado del bloque ────────────────────────────
        const gh = sheet.getRow(rowNum++);
        gh.height = 22;
        fillRow(gh, BG.groupHdr);
        gh.getCell(1).value = `▸ ${group.label}  (${group.rows.length} órdenes)`;
        styleCell(gh.getCell(1), { bg: BG.groupHdr, fg: FG.amber, bold: true, size: 10 });
        sheet.mergeCells(rowNum - 1, 1, rowNum - 1, TOTAL_COLS);

        // ── Filas de órdenes ─────────────────────────────────
        for (const sale of group.rows) {
            const r = sheet.getRow(rowNum++);
            r.height = 17;
            const bg = ((rowNum) % 2 === 0) ? BG.dataEven : BG.dataOdd;
            fillRow(r, bg);

            const pb = sale.paymentBreakdown;

            const dataCells: [number, number | string | null, string?, string?][] = [
                [C.item,            itemN++,                   FG.gray,  'center'],
                [C.desc,            sale.description,          FG.white, 'left'],
                [C.corr,            sale.correlativo,          FG.gray,  'center'],
                [C.ingreso,         numV(sale.total),          FG.green, 'right'],
                // E gasto: blank
                [C.cashUsdIn,       numV(pb.cashUsd),          FG.white, 'right'],
                // G out: blank
                [C.cashEurIn,       numV(pb.cashEur),          FG.white, 'right'],
                // I out: blank
                [C.cashBsIn,        numV(pb.cashBs),           FG.white, 'right'],
                // K out: blank
                [C.zelle,           numV(pb.zelle),            FG.white, 'right'],
                // M vueltoPmBs: blank
                // N vueltoPmUsd: blank
                // O pmShanklishBs: blank
                [C.pmShanklishUsd,  numV(pb.mobileShanklish),  FG.white, 'right'],
                // Q pmNourBs: blank
                [C.pmNourUsd,       numV(pb.mobileNour),       FG.white, 'right'],
                // S pdvShanklishBs: blank
                [C.pdvShanklishUsd, numV(pb.cardPdVShanklish), FG.white, 'right'],
                // U pdvSuperferroBs: blank
                [C.pdvSuperferroUsd,numV(pb.cardPdVSuperferro),FG.white, 'right'],
                [C.servicio10,      numV(sale.serviceFee),     FG.amber, 'right'],
            ];

            for (const [col, val, fg, align] of dataCells) {
                const cell = r.getCell(col);
                cell.value = val ?? null;
                styleCell(cell, {
                    bg,
                    fg:     fg || FG.white,
                    align:  (align as ExcelJS.Alignment['horizontal']) || 'left',
                    numFmt: (typeof val === 'number') ? NUM : undefined,
                    border: true,
                });
            }
        }

        // ── Fila de subtotal del bloque ──────────────────────
        const ST = {
            total:        s(group.rows, r => r.total),
            cashUsd:      s(group.rows, r => r.paymentBreakdown.cashUsd),
            cashEur:      s(group.rows, r => r.paymentBreakdown.cashEur),
            cashBs:       s(group.rows, r => r.paymentBreakdown.cashBs),
            zelle:        s(group.rows, r => r.paymentBreakdown.zelle),
            pmShanklish:  s(group.rows, r => r.paymentBreakdown.mobileShanklish),
            pmNour:       s(group.rows, r => r.paymentBreakdown.mobileNour),
            pdvShanklish: s(group.rows, r => r.paymentBreakdown.cardPdVShanklish),
            pdvSuperferro:s(group.rows, r => r.paymentBreakdown.cardPdVSuperferro),
            serviceFee:   s(group.rows, r => r.serviceFee),
        };

        const st = sheet.getRow(rowNum++);
        st.height = 20;
        fillRow(st, BG.subtotal);
        st.getCell(C.desc).value = `SUBTOTAL ${group.label}`;
        styleCell(st.getCell(C.desc), { bg: BG.subtotal, fg: FG.green, bold: true, size: 9 });

        const stVals: [number, number][] = [
            [C.ingreso,          ST.total],
            [C.cashUsdIn,        ST.cashUsd],
            [C.cashEurIn,        ST.cashEur],
            [C.cashBsIn,         ST.cashBs],
            [C.zelle,            ST.zelle],
            [C.pmShanklishUsd,   ST.pmShanklish],
            [C.pmNourUsd,        ST.pmNour],
            [C.pdvShanklishUsd,  ST.pdvShanklish],
            [C.pdvSuperferroUsd, ST.pdvSuperferro],
            [C.servicio10,       ST.serviceFee],
        ];
        for (const [col, val] of stVals) {
            if (val > 0) {
                st.getCell(col).value = val;
                styleCell(st.getCell(col), { bg: BG.subtotal, fg: FG.green, bold: true, numFmt: NUM, align: 'right' });
            }
        }

        // Separador visual entre bloques
        const sep = sheet.getRow(rowNum++);
        sep.height = 6;
        fillRow(sep, BG.separator);
    }

    // ── Fila de TOTAL GENERAL ────────────────────────────────
    const GT = {
        total:        s(sales, r => r.total),
        cashUsd:      s(sales, r => r.paymentBreakdown.cashUsd),
        cashEur:      s(sales, r => r.paymentBreakdown.cashEur),
        cashBs:       s(sales, r => r.paymentBreakdown.cashBs),
        zelle:        s(sales, r => r.paymentBreakdown.zelle),
        pmShanklish:  s(sales, r => r.paymentBreakdown.mobileShanklish),
        pmNour:       s(sales, r => r.paymentBreakdown.mobileNour),
        pdvShanklish: s(sales, r => r.paymentBreakdown.cardPdVShanklish),
        pdvSuperferro:s(sales, r => r.paymentBreakdown.cardPdVSuperferro),
        serviceFee:   s(sales, r => r.serviceFee),
    };

    const gt = sheet.getRow(rowNum);
    gt.height = 26;
    fillRow(gt, BG.grandTotal);
    gt.getCell(C.desc).value = '▶  TOTAL GENERAL DEL DÍA';
    styleCell(gt.getCell(C.desc), { bg: BG.grandTotal, fg: FG.green, bold: true, size: 11 });

    const gtVals: [number, number][] = [
        [C.ingreso,          GT.total],
        [C.cashUsdIn,        GT.cashUsd],
        [C.cashEurIn,        GT.cashEur],
        [C.cashBsIn,         GT.cashBs],
        [C.zelle,            GT.zelle],
        [C.pmShanklishUsd,   GT.pmShanklish],
        [C.pmNourUsd,        GT.pmNour],
        [C.pdvShanklishUsd,  GT.pdvShanklish],
        [C.pdvSuperferroUsd, GT.pdvSuperferro],
        [C.servicio10,       GT.serviceFee],
    ];
    for (const [col, val] of gtVals) {
        if (val > 0) {
            gt.getCell(col).value = val;
            styleCell(gt.getCell(col), { bg: BG.grandTotal, fg: FG.green, bold: true, size: 11, numFmt: NUM, align: 'right' });
        }
    }
}

// ─────────────────────────────────────────────────────────────
//  Anchos de columna
// ─────────────────────────────────────────────────────────────
function applyColumnWidths(sheet: ExcelJS.Worksheet) {
    COL_WIDTHS.forEach((w, i) => {
        sheet.getColumn(i + 1).width = w;
    });
}

// ─────────────────────────────────────────────────────────────
//  Función principal
// ─────────────────────────────────────────────────────────────
export async function buildArqueoWorkbookFromTemplate(
    sales: ArqueoSaleRow[],
    dateStr: string,
): Promise<ExcelJS.Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator  = process.env.NEXT_PUBLIC_APP_NAME ?? 'Cápsula ERP';
    workbook.created  = new Date();

    const sheet = workbook.addWorksheet('Arqueo Caja', {
        pageSetup: {
            paperSize:    9,            // A4
            orientation:  'landscape',
            fitToPage:    true,
            fitToWidth:   1,
            fitToHeight:  0,
            margins: { left: 0.25, right: 0.25, top: 0.25, bottom: 0.25, header: 0, footer: 0 },
        },
        views: [{ state: 'frozen', xSplit: 0, ySplit: HDR_ROW }],  // congelar Sección 1 + headers
        properties: { tabColor: { argb: 'FFFBBF24' } },
    });

    buildSummary(sheet, sales, dateStr);
    buildColHeaders(sheet);
    buildDataRows(sheet, sales);
    applyColumnWidths(sheet);

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as ExcelJS.Buffer;
}

export function getArqueoFileName(dateStr: string): string {
    return `Arqueo_Caja_${(process.env.NEXT_PUBLIC_STORE_PREFIX ?? 'capsula')}_${dateStr.replace(/\//g, '-')}.xlsx`;
}
