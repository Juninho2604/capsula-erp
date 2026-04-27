import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Compass, Eye, Heart, Users } from 'lucide-react';

export const metadata: Metadata = {
    title: 'Sobre nosotros · CÁPSULA',
    description:
        'Quiénes somos, qué construimos y por qué creemos que la operación gastronómica merece mejores herramientas.',
};

const VALORES = [
    {
        icon: Compass,
        title: 'Operación primero',
        body: 'Cada feature pasa por la prueba del salón a las 9 PM un viernes. Si no resuelve un problema concreto del operador, no entra.',
    },
    {
        icon: Eye,
        title: 'Decisiones con evidencia',
        body: 'Construimos para que la información esté siempre disponible y trazable. Sin métricas opacas ni "magic numbers".',
    },
    {
        icon: Heart,
        title: 'Trato directo',
        body: 'Hablamos como gente, no como software. Soporte en horario operativo, releases explicadas, errores reconocidos.',
    },
    {
        icon: Users,
        title: 'Equipos pequeños, decisiones rápidas',
        body: 'Mantenemos el equipo y los ciclos cortos. Eso permite que un cambio en producto llegue en días, no en trimestres.',
    },
];

export default function EmpresaPage() {
    return (
        <>
            {/* ── HERO ──────────────────────────────────────────── */}
            <section className="relative overflow-hidden px-10 pb-20 pt-20">
                <span className="cap-blob cap-blob--warm" style={{ left: -120, top: 80, width: 320, height: 320 }} />
                <span className="cap-blob cap-blob--cool" style={{ left: '70%', top: -40, width: 260, height: 260 }} />

                <div className="relative z-[1] mx-auto max-w-[880px] text-center">
                    <div className="cap-eyebrow mb-8">
                        <span>Empresa</span>
                    </div>
                    <h1 className="cap-display mx-auto mb-6 text-balance text-[clamp(48px,7vw,80px)]">
                        <span className="block">Software hecho por y para</span>
                        <span className="cap-display--italic block">quienes operan.</span>
                    </h1>
                    <p className="cap-text-blue mx-auto max-w-[620px] text-[17px] leading-[1.55] opacity-85">
                        CÁPSULA nació en cocinas reales, en barras llenas y en cierres de caja a las 2 AM.
                        Construimos la herramienta que nos hubiera gustado tener cuando dirigíamos
                        nuestros propios restaurantes.
                    </p>
                </div>
            </section>

            <hr className="cap-divider mx-14" />

            {/* ── HISTORIA ──────────────────────────────────────── */}
            <section className="relative overflow-hidden px-10 py-[100px]">
                <div className="relative z-[1] mx-auto grid max-w-[1100px] gap-16 lg:grid-cols-[1fr_1.4fr]">
                    <div>
                        <div className="cap-eyebrow mb-6">
                            <span>Historia</span>
                        </div>
                        <h2 className="cap-display text-[clamp(32px,4vw,48px)] leading-[1.1] tracking-[-0.025em]">
                            De nuestra cocina
                            <br />
                            <span className="italic font-semibold" style={{ color: 'rgba(244,241,234,0.85)' }}>
                                a la tuya.
                            </span>
                        </h2>
                    </div>
                    <div className="cap-text-dim space-y-5 text-[15px] leading-[1.7]">
                        <p>
                            Lo que hoy es CÁPSULA empezó como un Excel desordenado. Tres restaurantes,
                            tres formas distintas de calcular el costo de un plato, ningún sistema que
                            mostrara la operación completa en una sola vista.
                        </p>
                        <p>
                            Después de varios años usando ERPs genéricos, sistemas de punto de venta
                            cerrados y hojas de cálculo que se rompían cada mes, llegamos a una
                            conclusión simple: no existía una herramienta diseñada para entender la
                            operación gastronómica como un todo.
                        </p>
                        <p>
                            Empezamos a construir la nuestra. Primero para uso interno; después, al ver
                            que otros operadores tenían exactamente los mismos problemas, abrimos la
                            plataforma. Hoy CÁPSULA sirve a restaurantes independientes y grupos
                            gastronómicos que comparten una misma necesidad: tomar decisiones con datos
                            reales, no con sensaciones.
                        </p>
                        <p className="cap-text-soft text-[13px]">
                            {/* TODO: confirmar año de fundación, número de clientes activos y ciudades cubiertas. */}
                            [Pendiente — confirmar año de fundación y métricas de cobertura]
                        </p>
                    </div>
                </div>
            </section>

            <hr className="cap-divider mx-14" />

            {/* ── VALORES ──────────────────────────────────────── */}
            <section className="relative overflow-hidden px-10 py-[100px]">
                <div className="cap-dotgrid" />

                <div className="relative z-[1] mx-auto mb-14 max-w-[720px] text-center">
                    <div className="cap-eyebrow mb-7">
                        <span>Cómo trabajamos</span>
                    </div>
                    <h2 className="cap-display mb-4 text-balance text-[clamp(36px,4.5vw,52px)] leading-[1.1] tracking-[-0.025em]">
                        Cuatro principios que no se negocian.
                    </h2>
                </div>

                <div className="relative z-[1] mx-auto grid max-w-[1100px] gap-[18px] md:grid-cols-2">
                    {VALORES.map((v) => (
                        <div key={v.title} className="cap-card">
                            <span className="cap-icon">
                                <v.icon className="h-[22px] w-[22px]" strokeWidth={1.5} style={{ color: 'var(--cap-accent)' }} />
                            </span>
                            <div className="mt-[22px] mb-[10px] text-[16px] font-semibold tracking-[-0.01em] text-[color:var(--cap-ink)]">
                                {v.title}
                            </div>
                            <p className="cap-text-dim m-0 text-[13px] leading-[1.6]">{v.body}</p>
                        </div>
                    ))}
                </div>
            </section>

            <hr className="cap-divider mx-14" />

            {/* ── EQUIPO (placeholder) ─────────────────────────── */}
            <section className="relative overflow-hidden px-10 py-[100px]">
                <div className="relative z-[1] mx-auto max-w-[880px] text-center">
                    <div className="cap-eyebrow mb-7">
                        <span>Equipo</span>
                    </div>
                    <h2 className="cap-display mb-5 text-balance text-[clamp(32px,4vw,44px)] leading-[1.15] tracking-[-0.025em]">
                        Un equipo pequeño, con experiencia operativa real.
                    </h2>
                    <p className="cap-text-dim mx-auto max-w-[560px] text-[15px] leading-[1.65]">
                        Combinamos años en cocinas y barras con equipos de ingeniería de producto. Cada
                        decisión técnica pasa por la mirada de alguien que estuvo del otro lado del
                        sistema.
                    </p>

                    <div className="mt-12 inline-flex flex-col gap-2">
                        <p className="cap-text-soft text-[13px]">
                            {/* TODO: agregar grid del equipo (foto, nombre, rol, mini-bio). */}
                            [Pendiente — perfiles del equipo con foto, nombre, rol y una línea de bio]
                        </p>
                    </div>
                </div>
            </section>

            {/* ── CTA ──────────────────────────────────────────── */}
            <section className="relative px-10 pb-[100px] pt-5">
                <div className="cap-cta-panel relative mx-auto max-w-[1100px] text-center">
                    <span className="cap-blob cap-blob--warm" style={{ left: -80, top: -80, width: 260, height: 260 }} />
                    <span className="cap-blob cap-blob--cool" style={{ left: '75%', top: '60%', width: 240, height: 240 }} />

                    <h2 className="cap-display relative z-[1] mb-3.5 text-balance text-[clamp(32px,4.5vw,48px)] leading-[1.1] tracking-[-0.025em]">
                        ¿Quieres conocernos?
                    </h2>
                    <p className="cap-text-blue relative z-[1] mb-8 text-[15px] opacity-85">
                        Escríbenos directamente o agenda una demo con el equipo.
                    </p>
                    <div className="relative z-[1] flex flex-col items-center justify-center gap-3 sm:flex-row">
                        <Link href="/contacto" className="cap-btn cap-btn--primary">
                            Contactar al equipo <ArrowRight className="h-4 w-4" />
                        </Link>
                        <Link href="/login" className="cap-btn cap-btn--ghost">
                            Solicitar demo
                        </Link>
                    </div>
                </div>
            </section>
        </>
    );
}
