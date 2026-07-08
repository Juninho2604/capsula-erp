'use client';

/**
 * Sub-selección anidada de un modificador (§82) — compartido por los 5 POS.
 *
 * Se renderiza DEBAJO de la opción padre cuando está seleccionada y tiene
 * `childGroup`. Reusa el `updateModifierQuantity(group, modifier, change)`
 * de cada página pasándole el sub-grupo como `group`: la selección hija vive
 * en el mismo `currentModifiers` (groupId = childGroup.id) y el min/max del
 * sub-grupo lo aplica la propia función de la página.
 */

import { Check, Minus, Plus } from 'lucide-react';
import {
    ChildGroupData,
    ChildModifierData,
    childGroupSelectedTotal,
} from '@/lib/pos-child-group';

interface Props {
    childGroup: ChildGroupData;
    selections: Array<{ groupId: string; id: string; quantity: number }>;
    /** updateModifierQuantity de la página POS (mismas firmas en los 5 POS). */
    onSelect: (group: ChildGroupData, modifier: ChildModifierData, change: number) => void;
}

export default function ChildGroupSelector({ childGroup, selections, onSelect }: Props) {
    const total = childGroupSelectedTotal(selections, childGroup.id);
    const min = Math.max(childGroup.minSelections, childGroup.isRequired ? 1 : 0);
    const missing = total < min;
    const isRadio = childGroup.maxSelections === 1;

    return (
        <div className={`ml-3 mt-1.5 space-y-1.5 rounded-xl border p-2.5 ${
            missing ? 'border-capsula-coral/60 bg-capsula-coral/5' : 'border-capsula-line bg-capsula-ivory-alt'
        }`}>
            <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                    {childGroup.name}
                </span>
                <span className={`shrink-0 text-[10px] font-semibold tabular-nums ${missing ? 'text-capsula-coral' : 'text-capsula-ink-muted'}`}>
                    {total}/{childGroup.maxSelections >= 99 ? '∞' : childGroup.maxSelections}
                    {min > 0 ? ' · Req.' : ''}
                </span>
            </div>
            {childGroup.modifiers.map(child => {
                const selected = selections.find(s => s.groupId === childGroup.id && s.id === child.id);
                const qty = selected?.quantity ?? 0;
                return (
                    <div
                        key={child.id}
                        className={`flex min-h-[40px] items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 ${
                            qty > 0 ? 'border-capsula-navy-deep bg-capsula-navy-soft' : 'border-capsula-line bg-capsula-ivory'
                        }`}
                    >
                        <button
                            type="button"
                            onClick={() => { if (isRadio || qty === 0) onSelect(childGroup, child, 1); }}
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        >
                            <span className="truncate text-sm font-medium text-capsula-ink">{child.name}</span>
                            {child.priceAdjustment !== 0 && (
                                <span className="shrink-0 text-xs tabular-nums text-capsula-ink-muted">
                                    {child.priceAdjustment > 0 ? '+' : ''}${child.priceAdjustment.toFixed(2)}
                                </span>
                            )}
                        </button>
                        {isRadio ? (
                            qty > 0 && (
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-capsula-navy-deep text-capsula-cream">
                                    <Check className="h-3.5 w-3.5" />
                                </span>
                            )
                        ) : (
                            <div className="flex shrink-0 items-center gap-1.5">
                                {qty > 0 && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => onSelect(childGroup, child, -1)}
                                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-capsula-line bg-capsula-ivory text-capsula-ink"
                                        >
                                            <Minus className="h-3.5 w-3.5" />
                                        </button>
                                        <span className="w-5 text-center text-sm font-semibold tabular-nums text-capsula-ink">{qty}</span>
                                    </>
                                )}
                                <button
                                    type="button"
                                    onClick={() => onSelect(childGroup, child, 1)}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-capsula-line bg-capsula-ivory text-capsula-ink"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
