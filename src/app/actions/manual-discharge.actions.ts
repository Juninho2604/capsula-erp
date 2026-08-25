'use server';

/**
 * Descargo manual de consumo (§156).
 *
 * Nace del "Arma tu Shawarma" de Shanklish: un plato con demasiadas
 * combinaciones (kibe por unidad, carnes por gramos) para modelarlo con
 * modificadores. El plato se vende SIN receta — el detalle va en la nota del
 * ítem y la cocina lo lee de la comanda — así que la venta no descuenta
 * inventario. Periódicamente, quien hace el inventario descarga acá el
 * consumo agregado real: kibe en unidades, pollo en kilos, cada insumo en su
 * unidad.
 *
 * También sirve para cualquier salida que hoy no tiene dónde registrarse
 * (mermas, consumo interno): es genérico a propósito.
 *
 * Piezas:
 *  - manualDischargeAction: valida, chequea faltantes (§155: puede dejar el
 *    insumo en negativo con confirmación explícita) y registra 1 movimiento
 *    MANUAL_OUT por línea. El Kardex lo muestra como salida (sufijo _OUT).
 *  - getDischargeContextAction: cuántas unidades del plato vinculado se
 *    vendieron desde el último descargo de ESE plato. Es el dato que cierra
 *    el ciclo: sin él, nadie sabe qué período está cubriendo ni si el
 *    descargo se está acumulando sin hacerse.
 *
 * El vínculo descargo→plato se guarda como marcador estable en las notas del
 * movimiento (`[plato:<menuItemId>]`) para no abrir una migración por una
 * referencia informativa.
 */

import { revalidatePath } from 'next/cache';
import prisma from '@/server/db';
import { getSession } from '@/lib/auth';
import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import { COUNT_ROLES } from '@/lib/inventory/count-permissions';
import {
    computeShortfalls,
    shortfallMessage,
    type StockRequirementRow,
} from '@/lib/inventory/stock-shortfall';

// Mismo conjunto que el conteo (§150): producción, cocina, jefes, gerencia y
// auditoría. Registrar consumo es un acto operativo como contar o producir,
// no una confirmación de control como aplicar un ajuste.
const DISCHARGE_ROLES = COUNT_ROLES;

const menuItemMarker = (menuItemId: string) => `[plato:${menuItemId}]`;

export interface ManualDischargeInput {
    areaId: string;
    /** Insumos a descargar, cada uno en su unidad base. */
    lines: { itemId: string; quantity: number }[];
    /** Motivo obligatorio — es lo que se lee en el Kardex dentro de un mes. */
    reason: string;
    /** Plato vinculado (opcional) — habilita el contador de vendidos. */
    menuItemId?: string | null;
    /** §155 — permitir que el insumo quede en negativo, con confirmación. */
    allowNegativeStock?: boolean;
}

export interface ManualDischargeResult {
    success: boolean;
    message: string;
    dischargedCount?: number;
}

export async function manualDischargeAction(input: ManualDischargeInput): Promise<ManualDischargeResult> {
    try {
        const session = await getSession();
        if (!session?.id || !DISCHARGE_ROLES.includes(session.role)) {
            return { success: false, message: 'No autorizado' };
        }

        const reason = (input.reason ?? '').trim();
        if (!reason) {
            return { success: false, message: 'Indicá el motivo del descargo — es lo que se lee en el Kardex después.' };
        }

        // Dedup defensivo: dos líneas del mismo insumo se suman, no se pisan.
        const byItem = new Map<string, number>();
        for (const line of input.lines ?? []) {
            const qty = Number(line.quantity);
            if (!line.itemId || !Number.isFinite(qty) || qty <= 0) continue;
            byItem.set(line.itemId, (byItem.get(line.itemId) ?? 0) + qty);
        }
        if (byItem.size === 0) {
            return { success: false, message: 'Agregá al menos un insumo con cantidad mayor a cero.' };
        }

        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);

        const ownedArea = await db.area.findFirst({
            where: { id: input.areaId, isActive: true },
            select: { id: true, name: true },
        });
        if (!ownedArea) return { success: false, message: 'Almacén no encontrado' };

        // El plato vinculado debe ser del tenant — si no existe se ignora en
        // silencio (es informativo, no bloquea el descargo).
        let linkedMenuItem: { id: string; name: string } | null = null;
        if (input.menuItemId) {
            linkedMenuItem = await db.menuItem.findFirst({
                where: { id: input.menuItemId },
                select: { id: true, name: true },
            });
        }

        const items = await db.inventoryItem.findMany({
            where: { id: { in: Array.from(byItem.keys()) }, isActive: true },
            include: { stockLevels: { where: { areaId: input.areaId } } },
        });
        if (items.length !== byItem.size) {
            return { success: false, message: 'Uno o más insumos no existen o están inactivos.' };
        }

        const requirementRows: StockRequirementRow[] = items.map(item => ({
            itemId: item.id,
            name: item.name,
            required: byItem.get(item.id)!,
            available: item.stockLevels[0] ? Number(item.stockLevels[0].currentStock) : 0,
            unit: item.baseUnit,
        }));

        // §155 — sin permiso explícito se bloquea; con él, el insumo queda en
        // negativo (deuda visible que salda la próxima entrada) y el banner de
        // Inventario lo muestra.
        const shortfalls = computeShortfalls(requirementRows);
        if (shortfalls.length > 0 && !input.allowNegativeStock) {
            return {
                success: false,
                message: `Stock insuficiente:\n${shortfallMessage(shortfalls)}`,
            };
        }

        const marker = linkedMenuItem ? `${menuItemMarker(linkedMenuItem.id)} ` : '';
        const reasonLabel = linkedMenuItem
            ? `Descargo manual · ${linkedMenuItem.name}: ${reason}`
            : `Descargo manual: ${reason}`;

        await prisma.$transaction(async (tx) => {
            for (const item of items) {
                const qty = byItem.get(item.id)!;
                await tx.inventoryLocation.upsert({
                    where: {
                        inventoryItemId_areaId: {
                            inventoryItemId: item.id,
                            areaId: input.areaId,
                        },
                    },
                    update: { currentStock: { decrement: qty } },
                    create: {
                        inventoryItemId: item.id,
                        areaId: input.areaId,
                        currentStock: -qty,
                    },
                });
                await tx.inventoryMovement.create({
                    data: {
                        inventoryItemId: item.id,
                        movementType: 'MANUAL_OUT',
                        quantity: -qty,
                        unit: item.baseUnit,
                        reason: reasonLabel,
                        notes: `${marker}Almacén: ${ownedArea.name}`
                            + (shortfalls.some(f => f.itemId === item.id)
                                ? ' · faltante de inventario, queda en negativo'
                                : ''),
                        createdById: session.id,
                    },
                });
            }
        });

        revalidatePath('/dashboard/inventario');
        return {
            success: true,
            message: `Descargo registrado: ${byItem.size} insumo(s) desde ${ownedArea.name}.`,
            dischargedCount: byItem.size,
        };
    } catch (error) {
        console.error('Error en manualDischargeAction:', error);
        return { success: false, message: 'Error al registrar el descargo' };
    }
}

// ============================================================================
// CONTEXTO: vendidos desde el último descargo del plato
// ============================================================================

export interface DischargeContext {
    /** Fecha del último descargo vinculado a este plato. null = nunca. */
    lastDischargeAt: string | null;
    /** Unidades vendidas del plato desde entonces (o desde siempre). */
    soldSince: number;
    /**
     * §156.1 — Qué se despachó en cada unidad, según la nota del mesonero.
     * Sin esto el contador dice CUÁNTOS pero no CON QUÉ, y había que abrir
     * venta por venta para saber qué descargar.
     */
    soldLines: { note: string | null; quantity: number }[];
    /** true si se recortó la lista (período muy largo sin descargar). */
    truncated: boolean;
}

export async function getDischargeContextAction(menuItemId: string): Promise<DischargeContext> {
    try {
        const { tenantId } = await resolveTenantContext();

        // InventoryMovement no es tenant-aware (§123): el scope se fuerza vía
        // la relación con el item, que sí lo es.
        const last = await prisma.inventoryMovement.findFirst({
            where: {
                movementType: 'MANUAL_OUT',
                notes: { contains: menuItemMarker(menuItemId) },
                inventoryItem: { tenantId },
            },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
        });

        const where = {
            menuItemId,
            voidedAt: null,
            order: {
                tenantId,
                status: { not: 'CANCELLED' },
                ...(last ? { createdAt: { gte: last.createdAt } } : {}),
            },
        };

        const sold = await prisma.salesOrderItem.aggregate({
            _sum: { quantity: true },
            where,
        });

        // Tope defensivo: un período sin descargar de meses puede traer miles
        // de líneas. 500 alcanza para leerlas y agruparlas; si se recorta, la
        // pantalla lo avisa en vez de mostrar un resumen incompleto en
        // silencio.
        const MAX_LINES = 500;
        const rows = await prisma.salesOrderItem.findMany({
            where,
            select: { notes: true, quantity: true },
            orderBy: { id: 'desc' },
            take: MAX_LINES + 1,
        });
        const truncated = rows.length > MAX_LINES;

        return {
            lastDischargeAt: last ? last.createdAt.toISOString() : null,
            soldSince: sold._sum.quantity ?? 0,
            soldLines: rows.slice(0, MAX_LINES).map(r => ({ note: r.notes, quantity: r.quantity })),
            truncated,
        };
    } catch (error) {
        console.error('Error en getDischargeContextAction:', error);
        return { lastDischargeAt: null, soldSince: 0, soldLines: [], truncated: false };
    }
}

/** Platos del menú para el selector de vínculo (id + nombre, activos). */
export async function getMenuItemsForDischargeAction(): Promise<{ id: string; name: string }[]> {
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        return await db.menuItem.findMany({
            where: { isAvailable: true },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        });
    } catch (error) {
        console.error('Error listando platos para descargo:', error);
        return [];
    }
}
