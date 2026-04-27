import Link from 'next/link';
import {
    ArrowRight,
    Box,
    BookOpen,
    Coins,
    BarChart3,
} from 'lucide-react';
import CapsulaAnimatedMark from '@/components/brand/CapsulaAnimatedMark';

export default function HomePage() {
    const features = [
        { icon: Box,       title: 'Inventario', slug: 'inventario', desc: 'Gestión y control de stock en tiempo real, multi-ubicación y alertas de reabastecimiento.' },
        { icon: BookOpen,  title: 'Recetas',    slug: 'recetas',    desc: 'Estandarización y preparación con sub-recetas recursivas y control de mermas.' },
        { icon: Coins,     title: 'Costos',     slug: 'costos',     desc: 'Análisis de márgenes y gastos: COGS automático y costo real por plato el mismo día.' },
        { icon: BarChart3, title: 'Analítica',  slug: 'analitica',  desc: 'Reportes y datos clave: ventas, ticket promedio y utilidad operativa por jornada.' },
    ];

    return (
        <>
            {/* ── HERO ──────────────────────────────────────────── */}
            <section className="relative overflow-hidden px-10 pb-[110px] pt-20">
                <span className="cap-blob cap-blob--warm" style={{ left: -120, top: 120, width: 360, height: 360 }} />
                <span className="cap-blob cap-blob--cool" style={{ left: '70%', top: -60, width: 280, height: 280 }} />

                <div className="relative z-[1] mx-auto max-w-[880px] text-center">
                    {/* Capsule mark — animación SVG original con halo cálido */}
                    <div className="mb-7 flex justify-center">
                        <span className="cap-mark-halo">
                            <CapsulaAnimatedMark size={96} />
                        </span>
                    </div>

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
                        <Link
                            key={f.slug}
                            href={`/producto/${f.slug}`}
                            className="cap-card block"
                        >
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
                        </Link>
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
                        <Link href="/contacto" className="cap-btn cap-btn--ghost">
                            Hablar con ventas
                        </Link>
                    </div>
                </div>
            </section>
        </>
    );
}
