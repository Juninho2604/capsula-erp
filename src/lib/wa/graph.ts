/**
 * Cliente de Graph API (WhatsApp Cloud API de Meta) — envío + descarga media.
 *
 * Helper único de envío (§5.3): hoy lo usan los mensajes HUMANOS desde
 * Kpsula (opción A del contrato n8n); queda listo para que en fase 2 también
 * los del bot salgan por acá (opción B).
 *
 * Manejo de errores Graph:
 *  - 131047 (ventana cerrada según Meta) → code WINDOW_EXPIRED, por si el
 *    reloj local difiere del de Meta.
 *  - 190 (token inválido/expirado) → marca la credencial active=false para
 *    que la UI muestre el banner rojo del módulo.
 */
import prisma from '@/server/db';
import { decryptToken } from './crypto';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

export type GraphSendPayload =
    | { kind: 'TEXT'; to: string; body: string }
    | { kind: 'IMAGE'; to: string; link: string; caption?: string }
    | { kind: 'DOCUMENT'; to: string; link: string; filename?: string; caption?: string }
    | {
        kind: 'TEMPLATE'; to: string; templateName: string; language: string;
        /** Variables posicionales {{1}}, {{2}}… del body. */
        bodyParams?: string[];
    };

export type GraphSendResult =
    | { ok: true; wamid: string }
    | { ok: false; code: 'NO_CREDENTIAL' | 'TOKEN_INVALID' | 'WINDOW_EXPIRED' | 'GRAPH_ERROR'; errorDetail: string };

interface WaCredentialRow {
    id: string;
    phoneNumberId: string;
    accessToken: string;
    graphApiVersion: string;
    active: boolean;
}

export async function getActiveCredential(tenantId: string): Promise<WaCredentialRow | null> {
    const cred = await prisma.waCredential.findUnique({
        where: { tenantId },
        select: { id: true, phoneNumberId: true, accessToken: true, graphApiVersion: true, active: true },
    });
    if (!cred || !cred.active) return null;
    return cred;
}

function buildGraphBody(payload: GraphSendPayload): Record<string, unknown> {
    const base = { messaging_product: 'whatsapp', to: payload.to };
    switch (payload.kind) {
        case 'TEXT':
            return { ...base, type: 'text', text: { body: payload.body } };
        case 'IMAGE':
            return { ...base, type: 'image', image: { link: payload.link, ...(payload.caption ? { caption: payload.caption } : {}) } };
        case 'DOCUMENT':
            return {
                ...base, type: 'document',
                document: { link: payload.link, ...(payload.filename ? { filename: payload.filename } : {}), ...(payload.caption ? { caption: payload.caption } : {}) },
            };
        case 'TEMPLATE': {
            const components = payload.bodyParams && payload.bodyParams.length > 0
                ? [{ type: 'body', parameters: payload.bodyParams.map(text => ({ type: 'text', text })) }]
                : undefined;
            return {
                ...base, type: 'template',
                template: {
                    name: payload.templateName,
                    language: { code: payload.language },
                    ...(components ? { components } : {}),
                },
            };
        }
    }
}

export async function sendWhatsAppMessage(
    tenantId: string,
    payload: GraphSendPayload,
): Promise<GraphSendResult> {
    const cred = await getActiveCredential(tenantId);
    if (!cred) {
        return { ok: false, code: 'NO_CREDENTIAL', errorDetail: 'Sin credencial de WhatsApp activa para el tenant' };
    }

    let token: string;
    try {
        token = decryptToken(cred.accessToken);
    } catch (e) {
        return { ok: false, code: 'TOKEN_INVALID', errorDetail: e instanceof Error ? e.message : 'Token indescifrable' };
    }

    const url = `https://graph.facebook.com/${cred.graphApiVersion}/${cred.phoneNumberId}/messages`;
    let res: Response;
    let json: any;
    try {
        res = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(buildGraphBody(payload)),
        });
        json = await res.json().catch(() => ({}));
    } catch (e) {
        return { ok: false, code: 'GRAPH_ERROR', errorDetail: `Red: ${e instanceof Error ? e.message : String(e)}` };
    }

    if (res.ok && json?.messages?.[0]?.id) {
        return { ok: true, wamid: json.messages[0].id };
    }

    const err = json?.error ?? {};
    const errCode: number | undefined = err.code;
    const detail = `Graph ${res.status} · code=${errCode ?? '?'} · ${err.message ?? 'sin mensaje'}${err.error_data?.details ? ` · ${err.error_data.details}` : ''}`;

    if (errCode === 190) {
        // Token inválido/expirado → apagar credencial y avisar en UI (banner).
        await prisma.waCredential.update({ where: { id: cred.id }, data: { active: false } }).catch(() => {});
        return { ok: false, code: 'TOKEN_INVALID', errorDetail: detail };
    }
    if (errCode === 131047) {
        return { ok: false, code: 'WINDOW_EXPIRED', errorDetail: detail };
    }
    return { ok: false, code: 'GRAPH_ERROR', errorDetail: detail };
}

// ─── Media entrante (§6.4) ───────────────────────────────────────────────────
// Los mediaId de Meta expiran → descargamos el binario apenas llega y lo
// persistimos en el storage local del proyecto (mismo patrón que
// /api/upload: storage/uploads/<tenantId>/wa-media/<uuid>.<ext>, servido por
// /api/files/[...path] con validación de sesión + tenant).

const STORAGE_ROOT = path.join(process.cwd(), 'storage');
const WA_MEDIA_SUBDIR = 'wa-media';

const EXT_BY_MIME: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
};

export async function downloadWaMedia(
    tenantId: string,
    mediaId: string,
): Promise<{ ok: true; mediaUrl: string; mimeType: string } | { ok: false; errorDetail: string }> {
    const cred = await getActiveCredential(tenantId);
    if (!cred) return { ok: false, errorDetail: 'Sin credencial activa para descargar media' };

    let token: string;
    try {
        token = decryptToken(cred.accessToken);
    } catch (e) {
        return { ok: false, errorDetail: e instanceof Error ? e.message : 'Token indescifrable' };
    }

    try {
        // 1. Metadata del media (URL temporal + mime)
        const metaRes = await fetch(`https://graph.facebook.com/${cred.graphApiVersion}/${mediaId}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const meta = await metaRes.json().catch(() => ({}));
        if (!metaRes.ok || !meta?.url) {
            return { ok: false, errorDetail: `Media meta ${metaRes.status}: ${meta?.error?.message ?? 'sin URL'}` };
        }
        const mimeType: string = meta.mime_type ?? 'application/octet-stream';

        // 2. Binario (la URL de Meta exige el mismo Bearer)
        const binRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
        if (!binRes.ok) return { ok: false, errorDetail: `Media download ${binRes.status}` };
        const bytes = Buffer.from(await binRes.arrayBuffer());

        // 3. Persistir (extensión derivada del MIME, nunca de input del cliente)
        const ext = EXT_BY_MIME[mimeType] ?? 'bin';
        const fileName = `${randomUUID()}.${ext}`;
        const dir = path.join(STORAGE_ROOT, 'uploads', tenantId, WA_MEDIA_SUBDIR);
        await mkdir(dir, { recursive: true });
        await writeFile(path.join(dir, fileName), bytes);

        return { ok: true, mediaUrl: `/api/files/${tenantId}/${WA_MEDIA_SUBDIR}/${fileName}`, mimeType };
    } catch (e) {
        return { ok: false, errorDetail: `Media: ${e instanceof Error ? e.message : String(e)}` };
    }
}
