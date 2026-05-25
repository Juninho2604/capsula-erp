'use server';

/**
 * Branding actions — devuelve la identidad visual/fiscal del tenant activo
 * para que la UI (print receipts, headers POS, exports) muestre datos del
 * tenant correcto en vez de los hardcoded de Shanklish que vivían en el
 * código.
 *
 * Tenants sin branding seteado (campos NULL) → UI omite los campos. Mejor
 * un recibo SIN logo/RIF que uno con datos de otro restaurante.
 *
 * Para setear branding de un tenant nuevo, hoy es manual via SQL:
 *   UPDATE "Tenant" SET "logoUrl"='/logo-X.png', "taxId"='J-...', "legalName"='X, C.A.' WHERE slug='...';
 * En el futuro: UI desde Panel KPSULA → /admin/tenants/[id]/branding.
 */

import prisma from '@/server/db';
import { resolveTenantContext, TenantContextUnresolvedError } from '@/lib/tenant-context.server';

export interface TenantBranding {
    /** Nombre comercial. Siempre presente (Tenant.name no es nullable). */
    name: string;
    slug: string;
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
        select: { name: true, slug: true, legalName: true, taxId: true, logoUrl: true },
    });
    return tenant;
}
