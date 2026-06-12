'use client';

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
            className="group relative w-full overflow-hidden px-4 py-3.5 text-[12px] font-bold uppercase tracking-[.16em] transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
                background: pending ? '#D03318' : '#E8432A',
                color: '#F7E6E4',
                borderRadius: 999,
                boxShadow: pending ? 'none' : '0 4px 14px rgba(232, 67, 42, 0.30)',
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
                    'Iniciar sesión'
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

        if (result?.success === false) {
            setError(result.message);
            return;
        }
        if (result?.success && result.user) {
            // Sincronizar Zustand con el usuario real del JWT antes de navegar.
            login(result.user);

            // Todo el redirect (super admin → /admin, root + tenantSlug →
            // subdomain del tenant, resto → /dashboard) vive server-side en
            // `src/app/login/page.tsx` y se dispara cuando ese server component
            // detecta sesión. Acá solo refrescamos el path para que el server
            // vea la session recién creada y devuelva el redirect.
            //
            // POR QUÉ NO HACEMOS `window.location.href = ...` ACÁ:
            // Cuando un server action termina, Next.js auto-revalida el path
            // actual. Esa revalidación re-ejecuta el server component de /login
            // y devuelve el redirect. Si además hacíamos `window.location.href`
            // desde el cliente, las dos navegaciones competían (race condition
            // entre el RSC fetch interno y la navegación browser cross-origin),
            // crashea React #310 y el browser quedaba en kpsula.app sin
            // redirigir al subdomain. Detalle en el commit de este fix.
            router.refresh();
        }
    };

    return (
        <form action={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="space-y-1.5">
                <label
                    htmlFor="email"
                    className="block text-[11px] font-semibold uppercase tracking-[.16em]"
                    style={{ color: '#1A1D17', opacity: 0.7 }}
                >
                    Correo electrónico
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
                    className="block w-full px-4 py-3 text-sm transition-all duration-150 outline-none"
                    style={{
                        background: '#F2DBD8',
                        border: '1.5px solid rgba(26,29,23,.18)',
                        borderRadius: 14,
                        color: '#1A1D17',
                    }}
                    onFocus={e => {
                        e.target.style.borderColor = '#E8432A';
                        e.target.style.boxShadow = '0 0 0 3px rgba(232, 67, 42, 0.12)';
                    }}
                    onBlur={e => {
                        e.target.style.borderColor = 'rgba(26,29,23,.18)';
                        e.target.style.boxShadow = '';
                    }}
                />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
                <label
                    htmlFor="password"
                    className="block text-[11px] font-semibold uppercase tracking-[.16em]"
                    style={{ color: '#1A1D17', opacity: 0.7 }}
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
                    className="block w-full px-4 py-3 text-sm transition-all duration-150 outline-none"
                    style={{
                        background: '#F2DBD8',
                        border: '1.5px solid rgba(26,29,23,.18)',
                        borderRadius: 14,
                        color: '#1A1D17',
                    }}
                    onFocus={e => {
                        e.target.style.borderColor = '#E8432A';
                        e.target.style.boxShadow = '0 0 0 3px rgba(232, 67, 42, 0.12)';
                    }}
                    onBlur={e => {
                        e.target.style.borderColor = 'rgba(26,29,23,.18)';
                        e.target.style.boxShadow = '';
                    }}
                />
            </div>

            {/* Error */}
            {error && (
                <div
                    className="flex items-start gap-3 px-4 py-3 text-sm"
                    style={{ background: '#F7E3DB', border: '1.5px solid #E8432A', borderRadius: 14, color: '#B04A2E' }}
                >
                    <span>{error}</span>
                </div>
            )}

            <SubmitButton />
        </form>
    );
}
