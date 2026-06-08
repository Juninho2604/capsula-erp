'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Settings2, Check, ShieldCheck, Zap } from 'lucide-react';
import {
    updateDeliveryConfigAction,
    type DeliveryConfigData,
} from '@/app/actions/delivery-config.actions';
import { DeliveryNav } from '../_components/delivery-nav';

export function DeliveryConfigView({ initialConfig }: { initialConfig: DeliveryConfigData }) {
    const router = useRouter();
    const [prefix, setPrefix] = useState(initialConfig.correlativePrefix);
    const [mode, setMode] = useState(initialConfig.validationMode);
    const [webhookUrl, setWebhookUrl] = useState(initialConfig.webhookUrl ?? '');
    const [error, setError] = useState<string | null>(null);
    const [ok, setOk] = useState(false);
    const [pending, startTransition] = useTransition();

    function save() {
        setError(null);
        setOk(false);
        startTransition(async () => {
            const res = await updateDeliveryConfigAction({
                correlativePrefix: prefix,
                validationMode: mode,
                webhookUrl: webhookUrl.trim() || null,
            });
            if (!res.success) {
                setError(res.message ?? 'Error.');
                return;
            }
            setOk(true);
            router.refresh();
        });
    }

    return (
        <div className="p-4 sm:p-6 space-y-5">
            <DeliveryNav />
            <div className="flex items-center gap-3">
                <span className="h-10 w-10 rounded-2xl bg-capsula-navy-deep text-capsula-cream flex items-center justify-center">
                    <Settings2 className="h-5 w-5" />
                </span>
                <div>
                    <h1 className="font-semibold text-xl tracking-[-0.02em] text-capsula-ink">
                        Configuración de delivery
                    </h1>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                        Correlativo · validación de pago · webhook
                    </p>
                </div>
            </div>

            {error && (
                <div className="rounded-2xl border border-capsula-line bg-[#F7E3DB] text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8] px-4 py-3 text-sm">
                    {error}
                </div>
            )}
            {ok && (
                <div className="rounded-2xl border border-capsula-line bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F] px-4 py-3 text-sm inline-flex items-center gap-2">
                    <Check className="h-4 w-4" /> Guardado.
                </div>
            )}

            <div className="pos-panel p-5 space-y-5 max-w-lg">
                <div>
                    <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                        Prefijo del correlativo
                    </label>
                    <input
                        value={prefix}
                        onChange={e => setPrefix(e.target.value.toUpperCase())}
                        maxLength={5}
                        className="pos-input w-full mt-1 sm:w-40"
                    />
                    <p className="text-xs text-capsula-ink-faint mt-1">
                        Próximo correlativo: <span className="tabular-nums">{prefix}-{String(initialConfig.nextCorrelative).padStart(5, '0')}</span>
                    </p>
                </div>

                <div>
                    <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                        Validación de pago
                    </label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                        <button
                            onClick={() => setMode('MANUAL')}
                            className={`pos-tile p-3 text-left ${mode === 'MANUAL' ? 'border-capsula-navy ring-1 ring-capsula-navy' : ''}`}
                        >
                            <ShieldCheck className="h-5 w-5 mb-1 text-capsula-ink" />
                            <p className="font-semibold text-sm text-capsula-ink">Manual</p>
                            <p className="text-xs text-capsula-ink-muted">El supervisor valida el comprobante (antifraude). Recomendado.</p>
                        </button>
                        <button
                            onClick={() => setMode('AUTO')}
                            className={`pos-tile p-3 text-left ${mode === 'AUTO' ? 'border-capsula-navy ring-1 ring-capsula-navy' : ''}`}
                        >
                            <Zap className="h-5 w-5 mb-1 text-capsula-ink" />
                            <p className="font-semibold text-sm text-capsula-ink">Automática</p>
                            <p className="text-xs text-capsula-ink-muted">Al llegar el comprobante, imprime directo. Sin revisión humana.</p>
                        </button>
                    </div>
                </div>

                <div>
                    <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                        Webhook (n8n)
                    </label>
                    <input
                        value={webhookUrl}
                        onChange={e => setWebhookUrl(e.target.value)}
                        placeholder="https://n8n.tu-dominio.com/webhook/kpsula"
                        className="pos-input w-full mt-1"
                    />
                    <p className="text-xs text-capsula-ink-faint mt-1">
                        Destino de los webhooks salientes (firmados con HMAC).
                    </p>
                </div>

                <button
                    onClick={save}
                    disabled={pending || !prefix.trim()}
                    className="pos-btn w-full py-3 inline-flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    <Check className="h-4 w-4" /> Guardar
                </button>
            </div>
        </div>
    );
}
