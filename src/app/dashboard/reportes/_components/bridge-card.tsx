'use client';

/**
 * Puente de cuadre FACTURADO → COBRADO.
 * Explica en una sola tarjeta por qué los números difieren entre superficies:
 *  - Facturado (Finanzas/Dashboard/Reportes) = Σ total órdenes, SIN 10% servicio,
 *    incluye mesas abiertas sin cobrar.
 *  - Cobrado (Z/método de pago) = pagos reales, CON 10% servicio, sin propinas.
 *  - El "Cobrado" del historial de ventas además incluye propinas.
 */

import { Scale } from 'lucide-react';
import type { SalesBridge } from '@/lib/reports/sales-reports';
import { fmtUsd } from './format';

export function BridgeCard({ bridge }: { bridge: SalesBridge }) {
    const rows: Array<{ sign: '' | '+' | '−' | '±' | '='; label: string; value: number; muted?: boolean }> = [
        { sign: '', label: 'Facturado (sin 10% servicio, incluye mesas abiertas)', value: bridge.facturado },
        { sign: '+', label: 'Servicio 10% cobrado en el período', value: bridge.servicioCobrado },
        { sign: '−', label: 'Pendiente por cobrar (mesas aún abiertas)', value: bridge.pendiente },
    ];
    if (Math.abs(bridge.ajusteOtrosDias) > 0.01) {
        rows.push({
            sign: '±',
            label: 'Mesas facturadas otro día / pagos parciales',
            value: bridge.ajusteOtrosDias,
            muted: true,
        });
    }

    return (
        <div className="bg-capsula-ivory border border-capsula-line rounded-2xl p-4">
            <p className="pos-kicker mb-2 inline-flex items-center gap-1.5">
                <Scale className="h-3.5 w-3.5" /> Puente de cuadre · facturado vs cobrado
            </p>
            <dl className="space-y-1">
                {rows.map(r => (
                    <div key={r.label} className="flex items-baseline justify-between gap-3">
                        <dt className={`text-xs ${r.muted ? 'text-capsula-ink-faint' : 'text-capsula-ink-muted'}`}>
                            {r.sign && <span className="inline-block w-3 font-semibold">{r.sign}</span>} {r.label}
                        </dt>
                        <dd className={`text-sm tabular-nums ${r.muted ? 'text-capsula-ink-faint' : 'text-capsula-ink'}`}>
                            {fmtUsd(r.value)}
                        </dd>
                    </div>
                ))}
                <div className="flex items-baseline justify-between gap-3 border-t border-capsula-line-strong pt-1.5 mt-1.5">
                    <dt className="text-xs font-semibold text-capsula-ink">
                        <span className="inline-block w-3 font-semibold">=</span> Cobrado (con servicio, sin propinas)
                    </dt>
                    <dd className="text-sm font-semibold tabular-nums text-capsula-ink">{fmtUsd(bridge.cobrado)}</dd>
                </div>
            </dl>
            <p className="text-[11px] text-capsula-ink-muted mt-2 border-t border-capsula-line pt-2">
                Propinas del período: <span className="tabular-nums">{fmtUsd(bridge.propinas)}</span> — van al personal,
                no son venta. El &quot;Cobrado&quot; del historial de ventas sí las incluye, por eso puede mostrar un monto mayor.
            </p>
        </div>
    );
}
