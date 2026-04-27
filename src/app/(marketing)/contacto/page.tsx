import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Mail, MessageCircle, Linkedin, MapPin, Briefcase, LifeBuoy, Megaphone } from 'lucide-react';

export const metadata: Metadata = {
    title: 'Contacto · CÁPSULA',
    description:
        'Habla con el equipo de CÁPSULA. Canales para ventas, soporte técnico, prensa y oportunidades.',
};

const CANALES = [
    {
        icon: Mail,
        title: 'Correo electrónico',
        desc: 'Para ventas, soporte y propuestas comerciales.',
        action: 'hola@capsula.app',
        href: 'mailto:hola@capsula.app',
    },
    {
        icon: MessageCircle,
        title: 'WhatsApp',
        desc: 'Respuesta rápida en horario operativo (8 AM – 8 PM).',
        action: 'Abrir WhatsApp',
        href: 'https://wa.me/584000000000',
    },
    {
        icon: Linkedin,
        title: 'LinkedIn',
        desc: 'Síguenos para releases, posts técnicos y oportunidades.',
        action: '@capsula',
        href: 'https://www.linkedin.com/company/capsula',
    },
];

const RUTAS = [
    {
        icon: Briefcase,
        title: '¿Quieres una demo?',
        desc: 'Agendamos 30 minutos con un especialista, sobre los datos reales de tu restaurante.',
        cta: 'Solicitar demo',
        href: '/login',
    },
    {
        icon: LifeBuoy,
        title: 'Ya soy cliente',
        desc: 'Soporte técnico para clientes activos. Tiempo de respuesta según plan contratado.',
        cta: 'Centro de ayuda',
        href: '/ayuda',
    },
    {
        icon: Megaphone,
        title: 'Prensa o partnerships',
        desc: 'Para entrevistas, colaboraciones y acuerdos institucionales.',
        cta: 'prensa@capsula.app',
        href: 'mailto:prensa@capsula.app',
    },
];

export default function ContactoPage() {
    return (
        <>
            {/* ── HERO ──────────────────────────────────────────── */}
            <section className="relative overflow-hidden px-10 pb-16 pt-20">
                <span className="cap-blob cap-blob--warm" style={{ left: -100, top: 60, width: 300, height: 300 }} />
                <span className="cap-blob cap-blob--cool" style={{ left: '75%', top: -40, width: 240, height: 240 }} />

                <div className="relative z-[1] mx-auto max-w-[880px] text-center">
                    <div className="cap-eyebrow mb-8">
                        <span>Contacto</span>
                    </div>
                    <h1 className="cap-display mx-auto mb-6 text-balance text-[clamp(48px,7vw,80px)]">
                        <span className="block">Hablemos.</span>
                        <span className="cap-display--italic block">Sin intermediarios.</span>
                    </h1>
                    <p className="cap-text-blue mx-auto max-w-[560px] text-[17px] leading-[1.55] opacity-85">
                        Tres canales directos al equipo. Eligen el que prefieras y te respondemos.
                    </p>
                </div>
            </section>

            {/* ── CANALES ──────────────────────────────────────── */}
            <section className="relative overflow-hidden px-10 pb-[80px]">
                <div className="relative z-[1] mx-auto grid max-w-[1100px] gap-[18px] md:grid-cols-3">
                    {CANALES.map((c) => (
                        <a key={c.title} href={c.href} target={c.href.startsWith('http') ? '_blank' : undefined} rel={c.href.startsWith('http') ? 'noopener noreferrer' : undefined} className="cap-card block">
                            <span className="cap-icon">
                                <c.icon className="h-[22px] w-[22px]" strokeWidth={1.5} style={{ color: 'var(--cap-accent)' }} />
                            </span>
                            <div className="mt-[22px] mb-[10px] text-[16px] font-semibold tracking-[-0.01em] text-[color:var(--cap-ink)]">
                                {c.title}
                            </div>
                            <p className="cap-text-dim mb-4 text-[13px] leading-[1.6]">{c.desc}</p>
                            <div className="cap-text-blue inline-flex items-center gap-2 text-[13px] font-medium">
                                {c.action} <ArrowRight className="h-3.5 w-3.5" />
                            </div>
                        </a>
                    ))}
                </div>

                <p className="cap-text-soft mx-auto mt-6 max-w-[1100px] text-[12px]">
                    {/* TODO: reemplazar el número de WhatsApp +58 400 000 0000 y el handle de LinkedIn con los reales. */}
                    [Pendiente — número de WhatsApp y handle de LinkedIn definitivos]
                </p>
            </section>

            <hr className="cap-divider mx-14" />

            {/* ── RUTAS POR INTENCIÓN ──────────────────────────── */}
            <section className="relative overflow-hidden px-10 py-[100px]">
                <div className="cap-dotgrid" />

                <div className="relative z-[1] mx-auto mb-14 max-w-[720px] text-center">
                    <div className="cap-eyebrow mb-7">
                        <span>¿Por dónde empezar?</span>
                    </div>
                    <h2 className="cap-display mb-4 text-balance text-[clamp(32px,4vw,44px)] leading-[1.15] tracking-[-0.025em]">
                        Elige según tu caso.
                    </h2>
                </div>

                <div className="relative z-[1] mx-auto grid max-w-[1100px] gap-[18px] md:grid-cols-3">
                    {RUTAS.map((r) => (
                        <Link key={r.title} href={r.href} className="cap-card block">
                            <span className="cap-icon">
                                <r.icon className="h-[22px] w-[22px]" strokeWidth={1.5} style={{ color: 'var(--cap-accent)' }} />
                            </span>
                            <div className="mt-[22px] mb-[10px] text-[16px] font-semibold tracking-[-0.01em] text-[color:var(--cap-ink)]">
                                {r.title}
                            </div>
                            <p className="cap-text-dim mb-4 text-[13px] leading-[1.6]">{r.desc}</p>
                            <div className="cap-text-blue inline-flex items-center gap-2 text-[13px] font-medium">
                                {r.cta} <ArrowRight className="h-3.5 w-3.5" />
                            </div>
                        </Link>
                    ))}
                </div>
            </section>

            <hr className="cap-divider mx-14" />

            {/* ── UBICACIÓN / HORARIO ──────────────────────────── */}
            <section className="relative overflow-hidden px-10 py-[100px]">
                <div className="relative z-[1] mx-auto grid max-w-[1100px] gap-12 lg:grid-cols-[1fr_1fr]">
                    <div className="cap-card">
                        <span className="cap-icon">
                            <MapPin className="h-[22px] w-[22px]" strokeWidth={1.5} style={{ color: 'var(--cap-accent)' }} />
                        </span>
                        <div className="mt-[22px] mb-[10px] text-[16px] font-semibold tracking-[-0.01em] text-[color:var(--cap-ink)]">
                            Caracas, Venezuela
                        </div>
                        <p className="cap-text-dim m-0 text-[13px] leading-[1.7]">
                            Operamos remoto-first. La mayor parte del equipo está en Caracas, con
                            colaboradores en otras ciudades. Si necesitas reunión presencial,
                            coordinamos por WhatsApp.
                        </p>
                        <p className="cap-text-soft mt-3 text-[12px]">
                            {/* TODO: si hay oficina física pública, agregar dirección y mapa. */}
                            [Pendiente — definir si se publica dirección física]
                        </p>
                    </div>

                    <div className="cap-card">
                        <div
                            className="cap-text-soft mb-3 text-[11px] font-semibold uppercase"
                            style={{ letterSpacing: '0.16em' }}
                        >
                            Horario de atención
                        </div>
                        <div className="cap-text-dim space-y-3 text-[14px] leading-[1.7]">
                            <div className="flex items-baseline justify-between gap-4 border-b pb-2" style={{ borderColor: 'var(--cap-hair)' }}>
                                <span>Lunes a viernes</span>
                                <span className="cap-text-blue tabular-nums">8:00 — 20:00</span>
                            </div>
                            <div className="flex items-baseline justify-between gap-4 border-b pb-2" style={{ borderColor: 'var(--cap-hair)' }}>
                                <span>Sábados</span>
                                <span className="cap-text-blue tabular-nums">10:00 — 16:00</span>
                            </div>
                            <div className="flex items-baseline justify-between gap-4">
                                <span>Domingos y feriados</span>
                                <span className="cap-text-soft">Solo emergencias clientes</span>
                            </div>
                        </div>
                        <p className="cap-text-soft mt-5 text-[12px]">
                            Hora local Caracas (UTC−4). Tiempo de respuesta promedio fuera de horario:
                            menos de 12 horas hábiles.
                        </p>
                    </div>
                </div>
            </section>
        </>
    );
}
