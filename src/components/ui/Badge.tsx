import * as React from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Badge minimal — pill suave con borde de 1px.
 * Variantes: neutral (default), ok, warn, danger, info, coral, navy.
 */

const badgeVariants = cva(
    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
    {
        variants: {
            variant: {
                neutral: 'border-capsula-line bg-capsula-ivory-alt text-capsula-ink-soft',
                ok:      'border-[#D3E2D8] bg-[#E5EDE7] text-[#2F6B4E]',
                warn:    'border-[#E8D9B8] bg-[#F3EAD6] text-[#946A1C]',
                danger:  'border-[#EFD2C8] bg-[#F7E3DB] text-[#B04A2E]',
                info:    'border-[#D1DCE9] bg-[#E6ECF4] text-[#2A4060]',
                coral:   'border-capsula-coral/20 bg-capsula-coral-subtle text-capsula-coral',
                navy:    'border-capsula-navy/10 bg-capsula-navy-soft text-capsula-navy',
            },
        },
        defaultVariants: { variant: 'neutral' },
    }
);

export interface BadgeProps
    extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
    return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export default Badge;
