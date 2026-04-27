import './aurora-landing.css';

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
        <div className="cap-backdrop">
            {/* ── NAV ───────────────────────────────────────────── */}
            <nav className="cap-nav">
                <div className="relative z-[1] mx-auto flex max-w-[1280px] items-center justify-between px-10 py-5">
                    <CapsulaLogo variant="full" size={22} />
                    <div className="flex items-center gap-5">
                        <Link href="/login" className="cap-link text-[13px]">
                            Iniciar sesión
                        </Link>
                        <Link
                            href="/login"
                            className="cap-btn cap-btn--ghost !py-[9px] !px-4 text-[13px]"
                            style={{
                                borderColor: 'rgba(122, 167, 255, 0.35)',
                                background:
                                    'linear-gradient(180deg, rgba(122, 167, 255, 0.22), rgba(122, 167, 255, 0.08))',
                                boxShadow:
                                    'inset 0 1px 0 rgba(255,255,255,0.12), 0 4px 14px rgba(122, 167, 255, 0.18)',
                            }}
                        >
                            Solicitar demo <ArrowRight className="h-3.5 w-3.5 opacity-85" />
                        </Link>
                    </div>
                </div>
            </nav>

            {/* ── HERO ──────────────────────────────────────────── */}
            <section className="relative overflow-hidden px-10 pb-[110px] pt-20">
                {/* decorative blobs */}
                <span className="cap-blob cap-blob--warm" style={{ left: -120, top: 120, width: 360, height: 360 }} />
                <span className="cap-blob cap-blob--cool" style={{ left: '70%', top: -60, width: 280, height: 280 }} />

                <div className="relative z-[1] mx-auto max-w-[880px] text-center">
                    {/* Capsule mark — animación SVG original con halo cálido */}
                    <div className="mb-7 flex justify-center">
                        <span className="cap-mark-halo">
                            <CapsulaAnimatedMark size={96} />
                        </span>
                    </div>

                    {/* Eyebrow pill */}
                    <div className="cap-eyebrow mb-8">
                        <span className="cap-eyebrow__dot" />
                        <span>Software de gestión gastronómica</span>
                    </div>

                    <h1 className="cap-display mx-auto mb-6 text-balance text-[clamp(56px,8vw,92px)]">
                        <span className="block">Tu negocio,</span>
                        <span className="cap-display--italic block">una cápsula.</span>
                    </h1>

                    <p className="cap-text-blue mx-auto mb-9 max-w-[520px] text-[17px] leading-[1.5] opacity-85">
                        Una sola plataforma, del salón a la dirección.
                    </p>

                    <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                        <Link href="/login" className="cap-btn cap-btn--primary">
                            Entrar al sistema <ArrowRight className="h-4 w-4" />
                        </Link>
                        <Link href="/dashboard" className="cap-btn cap-btn--ghost">
                            Ver dashboard
                        </Link>
                    </div>
                </div>
            </section>

            {/* ── DIVIDER ───────────────────────────────────────── */}
            <hr className="cap-divider mx-14" />

            {/* ── PRODUCTO ──────────────────────────────────────── */}
            <section id="producto" className="relative overflow-hidden px-10 py-[100px]">
                <div
                    className="pointer-events-none absolute inset-0 z-0"
                    style={{
                        background:
                            'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(232,113,74,0.08), transparent 60%)',
                    }}
                />
                <div className="cap-dotgrid" />

                <div className="relative z-[1] mx-auto mb-14 max-w-[720px] text-center">
                    <div className="cap-eyebrow mb-7">
                        <span>Producto</span>
                    </div>
                    <h2 className="cap-display mb-4 text-balance text-[clamp(40px,5vw,56px)] leading-[1.05] tracking-[-0.03em]">
                        Cuatro módulos.
                        <br />
                        <span className="italic font-semibold" style={{ color: 'rgba(244,241,234,0.85)' }}>
                            Una sola operación.
                        </span>
                    </h2>
                    <p className="cap-text-dim text-[15px] leading-[1.6]">
                        Implementación por fases. Adopta solo lo que necesitas, cuando lo necesitas.
                    </p>
                </div>

                <div className="relative z-[1] mx-auto grid max-w-[1100px] gap-[18px] md:grid-cols-2 lg:grid-cols-4">
                    {features.map((f) => (
                        <div key={f.title} className="cap-card">
                            <span className="cap-icon">
                                <f.icon
                                    className="h-[22px] w-[22px]"
                                    strokeWidth={1.5}
                                    style={{ color: 'var(--cap-accent)' }}
                                />
                            </span>
                            <div className="mt-[22px] mb-[10px] text-[16px] font-semibold tracking-[-0.01em] text-[color:var(--cap-ink)]">
                                {f.title}
                            </div>
                            <p className="cap-text-dim m-0 text-[13px] leading-[1.6]">{f.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── CTA ──────────────────────────────────────────── */}
            <section className="relative px-10 pb-[100px] pt-5">
                <div className="cap-cta-panel relative mx-auto max-w-[1100px] text-center">
                    <span className="cap-blob cap-blob--warm" style={{ left: -80, top: -80, width: 260, height: 260 }} />
                    <span className="cap-blob cap-blob--cool" style={{ left: '75%', top: '60%', width: 240, height: 240 }} />

                    <h2 className="cap-display relative z-[1] mb-3.5 text-balance text-[clamp(36px,4.5vw,52px)] leading-[1.05] tracking-[-0.03em]">
                        Pongamos tu operación
                        <br />
                        en una sola vista.
                    </h2>
                    <p className="cap-text-blue relative z-[1] mb-8 text-[15px] opacity-85">
                        30 minutos con un especialista, sobre los datos reales de tu restaurante.
                    </p>
                    <div className="relative z-[1] flex flex-col items-center justify-center gap-3 sm:flex-row">
                        <Link href="/login" className="cap-btn cap-btn--primary">
                            Solicitar demo <ArrowRight className="h-4 w-4" />
                        </Link>
                        <Link href="#contacto" className="cap-btn cap-btn--ghost">
                            Hablar con ventas
                        </Link>
                    </div>
                </div>
            </section>

            {/* ── FOOTER ───────────────────────────────────────── */}
            <footer
                className="relative px-10 pb-12 pt-14"
                style={{ borderTop: '1px solid var(--cap-hair)' }}
            >
                <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
                    <div>
                        <CapsulaLogo variant="full" size={22} />
                        <p className="cap-text-dim mt-4 max-w-[280px] text-[13px] leading-[1.6]">
                            Plataforma de gestión para restaurantes{' '}
                            <span className="cap-text-blue">independientes y grupos gastronómicos.</span>
                        </p>
                    </div>
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
                            <div
                                className="cap-text-soft mb-[18px] text-[11px] font-semibold uppercase"
                                style={{ letterSpacing: '0.16em' }}
                            >
                                {col.h}
                            </div>
                            {col.items.map((i) => (
                                <Link
                                    key={i.label}
                                    href={i.href}
                                    className="cap-text-blue mb-2.5 block text-[13px] opacity-90 transition-opacity hover:opacity-100"
                                >
                                    {i.label}
                                </Link>
                            ))}
                        </div>
                    ))}
                </div>

                <hr className="cap-divider mx-0 mt-12" />

                <div className="mx-auto mt-6 flex max-w-[1280px] flex-col items-start justify-between gap-3 text-[12px] sm:flex-row sm:items-center">
                    <div className="cap-text-soft">© 2026 CÁPSULA · Todos los derechos reservados</div>
                    <div className="flex gap-6">
                        <Link href="#terminos"   className="cap-link">Términos y condiciones</Link>
                        <Link href="#privacidad" className="cap-link">Privacidad</Link>
                        <Link href="#seguridad"  className="cap-link">Seguridad</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
