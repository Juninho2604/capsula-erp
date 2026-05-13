'use client';

import * as XLSX from 'xlsx';
import type { SalesAuditData, SalesAuditItem } from '@/app/actions/sales/audit-export.actions';

interface SkuRollupRow {
    sku: string;
    productName: string;
    category: string;
    qtyVendida: number;
    qtyAnulada: number;
    totalVendido: number;
    costoTotal: number;
}

function rollupBySku(items: SalesAuditItem[]): SkuRollupRow[] {
    const map = new Map<string, SkuRollupRow>();
    for (const it of items) {
        const key = `${it.sku}__${it.productName}`;
        const existing = map.get(key);
        if (existing) {
            if (it.voided) existing.qtyAnulada += it.quantity;
            else {
                existing.qtyVendida += it.quantity;
                existing.totalVendido += it.lineTotal;
                existing.costoTotal += it.costTotal ?? 0;
            }
        } else {
            map.set(key, {
                sku: it.sku,
                productName: it.productName,
                category: it.category,
                qtyVendida: it.voided ? 0 : it.quantity,
                qtyAnulada: it.voided ? it.quantity : 0,
                totalVendido: it.voided ? 0 : it.lineTotal,
                costoTotal: it.voided ? 0 : (it.costTotal ?? 0),
            });
        }
    }
    return Array.from(map.values()).sort((a, b) => b.qtyVendida - a.qtyVendida);
}

function timeStr(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString('es-VE', {
        timeZone: 'America/Caracas',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
}

export function exportSalesAuditToExcel(audit: SalesAuditData) {
    const wb = XLSX.utils.book_new();

    // ── Hoja 1: Items (detalle por producto) ────────────────────────────────
    const itemRows = audit.items.map(it => ({
        'Orden #':       it.orderNumber,
        'Hora':          timeStr(it.createdAt),
        'Tipo':          it.orderType,
        'SKU':           it.sku,
        'Producto':      it.productName,
        'Categoría':     it.category,
        'Cantidad':      it.quantity,
        'Precio unit.':  Number(it.unitPrice.toFixed(2)),
        'Total línea':   Number(it.lineTotal.toFixed(2)),
        'Costo unit.':   it.costPerUnit != null ? Number(it.costPerUnit.toFixed(4)) : '',
        'Costo total':   it.costTotal != null ? Number(it.costTotal.toFixed(2)) : '',
        'Modificadores': it.modifiers,
        'Notas':         it.notes ?? '',
        'Mesero/Caja':   it.cashier,
        'Cliente':       it.customerName ?? '',
        'Estado orden':  it.orderStatus,
        'Anulado':       it.voided ? 'SÍ' : 'NO',
        'Razón anul.':   it.voidReason ?? '',
    }));
    const wsItems = XLSX.utils.json_to_sheet(itemRows);
    wsItems['!cols'] = [
        { wch: 14 }, { wch: 8 },  { wch: 12 }, { wch: 14 }, { wch: 30 },
        { wch: 18 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
        { wch: 12 }, { wch: 30 }, { wch: 25 }, { wch: 22 }, { wch: 22 },
        { wch: 14 }, { wch: 10 }, { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, wsItems, 'Items');

    // ── Hoja 2: Resumen por SKU ──────────────────────────────────────────────
    const rollup = rollupBySku(audit.items);
    const rollupRows = rollup.map(r => ({
        'SKU':              r.sku,
        'Producto':         r.productName,
        'Categoría':        r.category,
        'Unid. vendidas':   r.qtyVendida,
        'Unid. anuladas':   r.qtyAnulada,
        'Total vendido':    Number(r.totalVendido.toFixed(2)),
        'Costo total':      Number(r.costoTotal.toFixed(2)),
        'Margen':           Number((r.totalVendido - r.costoTotal).toFixed(2)),
    }));
    const wsRollup = XLSX.utils.json_to_sheet(rollupRows);
    wsRollup['!cols'] = [
        { wch: 16 }, { wch: 32 }, { wch: 20 }, { wch: 14 },
        { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, wsRollup, 'Resumen por SKU');

    // ── Hoja 3: Órdenes ──────────────────────────────────────────────────────
    const orderRows = audit.orders.map(o => ({
        'Orden #':        o.orderNumber,
        'Hora':           timeStr(o.createdAt),
        'Tipo':           o.orderType,
        'Estado':         o.status,
        'Cliente':        o.customerName ?? '',
        'Teléfono':       o.customerPhone ?? '',
        'Mesero/Caja':    o.cashier,
        'Método pago':    o.paymentMethod,
        'Subtotal':       Number(o.subtotal.toFixed(2)),
        'Descuento':      Number(o.discount.toFixed(2)),
        'Total':          Number(o.total.toFixed(2)),
        'Razón anul.':    o.voidReason ?? '',
    }));
    const wsOrders = XLSX.utils.json_to_sheet(orderRows);
    wsOrders['!cols'] = [
        { wch: 14 }, { wch: 8 },  { wch: 12 }, { wch: 12 }, { wch: 22 },
        { wch: 16 }, { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
        { wch: 12 }, { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, wsOrders, 'Órdenes');

    const fileName = `AuditoriaVentas_${audit.dateStamp}.xlsx`;
    XLSX.writeFile(wb, fileName);
}
