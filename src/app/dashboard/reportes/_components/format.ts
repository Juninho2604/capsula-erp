/**
 * Helpers de formato (client-safe, puros) para las vistas de reportes.
 * Dual currency: Bs SOLO si viene persistido (tasa histórica) — el modo
 * 'AMBAS' muestra USD + Bs registrado; nunca se reconvierte aquí.
 */

export type CurrencyMode = 'USD' | 'BS' | 'AMBAS';

const usdFmt = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const bsFmt = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtyFmt = new Intl.NumberFormat('es-VE', { maximumFractionDigits: 2 });

export const fmtUsd = (n: number) => `$${usdFmt.format(n)}`;
export const fmtBs = (n: number) => `Bs ${bsFmt.format(n)}`;
export const fmtQty = (n: number) => qtyFmt.format(n);
export const fmtPct = (n: number) => `${n.toFixed(1)}%`;

/** Render dual según el toggle. bs=null → 'Bs no registrado' en modo BS. */
export function fmtMoney(usd: number, bs: number | null, mode: CurrencyMode): string {
    if (mode === 'USD') return fmtUsd(usd);
    if (mode === 'BS') return bs !== null && bs > 0 ? fmtBs(bs) : 'Bs no registrado';
    return bs !== null && bs > 0 ? `${fmtUsd(usd)} · ${fmtBs(bs)}` : fmtUsd(usd);
}

/** Día actual en zona Caracas como 'YYYY-MM-DD' (independiente del TZ del device). */
export function caracasToday(): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
}

function shiftDay(day: string, deltaDays: number): string {
    const d = new Date(day + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + deltaDays);
    return d.toISOString().slice(0, 10);
}

export interface DateRange { from: string; to: string }

export type RangePreset = 'HOY' | 'AYER' | 'SEMANA' | 'MES' | 'MES_ANTERIOR' | 'CUSTOM';

export const PRESET_LABELS: Record<RangePreset, string> = {
    HOY: 'Hoy', AYER: 'Ayer', SEMANA: 'Esta semana', MES: 'Este mes',
    MES_ANTERIOR: 'Mes anterior', CUSTOM: 'Personalizado',
};

/** Resuelve el rango de un preset relativo al día Caracas actual. */
export function presetRange(preset: RangePreset, today = caracasToday()): DateRange {
    const [y, m, d] = today.split('-').map(Number);
    switch (preset) {
        case 'HOY': return { from: today, to: today };
        case 'AYER': { const ay = shiftDay(today, -1); return { from: ay, to: ay }; }
        case 'SEMANA': {
            // Semana Lun→Dom (convención del negocio, §56 fiscal-week)
            const dow = new Date(today + 'T12:00:00Z').getUTCDay(); // 0=Dom
            const sinceMonday = dow === 0 ? 6 : dow - 1;
            return { from: shiftDay(today, -sinceMonday), to: today };
        }
        case 'MES':
            return { from: `${y}-${String(m).padStart(2, '0')}-01`, to: today };
        case 'MES_ANTERIOR': {
            const prevY = m === 1 ? y - 1 : y;
            const prevM = m === 1 ? 12 : m - 1;
            const lastDay = new Date(Date.UTC(prevY, prevM, 0)).getUTCDate();
            return {
                from: `${prevY}-${String(prevM).padStart(2, '0')}-01`,
                to: `${prevY}-${String(prevM).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
            };
        }
        default:
            void d;
            return { from: today, to: today };
    }
}
