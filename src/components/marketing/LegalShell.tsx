import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export interface LegalSection {
    id: string;
    title: string;
    body: ReactNode;
}

interface Props {
    eyebrow: string;
    title: string;
    lastUpdated: string;
    intro?: ReactNode;
    sections: LegalSection[];
}

export default function LegalShell({ eyebrow, title, lastUpdated, intro, sections }: Props) {
    return (
        <article className="relative overflow-hidden px-10 pb-[120px] pt-20">
            {/* Header */}
            <div className="relative z-[1] mx-auto max-w-[880px]">
                <Link
                    href="/"
                    className="cap-link mb-10 inline-flex items-center gap-2 text-[13px]"
                >
                    <ArrowLeft className="h-3.5 w-3.5" /> Volver al inicio
                </Link>

                <div className="cap-eyebrow mb-7">
                    <span>{eyebrow}</span>
                </div>

                <h1 className="cap-display mb-5 text-balance text-[clamp(40px,5vw,64px)] leading-[1.05] tracking-[-0.03em]">
                    {title}
                </h1>

                <p className="cap-text-soft mb-12 text-[13px]">
                    Última actualización: <span className="cap-text-dim">{lastUpdated}</span>
                </p>

                {intro && (
                    <div className="cap-text-dim mb-14 text-[15px] leading-[1.65]">{intro}</div>
                )}
            </div>

            {/* Body — TOC + sections */}
            <div className="relative z-[1] mx-auto grid max-w-[1100px] grid-cols-1 gap-12 lg:grid-cols-[260px_1fr]">
                {/* TOC */}
                <aside className="lg:sticky lg:top-24 lg:self-start">
                    <div
                        className="cap-text-soft mb-4 text-[11px] font-semibold uppercase"
                        style={{ letterSpacing: '0.16em' }}
                    >
                        Contenido
                    </div>
                    <nav className="flex flex-col gap-2.5">
                        {sections.map((s, i) => (
                            <a
                                key={s.id}
                                href={`#${s.id}`}
                                className="cap-link text-[13px] leading-[1.5]"
                            >
                                <span className="cap-text-soft mr-2">{String(i + 1).padStart(2, '0')}</span>
                                {s.title}
                            </a>
                        ))}
                    </nav>
                </aside>

                {/* Sections */}
                <div className="max-w-[720px]">
                    {sections.map((s, i) => (
                        <section key={s.id} id={s.id} className="mb-14 scroll-mt-24">
                            <div
                                className="cap-text-soft mb-3 text-[11px] font-semibold uppercase"
                                style={{ letterSpacing: '0.16em' }}
                            >
                                {String(i + 1).padStart(2, '0')} · Sección
                            </div>
                            <h2 className="cap-display mb-5 text-[26px] leading-[1.2] tracking-[-0.02em]">
                                {s.title}
                            </h2>
                            <div className="cap-text-dim space-y-4 text-[15px] leading-[1.7]">
                                {s.body}
                            </div>
                        </section>
                    ))}
                </div>
            </div>
        </article>
    );
}
