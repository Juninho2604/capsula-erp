'use client';

/**
 * Utilidad para imprimir recibos y comandas con formato térmico 80mm
 */

import { humanDailyLabel } from '@/lib/sales/daily-order-number';

/**
 * IMPRESIÓN DIRECTA SIN DIÁLOGO (Intento)
 * Nota: Los navegadores modernos bloquean la impresión totalmente silenciosa por seguridad.
 * La mejor configuración es usar el modo "Kiosk" del navegador o configurar el navegador
 * para "Impresión silenciosa" en sus argumentos de inicio (--kiosk-printing en Chrome).
 */

// Interfaces para tipado
interface ReceiptItem {
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
    sku?: string;
    modifiers: string[];
}

/**
 * Etiqueta legible de un método de pago para el recibo. Para los PDV
 * distingue el punto de venta (Shanklish / Superferro) — pedido de la cajera
 * para ver "método de pago e incluso el punto de venta" en la nota de entrega.
 * Espejo textual de getPaymentBadge (sales/page.tsx).
 */
export function paymentMethodLabel(method: string | null | undefined): string {
    switch ((method ?? '').toUpperCase()) {
        case 'CASH':
        case 'CASH_USD':       return 'Efectivo $';
        case 'CASH_EUR':       return 'Efectivo €';
        case 'CASH_BS':        return 'Efectivo Bs';
        case 'CARD':
        case 'BS_POS':
        case 'PDV_SHANKLISH':  return 'PDV Shanklish';
        case 'PDV_SUPERFERRO': return 'PDV Superferro';
        case 'ZELLE':          return 'Zelle';
        case 'MOBILE_PAY':     return 'Pago Móvil';
        case 'MOVIL_NG':       return 'Móvil NG';
        case 'TRANSFER':       return 'Transferencia';
        case 'CORTESIA':       return 'Cortesía';
        default:               return method || '—';
    }
}

interface ReceiptPayment {
    method: string;
    amountUSD?: number;
    amountBS?: number;
}

interface ReceiptData {
    orderNumber: string;
    /** Número de orden del día por canal (§84), ej. "DL-14". Se imprime
     *  junto al correlativo. Ausente en pickup (usa tableLabel PK). */
    dailyLabel?: string;
    orderType: 'RESTAURANT' | 'DELIVERY';
    date: Date | string;
    cashierName: string;
    /** Forma(s) de pago para imprimir en la nota. Una entrada = pago simple;
     *  varias = pago mixto. Para PDV la etiqueta ya nombra el punto de venta. */
    payments?: ReceiptPayment[];
    customerName?: string;
    customerAddress?: string;
    customerPhone?: string;
    /** Nombre/número de la mesa física (ej: "Mesa 5", "VIP 1") o pickup (ej: "PK-02") */
    tableLabel?: string;
    /** Etiqueta a mostrar junto a tableLabel. Default: "Mesa". Usar "Pickup" para pickup tabs. */
    tableLabelTitle?: string;
    items: ReceiptItem[];
    subtotal?: number;
    discount?: number;
    discountReason?: string; // Ej: "Descuento aplicado"
    deliveryFee?: number;
    /** §97: moneda del envío elegida por la cajera — 'Divisas' | 'Bs'. */
    deliveryFeeLabel?: string;
    total: number;
    serviceFee?: number;
    /** % de servicio aplicado (§85). Si se omite, el label imprime "10%". */
    serviceFeePercent?: number;
    tipAmount?: number;
    /** Cuando true imprime "PRE-CUENTA" en lugar de "RECIBO DE PAGO" y añade aviso informativo */
    isPrecuenta?: boolean;
    /** Cuando true no muestra la línea de descuento (ej: pago en divisas — solo muestra el total neto) */
    hideDiscount?: boolean;
    /** Branding fiscal/visual del tenant. Si null o sus fields null, el recibo
     *  omite logo y RIF. Mejor un recibo sin datos fiscales que con datos
     *  de OTRO restaurante. Obtener con getTenantBrandingAction(). */
    branding?: {
        name: string;
        legalName: string | null;
        taxId: string | null;
        logoUrl: string | null;
    } | null;
}

/**
 * Escapa texto para insertarlo dentro de HTML. Evita XSS si en algún
 * momento el branding o el customerName llega del usuario.
 */
function escHtml(s: string | null | undefined): string {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}


export function printReceipt(data: ReceiptData) {
    const printWindow = window.open('', '_blank', 'width=400,height=700');
    if (!printWindow) {
        alert('Habilite popups para imprimir');
        return;
    }

    const date = new Date(data.date);
    const formattedDate = date.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const formattedTime = date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: false });

    const subtotal = data.subtotal ?? data.items.reduce((s, i) => s + i.total, 0);
    const discountAmount = data.discount ?? 0;
    const deliveryFeeAmount = data.deliveryFee ?? 0;
    const total = data.total;
    const serviceFee = data.serviceFee ?? 0;
    const tipAmount = data.tipAmount ?? 0;
    // Total a pagar = base total (post-discount) + servicio + propina.
    // Propina se incluye en el total impreso para que el cliente pague el monto exacto.
    const totalSuggested = total + serviceFee + tipAmount;

    // Deduplicar items: combinar entradas con mismo nombre + mismos modificadores
    const deduped: (ReceiptItem & { _key: string })[] = [];
    for (const item of data.items) {
        const key = item.name + '|' + item.modifiers.slice().sort().join('|');
        const existing = deduped.find(d => d._key === key);
        if (existing) {
            existing.quantity += item.quantity;
            existing.total += item.total;
            existing.unitPrice = existing.total / existing.quantity;
        } else {
            deduped.push({ ...item, _key: key });
        }
    }

    // Tipografía profesional para notas de entrega: Arial es la más común en facturas/recibos
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Recibo ${data.orderNumber}</title>
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 12px;
            line-height: 1.4;
            color: #000000;
            max-width: 80mm;
            margin: 0 auto;
            padding: 6px;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-left { text-align: left; }
        .bold { font-weight: 800; }
        .uppercase { text-transform: uppercase; }
        .separator { border-top: 1px dashed #000; margin: 7px 0; }
        .separator-thick { border-top: 2px solid #000; margin: 9px 0; }
        .header { margin-bottom: 10px; padding-bottom: 6px; }
        .company-name { font-size: 20px; font-weight: 900; letter-spacing: 0.5px; }
        .doc-title { font-size: 14px; font-weight: 900; margin-top: 6px; letter-spacing: 1px; }
        .info-row { display: flex; justify-content: space-between; margin: 3px 0; }
        .info-label { font-weight: 800; }
        .items-table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 11px; }
        .items-table th { border-bottom: 2px solid #000; padding: 4px 0; text-align: left; font-weight: 900; }
        .items-table td { padding: 4px 0; vertical-align: top; }
        .items-table .item-name { font-weight: 800; }
        .items-table .item-detail { font-size: 10px; color: #000000; font-style: italic; }
        .totals-section { margin-top: 10px; }
        .total-row { display: flex; justify-content: space-between; padding: 3px 0; font-weight: 700; }
        .total-final { font-size: 15px; font-weight: 900; margin-top: 4px; padding-top: 6px; border-top: 3px solid #000; }
        .footer { text-align: center; margin-top: 16px; font-size: 11px; font-weight: 900; letter-spacing: 1px; }
        @media print {
            @page { margin: 4mm; size: auto; }
            body { padding: 0; color: #000 !important; }
            * { color: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
    </style>
</head>
<body>
    <div class="header text-center">
        ${data.branding?.logoUrl
            ? `<img src="${escHtml(data.branding.logoUrl)}" alt="${escHtml(data.branding.name)}" style="max-width: 120px; height: auto; margin-bottom: 8px;">`
            : ''}
        ${(!data.branding?.logoUrl && data.branding?.legalName)
            ? `<div style="font-size: 13px; font-weight: 900;">${escHtml(data.branding.legalName)}</div>`
            : ''}
        ${(!data.branding?.logoUrl && !data.branding?.legalName && data.branding?.name)
            ? `<div style="font-size: 13px; font-weight: 900;">${escHtml(data.branding.name)}</div>`
            : ''}
        ${data.branding?.taxId ? `<div style="font-size: 10px;">RIF: ${escHtml(data.branding.taxId)}</div>` : ''}
        <div class="doc-title" style="margin-top: 8px;">${data.isPrecuenta ? 'PRE-CUENTA' : data.orderType === 'DELIVERY' ? 'NOTA DE ENTREGA' : 'RECIBO DE PAGO'}</div>
        ${data.isPrecuenta ? '<div style="font-size:10px;font-style:italic;margin-top:2px;">Documento informativo — no es factura definitiva</div>' : ''}
    </div>
    
    <div class="separator"></div>
    
    ${data.dailyLabel ? `
    <div style="text-align:center;font-size:20px;font-weight:900;margin:2px 0;">${escHtml(humanDailyLabel(data.dailyLabel, data.orderType === 'DELIVERY' ? 'DELIVERY' : undefined))}</div>
    <div class="separator"></div>` : ''}
    <div class="info-row">
        <span class="info-label">Control / Correlativo:</span>
        <span class="bold">${data.orderNumber}</span>
    </div>
    ${data.tableLabel ? `
    <div class="info-row">
        <span class="info-label">${data.tableLabelTitle ?? 'Mesa'}:</span>
        <span class="bold">${data.tableLabel}</span>
    </div>` : ''}
    <div class="info-row">
        <span class="info-label">Fecha:</span>
        <span>${formattedDate} ${formattedTime}</span>
    </div>
    <div class="info-row">
        <span class="info-label">Operador:</span>
        <span>${data.cashierName}</span>
    </div>
    <div class="info-row">
        <span class="info-label">Tipo:</span>
        <span>${data.orderType === 'RESTAURANT' ? 'RESTAURANTE' : 'DELIVERY'}</span>
    </div>
    
    ${(data.customerName || data.customerAddress || data.customerPhone) ? `
    <div class="separator"></div>
    <div class="bold" style="margin-bottom: 4px;">Cliente</div>
    ${data.customerName ? `<div>${data.customerName}</div>` : ''}
    ${data.customerPhone ? `<div style="font-size: 10px;">Tel: ${data.customerPhone}</div>` : ''}
    ${data.customerAddress ? `<div style="font-size: 10px; margin-top: 2px;">${data.customerAddress}</div>` : ''}
    ` : ''}
    
    <div class="separator"></div>
    
    <table class="items-table">
        <thead>
            <tr>
                <th class="text-left" style="width: 20%;">Cant.</th>
                <th class="text-left" style="width: 50%;">Descripción</th>
                <th class="text-right" style="width: 30%;">Monto</th>
            </tr>
        </thead>
        <tbody>
            ${deduped.map(item => `
            <tr>
                <td class="item-name">${item.quantity} × $${item.unitPrice.toFixed(2)}</td>
                <td>
                    <div class="item-name">${item.name}</div>
                    ${item.modifiers.length > 0 ? `<div class="item-detail">+ ${item.modifiers.join(', ')}</div>` : ''}
                </td>
                <td class="text-right bold">$${item.total.toFixed(2)}</td>
            </tr>
            `).join('')}
        </tbody>
    </table>
    
    <div class="separator-thick"></div>
    
    <div class="totals-section">
        <div class="total-row">
            <span>Subtotal:</span>
            <span>$${subtotal.toFixed(2)}</span>
        </div>
        ${deliveryFeeAmount > 0 ? `
        <div class="total-row">
            <span>Envío / Delivery${data.deliveryFeeLabel ? ` (${escHtml(data.deliveryFeeLabel)})` : ''}:</span>
            <span>$${deliveryFeeAmount.toFixed(2)}</span>
        </div>
        ` : ''}
        ${discountAmount > 0 ? `
        <div class="total-row">
            <span>${data.discountReason || (data.hideDiscount ? 'Desc. divisas (33.33%)' : 'Descuento aplicado')}:</span>
            <span>-$${discountAmount.toFixed(2)}</span>
        </div>
        <div class="total-row">
            <span>Subtotal con desc.:</span>
            <span>$${(subtotal - discountAmount).toFixed(2)}</span>
        </div>
        ` : ''}
        ${serviceFee > 0 ? `
        <div class="total-row">
            <span>${data.serviceFeePercent != null ? `${Number(data.serviceFeePercent)}%` : '10%'} Servicio:</span>
            <span>$${serviceFee.toFixed(2)}</span>
        </div>
        ` : ''}
        ${tipAmount > 0 ? `
        <div class="total-row">
            <span>Propina:</span>
            <span>$${tipAmount.toFixed(2)}</span>
        </div>
        ` : ''}
        <div class="total-row total-final">
            <span>${serviceFee > 0 || tipAmount > 0 ? 'TOTAL A PAGAR:' : 'TOTAL:'}</span>
            <span>$${totalSuggested.toFixed(2)}</span>
        </div>
    </div>

    ${(!data.isPrecuenta && data.payments && data.payments.length > 0) ? `
    <div class="separator"></div>
    <div class="bold" style="margin-bottom: 4px;">Forma de pago</div>
    ${data.payments.map(p => `
    <div class="info-row">
        <span class="info-label">${escHtml(paymentMethodLabel(p.method))}</span>
        <span class="bold">${p.amountBS != null && p.amountBS > 0
            ? `Bs ${p.amountBS.toFixed(2)}${p.amountUSD != null ? ` ($${p.amountUSD.toFixed(2)})` : ''}`
            : p.amountUSD != null ? `$${p.amountUSD.toFixed(2)}` : ''}</span>
    </div>`).join('')}
    ` : ''}

    <div class="footer">GRACIAS POR SU COMPRA</div>

    <script>
        window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
        }
    </script>
</body>
</html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
}

/**
 * IMPRESIÓN COMANDA COCINA (Sin precios, letras grandes)
 * Usa iframe oculto para no interrumpir la pantalla de cocina.
 * Para impresión completamente silenciosa (sin diálogo), lanzar Chrome con:
 *   --kiosk-printing
 */
// station: 'kitchen' (default) | 'bar'
export function printKitchenCommand(data: any, station: 'kitchen' | 'bar' = 'kitchen') {
    const date = new Date(data.createdAt);
    const formattedTime = date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
    const orderNum = data.orderNumber.split('-').pop();
    const stationLabel = station === 'bar' ? '-- BARRA --' : '-- COCINA --';
    const waiterLabel = data.waiterLabel ? data.waiterLabel : null;

    // Deduplicar items: combinar entradas con mismo nombre + mismos modificadores
    const deduped: any[] = [];
    for (const item of (data.items || [])) {
        const modsKey = (item.modifiers || []).slice().sort().join('|');
        const existing = deduped.find(
            d => d.name === item.name && d._modsKey === modsKey
        );
        if (existing) {
            existing.quantity += item.quantity;
        } else {
            deduped.push({ ...item, _modsKey: modsKey });
        }
    }

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <title>COMANDA ${data.orderNumber}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Courier New', Courier, monospace;
            width: 80mm;
            background: white;
            color: black;
            font-size: 14px;
            padding: 2mm 2mm 0 2mm;
        }
        .sep {
            font-size: 13px;
            letter-spacing: 1px;
            text-align: center;
            margin: 4px 0;
        }
        .title {
            text-align: center;
            font-size: 16px;
            font-weight: 900;
            letter-spacing: 4px;
            margin: 4px 0;
        }
        .order-num {
            text-align: center;
            font-size: 64px;
            font-weight: 900;
            line-height: 1;
            margin: 6px 0 4px;
        }
        .meta {
            text-align: center;
            font-size: 14px;
            font-weight: bold;
            margin: 2px 0;
        }
        .customer {
            text-align: center;
            font-size: 14px;
            font-weight: bold;
            margin-top: 2px;
        }
        .item {
            border-bottom: 1px dashed #000;
            padding: 7px 2px;
            display: flex;
            align-items: flex-start;
            gap: 6px;
        }
        .qty-box {
            background: #000;
            color: #fff;
            font-size: 22px;
            font-weight: 900;
            padding: 2px 8px;
            min-width: 38px;
            text-align: center;
            flex-shrink: 0;
        }
        .details { flex: 1; }
        .name {
            font-size: 17px;
            font-weight: 900;
            line-height: 1.2;
        }
        .mods {
            font-size: 13px;
            margin-top: 3px;
            font-style: italic;
            font-weight: normal;
        }
        .notes {
            font-size: 13px;
            font-weight: 900;
            margin-top: 4px;
            padding: 2px 4px;
            border: 1px solid #000;
        }
        .tail {
            text-align: center;
            font-size: 13px;
            margin-top: 6px;
            letter-spacing: 1px;
        }
        .order-type {
            text-align: center;
            font-size: 24px;
            font-weight: 900;
            margin: 4px 0 2px;
            letter-spacing: 1px;
        }
        .scheduled {
            text-align: center;
            font-size: 22px;
            font-weight: 900;
            margin: 4px 0;
            padding: 4px 0;
            border: 2px solid #000;
            letter-spacing: 2px;
        }
        .scheduled-label {
            font-size: 11px;
            font-weight: bold;
            letter-spacing: 2px;
            display: block;
        }
        .correlativo {
            text-align: center;
            font-size: 11px;
            font-weight: normal;
            letter-spacing: 1px;
            margin-top: 4px;
        }
        @media print {
            @page { margin: 0mm 2mm; size: 80mm auto; }
            body { padding: 2mm 2mm 0 2mm; }
        }
    </style>
</head>
<body>
    <div class="sep">--------------------------------</div>
    <div class="title">${stationLabel}</div>
    <div class="order-num">#${orderNum}</div>
    ${data.dailyLabel ? `<div class="order-type" style="font-size:22px;font-weight:900;">${escHtml(humanDailyLabel(data.dailyLabel, data.orderType === 'DELIVERY' ? 'DELIVERY' : (data.tableName ? 'MESA' : undefined)))}</div>` : ''}
    <div class="order-type">${
        data.orderType === 'DELIVERY'
            ? 'DELIVERY'
            : data.sourceChannel === 'POS_PEDIDOSYA'
                ? 'PEDIDOS YA'
                : data.tableName
                    ? `🪑 ${data.tableName}`
                    : 'PICKUP'
    }</div>
    <div class="sep">--------------------------------</div>
    <div class="meta">${formattedTime}</div>
    ${data.scheduledDeliveryTime ? `<div class="scheduled"><span class="scheduled-label">ENTREGAR A LAS</span>${new Date(data.scheduledDeliveryTime).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: false })}</div>` : ''}
    ${data.customerName ? `<div class="customer">${data.customerName}</div>` : ''}
    ${waiterLabel ? `<div style="text-align:center;font-size:13px;font-weight:bold;margin:2px 0;">‍${waiterLabel}</div>` : ''}
    ${data.address ? `<div style="text-align:center;font-size:12px;font-weight:normal;margin:2px 4px;">${data.address}</div>` : ''}
    <div class="sep">--------------------------------</div>

    ${deduped.map((item: any) => `
    <div class="item">
        <div class="qty-box">${item.quantity}</div>
        <div class="details">
            <div class="name">${item.name}</div>
            ${item.takeaway ? `<div style="font-size:13px;font-weight:900;color:#000;background:#ffe066;display:inline-block;padding:1px 6px;margin:2px 0;border-radius:4px;">LLEVAR</div>` : ''}
            ${item.modifiers && item.modifiers.length > 0 ? `
                <div class="mods">+ ${item.modifiers.join('<br>+ ')}</div>
            ` : ''}
            ${item.notes ? `<div class="notes">*** ${item.notes} ***</div>` : ''}
        </div>
    </div>
    `).join('')}

    <div class="tail">--------------------------------</div>
    <div class="correlativo">${data.orderNumber}</div>
    <br><br><br><br><br><br><br><br>
</body>
</html>`;

    // Iframe oculto: no abre nueva ventana ni interrumpe la pantalla de cocina
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;visibility:hidden;';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
        document.body.removeChild(iframe);
        return;
    }

    doc.open('text/html', 'replace');
    doc.write(html);
    doc.close();

    // Esperar a que el contenido cargue antes de imprimir
    setTimeout(() => {
        try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
        } catch (e) {
            console.warn('Error al imprimir comanda:', e);
        }
        setTimeout(() => {
            if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
            }
        }, 2000);
    }, 300);
}

// ─────────────────────────────────────────────────────────────────────────────
// COMANDA DE MODIFICACIÓN / ANULACIÓN (va a cocina)
// ─────────────────────────────────────────────────────────────────────────────

export interface VoidKitchenCommandData {
    orderNumber:      string;
    tableName:        string;
    authorizerName:   string;
    waiterLabel?:     string;
    modificationType: 'VOID' | 'ADJUST_QTY' | 'REPLACE';
    /**
     * Categoría del item anulado. Se usa para enrutar la anulación a la
     * estación correcta (barra vs cocina) cuando se imprime vía Print Agent.
     * Devuelto por modifyTabItemAction.
     */
    categoryName?:    string | null;
    voidedItem:  { name: string; quantity: number; modifiers: string[] };
    newItem?:    { name: string; quantity: number; modifiers: string[] };
}

export function printVoidKitchenCommand(data: VoidKitchenCommandData, station: 'kitchen' | 'bar' = 'kitchen') {
    const time = new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
    const orderNum = data.orderNumber.split('-').pop();
    const stationLabel = station === 'bar' ? '-- BARRA --' : '-- COCINA --';

    const modLabel =
        data.modificationType === 'VOID'       ? '❌ CANCELADO'  :
        data.modificationType === 'ADJUST_QTY' ? '✏️ AJUSTE'     :
                                                  '🔄 REEMPLAZO';

    const voidedMods  = data.voidedItem.modifiers.length > 0
        ? `<div style="font-size:13px;font-style:italic;margin-top:3px;">+ ${data.voidedItem.modifiers.join('<br>+ ')}</div>`
        : '';
    const newMods = data.newItem && data.newItem.modifiers.length > 0
        ? `<div style="font-size:13px;font-style:italic;margin-top:3px;">+ ${data.newItem.modifiers.join('<br>+ ')}</div>`
        : '';

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>MOD ${data.orderNumber}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Courier New', Courier, monospace;
    width: 80mm; background: white; color: black;
    font-size: 14px; padding: 3mm 2mm 0 2mm;
  }
  .sep    { text-align:center; font-size:13px; margin:5px 0; letter-spacing:1px; }
  .title  { text-align:center; font-size:16px; font-weight:900; letter-spacing:3px; margin:4px 0; }
  .warn   { text-align:center; font-size:22px; font-weight:900; margin:4px 0; letter-spacing:2px; }
  .num    { text-align:center; font-size:52px; font-weight:900; line-height:1; margin:4px 0; }
  .meta   { text-align:center; font-size:13px; font-weight:bold; margin:2px 0; }
  .auth   { text-align:center; font-size:13px; margin:2px 0; }
  .block  { border: 2px solid #000; margin: 6px 2px; padding: 6px; }
  .block-label { font-size:12px; font-weight:900; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px; }
  .item-row { display:flex; align-items:flex-start; gap:6px; margin-top:3px; }
  .qty-box  { background:#000; color:#fff; font-size:20px; font-weight:900; padding:2px 8px; min-width:36px; text-align:center; flex-shrink:0; }
  .qty-box.light { background:#fff; color:#000; border:2px solid #000; }
  .iname  { font-size:17px; font-weight:900; line-height:1.2; }
  .tail   { text-align:center; font-size:13px; margin-top:6px; letter-spacing:1px; }
  .corr   { text-align:center; font-size:11px; margin-top:2px; }
  @media print {
    @page { margin:0mm 2mm; size:80mm auto; }
    body  { padding:2mm 2mm 0 2mm; }
  }
</style>
</head>
<body>
  <div class="sep">================================</div>
  <div class="title">${stationLabel}</div>
  <div class="warn">MODIFICACIÓN </div>
  <div class="num">#${orderNum}</div>
  <div class="sep">================================</div>
  <div class="meta">${data.tableName || 'Mesa'} · ${time}</div>
  <div class="auth">Autor: <b>${data.authorizerName}</b></div>
  ${data.waiterLabel ? `<div class="auth">‍${data.waiterLabel}</div>` : ''}
  <div class="sep">--------------------------------</div>

  <!-- Ítem cancelado/ajustado -->
  <div class="block">
    <div class="block-label" style="color:#000;">${modLabel}</div>
    <div class="item-row">
      <div class="qty-box">${data.voidedItem.quantity}</div>
      <div>
        <div class="iname">${data.voidedItem.name}</div>
        ${voidedMods}
      </div>
    </div>
  </div>

  ${data.newItem ? `
  <!-- Ítem nuevo -->
  <div class="block">
    <div class="block-label">${data.modificationType === 'ADJUST_QTY' ? 'NUEVA CANTIDAD' : 'NUEVO ÍTEM'}</div>
    <div class="item-row">
      <div class="qty-box light">${data.newItem.quantity}</div>
      <div>
        <div class="iname">${data.newItem.name}</div>
        ${newMods}
      </div>
    </div>
  </div>
  ` : ''}

  <div class="tail">================================</div>
  <div class="corr">${data.orderNumber}</div>
  <br><br><br><br><br><br>
</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;visibility:hidden;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }
    doc.open('text/html', 'replace');
    doc.write(html);
    doc.close();
    setTimeout(() => {
        try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch {}
        setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 2000);
    }, 300);
}

/**
 * IMPRESIÓN RESUMEN DE CIERRE DEL DÍA
 */
export interface EndOfDaySummaryPrintData {
    date: string;
    byChannel: { restaurant: number; delivery: number; pickup: number; pedidosya: number; wink: number; evento: number; tablePong: number };
    countByChannel: { restaurant: number; delivery: number; pickup: number; pedidosya: number; wink: number; evento: number; tablePong: number };
    totalUSD: number;
    totalDiscounts: number;
    totalServiceFee: number;
    propinas: number;
    receivedInDivisas: number;
    receivedInBs: number;
    pctDivisas: number;
    pctBs: number;
    totalInvoices: number;
    invoicesCancelled: number;
}

export function printEndOfDaySummary(data: EndOfDaySummaryPrintData) {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) {
        alert('Habilite popups para imprimir');
        return;
    }

    const fmt = (n: number) => `$${(n || 0).toFixed(2)}`;
    const pct = (n: number) => `${(n || 0).toFixed(1)}%`;

    type ChannelKey = keyof EndOfDaySummaryPrintData['byChannel'];
    const allChannelRows: { label: string; key: ChannelKey }[] = [
        { label: 'Restaurante / Mesas', key: 'restaurant' as ChannelKey },
        { label: 'Delivery',            key: 'delivery' as ChannelKey },
        { label: 'Pickup / Mostrador',  key: 'pickup' as ChannelKey },
        { label: 'PedidosYA',           key: 'pedidosya' as ChannelKey },
        { label: 'Wink',                key: 'wink' as ChannelKey },
        { label: 'Evento',              key: 'evento' as ChannelKey },
        { label: 'Table Pong',          key: 'tablePong' as ChannelKey },
    ];
    const channelRows = allChannelRows.filter(r => data.byChannel[r.key] > 0 || data.countByChannel[r.key] > 0);

    const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Cierre del Día ${data.date}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Courier New', monospace; font-size: 12px; max-width: 80mm; margin: 0 auto; padding: 6px; color: #000; }
        .center { text-align: center; }
        .row { display: flex; justify-content: space-between; padding: 2px 0; }
        .sep { border-top: 1px dashed #000; margin: 6px 0; }
        .sep2 { border-top: 2px solid #000; margin: 8px 0; }
        .bold { font-weight: 900; }
        .title { font-size: 16px; font-weight: 900; letter-spacing: 2px; }
        .section { font-weight: 900; text-decoration: underline; margin: 4px 0 2px; font-size: 11px; }
        .total-final { font-size: 15px; font-weight: 900; }
        @media print { @page { margin: 4mm; size: auto; } body { padding: 0; } }
    </style>
</head>
<body>
    <div class="center" style="margin-bottom: 8px;">
        <div class="title">SHANKLISH CARACAS</div>
        <div>RESUMEN CIERRE DEL DÍA</div>
        <div>${data.date}</div>
    </div>
    <div class="sep2"></div>

    <div class="section">VENTAS POR CANAL</div>
    ${channelRows.map(r => `
    <div class="row">
        <span>${r.label} (${data.countByChannel[r.key]})</span>
        <span class="bold">${fmt(data.byChannel[r.key])}</span>
    </div>`).join('')}
    <div class="sep"></div>

    <div class="section">TOTALES</div>
    <div class="row"><span>Descuentos:</span><span>-${fmt(data.totalDiscounts)}</span></div>
    ${data.totalServiceFee > 0 ? `<div class="row"><span>10% Servicio:</span><span>+${fmt(data.totalServiceFee)}</span></div>` : ''}
    ${data.propinas > 0 ? `<div class="row"><span>Propinas:</span><span>+${fmt(data.propinas)}</span></div>` : ''}
    <div class="sep2"></div>
    <div class="row total-final"><span>TOTAL COBRADO</span><span>${fmt(data.totalUSD)}</span></div>
    <div class="sep2"></div>

    <div class="section">DESGLOSE POR MONEDA</div>
    <div class="row"><span>Divisas (Cash/Zelle)</span><span>${fmt(data.receivedInDivisas)} · ${pct(data.pctDivisas)}</span></div>
    <div class="row"><span>Bolívares (PDV/Móvil)</span><span>${fmt(data.receivedInBs)} · ${pct(data.pctBs)}</span></div>
    <div class="sep"></div>

    <div class="section">FACTURAS</div>
    <div class="row"><span>Procesadas:</span><span>${data.totalInvoices}</span></div>
    ${data.invoicesCancelled > 0 ? `<div class="row"><span>Anuladas:</span><span>${data.invoicesCancelled}</span></div>` : ''}

    <div style="text-align:center; margin-top: 16px; font-size: 10px;">
        Impreso: ${new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
    </div>
    <br><br><br><br>
    <script>
        window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); }
    </script>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
}
