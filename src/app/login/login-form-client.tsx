'use client';

import { computePostLoginUrl } from '@/lib/post-login-redirect';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginAction } from '@/app/actions/auth.actions';
import { useFormStatus } from 'react-dom';
import { useAuthStore } from '@/stores/auth.store';

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            disabled={pending}
            className="group relative w-full overflow-hidden rounded-xl px-4 py-3.5 text-sm font-semibold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
                background: pending
                    ? '#E85A3A'
                    : 'linear-gradient(135deg, #FF6B4A 0%, #E85A3A 100%)',
                boxShadow: pending ? 'none' : '0 4px 14px rgba(255, 107, 74, 0.35)',
            }}
        >
            {/* Hover shimmer */}
            <span className="absolute inset-0 -translate-x-full skew-x-12 bg-white/10 transition-transform duration-500 group-hover:translate-x-full" />
            <span className="relative flex items-center justify-center gap-2">
                {pending ? (
                    <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        Validando...
                    </>
                ) : (
                    'Iniciar Sesión'
                )}
            </span>
        </button>
    );
}

export default function LoginForm() {
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const login = useAuthStore(s => s.login);

    const handleSubmit = async (formData: FormData) => {
        setError(null);
        const result: any = await loginAction(null, formData);

        // [DEBUG redirect — borrar tras diagnosticar]
        // eslint-disable-next-line no-console
        console.log('[login-debug] loginAction result:', {
            success: result?.success,
            isSuperAdmin: result?.isSuperAdmin,
            tenantSlug: result?.tenantSlug,
            userRole: result?.user?.role,
            message: result?.message,
            host: typeof window !== 'undefined' ? window.location.host : '(ssr)',
        });

        if (result?.success === false) {
            // eslint-disable-next-line no-console
            console.log('[login-debug] branch=error, message:', result.message);
            setError(result.message);
        } else if (result?.success && result.user) {
            // Sincronizar Zustand con el usuario real del JWT antes de navegar
            login(result.user);

            // Super admin → directo al Panel KPSULA. Toggle al dashboard
            // disponible en el header de /admin. Reload completo para que
            // el middleware recoja la cookie de sesión recién creada.
            if (result.isSuperAdmin) {
                // eslint-disable-next-line no-console
                console.log('[login-debug] branch=superAdmin → /admin');
                window.location.href = '/admin';
                return;
            }

            // ── Redirect inteligente al subdomain del tenant ────────────
            // Si el user pertenece a un tenant con slug y estamos en root
            // (kpsula.app), navegamos a <slug>.kpsula.app. La cookie usa
            // domain=.kpsula.app en producción (src/lib/auth.ts), así
            // viaja al subdomain sin reloggear.
            //
            // Defensa: si la URL no se puede calcular (sin slug, host
            // no-kpsula, dev mode), caemos al router.push de toda la vida.
            // Cero downgrade si algo falla.
            const target = computePostLoginUrl(result.tenantSlug ?? null);
            // eslint-disable-next-line no-console
            console.log('[login-debug] computePostLoginUrl returned:', target);
            if (target) {
                // eslint-disable-next-line no-console
                console.log('[login-debug] branch=redirect → window.location.href =', target);
                window.location.href = target;
            } else {
                // eslint-disable-next-line no-console
                console.log('[login-debug] branch=fallback → router.push(/dashboard/home)');
                router.push('/dashboard/home');
            }
        }
    };

    return (
        <form action={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="space-y-1.5">
                <label
                    htmlFor="email"
                    className="block text-xs font-semibold uppercase tracking-widest text-gray-500"
                >
                    Correo Electrónico
                </label>
                <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className="block w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 transition-all duration-150 outline-none"
                    style={{
                        '--tw-ring-color': '#FF6B4A',
                    } as React.CSSProperties}
                    onFocus={e => {
                        e.target.style.borderColor = '#FF6B4A';
                        e.target.style.boxShadow = '0 0 0 3px rgba(255, 107, 74, 0.12)';
                        e.target.style.background = '#fff';
                    }}
                    onBlur={e => {
                        e.target.style.borderColor = '';
                        e.target.style.boxShadow = '';
                        e.target.style.background = '';
                    }}
                />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
                <label
                    htmlFor="password"
                    className="block text-xs font-semibold uppercase tracking-widest text-gray-500"
                >
                    Contraseña
                </label>
                <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    className="block w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 transition-all duration-150 outline-none"
                    onFocus={e => {
                        e.target.style.borderColor = '#FF6B4A';
                        e.target.style.boxShadow = '0 0 0 3px rgba(255, 107, 74, 0.12)';
                        e.target.style.background = '#fff';
                    }}
                    onBlur={e => {
                        e.target.style.borderColor = '';
                        e.target.style.boxShadow = '';
                        e.target.style.background = '';
                    }}
                />
            </div>

            {/* Error */}
            {error && (
                <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                    <span className="mt-px shrink-0"></span>
                    <span>{error}</span>
                </div>
            )}

            <SubmitButton />
        </form>
    );
}
