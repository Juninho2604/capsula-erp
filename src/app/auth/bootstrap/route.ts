import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/server/db';
import { createSession } from '@/lib/auth';
import { verifyBootstrapToken } from '@/lib/signup/bootstrap-token';

/**
 * GET /auth/bootstrap?t=<jwt>
 *
 * Endpoint que canjea un bootstrap token (emitido por /signup en el root
 * domain) por una cookie `session` válida en el subdomain del tenant.
 *
 * Diseño:
 *   1. Verifica el JWT (firma + expiración + kind="signup-bootstrap").
 *   2. Carga el usuario fresh desde BD, validando que el tenantId coincida
 *      con el del token. Esto previene replay con un token de otro tenant.
 *   3. Llama `createSession()` con el snapshot actual del usuario.
 *   4. Redirige a `/dashboard`.
 *
 * En caso de token inválido / expirado / usuario inactivo → redirect a
 * `/login` (silencioso). No leakea info para no facilitar enumeration.
 *
 * Este endpoint existe en TODA la app (incluyendo Vercel y cualquier otro
 * deploy), pero solo acepta tokens firmados con JWT_SECRET vigente, así que
 * no abre superficie de ataque más allá del JWT secret mismo.
 */
export async function GET(req: NextRequest) {
    const token = req.nextUrl.searchParams.get('t');
    if (!token) {
        return NextResponse.redirect(new URL('/login', req.url));
    }

    const payload = await verifyBootstrapToken(token);
    if (!payload) {
        return NextResponse.redirect(new URL('/login?bootstrap=expired', req.url));
    }

    const user = await prisma.user.findFirst({
        where: {
            id: payload.userId,
            tenantId: payload.tenantId,
            isActive: true,
        },
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            allowedModules: true,
            grantedPerms: true,
            revokedPerms: true,
            tokenVersion: true,
            tenantId: true,
        },
    });
    if (!user) {
        return NextResponse.redirect(new URL('/login', req.url));
    }

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
    });

    return NextResponse.redirect(new URL('/dashboard', req.url));
}
