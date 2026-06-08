'use server';

/**
 * System Config — multitenant (cierre del blocker §38.20).
 *
 * Modelo migrado:
 *   - PK ahora es `id` (cuid), no `key`.
 *   - Compound unique `(tenantId, key)` permite que cada tenant tenga su
 *     propia config con las mismas keys.
 *
 * Patrón canónico: db = withTenant(tenantId). El upsert usa el unique
 * compuesto.
 *
 * Formato del valor guardado en `enabled_modules`:
 *
 *   Legacy (array de strings):
 *     ["sales_history", "kitchen_display", ...]
 *
 *   Nuevo (objeto con snapshot del registry al momento del save):
 *     { "enabled": ["sales_history", ...], "known": ["sales_history", "sales_entry", ...] }
 *
 *   Al leer, si vemos formato legacy, asumimos `known=[]` → los módulos
 *   NUEVOS del registry (que no estaban cuando se guardó) se auto-habilitan
 *   si tienen `enabledByDefault: true`. Esto evita el bug en que agregar un
 *   módulo nuevo lo deja invisible hasta que un OWNER vuelva a guardar la
 *   config.
 *
 *   Si un módulo está en `known` pero NO en `enabled`, respetamos la
 *   decisión del OWNER de tenerlo deshabilitado.
 */

import prisma from '@/server/db';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import {
    MODULE_REGISTRY,
    filterModuleIdsByFeatureFlags,
} from '@/lib/constants/modules-registry';
import { getTenantFeatureFlags } from '@/lib/feature-flags';
import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';

const ENABLED_MODULES_KEY = 'enabled_modules';
const STOCK_VALIDATION_KEY = 'pos_stock_validation_enabled';

interface EnabledModulesPayload {
    enabled: string[];
    known: string[];
}

/**
 * Parsea el valor de SystemConfig.enabled_modules tolerante al formato
 * legacy (array plano) y al formato nuevo (objeto).
 */
function parseEnabledModulesValue(raw: string): EnabledModulesPayload | null {
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            // Legacy: solo `enabled`. `known` queda vacío para que módulos
            // nuevos se auto-habiliten.
            return { enabled: parsed, known: [] };
        }
        if (
            parsed &&
            typeof parsed === 'object' &&
            Array.isArray(parsed.enabled) &&
            Array.isArray(parsed.known)
        ) {
            return { enabled: parsed.enabled, known: parsed.known };
        }
    } catch {
        // ignore
    }
    return null;
}

/**
 * Lee los módulos habilitados desde la BD.
 *
 * Reglas de resolución:
 *   1. Si NO hay config guardada → usa env `NEXT_PUBLIC_ENABLED_MODULES`
 *      o el filter `enabledByDefault=true` del registry.
 *   2. Si HAY config:
 *      a. Empezamos con `enabled` (lo que el OWNER decidió).
 *      b. Para cada módulo NUEVO del registry (no presente en `known`),
 *         si tiene `enabledByDefault=true` lo agregamos automático.
 *         Si el OWNER lo deshabilitó después, se quedará en `known` y no
 *         en `enabled` y respetamos eso.
 */
export async function getEnabledModulesFromDB(): Promise<string[]> {
    let tenantId: string | null = null;
    let saved: EnabledModulesPayload | null = null;
    try {
        const ctx = await resolveTenantContext();
        tenantId = ctx.tenantId;
        const db = withTenant(tenantId);
        const config = await db.systemConfig.findFirst({
            where: { key: ENABLED_MODULES_KEY },
        });
        if (config) {
            saved = parseEnabledModulesValue(config.value);
        }
    } catch {
        // Si falla la BD (primera vez, tabla vacía, etc.), usar defaults
    }

    let ids: string[];
    if (!saved) {
        // Sin config guardada: env var o defaults del registry.
        const envModules = process.env.NEXT_PUBLIC_ENABLED_MODULES;
        if (envModules) {
            ids = envModules.split(',').map((m) => m.trim()).filter(Boolean);
        } else {
            ids = MODULE_REGISTRY.filter((m) => m.enabledByDefault).map((m) => m.id);
        }
    } else {
        // Hay config guardada. Auto-incluir módulos NUEVOS con enabledByDefault.
        const knownSet = new Set(saved.known);
        const enabledSet = new Set(saved.enabled);
        for (const m of MODULE_REGISTRY) {
            if (!knownSet.has(m.id) && m.enabledByDefault) {
                enabledSet.add(m.id);
            }
        }
        ids = Array.from(enabledSet);
    }

    // Gate por feature flags del tenant: módulos con `requiresFeatureFlag`
    // (ej. delivery → deliveryOps) solo quedan visibles si el flag está ON.
    // Conservador: si no hay tenantId o falla la lectura de flags, ocultamos
    // los módulos gated (no exponer features no confirmadas para el tenant).
    let flags: Record<string, boolean> = {};
    if (tenantId) {
        try {
            flags = await getTenantFeatureFlags(tenantId);
        } catch {
            flags = {};
        }
    }
    return filterModuleIdsByFeatureFlags(ids, flags);
}

/**
 * Guarda los módulos habilitados en la BD.
 * Solo OWNER puede ejecutar esta acción.
 *
 * Guarda en formato nuevo `{ enabled, known }` donde `known` es el
 * snapshot del registry al momento del save. Esto permite que módulos
 * agregados DESPUÉS aparezcan automáticamente al usuario sin necesidad
 * de volver a tocar la config.
 */
export async function saveEnabledModules(moduleIds: string[]): Promise<{ ok: boolean; error?: string }> {
    const session = await getSession();
    if (!session) return { ok: false, error: 'No autorizado' };
    if (session.role !== 'OWNER') return { ok: false, error: 'Solo el OWNER puede cambiar los módulos' };

    const validIds = new Set(MODULE_REGISTRY.map((m) => m.id));
    const filtered = moduleIds.filter((id) => validIds.has(id));
    if (!filtered.includes('module_config')) {
        filtered.push('module_config');
    }

    const payload: EnabledModulesPayload = {
        enabled: filtered,
        known: MODULE_REGISTRY.map((m) => m.id),
    };
    const serialized = JSON.stringify(payload);

    const { tenantId } = await resolveTenantContext();
    // Usamos el unique compuesto (tenantId, key) para el upsert. Esto requiere
    // que la migration 20260513120000_systemconfig_cuid_pk_compound_unique
    // se haya aplicado en BD. Si no, falla con error de constraint missing.
    await prisma.systemConfig.upsert({
        where: { tenantId_key: { tenantId, key: ENABLED_MODULES_KEY } },
        create: {
            key: ENABLED_MODULES_KEY,
            value: serialized,
            updatedBy: session.id,
            tenantId,
        },
        update: {
            value: serialized,
            updatedBy: session.id,
        },
    });

    revalidatePath('/dashboard', 'layout');
    return { ok: true };
}

// ============================================================================
// VALIDACIÓN DE STOCK EN POS
// ============================================================================

export async function getStockValidationEnabled(): Promise<boolean> {
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const config = await db.systemConfig.findFirst({
            where: { key: STOCK_VALIDATION_KEY },
        });
        return config?.value === 'true';
    } catch {
        return false;
    }
}

export async function setStockValidationEnabled(enabled: boolean): Promise<{ ok: boolean; error?: string }> {
    const session = await getSession();
    if (!session) return { ok: false, error: 'No autorizado' };
    if (!['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'].includes(session.role)) {
        return { ok: false, error: 'Sin permisos para cambiar esta configuración' };
    }

    const { tenantId } = await resolveTenantContext();
    await prisma.systemConfig.upsert({
        where: { tenantId_key: { tenantId, key: STOCK_VALIDATION_KEY } },
        create: { key: STOCK_VALIDATION_KEY, value: String(enabled), updatedBy: session.id, tenantId },
        update: { value: String(enabled), updatedBy: session.id },
    });

    revalidatePath('/dashboard/config/pos');
    return { ok: true };
}
