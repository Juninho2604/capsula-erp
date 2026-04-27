import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Activity, Database, Globe, Bell } from 'lucide-react';

export const metadata: Metadata = {
    title: 'Estado del sistema · CÁPSULA',
    description:
        'Disponibilidad operativa de la plataforma CÁPSULA: aplicación web, base de datos, integraciones y notificaciones.',
};

// NOTE: estado mock. Cuando exista monitoreo real (/api/health o servicio externo)
// reemplazar este array con fetch al endpoint y una página dinámica.
const SERVICIOS = [
    {
        icon: Globe,
        name: 'Aplicación web',
        desc: 'Dashboard, POS, módulos administrativos.',
        status: 'operational' as const,
    },
    {
        icon: Database,
        name: 'Base de datos',
        desc: 'PostgreSQL gestionado con replicación.',
        status: 'operational' as const,
    },
    {
        icon: Activity,
        name: 'API y server actions',
        desc: 'Endpoints internos y server actions de Next.js.',
        status: 'operational' as const,
    },
    {
        icon: Bell,
        name: 'Notificaciones',
        desc: 'Correos transaccionales y avisos in-app.',
        status: 'operational' as const,
    },
];

const STATUS_LABEL: Record<'operational' | 'degraded' | 'outage', { label: string; bg: string; text: string }> = {
    operational: { label: 'Operativo',         bg: '#1E3B2C', text: '#6FB88F' },
    degraded:    { label: 'Degradado',         bg: '#3B2F15', text: '#E8D9B8' },
    outage:      { label: 'Caído',             bg: '#3B1F14', text: '#EFD2C8' },
};

// 90 días de uptime mock (todos verdes). Cuando integremos monitoreo real,
// reemplazar por datos reales del servicio (Better Stack / Statuspage / propio).
const UPTIME_DAYS = Array.from({ length: 90 }, (_, i) => ({ day: i, status: 'ok' as const }));

export default function EstadoPage() {
    const allOperational = SERVICIOS.every((s) => s.status === 'operational');

    return (
        <>
            {/* ── HERO ──────────────────────────────────────────── */}
            <section className="relative overflow-hidden px-10 pb-12 pt-20">
                <span className="cap-blob cap-blob--cool" style={{ left: '70%', top: -40, width: 240, height: 240 }} />

                <div className="relative z-[1] mx-auto max-w-[880px] text-center">
                    <div className="cap-eyebrow mb-8">
                        <span>Recursos · Estado</span>
                    </div>

                    <div className="mb-7 inline-flex items-center justify-center gap-3">
                        <span
                            className="flex h-12 w-12 items-center justify-center rounded-full"
                            style={{
                                background: allOperational ? 'rgba(111, 184, 143, 0.18)' : 'rgba(232, 113, 74, 0.18)',
                                border: `1px solid ${allOperational ? 'rgba(111, 184, 143, 0.4)' : 'rgba(232, 113, 74, 0.4)'}`,
                            }}
                        >
                            <CheckCircle2
                                className="h-6 w-6"
                                strokeWidth={1.8}
                                style={{ color: allOperational ? '#6FB88F' : 'var(--cap-accent)' }}
                            />
                        </span>
                    </div>

                    <h1 className="cap-display mx-auto mb-4 text-balance text-[clamp(40px,5vw,60px)]">
                        {allOperational ? 'Todos los sistemas operativos.' : 'Hay un incidente activo.'}
                    </h1>
                    <p className="cap-text-blue mx-auto max-w-[560px] text-[15px] leading-[1.55] opacity-85">
                        Última actualización: hoy, hace pocos minutos.
                    </p>
                    <p className="cap-text-soft mx-auto mt-3 max-w-[560px] text-[12px]">
                        {/* TODO: integrar con servicio de monitoreo real (Better Stack / Statuspage / /api/health). */}
                        [Pendiente — datos en vivo desde monitoreo real]
                    </p>
                </div>
            </section>

            {/* ── COMPONENTES ──────────────────────────────────── */}
            <section className="relative overflow-hidden px-10 pb-[80px]">
                <div className="relative z-[1] mx-auto max-w-[900px] space-y-3">
                    {SERVICIOS.map((s) => {
                        const meta = STATUS_LABEL[s.status];
                        return (
                            <div key={s.name} className="cap-card flex items-center justify-between gap-6">
                                <div className="flex items-start gap-4">
                                    <span className="cap-icon" style={{ flexShrink: 0 }}>
                                        <s.icon className="h-[22px] w-[22px]" strokeWidth={1.5} style={{ color: 'var(--cap-accent)' }} />
                                    </span>
                                    <div>
                                        <div className="text-[15px] font-semibold tracking-[-0.01em] text-[color:var(--cap-ink)]">
                                            {s.name}
                                        </div>
                                        <p className="cap-text-dim m-0 mt-1 text-[13px] leading-[1.55]">{s.desc}</p>
                                    </div>
                                </div>
                                <span
                                    className="rounded-full px-3 py-1 text-[12px] font-semibold whitespace-nowrap"
                                    style={{ background: meta.bg, color: meta.text }}
                                >
                                    {meta.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </section>

            <hr className="cap-divider mx-14" />

            {/* ── UPTIME 90 DÍAS ───────────────────────────────── */}
            <section className="relative overflow-hidden px-10 py-[80px]">
                <div className="relative z-[1] mx-auto max-w-[900px]">
                    <div className="mb-6 flex items-baseline justify-between gap-4">
                        <div>
                            <div
                                className="cap-text-soft mb-2 text-[11px] font-semibold uppercase"
                                style={{ letterSpacing: '0.16em' }}
                            >
                                Últimos 90 días
                            </div>
                            <h2 className="cap-display text-[24px] leading-[1.2] tracking-[-0.02em]">
                                Disponibilidad histórica
                            </h2>
                        </div>
                        <div className="text-right">
                            <div className="cap-text-blue text-[24px] font-semibold tabular-nums">99.97%</div>
                            <div className="cap-text-soft text-[12px]">Uptime promedio</div>
                        </div>
                    </div>

                    <div className="cap-card">
                        <div className="flex flex-wrap gap-[3px]">
                            {UPTIME_DAYS.map((d) => (
                                <span
                                    key={d.day}
                                    title={`Día -${90 - d.day}`}
                                    className="h-7 w-1.5 rounded-sm"
                                    style={{
                                        background: d.status === 'ok'
                                            ? 'rgba(111, 184, 143, 0.7)'
                                            : 'var(--cap-accent)',
                                    }}
                                />
                            ))}
                        </div>
                        <div className="cap-text-soft mt-4 flex justify-between text-[11px]">
                            <span>Hace 90 días</span>
                            <span>Hoy</span>
                        </div>
                    </div>
                </div>
            </section>

            <hr className="cap-divider mx-14" />

            {/* ── INCIDENTES RECIENTES ─────────────────────────── */}
            <section className="relative overflow-hidden px-10 py-[80px]">
                <div className="relative z-[1] mx-auto max-w-[900px]">
                    <div
                        className="cap-text-soft mb-6 text-[11px] font-semibold uppercase"
                        style={{ letterSpacing: '0.16em' }}
                    >
                        Incidentes recientes
                    </div>

                    <div className="cap-card">
                        <div className="cap-text-dim text-[14px] leading-[1.7]">
                            <p className="m-0">
                                Sin incidentes registrados en los últimos 30 días.
                            </p>
                            <p className="cap-text-soft mt-3 m-0 text-[12px]">
                                {/* TODO: cuando exista feed real de incidentes, listar los últimos N con fecha, duración, componentes afectados y post-mortem. */}
                                [Pendiente — feed de incidentes con post-mortems históricos]
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── CTA ──────────────────────────────────────────── */}
            <section className="relative px-10 pb-[100px] pt-5">
                <div className="cap-cta-panel relative mx-auto max-w-[1100px] text-center">
                    <span className="cap-blob cap-blob--cool" style={{ left: '75%', top: '60%', width: 240, height: 240 }} />

                    <h2 className="cap-display relative z-[1] mb-3.5 text-balance text-[clamp(28px,3.5vw,40px)] leading-[1.15] tracking-[-0.025em]">
                        ¿Detectaste un problema?
                    </h2>
                    <p className="cap-text-blue relative z-[1] mb-8 text-[15px] opacity-85">
                        Si algo no funciona como esperas, escríbenos. Respondemos en horario operativo.
                    </p>
                    <div className="relative z-[1] flex flex-col items-center justify-center gap-3 sm:flex-row">
                        <Link href="/contacto" className="cap-btn cap-btn--primary">
                            Reportar incidencia <ArrowRight className="h-4 w-4" />
                        </Link>
                        <Link href="/ayuda" className="cap-btn cap-btn--ghost">
                            Centro de ayuda
                        </Link>
                    </div>
                </div>
            </section>
        </>
    );
}
