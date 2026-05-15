
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from './lib/auth';
import { extractTenantSlugFromHost } from './lib/tenant-context';
import { isSuperAdmin } from './lib/super-admin';

/**
 * Construye una URL absoluta para redirect/rewrite usando el HOST real
 * del request (kpsula.app, foo.kpsula.app, etc) en lugar de `request.url`
 * que en Next.js detrás de un proxy reverso (nginx en el VPS) puede
 * resolver a `http://localhost:3000`. Bug observado: al hacer
 * `siteUrl(request, '/login')` el redirect mandaba a localhost.
 * `request.nextUrl` siempre respeta el host externo correcto.
 */
function siteUrl(request: NextRequest, target: string): URL {
    const u = request.nextUrl.clone();
    const [pathname, search] = target.split('?');
    u.pathname = pathname;
    u.search = search ? `?${search}` : '';
    return u;
}

export async function middleware(request: NextRequest) {
    const path = request.nextUrl.pathname;

    // Paso C multi-tenant — passive subdomain extraction.
    // Si el host es `<slug>.kpsula.app` → setea x-tenant-slug en el request
    // header para que el downstream (server components / actions / route
    // handlers) lo lea vía resolveTenantContext(). Hosts no-kpsula (Vercel
    // preview, IP raw, otros dominios) devuelven null → header NO se setea
    // → fallback a Shanklish vía resolveTenantContext().
    //
    // Pasivo: nadie llama a resolveTenantContext() en runtime todavía. El
    // header existe pero no afecta comportamiento hasta Paso D.
    const tenantSlug = extractTenantSlugFromHost(request.headers.get('host'));

    // 0. MAINTENANCE MODE — durante migración de BD u operaciones críticas.
    //    Activado vía env var MAINTENANCE_MODE=true en Vercel.
    //    Bloquea todas las rutas excepto la página /maintenance, assets de
    //    Next.js, y el endpoint de health para monitoreo externo.
    if (process.env.MAINTENANCE_MODE === 'true') {
        const allowedDuringMaintenance =
            path === '/maintenance' ||
            path.startsWith('/_next/') ||
            path === '/favicon.ico' ||
            path === '/robots.txt' ||
            path === '/api/health';

        if (!allowedDuringMaintenance) {
            // APIs → 503 JSON para que clientes no rompan parseando HTML
            if (path.startsWith('/api/')) {
                return new NextResponse(
                    JSON.stringify({
                        error: 'maintenance',
                        message: 'Servicio en mantenimiento. Intenta de nuevo en unos minutos.',
                    }),
                    {
                        status: 503,
                        headers: {
                            'Content-Type': 'application/json',
                            'Retry-After': '60',
                        },
                    }
                );
            }
            // Páginas → rewrite a /maintenance (sin cambiar URL para que F5 no rompa)
            return NextResponse.rewrite(siteUrl(request, '/maintenance'));
        }
        return NextResponse.next();
    }

    const sessionCookie = request.cookies.get('session')?.value;
    const session = await decrypt(sessionCookie || '');

    // 1. Protección Base: Login requerido
    if (path.startsWith('/dashboard') && !session) {
        return NextResponse.redirect(siteUrl(request, '/login'));
    }

    // 1.b /admin/* — solo emails en SUPER_ADMIN_EMAILS. Sin sesión o sin
    // estar en la allowlist responde 404 directo (no leakeamos que la ruta
    // existe). El layout además repite el chequeo defense-in-depth.
    if (path.startsWith('/admin')) {
        if (!session || !isSuperAdmin(session.email)) {
            return new NextResponse('Not Found', { status: 404 });
        }
    }

    // 2. Redirección Login -> Dashboard
    if (path.startsWith('/login') && session) {
        return NextResponse.redirect(siteUrl(request, '/dashboard'));
    }

    // 3. Control de Accesos (RBAC)
    if (session) {
        const userRole = session.role;

        // A. Gestión de Usuarios: Solo Dueños y Gerentes Admin
        if (path.startsWith('/dashboard/usuarios')) {
            const allowed = ['OWNER', 'ADMIN_MANAGER'];
            if (!allowed.includes(userRole)) {
                return NextResponse.redirect(siteUrl(request, '/dashboard?error=unauthorized_users'));
            }
        }

        // B. Auditorías e Importación: Dueños, Gerentes, Auditores
        if (path.startsWith('/dashboard/inventario/auditorias') || path.startsWith('/dashboard/inventario/importar')) {
            const allowed = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AUDITOR'];
            if (!allowed.includes(userRole)) {
                return NextResponse.redirect(siteUrl(request, '/dashboard?error=unauthorized_audit'));
            }
        }

        // C. Configuración Global
        if (path.startsWith('/dashboard/config')) {
            const allowed = ['OWNER'];
            if (!allowed.includes(userRole)) {
                return NextResponse.redirect(siteUrl(request, '/dashboard?error=unauthorized_config'));
            }
        }
    }

    // Setear x-tenant-slug en el request header solo si extrajimos un slug
    // válido. El downstream lo lee vía resolveTenantContext() (dormante).
    if (tenantSlug) {
        const headers = new Headers(request.headers);
        headers.set('x-tenant-slug', tenantSlug);
        return NextResponse.next({ request: { headers } });
    }
    return NextResponse.next();
}

export const config = {
    matcher: [
        // Cubre todas las rutas excepto recursos estáticos de Next y favicon.
        // Esto es importante para que MAINTENANCE_MODE intercepte también /,
        // /api/*, etc. — no solo /dashboard y /login.
        '/((?!_next/static|_next/image|favicon\\.ico).*)',
    ],
};

