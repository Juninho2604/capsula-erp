'use server';

import prisma from '@/server/db';
import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import { getSession } from '@/lib/auth';
import { getCaracasDayRange, getCaracasNowParts } from '@/lib/datetime';
import { revenueWhere, propinasWhere } from '@/lib/sales-where';
import { hasPermission } from '@/lib/permissions/has-permission';
import { PERM, ROLE_BASE_PERMS } from '@/lib/constants/permissions-registry';

// ============================================================================
// TIPOS
// ============================================================================

export interface EstadisticasData {
  role: string;
  userName: string;
  today: {
    revenue: number;
    orders: number;
    discounts: number;
    voided: number;
    avgTicket: number;
  };
  yesterday: {
    revenue: number;
    orders: number;
  };
  month: {
    revenue: number;
    orders: number;
  };
  paymentBreakdown: { method: string; total: number; count: number }[];
  topItems: { name: string; quantity: number; revenue: number }[];
  openTabs: { count: number; totalExposed: number };
  propinasHoy: { total: number; count: number };
  lowStockAlerts: { name: string; sku: string; currentStock: number; minimumStock: number; unit: string }[];
  discountBreakdown: { type: string; total: number; count: number; authorizedBy: string | null }[];
  voidedOrders: { orderNumber: string; total: number; reason: string; voidedBy: string; time: string }[];
  kitchenPending: { orderNumber: string; tableName: string; itemCount: number; sentAt: string }[];
  productionToday: { recipe: string; quantity: number; unit: string; status: string }[];
  myStats: { revenue: number; orders: number; avgTicket: number };
  inventoryVariances: { name: string; variance: number; unit: string; date: string }[];
}

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================

export async function getEstadisticasAction(): Promise<{ success: boolean; data?: EstadisticasData; message?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, message: 'No autorizado' };

    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);

    const role = session.role;
    const userId = session.id;

    // Rangos de fecha en zona horaria Caracas (UTC-4)
    const { start: todayStart, end: todayEnd } = getCaracasDayRange();
    const { start: yesterdayStart, end: yesterdayEnd } = getCaracasDayRange(new Date(Date.now() - 86400000));
    const { year: _cy, month: _cm } = getCaracasNowParts();
    const monthStart = new Date(Date.UTC(_cy, _cm, 1, 4, 0, 0, 0));

    const isCashier = role === 'CASHIER' || role === 'WAITER';
    const isChef = role === 'CHEF' || role === 'KITCHEN_CHEF';
    const isAuditor = role === 'AUDITOR';
    const isAdmin = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AREA_LEAD'].includes(role);
    // Gate financiero NO regresivo (Fase 3b — §66.3): reemplaza los gates
    // PURAMENTE financieros `isAdmin || isAuditor`. Los roles con VIEW_FINANCES
    // por base (OWNER/ADMIN_MANAGER/AUDITOR) respetan lo configurado en
    // /dashboard/usuarios (módulos + revoke); los que NO la tienen por base
    // (OPS_MANAGER/AREA_LEAD) conservan el acceso histórico → sin regresión.
    // Los gates operativos (stock, cocina, producción, top items) NO se tocan.
    const permUser = {
      role,
      allowedModules: session.allowedModules ?? null,
      grantedPerms: session.grantedPerms ?? null,
      revokedPerms: session.revokedPerms ?? null,
    };
    const baseHasFinance = (ROLE_BASE_PERMS[role] ?? []).includes(PERM.VIEW_FINANCES);
    const showFinance = (isAdmin || isAuditor) && (!baseHasFinance || hasPermission(permUser, PERM.VIEW_FINANCES));

    // ── Queries paralelas base (todos los roles) ─────────────────────────────
    const [
      todayAgg,
      yesterdayAgg,
      monthAgg,
      openTabsAgg,
      lowStockItems,
      propinasHoyAgg,
    ] = await Promise.all([
      // Ventas hoy
      db.salesOrder.aggregate({
        where: {
          ...revenueWhere(todayStart, todayEnd),
          ...(isCashier ? { createdById: userId } : {}),
        },
        _sum: { total: true, discount: true },
        _count: { id: true },
      }),
      // Ventas ayer (solo admin+)
      showFinance
        ? db.salesOrder.aggregate({
            where: revenueWhere(yesterdayStart, yesterdayEnd),
            _sum: { total: true },
            _count: { id: true },
          })
        : Promise.resolve({ _sum: { total: null }, _count: { id: 0 } }),
      // Ventas mes (rango abierto hasta ahora)
      showFinance
        ? db.salesOrder.aggregate({
            where: {
              status: { not: 'CANCELLED' },
              customerName: { not: 'PROPINA COLECTIVA' },
              createdAt: { gte: monthStart },
            },
            _sum: { total: true },
            _count: { id: true },
          })
        : Promise.resolve({ _sum: { total: null }, _count: { id: 0 } }),
      // Cuentas abiertas
      showFinance
        ? db.openTab.aggregate({
            where: { status: 'OPEN' },
            _count: { id: true },
            _sum: { balanceDue: true },
          })
        : Promise.resolve({ _count: { id: 0 }, _sum: { balanceDue: null } }),
      // Stock bajo
      isAdmin || isAuditor || isChef
        ? db.inventoryItem.findMany({
            where: { isActive: true },
            include: {
              stockLevels: { take: 1 },
            },
          }).then((items) =>
            items
              .filter((i) => {
                const stock = i.stockLevels.reduce((s, l) => s + Number(l.currentStock || 0), 0);
                return stock <= Number(i.minimumStock);
              })
              .slice(0, 8)
              .map((i) => ({
                name: i.name,
                sku: i.sku,
                currentStock: i.stockLevels.reduce((s, l) => s + Number(l.currentStock || 0), 0),
                minimumStock: Number(i.minimumStock),
                unit: i.baseUnit,
              }))
          )
        : Promise.resolve([]),
      // Propinas colectivas hoy (admin + auditor)
      showFinance
        ? db.salesOrder.aggregate({
            where: propinasWhere(todayStart, todayEnd),
            _sum: { total: true },
            _count: { id: true },
          })
        : Promise.resolve({ _sum: { total: null }, _count: { id: 0 } }),
    ]);

    // ── Queries adicionales según rol ─────────────────────────────────────────
    const [
      paymentBreakdown,
      topItems,
      discountBreakdown,
      voidedOrders,
      kitchenPending,
      productionToday,
      myStats,
      inventoryVariances,
    ] = await Promise.all([
      // Breakdown por método de pago (admin + auditor)
      showFinance
        ? db.salesOrder.groupBy({
            by: ['paymentMethod'],
            where: {
              ...revenueWhere(todayStart, todayEnd),
              paymentMethod: { not: null },
            },
            _sum: { total: true },
            _count: { id: true },
          }).then((rows) =>
            rows.map((r) => ({
              method: r.paymentMethod || 'DESCONOCIDO',
              total: Number(r._sum.total || 0),
              count: r._count.id,
            }))
          )
        : Promise.resolve([]),

      // Top 5 items del día (admin + chef)
      isAdmin || isChef
        ? db.salesOrderItem.groupBy({
            by: ['menuItemId', 'itemName'],
            where: {
              order: {
                createdAt: { gte: todayStart, lte: todayEnd },
                status: { not: 'CANCELLED' },
              },
            },
            _sum: { quantity: true, lineTotal: true },
            orderBy: { _sum: { quantity: 'desc' } },
            take: 5,
          }).then((rows) =>
            rows.map((r) => ({
              name: r.itemName,
              quantity: Number(r._sum?.quantity ?? 0),
              revenue: Number(r._sum?.lineTotal ?? 0),
            }))
          )
        : Promise.resolve([]),

      // Breakdown de descuentos hoy (admin + auditor)
      showFinance
        ? db.salesOrder.findMany({
            where: {
              createdAt: { gte: todayStart, lte: todayEnd },
              discountType: { not: 'NONE' },
            },
            include: { authorizedBy: { select: { firstName: true, lastName: true } } },
          }).then((orders) => {
            const grouped: Record<string, { total: number; count: number; authorizedBy: string | null }> = {};
            for (const o of orders) {
              const key = o.discountType || 'NONE';
              if (!grouped[key]) grouped[key] = { total: 0, count: 0, authorizedBy: null };
              grouped[key].total += Number(o.discount || 0);
              grouped[key].count += 1;
              grouped[key].authorizedBy = o.authorizedBy
                ? `${o.authorizedBy.firstName} ${o.authorizedBy.lastName}`
                : null;
            }
            return Object.entries(grouped).map(([type, v]) => ({ type, ...v }));
          })
        : Promise.resolve([]),

      // Órdenes anuladas hoy (auditor + admin)
      showFinance
        ? db.salesOrder.findMany({
            where: {
              voidedAt: { gte: todayStart, lte: todayEnd },
            },
            include: { voidedBy: { select: { firstName: true, lastName: true } } },
            orderBy: { voidedAt: 'desc' },
            take: 10,
          }).then((orders) =>
            orders.map((o) => ({
              orderNumber: o.orderNumber,
              total: Number(o.total || 0),
              reason: o.voidReason || 'Sin razón especificada',
              voidedBy: o.voidedBy ? `${o.voidedBy.firstName} ${o.voidedBy.lastName}` : 'Sistema',
              time: o.voidedAt ? new Date(o.voidedAt).toLocaleTimeString('es-VE', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit' }) : '',
            }))
          )
        : Promise.resolve([]),

      // Pedidos en cocina pendientes (chef + admin)
      isChef || isAdmin
        ? db.salesOrder.findMany({
            where: {
              kitchenStatus: 'SENT',
              status: { not: 'CANCELLED' },
            },
            include: {
              tableOrStation: { select: { name: true } },
              items: { select: { itemName: true } },
            },
            orderBy: { sentToKitchenAt: 'asc' },
            take: 10,
          }).then((orders) =>
            orders.map((o) => ({
              orderNumber: o.orderNumber,
              tableName: o.tableOrStation?.name || o.customerName || 'Mesa',
              itemCount: o.items.length,
              sentAt: o.sentToKitchenAt
                ? new Date(o.sentToKitchenAt).toLocaleTimeString('es-VE', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit' })
                : '',
            }))
          )
        : Promise.resolve([]),

      // Producción hoy (chef + admin)
      isChef || isAdmin
        ? db.productionOrder.findMany({
            where: {
              createdAt: { gte: todayStart, lte: todayEnd },
            },
            include: { recipe: { select: { name: true } } },
            orderBy: { createdAt: 'desc' },
            take: 8,
          }).then((orders) =>
            orders.map((o) => ({
              recipe: o.recipe?.name || o.notes || 'Producción manual',
              quantity: Number(o.actualQuantity || o.plannedQuantity || 0),
              unit: o.unit,
              status: o.status,
            }))
          )
        : Promise.resolve([]),

      // Mis ventas hoy (cashier)
      isCashier
        ? db.salesOrder.aggregate({
            where: {
              ...revenueWhere(todayStart, todayEnd),
              createdById: userId,
            },
            _sum: { total: true },
            _count: { id: true },
          }).then((agg) => ({
            revenue: Number(agg._sum.total || 0),
            orders: agg._count.id,
            avgTicket: agg._count.id > 0 ? Number(agg._sum.total || 0) / agg._count.id : 0,
          }))
        : Promise.resolve({ revenue: 0, orders: 0, avgTicket: 0 }),

      // Variaciones de inventario recientes (auditor)
      // InventoryMovement no es tenant-aware; filtramos por inventoryItem.tenantId.
      isAuditor
        ? prisma.inventoryMovement.findMany({
            where: {
              movementType: { in: ['ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'ADJUSTMENT'] },
              createdAt: { gte: monthStart },
              inventoryItem: { tenantId },
            },
            include: { inventoryItem: { select: { name: true, baseUnit: true } } },
            orderBy: { createdAt: 'desc' },
            take: 10,
          }).then((movements) =>
            movements.map((m) => ({
              name: m.inventoryItem?.name || 'Item',
              variance: Number(m.quantity || 0),
              unit: m.unit || m.inventoryItem?.baseUnit || '',
              date: new Date(m.createdAt).toLocaleDateString('es-VE', { timeZone: 'America/Caracas' }),
            }))
          )
        : Promise.resolve([]),
    ]);

    const todayRevenue = Number(todayAgg._sum.total || 0);
    const todayOrders = todayAgg._count.id;

    return {
      success: true,
      data: {
        role,
        userName: `${session.firstName} ${session.lastName}`,
        today: {
          // Campos financieros del día: solo si el usuario puede ver finanzas
          // (único consumidor en UI: AuditorView). `voided` ya sigue a
          // voidedOrders (gateado). isCashier conserva su propia vista (su
          // todayAgg ya viene filtrado por createdById). Sin regresión: OPS/
          // AREA_LEAD mantienen showFinance=true; CHEF no muestra `today`.
          revenue: showFinance || isCashier ? todayRevenue : 0,
          orders: showFinance || isCashier ? todayOrders : 0,
          discounts: showFinance ? Number(todayAgg._sum.discount || 0) : 0,
          voided: voidedOrders.length,
          avgTicket: (showFinance || isCashier) && todayOrders > 0 ? todayRevenue / todayOrders : 0,
        },
        yesterday: {
          revenue: Number(yesterdayAgg._sum.total || 0),
          orders: yesterdayAgg._count.id,
        },
        month: {
          revenue: Number(monthAgg._sum.total || 0),
          orders: monthAgg._count.id,
        },
        paymentBreakdown,
        topItems,
        openTabs: {
          count: openTabsAgg._count.id,
          totalExposed: Number(openTabsAgg._sum.balanceDue || 0),
        },
        propinasHoy: {
          total: Number(propinasHoyAgg._sum.total || 0),
          count: propinasHoyAgg._count.id,
        },
        lowStockAlerts: lowStockItems,
        discountBreakdown,
        voidedOrders,
        kitchenPending,
        productionToday,
        myStats,
        inventoryVariances,
      },
    };
  } catch (error) {
    console.error('[estadisticas] Error:', error);
    return { success: false, message: 'Error cargando estadísticas' };
  }
}
