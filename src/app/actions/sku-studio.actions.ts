'use server';

/**
 * SKU STUDIO ACTIONS
 * ─────────────────────────────────────────────────────────────────────────────
 * Creación rápida de productos (InventoryItem + MenuItem) usando plantillas.
 *
 * TODO: Copiar/adaptar la lógica de Table-Pong repo si existía.
 *
 * Funciones a implementar:
 *   getProductFamilies()                  — listar familias de productos
 *   createProductFamily(data)             — crear familia
 *   getSkuTemplates(familyId?)            — listar plantillas
 *   getSkuTemplateById(id)                — detalle de plantilla
 *   createSkuTemplate(data)               — crear plantilla con defaults JSON
 *   updateSkuTemplate(id, data)           — editar plantilla
 *   deleteSkuTemplate(id)                 — soft delete plantilla
 *
 *   createProductFromTemplate(templateId, overrides)
 *     → Crea InventoryItem + MenuItem en un solo paso usando los defaults
 *       de la plantilla fusionados con los overrides del usuario.
 */

import prisma from '@/server/db';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

// ─── Product Families ─────────────────────────────────────────────────────────

export async function getProductFamilies() {
    const session = await getSession();
    if (!session) throw new Error('No autorizado');

    return prisma.productFamily.findMany({
        where: { isActive: true },
        include: { _count: { select: { items: true, templates: true } } },
        orderBy: { name: 'asc' },
    });
}

export async function createProductFamily(data: {
    code: string;
    name: string;
    description?: string;
    icon?: string;
}) {
    const session = await getSession();
    if (!session) throw new Error('No autorizado');
    if (!['OWNER', 'ADMIN_MANAGER'].includes(session.role)) {
        throw new Error('Sin permiso para crear familias de producto');
    }

    const family = await prisma.productFamily.create({ data });
    revalidatePath('/dashboard/config/sku-studio');
    return { ok: true, family };
}

// ─── SKU Templates ───────────────────────────────────────────────────────────

export async function getSkuTemplates(productFamilyId?: string) {
    const session = await getSession();
    if (!session) throw new Error('No autorizado');

    return prisma.skuCreationTemplate.findMany({
        where: {
            isActive: true,
            ...(productFamilyId && { productFamilyId }),
        },
        include: { productFamily: { select: { id: true, code: true, name: true } } },
        orderBy: { name: 'asc' },
    });
}

export async function createSkuTemplate(data: {
    name: string;
    description?: string;
    productFamilyId?: string;
    defaultFields: Record<string, unknown>; // se serializa a JSON
}) {
    const session = await getSession();
    if (!session) throw new Error('No autorizado');
    if (!['OWNER', 'ADMIN_MANAGER'].includes(session.role)) {
        throw new Error('Sin permiso para crear plantillas SKU');
    }

    const template = await prisma.skuCreationTemplate.create({
        data: {
            name: data.name,
            description: data.description,
            productFamilyId: data.productFamilyId,
            defaultFields: JSON.stringify(data.defaultFields),
        },
    });

    revalidatePath('/dashboard/config/sku-studio');
    return { ok: true, template };
}

/**
 * Crea un InventoryItem y opcionalmente un MenuItem desde una plantilla.
 * Los `overrides` reemplazan los defaultFields de la plantilla.
 */
export async function createProductFromTemplate(
    templateId: string,
    overrides: Record<string, unknown>
) {
    const session = await getSession();
    if (!session) throw new Error('No autorizado');
    if (!['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'].includes(session.role)) {
        throw new Error('Sin permiso para crear productos');
    }

    const template = await prisma.skuCreationTemplate.findUniqueOrThrow({
        where: { id: templateId },
    });

    const defaults = JSON.parse(template.defaultFields) as Record<string, unknown>;
    const merged   = { ...defaults, ...overrides };

    // ── Create InventoryItem ────────────────────────────────────────────────
    const invItem = await prisma.inventoryItem.create({
        data: {
            sku:         merged.sku          as string,
            name:        merged.name         as string,
            description: merged.description  as string | undefined,
            type:        (merged.type        as string) ?? 'FINISHED_GOOD',
            category:    merged.category     as string | undefined,
            baseUnit:    (merged.baseUnit    as string) ?? 'UNIT',
            purchaseUnit: merged.purchaseUnit as string | undefined,
            isBeverage:  (merged.isBeverage  as boolean) ?? false,
            beverageCategory: merged.beverageCategory as string | undefined,
            productFamilyId:  template.productFamilyId ?? undefined,
        },
    });

    // ── Optionally create MenuItem ──────────────────────────────────────────
    let menuItem = null;
    if (merged.createMenuItem && merged.menuCategoryId) {
        menuItem = await prisma.menuItem.create({
            data: {
                sku:            invItem.sku,
                name:           invItem.name,
                description:    invItem.description ?? undefined,
                categoryId:     merged.menuCategoryId as string,
                price:          (merged.price         as number) ?? 0,
                serviceCategory: merged.serviceCategory as string | undefined,
                kitchenRouting:  merged.kitchenRouting  as string | undefined,
            },
        });
    }

    revalidatePath('/dashboard/menu');
    revalidatePath('/dashboard/inventario');
    return { ok: true, invItem, menuItem };
}
