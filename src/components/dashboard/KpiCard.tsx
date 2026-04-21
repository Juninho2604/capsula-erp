'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

/**
 * KpiCard — Minimal Navy.
 * Drop-in reemplazo del KpiCard existente, API similar.
 */

export interface KpiCardProps {
    label: string;
    value: string | number;
    /** Delta como string ya formateado ("+12%", "−3.4%") */
    delta?: string;
    /** Signo del delta; si se omite se infiere del string (+/−) */
    trend?: 'up' | 'down' | 'flat';
    /** Texto de contexto bajo el delta */
    hint?: string;
    icon?: LucideIcon;
    /** Valor más chico (ej: comparación) */
    secondary?: string;
    className?: string;
    onClick?: () => void;
    /** Tamaño: md (default) | lg (más alto y value más grande) */
    size?: 'md' | 'lg';
}

export function KpiCard({
    label,
    value,
    delta,
    trend,
    hint,
    icon: Icon,
    secondary,
    className,
    onClick,
    size = 'md',
}: KpiCardProps) {
    const inferredTrend: 'up' | 'down' | 'flat' =
        trend ??
        (delta?.startsWith('+') ? 'up' :
         delta?.match(/^[-−]/) ? 'down' : 'flat');

    const DeltaIcon = inferredTrend === 'up' ? ArrowUpRight : inferredTrend === 'down' ? ArrowDownRight : Minus;
    const deltaColor =
        inferredTrend === 'up'   ? 'border-[#D3E2D8] bg-[#E5EDE7] text-[#2F6B4E]' :
        inferredTrend === 'down' ? 'border-[#E8D9B8] bg-[#F3EAD6] text-[#946A1C]' :
                                   'border-capsula-line bg-capsula-ivory-alt text-capsula-ink-soft';

    const Comp: any = onClick ? 'button' : 'div';

    return (
        <Comp
            onClick={onClick}
            className={cn(
                'group relative flex flex-col gap-3 rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-5 text-left',
                'transition-[box-shadow,transform,border-color] duration-[250ms] ease-[cubic-bezier(.2,.7,.2,1)]',
                'shadow-cap-soft hover:-translate-y-px hover:shadow-cap-raised hover:border-capsula-line-strong',
                onClick && 'cursor-pointer',
                size === 'lg' && 'p-6',
                className
            )}
        >
            <div className="flex items-start justify-between">
                <span className="capsula-stat-label">{label}</span>
                {Icon && <Icon className="h-4 w-4 text-capsula-ink-muted" strokeWidth={1.5} />}
            </div>

            <div className={size === 'lg' ? 'capsula-stat-value-lg' : 'capsula-stat-value'}>
                {value}
            </div>

            {(delta || hint || secondary) && (
                <div className="flex items-end justify-between gap-2">
                    <div className="space-y-1">
                        {delta && (
                            <span className={cn(
                                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                                deltaColor
                            )}>
                                <DeltaIcon className="h-3 w-3" /> {delta}
                            </span>
                        )}
                        {hint && (
                            <div className="text-[11px] text-capsula-ink-muted">{hint}</div>
                        )}
                    </div>
                    {secondary && (
                        <div className="text-right">
                            <div className="text-[11px] uppercase tracking-[0.08em] text-capsula-ink-muted">vs. ayer</div>
                            <div className="font-mono text-[13px] text-capsula-ink-soft">{secondary}</div>
                        </div>
                    )}
                </div>
            )}
        </Comp>
    );
}

export default KpiCard;
