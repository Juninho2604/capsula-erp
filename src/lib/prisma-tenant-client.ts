/**
 * Prisma client extendido con isolación automática por tenant.
 *
 * Devuelve un wrapper sobre el Prisma client estándar que inyecta
 * `tenantId` en todas las operaciones de los 42 modelos multi-tenant:
 *
 *   - findMany / findFirst / findFirstOrThrow / count / aggregate /
 *     groupBy / updateMany / deleteMany:
 *     añade `where.tenantId = X`
 *
 *   - create / createMany / upsert:
 *     añade `data.tenantId = X`
 *
 * NO se aplica a:
 *   - findUnique / findUniqueOrThrow / update / delete:
 *     el `where` es restringido a campos unique. Mientras los uniques
 *     sean globales (User.email, MenuItem.sku) no podemos forzar tenantId
 *     ahí. En Fase 2.B se cambian a uniques compuestos y se podrá ampliar.
 *
 * ESTADO: DORMANTE en este PR. Ningún server action lo importa todavía.
 * El cliente principal (@/server/db) sigue siendo el único usado en
 * runtime. Cuando active Fase 3 plena, las actions hacen
 * `const db = withTenant(tenantId)` y queries quedan filtradas auto.
 */

import 'server-only';
import { Prisma } from '@prisma/client';
import prisma from '@/server/db';

// ─── Modelos con tenantId (todos los que tienen el campo en schema.prisma) ─
//
// Los nombres son los devueltos por Prisma en `model` del callback
// $allOperations: PascalCase. Mantener sincronizado con schema.prisma.
const TENANT_MODELS = new Set<string>([
    'AccountPayable',
    'AccountPayment',
    'Area',
    'AuditLog',
    'Branch',
    'BroadcastMessage',
    'CashRegister',
    'Customer',
    'DailyInventory',
    'ExchangeRate',
    'Expense',
    'ExpenseCategory',
    'GameSession',
    'GameStation',
    'GameType',
    'IntercompanyItemMapping',
    'InventoryAudit',
    'InventoryAuditItem',
    'InventoryCycle',
    'InventoryItem',
    'InventoryLoan',
    'InvoiceCounter',
    'MenuCategory',
    'MenuItem',
    'MenuItemModifierGroup',
    'MenuModifier',
    'MenuModifierGroup',
    'OpenTab',
    'PrintJob',
    'ProcessingTemplateOutput',
    'ProductFamily',
    'ProductionOrder',
    'ProteinProcessing',
    'PurchaseOrder',
    'QueueTicket',
    'RateLimitBucket',
    'Recipe',
    'Requisition',
    'RequisitionItem',
    'Reservation',
    'SalesOrder',
    'SalesOrderItem',
    'SalesOrderPayment',
    'ServiceZone',
    'SkuCreationTemplate',
    'Supplier',
    'SupplierItem',
    'SystemConfig',
    'TableOrStation',
    'User',
    'Waiter',
    'WristbandPlan',
]);

/** Operaciones a las que se les inyecta tenantId en el `where`. */
const WHERE_OPS = new Set<string>([
    'findMany',
    'findFirst',
    'findFirstOrThrow',
    'count',
    'aggregate',
    'groupBy',
    'updateMany',
    'deleteMany',
]);

/** Operaciones a las que se les inyecta tenantId en el `data`. */
const DATA_OPS = new Set<string>([
    'create',
    'createMany',
    'createManyAndReturn',
]);

/** upsert se trata aparte: tiene where + create + update. */
const UPSERT_OP = 'upsert';

// ─── Función pura de inyección (testeable sin Prisma) ────────────────────────

/**
 * Mutation-free: devuelve nuevos args con tenantId inyectado donde corresponda.
 * Si el modelo no es multi-tenant o la operación no es soportada, devuelve
 * los args sin cambios.
 *
 * Exportada para tests unitarios; el cliente la usa internamente.
 */
export function injectTenantInArgs(
    model: string | undefined,
    operation: string,
    args: unknown,
    tenantId: string,
): unknown {
    if (!model || !TENANT_MODELS.has(model)) return args;
    if (typeof args !== 'object' || args === null) return args;

    const a = { ...(args as Record<string, unknown>) };

    if (WHERE_OPS.has(operation)) {
        a.where = { ...((a.where as object) ?? {}), tenantId };
        return a;
    }

    if (DATA_OPS.has(operation)) {
        if (Array.isArray(a.data)) {
            a.data = (a.data as Array<Record<string, unknown>>).map(d => ({ tenantId, ...d }));
        } else if (a.data && typeof a.data === 'object') {
            a.data = { tenantId, ...(a.data as object) };
        }
        return a;
    }

    if (operation === UPSERT_OP) {
        a.where = { ...((a.where as object) ?? {}), tenantId };
        if (a.create && typeof a.create === 'object') {
            a.create = { tenantId, ...(a.create as object) };
        }
        // El `update` de upsert NO necesita tenantId: el where ya filtró.
        return a;
    }

    // findUnique, update, delete, etc. → no tocamos (uniques globales).
    return args;
}

// ─── Cliente extendido ───────────────────────────────────────────────────────

/**
 * Devuelve un cliente Prisma extendido con filtro automático por tenant.
 *
 * Uso esperado (post-activación):
 *   const db = withTenant(ctx.tenant.tenantId);
 *   const items = await db.menuItem.findMany();
 *   // SQL ejecutado: SELECT ... FROM "MenuItem" WHERE "tenantId" = X
 *
 * El cliente original (`prisma`) sigue funcionando sin filtro y se sigue
 * usando para operaciones que sí deben cruzar tenants (admin de SaaS,
 * scripts, etc.).
 */
export function withTenant(tenantId: string) {
    return prisma.$extends({
        name: 'tenant-isolation',
        query: {
            $allModels: {
                async $allOperations({ model, operation, args, query }) {
                    const newArgs = injectTenantInArgs(model, operation, args, tenantId);
                    return query(newArgs as Parameters<typeof query>[0]);
                },
            },
        },
    });
}

// Type helper para casos donde quieras tipar el cliente extendido.
export type TenantPrismaClient = ReturnType<typeof withTenant>;

// Re-exporta lista para visibilidad / debug.
export const TENANT_AWARE_MODELS = Array.from(TENANT_MODELS);
