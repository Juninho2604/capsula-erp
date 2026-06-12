import LoginForm from './login-form-client';
import DemoCredentialsCard from './demo-credentials-card';
import { getSession } from '@/lib/auth';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import { isSuperAdmin } from '@/lib/super-admin';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { Archivo, Archivo_Black } from 'next/font/google';

// Tipografías de la identidad editorial, scoped al login (no globales).
const archivo = Archivo({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-archivo', display: 'swap' });
const archivoBlack = Archivo_Black({ subsets: ['latin'], weight: '400', variable: '--font-archivo-black', display: 'swap' });

export default async function LoginPage() {
    // Si ya existe sesión, redirigir al destino correcto según tenant.
    //
    // POR QUÉ EL REDIRECT VIVE ACÁ (server-side) Y NO EN EL CLIENTE:
    // Cuando loginAction (server action) termina, Next.js auto-revalida el
    // path actual (/login). Esta revalidación dispara un fetch RSC interno
    // que ejecuta de nuevo este server component — el redirect que devolvemos
    // acá es lo que el cliente sigue. Si intentábamos hacer
    // `window.location.href = subdomain` desde el cliente, competía con la
    // navegación interna que Next.js disparaba por la revalidación y ganaba
    // la RSC (que iba a `/dashboard` sin slug) → race condition + React
    // error #310. Server-side el redirect es atómico, sin race.
    const session = await getSession();
    if (session) {
        // Super admin → siempre /admin.
        if (isSuperAdmin(session.email)) {
            redirect('/admin');
        }
        // Si tenemos slug en el JWT Y estamos en el host raíz kpsula.app,
        // redirigir al subdomain del tenant. La cookie usa domain=.kpsula.app
        // (src/lib/auth.ts:111-112) así viaja al subdomain sin reloggear.
        const tenantSlug = (session as { tenantSlug?: string }).tenantSlug;
        const rawHost =
            headers().get('x-forwarded-host') ?? headers().get('host') ?? '';
        const host = rawHost.split(',')[0].split(':')[0].trim().toLowerCase();
        if (tenantSlug && host === 'kpsula.app') {
            redirect(`https://${tenantSlug}.kpsula.app/dashboard/home`);
        }
        // Cualquier otro caso (ya en subdomain correcto, host de dev, etc.)
        // → dashboard normal.
        redirect('/dashboard');
    }

    // Detectar si estamos en el subdomain de demo para mostrar cartelito de
    // credenciales públicas. resolveTenantContext devuelve el slug del host
    // server-side; el cartelito sólo se renderiza si slug === 'demo'.
    let demoMode = false;
    try {
        const ctx = await resolveTenantContext();
        demoMode = ctx.source === 'subdomain' && ctx.slug === 'demo';
    } catch {
        // Si no se puede resolver, no es demo. Continuar sin cartelito.
    }

    return (
        <div
            className={`${archivo.variable} ${archivoBlack.variable} relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12`}
            style={{
                background: '#F7E6E4',
                fontFamily: 'var(--font-archivo), system-ui, sans-serif',
                color: '#1A1D17',
            }}
        >
            {/* Logo KPSULA — cápsula roja rotada, identidad editorial */}
            <div className="mb-8 flex flex-col items-center gap-3 text-center">
                <span
                    className="inline-block rounded-full px-5 py-2"
                    style={{
                        background: '#E8432A',
                        color: '#F7E6E4',
                        fontFamily: 'var(--font-archivo-black), sans-serif',
                        fontSize: 18,
                        letterSpacing: '.04em',
                        transform: 'rotate(-1.5deg)',
                    }}
                >
                    KPSULA
                </span>
                <p
                    className="text-[11px] font-semibold uppercase"
                    style={{ letterSpacing: '.18em', color: '#1A1D17', opacity: 0.7 }}
                >
                    Software de gestión gastronómica
                </p>
            </div>

            {/* Card principal — panel delineado estilo carta */}
            <div className="w-full max-w-[400px]">
                <div
                    className="p-8"
                    style={{
                        background: '#F7E6E4',
                        border: '1.5px solid #E8432A',
                        borderRadius: 30,
                        transform: 'rotate(.25deg)',
                    }}
                >
                    <div className="mb-6" style={{ transform: 'rotate(-.25deg)' }}>
                        <h1
                            className="uppercase"
                            style={{
                                fontFamily: 'var(--font-archivo-black), sans-serif',
                                color: '#E8432A',
                                fontSize: 34,
                                lineHeight: 0.92,
                                letterSpacing: '-0.01em',
                            }}
                        >
                            Iniciar<br />sesión
                        </h1>
                        <p
                            className="mt-3 text-[11px] font-semibold uppercase"
                            style={{ letterSpacing: '.16em', color: '#1A1D17', opacity: 0.7 }}
                        >
                            Ingresa tus credenciales para continuar
                        </p>
                    </div>

                    <div style={{ transform: 'rotate(-.25deg)' }}>
                        <LoginForm />

                        {demoMode && <DemoCredentialsCard />}

                        <div className="mt-6 pt-5" style={{ borderTop: '1.5px solid rgba(232,67,42,.25)' }}>
                            <p className="text-center text-[11px] font-semibold uppercase" style={{ letterSpacing: '.12em', color: '#1A1D17', opacity: 0.55 }}>
                                ¿Olvidaste tu contraseña? Contacta al administrador del sistema.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <p
                className="mt-8 text-[10.5px] font-semibold uppercase"
                style={{ letterSpacing: '.16em', color: '#1A1D17', opacity: 0.45 }}
            >
                KPSULA ©2026 · Todos los derechos reservados
            </p>
        </div>
    );
}
