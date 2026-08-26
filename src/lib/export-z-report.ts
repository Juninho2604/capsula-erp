'use client';

import * as XLSX from 'xlsx';
import type { ZReportData } from '@/app/actions/sales/z-report.actions';

function fmt(amount: number) {
    return `$${amount.toFixed(2)}`;
}

function fmtOpt(amount: number) {
    return amount > 0 ? fmt(amount) : '-';
}

/**
 * §163 — Monto en bolívares realmente cobrado, para los métodos que se cobran
 * en Bs. Sale de lo guardado al cobrar; si el cobro es viejo y no lo tiene,
 * no se escribe nada (no se reconvierte con la tasa de hoy).
 */
function bsCol(bs?: number) {
    return (bs ?? 0) > 0
        ? ` · Bs ${bs!.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : '';
}

/**
 * Exporta el Reporte Z (cierre de caja) a Excel.
 * Incluye desglose completo: métodos de pago, servicio, propinas,
 * conteo por canal y subtotales por tipo de descuento.
 */
export function exportZReportToExcel(zReport: ZReportData) {
    const rows: [string, string][] = [
        // ── encabezado ──────────────────────────────────────────────────────
        ['SHANKLISH CARACAS — CIERRE DE CAJA', ''],
        ['Fecha', zReport.period],
        ['', ''],

        // ── ventas ──────────────────────────────────────────────────────────
        ['══ VENTAS ══════════════════════════════', ''],
        ['Ventas brutas (subtotales)',       fmt(zReport.grossTotal)],
        ['(-) Descuentos totales',           zReport.totalDiscounts > 0 ? `-${fmt(zReport.totalDiscounts)}` : '-'],
        ['   Divisas (33%)',                 fmtOpt(zReport.discountBreakdown.divisas)],
        ['   Cortesías',                     fmtOpt(zReport.discountBreakdown.cortesias)],
        ['   Otros descuentos',              fmtOpt(zReport.discountBreakdown.other)],
        ['VENTA NETA (productos)',           fmt(zReport.netTotal)],
        ['(+) Servicio 10% mesas',          fmtOpt(zReport.totalServiceFee)],
        ['(+) Propinas del día',             fmtOpt(zReport.totalTips)],
        ['TOTAL COBRADO',                    fmt(zReport.totalCollected)],
        // §107: equivalente en Bs a la tasa vigente al consultar.
        ...(((zReport.bsRate ?? 0) > 0 ? [
            ['TOTAL EN Bs',                  `Bs ${(zReport.totalCollectedBs ?? 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
            ['Tasa del día (al consultar)',  `1 USD = Bs ${(zReport.bsRate ?? 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
        ] : []) as [string, string][]),
        ['', ''],

        // ── arqueo por método de pago — omitido bajo blindaje cajera ────────
        ...(zReport.hidePaymentMethod ? [] : [
            ['══ ARQUEO DE CAJA ══════════════════════', ''],
            ['Efectivo USD',                     fmtOpt(zReport.paymentBreakdown.cash)],
            ['Zelle',                            fmtOpt(zReport.paymentBreakdown.zelle)],
            ['Punto PDV',                        fmtOpt(zReport.paymentBreakdown.card) + bsCol(zReport.paymentBreakdownBs?.card)],
            // §107: desglose por terminal PDV (solo si hay monto).
            // §163: con el monto en Bs realmente cobrado, que es contra lo que
            // se cuadra el lote del punto.
            ...(((zReport.pdvBreakdown?.shanklish ?? 0) > 0 ? [['   PDV Shanklish', fmt(zReport.pdvBreakdown!.shanklish) + bsCol(zReport.pdvBreakdownBs?.shanklish)]] : []) as [string, string][]),
            ...(((zReport.pdvBreakdown?.superferro ?? 0) > 0 ? [['   PDV Superferro', fmt(zReport.pdvBreakdown!.superferro) + bsCol(zReport.pdvBreakdownBs?.superferro)]] : []) as [string, string][]),
            ...(((zReport.pdvBreakdown?.otherCard ?? 0) > 0 ? [['   Otros PDV / tarjeta', fmt(zReport.pdvBreakdown!.otherCard) + bsCol(zReport.pdvBreakdownBs?.otherCard)]] : []) as [string, string][]),
            ['Pago Móvil',                       fmtOpt(zReport.paymentBreakdown.mobile) + bsCol(zReport.paymentBreakdownBs?.mobile)],
            // §163: el efectivo en Bs tenía su propia casilla desde el
            // clasificador compartido; antes se sumaba dentro de "Otros".
            ...((((zReport.paymentBreakdown.cashBs ?? 0) > 0) ? [['Efectivo Bs', fmt(zReport.paymentBreakdown.cashBs!) + bsCol(zReport.paymentBreakdownBs?.cashBs)]] : []) as [string, string][]),
            ['Transferencia',                    fmtOpt(zReport.paymentBreakdown.transfer) + bsCol(zReport.paymentBreakdownBs?.transfer)],
            ['PedidosYA / Externo',              fmtOpt(zReport.paymentBreakdown.external)],
            ['Otros',                            fmtOpt(zReport.paymentBreakdown.other)],
            ['SUMA MÉTODOS DE PAGO',             fmt(
                zReport.paymentBreakdown.cash +
                (zReport.paymentBreakdown.cashBs ?? 0) +
                zReport.paymentBreakdown.zelle +
                zReport.paymentBreakdown.card +
                zReport.paymentBreakdown.mobile +
                zReport.paymentBreakdown.transfer +
                zReport.paymentBreakdown.external +
                zReport.paymentBreakdown.other
            )],
            ...(((zReport.bsMissingCount ?? 0) > 0
                ? [['Cobros en Bs sin monto en Bs guardado', String(zReport.bsMissingCount)]]
                : []) as [string, string][]),
            ['', ''],
        ] as [string, string][]),

        // ── pedidos por canal ────────────────────────────────────────────────
        ['══ PEDIDOS POR CANAL ═══════════════════', ''],
        ['Restaurante / Mesas',              String(zReport.ordersByType.restaurant)],
        ['Delivery',                         String(zReport.ordersByType.delivery)],
        ['Pickup / Mostrador',               String(zReport.ordersByType.pickup)],
        ['PedidosYA',                        String(zReport.ordersByType.pedidosya)],
        ...(zReport.ordersByType.wink      > 0 ? [['Wink',       String(zReport.ordersByType.wink)]      as [string,string]] : []),
        ...(zReport.ordersByType.evento    > 0 ? [['Evento',     String(zReport.ordersByType.evento)]    as [string,string]] : []),
        ...(zReport.ordersByType.tablePong > 0 ? [['Table Pong', String(zReport.ordersByType.tablePong)] as [string,string]] : []),
        ['TOTAL TRANSACCIONES',              String(zReport.totalOrders)],
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 35 }, { wch: 16 }];

    // Negrita en filas de totales / títulos
    const boldRows = [0, 3, 9, 12, 14, 22, 24, rows.length - 1];
    for (const r of boldRows) {
        const cellA = XLSX.utils.encode_cell({ r, c: 0 });
        const cellB = XLSX.utils.encode_cell({ r, c: 1 });
        if (ws[cellA]) ws[cellA].s = { font: { bold: true } };
        if (ws[cellB]) ws[cellB].s = { font: { bold: true } };
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cierre de Caja');

    const fileName = `CierreCaja_${zReport.period.replace(/\//g, '-')}.xlsx`;
    XLSX.writeFile(wb, fileName);
}
