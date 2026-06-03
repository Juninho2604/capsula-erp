import type { Metadata } from 'next';
import Link from 'next/link';
import {
    Download,
    Smartphone,
    ShieldCheck,
    FolderDown,
    Settings2,
    CheckCircle2,
    ArrowRight,
} from 'lucide-react';

// Versión vigente del APK publicado en /public/downloads/kpsula-erp.apk.
// Al sacar una versión nueva, actualizá este valor (y reemplazá el .apk).
const APP_VERSION = '1.0.0';
const APK_HREF = '/downloads/kpsula-erp.apk';

export const metadata: Metadata = {
    title: 'Descargar la app · KPSULA',
    description:
        'Instalá KPSULA en tu tablet o teléfono Android. Descarga directa del APK firmado, con instrucciones paso a paso.',
};

const PASOS = [
    {
        icon: Download,
        title: 'Descargá el APK',
        desc: 'Tocá el botón de arriba. El archivo se guarda en tu teléfono o tablet (carpeta Descargas).',
    },
    {
        icon: FolderDown,
        title: 'Abrí el archivo',
        desc: 'Tocá la notificación de descarga, o buscá kpsula-erp.apk en tu gestor de archivos y abrilo.',
    },
    {
        icon: Settings2,
        title: 'Permití la instalación',
        desc: 'Si Android avisa que viene de una "fuente desconocida", tocá Ajustes y activá el permiso para tu navegador. Es solo la primera vez.',
    },
    {
        icon: CheckCircle2,
        title: 'Instalá y abrí',
        desc: 'Tocá Instalar y después Abrir. KPSULA queda como una app más en tu pantalla de inicio.',
    },
];

export default function DescargarPage() {
    return (
        <>
            {/* ── HERO + DESCARGA ───────────────────────────────── */}
            <section className="relative overflow-hidden px-10 pb-16 pt-20">
                <span className="cap-blob cap-blob--warm" style={{ left: -100, top: 60, width: 300, height: 300 }} />
                <span className="cap-blob cap-blob--cool" style={{ left: '75%', top: -40, width: 240, height: 240 }} />

                <div className="relative z-[1] mx-auto max-w-[880px] text-center">
                    <div className="cap-eyebrow mb-8">
                        <span>Descargar</span>
                    </div>
                    <h1 className="cap-display mx-auto mb-6 text-balance text-[clamp(44px,7vw,76px)]">
                        <span className="block">Llevá KPSULA</span>
                        <span className="cap-display--italic block">a tu tablet.</span>
                    </h1>
                    <p className="cap-text-blue mx-auto mb-10 max-w-[560px] text-[17px] leading-[1.55] opacity-85">
                        La app de Android para operar tu restaurante: POS, mesas, cocina y delivery.
                        Es la misma kpsula.app, empaquetada y firmada por nosotros.
                    </p>

                    <div className="flex flex-col items-center gap-4">
                        <a href={APK_HREF} download className="cap-btn cap-btn--primary inline-flex items-center gap-2 text-[15px]">
                            <Download className="h-[18px] w-[18px]" strokeWidth={2} />
                            Descargar APK para Android
                        </a>
                        <p className="cap-text-soft text-[12px]">
                            Versión {APP_VERSION} · Android 5.0 o superior · ~700 KB
                        </p>
                    </div>
                </div>
            </section>

            <hr className="cap-divider mx-14" />

            {/* ── PASOS DE INSTALACIÓN ──────────────────────────── */}
            <section className="relative overflow-hidden px-10 py-[90px]">
                <div className="cap-dotgrid" />

                <div className="relative z-[1] mx-auto mb-14 max-w-[720px] text-center">
                    <div className="cap-eyebrow mb-7">
                        <span>Instalación</span>
                    </div>
                    <h2 className="cap-display mb-4 text-balance text-[clamp(30px,4vw,42px)] leading-[1.15] tracking-[-0.025em]">
                        Cuatro pasos y listo.
                    </h2>
                    <p className="cap-text-blue mx-auto max-w-[520px] text-[15px] leading-[1.55] opacity-85">
                        Como la app no viene de la Play Store, Android pide confirmar una vez que confiás en ella.
                    </p>
                </div>

                <div className="relative z-[1] mx-auto grid max-w-[1100px] gap-[18px] md:grid-cols-2 lg:grid-cols-4">
                    {PASOS.map((p, i) => (
                        <div key={p.title} className="cap-card">
                            <span className="cap-icon">
                                <p.icon className="h-[22px] w-[22px]" strokeWidth={1.5} style={{ color: 'var(--cap-accent)' }} />
                            </span>
                            <div className="mt-[22px] mb-[10px] text-[16px] font-semibold tracking-[-0.01em] text-[color:var(--cap-ink)]">
                                <span className="cap-text-soft mr-1 tabular-nums">{i + 1}.</span> {p.title}
                            </div>
                            <p className="cap-text-dim m-0 text-[13px] leading-[1.6]">{p.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            <hr className="cap-divider mx-14" />

            {/* ── CONFIANZA + iOS ───────────────────────────────── */}
            <section className="relative overflow-hidden px-10 py-[90px]">
                <div className="relative z-[1] mx-auto grid max-w-[1100px] gap-[18px] lg:grid-cols-3">
                    <div className="cap-card">
                        <span className="cap-icon">
                            <ShieldCheck className="h-[22px] w-[22px]" strokeWidth={1.5} style={{ color: 'var(--cap-accent)' }} />
                        </span>
                        <div className="mt-[22px] mb-[10px] text-[16px] font-semibold tracking-[-0.01em] text-[color:var(--cap-ink)]">
                            Firmada por nosotros
                        </div>
                        <p className="cap-text-dim m-0 text-[13px] leading-[1.6]">
                            El APK está firmado con nuestra clave. Al abrirla, se muestra a pantalla completa
                            (sin barra del navegador) porque tu dispositivo verifica que viene de kpsula.app.
                        </p>
                    </div>

                    <div className="cap-card">
                        <span className="cap-icon">
                            <Smartphone className="h-[22px] w-[22px]" strokeWidth={1.5} style={{ color: 'var(--cap-accent)' }} />
                        </span>
                        <div className="mt-[22px] mb-[10px] text-[16px] font-semibold tracking-[-0.01em] text-[color:var(--cap-ink)]">
                            ¿Tenés iPhone o iPad?
                        </div>
                        <p className="cap-text-dim m-0 text-[13px] leading-[1.6]">
                            iOS no permite instalar APKs. Abrí{' '}
                            <a href="https://kpsula.app" className="cap-text-blue underline">kpsula.app</a>{' '}
                            en Safari y tocá Compartir → "Agregar a inicio" para usarla como app.
                        </p>
                    </div>

                    <div className="cap-card">
                        <span className="cap-icon">
                            <Download className="h-[22px] w-[22px]" strokeWidth={1.5} style={{ color: 'var(--cap-accent)' }} />
                        </span>
                        <div className="mt-[22px] mb-[10px] text-[16px] font-semibold tracking-[-0.01em] text-[color:var(--cap-ink)]">
                            Actualizaciones
                        </div>
                        <p className="cap-text-dim mb-4 text-[13px] leading-[1.6]">
                            Cuando saquemos una versión nueva, descargás el APK de nuevo desde esta misma página
                            e instalás encima. Tus datos no se tocan.
                        </p>
                        <Link href="/" className="cap-text-blue inline-flex items-center gap-2 text-[13px] font-medium">
                            Volver al inicio <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>
                </div>
            </section>
        </>
    );
}
