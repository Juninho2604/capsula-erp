'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/server/db';
import { getSession } from '@/lib/auth';

export interface CreateAuditInput {
    name: string;
    notes?: string;
    areaId?: string;
    items: {
        inventoryItemId: string;
        countedStock: number;
    }[];
}

export interface UpdateAuditItemInput {
    itemId: string; // Audit Item ID
    countedStock: number;
    notes?: string;
}

export interface ApproveAuditInput {
    auditId: string;
}

// --- Getters ---

export async function getAuditsAction() {
    try {
        const audits = await prisma.inventoryAudit.findMany({
            include: {
                createdBy: { select: { firstName: true, lastName: true } },
                resolvedBy: { select: { firstName: true, lastName: true } },
                _count: { select: { items: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        return audits;
    } catch (error) {
        console.error('Error fetching audits:', error);
        return [];
    }
}

export async function getAuditAction(id: string) {
    try {
        const audit = await prisma.inventoryAudit.findUnique({
            where: { id },
            include: {
                createdBy: { select: { firstName: true, lastName: true } },
                resolvedBy: { select: { firstName: true, lastName: true } },
                items: {
                    include: {
                        inventoryItem: true
                    },
                    orderBy: { inventoryItem: { name: 'asc' } }
                }
            }
        });
        return audit;
    } catch (error) {
        console.error('Error fetching audit:', error);
        return null;
    }
}

// --- Mutations ---

export async function createAuditAction(input: CreateAuditInput) {
    const session = await getSession();
    if (!session?.id) return { success: false, message: 'No autorizado' };
    const userId = session.id;

    try {
        const result = await prisma.$transaction(async (tx) => {
            // 1. Create Audit Header
            const audit = await tx.inventoryAudit.create({
                data: {
                    name: input.name,
                    notes: input.notes,
                    areaId: input.areaId,
                    status: 'DRAFT',
                    createdById: userId
                }
            });

            // 2. Optimization: Fetch all items in one query
            const itemIds = input.items.map(i => i.inventoryItemId);
            const dbItems = await tx.inventoryItem.findMany({
                where: { id: { in: itemIds } },
                include: {
                    stockLevels: true,
                    costHistory: { orderBy: { effectiveFrom: 'desc' }, take: 1 }
                }
            });

            const dbItemsMap = new Map(dbItems.map(i => [i.id, i]));
            const auditItemsData = [];

            for (const itemInput of input.items) {
                const dbItem = dbItemsMap.get(itemInput.inventoryItemId);
                if (!dbItem) continue;

                let systemStock = 0;
                if (input.areaId) {
                    const loc = dbItem.stockLevels.find(l => l.areaId === input.areaId);
                    systemStock = loc ? loc.currentStock : 0;
                } else {
                    systemStock = dbItem.stockLevels.reduce((acc, loc) => acc + loc.currentStock, 0);
                }

                const costSnapshot = dbItem.costHistory[0]?.costPerUnit || 0;

                auditItemsData.push({
                    auditId: audit.id,
                    inventoryItemId: itemInput.inventoryItemId,
                    systemStock: systemStock,
                    countedStock: itemInput.countedStock,
                    difference: itemInput.countedStock - systemStock,
                    costSnapshot: costSnapshot
                });
            }

            if (auditItemsData.length > 0) {
                await tx.inventoryAuditItem.createMany({
                    data: auditItemsData
                });
            }

            return audit;
        }, { timeout: 30000 });

        revalidatePath('/dashboard/inventario');
        revalidatePath('/dashboard/inventario/auditorias');
        return { success: true, message: 'Auditoría creada correctamente', auditId: result.id };
    } catch (error) {
        console.error('Error creating audit:', error);
        return { success: false, message: `Error al crear auditoría: ${error instanceof Error ? error.message : JSON.stringify(error)}` };
    }
}

export async function updateAuditItemAction(input: UpdateAuditItemInput) {
    const session = await getSession();
    if (!session?.id) return { success: false, message: 'No autorizado' };

    try {
        const item = await prisma.inventoryAuditItem.findUnique({ where: { id: input.itemId }, include: { audit: true } });
        if (!item) return { success: false, message: 'Item no encontrado' };
        if (item.audit.status !== 'DRAFT') return { success: false, message: 'Auditoría cerrada' };

        const difference = input.countedStock - item.systemStock;

        await prisma.inventoryAuditItem.update({
            where: { id: input.itemId },
            data: {
                countedStock: input.countedStock,
                difference: difference,
                notes: input.notes
            }
        });

        revalidatePath(`/dashboard/inventario/auditorias`);
        return { success: true, message: 'Conteo actualizado' };
    } catch (error) {
        console.error('Error updating audit item:', error);
        return { success: false, message: 'Error al actualizar item' };
    }
}

export async function approveAuditAction(input: ApproveAuditInput) {
    const session = await getSession();
    if (!session?.id) return { success: false, message: 'No autorizado' };
    const userId = session.id;

    try {
        const result = await prisma.$transaction(async (tx) => {
            const audit = await tx.inventoryAudit.findUnique({
                where: { id: input.auditId },
                include: { items: true }
            });

            if (!audit) throw new Error("Auditoría no encontrada");
            if (audit.status !== 'DRAFT') throw new Error("La auditoría ya no está en borrador");

            await tx.inventoryAudit.update({
                where: { id: input.auditId },
                data: {
                    status: 'APPROVED',
                    resolvedAt: new Date(),
                    resolvedById: userId
                }
            });

            for (const item of audit.items) {
                if (Math.abs(item.difference) > 0.0001) {
                    const movementType = item.difference > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';

                    const movement = await tx.inventoryMovement.create({
                        data: {
                            inventoryItemId: item.inventoryItemId,
                            movementType: movementType as any,
                            quantity: Math.abs(item.difference),
                            unit: 'UNIT',
                            reason: `Auditoría: ${audit.name}`,
                            notes: `Ajuste automático por aprobación de auditoría #${audit.id}`,
                            createdById: userId,
                            totalCost: item.costSnapshot ? item.costSnapshot * Math.abs(item.difference) : 0
                        }
                    });

                    let targetAreaId = audit.areaId;
                    if (!targetAreaId) {
                        const mainArea = await tx.area.findFirst({ where: { name: 'Almacén Principal' } });
                        if (mainArea) targetAreaId = mainArea.id;
                    }

                    if (targetAreaId) {
                        await tx.inventoryLocation.upsert({
                            where: {
                                inventoryItemId_areaId: {
                                    inventoryItemId: item.inventoryItemId,
                                    areaId: targetAreaId
                                }
                            },
                            create: {
                                inventoryItemId: item.inventoryItemId,
                                areaId: targetAreaId,
                                currentStock: item.countedStock
                            },
                            update: {
                                currentStock: { increment: item.difference }
                            }
                        });
                    }
                }
            }
            return audit;
        }, { timeout: 30000 });

        revalidatePath('/dashboard/inventario');
        revalidatePath('/dashboard/inventario/auditorias');
        revalidatePath('/dashboard');
        return { success: true, message: 'Auditoría aprobada y stock actualizado' };

    } catch (error) {
        console.error('Error approving audit:', error);
        return { success: false, message: `Error: ${error instanceof Error ? error.message : 'Desconocido'}` };
    }
}

export async function rejectAuditAction(auditId: string) {
    const session = await getSession();
    if (!session?.id) return { success: false };

    try {
        await prisma.inventoryAudit.update({
            where: { id: auditId },
            data: { status: 'REJECTED' }
        });
        revalidatePath('/dashboard/inventario/auditorias');
        return { success: true };
    } catch (error) {
        return { success: false };
    }
}

export async function voidAuditAction(auditId: string) {
    const session = await getSession();
    if (!session?.id) return { success: false, message: 'Usuario no encontrado' };
    const userId = session.id;

    const allowedRoles = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AUDITOR'];
    if (!allowedRoles.includes(session.role)) {
        return { success: false, message: 'No tienes permisos para anular auditorías (Solo Gerencia/Auditores)' };
    }

    try {
        const result = await prisma.$transaction(async (tx) => {
            const audit = await tx.inventoryAudit.findUnique({
                where: { id: auditId },
                include: { items: true }
            });

            if (!audit) throw new Error("Auditoría no encontrada");
            if (audit.status !== 'APPROVED') throw new Error("Solo se pueden anular auditorías aprobadas");

            await tx.inventoryAudit.update({
                where: { id: auditId },
                data: {
                    status: 'VOIDED',
                    notes: (audit.notes || '') + `\n[ANULADO] por usuario ${session.firstName || 'Usuario'} el ${new Date().toLocaleString()}`
                }
            });

            for (const item of audit.items) {
                if (Math.abs(item.difference) > 0.0001) {
                    const reversalType = item.difference > 0 ? 'ADJUSTMENT_OUT' : 'ADJUSTMENT_IN';
                    const qty = Math.abs(item.difference);

                    await tx.inventoryMovement.create({
                        data: {
                            inventoryItemId: item.inventoryItemId,
                            movementType: reversalType as any,
                            quantity: qty,
                            unit: 'UNIT',
                            reason: `Anulación Auditoría: ${audit.name}`,
                            notes: `Reversión automática de auditoría #${audit.id}`,
                            createdById: userId,
                            totalCost: item.costSnapshot ? item.costSnapshot * qty : 0
                        }
                    });

                    let targetAreaId = audit.areaId;
                    if (!targetAreaId) {
                        const mainArea = await tx.area.findFirst({ where: { name: 'Almacén Principal' } });
                        if (mainArea) targetAreaId = mainArea.id;
                    }

                    if (targetAreaId) {
                        await tx.inventoryLocation.updateMany({
                            where: {
                                inventoryItemId: item.inventoryItemId,
                                areaId: targetAreaId
                            },
                            data: {
                                currentStock: { increment: -item.difference }
                            }
                        });
                    }
                }
            }
            return audit;
        });

        revalidatePath('/dashboard/inventario/auditorias');
        revalidatePath('/dashboard/inventario');
        revalidatePath('/dashboard');
        return { success: true, message: 'Auditoría anulada y stock revertido' };

    } catch (error) {
        console.error('Error voiding audit:', error);
        return { success: false, message: `Error: ${error instanceof Error ? error.message : 'Desconocido'}` };
    }
}

export async function deleteAuditAction(auditId: string) {
    const session = await getSession();
    if (!session?.id) return { success: false };

    try {
        await prisma.inventoryAudit.delete({
            where: { id: auditId }
        });
        revalidatePath('/dashboard/inventario/auditorias');
        return { success: true };
    } catch (error) {
        return { success: false };
    }
}
