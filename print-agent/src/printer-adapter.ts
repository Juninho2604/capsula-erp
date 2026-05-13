/**
 * Adapter sobre `node-thermal-printer` para hablar ESC/POS con
 * impresoras AON (compatibles ESC/POS estándar) por TCP/IP.
 *
 * Las AON se identifican como "Epson compatible" en el protocolo ESC/POS,
 * por eso usamos `PrinterTypes.EPSON`. Si Jonathan reporta caracteres
 * raros en acentos/ñ, cambiar `characterSet` a `WPC1252` o `PC850_MULTILINGUAL`.
 *
 * Cada print job se ejecuta en una conexión TCP nueva (no pool) — las
 * impresoras térmicas son lentas (1-2s por recibo) y mantener conexiones
 * abiertas a 7 impresoras simultáneas no aporta y complica el manejo de
 * errores. Conectar→imprimir→cerrar es la pauta estándar.
 */

import {
    ThermalPrinter,
    PrinterTypes,
    CharacterSet,
} from 'node-thermal-printer';

export interface PrinterConfig {
    /** Nombre lógico de la estación, ej. 'kitchen-1', 'bar', 'cajera-1'. */
    station: string;
    /** IP del puerto Ethernet de la AON, ej. '192.168.1.50'. */
    ip: string;
    /** Puerto TCP — por defecto 9100 (RAW print, estándar para térmicas). */
    port: number;
}

export interface ReceiptPayload {
    type: 'RECEIPT' | 'PRECUENTA';
    orderNumber: string;
    orderType: 'RESTAURANT' | 'DELIVERY';
    date: string;
    cashierName: string;
    customerName?: string;
    customerAddress?: string;
    customerPhone?: string;
    tableLabel?: string;
    tableLabelTitle?: string;
    items: Array<{
        name: string;
        quantity: number;
        unitPrice: number;
        total: number;
        sku?: string;
        modifiers: string[];
    }>;
    subtotal: number;
    discount?: number;
    discountReason?: string;
    deliveryFee?: number;
    serviceFee?: number;
    tipAmount?: number;
    total: number;
    isPrecuenta?: boolean;
    hideDiscount?: boolean;
}

export interface KitchenPayload {
    type: 'KITCHEN' | 'VOID_KITCHEN';
    orderNumber: string;
    orderType: 'RESTAURANT' | 'DELIVERY';
    tableName?: string | null;
    customerName?: string | null;
    items: Array<{
        name: string;
        quantity: number;
        modifiers: string[];
        notes?: string;
    }>;
    createdAt: string;
    /** Solo para VOID_KITCHEN: motivo de anulación. */
    voidReason?: string;
}

export type PrintPayload = ReceiptPayload | KitchenPayload;

/**
 * Imprime un payload en la impresora indicada. Lanza un Error si la
 * conexión falla, el printer no responde o el ESC/POS rechaza la
 * secuencia. El caller (agent loop) captura y reporta al ERP.
 */
export async function printToStation(
    cfg: PrinterConfig,
    payload: PrintPayload
): Promise<void> {
    const printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: `tcp://${cfg.ip}:${cfg.port}`,
        characterSet: CharacterSet.WPC1252,
        removeSpecialCharacters: false,
        options: { timeout: 5000 },
    });

    // Sanity check: ¿la impresora está alcanzable?
    const connected = await printer.isPrinterConnected();
    if (!connected) {
        throw new Error(`Impresora ${cfg.station} (${cfg.ip}:${cfg.port}) no responde`);
    }

    switch (payload.type) {
        case 'KITCHEN':
        case 'VOID_KITCHEN':
            renderKitchen(printer, payload, cfg.station);
            break;
        case 'RECEIPT':
        case 'PRECUENTA':
            renderReceipt(printer, payload);
            break;
    }

    printer.cut();
    await printer.execute();
}

/**
 * Test print: imprime una hoja de "Hello world" con metadata del agent.
 * Útil para verificar conectividad sin pasar por el ERP.
 */
export async function testPrint(cfg: PrinterConfig): Promise<void> {
    const printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: `tcp://${cfg.ip}:${cfg.port}`,
        characterSet: CharacterSet.WPC1252,
        removeSpecialCharacters: false,
        options: { timeout: 5000 },
    });

    const connected = await printer.isPrinterConnected();
    if (!connected) {
        throw new Error(`Impresora ${cfg.station} (${cfg.ip}:${cfg.port}) no responde`);
    }

    printer.alignCenter();
    printer.bold(true);
    printer.setTextSize(1, 1);
    printer.println('KPSULA PRINT AGENT');
    printer.bold(false);
    printer.setTextNormal();
    printer.println('Test de conectividad');
    printer.drawLine();
    printer.alignLeft();
    printer.println(`Estación:  ${cfg.station}`);
    printer.println(`IP:        ${cfg.ip}:${cfg.port}`);
    printer.println(`Fecha:     ${new Date().toLocaleString('es-VE')}`);
    printer.println(`Agent:     v0.1.0`);
    printer.drawLine();
    printer.alignCenter();
    printer.println('Si ves esto, la impresora');
    printer.println('está conectada correctamente.');
    printer.newLine();
    printer.cut();

    await printer.execute();
}

// ─── Renderers ──────────────────────────────────────────────────────────

function renderReceipt(printer: ThermalPrinter, p: ReceiptPayload): void {
    const isPrecuenta = p.isPrecuenta === true;

    printer.alignCenter();
    printer.bold(true);
    printer.setTextSize(1, 1);
    printer.println('CAPSULA');
    printer.setTextNormal();
    printer.bold(false);
    printer.println(isPrecuenta ? 'PRE-CUENTA' : 'RECIBO DE PAGO');
    printer.drawLine();

    printer.alignLeft();
    printer.println(`Orden:    #${p.orderNumber}`);
    printer.println(`Fecha:    ${formatDateTime(p.date)}`);
    printer.println(`Cajera:   ${p.cashierName}`);
    if (p.tableLabel) {
        const title = p.tableLabelTitle ?? 'Mesa';
        printer.println(`${title}:     ${p.tableLabel}`);
    }
    if (p.customerName) printer.println(`Cliente:  ${p.customerName}`);
    if (p.customerPhone) printer.println(`Teléfono: ${p.customerPhone}`);
    if (p.customerAddress) printer.println(`Dirección: ${p.customerAddress}`);

    printer.drawLine();

    // Items deduplicados (mismo nombre + mismos modifiers).
    const deduped = dedupeItems(p.items);
    for (const item of deduped) {
        const left = `${item.quantity}x ${item.name}`;
        const right = `$${item.total.toFixed(2)}`;
        printLeftRight(printer, left, right);
        for (const mod of item.modifiers) {
            printer.println(`   + ${mod}`);
        }
    }

    printer.drawLine();

    const subtotal = p.subtotal;
    const discount = p.discount ?? 0;
    const deliveryFee = p.deliveryFee ?? 0;
    const serviceFee = p.serviceFee ?? 0;
    const tipAmount = p.tipAmount ?? 0;
    const total = p.total + serviceFee + tipAmount;

    printLeftRight(printer, 'Subtotal:', `$${subtotal.toFixed(2)}`);
    if (discount > 0 && !p.hideDiscount) {
        printLeftRight(printer, `Descuento${p.discountReason ? ' (' + p.discountReason + ')' : ''}:`, `-$${discount.toFixed(2)}`);
    }
    if (deliveryFee > 0) printLeftRight(printer, 'Delivery:', `$${deliveryFee.toFixed(2)}`);
    if (serviceFee > 0) printLeftRight(printer, 'Servicio:', `$${serviceFee.toFixed(2)}`);
    if (tipAmount > 0) printLeftRight(printer, 'Propina:', `$${tipAmount.toFixed(2)}`);

    printer.bold(true);
    printer.setTextSize(0, 1);
    printLeftRight(printer, 'TOTAL:', `$${total.toFixed(2)}`);
    printer.setTextNormal();
    printer.bold(false);

    if (isPrecuenta) {
        printer.drawLine();
        printer.alignCenter();
        printer.println('Este documento NO es un recibo de pago.');
        printer.println('Solicite su recibo al pagar.');
    }

    printer.newLine();
    printer.alignCenter();
    printer.println('¡Gracias por su visita!');
    printer.newLine();
}

function renderKitchen(printer: ThermalPrinter, p: KitchenPayload, station: string): void {
    const isVoid = p.type === 'VOID_KITCHEN';

    // Encabezado depende de la estación física: cada impresora muestra
    // su nombre para que el cocinero/barman sepa al toque que esa
    // comanda es de su estación, no de la otra.
    const stationName = station === 'bar' ? 'BARRA' : 'COCINA';
    const heading = isVoid ? `ANULACIÓN ${stationName}` : `COMANDA ${stationName}`;

    printer.alignCenter();
    printer.bold(true);
    printer.setTextSize(1, 1);
    printer.println(heading);
    printer.setTextNormal();
    printer.bold(false);
    printer.drawLine();

    // Número de orden grande y centrado para que la cajera lo identifique
    // al engrapar comandas con su recibo al cierre de turno.
    printer.alignCenter();
    printer.bold(true);
    printer.setTextSize(1, 1);
    printer.println(`#${p.orderNumber}`);
    printer.setTextNormal();
    printer.bold(false);
    printer.alignLeft();
    printer.println(`Hora:   ${formatDateTime(p.createdAt)}`);
    if (p.tableName) printer.println(`Mesa:   ${p.tableName}`);
    if (p.customerName) printer.println(`Cliente: ${p.customerName}`);
    if (isVoid && p.voidReason) {
        printer.bold(true);
        printer.println(`Motivo: ${p.voidReason}`);
        printer.bold(false);
    }
    printer.drawLine();

    for (const item of p.items) {
        printer.bold(true);
        printer.setTextSize(0, 1);
        printer.println(`${item.quantity}x ${item.name}`);
        printer.setTextNormal();
        printer.bold(false);
        for (const mod of item.modifiers) {
            printer.println(`  + ${mod}`);
        }
        if (item.notes) {
            printer.println(`  Nota: ${item.notes}`);
        }
        printer.newLine();
    }

    printer.drawLine();
    printer.alignCenter();
    printer.println(`(${p.items.length} ítem${p.items.length === 1 ? '' : 's'})`);
    printer.newLine();
}

// ─── Helpers ────────────────────────────────────────────────────────────

const LINE_WIDTH = 48; // caracteres en una línea de 80mm térmica estándar.

function printLeftRight(printer: ThermalPrinter, left: string, right: string): void {
    const padding = Math.max(1, LINE_WIDTH - left.length - right.length);
    printer.println(left + ' '.repeat(padding) + right);
}

function dedupeItems<T extends { name: string; modifiers: string[]; quantity: number; total: number }>(items: T[]): T[] {
    const seen = new Map<string, T>();
    for (const item of items) {
        const key = item.name + '|' + [...item.modifiers].sort().join('|');
        const existing = seen.get(key);
        if (existing) {
            existing.quantity += item.quantity;
            existing.total += item.total;
        } else {
            seen.set(key, { ...item });
        }
    }
    return Array.from(seen.values());
}

function formatDateTime(iso: string): string {
    const d = new Date(iso);
    const date = d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${date} ${time}`;
}
