'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { signupTenantAction, type SignupState } from '@/app/actions/signup.actions';
import { Check, ExternalLink } from 'lucide-react';

const TENANT_ROOT_DOMAIN = 'kpsula.app';

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            disabled={pending}
            className="pos-btn w-full py-3 inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {pending ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
    );
}

export default function SignupForm() {
    const [state, formAction] = useActionState<SignupState, FormData>(
        signupTenantAction,
        null,
    );
    const [slugPreview, setSlugPreview] = useState('mitiendaa');

    // Auto-redirect cross-subdomain tras éxito. El token de bootstrap (60s)
    // viaja en la URL y el endpoint /auth/bootstrap del subdomain lo canjea
    // por una cookie de sesión local antes de mandar al /dashboard.
    useEffect(() => {
        if (state?.success && typeof window !== 'undefined') {
            const t = window.setTimeout(() => {
                window.location.href = state.loginUrl;
            }, 1200);
            return () => window.clearTimeout(t);
        }
    }, [state]);

    if (state?.success) {
        return (
            <div className="pos-card p-6 text-center space-y-4">
                <div className="mx-auto h-12 w-12 rounded-full bg-[#E5EDE7] flex items-center justify-center">
                    <Check className="h-6 w-6 text-[#2F6B4E]" />
                </div>
                <div>
                    <h2 className="text-xl font-semibold tracking-[-0.02em] text-capsula-ink">
                        Cuenta creada
                    </h2>
                    <p className="mt-2 text-sm text-capsula-ink-soft">
                        Entrando a{' '}
                        <span className="font-semibold text-capsula-ink">
                            {state.tenantSlug}.{TENANT_ROOT_DOMAIN}
                        </span>
                        …
                    </p>
                </div>
                <a
                    href={state.loginUrl}
                    className="pos-btn w-full py-3 inline-flex items-center justify-center gap-2"
                >
                    Ir ahora <ExternalLink className="h-4 w-4" />
                </a>
                <p className="text-[11px] uppercase tracking-[0.14em] text-capsula-ink-muted">
                    Te redirigimos automáticamente en un segundo.
                </p>
            </div>
        );
    }

    const error = state?.success === false ? state : null;

    return (
        <form action={formAction} className="pos-card p-6 space-y-5">
            {/* Nombre del negocio */}
            <div className="space-y-2">
                <label className="pos-label" htmlFor="businessName">
                    Nombre del negocio
                </label>
                <input
                    type="text"
                    name="businessName"
                    id="businessName"
                    required
                    minLength={2}
                    maxLength={100}
                    placeholder="Ej: Mi Tienda"
                    className="pos-input w-full"
                />
                {error?.field === 'businessName' && (
                    <p className="text-xs text-capsula-coral">{error.message}</p>
                )}
            </div>

            {/* Slug + preview de subdomain */}
            <div className="space-y-2">
                <label className="pos-label" htmlFor="slug">
                    Identificador (URL)
                </label>
                <input
                    type="text"
                    name="slug"
                    id="slug"
                    required
                    pattern="[a-z0-9][a-z0-9-]{1,29}"
                    minLength={2}
                    maxLength={30}
                    placeholder="mitiendaa"
                    onChange={(e) => setSlugPreview(e.target.value.toLowerCase() || 'mitiendaa')}
                    className="pos-input w-full lowercase"
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                />
                <p className="text-[11px] text-capsula-ink-muted">
                    Tu URL será{' '}
                    <span className="font-mono font-semibold text-capsula-ink">
                        https://{slugPreview}.{TENANT_ROOT_DOMAIN}
                    </span>
                </p>
                {error?.field === 'slug' && (
                    <p className="text-xs text-capsula-coral">{error.message}</p>
                )}
            </div>

            {/* Nombre + Apellido del owner */}
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                    <label className="pos-label" htmlFor="firstName">
                        Tu nombre
                    </label>
                    <input
                        type="text"
                        name="firstName"
                        id="firstName"
                        required
                        minLength={1}
                        maxLength={50}
                        className="pos-input w-full"
                    />
                    {error?.field === 'firstName' && (
                        <p className="text-xs text-capsula-coral">{error.message}</p>
                    )}
                </div>
                <div className="space-y-2">
                    <label className="pos-label" htmlFor="lastName">
                        Apellido
                    </label>
                    <input
                        type="text"
                        name="lastName"
                        id="lastName"
                        required
                        minLength={1}
                        maxLength={50}
                        className="pos-input w-full"
                    />
                    {error?.field === 'lastName' && (
                        <p className="text-xs text-capsula-coral">{error.message}</p>
                    )}
                </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
                <label className="pos-label" htmlFor="email">
                    Email
                </label>
                <input
                    type="email"
                    name="email"
                    id="email"
                    required
                    maxLength={200}
                    autoComplete="email"
                    className="pos-input w-full"
                />
                {error?.field === 'email' && (
                    <p className="text-xs text-capsula-coral">{error.message}</p>
                )}
            </div>

            {/* Password */}
            <div className="space-y-2">
                <label className="pos-label" htmlFor="password">
                    Contraseña
                </label>
                <input
                    type="password"
                    name="password"
                    id="password"
                    required
                    minLength={8}
                    maxLength={200}
                    autoComplete="new-password"
                    className="pos-input w-full"
                />
                <p className="text-[11px] text-capsula-ink-muted">
                    Mínimo 8 caracteres.
                </p>
                {error?.field === 'password' && (
                    <p className="text-xs text-capsula-coral">{error.message}</p>
                )}
            </div>

            {/* Error global (sin field) */}
            {error && !error.field && (
                <div className="rounded-2xl border border-capsula-line bg-[#F7E3DB] p-3 text-sm text-[#B04A2E]">
                    {error.message}
                </div>
            )}

            <SubmitButton />

            <p className="text-center text-[11px] uppercase tracking-[0.14em] text-capsula-ink-muted">
                ¿Ya tenés cuenta?{' '}
                <a href="/login" className="font-semibold text-capsula-navy-deep hover:text-capsula-coral">
                    Iniciar sesión
                </a>
            </p>
        </form>
    );
}
