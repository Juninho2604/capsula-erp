import type { ReactNode, ComponentType, CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowRight, Box, BookOpen, Coins, BarChart3 } from 'lucide-react';

interface IconProps {
    className?: string;
    strokeWidth?: number;
    style?: CSSProperties;
}

type ModuleSlug = 'inventario' | 'recetas' | 'costos' | 'analitica';

interface SubFeature {
    icon: ComponentType<IconProps>;
    title: string;
    desc: string;
}

interface Props {
    slug: ModuleSlug;
    Icon: ComponentType<IconProps>;
    title: string;
    tagline: string;
    intro: ReactNode;
    features: SubFeature[];
    whyMatters: ReactNode;
}

const ALL_MODULES: { slug: ModuleSlug; Icon: ComponentType<IconProps>; title: string; teaser: string }[] = [
    { slug: 'inventario', Icon: Box,       title: 'Inventario', teaser: 'Stock en tiempo real, multi-ubicación y alertas de reabastecimiento.' },
    { slug: 'recetas',    Icon: BookOpen,  title: 'Recetas',    teaser: 'Sub-recetas recursivas, mermas y costo recalculado en cada cambio.' },
    { slug: 'costos',     Icon: Coins,     title: 'Costos',     teaser: 'COGS automático y margen real por plato el mismo día de la venta.' },
    { slug: 'analitica',  Icon: BarChart3, title: 'Analítica',  teaser: 'Ventas, ticket promedio y utilidad operativa por jornada.' },
];

export default function ProductoShell({ slug, Icon, title, tagline, intro, features, whyMatters }: Props) {
    const others = ALL_MODULES.filter((m) => m.slug !== slug);

    return (
        <>
            {/* ── HERO ──────────────────────────────────────────── */}
            <section className="relative overflow-hidden px-10 pb-20 pt-20">
                <span className="cap-blob cap-blob--warm" style={{ left: -120, top: 80, width: 320, height: 320 }} />
                <span className="cap-blob cap-blob--cool" style={{ left: '70%', top: -40, width: 260, height: 260 }} />

                <div className="relative z-[1] mx-auto max-w-[880px] text-center">
                    <div className="mb-7 flex justify-center">
                        <span className="cap-icon" style={{ width: 64, height: 64 }}>
                            <Icon className="h-8 w-8" strokeWidth={1.5} style={{ color: 'var(--cap-accent)' }} />
                        </span>
                    </div>

                    <div className="cap-eyebrow mb-7">
                        <span>Producto · {title}</span>
                    </div>

                    <h1 className="cap-display mx-auto mb-6 text-balance text-[clamp(44px,6vw,72px)]">
                        {tagline}
                    </h1>

                    <div className="cap-text-blue mx-auto max-w-[620px] text-[17px] leading-[1.55] opacity-85">
                        {intro}
                    </div>

                    <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                        <Link href="/login" className="cap-btn cap-btn--primary">
                            Solicitar demo <ArrowRight className="h-4 w-4" />
                        </Link>
                        <Link href="/dashboard" className="cap-btn cap-btn--ghost">
                            Ver dashboard
                        </Link>
                    </div>
                </div>
            </section>

            <hr className="cap-divider mx-14" />

            {/* ── SUB-FEATURES ─────────────────────────────────── */}
            <section className="relative overflow-hidden px-10 py-[100px]">
                <div className="cap-dotgrid" />

                <div className="relative z-[1] mx-auto mb-14 max-w-[720px] text-center">
                    <div className="cap-eyebrow mb-7">
                        <span>Qué incluye</span>
                    </div>
                    <h2 className="cap-display mb-4 text-balance text-[clamp(32px,4vw,44px)] leading-[1.15] tracking-[-0.025em]">
                        Diseñado alrededor de la operación, no del manual.
                    </h2>
                </div>

                <div className="relative z-[1] mx-auto grid max-w-[1100px] gap-[18px] md:grid-cols-2">
                    {features.map((f) => (
                        <div key={f.title} className="cap-card">
                            <span className="cap-icon">
                                <f.icon className="h-[22px] w-[22px]" strokeWidth={1.5} style={{ color: 'var(--cap-accent)' }} />
                            </span>
                            <div className="mt-[22px] mb-[10px] text-[16px] font-semibold tracking-[-0.01em] text-[color:var(--cap-ink)]">
                                {f.title}
                            </div>
                            <p className="cap-text-dim m-0 text-[13px] leading-[1.65]">{f.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            <hr className="cap-divider mx-14" />

            {/* ── POR QUÉ IMPORTA ──────────────────────────────── */}
            <section className="relative overflow-hidden px-10 py-[100px]">
                <div className="relative z-[1] mx-auto grid max-w-[1100px] gap-16 lg:grid-cols-[1fr_1.4fr]">
                    <div>
                        <div className="cap-eyebrow mb-6">
                            <span>Por qué importa</span>
                        </div>
                        <h2 className="cap-display text-[clamp(28px,3.5vw,40px)] leading-[1.1] tracking-[-0.025em]">
                            Información que se traduce
                            <br />
                            <span className="italic font-semibold" style={{ color: 'rgba(244,241,234,0.85)' }}>
                                en decisiones reales.
                            </span>
                        </h2>
                    </div>
                    <div className="cap-text-dim space-y-5 text-[15px] leading-[1.7]">
                        {whyMatters}
                    </div>
                </div>
            </section>

            <hr className="cap-divider mx-14" />

            {/* ── CONEXIONES ───────────────────────────────────── */}
            <section className="relative overflow-hidden px-10 py-[100px]">
                <div className="relative z-[1] mx-auto mb-14 max-w-[720px] text-center">
                    <div className="cap-eyebrow mb-7">
                        <span>Conecta con</span>
                    </div>
                    <h2 className="cap-display mb-4 text-balance text-[clamp(28px,3.5vw,38px)] leading-[1.15] tracking-[-0.025em]">
                        Un módulo. La operación completa.
                    </h2>
                    <p className="cap-text-dim text-[15px] leading-[1.65]">
                        Los datos fluyen entre módulos automáticamente. No hay sincronización manual,
                        ni doble carga de información.
                    </p>
                </div>

                <div className="relative z-[1] mx-auto grid max-w-[1100px] gap-[18px] md:grid-cols-3">
                    {others.map((m) => (
                        <Link key={m.slug} href={`/producto/${m.slug}`} className="cap-card block">
                            <span className="cap-icon">
                                <m.Icon className="h-[22px] w-[22px]" strokeWidth={1.5} style={{ color: 'var(--cap-accent)' }} />
                            </span>
                            <div className="mt-[22px] mb-[10px] text-[16px] font-semibold tracking-[-0.01em] text-[color:var(--cap-ink)]">
                                {m.title}
                            </div>
                            <p className="cap-text-dim mb-4 text-[13px] leading-[1.6]">{m.teaser}</p>
                            <div className="cap-text-blue inline-flex items-center gap-2 text-[13px] font-medium">
                                Ver módulo <ArrowRight className="h-3.5 w-3.5" />
                            </div>
                        </Link>
                    ))}
                </div>
            </section>

            {/* ── CTA ──────────────────────────────────────────── */}
            <section className="relative px-10 pb-[100px] pt-5">
                <div className="cap-cta-panel relative mx-auto max-w-[1100px] text-center">
                    <span className="cap-blob cap-blob--warm" style={{ left: -80, top: -80, width: 260, height: 260 }} />
                    <span className="cap-blob cap-blob--cool" style={{ left: '75%', top: '60%', width: 240, height: 240 }} />

                    <h2 className="cap-display relative z-[1] mb-3.5 text-balance text-[clamp(32px,4.5vw,48px)] leading-[1.1] tracking-[-0.025em]">
                        Pongamos {title.toLowerCase()} bajo control.
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
