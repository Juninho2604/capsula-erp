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

export interface AgentKitchenItem {
    name: string;
    quantity: number;
    modifiers: string[];
    notes?: string;
    /**
     * Nombre de la categoría del MenuItem (ej. "Bebidas", "Shawarmas", "Cremas").
     * Si está presente, `enqueueKitchenCommand` lo usa para hacer split
     * automático entre estaciones (barra vs cocina).
     */
    categoryName?: string;
}

export interface AgentKitchenPayload {
    type: 'KITCHEN' | 'VOID_KITCHEN';
    orderNumber: string;
    orderType: 'RESTAURANT' | 'DELIVERY';
    tableName?: string | null;
    customerName?: string | null;
    items: AgentKitchenItem[];
    createdAt: string; // ISO
    voidReason?: string;
}

/**
 * Categorías del menú que se imprimen en la BARRA.
 * Si una categoría no está aquí, se considera de cocina.
 *
 * Cuando llegue la 4ta impresora (línea fría), añadiremos
 * `CATEGORIES_BY_STATION` con `kitchen-pase`, `kitchen-caliente` y
 * `kitchen-frio` y este array quedará junto a ellos. Hoy solo
 * separamos bar vs kitchen y la cocina está en modo espejo (las 2
 * comanderas físicas reciben todo).
 */
const BAR_CATEGORIES: readonly string[] = ['Bebidas'];

function classifyStation(categoryName?: string): 'bar' | 'kitchen' {
    if (!categoryName) return 'kitchen';
    return BAR_CATEGORIES.includes(categoryName) ? 'bar' : 'kitchen';
}

/**
 * Construye un mapa `menuItemId → categoryName` a partir de las categorías
 * cargadas en el POS. Cada POS tiene `categories: Array<{ name, items: [{id}] }>`
 * en su estado (ver loadMenu en cada page.tsx).
 *
 * Uso típico en el POS:
 *   const menuItemCategoryMap = useMemo(
 *     () => buildMenuItemCategoryMap(categories),
 *     [categories]
 *   );
 */
export function buildMenuItemCategoryMap(
    categories: Array<{ name?: string; items?: Array<{ id: string }> | null } | null | undefined>
): Map<string, string> {
    const map = new Map<string, string>();
    for (const cat of categories) {
        const name = cat?.name;
        if (!name) continue;
        const items = cat?.items ?? [];
        for (const item of items) {
            if (item?.id) map.set(item.id, name);
        }
    }
    return map;
}

/**
 * Adapta un CartItem (con `menuItemId` + `modifiers: { name }[]`) al formato
 * `AgentKitchenItem` que `enqueueKitchenCommand` necesita. Resuelve el
 * `categoryName` consultando el mapa pre-construido para que el split por
 * estación funcione automáticamente.
 */
export function buildKitchenItems(
    cart: Array<{
        menuItemId: string;
        name: string;
        quantity: number;
        modifiers: Array<{ name: string }>;
        notes?: string;
    }>,
    menuItemCategoryMap: Map<string, string>
): AgentKitchenItem[] {
    return cart.map((c) => ({
        name: c.name,
        quantity: c.quantity,
        modifiers: c.modifiers.map((m) => m.name),
        notes: c.notes,
        categoryName: menuItemCategoryMap.get(c.menuItemId),
    }));
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

/**
 * Encola una comanda de cocina/barra para que el Print Agent la imprima
 * en la(s) impresora(s) térmica(s) configurada(s) en el local.
 *
 * Si los items del payload incluyen `categoryName`, hace **split
 * automático** entre estaciones:
 *   - Items con categoría "Bebidas" → station = "bar"
 *   - Resto → station = "kitchen"
 *   - Se encola UN print job por estación con sus items.
 *
 * Si pasas `stationOverride`, encola un único job con esa estación
 * (no hace split). Útil para flujos legacy o casos especiales.
 *
 * Si una comanda solo tiene bebidas → solo encola job para barra.
 * Si solo tiene comida → solo encola job para cocina.
 * Si tiene de ambas → encola 2 jobs (uno por estación).
 *
 * Errores se reportan con toast pero NUNCA propagan (la impresión es
 * accesoria, no debe bloquear el envío a cocina vía API).
 */
export async function enqueueKitchenCommand(
    payload: AgentKitchenPayload,
    stationOverride?: string
): Promise<void> {
    const jobType = payload.type === 'VOID_KITCHEN' ? 'VOID_KITCHEN' : 'KITCHEN';

    // Modo override: un solo job con la estación que diga el caller.
    if (stationOverride) {
        try {
            const res = await enqueuePrintJobAction({
                type: jobType,
                station: stationOverride,
                payload: payload as unknown as Record<string, unknown>,
            });
            if (!res.success) {
                toast.error(`No se pudo encolar la comanda: ${res.message ?? 'error desconocido'}`);
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            toast.error(`Error encolando comanda: ${msg}`);
        }
        return;
    }

    // Modo split: agrupar items por estación según categoryName.
    const groups = new Map<'bar' | 'kitchen', AgentKitchenItem[]>();
    for (const item of payload.items) {
        const station = classifyStation(item.categoryName);
        const arr = groups.get(station) ?? [];
        arr.push(item);
        groups.set(station, arr);
    }

    if (groups.size === 0) return;

    // Encolar 1 job por estación, en paralelo.
    await Promise.all(
        Array.from(groups.entries()).map(async ([station, items]) => {
            const subPayload: AgentKitchenPayload = { ...payload, items };
            try {
                const res = await enqueuePrintJobAction({
                    type: jobType,
                    station,
                    payload: subPayload as unknown as Record<string, unknown>,
                });
                if (!res.success) {
                    toast.error(`No se pudo encolar comanda (${station}): ${res.message ?? 'error desconocido'}`);
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                toast.error(`Error encolando comanda (${station}): ${msg}`);
            }
        })
    );
}
