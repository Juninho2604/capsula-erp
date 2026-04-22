'use client';

import * as React from 'react';
import Link from 'next/link';
import {
    TrendingUp, TrendingDown, DollarSign, Package,
    Users, ShoppingCart, ArrowRight, Sparkles,
} from 'lucide-react';
import CapsulaAnimatedMark from '@/components/brand/CapsulaAnimatedMark';

/**
 * Dashboard welcome — Minimal Navy.
 * Saludo editorial + KPIs con value sans 500 + grid de accesos.
 * Todos los números son mocks; reemplazar por data real al integrar.
 */

interface Props {
    userName?: string;
}

const kpis = [
    { label: 'Ventas hoy',        value: '$ 4.820',  delta: '+12.4%', up: true,  icon: DollarSign },
    { label: 'Ticket promedio',   value: '$ 28,40',  delta: '+3.1%',  up: true,  icon: ShoppingCart },
    { label: 'Mermas (semana)',   value: '$ 312',    delta: '−18%',   up: false, icon: Package },
    { label: 'Clientes atendidos',value: '169',      delta: '+8',     up: true,  icon: Users },
];

const modules = [
    { href: '/dashboard/inventario',  title: 'Inventario',    desc: 'Stock, movimientos y alertas' },
    { href: '/dashboard/compras',     title: 'Compras',       desc: 'Órdenes y recepción' },
    { href: '/dashboard/recetas',     title: 'Recetas',       desc: 'Sub-recetas y costo teórico' },
    { href: '/dashboard/costos',      title: 'Costos',        desc: 'COGS y márgenes por plato' },
    { href: '/dashboard/ventas',      title: 'Ventas',        desc: 'Cierre de turno y reportes' },
    { href: '/dashboard/finanzas',    title: 'Finanzas',      desc: 'Ingresos, gastos y flujo' },
    { href: '/dashboard/pos',         title: 'Punto de venta',desc: 'Operación en salón y barra' },
    { href: '/dashboard/estadisticas',title: 'Analítica',     desc: 'Tendencias y comparativos' },
];

export default function DashboardWelcome({ userName = 'equipo' }: Props) {
    const hour = new Date().getHours();
    const greeting =
        hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';

    return (
        <div className="space-y-10">
            {/* ── HERO editorial ───────────────────────────────── */}
            <section className="relative overflow-hidden rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-8 py-10">
                <div className="pointer-events-none absolute right-6 top-6 opacity-90">
                    <CapsulaAnimatedMark size={72} />
                </div>
                <div className="mb-3 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.1em] text-capsula-ink-muted">
                    <Sparkles className="h-3 w-3" /> Resumen del día
                </div>
                <h1 className="font-heading text-balance text-[clamp(36px,5vw,56px)] leading-[0.98] tracking-[-0.02em] text-capsula-ink">
                    {greeting}, <span className="italic text-capsula-ink">{userName}.</span>
                </h1>
                <p className="mt-3 max-w-[520px] text-[15px] leading-[1.55] text-capsula-ink-soft">
                    Todo funciona con normalidad. Tres avisos por revisar y un cierre de turno pendiente.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                    <Link href="/dashboard/pos" className="capsula-btn capsula-btn-primary !px-5 !py-2.5 text-sm">
                        Abrir POS <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link href="/dashboard/caja" className="capsula-btn capsula-btn-secondary !px-5 !py-2.5 text-sm">
                        Revisar caja
                    </Link>
                </div>
            </section>

            {/* ── KPIs ─────────────────────────────────────────── */}
            <section>
                <div className="mb-4 flex items-baseline justify-between">
                    <h2 className="font-heading text-2xl tracking-[-0.015em] text-capsula-ink">
                        Indicadores
                    </h2>
                    <span className="text-[11px] uppercase tracking-[0.1em] text-capsula-ink-muted">
                        Últimas 24 h
                    </span>
                </div>
                <div className="grid gap-px overflow-hidden rounded-[var(--radius)] border border-capsula-line bg-capsula-line md:grid-cols-2 lg:grid-cols-4">
                    {kpis.map((k) => {
                        const Delta = k.up ? TrendingUp : TrendingDown;
                        return (
                            <div key={k.label} className="bg-capsula-ivory-surface p-6">
                                <div className="mb-3 flex items-center justify-between">
                                    <span className="capsula-stat-label">{k.label}</span>
                                    <k.icon className="h-4 w-4 text-capsula-ink-muted" strokeWidth={1.5} />
                                </div>
                                <div className="capsula-stat-value">{k.value}</div>
                                <div
                                    className={`mt-3 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                                        k.up
                                            ? 'border-[#D3E2D8] bg-[#E5EDE7] text-[#2F6B4E]'
                                            : 'border-[#E8D9B8] bg-[#F3EAD6] text-[#946A1C]'
                                    }`}
                                >
                                    <Delta className="h-3 w-3" /> {k.delta}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* ── MÓDULOS ──────────────────────────────────────── */}
            <section>
                <div className="mb-4 flex items-baseline justify-between">
                    <h2 className="font-heading text-2xl tracking-[-0.015em] text-capsula-ink">
                        Módulos
                    </h2>
                    <Link href="/dashboard/config/modules" className="text-[13px] text-capsula-ink-soft hover:text-capsula-ink">
                        Configurar →
                    </Link>
                </div>
                <div className="grid gap-px overflow-hidden rounded-[var(--radius)] border border-capsula-line bg-capsula-line md:grid-cols-2 lg:grid-cols-4">
                    {modules.map((m) => (
                        <Link
                            key={m.href}
                            href={m.href}
                            className="group relative bg-capsula-ivory-surface p-6 transition-colors hover:bg-capsula-ivory"
                        >
                            <h3 className="mb-1.5 text-[15px] font-medium tracking-[-0.01em] text-capsula-ink">
                                {m.title}
                            </h3>
                            <p className="text-[13px] leading-[1.5] text-capsula-ink-muted">{m.desc}</p>
                            <ArrowRight className="absolute right-5 top-5 h-4 w-4 translate-x-0 text-capsula-ink-muted opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                        </Link>
                    ))}
                </div>
            </section>
        </div>
    );
}
