'use client';

import { useState } from 'react';
import { Check, ChevronDown, Copy, Sparkles } from 'lucide-react';

/**
 * Banner expandible en demo.kpsula.app/login con las credenciales públicas
 * para que un prospecto pueda probar el ERP sin pedir registro.
 *
 * UX:
 *   - Plegado por default: ocupa poco espacio, no compite con el form.
 *   - Click en el header → expande mostrando los 5 perfiles con descripción
 *     de cada rol + copy-to-clipboard de email y password.
 *
 * La password está hardcoded acá Y en scripts/seed-demo-tenant.ts. Si se
 * cambia, hay que sincronizar ambos lugares y correr en el VPS:
 *   npx tsx scripts/reset-demo-password.ts
 * (no requiere --reset del seed, preserva ventas/inventario sintético).
 */

const DEMO_PASSWORD = 'kpsula-demo';

const DEMO_USERS = [
    {
        role: 'OWNER',
        email: 'owner@demo.kpsula.app',
        pin: '1234',
        label: 'Dueño',
        description: 'Acceso total: finanzas, configuración, todos los módulos',
    },
    {
        role: 'ADMIN_MANAGER',
        email: 'admin@demo.kpsula.app',
        pin: '2345',
        label: 'Gerente',
        description: 'Operación diaria: inventario, ventas, reportes, equipo',
    },
    {
        role: 'CASHIER',
        email: 'caja@demo.kpsula.app',
        pin: '3456',
        label: 'Cajera',
        description: 'Cobro de ventas, arqueo de caja, gestión de turno',
    },
    {
        role: 'CHEF',
        email: 'chef@demo.kpsula.app',
        pin: '4567',
        label: 'Chef',
        description: 'Recetas, cocina, comandas KDS y producción',
    },
    {
        role: 'WAITER',
        email: 'mesero@demo.kpsula.app',
        pin: '5678',
        label: 'Mesero',
        description: 'POS de mesa, tomar pedidos, transferir, cuentas abiertas',
    },
] as const;

export default function DemoCredentialsCard() {
    const [open, setOpen] = useState(false);
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
        <div className="mt-5 overflow-hidden rounded-xl border border-amber-200 bg-amber-50/70">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-amber-100/50"
            >
                <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-800">
                    <Sparkles className="h-3.5 w-3.5" />
                    Probar demo
                </span>
                <ChevronDown
                    className={`h-4 w-4 text-amber-700 transition-transform ${open ? 'rotate-180' : ''}`}
                />
            </button>

            {open && (
                <div className="border-t border-amber-200/60 px-4 py-3">
                    <p className="mb-3 text-xs leading-relaxed text-amber-900/80">
                        Datos sintéticos, sin clientes reales. Elegí el rol que quieras
                        explorar, copiá el email y pegalo arriba con la contraseña{' '}
                        <span className="font-semibold text-amber-900">{DEMO_PASSWORD}</span>.
                    </p>

                    <div className="space-y-1.5">
                        {DEMO_USERS.map((u) => (
                            <button
                                key={u.email}
                                type="button"
                                onClick={() => copy(u.email, u.email)}
                                className="group flex w-full items-start justify-between gap-3 rounded-lg border border-amber-200/60 bg-white/70 px-3 py-2 text-left transition-colors hover:border-amber-300 hover:bg-white"
                            >
                                <div className="min-w-0">
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-xs font-semibold text-gray-900">
                                            {u.label}
                                        </span>
                                        <span className="text-[10px] uppercase tracking-[0.1em] text-amber-700">
                                            PIN {u.pin}
                                        </span>
                                    </div>
                                    <div className="mt-0.5 truncate text-[11px] text-gray-600">
                                        {u.email}
                                    </div>
                                    <div className="mt-0.5 text-[11px] leading-snug text-gray-500">
                                        {u.description}
                                    </div>
                                </div>
                                <span className="shrink-0 self-center text-[11px] font-medium text-amber-700 group-hover:text-amber-900">
                                    {copied === u.email ? (
                                        <span className="inline-flex items-center gap-1">
                                            <Check className="h-3 w-3" /> Copiado
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1">
                                            <Copy className="h-3 w-3" /> Email
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
            )}
        </div>
    );
}
