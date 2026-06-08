'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutGrid,
    Bike,
    PackageX,
    MessageSquareText,
    UserCircle2,
    Settings2,
} from 'lucide-react';

const TABS = [
    { href: '/dashboard/delivery', label: 'Tablero', icon: LayoutGrid, exact: true },
    { href: '/dashboard/delivery/motorizados', label: 'Motorizados', icon: Bike },
    { href: '/dashboard/delivery/agotados', label: 'Agotados', icon: PackageX },
    { href: '/dashboard/delivery/instrucciones', label: 'Instrucciones', icon: MessageSquareText },
    { href: '/dashboard/delivery/clientes', label: 'Clientes', icon: UserCircle2 },
    { href: '/dashboard/delivery/config', label: 'Config', icon: Settings2 },
];

export function DeliveryNav() {
    const pathname = usePathname();
    return (
        <nav className="flex gap-1 overflow-x-auto border-b border-capsula-line pb-2 -mx-1 px-1">
            {TABS.map(t => {
                const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
                const Icon = t.icon;
                return (
                    <Link
                        key={t.href}
                        href={t.href}
                        className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                            active
                                ? 'bg-capsula-navy-deep text-capsula-cream'
                                : 'text-capsula-ink-muted hover:bg-capsula-ivory-alt'
                        }`}
                    >
                        <Icon className="h-3.5 w-3.5" />
                        {t.label}
                    </Link>
                );
            })}
        </nav>
    );
}
