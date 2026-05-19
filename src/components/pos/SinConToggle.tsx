'use client';

import { Ban, Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IngredientToggle } from '@/lib/pos-modifier-grouping';

/**
 * Toggle visual de 3 estados (SIN / NEUTRAL / CON) por ingrediente.
 *
 * - Si solo existe `sin`: el botón CON queda deshabilitado visualmente.
 * - Si solo existe `con`: el botón SIN queda deshabilitado.
 * - El estado actual se calcula del set de modifiers seleccionados (parent
 *   state). Al hacer click, llamamos `onSelect(modifierId, action)` para
 *   que el parent agregue/quite del set; este componente es presentacional.
 *
 * El parent es responsable de:
 *   1. Llamar a `onSelect(id, 1)` para activar.
 *   2. Llamar a `onSelect(id, 0)` para desactivar.
 *   3. Si selecciona "CON" cuando ya estaba "SIN", el parent debe primero
 *      desactivar el "SIN" y luego activar el "CON" (lógica de mutua
 *      exclusión).
 */
export interface SinConToggleProps {
    toggle: IngredientToggle;
    /** Estado actual del toggle: 'SIN' | 'CON' | 'NEUTRAL'. */
    state: 'SIN' | 'CON' | 'NEUTRAL';
    /**
     * Llamado cuando el usuario click en el botón SIN o CON.
     * `targetState` es el estado que el usuario está pidiendo.
     * El parent debe traducir esto a updates de selección:
     *  - NEUTRAL → desactivar sin y con
     *  - SIN     → desactivar con si activo + activar sin
     *  - CON     → desactivar sin si activo + activar con
     */
    onChange: (targetState: 'SIN' | 'CON' | 'NEUTRAL') => void;
}

export function SinConToggle({ toggle, state, onChange }: SinConToggleProps) {
    const hasSin = Boolean(toggle.sin);
    const hasCon = Boolean(toggle.con);
    const conPrice = toggle.con?.priceAdjustment ?? 0;

    return (
        <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 border border-capsula-line bg-capsula-ivory">
            <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-capsula-ink truncate">
                    {toggle.label}
                </div>
                {state === 'CON' && conPrice > 0 && (
                    <div className="text-xs text-capsula-coral tabular-nums">
                        +${conPrice.toFixed(2)}
                    </div>
                )}
                {state === 'SIN' && (
                    <div className="text-xs text-capsula-ink-muted">
                        Sin este ingrediente
                    </div>
                )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
                {/* Botón SIN */}
                <button
                    type="button"
                    disabled={!hasSin}
                    onClick={() => onChange(state === 'SIN' ? 'NEUTRAL' : 'SIN')}
                    title={hasSin ? 'Sin este ingrediente' : 'No disponible'}
                    className={cn(
                        'h-9 w-9 rounded-lg border flex items-center justify-center transition shrink-0',
                        state === 'SIN'
                            ? 'border-capsula-coral bg-capsula-coral text-capsula-cream'
                            : hasSin
                                ? 'border-capsula-line bg-capsula-ivory text-capsula-ink-muted hover:border-capsula-coral hover:text-capsula-coral'
                                : 'border-capsula-line bg-capsula-ivory-alt text-capsula-ink-faint cursor-not-allowed',
                    )}
                >
                    <Ban className="h-4 w-4" />
                </button>

                {/* Botón NEUTRAL (centro) */}
                <button
                    type="button"
                    onClick={() => onChange('NEUTRAL')}
                    title="Como viene"
                    className={cn(
                        'h-9 w-9 rounded-lg border flex items-center justify-center transition shrink-0',
                        state === 'NEUTRAL'
                            ? 'border-capsula-navy-deep bg-capsula-navy-soft text-capsula-ink'
                            : 'border-capsula-line bg-capsula-ivory text-capsula-ink-muted hover:border-capsula-navy-deep',
                    )}
                >
                    <Minus className="h-4 w-4" />
                </button>

                {/* Botón CON */}
                <button
                    type="button"
                    disabled={!hasCon}
                    onClick={() => onChange(state === 'CON' ? 'NEUTRAL' : 'CON')}
                    title={hasCon ? (conPrice > 0 ? `Con (+$${conPrice.toFixed(2)})` : 'Con este ingrediente') : 'No disponible'}
                    className={cn(
                        'h-9 w-9 rounded-lg border flex items-center justify-center transition shrink-0 relative',
                        state === 'CON'
                            ? 'border-capsula-navy-deep bg-capsula-navy-deep text-capsula-cream'
                            : hasCon
                                ? 'border-capsula-line bg-capsula-ivory text-capsula-ink-muted hover:border-capsula-navy-deep hover:text-capsula-ink'
                                : 'border-capsula-line bg-capsula-ivory-alt text-capsula-ink-faint cursor-not-allowed',
                    )}
                >
                    <Plus className="h-4 w-4" />
                    {hasCon && conPrice > 0 && state !== 'CON' && (
                        <span className="absolute -top-1 -right-1 bg-capsula-coral text-capsula-cream text-[8px] font-bold rounded-full h-3.5 min-w-[14px] px-1 flex items-center justify-center">
                            $
                        </span>
                    )}
                </button>
            </div>
        </div>
    );
}
