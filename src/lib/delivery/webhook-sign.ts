/**
 * Firma HMAC-SHA256 de los webhooks salientes (KPSULA → n8n). El receptor
 * (n8n) recalcula el HMAC del body crudo con el secreto compartido y lo
 * compara contra el header `X-Kpsula-Signature` para autenticar el origen.
 *
 * Determinística → testeable.
 */

import { createHmac } from 'crypto';

export function hmacSign(body: string, secret: string): string {
    return createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}
