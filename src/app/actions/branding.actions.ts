'use server';

/**
 * Branding actions — devuelve y actualiza la identidad visual/fiscal del
 * tenant activo. La UI (recibos, headers POS, exports) usa estos datos
 * en vez de los hardcoded de Shanklish que vivían en el código.
 *
 * Tenants sin branding seteado (campos NULL) → UI omite los campos. Mejor
 * un recibo SIN logo/RIF que uno con datos de otro restaurante.
 *
 * Editar branding: el caller debe ser OWNER o ADMIN_MANAGER de SU PROPIO
 * tenant. No cross-tenant — la action filtra por tenantId del JWT, no del
 * input.
 */

import prisma from '@/server/db';
import { resolveTenantContext, TenantContextUnresolvedError } from '@/lib/tenant-context.server';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export interface TenantBranding {
    /** Nombre comercial completo. Siempre presente (Tenant.name no es nullable). */
    name: string;
    slug: string;
    /** Nombre corto para headers de UI (POS Delivery, filename exports).
     *  Si null, los callers deben hacer fallback a `name`. */
    displayName: string | null;
    /** Razón social legal para recibos fiscales. NULL → no imprimir. */
    legalName: string | null;
    /** RIF/NIT/CIF para recibos fiscales. NULL → no imprimir. */
    taxId: string | null;
    /** Logo del recibo. NULL → no renderizar img. */
    logoUrl: string | null;
}

/**
 * Devuelve el branding del tenant activo en el request actual.
 *
 * Lanza solo si el contexto no se puede resolver (strict mode sin tenant).
 * En ese caso el caller debe manejar la ausencia — un recibo sin branding
 * sigue siendo legible, solo sale sin logo/RIF.
 */
export async function getTenantBrandingAction(): Promise<TenantBranding | null> {
    let ctx;
    try {
        ctx = await resolveTenantContext();
    } catch (err) {
        if (err instanceof TenantContextUnresolvedError) return null;
        throw err;
    }
    if (!ctx.tenantId) return null;

    const tenant = await prisma.tenant.findUnique({
        where: { id: ctx.tenantId },
        select: {
            name: true,
            slug: true,
            displayName: true,
            legalName: true,
            taxId: true,
            logoUrl: true,
        },
    });
    return tenant;
}

// ─── UPDATE ────────────────────────────────────────────────────────────────

export interface UpdateBrandingInput {
    /** Strings vacíos → guardar como NULL (clear). */
    displayName?: string;
    legalName?: string;
    taxId?: string;
    logoUrl?: string;
}

export interface UpdateBrandingResult {
    success: boolean;
    message?: string;
    branding?: TenantBranding;
}

/**
 * Actualiza el branding del tenant del caller. Solo OWNER y ADMIN_MANAGER
 * pueden ejecutarla. NO acepta tenantId en el input — siempre opera sobre
 * el tenant del JWT del caller, para evitar cross-tenant.
 */
export async function updateTenantBrandingAction(
    input: UpdateBrandingInput,
): Promise<UpdateBrandingResult> {
    const session = await getSession();
    if (!session) {
        return { success: false, message: 'No autorizado' };
    }
    if (session.role !== 'OWNER' && session.role !== 'ADMIN_MANAGER') {
        return { success: false, message: 'Solo OWNER o ADMIN_MANAGER pueden editar branding' };
    }

    const ctx = await resolveTenantContext();
    if (!ctx.tenantId) {
        return { success: false, message: 'No se pudo resolver el tenant del contexto' };
    }

    // Sanitización: trim + convertir "" en null (clear). Si el field no
    // viene en el input, NO se toca (undefined skip).
    const data: Record<string, string | null> = {};
    if (input.displayName !== undefined) {
        const v = input.displayName.trim();
        data.displayName = v === '' ? null : v;
    }
    if (input.legalName !== undefined) {
        const v = input.legalName.trim();
        data.legalName = v === '' ? null : v;
    }
    if (input.taxId !== undefined) {
        const v = input.taxId.trim();
        data.taxId = v === '' ? null : v;
    }
    if (input.logoUrl !== undefined) {
        const v = input.logoUrl.trim();
        // Validación blanda: solo permitir paths relativos (/...) o URLs
        // https. No permitir javascript:, data:, file:, etc. → previene
        // XSS si alguien edita el logo a mano vía DevTools.
        if (v !== '' && !v.startsWith('/') && !v.startsWith('https://')) {
            return { success: false, message: 'logoUrl debe empezar con / o https://' };
        }
        data.logoUrl = v === '' ? null : v;
    }

    if (Object.keys(data).length === 0) {
        return { success: false, message: 'No hay cambios para guardar' };
    }

    try {
        const updated = await prisma.tenant.update({
            where: { id: ctx.tenantId },
            data,
            select: {
                name: true,
                slug: true,
                displayName: true,
                legalName: true,
                taxId: true,
                logoUrl: true,
            },
        });

        // Invalidar pages que muestran branding (POS Delivery, recibos)
        revalidatePath('/dashboard/config/branding');
        revalidatePath('/dashboard/pos/delivery');
        revalidatePath('/dashboard/pos/restaurante');

        return { success: true, branding: updated };
    } catch (err) {
        console.error('[updateTenantBranding]', err);
        return { success: false, message: 'Error guardando branding' };
    }
}
