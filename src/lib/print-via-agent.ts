'use client';

/**
 * Wrappers que encolan print jobs en el Print Agent en lugar de abrir
 * `window.print()` desde el navegador. Coexisten con las funciones
 * existentes `printReceipt` / `printKitchenCommand` en `print-command.ts`
 * para permitir migración progresiva:
 *
 *   - Tablets (sin driver de impresora) → siempre usan agent.
 *   - PCs en modo kiosk (con driver instalado) → pueden seguir con
 *     window.print() o cambiarse al agent (mejor, más consistente).
 *
 * La decisión la toma el caller con `shouldUseAgent()` o se hardcodea
 * según contexto.
 *
 * Errores se manejan con toast y NUNCA propagan — la impresión es
 * accesoria, no debe bloquear flujo de cobro/orden.
 */

import toast from 'react-hot-toast';
import {
    enqueuePrintJobAction,
    type EnqueuePrintJobInput,
} from '@/app/actions/print-agent.actions';

export interface AgentReceiptPayload {
    type: 'RECEIPT' | 'PRECUENTA';
    orderNumber: string;
    orderType: 'RESTAURANT' | 'DELIVERY';
    date: string; // ISO
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

export interface AgentKitchenPayload {
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
    createdAt: string; // ISO
    voidReason?: string;
}

/**
 * Detecta si el cliente actual debería usar el Print Agent o
 * window.print() local. Heurística simple:
 *   - PWA standalone mode → tablet → agent.
 *   - Móvil/tablet por user-agent → agent.
 *   - Desktop con kiosk hint o sin coincidencia → browser print.
 *
 * Override manual: el manager puede forzar el flag con
 * `localStorage.setItem('pos-print-via-agent', 'true'|'false')`.
 */
export function shouldUseAgent(): boolean {
    if (typeof window === 'undefined') return false;
    const override = window.localStorage?.getItem('pos-print-via-agent');
    if (override === 'true') return true;
    if (override === 'false') return false;

    // Heurística automática
    const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches;
    const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
    return isStandalone || isMobile;
}

export async function enqueueReceipt(
    payload: AgentReceiptPayload,
    station?: string
): Promise<void> {
    try {
        const input: EnqueuePrintJobInput = {
            type: payload.isPrecuenta ? 'PRECUENTA' : 'RECEIPT',
            station,
            payload: payload as unknown as Record<string, unknown>,
        };
        const res = await enqueuePrintJobAction(input);
        if (!res.success) {
            toast.error(`No se pudo encolar el recibo: ${res.message ?? 'error desconocido'}`);
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`Error encolando recibo: ${msg}`);
    }
}

export async function enqueueKitchenCommand(
    payload: AgentKitchenPayload,
    station?: string
): Promise<void> {
    try {
        const input: EnqueuePrintJobInput = {
            type: payload.type === 'VOID_KITCHEN' ? 'VOID_KITCHEN' : 'KITCHEN',
            station,
            payload: payload as unknown as Record<string, unknown>,
        };
        const res = await enqueuePrintJobAction(input);
        if (!res.success) {
            toast.error(`No se pudo encolar la comanda: ${res.message ?? 'error desconocido'}`);
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`Error encolando comanda: ${msg}`);
    }
}
