import LoginForm from './login-form-client';
import DemoCredentialsCard from './demo-credentials-card';
import { getSession } from '@/lib/auth';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import { isSuperAdmin } from '@/lib/super-admin';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import CapsulaLogo from '@/components/ui/CapsulaLogo';

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
            className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12"
            style={{
                background: 'linear-gradient(145deg, #FF6B4A 0%, #E85A3A 38%, #2A4060 72%, #1B2D45 100%)',
            }}
        >
            {/* Noise texture overlay — da profundidad sin ruido */}
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.03]"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
                    backgroundSize: '128px 128px',
                }}
            />

            {/* Glow orbs decorativos */}
            <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-white/5 blur-3xl" />

            {/* Logo + Tagline — sobre la card */}
            <div className="mb-8 flex flex-col items-center gap-2 text-center">
                <CapsulaLogo
                    variant="full"
                    size={44}
                    tone="ivory"
                />
                <p className="mt-1 text-sm font-medium tracking-wide text-white/60">
                    El ERP inteligente para tu restaurante
                </p>
            </div>

            {/* Card principal */}
            <div className="w-full max-w-[400px]">
                <div
                    className="rounded-2xl p-8 shadow-2xl"
                    style={{
                        background: 'rgba(255, 255, 255, 0.97)',
                        boxShadow: '0 32px 64px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.15)',
                        backdropFilter: 'blur(16px)',
                    }}
                >
                    <div className="mb-6">
                        <h1
                            className="text-2xl text-gray-900"
                            style={{ fontFamily: "'Nunito', system-ui, sans-serif", fontWeight: 800 }}
                        >
                            Iniciar Sesión
                        </h1>
                        <p className="mt-1 text-sm text-gray-500">
                            Ingresa tus credenciales para continuar
                        </p>
                    </div>

                    <LoginForm />

                    {demoMode && <DemoCredentialsCard />}

                    <div className="mt-6 border-t border-gray-100 pt-5">
                        <p className="text-center text-xs text-gray-400">
                            ¿Olvidaste tu contraseña?{' '}
                            <span className="font-medium text-gray-500">
                                Contacta al administrador del sistema.
                            </span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <p className="mt-8 text-xs text-white/30 tracking-wider">
                © 2026 CÁPSULA · Todos los derechos reservados
            </p>
        </div>
    );
}
