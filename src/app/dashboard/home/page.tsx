import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
    LayoutDashboard, Package, BarChart2, Factory, Wine, BookOpen,
    UtensilsCrossed, Receipt, ChefHat, FileSearch, Coins, ChevronRight,
    type LucideIcon,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

// ─── Definición de atajos por rol ───────────────────────────────────────────

interface QuickLink {
    href: string;
    label: string;
    sub: string;
    Icon: LucideIcon;
    /** Si true, ocupa columnas dobles (botón "primary" para cajero/mesero) */
    primary?: boolean;
}

const SHORTCUTS_BY_ROLE: Record<string, QuickLink[]> = {
    OWNER: [
        { href: '/dashboard',            label: 'Dashboard ejecutivo', sub: 'Resumen y métricas del negocio',           Icon: LayoutDashboard, primary: true },
        { href: '/dashboard/inventario', label: 'Inventario',          sub: 'Stock, movimientos y auditorías',          Icon: Package },
        { href: '/dashboard/finanzas',   label: 'Finanzas',            sub: 'P&L, gastos y cuentas por pagar',           Icon: BarChart2 },
        { href: '/dashboard/produccion', label: 'Producción',          sub: 'Órdenes y procesamiento',                  Icon: Factory },
    ],
    ADMIN_MANAGER: [
        { href: '/dashboard',            label: 'Dashboard ejecutivo', sub: 'Resumen y métricas del negocio',           Icon: LayoutDashboard, primary: true },
        { href: '/dashboard/inventario', label: 'Inventario',          sub: 'Stock, movimientos y auditorías',          Icon: Package },
        { href: '/dashboard/finanzas',   label: 'Finanzas',            sub: 'P&L, gastos y cuentas por pagar',           Icon: BarChart2 },
        { href: '/dashboard/produccion', label: 'Producción',          sub: 'Órdenes y procesamiento',                  Icon: Factory },
    ],
    OPS_MANAGER: [
        { href: '/dashboard/pos/restaurante', label: 'POS Restaurante', sub: 'Venta directa y cuentas',              Icon: Wine, primary: true },
        { href: '/dashboard/inventario',      label: 'Inventario',      sub: 'Stock y movimientos',                  Icon: Package },
        { href: '/dashboard/produccion',      label: 'Producción',      sub: 'Órdenes y procesamiento',              Icon: Factory },
        { href: '/dashboard',                 label: 'Dashboard',       sub: 'Métricas operativas del día',          Icon: LayoutDashboard },
    ],
    AREA_LEAD: [
        { href: '/dashboard/pos/restaurante', label: 'POS Restaurante', sub: 'Venta directa y cuentas',              Icon: Wine, primary: true },
        { href: '/dashboard/inventario',      label: 'Inventario',      sub: 'Stock del área',                       Icon: Package },
        { href: '/dashboard/produccion',      label: 'Producción',      sub: 'Órdenes activas',                      Icon: Factory },
        { href: '/dashboard',                 label: 'Dashboard',       sub: 'Métricas del día',                     Icon: LayoutDashboard },
    ],
    CHEF: [
        { href: '/kitchen',              label: 'Comandera Cocina', sub: 'Pedidos pendientes en tiempo real',     Icon: ChefHat, primary: true },
        { href: '/dashboard/produccion', label: 'Producción',       sub: 'Órdenes y procesamiento',                Icon: Factory },
        { href: '/dashboard/recetas',    label: 'Recetas',          sub: 'Catálogo y costos',                      Icon: BookOpen },
    ],
    KITCHEN_CHEF: [
        { href: '/kitchen',              label: 'Comandera Cocina', sub: 'Pedidos pendientes en tiempo real',     Icon: ChefHat, primary: true },
        { href: '/dashboard/produccion', label: 'Producción',       sub: 'Órdenes y procesamiento',                Icon: Factory },
        { href: '/dashboard/recetas',    label: 'Recetas',          sub: 'Catálogo y costos',                      Icon: BookOpen },
    ],
    CASHIER: [
        { href: '/dashboard/pos/restaurante', label: 'Ir al POS',       sub: 'Tomar pedidos y cobrar',                Icon: Wine, primary: true },
        { href: '/dashboard/caja',            label: 'Control de Caja', sub: 'Apertura, cierre y arqueo',             Icon: Coins },
        { href: '/dashboard/sales',           label: 'Historial Ventas', sub: 'Ventas recientes y reimprimir',         Icon: Receipt },
    ],
    WAITER: [
        { href: '/dashboard/pos/mesero',      label: 'POS Mesero',      sub: 'Tomar pedidos por mesa',                Icon: UtensilsCrossed, primary: true },
        { href: '/dashboard/pos/restaurante', label: 'Vista Mesas',     sub: 'Ver estado del salón',                  Icon: Wine },
    ],
    AUDITOR: [
        { href: '/dashboard/inventario/auditorias', label: 'Auditorías',       sub: 'Conteos y variaciones',         Icon: FileSearch, primary: true },
        { href: '/dashboard/sales',                 label: 'Historial Ventas', sub: 'Trazabilidad de transacciones', Icon: Receipt },
        { href: '/dashboard',                       label: 'Dashboard',        sub: 'Métricas del día',              Icon: LayoutDashboard },
    ],
};

// ─── Página ─────────────────────────────────────────────────────────────────

export default async function HomePage() {
    const session = await getSession();
    if (!session) redirect('/login');

    const role = session.role ?? 'OWNER';
    const shortcuts: QuickLink[] = SHORTCUTS_BY_ROLE[role] ?? SHORTCUTS_BY_ROLE.OWNER ?? [];

    return (
        <div className="mx-auto max-w-5xl space-y-10 animate-in fade-in duration-500">
            {/* Header */}
            <header className="space-y-2">
                <h1 className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink">
                    Hola,{' '}
                    <span className="text-capsula-coral">{session.firstName || 'Usuario'}</span>
                </h1>
                <p className="text-sm text-capsula-ink-soft">
                    Bienvenido a tu espacio
                </p>
            </header>

            {/* Atajos */}
            <div className="grid gap-4 sm:grid-cols-2">
                {shortcuts.map(({ href, label, sub, Icon, primary }) => (
                    <Link
                        key={href + label}
                        href={href}
                        className={`group relative flex items-center gap-5 overflow-hidden rounded-3xl border border-capsula-line bg-capsula-ivory p-6 transition-all hover:border-capsula-navy-deep/30 hover:bg-capsula-ivory-surface ${
                            primary ? 'sm:col-span-2 sm:p-8' : ''
                        }`}
                    >
                        <div
                            className={`flex flex-shrink-0 items-center justify-center rounded-2xl bg-capsula-navy-deep text-capsula-cream transition-transform group-hover:scale-105 ${
                                primary ? 'h-20 w-20 sm:h-24 sm:w-24' : 'h-14 w-14'
                            }`}
                        >
                            <Icon
                                className={primary ? 'h-10 w-10 sm:h-12 sm:w-12' : 'h-7 w-7'}
                                strokeWidth={1.5}
                            />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p
                                className={`font-semibold tracking-[-0.02em] text-capsula-ink ${
                                    primary ? 'text-2xl sm:text-3xl' : 'text-lg'
                                }`}
                            >
                                {label}
                            </p>
                            <p
                                className={`mt-1 text-capsula-ink-muted ${
                                    primary ? 'text-sm sm:text-base' : 'text-sm'
                                }`}
                            >
                                {sub}
                            </p>
                        </div>
                        <ChevronRight
                            className={`flex-shrink-0 text-capsula-ink-muted transition-all group-hover:translate-x-1 group-hover:text-capsula-coral ${
                                primary ? 'h-7 w-7' : 'h-5 w-5'
                            }`}
                            strokeWidth={1.75}
                        />
                    </Link>
                ))}
            </div>
        </div>
    );
}
