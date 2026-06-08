/**
 * POST /api/v1/delivery/ordenes
 *
 * Crea una orden de delivery a partir de lo que emite el bot. Asigna
 * correlativo + sede y nace en estado ESPERANDO_PAGO.
 *
 * Auth: X-API-Key (por tenant). Requiere feature flag `deliveryOps`.
 *
 * Body: { canal, chat_id?, comanda, ...campos de cliente/entrega opcionales }
 * 201:  { orden_id, correlativo, sede_asignada: {id,nombre}|null, estado }
 * 200:  (idempotencia) si llega un duplicado dentro de la ventana, devuelve
 *       la orden existente sin crear otra.
 */

import { NextResponse } from 'next/server';
import { authenticateDeliveryApi } from '@/lib/delivery/auth';
import { tenantFeatureEnabled } from '@/lib/feature-flags';
import { withTenant } from '@/lib/prisma-tenant-client';
import { assignBranch, type BranchCandidate } from '@/lib/delivery/assign-branch';
import { extractItemNames, extractComandaMeta } from '@/lib/delivery/comanda';
import { computeItemsHash, isWithinIdempotencyWindow } from '@/lib/delivery/idempotency';
import { nextCorrelative } from '@/lib/delivery/correlative';

export const dynamic = 'force-dynamic';

interface OrdenBody {
    canal?: string;
    chat_id?: string;
    comanda?: unknown;
    // Opcionales (si el bot los manda en la raíz; si no, se sacan de comanda).
    customer_name?: string;
    customer_phone?: string;
    address?: string;
    reference?: string;
    lat?: number;
    lon?: number;
}

export async function POST(req: Request) {
    const auth = authenticateDeliveryApi(req);
    if (!auth.ok) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!(await tenantFeatureEnabled(auth.tenantId, 'deliveryOps'))) {
        return NextResponse.json({ error: 'delivery_ops disabled' }, { status: 403 });
    }

    let body: OrdenBody;
    try {
        body = (await req.json()) as OrdenBody;
    } catch {
        return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 });
    }

    const canal = (body.canal ?? '').trim().toLowerCase();
    if (!canal) {
        return NextResponse.json({ error: 'Falta "canal"' }, { status: 400 });
    }
    if (body.comanda == null || typeof body.comanda !== 'object') {
        return NextResponse.json({ error: 'Falta "comanda" (objeto)' }, { status: 400 });
    }

    const chatId = body.chat_id ? String(body.chat_id) : null;
    const db = withTenant(auth.tenantId);

    // ── Idempotencia: ¿llegó este mismo pedido hace < 10 min? ───────────────
    const itemsHash = computeItemsHash(canal, chatId, body.comanda);
    const recent = await db.deliveryOrder.findFirst({
        where: { channel: canal, chatId, itemsHash },
        orderBy: { createdAt: 'desc' },
        include: { branch: { select: { id: true, name: true } } },
    });
    if (recent && isWithinIdempotencyWindow(recent.createdAt)) {
        return NextResponse.json(
            {
                orden_id: recent.id,
                correlativo: recent.correlative,
                sede_asignada: recent.branch
                    ? { id: recent.branch.id, nombre: recent.branch.name }
                    : null,
                estado: recent.status,
                idempotent: true,
            },
            { status: 200 },
        );
    }

    // ── Asignación de sede (ruteo → GPS → zona → fallback) ──────────────────
    const meta = extractComandaMeta(body.comanda);
    const lat = body.lat ?? meta.lat;
    const lon = body.lon ?? meta.lon;
    const address = body.address ?? meta.deliveryAddress;

    const [configs, zones] = await Promise.all([
        db.branchDeliveryConfig.findMany({
            where: { isActive: true },
            include: { branch: { select: { id: true, name: true, isActive: true } } },
        }),
        db.deliveryZone.findMany({ where: { isActive: true } }),
    ]);
    const zonesByBranch = new Map<string, string[]>();
    for (const z of zones) {
        const list = zonesByBranch.get(z.branchId) ?? [];
        list.push(z.name);
        zonesByBranch.set(z.branchId, list);
    }
    const branches: BranchCandidate[] = configs
        .filter(c => c.branch?.isActive)
        .map(c => ({
            id: c.branch!.id,
            name: c.branch!.name,
            lat: c.lat,
            lon: c.lon,
            zones: zonesByBranch.get(c.branchId) ?? [],
            isActive: true,
        }));

    const assignment = assignBranch({
        itemNames: extractItemNames(body.comanda),
        address,
        lat,
        lon,
        branches,
        // routingRules: Fase 4.5 (todavía no hay modelo RoutingRule).
        fallbackBranchId: branches.length === 1 ? branches[0].id : null,
    });

    // ── Correlativo atómico + creación ──────────────────────────────────────
    const correlativo = await nextCorrelative(auth.tenantId);

    const order = await db.deliveryOrder.create({
        data: {
            tenantId: auth.tenantId,
            correlative: correlativo,
            channel: canal,
            chatId,
            branchId: assignment.branchId,
            customerName: body.customer_name ?? meta.customerName,
            customerPhone: body.customer_phone ?? meta.customerPhone,
            deliveryAddress: address,
            deliveryRef: body.reference ?? meta.deliveryRef,
            lat,
            lon,
            comanda: body.comanda as object,
            totalUsd: meta.totalUsd,
            totalBs: meta.totalBs,
            status: 'ESPERANDO_PAGO',
            itemsHash,
            events: {
                create: { fromState: null, toState: 'ESPERANDO_PAGO', note: `assign:${assignment.reason}` },
            },
        },
        include: { branch: { select: { id: true, name: true } } },
    });

    return NextResponse.json(
        {
            orden_id: order.id,
            correlativo: order.correlative,
            sede_asignada: order.branch
                ? { id: order.branch.id, nombre: order.branch.name }
                : null,
            estado: order.status,
        },
        { status: 201 },
    );
}
