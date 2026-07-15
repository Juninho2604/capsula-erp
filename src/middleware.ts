
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from './lib/auth';
import { extractTenantSlugFromHost } from './lib/tenant-context';
import { isSuperAdmin } from './lib/super-admin';

/**
 * Construye una URL absoluta para redirect/rewrite usando el HOST público
 * real del request (kpsula.app, foo.kpsula.app) en lugar de `request.url`
 * o `request.nextUrl` que en Next.js 14 standalone detrás de un proxy
 * reverso (nginx en el VPS) resuelven a `http://localhost:3000` porque
 * el server bindea a ese host y NO honra el header `Host` para construir
 * la URL del request.
 *
 * Bug histórico: PR #189 (15 mayo 2026) intentó arreglarlo cambiando
 * `new URL('/x', request.url)` por `request.nextUrl.clone()`. Funcionó
 * un tiempo pero volvió a romperse (probablemente al actualizar Next.js
 * o por cómo se construye `nextUrl` en standalone mode).
 *
 * Fix definitivo: leer headers `X-Forwarded-Host` / `Host` directamente
 * — nginx los forwardea correctamente (`proxy_set_header Host $host`).
 * Solo aceptamos hosts conocidos (kpsula.app y subdominios) para
 * defenderse de Host Header injection. Cualquier otro host cae al
 * comportamiento previo (request.nextUrl) — útil en dev/local.
 */
function siteUrl(request: NextRequest, target: string): URL {
    const rawHost =
        request.headers.get('x-forwarded-host') ??
        request.headers.get('host') ??
        '';
    const host = rawHost.split(',')[0].trim().toLowerCase();
    const proto =
        (request.headers.get('x-forwarded-proto') ?? '').split(',')[0].trim() ||
        request.nextUrl.protocol.replace(':', '') ||
        'https';

    const [pathname, search] = target.split('?');
    // Hosts extra de confianza para despliegues locales (servidor del
    // restaurante, ver docs/LOCAL_SERVER.md). CSV en env, ej.:
    //   EXTRA_TRUSTED_HOSTS="192.168.1.10,capsula.local"
    // El match ignora el puerto (la tablet puede pegar a :80 vía nginx o
    // :3000 directo) pero la URL reconstruida conserva host:puerto tal como
    // llegó. Vacío en el VPS público → no-op, comportamiento histórico.
    const extraTrusted = (process.env.EXTRA_TRUSTED_HOSTS ?? '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    const hostSinPuerto = host.split(':')[0];
    const isTrustedHost =
        host === 'kpsula.app' ||
        host.endsWith('.kpsula.app') ||
        extraTrusted.includes(hostSinPuerto);

    if (isTrustedHost) {
        const u = new URL(`${proto}://${host}${pathname}`);
        if (search) u.search = `?${search}`;
        return u;
    }

    // Fallback dev/local: comportamiento histórico (nextUrl).
    const u = request.nextUrl.clone();
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

    // 1.a Cross-tenant guard — defensa contra el robo de sesión vía
    // cookie cross-subdomain.
    //
    // Cookie de sesión tiene domain=.kpsula.app → viaja a CUALQUIER
    // subdomain. Sin este chequeo, un user logueado en shanklish.kpsula.app
    // podría visitar tenantB.kpsula.app/dashboard con su cookie y todas
    // las queries server-side terminarían operando sobre tenantB (porque
    // resolveTenantContext() prioriza el subdomain del host).
    //
    // Comparamos a nivel de SLUG (no tenantId) porque middleware corre en
    // Edge runtime sin Prisma. El slug viaja en el JWT desde login (campo
    // session.tenantSlug); el slug del host viene del header. Si difieren
    // y el user NO es super admin, redirect a /login + clear cookie.
    //
    // Si el JWT es viejo y no tiene tenantSlug (compatibilidad pre-Fase 3),
    // dejamos pasar — resolveTenantContext() en server-side validará
    // tenantId contra DB y rechazará si corresponde.
    if (session && tenantSlug && session.tenantSlug && !isSuperAdmin(session.email)) {
        if (session.tenantSlug !== tenantSlug) {
            const redirectUrl = siteUrl(request, '/login?error=wrong_tenant');
            const res = NextResponse.redirect(redirectUrl);
            res.cookies.delete('session');
            return res;
        }
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

