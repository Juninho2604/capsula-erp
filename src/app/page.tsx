import Link from 'next/link';
import {
    ArrowRight,
    Box,
    BookOpen,
    Coins,
    BarChart3,
    Users,
    Truck,
} from 'lucide-react';
import CapsulaLogo from '@/components/ui/CapsulaLogo';
import CapsulaAnimatedMark from '@/components/brand/CapsulaAnimatedMark';

export default function HomePage() {
    const features = [
        { icon: Box,      title: 'Control de Inventario',  desc: 'Stock en tiempo real, alertas de reabastecimiento y gestión multi-ubicación.' },
        { icon: BookOpen, title: 'Recetas y sub-recetas',  desc: 'Gestión recursiva con cálculo automático de costos y control de mermas.' },
        { icon: Coins,    title: 'Costos en tiempo real',  desc: 'COGS automático, histórico de costos y márgenes por plato.' },
        { icon: BarChart3,title: 'Analítica operativa',    desc: 'Ventas, ticket promedio y utilidad operativa consolidados por día.' },
        { icon: Users,    title: 'Cuentas y meseros',      desc: 'Control de cuentas abiertas, propinas y cierres por turno.' },
        { icon: Truck,    title: 'Compras y proveedores',  desc: 'Órdenes de compra, recepción y trazabilidad de lotes.' },
    ];

    const logos = ['LA BARRA', 'OSTERÍA NOVE', 'CASA MILA', 'TERRAZA 14', 'ALMA', 'FOGÓN'];

    const metrics = [
        { k: '−18%',     l: 'merma de inventario',  d: 'tras el primer trimestre de uso' },
        { k: '+4.6 pts', l: 'de margen operativo',  d: 'medido contra período base' },
        { k: '6 h',      l: 'ahorradas por semana', d: 'en reportería y conciliación' },
        { k: '99.9%',    l: 'de uptime',            d: 'infraestructura gestionada' },
    ];

    return (
        <div className="min-h-screen bg-capsula-ivory text-capsula-ink">
            {/* ── NAV ───────────────────────────────────────────── */}
            <nav className="sticky top-0 z-50 border-b border-capsula-line bg-capsula-ivory/85 backdrop-blur-md">
                <div className="mx-auto grid max-w-[1280px] grid-cols-[1fr_auto_1fr] items-center px-10 py-4">
                    <CapsulaLogo variant="full" size={22} />
                    <div className="hidden gap-7 text-sm text-capsula-ink-soft md:flex">
                        <Link href="#producto"  className="transition-colors hover:text-capsula-ink">Producto</Link>
                        <Link href="#soluciones" className="transition-colors hover:text-capsula-ink">Soluciones</Link>
                        <Link href="#precios"   className="transition-colors hover:text-capsula-ink">Precios</Link>
                        <Link href="#clientes"  className="transition-colors hover:text-capsula-ink">Clientes</Link>
                    </div>
                    <div className="flex items-center justify-end gap-4">
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
            <section className="mx-auto max-w-[1280px] px-10 pb-16 pt-24 text-center">
                <div className="mb-8 flex justify-center">
                    <CapsulaAnimatedMark size={96} />
                </div>

                <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-capsula-line bg-capsula-ivory-surface px-3 py-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-capsula-coral" />
                    <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-navy-light">
                        ERP operativo para restaurantes
                    </span>
                </div>

                <h1 className="font-heading mx-auto mb-7 text-balance text-[clamp(56px,8vw,104px)] leading-[0.95] tracking-[-0.025em] text-capsula-ink">
                    Tu negocio,
                    <br />
                    <span className="italic text-capsula-ink">una cápsula.</span>
                </h1>

                <p className="mx-auto mb-9 max-w-[560px] text-pretty text-[17px] leading-[1.55] text-capsula-ink-soft">
                    Simple para el mesero, poderoso para el gerente.
                </p>

                <div className="mb-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <Link href="/login" className="capsula-btn capsula-btn-primary">
                        Entrar al sistema <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link href="/dashboard" className="capsula-btn capsula-btn-secondary">
                        Ver dashboard
                    </Link>
                </div>

                <div className="flex items-center justify-center gap-4 text-[13px] text-capsula-ink-muted">
                    <span><strong className="font-medium text-capsula-ink">15 días</strong> de prueba</span>
                    <span className="h-1 w-1 rounded-full bg-capsula-line-strong" />
                    <span>Sin tarjeta de crédito</span>
                    <span className="h-1 w-1 rounded-full bg-capsula-line-strong" />
                    <span>Onboarding guiado</span>
                </div>
            </section>

            {/* ── LOGO STRIP ────────────────────────────────────── */}
            <section className="mx-auto max-w-[1280px] border-y border-capsula-line px-10">
                <div className="py-7 text-center text-[11px] uppercase tracking-[0.14em] text-capsula-ink-muted">
                    Operando hoy en
                </div>
                <div className="grid grid-cols-3 pb-8 md:grid-cols-6">
                    {logos.map((l) => (
                        <div
                            key={l}
                            className="font-heading text-center text-lg tracking-[0.08em] text-capsula-navy-light opacity-70"
                        >
                            {l}
                        </div>
                    ))}
                </div>
            </section>

            {/* ── FEATURES ──────────────────────────────────────── */}
            <section id="producto" className="mx-auto max-w-[1280px] px-10 py-24">
                <div className="mx-auto mb-16 max-w-[680px] text-center">
                    <div className="mb-5 inline-block rounded-full border border-capsula-line bg-capsula-ivory-surface px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-navy-light">
                        Plataforma
                    </div>
                    <h2 className="font-heading mb-5 text-balance text-[clamp(40px,5vw,64px)] leading-[1.02] text-capsula-ink">
                        Un sistema operativo para tu cocina.
                    </h2>
                    <p className="text-pretty text-[17px] leading-[1.55] text-capsula-ink-soft">
                        Módulos independientes que se comunican entre sí. Implementación por fases,
                        sin romper la operación diaria de tu restaurante.
                    </p>
                </div>

                <div className="grid gap-px overflow-hidden rounded-[var(--radius)] border border-capsula-line bg-capsula-line md:grid-cols-3">
                    {features.map((f) => (
                        <div
                            key={f.title}
                            className="bg-capsula-ivory-surface p-8 transition-colors hover:bg-capsula-ivory"
                        >
                            <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-[var(--radius)] border border-capsula-line-strong text-capsula-ink">
                                <f.icon className="h-[22px] w-[22px]" strokeWidth={1.5} />
                            </div>
                            <h3 className="mb-2 text-base font-medium tracking-[-0.01em] text-capsula-ink">
                                {f.title}
                            </h3>
                            <p className="text-pretty text-[14px] leading-[1.55] text-capsula-ink-muted">
                                {f.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── SPLIT (dark) ──────────────────────────────────── */}
            <section className="bg-capsula-navy-deep text-[#F2EFE8]">
                <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-20 px-10 py-28 lg:grid-cols-[1.1fr_1fr]">
                    <div>
                        <div className="mb-5 inline-block rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[#E7D6CF]">
                            Resultados medibles
                        </div>
                        <h2 className="font-heading mb-5 text-balance text-[clamp(40px,5vw,64px)] leading-[1.02] text-[#F7F5F0]">
                            Menos mermas.
                            <br />
                            Más margen.
                            <br />
                            <span className="text-capsula-ink-faint">Operación más tranquila.</span>
                        </h2>
                        <p className="mb-8 max-w-[440px] text-pretty text-[17px] leading-[1.55] text-[#A3B2C3]">
                            Equipos que migran a CÁPSULA consolidan su operación en una sola vista y
                            recuperan en promedio 6 horas administrativas por semana.
                        </p>
                        <Link href="#clientes" className="inline-flex items-center gap-1.5 border-b border-white/20 pb-0.5 text-sm font-medium text-[#F7F5F0] transition-colors hover:border-capsula-coral">
                            Leer casos de estudio <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>

                    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius)] border border-white/10 bg-white/10">
                        {metrics.map((m) => (
                            <div key={m.l} className="bg-capsula-navy-deep p-7">
                                <div className="mb-3 font-medium text-[48px] leading-none tracking-[-0.02em] text-[#F7F5F0]">
                                    {m.k}
                                </div>
                                <div className="mb-1 text-sm text-[#E7D6CF]">{m.l}</div>
                                <div className="text-[12px] text-[#73889F]">{m.d}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── QUOTE ─────────────────────────────────────────── */}
            <section className="mx-auto max-w-[900px] px-10 py-28 text-center">
                <div className="font-heading mb-5 h-10 text-[120px] leading-[0.5] text-capsula-coral">"</div>
                <blockquote className="font-heading mb-10 text-balance text-[clamp(28px,3.5vw,40px)] leading-[1.25] tracking-[-0.015em] text-capsula-ink">
                    Migramos de tres sistemas distintos a CÁPSULA en dos semanas. Por primera vez
                    sabemos el costo real de cada plato el mismo día que se vende.
                </blockquote>
                <div className="inline-flex items-center gap-3.5">
                    <div className="h-12 w-12 rounded-full border border-capsula-line bg-gradient-to-br from-capsula-navy-light to-capsula-navy-deep" />
                    <div className="text-left">
                        <div className="text-sm font-medium">Mariana Restrepo</div>
                        <div className="text-[13px] text-capsula-ink-muted">Gerente operativa · Grupo La Barra</div>
                    </div>
                </div>
            </section>

            {/* ── CTA ──────────────────────────────────────────── */}
            <section className="mx-auto max-w-[1280px] px-10 pb-28">
                <div className="rounded-[20px] border border-capsula-line bg-capsula-ivory-alt px-10 py-20 text-center">
                    <h2 className="font-heading mb-5 text-balance text-[clamp(40px,5vw,64px)] leading-[1.02] text-capsula-ink">
                        ¿Listo para operar con claridad?
                    </h2>
                    <p className="mx-auto mb-8 max-w-[560px] text-pretty text-[17px] leading-[1.55] text-capsula-ink-soft">
                        Agenda una demostración de 30 minutos con un especialista. Te mostramos cómo
                        se vería CÁPSULA con los datos reales de tu restaurante.
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
                            ERP operativo para restaurantes independientes y grupos gastronómicos.
                        </p>
                    </div>
                    <div className="grid grid-cols-3 gap-8">
                        {[
                            { h: 'Producto', items: ['Inventario', 'Recetas', 'Costos', 'Analítica'] },
                            { h: 'Empresa',  items: ['Sobre nosotros', 'Clientes', 'Contacto'] },
                            { h: 'Recursos', items: ['Centro de ayuda', 'Estado del sistema', 'API'] },
                        ].map((col) => (
                            <div key={col.h}>
                                <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.1em] text-capsula-ink">
                                    {col.h}
                                </div>
                                {col.items.map((i) => (
                                    <Link key={i} href="#" className="block py-1.5 text-[14px] text-capsula-ink-soft transition-colors hover:text-capsula-ink">
                                        {i}
                                    </Link>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="mx-auto flex max-w-[1280px] items-center justify-between border-t border-capsula-line px-10 py-6 text-[13px] text-capsula-ink-muted">
                    <div>© 2026 CÁPSULA · Todos los derechos reservados</div>
                    <div className="flex gap-6">
                        <Link href="#">Términos</Link>
                        <Link href="#">Privacidad</Link>
                        <Link href="#">Seguridad</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
