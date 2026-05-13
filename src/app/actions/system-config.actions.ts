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
 */

import prisma from '@/server/db';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { MODULE_REGISTRY } from '@/lib/constants/modules-registry';
import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';

const ENABLED_MODULES_KEY = 'enabled_modules';
const STOCK_VALIDATION_KEY = 'pos_stock_validation_enabled';

/**
 * Lee los módulos habilitados desde la BD.
 * Si no existe el registro, devuelve los módulos con enabledByDefault=true.
 */
export async function getEnabledModulesFromDB(): Promise<string[]> {
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const config = await db.systemConfig.findFirst({
            where: { key: ENABLED_MODULES_KEY },
        });

        if (config) {
            const parsed = JSON.parse(config.value);
            if (Array.isArray(parsed)) return parsed as string[];
        }
    } catch {
        // Si falla la BD (primera vez, tabla vacía, etc.), usar defaults
    }

    // Fallback: leer de env var (compatibilidad hacia atrás) o defaults
    const envModules = process.env.NEXT_PUBLIC_ENABLED_MODULES;
    if (envModules) {
        return envModules.split(',').map(m => m.trim()).filter(Boolean);
    }

    return MODULE_REGISTRY.filter(m => m.enabledByDefault).map(m => m.id);
}

/**
 * Guarda los módulos habilitados en la BD.
 * Solo OWNER puede ejecutar esta acción.
 */
export async function saveEnabledModules(moduleIds: string[]): Promise<{ ok: boolean; error?: string }> {
    const session = await getSession();
    if (!session) return { ok: false, error: 'No autorizado' };
    if (session.role !== 'OWNER') return { ok: false, error: 'Solo el OWNER puede cambiar los módulos' };

    const validIds = new Set(MODULE_REGISTRY.map(m => m.id));
    const filtered = moduleIds.filter(id => validIds.has(id));
    if (!filtered.includes('module_config')) {
        filtered.push('module_config');
    }

    const { tenantId } = await resolveTenantContext();
    // Usamos el unique compuesto (tenantId, key) para el upsert. Esto requiere
    // que la migration 20260513120000_systemconfig_cuid_pk_compound_unique
    // se haya aplicado en BD. Si no, falla con error de constraint missing.
    await prisma.systemConfig.upsert({
        where: { tenantId_key: { tenantId, key: ENABLED_MODULES_KEY } },
        create: {
            key: ENABLED_MODULES_KEY,
            value: JSON.stringify(filtered),
            updatedBy: session.id,
            tenantId,
        },
        update: {
            value: JSON.stringify(filtered),
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
