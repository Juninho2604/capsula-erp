'use server';

/**
 * Conversaciones WhatsApp — server actions de la UI (§5.2 del spec).
 *
 * Guard: waGuard() = sesión + PERM.CONVERSATIONS_MANAGE + flag waConversations.
 * Compliance de envío: delegado a sendHumanMessage (lib/wa/service) que aplica
 * las reglas §4 SERVER-SIDE — la UI solo las refleja.
 *
 * Patrón de datos (igual que Gestión de Deliverys): el server component
 * precarga con estas actions y el client component las re-llama en polling
 * (15s bandeja / 5s chat abierto).
 */

import prisma from '@/server/db';
import { waGuard } from '@/lib/wa/guard';
import {
    sendHumanMessage,
    countConsecutiveOutbound,
    type HumanSendResult,
} from '@/lib/wa/service';
import { MAX_CONSECUTIVE_OUTBOUND } from '@/lib/wa/compliance';
import { invalidateControlCache } from '@/lib/wa/control-cache';
import { encryptToken, maskToken, isEncrypted } from '@/lib/wa/crypto';
import { getSession } from '@/lib/auth';

const MANAGER_ROLES = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'];

interface ActionResult<T = any> {
    success: boolean;
    message?: string;
    code?: string;
    data?: T;
}

async function audit(params: {
    tenantId: string; userId: string; userName: string; userRole: string;
    action: string; entityId: string; description: string;
}) {
    // Patrón de auditoría existente (AuditLog) — best-effort, nunca bloquea.
    await prisma.auditLog.create({
        data: {
            tenantId: params.tenantId,
            userId: params.userId,
            userName: params.userName,
            userRole: params.userRole,
            action: params.action,
            entityType: 'WaConversation',
            entityId: params.entityId,
            description: params.description,
            module: 'WA',
        },
    }).catch(err => console.error('[wa] audit falló:', err));
}

// ─── Bandeja ─────────────────────────────────────────────────────────────────

export async function listWaConversationsAction(filters?: {
    status?: 'BOT' | 'HUMAN' | 'CLOSED' | 'ALL';
    search?: string;
    take?: number;
}): Promise<ActionResult> {
    const guard = await waGuard();
    if (!guard.ok) return { success: false, message: guard.message };

    const where: any = { tenantId: guard.tenantId };
    if (filters?.status && filters.status !== 'ALL') where.status = filters.status;
    if (filters?.search?.trim()) {
        const q = filters.search.trim();
        where.OR = [
            { customerName: { contains: q, mode: 'insensitive' } },
            { customerPhone: { contains: q } },
        ];
    }

    const conversations = await prisma.waConversation.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: Math.min(filters?.take ?? 100, 200),
        include: {
            messages: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: { body: true, kind: true, direction: true, senderType: true, createdAt: true },
            },
        },
    });

    // Nombres de usuarios asignados (para el chip 👤 de la bandeja)
    const userIds = Array.from(new Set(conversations.map(c => c.assignedToUserId).filter(Boolean))) as string[];
    const users = userIds.length
        ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true } })
        : [];
    const userById = new Map(users.map(u => [u.id, `${u.firstName} ${u.lastName}`.trim()]));

    return {
        success: true,
        data: conversations.map(c => ({
            id: c.id,
            waId: c.waId,
            customerName: c.customerName,
            customerPhone: c.customerPhone,
            status: c.status,
            assignedToUserId: c.assignedToUserId,
            assignedToName: c.assignedToUserId ? userById.get(c.assignedToUserId) ?? 'Usuario' : null,
            lastCustomerMsgAt: c.lastCustomerMsgAt?.toISOString() ?? null,
            windowExpiresAt: c.windowExpiresAt?.toISOString() ?? null,
            marketingOptIn: c.marketingOptIn,
            optedOutAt: c.optedOutAt?.toISOString() ?? null,
            lastOrderId: c.lastOrderId,
            unreadCount: c.unreadCount,
            updatedAt: c.updatedAt.toISOString(),
            lastMessage: c.messages[0]
                ? {
                    snippet: c.messages[0].body?.slice(0, 80) ?? `[${c.messages[0].kind.toLowerCase()}]`,
                    direction: c.messages[0].direction,
                    senderType: c.messages[0].senderType,
                    at: c.messages[0].createdAt.toISOString(),
                }
                : null,
        })),
    };
}

// ─── Chat ────────────────────────────────────────────────────────────────────

export async function getWaConversationMessagesAction(
    conversationId: string,
    opts?: { before?: string; take?: number },
): Promise<ActionResult> {
    const guard = await waGuard();
    if (!guard.ok) return { success: false, message: guard.message };

    const conversation = await prisma.waConversation.findFirst({
        where: { id: conversationId, tenantId: guard.tenantId },
    });
    if (!conversation) return { success: false, message: 'Conversación no encontrada' };

    const messages = await prisma.waMessage.findMany({
        where: {
            conversationId,
            ...(opts?.before ? { createdAt: { lt: new Date(opts.before) } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(opts?.take ?? 50, 100),
    });

    const senderIds = Array.from(new Set(messages.map(m => m.senderUserId).filter(Boolean))) as string[];
    const users = senderIds.length
        ? await prisma.user.findMany({ where: { id: { in: senderIds } }, select: { id: true, firstName: true, lastName: true } })
        : [];
    const userById = new Map(users.map(u => [u.id, `${u.firstName} ${u.lastName}`.trim()]));

    const consecutiveOutbound = await countConsecutiveOutbound(conversationId);

    return {
        success: true,
        data: {
            conversation: {
                id: conversation.id,
                waId: conversation.waId,
                customerName: conversation.customerName,
                customerPhone: conversation.customerPhone,
                status: conversation.status,
                assignedToUserId: conversation.assignedToUserId,
                windowExpiresAt: conversation.windowExpiresAt?.toISOString() ?? null,
                marketingOptIn: conversation.marketingOptIn,
                optedOutAt: conversation.optedOutAt?.toISOString() ?? null,
                lastOrderId: conversation.lastOrderId,
                unreadCount: conversation.unreadCount,
            },
            consecutiveOutbound,
            rateLimit: MAX_CONSECUTIVE_OUTBOUND,
            messages: messages.reverse().map(m => ({
                id: m.id,
                direction: m.direction,
                senderType: m.senderType,
                senderName: m.senderType === 'HUMAN'
                    ? (m.senderUserId ? userById.get(m.senderUserId) ?? 'Usuario' : 'Usuario')
                    : m.senderType === 'BOT' ? 'Fabiola' : null,
                kind: m.kind,
                body: m.body,
                mediaUrl: m.mediaUrl,
                mediaMimeType: m.mediaMimeType,
                latitude: m.latitude,
                longitude: m.longitude,
                templateName: m.templateName,
                deliveryStatus: m.deliveryStatus,
                errorDetail: m.errorDetail,
                createdAt: m.createdAt.toISOString(),
            })),
        },
    };
}

// ─── Takeover / devolución (§5.2 take/release — auditados) ──────────────────

export async function takeWaConversationAction(conversationId: string): Promise<ActionResult> {
    const guard = await waGuard();
    if (!guard.ok) return { success: false, message: guard.message };

    const conversation = await prisma.waConversation.findFirst({
        where: { id: conversationId, tenantId: guard.tenantId },
    });
    if (!conversation) return { success: false, message: 'Conversación no encontrada' };
    if (conversation.status === 'HUMAN' && conversation.assignedToUserId !== guard.userId) {
        return { success: false, message: 'Otra persona ya tiene el control de esta conversación' };
    }

    await prisma.waConversation.update({
        where: { id: conversation.id },
        data: { status: 'HUMAN', assignedToUserId: guard.userId },
    });
    invalidateControlCache(guard.tenantId, conversation.waId);
    await audit({
        ...guard, action: 'WA_TAKEOVER', entityId: conversation.id,
        description: `Tomó el control de la conversación con ${conversation.customerName ?? conversation.customerPhone} (bot silenciado)`,
    });
    return { success: true, message: 'Conversación tomada — Fabiola queda en silencio' };
}

export async function releaseWaConversationAction(conversationId: string): Promise<ActionResult> {
    const guard = await waGuard();
    if (!guard.ok) return { success: false, message: guard.message };

    const conversation = await prisma.waConversation.findFirst({
        where: { id: conversationId, tenantId: guard.tenantId },
    });
    if (!conversation) return { success: false, message: 'Conversación no encontrada' };

    const isManager = MANAGER_ROLES.includes(guard.userRole);
    if (conversation.assignedToUserId !== guard.userId && !isManager) {
        return { success: false, message: 'Solo quien tomó la conversación (o un gerente) puede devolverla al bot' };
    }

    await prisma.waConversation.update({
        where: { id: conversation.id },
        data: { status: 'BOT', assignedToUserId: null },
    });
    invalidateControlCache(guard.tenantId, conversation.waId);
    await audit({
        ...guard, action: 'WA_RELEASE', entityId: conversation.id,
        description: `Devolvió la conversación con ${conversation.customerName ?? conversation.customerPhone} a Fabiola`,
    });
    return { success: true, message: 'Conversación devuelta a Fabiola' };
}

// ─── Envío humano (§5.2 send — compliance §4 server-side) ───────────────────

export async function sendWaHumanMessageAction(input: {
    conversationId: string;
    kind: 'TEXT' | 'TEMPLATE' | 'IMAGE' | 'DOCUMENT';
    body?: string;
    templateName?: string;
    templateVars?: string[];
    mediaUrl?: string;
    managerOverride?: boolean;
}): Promise<ActionResult> {
    const guard = await waGuard();
    if (!guard.ok) return { success: false, message: guard.message };

    const conversation = await prisma.waConversation.findFirst({
        where: { id: input.conversationId, tenantId: guard.tenantId },
        select: { status: true, assignedToUserId: true },
    });
    if (!conversation) return { success: false, message: 'Conversación no encontrada' };
    if (conversation.status !== 'HUMAN') {
        return { success: false, code: 'NOT_TAKEN', message: 'Primero tomá la conversación — con el bot activo no se envían mensajes humanos (evita respuestas dobles).' };
    }

    // Override del rate limit (§4.4): solo gerentes.
    const managerOverride = Boolean(input.managerOverride) && MANAGER_ROLES.includes(guard.userRole);

    const result: HumanSendResult = await sendHumanMessage(guard.tenantId, {
        conversationId: input.conversationId,
        userId: guard.userId,
        kind: input.kind,
        body: input.body ?? null,
        templateName: input.templateName ?? null,
        templateVars: input.templateVars ?? null,
        mediaUrl: input.mediaUrl ?? null,
        managerOverride,
    });

    if (!result.ok) return { success: false, code: result.code, message: result.message };
    return { success: true, data: { messageId: result.messageId, wamid: result.wamid } };
}

export async function markWaConversationReadAction(conversationId: string): Promise<ActionResult> {
    const guard = await waGuard();
    if (!guard.ok) return { success: false, message: guard.message };
    const res = await prisma.waConversation.updateMany({
        where: { id: conversationId, tenantId: guard.tenantId },
        data: { unreadCount: 0 },
    });
    return res.count === 1 ? { success: true } : { success: false, message: 'Conversación no encontrada' };
}

// ─── Plantillas (§5.2 templates — CRUD local; aprobación en Meta es manual) ─

const TEMPLATE_CATEGORIES = new Set(['UTILITY', 'MARKETING', 'AUTHENTICATION']);
const TEMPLATE_STATUSES = new Set(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PAUSED']);

export async function listWaTemplatesAction(): Promise<ActionResult> {
    const guard = await waGuard();
    if (!guard.ok) return { success: false, message: guard.message };
    const templates = await prisma.waTemplate.findMany({
        where: { tenantId: guard.tenantId },
        orderBy: { name: 'asc' },
    });
    return { success: true, data: templates };
}

export async function upsertWaTemplateAction(input: {
    id?: string;
    name: string;
    language?: string;
    category: string;
    bodyPreview: string;
    variablesCount?: number;
    approvalStatus: string;
}): Promise<ActionResult> {
    const guard = await waGuard();
    if (!guard.ok) return { success: false, message: guard.message };

    const name = input.name?.trim();
    if (!name || !/^[a-z0-9_]+$/.test(name)) {
        return { success: false, message: 'Nombre inválido: usar el nombre exacto de Meta (minúsculas, números y _)' };
    }
    if (!TEMPLATE_CATEGORIES.has(input.category)) return { success: false, message: 'Categoría inválida' };
    if (!TEMPLATE_STATUSES.has(input.approvalStatus)) return { success: false, message: 'Estado de aprobación inválido' };
    if (!input.bodyPreview?.trim()) return { success: false, message: 'Falta el texto de la plantilla' };

    const language = input.language?.trim() || 'es';
    // variablesCount derivado del body si no viene explícito
    const varMatches = input.bodyPreview.match(/\{\{(\d+)\}\}/g) ?? [];
    const variablesCount = input.variablesCount ?? new Set(varMatches).size;

    const data = {
        name, language,
        category: input.category,
        bodyPreview: input.bodyPreview,
        variablesCount,
        approvalStatus: input.approvalStatus as any,
    };

    if (input.id) {
        const res = await prisma.waTemplate.updateMany({
            where: { id: input.id, tenantId: guard.tenantId },
            data,
        });
        if (res.count === 0) return { success: false, message: 'Plantilla no encontrada' };
        return { success: true, message: 'Plantilla actualizada' };
    }

    try {
        await prisma.waTemplate.create({ data: { tenantId: guard.tenantId, ...data } });
        return { success: true, message: 'Plantilla registrada' };
    } catch {
        return { success: false, message: `Ya existe una plantilla "${name}" (${language}) para este tenant` };
    }
}

// ─── Configuración / credencial (§5.2 settings — solo OWNER/ADMIN_MANAGER) ──

export async function getWaSettingsAction(): Promise<ActionResult> {
    const guard = await waGuard();
    if (!guard.ok) return { success: false, message: guard.message };
    if (!['OWNER', 'ADMIN_MANAGER'].includes(guard.userRole)) {
        return { success: false, message: 'Solo OWNER o ADMIN_MANAGER pueden ver la configuración' };
    }
    const cred = await prisma.waCredential.findUnique({ where: { tenantId: guard.tenantId } });
    return {
        success: true,
        data: cred
            ? {
                phoneNumberId: cred.phoneNumberId,
                wabaId: cred.wabaId,
                displayPhone: cred.displayPhone,
                graphApiVersion: cred.graphApiVersion,
                active: cred.active,
                tokenMasked: maskToken(cred.accessToken),
                tokenEncrypted: isEncrypted(cred.accessToken),
            }
            : null,
    };
}

export async function saveWaSettingsAction(input: {
    phoneNumberId: string;
    wabaId: string;
    accessToken?: string;   // solo si se está reemplazando
    appSecret?: string;
    displayPhone?: string;
    graphApiVersion?: string;
    active?: boolean;
}): Promise<ActionResult> {
    const guard = await waGuard();
    if (!guard.ok) return { success: false, message: guard.message };
    if (!['OWNER', 'ADMIN_MANAGER'].includes(guard.userRole)) {
        return { success: false, message: 'Solo OWNER o ADMIN_MANAGER pueden editar la configuración' };
    }
    if (!input.phoneNumberId?.trim() || !input.wabaId?.trim()) {
        return { success: false, message: 'phoneNumberId y wabaId son obligatorios' };
    }

    const existing = await prisma.waCredential.findUnique({ where: { tenantId: guard.tenantId } });
    if (!existing && !input.accessToken?.trim()) {
        return { success: false, message: 'Falta el accessToken (primera configuración)' };
    }
    if (!existing && !input.appSecret?.trim()) {
        return { success: false, message: 'Falta el appSecret (primera configuración)' };
    }

    // Ambos secretos (accessToken y appSecret) se cifran en reposo con el
    // mismo AES-256-GCM. decryptToken tolera valores legacy sin cifrar, así
    // que al re-guardar quedan protegidos de forma consistente.
    let encryptedToken: string | undefined;
    let encryptedAppSecret: string | undefined;
    try {
        if (input.accessToken?.trim()) encryptedToken = encryptToken(input.accessToken.trim());
        if (input.appSecret?.trim()) encryptedAppSecret = encryptToken(input.appSecret.trim());
    } catch (e) {
        return { success: false, message: e instanceof Error ? e.message : 'Error cifrando los secretos' };
    }

    const data = {
        phoneNumberId: input.phoneNumberId.trim(),
        wabaId: input.wabaId.trim(),
        ...(encryptedToken ? { accessToken: encryptedToken } : {}),
        ...(encryptedAppSecret ? { appSecret: encryptedAppSecret } : {}),
        displayPhone: input.displayPhone?.trim() || null,
        graphApiVersion: input.graphApiVersion?.trim() || 'v21.0',
        active: input.active ?? true,
    };

    if (existing) {
        await prisma.waCredential.update({ where: { id: existing.id }, data });
    } else {
        await prisma.waCredential.create({
            data: { tenantId: guard.tenantId, ...data, accessToken: encryptedToken!, appSecret: encryptedAppSecret! },
        });
    }

    // Nunca loggear el token — auditamos solo el hecho.
    await audit({
        ...guard, action: 'WA_SETTINGS', entityId: guard.tenantId,
        description: `Actualizó la credencial de WhatsApp (${data.phoneNumberId})${encryptedToken ? ' — token reemplazado' : ''}`,
    });
    return { success: true, message: 'Configuración guardada' };
}

/** Estado del módulo para el banner rojo (token caído / sin credencial). */
export async function getWaModuleHealthAction(): Promise<ActionResult> {
    const guard = await waGuard();
    if (!guard.ok) return { success: false, message: guard.message };
    const cred = await prisma.waCredential.findUnique({
        where: { tenantId: guard.tenantId },
        select: { active: true, displayPhone: true },
    });
    return {
        success: true,
        data: {
            hasCredential: Boolean(cred),
            credentialActive: cred?.active ?? false,
            displayPhone: cred?.displayPhone ?? null,
        },
    };
}
