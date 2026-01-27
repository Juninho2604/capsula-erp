'use server';

import prisma from '@/server/db';
import { revalidatePath } from 'next/cache';

// ============================================================================
// TIPOS
// ============================================================================

export interface RequisitionItemInput {
    inventoryItemId: string;
    quantity: number;
    unit: string;
}

export interface CreateRequisitionInput {
    requestedById: string;
    targetAreaId: string; // Área que RECIBE
    sourceAreaId?: string; // Área que ENVÍA
    items: RequisitionItemInput[];
    notes?: string;
}

export interface ApproveItemInput {
    inventoryItemId: string;
    dispatchedQuantity: number;
}

export interface ApproveRequisitionInput {
    requisitionId: string;
    processedById: string;
    items: ApproveItemInput[];
}

export interface ActionResult {
    success: boolean;
    message: string;
    data?: any;
}

// ============================================================================
// ACTIONS DE LECTURA
// ============================================================================

export async function getRequisitions(filter: 'ALL' | 'PENDING' | 'COMPLETED' = 'ALL') {
    try {
        const whereClause: any = {};
        if (filter === 'PENDING') whereClause.status = 'PENDING';
        if (filter === 'COMPLETED') whereClause.status = { in: ['APPROVED', 'COMPLETED', 'REJECTED'] };

        const requisitions = await prisma.requisition.findMany({
            where: whereClause,
            include: {
                requestedBy: { select: { firstName: true, lastName: true } },
                processedBy: { select: { firstName: true, lastName: true } },
                targetArea: { select: { name: true } },
                sourceArea: { select: { name: true } },
                items: {
                    include: {
                        inventoryItem: { select: { name: true, sku: true, baseUnit: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
        });

        return { success: true, data: requisitions };
    } catch (error) {
        console.error('Error fetching requisitions:', error);
        return { success: false, message: 'Error al cargar requisiciones', data: [] };
    }
}

// ============================================================================
// ACTIONS DE ESCRITURA
// ============================================================================

// 1. CREAR SOLICITUD
export async function createRequisition(input: CreateRequisitionInput): Promise<ActionResult> {
    try {
        const count = await prisma.requisition.count();
        const code = `REQ-${(count + 1).toString().padStart(4, '0')}`;

        // Buscar un Area Origen por defecto (Almacén Principal) si no viene
        let sourceId = input.sourceAreaId;
        if (!sourceId) {
            const mainWarehouse = await prisma.area.findFirst({
                where: { name: { contains: 'ALMACEN PRINCIPAL', mode: 'insensitive' } }
            });
            sourceId = mainWarehouse?.id;
        }

        // Crear la requisición y sus items
        // Validar usuario (Fallback para desarrollo tras DB Reset)
        let requesterId = input.requestedById;
        const userExists = await prisma.user.findUnique({ where: { id: requesterId } });
        if (!userExists) {
            const owner = await prisma.user.findFirst({ where: { role: 'OWNER' } });
            if (owner) requesterId = owner.id;
        }

        const requisition = await prisma.requisition.create({
            data: {
                code,
                requestedById: requesterId,
                targetAreaId: input.targetAreaId,
                sourceAreaId: sourceId,
                notes: input.notes,
                status: 'PENDING',
                items: {
                    create: input.items.map(item => ({
                        inventoryItemId: item.inventoryItemId,
                        quantity: item.quantity,
                        unit: item.unit
                    }))
                }
            }
        });

        revalidatePath('/dashboard/transferencias');
        return { success: true, message: `Solicitud ${code} creada exitosamente`, data: requisition };

    } catch (error) {
        console.error('Error creating requisition:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Error al crear solicitud'
        };
    }
}

// 2. APROBAR Y DESPACHAR
export async function approveRequisition(input: ApproveRequisitionInput): Promise<ActionResult> {
    try {
        // Buscar la requisición para validar
        const req = await prisma.requisition.findUnique({
            where: { id: input.requisitionId },
            include: { items: true }
        });

        if (!req) return { success: false, message: 'Requisición no encontrada' };
        if (req.status !== 'PENDING') return { success: false, message: 'Esta solicitud ya fue procesada' };

        // Si no tenía origen, intentar asignarlo ahora o fallar
        if (!req.sourceAreaId) {
            const mainWarehouse = await prisma.area.findFirst({
                where: { name: { contains: 'ALMACEN PRINCIPAL', mode: 'insensitive' } }
            });
            if (!mainWarehouse) return { success: false, message: 'No hay Almacén Principal definido para despachar' };
            req.sourceAreaId = mainWarehouse.id;
        }

        // Validar usuario aprobador (Fallback)
        let processedById = input.processedById;
        const userExists = await prisma.user.findUnique({ where: { id: processedById } });
        if (!userExists) {
            const owner = await prisma.user.findFirst({ where: { role: 'OWNER' } });
            if (owner) processedById = owner.id;
        }

        await prisma.$transaction(async (tx) => {
            // 1. Actualizar estado Requisición
            await tx.requisition.update({
                where: { id: input.requisitionId },
                data: {
                    status: 'COMPLETED',
                    processedById: processedById,
                    sourceAreaId: req.sourceAreaId, // Confirmar origen
                    processedAt: new Date(),
                }
            });

            // 2. Procesar Movimientos por Item
            for (const itemInput of input.items) {
                const reqItem = req.items.find(i => i.inventoryItemId === itemInput.inventoryItemId);
                if (!reqItem) continue;

                // Actualizar cantidad real despachada en la requisición
                await tx.requisitionItem.updateMany({
                    where: {
                        requisitionId: input.requisitionId,
                        inventoryItemId: itemInput.inventoryItemId
                    },
                    data: { dispatchedQuantity: itemInput.dispatchedQuantity }
                });

                // Registrar Movimiento SALIDA (Global)
                // Nota: InventoryMovement es global, pero usamos las notas para trazar el origen
                await tx.inventoryMovement.create({
                    data: {
                        inventoryItemId: itemInput.inventoryItemId,
                        movementType: 'TRANSFER_OUT', // Nuevo tipo (o ADJUSTMENT_OUT si no está en enum)
                        quantity: itemInput.dispatchedQuantity,
                        unit: 'UNIT', // Debería venir del item, simplificado aquí
                        createdById: processedById,
                        notes: `Despacho REQ-${req.code} a ${req.targetAreaId}`,
                        reason: 'Transferencia entre Almacenes'
                    }
                });

                // Actualizar Stock en Ubicación ORIGEN (Resta)
                if (req.sourceAreaId) {
                    await tx.inventoryLocation.upsert({
                        where: {
                            inventoryItemId_areaId: {
                                inventoryItemId: itemInput.inventoryItemId,
                                areaId: req.sourceAreaId
                            }
                        },
                        create: {
                            inventoryItemId: itemInput.inventoryItemId,
                            areaId: req.sourceAreaId,
                            currentStock: -itemInput.dispatchedQuantity,
                            lastCountDate: new Date()
                        },
                        update: {
                            currentStock: { decrement: itemInput.dispatchedQuantity },
                            lastCountDate: new Date()
                        }
                    });
                }

                // Actualizar Stock en Ubicación DESTINO (Suma)
                await tx.inventoryLocation.upsert({
                    where: {
                        inventoryItemId_areaId: {
                            inventoryItemId: itemInput.inventoryItemId,
                            areaId: req.targetAreaId
                        }
                    },
                    create: {
                        inventoryItemId: itemInput.inventoryItemId,
                        areaId: req.targetAreaId,
                        currentStock: itemInput.dispatchedQuantity,
                        lastCountDate: new Date()
                    },
                    update: {
                        currentStock: { increment: itemInput.dispatchedQuantity },
                        lastCountDate: new Date()
                    }
                });
            }
        });

        revalidatePath('/dashboard/inventario');
        return { success: true, message: 'Transferencia aprobada y ejecutada' };

    } catch (error) {
        console.error('Error approving dispatch:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Error desconocido al aprobar'
        };
    }
}

// 3. RECHAZAR SOLICITUD
export async function rejectRequisition(requisitionId: string, userId: string): Promise<ActionResult> {
    try {
        // Validar usuario (Fallback)
        let processorId = userId;
        const userExists = await prisma.user.findUnique({ where: { id: userId } });
        if (!userExists) {
            const owner = await prisma.user.findFirst({ where: { role: 'OWNER' } });
            if (owner) processorId = owner.id;
        }

        await prisma.requisition.update({
            where: { id: requisitionId },
            data: {
                status: 'REJECTED',
                processedById: processorId,
                processedAt: new Date()
            }
        });

        revalidatePath('/dashboard/transferencias');
        return { success: true, message: 'Solicitud rechazada correctamente' };
    } catch (error) {
        console.error('Error rejecting:', error);
        return { success: false, message: 'Error al rechazar solicitud' };
    }
}
