/**
 * Cifrado en reposo del accessToken de WhatsApp (WaCredential) — AES-256-GCM.
 *
 * Key en env `WA_TOKEN_ENC_KEY`: 64 hex chars (32 bytes). Generar con:
 *   openssl rand -hex 32
 *
 * Formato almacenado: `v1:<ivHex>:<authTagHex>:<cipherHex>`.
 * `decryptToken` tolera valores SIN prefijo (texto plano legacy o cargado a
 * mano por SQL) devolviéndolos tal cual — así una credencial sembrada antes
 * de configurar la key sigue funcionando, y al re-guardarla desde la UI
 * queda cifrada.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const PREFIX = 'v1:';

function getKey(): Buffer {
    const hex = process.env.WA_TOKEN_ENC_KEY?.trim();
    if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
        throw new Error(
            'WA_TOKEN_ENC_KEY no configurada o inválida (se esperan 64 hex chars). Generar con: openssl rand -hex 32',
        );
    }
    return Buffer.from(hex, 'hex');
}

export function encryptToken(plain: string): string {
    const key = getKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

export function decryptToken(stored: string): string {
    if (!stored.startsWith(PREFIX)) return stored; // legacy / texto plano
    const [, ivHex, tagHex, dataHex] = stored.split(':');
    if (!ivHex || !tagHex || !dataHex) {
        throw new Error('Token cifrado con formato inválido');
    }
    const key = getKey();
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
}

export function isEncrypted(stored: string): boolean {
    return stored.startsWith(PREFIX);
}

/** Enmascara un token para mostrarlo en UI: EAAG…9xKz (primeros 4 + últimos 4). */
export function maskToken(token: string): string {
    if (token.length <= 8) return '••••';
    return `${token.slice(0, 4)}…${token.slice(-4)}`;
}
