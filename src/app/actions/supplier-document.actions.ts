'use server';

import { prisma } from '@/server/db';
import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { logAudit } from '@/lib/audit-log';
import { registrarEntradaMercancia } from './entrada.actions';

const READ_ROLES = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AUDITOR'];
const WRITE_ROLES = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'];

// ─── Tipos ────────────────────────────────────────────────────────────────

export interface SupplierDocumentItemInput {
  inventoryItemId: string;
  itemName: string;
  quantity: number;
  unit: string;
  unitCost: number;
}

export interface SupplierDocumentItemData extends SupplierDocumentItemInput {
  id: string;
  lineTotal: number;
}

export interface SupplierDocumentData {
  id: string;
  documentType: string;
  documentNumber: string;
  supplierId: string | null;
  supplierName: string | null;
  documentDate: Date;
  paymentCondition: string;
  totalAmount: number;
  currency: string;
  documentUrl: string | null;
  inventoryStatus: string;
  inventoryEnteredAt: Date | null;
  linkedPurchaseOrderId: string | null;
  accountPayableId: string | null;
  status: string;
  notes: string | null;
  createdAt: Date;
  items: SupplierDocumentItemData[];
}

function revalidate() {
  revalidatePath('/dashboard/compras/documentos');
  revalidatePath('/dashboard/cuentas-pagar');
  revalidatePath('/dashboard/inventario');
}

// ─── Lectura ──────────────────────────────────────────────────────────────

export async function getSupplierDocumentsAction(filters?: {
  status?: string;
  documentType?: string;
}): Promise<{ success: boolean; data?: SupplierDocumentData[]; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'No autorizado' };
  if (!READ_ROLES.includes(session.role)) return { success: false, error: 'Sin permisos' };

  try {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const docs = await db.supplierDocument.findMany({
      where: {
        ...(filters?.status && { status: filters.status }),
        ...(filters?.documentType && { documentType: filters.documentType }),
      },
      include: { items: true },
      orderBy: [{ documentDate: 'desc' }, { createdAt: 'desc' }],
      take: 300,
    });

    // §141 — documentos creados antes del fix: supplierId guardado pero
    // supplierName null → se mostraban "Sin proveedor". Se resuelve el nombre
    // al leer (supplierId es escalar, no relación, así que se mapea a mano).
    const missingIds = Array.from(new Set(
      docs.filter((d) => d.supplierId && !d.supplierName).map((d) => d.supplierId as string),
    ));
    const nameById = new Map<string, string>();
    if (missingIds.length > 0) {
      const sups = await db.supplier.findMany({
        where: { id: { in: missingIds } },
        select: { id: true, name: true },
      });
      for (const s of sups) nameById.set(s.id, s.name);
    }

    return {
      success: true,
      data: docs.map((d) => ({
        id: d.id,
        documentType: d.documentType,
        documentNumber: d.documentNumber,
        supplierId: d.supplierId,
        supplierName: d.supplierName ?? (d.supplierId ? nameById.get(d.supplierId) ?? null : null),
        documentDate: d.documentDate,
        paymentCondition: d.paymentCondition,
        totalAmount: d.totalAmount,
        currency: d.currency,
        documentUrl: d.documentUrl,
        inventoryStatus: d.inventoryStatus,
        inventoryEnteredAt: d.inventoryEnteredAt,
        linkedPurchaseOrderId: d.linkedPurchaseOrderId,
        accountPayableId: d.accountPayableId,
        status: d.status,
        notes: d.notes,
        createdAt: d.createdAt,
        items: d.items.map((i) => ({
          id: i.id, inventoryItemId: i.inventoryItemId, itemName: i.itemName,
          quantity: i.quantity, unit: i.unit, unitCost: i.unitCost, lineTotal: i.lineTotal,
        })),
      })),
    };
  } catch {
    return { success: false, error: 'Error al cargar documentos' };
  }
}

// ─── Crear ────────────────────────────────────────────────────────────────

export async function createSupplierDocumentAction(input: {
  documentType: string; // FACTURA | NOTA_ENTREGA
  documentNumber: string;
  supplierId?: string | null;
  supplierName?: string | null;
  documentDate: string;
  paymentCondition: string; // CONTADO | CREDITO
  currency?: string;
  /**
   * §108: moneda en la que el usuario TECLEÓ los costos. Si es 'BS', los
   * unitCost llegan en Bs y acá se convierten a USD con `exchangeRate`
   * (obligatoria en ese caso). El documento SIEMPRE se persiste en USD —
   * el costeo de inventario y las cuentas por pagar viven en USD — y la
   * tasa usada queda auditada en las notas.
   */
  inputCurrency?: 'USD' | 'BS';
  exchangeRate?: number;
  documentUrl?: string | null;
  notes?: string | null;
  items: SupplierDocumentItemInput[];
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'No autorizado' };
  if (!WRITE_ROLES.includes(session.role)) return { success: false, error: 'Sin permisos' };

  if (!input.documentNumber.trim()) return { success: false, error: 'El número de documento es obligatorio' };
  if (!['FACTURA', 'NOTA_ENTREGA'].includes(input.documentType)) return { success: false, error: 'Tipo de documento inválido' };
  if (!input.items || input.items.length === 0) return { success: false, error: 'Agrega al menos una línea' };
  const documentDate = new Date(input.documentDate);
  if (isNaN(documentDate.getTime())) return { success: false, error: 'Fecha inválida' };

  let items = input.items.filter((i) => i.inventoryItemId && i.quantity > 0);
  if (items.length === 0) return { success: false, error: 'Las líneas deben tener insumo y cantidad' };

  // §108: documento tecleado en Bs → convertir costos a USD a la tasa dada.
  const isBs = input.inputCurrency === 'BS';
  const bsRate = input.exchangeRate ?? 0;
  let bsNote: string | null = null;
  if (isBs) {
    if (!bsRate || bsRate <= 0) return { success: false, error: 'Indica una tasa Bs/USD válida para el documento en bolívares' };
    const totalBs = Math.round(items.reduce((s, i) => s + i.quantity * (i.unitCost || 0), 0) * 100) / 100;
    items = items.map((i) => ({ ...i, unitCost: (i.unitCost || 0) / bsRate }));
    bsNote = `Cargado en Bs a tasa ${bsRate} (total Bs ${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
  }

  const totalAmount = Math.round(items.reduce((s, i) => s + i.quantity * (i.unitCost || 0), 0) * 100) / 100;

  try {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);

    // §141 — el form manda supplierId SIN nombre cuando el proveedor es del
    // sistema, y la lista muestra solo supplierName → el documento salía
    // "Sin proveedor" aunque el id quedara bien guardado. Se denormaliza el
    // nombre acá (y de paso se valida ownership del proveedor).
    let resolvedSupplierName = input.supplierName?.trim() || null;
    if (input.supplierId) {
      const sup = await db.supplier.findFirst({
        where: { id: input.supplierId },
        select: { name: true },
      });
      if (!sup) return { success: false, error: 'Proveedor no encontrado' };
      resolvedSupplierName = sup.name;
    }

    const doc = await db.supplierDocument.create({
      data: {
        tenantId,
        documentType: input.documentType,
        documentNumber: input.documentNumber.trim(),
        supplierId: input.supplierId || null,
        supplierName: resolvedSupplierName,
        documentDate,
        paymentCondition: input.paymentCondition === 'CREDITO' ? 'CREDITO' : 'CONTADO',
        // §108: se persiste SIEMPRE en USD (los costos ya vienen convertidos).
        currency: 'USD',
        documentUrl: input.documentUrl?.trim() || null,
        totalAmount,
        notes: [input.notes?.trim(), bsNote].filter(Boolean).join(' · ') || null,
        createdById: session.id,
        items: {
          create: items.map((i) => ({
            inventoryItemId: i.inventoryItemId,
            itemName: i.itemName,
            quantity: i.quantity,
            unit: i.unit,
            unitCost: i.unitCost || 0,
            lineTotal: Math.round(i.quantity * (i.unitCost || 0) * 100) / 100,
          })),
        },
      },
    });

    await logAudit({
      userId: session.id, userName: `${session.firstName} ${session.lastName}`,
      userRole: session.role, action: 'CREATE', entityType: 'SupplierDocument',
      entityId: doc.id,
      description: `Registró ${input.documentType} ${doc.documentNumber} — $${totalAmount.toFixed(2)} (${doc.paymentCondition})`,
      module: 'CONFIG',
    });

    revalidate();
    return { success: true, id: doc.id };
  } catch {
    return { success: false, error: 'Error al crear el documento' };
  }
}

// ─── Editar (§141) ──────────────────────────────────────────────────────────

/**
 * Edita un documento SOLO mientras no haya propagado números: sin entrada al
 * inventario, sin cuenta por pagar y no anulado. Después de eso, editar
 * descuadraría inventario/CXP → se mantiene el flujo anular-y-recrear.
 *
 * Reemplaza encabezado y líneas completas (mismo input que crear). Evita
 * tener que remontar 14 ítems porque faltó una línea.
 */
export async function updateSupplierDocumentAction(input: {
  documentId: string;
  documentType: string;
  documentNumber: string;
  supplierId?: string | null;
  supplierName?: string | null;
  documentDate: string;
  paymentCondition: string;
  inputCurrency?: 'USD' | 'BS';
  exchangeRate?: number;
  documentUrl?: string | null;
  notes?: string | null;
  items: SupplierDocumentItemInput[];
}): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'No autorizado' };
  if (!WRITE_ROLES.includes(session.role)) return { success: false, error: 'Sin permisos' };

  if (!input.documentNumber.trim()) return { success: false, error: 'El número de documento es obligatorio' };
  if (!['FACTURA', 'NOTA_ENTREGA'].includes(input.documentType)) return { success: false, error: 'Tipo de documento inválido' };
  const documentDate = new Date(input.documentDate);
  if (isNaN(documentDate.getTime())) return { success: false, error: 'Fecha inválida' };

  let items = input.items.filter((i) => i.inventoryItemId && i.quantity > 0);
  if (items.length === 0) return { success: false, error: 'Las líneas deben tener insumo y cantidad' };

  const isBs = input.inputCurrency === 'BS';
  const bsRate = input.exchangeRate ?? 0;
  let bsNote: string | null = null;
  if (isBs) {
    if (!bsRate || bsRate <= 0) return { success: false, error: 'Indica una tasa Bs/USD válida para el documento en bolívares' };
    const totalBs = Math.round(items.reduce((s, i) => s + i.quantity * (i.unitCost || 0), 0) * 100) / 100;
    items = items.map((i) => ({ ...i, unitCost: (i.unitCost || 0) / bsRate }));
    bsNote = `Cargado en Bs a tasa ${bsRate} (total Bs ${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
  }
  const totalAmount = Math.round(items.reduce((s, i) => s + i.quantity * (i.unitCost || 0), 0) * 100) / 100;

  try {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);

    const doc = await db.supplierDocument.findFirst({ where: { id: input.documentId } });
    if (!doc) return { success: false, error: 'Documento no encontrado' };
    if (doc.status === 'VOID') return { success: false, error: 'El documento está anulado — no se puede editar' };
    if (doc.inventoryStatus === 'ENTERED') return { success: false, error: 'El documento ya entró al inventario — para corregirlo hay que anularlo y recrearlo' };
    if (doc.accountPayableId) return { success: false, error: 'El documento ya generó una cuenta por pagar — no se puede editar' };

    let resolvedSupplierName = input.supplierName?.trim() || null;
    if (input.supplierId) {
      const sup = await db.supplier.findFirst({
        where: { id: input.supplierId },
        select: { name: true },
      });
      if (!sup) return { success: false, error: 'Proveedor no encontrado' };
      resolvedSupplierName = sup.name;
    }

    // Ownership de los insumos de las líneas nuevas.
    const itemIds = Array.from(new Set(items.map((i) => i.inventoryItemId)));
    const owned = await db.inventoryItem.findMany({ where: { id: { in: itemIds } }, select: { id: true } });
    if (owned.length !== itemIds.length) return { success: false, error: 'Uno o más insumos no existen' };

    await prisma.$transaction(async (tx) => {
      // Re-chequeo del estado DENTRO de la tx: si alguien le dio entrada o
      // generó deuda mientras se editaba, abortamos en vez de descuadrar.
      const guard = await tx.supplierDocument.updateMany({
        where: {
          id: input.documentId,
          status: { not: 'VOID' },
          inventoryStatus: { not: 'ENTERED' },
          accountPayableId: null,
        },
        data: {
          documentType: input.documentType,
          documentNumber: input.documentNumber.trim(),
          supplierId: input.supplierId || null,
          supplierName: resolvedSupplierName,
          documentDate,
          paymentCondition: input.paymentCondition === 'CREDITO' ? 'CREDITO' : 'CONTADO',
          currency: 'USD',
          documentUrl: input.documentUrl?.trim() || null,
          totalAmount,
          notes: [input.notes?.trim(), bsNote].filter(Boolean).join(' · ') || null,
        },
      });
      if (guard.count === 0) {
        throw new Error('El documento cambió de estado mientras editabas — recargá y verificá antes de reintentar');
      }
      await tx.supplierDocumentItem.deleteMany({ where: { supplierDocumentId: input.documentId } });
      await tx.supplierDocumentItem.createMany({
        data: items.map((i) => ({
          supplierDocumentId: input.documentId,
          inventoryItemId: i.inventoryItemId,
          itemName: i.itemName,
          quantity: i.quantity,
          unit: i.unit,
          unitCost: i.unitCost || 0,
          lineTotal: Math.round(i.quantity * (i.unitCost || 0) * 100) / 100,
        })),
      });
    });

    await logAudit({
      userId: session.id, userName: `${session.firstName} ${session.lastName}`,
      userRole: session.role, action: 'UPDATE', entityType: 'SupplierDocument',
      entityId: input.documentId,
      description: `Editó ${input.documentType} ${input.documentNumber.trim()} — $${totalAmount.toFixed(2)} (antes: ${doc.documentNumber} $${doc.totalAmount.toFixed(2)})`,
      module: 'CONFIG',
    });

    revalidate();
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error al editar el documento' };
  }
}

// ─── Dar entrada al inventario ──────────────────────────────────────────────

export async function enterDocumentToInventoryAction(
  documentId: string,
  areaId: string
): Promise<{ success: boolean; error?: string; entered?: number }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'No autorizado' };
  if (!WRITE_ROLES.includes(session.role)) return { success: false, error: 'Sin permisos' };
  if (!areaId) return { success: false, error: 'Elige el área destino' };

  try {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const doc = await db.supplierDocument.findUnique({
      where: { id: documentId },
      include: { items: true },
    });
    if (!doc) return { success: false, error: 'Documento no encontrado' };
    if (doc.status === 'VOID') return { success: false, error: 'Documento anulado' };
    if (doc.inventoryStatus === 'ENTERED') return { success: false, error: 'Este documento ya entró al inventario' };
    if (doc.items.length === 0) return { success: false, error: 'El documento no tiene líneas' };

    // Reusa la lógica de entrada probada en producción, línea por línea.
    let entered = 0;
    for (const it of doc.items) {
      const res = await registrarEntradaMercancia({
        inventoryItemId: it.inventoryItemId,
        quantity: it.quantity,
        unit: it.unit,
        unitCost: it.unitCost,
        currency: doc.currency,
        supplierId: doc.supplierId ?? undefined,
        areaId,
        referenceNumber: doc.documentNumber,
        documentUrl: doc.documentUrl ?? undefined,
        documentType: doc.documentType,
        userId: session.id,
      });
      if (res.success) entered++;
      else console.error('[SUPPLIER_DOC] línea no entró:', it.itemName, res.message);
    }

    await db.supplierDocument.updateMany({
      where: { id: documentId },
      data: { inventoryStatus: 'ENTERED', inventoryEnteredAt: new Date() },
    });

    await logAudit({
      userId: session.id, userName: `${session.firstName} ${session.lastName}`,
      userRole: session.role, action: 'UPDATE', entityType: 'SupplierDocument',
      entityId: documentId,
      description: `Entrada a inventario de ${doc.documentNumber}: ${entered}/${doc.items.length} líneas`,
      module: 'CONFIG',
    });

    revalidate();
    return { success: true, entered };
  } catch {
    return { success: false, error: 'Error al dar entrada al inventario' };
  }
}

// ─── Vincular a orden de compra ─────────────────────────────────────────────

export async function linkDocumentToPurchaseOrderAction(
  documentId: string,
  purchaseOrderId: string | null
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'No autorizado' };
  if (!WRITE_ROLES.includes(session.role)) return { success: false, error: 'Sin permisos' };

  try {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    if (purchaseOrderId) {
      const po = await db.purchaseOrder.findFirst({ where: { id: purchaseOrderId }, select: { id: true } });
      if (!po) return { success: false, error: 'Orden de compra no encontrada' };
    }
    const res = await db.supplierDocument.updateMany({
      where: { id: documentId, status: { not: 'VOID' } },
      data: { linkedPurchaseOrderId: purchaseOrderId },
    });
    if (res.count === 0) return { success: false, error: 'Documento no encontrado o anulado' };

    await logAudit({
      userId: session.id, userName: `${session.firstName} ${session.lastName}`,
      userRole: session.role, action: 'UPDATE', entityType: 'SupplierDocument',
      entityId: documentId,
      description: purchaseOrderId ? `Vinculó documento a OC ${purchaseOrderId.slice(0, 8)}` : 'Desvinculó documento de OC',
      module: 'CONFIG',
    });
    revalidate();
    return { success: true };
  } catch {
    return { success: false, error: 'Error al vincular' };
  }
}

// ─── Generar cuenta por pagar ───────────────────────────────────────────────

export async function generatePayableFromDocumentAction(
  documentId: string,
  dueDate?: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'No autorizado' };
  if (!WRITE_ROLES.includes(session.role)) return { success: false, error: 'Sin permisos' };

  try {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const doc = await db.supplierDocument.findUnique({ where: { id: documentId } });
    if (!doc) return { success: false, error: 'Documento no encontrado' };
    if (doc.status === 'VOID') return { success: false, error: 'Documento anulado' };
    if (doc.accountPayableId) return { success: false, error: 'Este documento ya tiene una cuenta por pagar' };
    if (doc.totalAmount <= 0) return { success: false, error: 'El documento no tiene monto' };

    const payable = await db.accountPayable.create({
      data: {
        tenantId,
        description: `${doc.documentType} ${doc.documentNumber}${doc.supplierName ? ` — ${doc.supplierName}` : ''}`,
        invoiceNumber: doc.documentNumber,
        supplierId: doc.supplierId,
        creditorName: doc.supplierId ? null : doc.supplierName,
        totalAmountUsd: doc.totalAmount,
        paidAmountUsd: 0,
        remainingUsd: doc.totalAmount,
        invoiceDate: doc.documentDate,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: 'PENDING',
        createdById: session.id,
      },
    });

    await db.supplierDocument.updateMany({
      where: { id: documentId },
      data: { accountPayableId: payable.id },
    });

    await logAudit({
      userId: session.id, userName: `${session.firstName} ${session.lastName}`,
      userRole: session.role, action: 'CREATE', entityType: 'AccountPayable',
      entityId: payable.id,
      description: `Generó cuenta por pagar desde ${doc.documentNumber} — $${doc.totalAmount.toFixed(2)}`,
      module: 'CONFIG',
    });

    revalidate();
    revalidatePath('/dashboard/finanzas');
    return { success: true };
  } catch {
    return { success: false, error: 'Error al generar la cuenta por pagar' };
  }
}

export async function voidSupplierDocumentAction(
  documentId: string, reason: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'No autorizado' };
  if (!WRITE_ROLES.includes(session.role)) return { success: false, error: 'Sin permisos' };
  try {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    // No anulamos si ya entró a inventario (los movimientos no se revierten acá).
    const doc = await db.supplierDocument.findUnique({ where: { id: documentId } });
    if (!doc) return { success: false, error: 'Documento no encontrado' };
    if (doc.inventoryStatus === 'ENTERED') {
      return { success: false, error: 'No se puede anular: ya entró al inventario. Revertí el inventario aparte.' };
    }
    await db.supplierDocument.updateMany({ where: { id: documentId }, data: { status: 'VOID', notes: reason?.trim() || null } });
    await logAudit({
      userId: session.id, userName: `${session.firstName} ${session.lastName}`,
      userRole: session.role, action: 'VOID', entityType: 'SupplierDocument',
      entityId: documentId, description: `Anuló documento ${doc.documentNumber}: ${reason}`, module: 'CONFIG',
    });
    revalidate();
    return { success: true };
  } catch {
    return { success: false, error: 'Error al anular' };
  }
}

// ─── Reporte de conciliación (huérfanos) ────────────────────────────────────

export interface OrphanDocument {
  id: string; documentType: string; documentNumber: string;
  supplierName: string | null; documentDate: Date; totalAmount: number; paymentCondition: string;
}
export interface OrphanPurchaseOrder {
  id: string; orderNumber: string; orderName: string | null;
  supplierName: string | null; receivedDate: Date | null; totalAmount: number;
}

export async function getPurchaseReconciliationReportAction(): Promise<{
  success: boolean;
  data?: { orphanDocuments: OrphanDocument[]; orphanPurchaseOrders: OrphanPurchaseOrder[] };
  error?: string;
}> {
  const session = await getSession();
  if (!session) return { success: false, error: 'No autorizado' };
  if (!READ_ROLES.includes(session.role)) return { success: false, error: 'Sin permisos' };

  try {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);

    // Documentos sin entrada de inventario y sin OC vinculada.
    const docs = await db.supplierDocument.findMany({
      where: { status: 'ACTIVE', inventoryStatus: 'NOT_ENTERED', linkedPurchaseOrderId: null },
      orderBy: { documentDate: 'desc' },
      take: 200,
    });

    // OC recibidas sin ningún documento vinculado.
    const linkedDocs = await db.supplierDocument.findMany({
      where: { status: 'ACTIVE', linkedPurchaseOrderId: { not: null } },
      select: { linkedPurchaseOrderId: true },
    });
    const linkedPoIds = new Set(linkedDocs.map((d) => d.linkedPurchaseOrderId!).filter(Boolean));

    const receivedPOs = await db.purchaseOrder.findMany({
      where: { status: 'RECEIVED', deletedAt: null },
      select: {
        id: true, orderNumber: true, orderName: true, totalAmount: true, receivedDate: true,
        supplier: { select: { name: true } },
      },
      orderBy: { receivedDate: 'desc' },
      take: 300,
    });
    const orphanPOs = receivedPOs.filter((po) => !linkedPoIds.has(po.id));

    return {
      success: true,
      data: {
        orphanDocuments: docs.map((d) => ({
          id: d.id, documentType: d.documentType, documentNumber: d.documentNumber,
          supplierName: d.supplierName, documentDate: d.documentDate,
          totalAmount: d.totalAmount, paymentCondition: d.paymentCondition,
        })),
        orphanPurchaseOrders: orphanPOs.map((po) => ({
          id: po.id, orderNumber: po.orderNumber, orderName: po.orderName,
          supplierName: po.supplier?.name ?? null, receivedDate: po.receivedDate, totalAmount: po.totalAmount,
        })),
      },
    };
  } catch {
    return { success: false, error: 'Error al generar el reporte' };
  }
}
