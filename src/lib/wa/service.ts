/**
 * Servicio de dominio del módulo Conversaciones WhatsApp.
 *
 * Operaciones compartidas entre la API de n8n (/api/v1/wa/*) y las server
 * actions de la UI. Toda la lógica de compliance delega en las funciones
 * puras de ./compliance (testeadas en compliance.test.ts).
 */
import prisma from '@/server/db';
import {
    checkOutboundAllowed,
    computeWindow,
    isOptOutMessage,
    MAX_CONSECUTIVE_OUTBOUND,
    OPT_OUT_CONFIRMATION_TEXT,
    type OutboundKind,
    type SendRejectionCode,
} from './compliance';
import { sendWhatsAppMessage, downloadWaMedia, type GraphSendPayload } from './graph';

const VALID_INBOUND_KINDS = new Set(['TEXT', 'IMAGE', 'DOCUMENT', 'LOCATION', 'AUDIO', 'UNSUPPORTED']);

export interface InboundInput {
    waId: string;
    name?: string | null;
    kind: string;
    body?: string | null;
    mediaId?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    wamid?: string | null;
}

export interface InboundResult {
    conversationId: string;
    /** BOT | HUMAN | CLOSED — n8n decide con esto si Fabiola responde. */
    status: string;
    optedOut: boolean;
    duplicated: boolean;
}

/**
 * Procesa un mensaje ENTRANTE (§4.1 + §4.3 + §6.2):
 * upsert de conversación, ventana 24h, opt-out, unread, media, dedupe por wamid.
 */
export async function processInboundMessage(tenantId: string, input: InboundInput): Promise<InboundResult> {
    const now = new Date();
    const kind = VALID_INBOUND_KINDS.has(input.kind?.toUpperCase?.() ?? '') ? input.kind.toUpperCase() : 'UNSUPPORTED';

    // Dedupe: Meta reintenta webhooks — si ya registramos este wamid, no duplicar.
    if (input.wamid) {
        const existing = await prisma.waMessage.findUnique({
            where: { wamid: input.wamid },
            select: { conversationId: true, conversation: { select: { status: true, optedOutAt: true, tenantId: true } } },
        });
        if (existing && existing.conversation.tenantId === tenantId) {
            return {
                conversationId: existing.conversationId,
                status: existing.conversation.status,
                optedOut: existing.conversation.optedOutAt != null,
                duplicated: true,
            };
        }
    }

    const window = computeWindow(now);
    const conversation = await prisma.waConversation.upsert({
        where: { tenantId_waId: { tenantId, waId: input.waId } },
        create: {
            tenantId,
            waId: input.waId,
            customerPhone: input.waId,
            customerName: input.name ?? null,
            status: 'BOT',
            lastCustomerMsgAt: window.lastCustomerMsgAt,
            windowExpiresAt: window.windowExpiresAt,
            unreadCount: 1,
        },
        update: {
            lastCustomerMsgAt: window.lastCustomerMsgAt,
            windowExpiresAt: window.windowExpiresAt,
            unreadCount: { increment: 1 },
            ...(input.name ? { customerName: input.name } : {}),
        },
    });

    // Media entrante: descargar YA (los mediaId de Meta expiran) — best-effort.
    let mediaUrl: string | null = null;
    let mediaMimeType: string | null = null;
    if (input.mediaId) {
        const dl = await downloadWaMedia(tenantId, input.mediaId);
        if (dl.ok) {
            mediaUrl = dl.mediaUrl;
            mediaMimeType = dl.mimeType;
        } else {
            console.error('[wa] descarga de media falló:', dl.errorDetail);
        }
    }

    await prisma.waMessage.create({
        data: {
            tenantId,
            conversationId: conversation.id,
            direction: 'INBOUND',
            senderType: 'CUSTOMER',
            kind: kind as any,
            body: input.body ?? null,
            mediaUrl,
            mediaMimeType,
            latitude: input.latitude ?? null,
            longitude: input.longitude ?? null,
            wamid: input.wamid ?? null,
            deliveryStatus: 'DELIVERED',
        },
    });

    // Opt-out (§4.3): setear flags y confirmar UNA sola vez.
    let optedOut = conversation.optedOutAt != null;
    if (kind === 'TEXT' && isOptOutMessage(input.body)) {
        // Compare-and-set atómico: dos BAJA casi simultáneas (wamids distintos)
        // ambas leerían optedOutAt=null en el upsert de arriba. El
        // updateMany con where optedOutAt:null hace que solo UNA gane
        // (count===1) → una sola confirmación (fix race §4.3).
        const claim = await prisma.waConversation.updateMany({
            where: { id: conversation.id, optedOutAt: null },
            data: { optedOutAt: now, marketingOptIn: false },
        });
        optedOut = true;
        const firstTime = claim.count === 1;
        if (firstTime) {
            // Confirmación de baja: dentro de ventana (acaba de escribir).
            const sent = await sendWhatsAppMessage(tenantId, {
                kind: 'TEXT',
                to: conversation.waId,
                body: OPT_OUT_CONFIRMATION_TEXT,
            });
            await prisma.waMessage.create({
                data: {
                    tenantId,
                    conversationId: conversation.id,
                    direction: 'OUTBOUND',
                    senderType: 'BOT',
                    kind: 'TEXT',
                    body: OPT_OUT_CONFIRMATION_TEXT,
                    wamid: sent.ok ? sent.wamid : null,
                    deliveryStatus: sent.ok ? 'SENT' : 'FAILED',
                    errorDetail: sent.ok ? null : sent.errorDetail,
                },
            });
        }
    }

    return { conversationId: conversation.id, status: conversation.status, optedOut, duplicated: false };
}

/** OUTBOUND consecutivos desde el último INBOUND (§4.4). Tope: MAX+1. */
export async function countConsecutiveOutbound(conversationId: string): Promise<number> {
    const recent = await prisma.waMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: MAX_CONSECUTIVE_OUTBOUND + 1,
        select: { direction: true },
    });
    let count = 0;
    for (const m of recent) {
        if (m.direction === 'INBOUND') break;
        count++;
    }
    return count;
}

/** Reemplaza {{1}}, {{2}}… del bodyPreview por las variables (para persistir/preview). */
export function renderTemplateBody(bodyPreview: string, vars: string[]): string {
    return bodyPreview.replace(/\{\{(\d+)\}\}/g, (_, n) => vars[Number(n) - 1] ?? `{{${n}}}`);
}

export interface HumanSendInput {
    conversationId: string;
    userId: string;
    kind: OutboundKind;
    body?: string | null;
    templateName?: string | null;
    templateVars?: string[] | null;
    mediaUrl?: string | null;
    managerOverride?: boolean;
}

export type HumanSendResult =
    | { ok: true; messageId: string; wamid: string }
    | { ok: false; code: SendRejectionCode | 'NOT_FOUND' | 'INVALID_INPUT' | 'SEND_FAILED'; message: string };

/**
 * Envío HUMANO (§5.2 /send): valida compliance §4 SERVER-SIDE, envía vía
 * Graph con la credencial del tenant y persiste el WaMessage.
 */
export async function sendHumanMessage(tenantId: string, input: HumanSendInput): Promise<HumanSendResult> {
    const now = new Date();
    const conversation = await prisma.waConversation.findFirst({
        where: { id: input.conversationId, tenantId },
    });
    if (!conversation) return { ok: false, code: 'NOT_FOUND', message: 'Conversación no encontrada' };

    // Validación de input por tipo
    if (input.kind === 'TEXT' && !input.body?.trim()) {
        return { ok: false, code: 'INVALID_INPUT', message: 'El texto está vacío' };
    }
    if ((input.kind === 'IMAGE' || input.kind === 'DOCUMENT') && !input.mediaUrl?.trim()) {
        return { ok: false, code: 'INVALID_INPUT', message: 'Falta mediaUrl' };
    }
    if (input.kind === 'TEMPLATE' && !input.templateName?.trim()) {
        return { ok: false, code: 'INVALID_INPUT', message: 'Falta templateName' };
    }

    const template = input.kind === 'TEMPLATE'
        ? await prisma.waTemplate.findFirst({
            where: { tenantId, name: input.templateName!.trim() },
        })
        : null;

    const consecutiveOutbound = await countConsecutiveOutbound(conversation.id);

    const check = checkOutboundAllowed({
        kind: input.kind,
        windowExpiresAt: conversation.windowExpiresAt,
        optedOutAt: conversation.optedOutAt,
        marketingOptIn: conversation.marketingOptIn,
        template: template ? { approvalStatus: template.approvalStatus, category: template.category } : null,
        consecutiveOutbound,
        managerOverride: input.managerOverride,
        now,
    });
    if (!check.ok) return { ok: false, code: check.code, message: check.message };

    let payload: GraphSendPayload;
    let persistedBody: string | null = input.body ?? null;
    if (input.kind === 'TEXT') {
        payload = { kind: 'TEXT', to: conversation.waId, body: input.body!.trim() };
    } else if (input.kind === 'IMAGE') {
        // OJO: Meta descarga el media desde `link` — debe ser una URL pública.
        payload = { kind: 'IMAGE', to: conversation.waId, link: input.mediaUrl!.trim(), caption: input.body ?? undefined };
    } else if (input.kind === 'DOCUMENT') {
        payload = { kind: 'DOCUMENT', to: conversation.waId, link: input.mediaUrl!.trim(), caption: input.body ?? undefined };
    } else {
        const vars = input.templateVars ?? [];
        payload = {
            kind: 'TEMPLATE',
            to: conversation.waId,
            templateName: template!.name,
            language: template!.language,
            bodyParams: vars,
        };
        persistedBody = renderTemplateBody(template!.bodyPreview, vars);
    }

    const sent = await sendWhatsAppMessage(tenantId, payload);
    if (!sent.ok) {
        // Persistir el intento fallido para trazabilidad (⚠ en la UI).
        await prisma.waMessage.create({
            data: {
                tenantId,
                conversationId: conversation.id,
                direction: 'OUTBOUND',
                senderType: 'HUMAN',
                senderUserId: input.userId,
                kind: input.kind as any,
                body: persistedBody,
                mediaUrl: input.mediaUrl ?? null,
                templateName: template?.name ?? null,
                deliveryStatus: 'FAILED',
                errorDetail: sent.errorDetail,
            },
        });
        const message = sent.code === 'WINDOW_EXPIRED'
            ? 'Meta rechazó el envío: la ventana de 24h expiró (reloj de Meta). Solo plantillas aprobadas.'
            : sent.code === 'NO_CREDENTIAL'
                ? 'No hay credencial de WhatsApp configurada/activa para este tenant.'
                : sent.code === 'TOKEN_INVALID'
                    ? 'El token de WhatsApp es inválido o expiró — revisar Configuración del módulo.'
                    : `Error de Graph API: ${sent.errorDetail}`;
        return { ok: false, code: sent.code === 'WINDOW_EXPIRED' ? 'WINDOW_EXPIRED' : 'SEND_FAILED', message };
    }

    const msg = await prisma.waMessage.create({
        data: {
            tenantId,
            conversationId: conversation.id,
            direction: 'OUTBOUND',
            senderType: 'HUMAN',
            senderUserId: input.userId,
            kind: input.kind as any,
            body: persistedBody,
            mediaUrl: input.mediaUrl ?? null,
            templateName: template?.name ?? null,
            wamid: sent.wamid,
            deliveryStatus: 'SENT',
        },
    });
    // Touch para que la bandeja (orden por updatedAt) suba la conversación.
    await prisma.waConversation.update({ where: { id: conversation.id }, data: { updatedAt: now } });

    return { ok: true, messageId: msg.id, wamid: sent.wamid };
}

/** Mapea estados de webhook de Meta → enum local. */
const META_STATUS_MAP: Record<string, string> = {
    sent: 'SENT',
    delivered: 'DELIVERED',
    read: 'READ',
    failed: 'FAILED',
};

export async function updateDeliveryStatusByWamid(
    tenantId: string,
    wamid: string,
    metaStatus: string,
    errorDetail?: string | null,
): Promise<boolean> {
    const mapped = META_STATUS_MAP[metaStatus?.toLowerCase?.() ?? ''];
    if (!mapped) return false;
    const res = await prisma.waMessage.updateMany({
        where: { tenantId, wamid },
        data: {
            deliveryStatus: mapped as any,
            ...(errorDetail ? { errorDetail } : {}),
        },
    });
    return res.count > 0;
}
