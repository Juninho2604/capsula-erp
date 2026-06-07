'use server';

/**
 * Conteo físico de inventario via Excel — multitenant (Lote 4.b — Fase 3 Paso D.b).
 *
 * Modelos tenant-aware: Area, InventoryItem.
 * Modelos NO tenant-aware (FK-scoped): InventoryLocation, InventoryMovement.
 *
 * Fix de seguridad importante en esta migración:
 *   - `resetAllWarehouseStockAction` antes ejecutaba
 *     `prisma.inventoryLocation.updateMany({ data: { currentStock: 0 } })`
 *     SIN where, lo cual ponía en cero TODOS los warehouses de TODOS los
 *     tenants. Ahora filtra por inventoryItemId que pertenezcan al tenant
 *     del request.
 */

import { revalidatePath } from 'next/cache';
import prisma from '@/server/db';
import { getSession } from '@/lib/auth';
import { parseInventoryExcelBuffer } from '@/lib/inventory-excel-parse';
import Fuse from 'fuse.js';
import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';

const RESET_ROLES = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'];
const APPLY_ROLES = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CHEF', 'AREA_LEAD', 'AUDITOR'];

function normName(s: string) {
  return s
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/** Resuelve área por nombre (Principal / Cocina / Producción) */
export async function resolveDefaultCountAreasAction(): Promise<{
  principalId: string | null;
  productionId: string | null;
  areas: { id: string; name: string }[];
}> {
  const { tenantId } = await resolveTenantContext();
  const db = withTenant(tenantId);
  const areas = await db.area.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });

  let principalId: string | null = null;
  let productionId: string | null = null;

  for (const a of areas) {
    const n = normName(a.name);
    if (!principalId && (n.includes('PRINCIPAL') || n.includes('ALMACEN'))) principalId = a.id;
    if (!productionId && (n.includes('COCINA') || n.includes('PRODUCC'))) productionId = a.id;
  }

  if (!principalId && areas[0]) principalId = areas[0].id;
  if (!productionId && areas[1]) productionId = areas[1].id;
  else if (!productionId) productionId = principalId;

  return { principalId, productionId, areas };
}

export type PreviewRow = {
  /** SKU del Excel — si vino, el match es exacto por SKU, no fuzzy por nombre. */
  sku: string | null;
  productName: string;
  qtyPrincipal: number;
  qtyProduction: number | null;
  inventoryItemId: string | null;
  matchedName: string | null;
  /**
   * 0 = match exacto por SKU o por nombre (norm).
   * 0 < x < 0.42 = match fuzzy aceptado.
   * null = sin coincidencia.
   */
  matchScore: number | null;
};

export async function previewPhysicalCountFromExcelAction(formData: FormData): Promise<{
  success: boolean;
  message?: string;
  rows?: PreviewRow[];
  isDualColumn?: boolean;
}> {
  const session = await getSession();
  if (!session?.id || !APPLY_ROLES.includes(session.role)) {
    return { success: false, message: 'No autorizado' };
  }

  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) return { success: false, message: 'Adjunte un archivo Excel' };

  const buf = Buffer.from(await file.arrayBuffer());
  let parsed: { sku: string | null; productName: string; qtyPrincipal: number | null; qtyProduction: number | null }[];
  try {
    parsed = parseInventoryExcelBuffer(buf);
  } catch (e) {
    return {
      success: false,
      message: e instanceof Error ? e.message : 'Error leyendo el Excel',
    };
  }

  if (parsed.length === 0) return { success: false, message: 'No se encontraron filas de productos' };

  const { tenantId } = await resolveTenantContext();
  const db = withTenant(tenantId);
  const items = await db.inventoryItem.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, name: true, sku: true },
  });

  // Index por SKU para match O(1) cuando la plantilla trae código.
  const bySku = new Map(items.map(it => [it.sku.trim().toUpperCase(), it]));

  const fuse = new Fuse(items, {
    keys: ['name', 'sku'],
    threshold: 0.45,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });

  const isDualColumn = parsed.some((p) => p.qtyProduction !== null);

  const rows: PreviewRow[] = parsed.map((p) => {
    const qP = p.qtyPrincipal ?? 0;
    const qProd = p.qtyProduction;

    // 1) Match exacto por SKU (preferido — usuario descargó plantilla del sistema).
    if (p.sku) {
      const bySkuHit = bySku.get(p.sku.trim().toUpperCase());
      if (bySkuHit) {
        return {
          sku: p.sku,
          productName: p.productName,
          qtyPrincipal: qP,
          qtyProduction: qProd,
          inventoryItemId: bySkuHit.id,
          matchedName: bySkuHit.name,
          matchScore: 0,
        };
      }
    }

    // 2) Match exacto por nombre normalizado.
    const exact = items.find((it) => normName(it.name) === normName(p.productName));
    if (exact) {
      return {
        sku: p.sku,
        productName: p.productName,
        qtyPrincipal: qP,
        qtyProduction: qProd,
        inventoryItemId: exact.id,
        matchedName: exact.name,
        matchScore: 0,
      };
    }

    // 3) Fuzzy por nombre.
    const hits = fuse.search(p.productName);
    const best = hits[0];
    if (best && best.score !== undefined && best.score < 0.42) {
      return {
        sku: p.sku,
        productName: p.productName,
        qtyPrincipal: qP,
        qtyProduction: qProd,
        inventoryItemId: best.item.id,
        matchedName: best.item.name,
        matchScore: best.score,
      };
    }

    return {
      sku: p.sku,
      productName: p.productName,
      qtyPrincipal: qP,
      qtyProduction: qProd,
      inventoryItemId: null,
      matchedName: null,
      matchScore: best?.score ?? null,
    };
  });

  return { success: true, rows, isDualColumn };
}

// ============================================================================
// Plantilla masiva — TODOS los SKU activos con código, categoría, unidad
// y último stock conocido por área. El usuario llena la columna CANTIDAD
// y vuelve a subir. La columna SKU permite match exacto (sin fuzzy).
// ============================================================================
export type CountTemplateRow = {
  sku: string;
  productName: string;
  category: string;
  baseUnit: string;
  stockPrincipal: number;
  stockProduction: number | null;
};

export async function getInventoryCountTemplateAction(
  principalAreaId: string,
  productionAreaId: string | null,
): Promise<{ success: boolean; message?: string; rows?: CountTemplateRow[] }> {
  const session = await getSession();
  if (!session?.id || !APPLY_ROLES.includes(session.role)) {
    return { success: false, message: 'No autorizado' };
  }
  if (!principalAreaId) return { success: false, message: 'Seleccione el almacén principal' };

  const { tenantId } = await resolveTenantContext();
  const db = withTenant(tenantId);

  // Validar ownership del área(s).
  const ownedPrincipal = await db.area.findFirst({ where: { id: principalAreaId }, select: { id: true } });
  if (!ownedPrincipal) return { success: false, message: 'Área principal no encontrada' };
  if (productionAreaId) {
    const ownedProd = await db.area.findFirst({ where: { id: productionAreaId }, select: { id: true } });
    if (!ownedProd) return { success: false, message: 'Área producción no encontrada' };
  }

  const items = await db.inventoryItem.findMany({
    where: { isActive: true, deletedAt: null },
    select: {
      id: true,
      sku: true,
      name: true,
      category: true,
      baseUnit: true,
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });

  const itemIds = items.map(i => i.id);
  // Stock actual de cada item en las áreas pedidas. InventoryLocation no es
  // tenant-aware en schema; lo scopeamos por inventoryItemId que sí lo está.
  const locations = await prisma.inventoryLocation.findMany({
    where: {
      inventoryItemId: { in: itemIds },
      areaId: { in: productionAreaId ? [principalAreaId, productionAreaId] : [principalAreaId] },
    },
    select: { inventoryItemId: true, areaId: true, currentStock: true },
  });

  const stockMap = new Map<string, { principal: number; production: number }>();
  for (const loc of locations) {
    const cur = stockMap.get(loc.inventoryItemId) ?? { principal: 0, production: 0 };
    if (loc.areaId === principalAreaId) cur.principal = loc.currentStock;
    if (productionAreaId && loc.areaId === productionAreaId) cur.production = loc.currentStock;
    stockMap.set(loc.inventoryItemId, cur);
  }

  const rows: CountTemplateRow[] = items.map(i => {
    const stock = stockMap.get(i.id) ?? { principal: 0, production: 0 };
    return {
      sku: i.sku,
      productName: i.name,
      category: i.category || 'Sin categoría',
      baseUnit: i.baseUnit,
      stockPrincipal: stock.principal,
      stockProduction: productionAreaId ? stock.production : null,
    };
  });

  return { success: true, rows };
}

export type ApplyCountRow = {
  inventoryItemId: string;
  qtyPrincipal: number;
  qtyProduction?: number | null;
};

export async function applyPhysicalCountAction(input: {
  rows: ApplyCountRow[];
  principalAreaId: string;
  productionAreaId?: string | null;
  /** Si false, solo se usa qtyPrincipal en principalAreaId (modo 1 columna) */
  dualWarehouse: boolean;
}): Promise<{ success: boolean; message: string; applied?: number }> {
  const session = await getSession();
  if (!session?.id || !APPLY_ROLES.includes(session.role)) {
    return { success: false, message: 'No autorizado' };
  }

  if (!input.principalAreaId || input.rows.length === 0) {
    return { success: false, message: 'Datos incompletos' };
  }

  const prodArea = input.dualWarehouse ? input.productionAreaId || null : null;
  if (input.dualWarehouse && !prodArea) {
    return { success: false, message: 'Seleccione el almacén de producción/cocina' };
  }

  const userId = session.id;
  const reason = 'Conteo físico semanal (carga en sistema)';

  // Validar ownership de todos los inventoryItemIds + áreas antes de tocar
  // tabla InventoryLocation/InventoryMovement (no tenant-aware).
  const { tenantId } = await resolveTenantContext();
  const db = withTenant(tenantId);
  const itemIds = Array.from(new Set(input.rows.map(r => r.inventoryItemId)));
  const ownedItems = await db.inventoryItem.findMany({
    where: { id: { in: itemIds } },
    select: { id: true },
  });
  if (ownedItems.length !== itemIds.length) {
    return { success: false, message: 'Uno o más items no pertenecen a este tenant' };
  }
  const areaIds = [input.principalAreaId, ...(prodArea ? [prodArea] : [])];
  const ownedAreas = await db.area.findMany({
    where: { id: { in: areaIds } },
    select: { id: true },
  });
  if (ownedAreas.length !== areaIds.length) {
    return { success: false, message: 'Una o más áreas no pertenecen a este tenant' };
  }

  try {
    let applied = 0;
    await prisma.$transaction(
      async (tx) => {
        for (const row of input.rows) {
          const areasToUpdate: { areaId: string; qty: number }[] = [
            { areaId: input.principalAreaId, qty: row.qtyPrincipal },
          ];
          if (input.dualWarehouse && prodArea) {
            areasToUpdate.push({
              areaId: prodArea,
              qty: row.qtyProduction ?? 0,
            });
          }

          for (const { areaId, qty } of areasToUpdate) {
            const loc = await tx.inventoryLocation.findUnique({
              where: {
                inventoryItemId_areaId: {
                  inventoryItemId: row.inventoryItemId,
                  areaId,
                },
              },
            });
            const old = loc ? Number(loc.currentStock) : 0;
            const target = Math.max(0, qty);
            const delta = target - old;

            if (Math.abs(delta) > 0.000001) {
              await tx.inventoryMovement.create({
                data: {
                  inventoryItemId: row.inventoryItemId,
                  movementType: delta > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
                  quantity: Math.abs(delta),
                  unit: 'UNIT',
                  reason,
                  notes: `Ajuste a conteo físico. Anterior: ${old.toFixed(4)} → ${target.toFixed(4)}`,
                  createdById: userId,
                  areaId,
                },
              });
            }

            await tx.inventoryLocation.upsert({
              where: {
                inventoryItemId_areaId: {
                  inventoryItemId: row.inventoryItemId,
                  areaId,
                },
              },
              create: {
                inventoryItemId: row.inventoryItemId,
                areaId,
                currentStock: target,
                lastCountDate: new Date(),
              },
              update: {
                currentStock: target,
                lastCountDate: new Date(),
              },
            });
            applied++;
          }
        }
      },
      { timeout: 120000 }
    );

    revalidatePath('/dashboard/inventario');
    revalidatePath('/dashboard/inventario/conteo-semanal');
    revalidatePath('/dashboard/inventario/auditorias');
    revalidatePath('/dashboard');

    return {
      success: true,
      message: `Stock actualizado (${input.rows.length} productos, ${applied} ubicaciones).`,
      applied,
    };
  } catch (e) {
    console.error(e);
    return {
      success: false,
      message: e instanceof Error ? e.message : 'Error al aplicar el conteo',
    };
  }
}

/**
 * Pone currentStock = 0 en todas las ubicaciones del tenant.
 * Solo gerencia — acción destructiva.
 *
 * Fix multitenant: antes ejecutaba `updateMany({ data: { currentStock: 0 } })`
 * SIN where, poniendo en cero TODOS los warehouses de TODOS los tenants.
 * Ahora filtra por inventoryItemId que pertenezca al tenant del request.
 */
export async function resetAllWarehouseStockAction(confirmPhrase: string): Promise<{
  success: boolean;
  message: string;
  locationsUpdated?: number;
}> {
  const session = await getSession();
  if (!session?.id || !RESET_ROLES.includes(session.role)) {
    return { success: false, message: 'Solo gerencia puede poner el inventario en cero.' };
  }

  if (confirmPhrase.trim().toUpperCase() !== 'PONER EN CERO') {
    return { success: false, message: 'Escriba exactamente: PONER EN CERO' };
  }

  try {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    // Sacar IDs de items del tenant para filtrar el updateMany. InventoryLocation
    // no tiene tenantId, así que el filtro va por la FK inventoryItemId.
    const ownedItems = await db.inventoryItem.findMany({ select: { id: true } });
    const ownedIds = ownedItems.map(i => i.id);
    if (ownedIds.length === 0) {
      return { success: true, message: 'No hay items para reiniciar.', locationsUpdated: 0 };
    }

    const result = await prisma.inventoryLocation.updateMany({
      where: { inventoryItemId: { in: ownedIds } },
      data: { currentStock: 0, lastCountDate: new Date() },
    });

    revalidatePath('/dashboard/inventario');
    revalidatePath('/dashboard/inventario/conteo-semanal');
    revalidatePath('/dashboard');

    return {
      success: true,
      message: `Todas las ubicaciones quedaron en 0 (${result.count} registros).`,
      locationsUpdated: result.count,
    };
  } catch (e) {
    console.error(e);
    return { success: false, message: 'Error al reiniciar stocks' };
  }
}
