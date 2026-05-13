'use server';

/**
 * Áreas / Almacenes — multitenant pleno (Lote 2 — Fase 3 Paso D.b).
 *
 * Migración mecánica: imports + `withTenant(tenantId)` en cada query.
 *
 * Para `update({ where: { id } })` la extension no inyecta `tenantId` por
 * la limitación documentada en `prisma-tenant-client.ts` (los uniques son
 * globales, no compuestos). Lo convertimos a `updateMany({ where: { id,
 * tenantId } })` para que un ID de otro tenant no pueda escribirse.
 */

import { getSession } from '@/lib/auth';
import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import { revalidatePath } from 'next/cache';

export interface AreaItem {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  stockCount: number;
}

// ============================================================================
// LISTAR ÁREAS / ALMACENES
// ============================================================================

export async function getAreasAction(): Promise<{ success: boolean; data?: AreaItem[]; message?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, message: 'No autorizado' };

    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);

    const areas = await db.area.findMany({
      where: { deletedAt: null },
      include: { _count: { select: { inventoryLocations: true } } },
      orderBy: { name: 'asc' },
    });

    return {
      success: true,
      data: areas.map(a => ({
        id: a.id,
        name: a.name,
        description: a.description,
        isActive: a.isActive,
        stockCount: a._count.inventoryLocations,
      })),
    };
  } catch (error) {
    console.error('[areas] getAreasAction error:', error);
    return { success: false, message: 'Error al cargar almacenes' };
  }
}

// ============================================================================
// CREAR ÁREA
// ============================================================================

export async function createAreaAction(
  name: string,
  description?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, message: 'No autorizado' };
    if (!['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'].includes(session.role)) {
      return { success: false, message: 'Sin permisos para crear almacenes' };
    }
    if (!name?.trim()) return { success: false, message: 'El nombre es obligatorio' };

    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);

    await db.area.create({
      data: { name: name.trim().toUpperCase(), description: description?.trim() || null },
    });

    revalidatePath('/dashboard/almacenes');
    return { success: true, message: 'Almacén creado correctamente' };
  } catch (error: any) {
    console.error('[areas] createAreaAction error:', error);
    return { success: false, message: 'Error al crear almacén' };
  }
}

// ============================================================================
// ACTIVAR / DESACTIVAR ÁREA
// ============================================================================

export async function toggleAreaStatusAction(
  id: string,
  isActive: boolean
): Promise<{ success: boolean; message: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, message: 'No autorizado' };
    if (!['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'].includes(session.role)) {
      return { success: false, message: 'Sin permisos' };
    }

    const { tenantId } = await resolveTenantContext();

    // `update({ where: { id } })` no se filtra por tenantId en la extension
    // (uniques globales). Usamos `updateMany` con tenantId explícito para
    // que un ID de otro tenant no matchee.
    const res = await withTenant(tenantId).area.updateMany({
      where: { id },
      data: { isActive },
    });

    if (res.count === 0) {
      return { success: false, message: 'Almacén no encontrado' };
    }

    revalidatePath('/dashboard/almacenes');
    return { success: true, message: isActive ? 'Almacén activado' : 'Almacén desactivado' };
  } catch (error) {
    console.error('[areas] toggleAreaStatusAction error:', error);
    return { success: false, message: 'Error al actualizar estado' };
  }
}

// ============================================================================
// DETECTAR DUPLICADOS (nombres muy similares)
// ============================================================================

export async function findDuplicateAreasAction(): Promise<{ success: boolean; groups?: string[][]; message?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, message: 'No autorizado' };

    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);

    const areas = await db.area.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
    });

    // Normalizar nombres para comparar
    const normalize = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').trim();

    const grouped = new Map<string, string[]>();
    for (const area of areas) {
      const key = normalize(area.name);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(area.name);
    }

    const duplicates = Array.from(grouped.values()).filter(g => g.length > 1);

    return { success: true, groups: duplicates };
  } catch (error) {
    console.error('[areas] findDuplicateAreasAction error:', error);
    return { success: false, message: 'Error al buscar duplicados' };
  }
}
