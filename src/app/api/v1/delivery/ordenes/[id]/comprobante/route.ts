/**
 * POST /api/v1/delivery/ordenes/{id}/comprobante
 *
 * n8n descarga el archivo del canal (Telegram getFile / Evolution) y lo sube
 * acá como multipart: `file` + `tipo` (billetes | pago_movil | transferencia).
 * La orden pasa a PAGO_POR_VALIDAR con el comprobante adjunto.
 *
 * Si el tenant está en `validationMode = AUTO`, además auto-valida →
 * EN_COCINA + encola la impresión. Recomendado MANUAL (el bot no puede
 * verificar fotos; la validación humana es el antifraude).
 *
 * Auth: X-API-Key (máquina, sin sesión). Requiere flag `deliveryOps`. El
 * archivo se guarda tenant-scoped fuera de public/, servido luego por
 * /api/files (que valida sesión) en el dashboard.
 */

import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import prisma from '@/server/db';
import { authenticateDeliveryApi } from '@/lib/delivery/auth';
import { tenantFeatureEnabled } from '@/lib/feature-flags';
import { withTenant } from '@/lib/prisma-tenant-client';
import { applyDeliveryTransition } from '@/lib/delivery/transition';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STORAGE_ROOT = path.join(process.cwd(), 'storage');
const SUBDIR = 'delivery-comprobantes';
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const EXT_BY_TYPE: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
};
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const VALID_TIPOS = new Set(['billetes', 'pago_movil', 'transferencia']);

const ORDER_SELECT = {
    id: true,
    status: true,
    branchId: true,
    correlative: true,
    customerName: true,
    customerPhone: true,
    deliveryAddress: true,
    deliveryRef: true,
    comanda: true,
    createdAt: true,
} as const;

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const auth = authenticateDeliveryApi(req);
    if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await tenantFeatureEnabled(auth.tenantId, 'deliveryOps'))) {
        return NextResponse.json({ error: 'delivery_ops disabled' }, { status: 403 });
    }

    const { id } = await params;
    const db = withTenant(auth.tenantId);
    const order = await db.deliveryOrder.findFirst({ where: { id }, select: ORDER_SELECT });
    if (!order) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });

    if (order.status !== 'ESPERANDO_PAGO' && order.status !== 'PAGO_POR_VALIDAR') {
        return NextResponse.json(
            { error: `No se puede adjuntar comprobante en estado ${order.status}` },
            { status: 409 },
        );
    }

    // ── Multipart ────────────────────────────────────────────────────────────
    let form: FormData;
    try {
        form = await req.formData();
    } catch {
        return NextResponse.json({ error: 'multipart/form-data inválido' }, { status: 400 });
    }
    const file = form.get('file') as File | null;
    const tipo = String(form.get('tipo') ?? '').trim();

    if (!file) return NextResponse.json({ error: 'Falta "file"' }, { status: 400 });
    if (!VALID_TIPOS.has(tipo)) {
        return NextResponse.json(
            { error: 'tipo debe ser billetes | pago_movil | transferencia' },
            { status: 400 },
        );
    }
    if (!ALLOWED_TYPES.has(file.type)) {
        return NextResponse.json({ error: 'Tipo de archivo no permitido (JPG/PNG/WebP/PDF)' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
        return NextResponse.json({ error: 'Archivo > 5MB' }, { status: 400 });
    }

    // ── Guardar archivo (tenant-scoped, fuera de public/) ─────────────────────
    const tenantDir = path.join(STORAGE_ROOT, 'uploads', auth.tenantId, SUBDIR);
    if (!existsSync(tenantDir)) await mkdir(tenantDir, { recursive: true });
    const ext = EXT_BY_TYPE[file.type] ?? 'bin';
    const fileName = `${randomUUID()}.${ext}`;
    await writeFile(path.join(tenantDir, fileName), Buffer.from(await file.arrayBuffer()));
    const publicUrl = `/api/files/${auth.tenantId}/${SUBDIR}/${fileName}`;

    // ── Adjuntar comprobante + transición ─────────────────────────────────────
    await prisma.deliveryOrder.update({
        where: { id: order.id },
        data: { paymentProofPath: publicUrl, paymentProofType: tipo },
    });

    const printOrder = {
        id: order.id,
        branchId: order.branchId,
        correlative: order.correlative,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        deliveryAddress: order.deliveryAddress,
        deliveryRef: order.deliveryRef,
        comanda: order.comanda,
        createdAt: order.createdAt.toISOString(),
    };

    if (order.status === 'ESPERANDO_PAGO') {
        await applyDeliveryTransition({
            tenantId: auth.tenantId,
            order: printOrder,
            from: 'ESPERANDO_PAGO',
            to: 'PAGO_POR_VALIDAR',
            note: `comprobante:${tipo}`,
        });
    }

    // ── Auto-validación opcional ──────────────────────────────────────────────
    let estado = 'PAGO_POR_VALIDAR';
    const cfg = await db.deliveryTenantConfig.findFirst({ select: { validationMode: true } });
    if (cfg?.validationMode === 'AUTO') {
        await applyDeliveryTransition({
            tenantId: auth.tenantId,
            order: printOrder,
            from: 'PAGO_POR_VALIDAR',
            to: 'EN_COCINA',
            note: 'auto-validado (validationMode=AUTO)',
        });
        estado = 'EN_COCINA';
    }

    return NextResponse.json({
        orden_id: order.id,
        estado,
        comprobante_url: publicUrl,
    });
}
