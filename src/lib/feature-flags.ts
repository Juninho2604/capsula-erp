/**
 * Feature flags por tenant.
 *
 * Cada flag vive en `Tenant.featureFlags` (JSONB). El catálogo de claves
 * válidas está acá — agregar una clave nueva no requiere migración, solo
 * tipa el record. Default: `false` (flag apagado) para todos los tenants.
 *
 * Lectura: `tenantFeatureEnabled(tenantId, 'flagX')` con cache de 30s.
 * Escritura: `setTenantFeatureFlag(tenantId, 'flagX', true)` (invalida cache).
 *
 * UI admin: `/dashboard/config/feature-flags` (solo OWNER).
 */

import prisma from '@/server/db';

export const FEATURE_FLAGS = {
    hideCashierPaymentMethod: {
        label: 'Ocultar método de pago a cajera/mesero',
        description:
            'Cuando está activo, los roles sin permiso (todos excepto OWNER y ADMIN_MANAGER) no pueden ver el método de pago en el historial de ventas, en el detalle de cada venta ni en el desglose del Report Z. Recomendado para blindar el cierre de caja.',
    },
    requirePaymentConfirmation: {
        label: 'Pedir confirmación de método de pago antes de cobrar',
        description:
            'Cuando está activo, en POS Restaurante (mesa y pickup) y POS Delivery aparece un modal pre-cobro con resumen "Vas a cobrar $X.XX con [Método]". La cajera tiene que tocar "Confirmar". Reduce errores al elegir método. En pago mixto, el modal lista cada línea con su monto y método.',
    },
    unifyTipReporting: {
        label: 'Unificar propinas en el cierre (excedente + colectiva)',
        description:
            'Cuando está activo, la línea "Propina" del Report Z y del cierre del día suma TODO lo que excede al 10% de servicio: el excedente al cobrar (cliente paga de más), las propinas colectivas registradas aparte, Y las propinas explícitas de delivery/pickup que la cajera marcó al cobrar (estas últimas las daba en cero el cálculo histórico cuando había vuelto). El 10% de servicio sigue siendo una línea separada e intacta. Sin el flag, comportamiento histórico.',
    },
    promotionsEnabled: {
        label: 'Activar promociones (happy hour por horario)',
        description:
            'Cuando está activo, el POS aplica automáticamente las promociones vigentes (descuentos por día/horario sobre categorías o items) al armar el carrito, y el servidor las re-valida al cobrar. Sin el flag, ninguna promoción se aplica aunque existan cargadas. Las promociones se configuran en el módulo "Promociones".',
    },
    deliveryOps: {
        label: 'Activar módulo Gestión de Deliverys',
        description:
            'Cuando está activo, aparece el módulo "Gestión de Deliverys" en Administración (tablero de órdenes, sedes, motorizados, agotados) y se habilita la API /api/v1/delivery/* que consume el bot (n8n + IA). Módulo aislado: no toca el Report Z, el historial de ventas ni el inventario. Sin el flag, el módulo y la API quedan ocultos para el tenant.',
    },
    exactCashSaleTip: {
        label: 'Venta exacta + redondeo de efectivo a propina',
        description:
            'Cambia cómo se cobra en efectivo divisas (CASH_USD, CASH_EUR, ZELLE) en VENTA DIRECTA (pickup/delivery). Sin el flag (histórico): el total de la venta se redondea al dólar entero, inflando lo facturado. Con el flag: la VENTA registra el monto EXACTO (ej. 27,70) y el POS sugiere cobrar el dólar entero hacia ARRIBA (28). La diferencia (0,30) se registra como PROPINA del personal, no como venta. Si el cliente pide el vuelto de esos centavos, la cajera lo da y deja de ser propina. NOTA: el cobro de MESA ya aplica este mismo redondeo→propina SIEMPRE (no depende de este flag), vía roundingTipForCharge — recibo, sistema y lo cobrado coinciden (decisión del dueño 16/06).',
    },
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

const CACHE_TTL_MS = 30_000;
type CacheEntry = { flags: Record<string, boolean>; expiresAt: number };
const cache = new Map<string, CacheEntry>();

async function readFlagsFromDB(tenantId: string): Promise<Record<string, boolean>> {
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { featureFlags: true },
    });
    if (!tenant) return {};
    const raw = tenant.featureFlags as unknown;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        return raw as Record<string, boolean>;
    }
    return {};
}

export async function tenantFeatureEnabled(
    tenantId: string,
    flag: FeatureFlagKey,
): Promise<boolean> {
    const now = Date.now();
    let entry = cache.get(tenantId);
    if (!entry || entry.expiresAt < now) {
        const flags = await readFlagsFromDB(tenantId);
        entry = { flags, expiresAt: now + CACHE_TTL_MS };
        cache.set(tenantId, entry);
    }
    return entry.flags[flag] === true;
}

export async function getTenantFeatureFlags(
    tenantId: string,
): Promise<Record<FeatureFlagKey, boolean>> {
    const stored = await readFlagsFromDB(tenantId);
    const result = {} as Record<FeatureFlagKey, boolean>;
    for (const key of Object.keys(FEATURE_FLAGS) as FeatureFlagKey[]) {
        result[key] = stored[key] === true;
    }
    return result;
}

export async function setTenantFeatureFlag(
    tenantId: string,
    flag: FeatureFlagKey,
    enabled: boolean,
): Promise<void> {
    const stored = await readFlagsFromDB(tenantId);
    const next = { ...stored, [flag]: enabled };
    await prisma.tenant.update({
        where: { id: tenantId },
        data: { featureFlags: next },
    });
    cache.delete(tenantId);
}

export function invalidateTenantFeatureFlagsCache(tenantId?: string): void {
    if (tenantId) cache.delete(tenantId);
    else cache.clear();
}
