'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * PageHeader — cabecera editorial para las páginas del dashboard.
 * Uso:
 *   <PageHeader
 *     kicker="Inventario"
 *     title="Stock y movimientos"
 *     description="Controla existencias por almacén en tiempo real."
 *     actions={<Button>Nuevo ítem</Button>}
 *   />
 */

interface Props {
    kicker?: string;
    title: string;
    description?: string;
    actions?: React.ReactNode;
    className?: string;
}

export function PageHeader({ kicker, title, description, actions, className }: Props) {
    return (
        <header className={cn(
            'mb-8 flex flex-col gap-6 border-b border-capsula-line pb-6 md:flex-row md:items-end md:justify-between',
            className
        )}>
            <div>
                {kicker && (
                    <div className="mb-2 text-[11px] uppercase tracking-[0.12em] text-capsula-ink-muted">
                        {kicker}
                    </div>
                )}
                <h1 className="font-semibold text-balance text-[clamp(32px,4vw,44px)] leading-[1.02] tracking-[-0.02em] text-capsula-ink">
                    {title}
                </h1>
                {description && (
                    <p className="mt-2 max-w-[640px] text-[15px] leading-[1.55] text-capsula-ink-soft">
                        {description}
                    </p>
                )}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
    );
}

export default PageHeader;
