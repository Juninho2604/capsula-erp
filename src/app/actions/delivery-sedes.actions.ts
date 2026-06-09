'use server';

/**
 * Server actions del submódulo Sedes (Fase 5): gestiona las sedes de delivery
 * = `Branch` + `BranchDeliveryConfig` (1:1) + `DeliveryZone` (zonas de
 * cobertura). Permite crear una sede nueva (Branch + config) y editar
 * coordenadas, impresora, grupo de WhatsApp, gerente y zonas.
 *
 * Aislado del resto del ERP. La creación de Branch es aditiva (fila nueva).
 */

import prisma from '@/server/db';
import { withTenant } from '@/lib/prisma-tenant-client';
import { deliveryGuard } from '@/lib/delivery/guard';
import { revalidatePath } from 'next/cache';

const MANAGER_ROLES = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'HR_MANAGER'];

export interface SedeRow {
    branchId: string;
    code: string;
    name: string;
    isActive: boolean;
    lat: number | null;
    lon: number | null;
    printerStation: string | null;
    whatsappGroup: string | null;
    managerUserId: string | null;
    zones: { id: string; name: string }[];
}

export interface ManagerOption {
    id: string;
    name: string;
}

/** Slug → code en MAYÚSCULAS, único por tenant. */
function slugCode(name: string): string {
    const base = name
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 12);
    return base || 'SEDE';
}

export async function listDeliverySedesAction(): Promise<{
    success: boolean;
    message?: string;
    sedes: SedeRow[];
    managers: ManagerOption[];
}> {
    const g = await deliveryGuard();
    if (!g.ok) return { success: false, message: g.message, sedes: [], managers: [] };
    const db = withTenant(g.tenantId);

    const [configs, branchesNoCfg, zones, users] = await Promise.all([
        db.branchDeliveryConfig.findMany({
            include: { branch: { select: { id: true, code: true, name: true, isActive: true } } },
        }),
        db.branch.findMany({ select: { id: true, code: true, name: true, isActive: true } }),
        db.deliveryZone.findMany({ orderBy: { name: 'asc' } }),
        db.user.findMany({
            where: { role: { in: MANAGER_ROLES }, isActive: true },
            select: { id: true, firstName: true, lastName: true },
            orderBy: { firstName: 'asc' },
        }),
    ]);

    const zonesByBranch = new Map<string, { id: string; name: string }[]>();
    for (const z of zones) {
        const list = zonesByBranch.get(z.branchId) ?? [];
        list.push({ id: z.id, name: z.name });
        zonesByBranch.set(z.branchId, list);
    }

    const cfgByBranch = new Map(configs.map(c => [c.branchId, c]));

    // Todas las sucursales del tenant; las que aún no tienen config se muestran
    // igual (config null → el form la crea al guardar).
    const sedes: SedeRow[] = branchesNoCfg.map(b => {
        const cfg = cfgByBranch.get(b.id);
        return {
            branchId: b.id,
            code: b.code,
            name: b.name,
            isActive: b.isActive,
            lat: cfg?.lat ?? null,
            lon: cfg?.lon ?? null,
            printerStation: cfg?.printerStation ?? null,
            whatsappGroup: cfg?.whatsappGroup ?? null,
            managerUserId: cfg?.managerUserId ?? null,
            zones: zonesByBranch.get(b.id) ?? [],
        };
    });

    return {
        success: true,
        sedes,
        managers: users.map(u => ({ id: u.id, name: `${u.firstName} ${u.lastName}`.trim() })),
    };
}

export async function createSedeAction(input: {
    name: string;
    code?: string;
}): Promise<{ success: boolean; message?: string }> {
    const g = await deliveryGuard();
    if (!g.ok) return { success: false, message: g.message };
    const name = input.name?.trim();
    if (!name) return { success: false, message: 'El nombre de la sede es obligatorio.' };

    // Code único por tenant (slug + sufijo si colisiona).
    const existing = await prisma.branch.findMany({
        where: { tenantId: g.tenantId },
        select: { code: true },
    });
    const taken = new Set(existing.map(b => b.code.toUpperCase()));
    let code = (input.code?.trim().toUpperCase() || slugCode(name)).slice(0, 14);
    if (taken.has(code)) {
        let n = 2;
        while (taken.has(`${code}-${n}`.slice(0, 14))) n++;
        code = `${code}-${n}`.slice(0, 14);
    }

    await prisma.$transaction(async tx => {
        const branch = await tx.branch.create({
            data: { tenantId: g.tenantId, code, name },
            select: { id: true },
        });
        await tx.branchDeliveryConfig.create({
            data: { tenantId: g.tenantId, branchId: branch.id },
        });
    });

    revalidatePath('/dashboard/delivery/sedes');
    return { success: true };
}

export async function updateSedeAction(
    branchId: string,
    patch: {
        name?: string;
        isActive?: boolean;
        lat?: number | null;
        lon?: number | null;
        printerStation?: string | null;
        whatsappGroup?: string | null;
        managerUserId?: string | null;
    },
): Promise<{ success: boolean; message?: string }> {
    const g = await deliveryGuard();
    if (!g.ok) return { success: false, message: g.message };
    const db = withTenant(g.tenantId);

    // Ownership: la sucursal pertenece al tenant.
    const branch = await db.branch.findFirst({ where: { id: branchId }, select: { id: true } });
    if (!branch) return { success: false, message: 'Sede no encontrada.' };

    // Datos del Branch (name / isActive).
    const branchData: Record<string, unknown> = {};
    if (patch.name !== undefined) {
        const n = patch.name.trim();
        if (!n) return { success: false, message: 'El nombre no puede quedar vacío.' };
        branchData.name = n;
    }
    if (patch.isActive !== undefined) branchData.isActive = patch.isActive;
    if (Object.keys(branchData).length > 0) {
        await db.branch.update({ where: { id: branchId }, data: branchData });
    }

    // Datos de la config (upsert por branchId).
    const cfgData: Record<string, unknown> = {};
    if (patch.lat !== undefined) cfgData.lat = patch.lat;
    if (patch.lon !== undefined) cfgData.lon = patch.lon;
    if (patch.printerStation !== undefined) cfgData.printerStation = patch.printerStation?.trim() || null;
    if (patch.whatsappGroup !== undefined) cfgData.whatsappGroup = patch.whatsappGroup?.trim() || null;
    if (patch.managerUserId !== undefined) cfgData.managerUserId = patch.managerUserId || null;

    if (Object.keys(cfgData).length > 0) {
        const cfg = await db.branchDeliveryConfig.findFirst({
            where: { branchId },
            select: { id: true },
        });
        if (cfg) {
            await db.branchDeliveryConfig.update({ where: { id: cfg.id }, data: cfgData });
        } else {
            await db.branchDeliveryConfig.create({
                data: { tenantId: g.tenantId, branchId, ...cfgData },
            });
        }
    }

    revalidatePath('/dashboard/delivery/sedes');
    return { success: true };
}

export async function addDeliveryZoneAction(
    branchId: string,
    name: string,
): Promise<{ success: boolean; message?: string }> {
    const g = await deliveryGuard();
    if (!g.ok) return { success: false, message: g.message };
    const zoneName = name?.trim();
    if (!zoneName) return { success: false, message: 'El nombre de la zona es obligatorio.' };
    const db = withTenant(g.tenantId);

    const branch = await db.branch.findFirst({ where: { id: branchId }, select: { id: true } });
    if (!branch) return { success: false, message: 'Sede no encontrada.' };

    const dup = await db.deliveryZone.findFirst({ where: { branchId, name: zoneName }, select: { id: true } });
    if (dup) return { success: false, message: 'Esa zona ya existe en la sede.' };

    await db.deliveryZone.create({ data: { tenantId: g.tenantId, branchId, name: zoneName } });
    revalidatePath('/dashboard/delivery/sedes');
    return { success: true };
}

export async function removeDeliveryZoneAction(
    zoneId: string,
): Promise<{ success: boolean; message?: string }> {
    const g = await deliveryGuard();
    if (!g.ok) return { success: false, message: g.message };
    const db = withTenant(g.tenantId);
    const zone = await db.deliveryZone.findFirst({ where: { id: zoneId }, select: { id: true } });
    if (!zone) return { success: false, message: 'Zona no encontrada.' };
    await db.deliveryZone.delete({ where: { id: zoneId } });
    revalidatePath('/dashboard/delivery/sedes');
    return { success: true };
}
