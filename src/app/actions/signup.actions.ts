'use server';

/**
 * Signup self-service de nuevos tenants.
 *
 * Crea un Tenant nuevo + 1 User con role OWNER, en transacción. Después el
 * owner debe loguearse en `https://<slug>.kpsula.app/login` para empezar.
 *
 * Protegido por feature flag `SIGNUPS_ENABLED=true`. Si no está activado,
 * el endpoint devuelve un error genérico (en producción la ruta /signup
 * además renderiza 404 — ver middleware.ts).
 *
 * Rate limit: 3 signups por IP cada 60 min (defensa básica contra abuso).
 */

import prisma from '@/server/db';
import { hashPassword } from '@/lib/password';
import { consumeRateLimit, getClientIp } from '@/lib/rate-limit';
import { isReservedSlug } from '@/lib/signup/reserved-slugs';
import { createBootstrapToken } from '@/lib/signup/bootstrap-token';

export interface SignupSuccess {
    success: true;
    tenantSlug: string;
    loginUrl: string;
}
export interface SignupError {
    success: false;
    message: string;
    field?: 'businessName' | 'slug' | 'email' | 'password' | 'firstName' | 'lastName';
}
export type SignupState = SignupSuccess | SignupError | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,29}$/; // 2-30 chars, no doble-hyphen al inicio
const TENANT_ROOT_DOMAIN = 'kpsula.app';

export async function signupTenantAction(
    _prevState: SignupState,
    formData: FormData,
): Promise<SignupState> {
    if (process.env.SIGNUPS_ENABLED !== 'true') {
        return { success: false, message: 'Los registros están temporalmente cerrados.' };
    }

    // Rate limit por IP (defensa básica). 3 intentos por hora.
    try {
        const ip = await getClientIp();
        const rl = await consumeRateLimit({
            key: `signup:${ip}`,
            max: 3,
            windowSeconds: 60 * 60,
        });
        if (!rl.allowed) {
            return {
                success: false,
                message: 'Demasiados intentos. Esperá un rato e intentá de nuevo.',
            };
        }
    } catch {
        // Si rate-limit falla por error de BD, no bloqueamos — el resto de
        // validaciones siguen aplicando.
    }

    // ─── Parsing + normalización ─────────────────────────────────────────────
    const businessName = ((formData.get('businessName') as string) ?? '').trim();
    const slugRaw = ((formData.get('slug') as string) ?? '').trim().toLowerCase();
    const email = ((formData.get('email') as string) ?? '').trim().toLowerCase();
    const password = (formData.get('password') as string) ?? '';
    const firstName = ((formData.get('firstName') as string) ?? '').trim();
    const lastName = ((formData.get('lastName') as string) ?? '').trim();

    // ─── Validación campo por campo ──────────────────────────────────────────
    if (businessName.length < 2 || businessName.length > 100) {
        return { success: false, field: 'businessName', message: 'Nombre del negocio entre 2 y 100 caracteres.' };
    }
    if (!SLUG_RE.test(slugRaw)) {
        return {
            success: false,
            field: 'slug',
            message: 'Slug inválido. Solo minúsculas, números y guiones (2-30 caracteres).',
        };
    }
    if (isReservedSlug(slugRaw)) {
        return { success: false, field: 'slug', message: 'Ese slug está reservado. Elige otro.' };
    }
    if (!EMAIL_RE.test(email) || email.length > 200) {
        return { success: false, field: 'email', message: 'Email inválido.' };
    }
    if (password.length < 8 || password.length > 200) {
        return { success: false, field: 'password', message: 'Contraseña entre 8 y 200 caracteres.' };
    }
    if (firstName.length < 1 || firstName.length > 50) {
        return { success: false, field: 'firstName', message: 'Nombre entre 1 y 50 caracteres.' };
    }
    if (lastName.length < 1 || lastName.length > 50) {
        return { success: false, field: 'lastName', message: 'Apellido entre 1 y 50 caracteres.' };
    }

    // ─── Slug único (chequeo previo + constraint atómico al final) ──────────
    const existing = await prisma.tenant.findUnique({
        where: { slug: slugRaw },
        select: { id: true },
    });
    if (existing) {
        return { success: false, field: 'slug', message: 'Ese slug ya está tomado. Probá otro.' };
    }

    // ─── Crear Tenant + Owner + Branch default en transacción ──────────────
    try {
        const passwordHash = await hashPassword(password);

        const result = await prisma.$transaction(async (tx) => {
            const t = await tx.tenant.create({
                data: { slug: slugRaw, name: businessName },
                select: { id: true, slug: true },
            });
            const u = await tx.user.create({
                data: {
                    tenantId: t.id,
                    email,
                    passwordHash,
                    firstName,
                    lastName,
                    role: 'OWNER',
                },
                select: { id: true },
            });
            // Branch default — necesario para que el owner pueda navegar al
            // dashboard sin crashear. `code` único por tenant; "MAIN" es fijo
            // porque el tenant nuevo no tiene otros branches. El owner puede
            // renombrarlo o crear más desde /dashboard/config.
            await tx.branch.create({
                data: {
                    tenantId: t.id,
                    code: 'MAIN',
                    name: businessName,
                },
                select: { id: true },
            });
            return { tenant: t, userId: u.id };
        });

        // Token one-shot 60s para auto-login cross-subdomain. La ruta
        // `<slug>.kpsula.app/auth/bootstrap` lo canjea por la cookie `session`
        // local del subdomain. Evita compartir cookies entre tenants.
        const bootstrapToken = await createBootstrapToken({
            userId: result.userId,
            tenantId: result.tenant.id,
            tenantSlug: result.tenant.slug,
        });

        return {
            success: true,
            tenantSlug: result.tenant.slug,
            loginUrl: `https://${result.tenant.slug}.${TENANT_ROOT_DOMAIN}/auth/bootstrap?t=${encodeURIComponent(bootstrapToken)}`,
        };
    } catch (err) {
        // Posible race condition: el slug se tomó entre la verificación y el
        // create. El @unique constraint nos protege.
        console.error('[signupTenantAction]', err);
        const msg = (err as { code?: string })?.code === 'P2002'
            ? 'Ese slug acaba de tomarse. Elige otro.'
            : 'Error al crear la cuenta. Intentá de nuevo en unos minutos.';
        return { success: false, field: 'slug', message: msg };
    }
}
