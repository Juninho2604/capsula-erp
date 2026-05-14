'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, AlertTriangle, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { createTenantAction } from '../actions';

const TENANT_ROOT_DOMAIN = 'kpsula.app';

export default function NewTenantForm() {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

    const [slug, setSlug] = useState('');
    const [name, setName] = useState('');
    const [ownerEmail, setOwnerEmail] = useState('');
    const [ownerPassword, setOwnerPassword] = useState('');
    const [ownerFirstName, setOwnerFirstName] = useState('');
    const [ownerLastName, setOwnerLastName] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const slugPreview = slug
        ? `https://${slug}.${TENANT_ROOT_DOMAIN}`
        : `https://<slug>.${TENANT_ROOT_DOMAIN}`;

    const slugValid = /^[a-z0-9][a-z0-9-]{1,29}$/.test(slug);

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        startTransition(async () => {
            const res = await createTenantAction({
                slug,
                name,
                ownerEmail,
                ownerPassword,
                ownerFirstName,
                ownerLastName,
            });
            if (res.success && res.tenantId) {
                router.push(`/admin/tenants/${res.tenantId}`);
                router.refresh();
            } else {
                setToast({ kind: 'err', msg: res.message });
                window.setTimeout(() => setToast(null), 6000);
            }
        });
    }

    function generatePassword() {
        const alphabet =
            'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
        const bytes = globalThis.crypto.getRandomValues(new Uint8Array(12));
        let out = '';
        for (let i = 0; i < bytes.length; i++) out += alphabet[bytes[i] % alphabet.length];
        setOwnerPassword(out);
        setShowPassword(true);
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {toast && (
                <div
                    className={
                        toast.kind === 'ok'
                            ? 'rounded-2xl border border-capsula-line bg-[#E5EDE7] px-4 py-3 text-sm text-[#2F6B4E] inline-flex items-center gap-2'
                            : 'rounded-2xl border border-capsula-line bg-[#F7E3DB] px-4 py-3 text-sm text-[#B04A2E] inline-flex items-center gap-2'
                    }
                >
                    {toast.kind === 'ok' ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    {toast.msg}
                </div>
            )}

            <section className="rounded-3xl border border-capsula-line bg-capsula-ivory-surface p-5 space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                    Tenant
                </h2>
                <Field label="Nombre del negocio" hint="Visible en login, recibos, etc.">
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="pos-input"
                        maxLength={100}
                        required
                        placeholder="Sello Criollo"
                    />
                </Field>
                <Field
                    label="Slug (subdominio)"
                    hint="2-30 chars, minúsculas / dígitos / guiones; empieza por letra o dígito. NO se puede cambiar después."
                >
                    <input
                        value={slug}
                        onChange={(e) => setSlug(e.target.value.toLowerCase())}
                        className="pos-input font-mono"
                        maxLength={30}
                        required
                        placeholder="sellocriollo"
                    />
                    <div className="mt-1 text-xs text-capsula-ink-muted">
                        URL final:{' '}
                        <span
                            className={
                                slugValid
                                    ? 'font-mono text-capsula-navy-deep'
                                    : 'font-mono text-capsula-ink-muted'
                            }
                        >
                            {slugPreview}
                        </span>
                    </div>
                </Field>
            </section>

            <section className="rounded-3xl border border-capsula-line bg-capsula-ivory-surface p-5 space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                    Usuario OWNER
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Nombre">
                        <input
                            value={ownerFirstName}
                            onChange={(e) => setOwnerFirstName(e.target.value)}
                            className="pos-input"
                            maxLength={50}
                            required
                            placeholder="Juan"
                        />
                    </Field>
                    <Field label="Apellido">
                        <input
                            value={ownerLastName}
                            onChange={(e) => setOwnerLastName(e.target.value)}
                            className="pos-input"
                            maxLength={50}
                            required
                            placeholder="Pérez"
                        />
                    </Field>
                </div>
                <Field label="Email" hint="Será su login. No se puede cambiar a otro tenant después.">
                    <input
                        type="email"
                        value={ownerEmail}
                        onChange={(e) => setOwnerEmail(e.target.value.toLowerCase())}
                        className="pos-input"
                        maxLength={200}
                        required
                        placeholder="juan@sellocriollo.com"
                    />
                </Field>
                <Field
                    label="Password inicial"
                    hint="Mín 8 chars. El owner debe cambiarla al primer login."
                >
                    <div className="flex items-center gap-2">
                        <div className="flex-1 relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={ownerPassword}
                                onChange={(e) => setOwnerPassword(e.target.value)}
                                className="pos-input pr-9"
                                minLength={8}
                                maxLength={200}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((v) => !v)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-capsula-ink-muted hover:bg-capsula-coral/10 hover:text-capsula-coral"
                                title={showPassword ? 'Ocultar' : 'Mostrar'}
                            >
                                {showPassword ? (
                                    <EyeOff className="h-3.5 w-3.5" />
                                ) : (
                                    <Eye className="h-3.5 w-3.5" />
                                )}
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={generatePassword}
                            className="pos-btn-secondary inline-flex items-center gap-1 px-3 py-2 text-sm"
                            title="Generar password aleatoria"
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Generar
                        </button>
                    </div>
                </Field>
            </section>

            <div className="flex justify-end gap-2">
                <button
                    type="button"
                    onClick={() => router.push('/admin/tenants')}
                    className="pos-btn-secondary px-4 py-2 text-sm"
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    disabled={pending}
                    className="pos-btn inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
                >
                    <Check className="h-4 w-4" />
                    {pending ? 'Creando…' : 'Crear tenant'}
                </button>
            </div>
        </form>
    );
}

function Field({
    label,
    hint,
    children,
}: {
    label: string;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <label className="block">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                {label}
            </div>
            {children}
            {hint && <div className="mt-1 text-xs text-capsula-ink-muted">{hint}</div>}
        </label>
    );
}
