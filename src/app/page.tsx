import Link from 'next/link';
import {
    ArrowRight,
    Box,
    BookOpen,
    Coins,
    BarChart3,
} from 'lucide-react';
import CapsulaLogo from '@/components/ui/CapsulaLogo';
import CapsulaAnimatedMark from '@/components/brand/CapsulaAnimatedMark';

export default function HomePage() {
    const features = [
        { icon: Box,       title: 'Inventario', desc: 'Gestión y control de stock en tiempo real, multi-ubicación y alertas de reabastecimiento.' },
        { icon: BookOpen,  title: 'Recetas',    desc: 'Estandarización y preparación con sub-recetas recursivas y control de mermas.' },
        { icon: Coins,     title: 'Costos',     desc: 'Análisis de márgenes y gastos: COGS automático y costo real por plato el mismo día.' },
        { icon: BarChart3, title: 'Analítica',  desc: 'Reportes y datos clave: ventas, ticket promedio y utilidad operativa por jornada.' },
    ];

    return (
        <div className="min-h-screen bg-capsula-ivory text-capsula-ink">
            {/* ── NAV ───────────────────────────────────────────── */}
            <nav className="sticky top-0 z-50 border-b border-capsula-line bg-capsula-ivory/85 backdrop-blur-md">
                <div className="mx-auto flex max-w-[1280px] items-center justify-between px-10 py-4">
                    <CapsulaLogo variant="full" size={22} />
                    <div className="flex items-center gap-4">
                        <Link href="/login" className="text-sm text-capsula-ink-soft transition-colors hover:text-capsula-ink">
                            Iniciar sesión
                        </Link>
                        <Link
                            href="/login"
                            className="capsula-btn capsula-btn-primary !px-4 !py-2 text-[13px]"
                        >
                            Solicitar demo <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>
                </div>
            </nav>

            {/* ── HERO ──────────────────────────────────────────── */}
            <section className="mx-auto max-w-[1280px] px-10 pb-24 pt-24 text-center">
                <div className="mb-8 flex justify-center">
                    <CapsulaAnimatedMark size={96} />
                </div>

                <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-capsula-line bg-capsula-ivory-surface px-3 py-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-capsula-coral" />
                    <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-soft">
                        Software de gestión gastronómica
                    </span>
                </div>

                <h1 className="font-semibold mx-auto mb-7 text-balance text-[clamp(56px,8vw,104px)] leading-[0.95] tracking-[-0.025em] text-capsula-ink">
                    Tu negocio,
                    <br />
                    <span className="italic text-capsula-ink">una cápsula.</span>
                </h1>

                <p className="mx-auto mb-9 max-w-[560px] text-pretty text-[17px] leading-[1.55] text-capsula-ink-soft">
                    Una sola plataforma, del salón a la dirección.
                </p>

                <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <Link href="/login" className="capsula-btn capsula-btn-primary">
                        Entrar al sistema <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link href="/dashboard" className="capsula-btn capsula-btn-secondary">
                        Ver dashboard
                    </Link>
                </div>
            </section>

            {/* ── PRODUCTO ──────────────────────────────────────── */}
            <section id="producto" className="mx-auto max-w-[1280px] border-t border-capsula-line px-10 py-24">
                <div className="mx-auto mb-16 max-w-[680px] text-center">
                    <div className="mb-5 inline-block rounded-full border border-capsula-line bg-capsula-ivory-surface px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-soft">
                        Producto
                    </div>
                    <h2 className="font-semibold mb-5 text-balance text-[clamp(40px,5vw,64px)] leading-[1.02] tracking-[-0.02em] text-capsula-ink">
                        Cuatro módulos. Una sola operación.
                    </h2>
                    <p className="text-pretty text-[17px] leading-[1.55] text-capsula-ink-soft">
                        Implementación por fases. Adopta solo lo que necesitas, cuando lo necesitas.
                    </p>
                </div>

                <div className="grid gap-px overflow-hidden rounded-[var(--radius)] border border-capsula-line bg-capsula-line md:grid-cols-2 lg:grid-cols-4">
                    {features.map((f) => (
                        <div
                            key={f.title}
                            className="bg-capsula-ivory-surface p-8 transition-colors hover:bg-capsula-ivory"
                        >
                            <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-[var(--radius)] border border-capsula-line-strong text-capsula-ink">
                                <f.icon className="h-[22px] w-[22px]" strokeWidth={1.5} />
                            </div>
                            <h3 className="mb-2 text-base font-semibold tracking-[-0.01em] text-capsula-ink">
                                {f.title}
                            </h3>
                            <p className="text-pretty text-[14px] leading-[1.55] text-capsula-ink-muted">
                                {f.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── CTA ──────────────────────────────────────────── */}
            <section className="mx-auto max-w-[1280px] px-10 pb-28">
                <div className="rounded-[20px] border border-capsula-line bg-capsula-ivory-alt px-10 py-20 text-center">
                    <h2 className="font-semibold mb-5 text-balance text-[clamp(40px,5vw,64px)] leading-[1.02] tracking-[-0.02em] text-capsula-ink">
                        Pongamos tu operación en una sola vista.
                    </h2>
                    <p className="mx-auto mb-8 max-w-[560px] text-pretty text-[17px] leading-[1.55] text-capsula-ink-soft">
                        30 minutos con un especialista, sobre los datos reales de tu restaurante.
                    </p>
                    <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                        <Link href="/login" className="capsula-btn capsula-btn-primary">
                            Solicitar demo <ArrowRight className="h-4 w-4" />
                        </Link>
                        <Link href="#contacto" className="capsula-btn capsula-btn-secondary">
                            Hablar con ventas
                        </Link>
                    </div>
                </div>
            </section>

            {/* ── FOOTER ───────────────────────────────────────── */}
            <footer className="border-t border-capsula-line bg-capsula-ivory-alt">
                <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-12 px-10 py-16 lg:grid-cols-[1.2fr_2fr]">
                    <div>
                        <CapsulaLogo variant="full" size={22} />
                        <p className="mt-4 max-w-[280px] text-[14px] leading-[1.55] text-capsula-ink-muted">
                            Plataforma de gestión para restaurantes independientes y grupos gastronómicos.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
                        {[
                            { h: 'Producto', items: [
                                { label: 'Inventario',         href: '#producto' },
                                { label: 'Recetas',            href: '#producto' },
                                { label: 'Costos',             href: '#producto' },
                                { label: 'Analítica',          href: '#producto' },
                            ]},
                            { h: 'Empresa', items: [
                                { label: 'Sobre nosotros',     href: '#empresa' },
                                { label: 'Contacto',           href: '#contacto' },
                            ]},
                            { h: 'Recursos', items: [
                                { label: 'Centro de ayuda',    href: '#ayuda' },
                                { label: 'Estado del sistema', href: '#estado' },
                            ]},
                        ].map((col) => (
                            <div key={col.h}>
                                <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                                    {col.h}
                                </div>
                                {col.items.map((i) => (
                                    <Link key={i.label} href={i.href} className="block py-1.5 text-[14px] text-capsula-ink-soft transition-colors hover:text-capsula-ink">
                                        {i.label}
                                    </Link>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="mx-auto flex max-w-[1280px] flex-col items-start justify-between gap-3 border-t border-capsula-line px-10 py-6 text-[13px] text-capsula-ink-muted sm:flex-row sm:items-center">
                    <div>© 2026 CÁPSULA · Todos los derechos reservados</div>
                    <div className="flex gap-6">
                        <Link href="#terminos"  className="transition-colors hover:text-capsula-ink">Términos y condiciones</Link>
                        <Link href="#privacidad" className="transition-colors hover:text-capsula-ink">Privacidad</Link>
                        <Link href="#seguridad"  className="transition-colors hover:text-capsula-ink">Seguridad</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
