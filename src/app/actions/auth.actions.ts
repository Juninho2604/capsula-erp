'use server';

import prisma from '@/server/db';
import { createSession, deleteSession } from '@/lib/auth';
import { hashPassword, verifyPassword } from '@/lib/password';
import { consumeRateLimit, getClientIp } from '@/lib/rate-limit';
import { isSuperAdmin } from '@/lib/super-admin';
import { resolveTenantContext, TenantContextUnresolvedError } from '@/lib/tenant-context.server';
import { redirect } from 'next/navigation';

// Hash con formato válido (saltHex:hashHex) que nunca matchea ningún password
// real. Se usa cuando el email no existe para que el PBKDF2 corra igual y el
// tiempo de respuesta no revele si el usuario está registrado.
const DUMMY_HASH = '00000000000000000000000000000000:0000000000000000000000000000000000000000000000000000000000000000';
const GENERIC_LOGIN_ERROR = 'Credenciales inválidas';

export async function loginAction(prevState: any, formData: FormData) {
    // Normalizar email: trim + lowercase. Los emails son case-insensitive en
    // la práctica (estándar de la industria); solo el password mantiene case.
    const rawEmail = formData.get('email') as string;
    const email = (rawEmail ?? '').trim().toLowerCase();
    const password = formData.get('password') as string;

    if (!email || !password) {
        return { success: false, message: 'Falta email o contraseña' };
    }

    // Rate limit: 5 intentos por (IP + email) cada 5 min. Usa la combo para
    // evitar que un atacante bloquee la cuenta de un user legítimo solo
    // martillando con el email del víctima desde otra IP.
    try {
        const ip = await getClientIp();
        const rl = await consumeRateLimit({
            key: `login:${ip}:${email}`,
            max: 5,
            windowSeconds: 300,
        });
        if (!rl.allowed) {
            return {
                success: false,
                message: `Demasiados intentos. Intenta en ${rl.retryAfterSeconds}s.`,
            };
        }
    } catch (err) {
        // Si el rate-limit store falla, NO bloquear login (degradado seguro).
        // Solo loguear para detectar el problema.
        console.error('[rate-limit] consumeRateLimit failed:', err);
    }

    try {
        // Estrategia de búsqueda según contexto:
        //
        //  A) Host es <slug>.kpsula.app → tenantContext.source === 'subdomain'.
        //     Filtramos estrictamente por ese tenantId. Si el email no existe
        //     ahí, falla con credencial inválida. Previene cross-tenant login.
        //
        //  B) Host es kpsula.app (root) → tenantContext.source === 'fallback'
        //     o 'session' pre-login no resuelve. Buscamos el email en TODOS
        //     los tenants:
        //        - 0 matches  → credencial inválida
        //        - 1 match    → loggea ese user, redirect al subdomain del
        //                       tenant (lo decide el cliente con tenantSlug)
        //        - 2+ matches → error explícito pidiendo entrar por el
        //                       subdomain correcto. (Caso real: mismo email
        //                       admin@gmail.com en varios tenants.)
        //
        // El flujo de login es el PUNTO DE ENTRADA al sistema: el usuario
        // aún no ha probado quién es (no hay sesión activa) y puede no
        // venir por un subdomain válido. Si `resolveTenantContext()` lanza
        // `TenantContextUnresolvedError` (modo strict + sin contexto), lo
        // tratamos como root login — la búsqueda multi-tenant del email
        // ya cubre el caso de manera segura, y el password sigue
        // verificándose normalmente con anti-enumeration.
        let tenantCtx;
        try {
            tenantCtx = await resolveTenantContext();
        } catch (err) {
            if (err instanceof TenantContextUnresolvedError) {
                tenantCtx = { source: 'fallback' as const, tenantId: '', slug: '' };
            } else {
                throw err;
            }
        }
        const isRootLogin = tenantCtx.source !== 'subdomain' || isSuperAdmin(email);

        // Búsqueda case-insensitive: cubre emails normalizados Y users
        // viejos guardados con mixed-case. findFirst/findMany en lugar de
        // findUnique porque mode:'insensitive' es a nivel DB y solo
        // soportado en where genérico.
        const USER_SELECT = {
            id: true, email: true, firstName: true, lastName: true, role: true,
            passwordHash: true, isActive: true, allowedModules: true,
            grantedPerms: true, revokedPerms: true, tokenVersion: true,
            tenantId: true,
        } as const;

        let user: any = null;
        if (isRootLogin) {
            // Modo root: buscar en cualquier tenant.
            const matches = await prisma.user.findMany({
                where: { email: { equals: email, mode: 'insensitive' } },
                select: USER_SELECT,
            });
            if (matches.length > 1) {
                // Anti-enumeración: igual corremos verifyPassword contra
                // dummy para no leakear timing.
                await verifyPassword(password, DUMMY_HASH);
                return {
                    success: false,
                    message:
                        'Este email existe en varios negocios. Iniciá sesión desde el subdominio de tu negocio (ej. tunegocio.kpsula.app).',
                };
            }
            user = matches[0] ?? null;
        } else {
            // Modo subdomain: estricto por tenantId.
            user = await prisma.user.findFirst({
                where: { tenantId: tenantCtx.tenantId, email: { equals: email, mode: 'insensitive' } },
                select: USER_SELECT,
            });
        }

        // Comparar SIEMPRE contra un hash (real o dummy) para evitar enumeración
        // por timing. Si el usuario no existe el PBKDF2 corre igual y el atacante
        // no puede deducir si el email está registrado por la latencia.
        const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

        if (!user || !valid) {
            return { success: false, message: GENERIC_LOGIN_ERROR };
        }

        if (!user.isActive) {
            return { success: false, message: 'Cuenta desactivada. Contacta al admin.' };
        }

        // Auto-rehash silencioso para users legacy con password plain-text.
        // verifyPassword acepta plain-text (sin ':' en el hash) por
        // retrocompatibilidad, pero un dump de BD expondría las contraseñas.
        // Si el password almacenado NO tiene ':', es plain-text: lo
        // re-hasheamos con PBKDF2 y persistimos. Cero impacto para el user
        // (su login ya tuvo éxito) y best-effort: si la update falla, no
        // bloqueamos el login.
        if (user.passwordHash && !user.passwordHash.includes(':')) {
            try {
                const rehashed = await hashPassword(password);
                await prisma.user.update({
                    where: { id: user.id },
                    data: { passwordHash: rehashed },
                });
            } catch (err) {
                console.error('[auto-rehash] failed for user', user.id, err);
                // No interrumpe el login.
            }
        }

        // Resolver slug del tenant del usuario. Lo necesitamos en el JWT
        // (para el middleware cross-tenant guard) y como retorno para que
        // el client decida si redirige a <slug>.kpsula.app post-login.
        // Defensive: si la query falla, slug=null y el middleware no
        // bloquea (cae al chequeo server-side de resolveTenantContext).
        let tenantSlug: string | null = null;
        try {
            const t = await prisma.tenant.findUnique({
                where: { id: user.tenantId },
                select: { slug: true },
            });
            tenantSlug = t?.slug ?? null;
        } catch {
            // ignore
        }

        // Crear sesión segura. tokenVersion permite invalidar JWTs vivos
        // cuando se cambia rol/permisos/password en user.actions.
        // tenantId + tenantSlug viajan en el JWT desde Fase 3 — JWTs viejos
        // sin estos campos caen al fallback Shanklish vía resolveTenantContext().
        await createSession({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            allowedModules: user.allowedModules ?? null,
            grantedPerms: user.grantedPerms ?? null,
            revokedPerms: user.revokedPerms ?? null,
            tokenVersion: user.tokenVersion,
            tenantId: user.tenantId,
            tenantSlug: tenantSlug ?? undefined,
        });

        return {
            success: true,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role as import('@/types').UserRole,
            },
            tenantSlug,
        };
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, message: 'Error interno del servidor' };
    }
}

export async function logoutAction() {
    await deleteSession();
    redirect('/login');
}
