'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/server/db';
import { getSession } from '@/lib/auth';
import { parseInventoryExcelBuffer } from '@/lib/inventory-excel-parse';
import Fuse from 'fuse.js';

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
  const areas = await prisma.area.findMany({
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
  productName: string;
  qtyPrincipal: number;
  qtyProduction: number | null;
  inventoryItemId: string | null;
  matchedName: string | null;
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
  let parsed: { productName: string; qtyPrincipal: number | null; qtyProduction: number | null }[];
  try {
    parsed = parseInventoryExcelBuffer(buf);
  } catch (e) {
    return {
      success: false,
      message: e instanceof Error ? e.message : 'Error leyendo el Excel',
    };
  }

  if (parsed.length === 0) return { success: false, message: 'No se encontraron filas de productos' };

  const items = await prisma.inventoryItem.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, name: true, sku: true },
  });

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

    const exact = items.find((it) => normName(it.name) === normName(p.productName));
    if (exact) {
      return {
        productName: p.productName,
        qtyPrincipal: qP,
        qtyProduction: qProd,
        inventoryItemId: exact.id,
        matchedName: exact.name,
        matchScore: 0,
      };
    }

    const hits = fuse.search(p.productName);
    const best = hits[0];
    if (best && best.score !== undefined && best.score < 0.42) {
      return {
        productName: p.productName,
        qtyPrincipal: qP,
        qtyProduction: qProd,
        inventoryItemId: best.item.id,
        matchedName: best.item.name,
        matchScore: best.score,
      };
    }

    return {
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
 * Pone currentStock = 0 en todas las ubicaciones (todos los almacenes).
 * Solo gerencia — acción destructiva.
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
    const result = await prisma.inventoryLocation.updateMany({
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
