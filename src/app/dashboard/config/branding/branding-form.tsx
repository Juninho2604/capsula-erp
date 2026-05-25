'use client';

import { useState, useTransition } from 'react';
import { Check, ImageOff, Save, Upload, AlertTriangle } from 'lucide-react';
import {
    updateTenantBrandingAction,
    type TenantBranding,
} from '@/app/actions/branding.actions';

interface Props {
    initialBranding: TenantBranding;
}

export function BrandingForm({ initialBranding }: Props) {
    const [branding, setBranding] = useState(initialBranding);
    const [pending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
    const [uploading, setUploading] = useState(false);

    function update<K extends keyof TenantBranding>(key: K, value: TenantBranding[K]) {
        setBranding((prev) => ({ ...prev, [key]: value }));
    }

    async function handleLogoUpload(file: File) {
        if (file.size > 2 * 1024 * 1024) {
            setMessage({ type: 'err', text: 'El logo no puede pesar más de 2 MB.' });
            return;
        }
        if (!file.type.startsWith('image/')) {
            setMessage({ type: 'err', text: 'Solo se aceptan archivos de imagen.' });
            return;
        }
        setUploading(true);
        setMessage(null);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await fetch('/api/upload', { method: 'POST', body: fd });
            const json = await res.json();
            if (!res.ok || !json.success || !json.data?.url) {
                throw new Error(json.error ?? 'Error subiendo el archivo');
            }
            update('logoUrl', json.data.url);
            setMessage({ type: 'ok', text: 'Logo cargado. Guardá los cambios para activarlo.' });
        } catch (err) {
            setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Error subiendo el logo' });
        } finally {
            setUploading(false);
        }
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setMessage(null);
        startTransition(async () => {
            const result = await updateTenantBrandingAction({
                displayName: branding.displayName ?? '',
                legalName: branding.legalName ?? '',
                taxId: branding.taxId ?? '',
                logoUrl: branding.logoUrl ?? '',
            });
            if (result.success && result.branding) {
                setBranding(result.branding);
                setMessage({ type: 'ok', text: 'Cambios guardados.' });
            } else {
                setMessage({ type: 'err', text: result.message ?? 'Error guardando' });
            }
        });
    }

    return (
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
            {/* ── Form ──────────────────────────────────────────────────── */}
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="rounded-2xl border border-capsula-line bg-capsula-ivory-surface p-6">
                    <div className="space-y-5">
                        <Field
                            label="Nombre comercial"
                            hint="Se muestra arriba de todo. No se puede editar acá (cambiarlo afecta el subdomain)."
                        >
                            <input
                                type="text"
                                value={branding.name}
                                disabled
                                className="w-full rounded-xl border border-capsula-line bg-capsula-ivory-alt px-3 py-2.5 text-sm text-capsula-ink-muted"
                            />
                        </Field>

                        <Field
                            label="Nombre corto"
                            hint='Aparece en headers compactos (ej. "Shanklish Delivery"). Si lo dejás vacío usamos el nombre comercial.'
                        >
                            <input
                                type="text"
                                value={branding.displayName ?? ''}
                                onChange={(e) => update('displayName', e.target.value)}
                                placeholder={branding.name}
                                maxLength={50}
                                className="w-full rounded-xl border border-capsula-line bg-capsula-ivory px-3 py-2.5 text-sm text-capsula-ink focus:outline-none focus:ring-2 focus:ring-capsula-coral/40"
                            />
                        </Field>

                        <Field
                            label="Razón social"
                            hint='Nombre legal completo (ej. "Shanklish Caracas, C.A."). Se imprime en recibos si no hay logo.'
                        >
                            <input
                                type="text"
                                value={branding.legalName ?? ''}
                                onChange={(e) => update('legalName', e.target.value)}
                                placeholder="Mi Negocio, C.A."
                                maxLength={120}
                                className="w-full rounded-xl border border-capsula-line bg-capsula-ivory px-3 py-2.5 text-sm text-capsula-ink focus:outline-none focus:ring-2 focus:ring-capsula-coral/40"
                            />
                        </Field>

                        <Field
                            label="RIF / NIT / ID fiscal"
                            hint="Aparece en cada recibo (ej. J-12345678-9). Si lo dejás vacío, el recibo no muestra esta línea."
                        >
                            <input
                                type="text"
                                value={branding.taxId ?? ''}
                                onChange={(e) => update('taxId', e.target.value)}
                                placeholder="J-12345678-9"
                                maxLength={30}
                                className="w-full rounded-xl border border-capsula-line bg-capsula-ivory px-3 py-2.5 text-sm text-capsula-ink focus:outline-none focus:ring-2 focus:ring-capsula-coral/40"
                            />
                        </Field>

                        <Field
                            label="Logo"
                            hint="PNG o JPG, máximo 2 MB. Se imprime arriba del recibo. Recomendado: 240×120 px fondo transparente."
                        >
                            <div className="space-y-2">
                                <input
                                    type="url"
                                    value={branding.logoUrl ?? ''}
                                    onChange={(e) => update('logoUrl', e.target.value)}
                                    placeholder="https://... o /uploads/..."
                                    className="w-full rounded-xl border border-capsula-line bg-capsula-ivory px-3 py-2.5 text-sm text-capsula-ink focus:outline-none focus:ring-2 focus:ring-capsula-coral/40"
                                />
                                <label className="inline-flex items-center gap-2 cursor-pointer rounded-xl border border-capsula-line bg-capsula-ivory px-3 py-2 text-xs font-semibold text-capsula-ink hover:bg-capsula-ivory-alt">
                                    <Upload className="h-4 w-4" />
                                    {uploading ? 'Subiendo...' : 'Subir desde archivo'}
                                    <input
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp"
                                        className="hidden"
                                        disabled={uploading}
                                        onChange={(e) => {
                                            const f = e.target.files?.[0];
                                            if (f) handleLogoUpload(f);
                                            e.target.value = '';
                                        }}
                                    />
                                </label>
                            </div>
                        </Field>
                    </div>
                </div>

                {message && (
                    <div
                        className={`rounded-xl border p-3 text-sm font-medium ${
                            message.type === 'ok'
                                ? 'border-[#2F6B4E]/30 bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]'
                                : 'border-[#B04A2E]/30 bg-[#F7E3DB] text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8]'
                        }`}
                    >
                        <span className="inline-flex items-center gap-2">
                            {message.type === 'ok' ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                            {message.text}
                        </span>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={pending}
                    className="pos-btn inline-flex items-center justify-center gap-2 px-6 py-3"
                >
                    <Save className="h-4 w-4" />
                    {pending ? 'Guardando...' : 'Guardar cambios'}
                </button>
            </form>

            {/* ── Preview del recibo ─────────────────────────────────────── */}
            <div className="space-y-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                    Vista previa del recibo
                </div>
                <div className="rounded-2xl border border-capsula-line bg-white p-4 shadow-sm">
                    <div className="mx-auto max-w-[280px] border border-dashed border-capsula-line p-3 text-center font-serif text-[12px] text-black">
                        {branding.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={branding.logoUrl}
                                alt={branding.name}
                                className="mx-auto mb-2 max-w-[120px]"
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                }}
                            />
                        ) : (
                            <div className="mx-auto mb-2 flex h-[60px] w-[120px] items-center justify-center rounded border border-dashed border-capsula-line text-capsula-ink-muted">
                                <ImageOff className="h-5 w-5" />
                            </div>
                        )}
                        {!branding.logoUrl && branding.legalName && (
                            <div className="text-[13px] font-bold">{branding.legalName}</div>
                        )}
                        {!branding.logoUrl && !branding.legalName && (
                            <div className="text-[13px] font-bold">{branding.name}</div>
                        )}
                        {branding.taxId && <div className="text-[10px]">RIF: {branding.taxId}</div>}
                        <div className="mt-2 text-[12px] font-bold">RECIBO DE PAGO</div>
                        <div className="my-2 border-t border-dashed border-black"></div>
                        <div className="flex justify-between text-[10px]">
                            <span className="font-bold">Correlativo:</span>
                            <span>R-000123</span>
                        </div>
                        <div className="my-2 border-t border-dashed border-black"></div>
                        <div className="text-[10px] text-capsula-ink-muted italic">
                            (Vista previa — los datos del pedido y items reales se incluyen al imprimir)
                        </div>
                    </div>
                </div>
                <p className="text-xs text-capsula-ink-muted">
                    Se actualiza en vivo a medida que editás. Para que aparezca en recibos
                    reales, presioná &quot;Guardar cambios&quot;.
                </p>
            </div>
        </div>
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
        <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1.5">
                {label}
            </label>
            {children}
            {hint && <p className="mt-1.5 text-xs text-capsula-ink-muted">{hint}</p>}
        </div>
    );
}
