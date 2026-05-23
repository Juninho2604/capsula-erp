'use client';

import { useState } from 'react';
import { Check, Copy, Sparkles } from 'lucide-react';

/**
 * Cartelito visible en demo.kpsula.app/login con las credenciales públicas
 * para que un prospecto pueda probar el ERP sin pedir registro.
 *
 * La password está hardcoded acá Y en scripts/seed-demo-tenant.ts. Si se
 * cambia, hay que sincronizar ambos lugares + re-seed con --reset.
 *
 * El componente expone 5 perfiles (owner / admin / caja / chef / mesero)
 * pero todos comparten la misma password. El selector permite que el
 * prospecto vea el ERP desde distintos roles sin tener que pensar.
 */

const DEMO_PASSWORD = 'Demo2026!';

const DEMO_USERS = [
    { role: 'OWNER',         email: 'owner@demo.kpsula.app',  pin: '1234', label: 'Dueño (acceso total)' },
    { role: 'ADMIN_MANAGER', email: 'admin@demo.kpsula.app',  pin: '2345', label: 'Gerente' },
    { role: 'CASHIER',       email: 'caja@demo.kpsula.app',   pin: '3456', label: 'Cajera' },
    { role: 'CHEF',          email: 'chef@demo.kpsula.app',   pin: '4567', label: 'Chef' },
    { role: 'WAITER',        email: 'mesero@demo.kpsula.app', pin: '5678', label: 'Mesero' },
] as const;

export default function DemoCredentialsCard() {
    const [copied, setCopied] = useState<string | null>(null);

    const copy = async (label: string, text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(label);
            setTimeout(() => setCopied((c) => (c === label ? null : c)), 1500);
        } catch {
            // clipboard no disponible (http, browser viejo) — no romper UI
        }
    };

    return (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm">
            <div className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-amber-800">
                <Sparkles className="h-3.5 w-3.5" />
                Demo público
            </div>
            <p className="mb-3 text-xs leading-relaxed text-amber-900/80">
                Probá Cápsula con datos de ejemplo. Elegí un perfil y pegá el email + la contraseña{' '}
                <span className="font-semibold text-amber-900">{DEMO_PASSWORD}</span>.
            </p>

            <div className="space-y-1.5">
                {DEMO_USERS.map((u) => (
                    <button
                        key={u.email}
                        type="button"
                        onClick={() => copy(u.email, u.email)}
                        className="group flex w-full items-center justify-between gap-2 rounded-lg border border-amber-200/60 bg-white/70 px-3 py-2 text-left transition-colors hover:border-amber-300 hover:bg-white"
                    >
                        <div className="min-w-0">
                            <div className="truncate text-xs font-semibold text-gray-900">
                                {u.email}
                            </div>
                            <div className="truncate text-[11px] text-gray-500">
                                {u.label} · PIN {u.pin}
                            </div>
                        </div>
                        <span className="shrink-0 text-[11px] font-medium text-amber-700 group-hover:text-amber-900">
                            {copied === u.email ? (
                                <span className="inline-flex items-center gap-1">
                                    <Check className="h-3 w-3" /> Copiado
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1">
                                    <Copy className="h-3 w-3" /> Copiar
                                </span>
                            )}
                        </span>
                    </button>
                ))}
            </div>

            <button
                type="button"
                onClick={() => copy('password', DEMO_PASSWORD)}
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-900/90 px-3 py-2 text-xs font-semibold text-amber-50 transition-colors hover:bg-amber-900"
            >
                {copied === 'password' ? (
                    <>
                        <Check className="h-3.5 w-3.5" /> Contraseña copiada
                    </>
                ) : (
                    <>
                        <Copy className="h-3.5 w-3.5" /> Copiar contraseña ({DEMO_PASSWORD})
                    </>
                )}
            </button>
        </div>
    );
}
