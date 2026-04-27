import type { Metadata } from 'next';
import Link from 'next/link';
import {
    ArrowRight,
    Rocket,
    Box,
    BookOpen,
    Coins,
    BarChart3,
    Users,
    Truck,
    CreditCard,
    Mail,
    LifeBuoy,
} from 'lucide-react';

export const metadata: Metadata = {
    title: 'Centro de ayuda · CÁPSULA',
    description:
        'Documentación, guías rápidas y respuestas a preguntas frecuentes para sacar el máximo provecho a CÁPSULA.',
};

const CATEGORIAS = [
    {
        icon: Rocket,
        title: 'Primeros pasos',
        desc: 'Configuración inicial, importación de datos, creación de usuarios y permisos.',
        articulos: ['Configurar tu primera ubicación', 'Cargar datos iniciales', 'Definir roles y permisos'],
    },
    {
        icon: Box,
        title: 'Inventario',
        desc: 'Gestión de stock, ubicaciones, ingresos, traslados y conteo físico.',
        articulos: ['Crear ítems y categorías', 'Registrar entrada de mercancía', 'Hacer un conteo físico'],
    },
    {
        icon: BookOpen,
        title: 'Recetas',
        desc: 'Fichas técnicas, sub-recetas, mermas y rendimientos.',
        articulos: ['Crear una receta básica', 'Configurar sub-recetas', 'Definir mermas por ingrediente'],
    },
    {
        icon: Coins,
        title: 'Costos',
        desc: 'Cálculo de COGS, márgenes, histórico y análisis de variaciones.',
        articulos: ['Entender el cálculo de costos', 'Revisar margen por plato', 'Detectar variaciones de costo'],
    },
    {
        icon: BarChart3,
        title: 'Analítica y reportes',
        desc: 'Dashboards de ventas, KPIs operativos y comparativas.',
        articulos: ['Leer el dashboard diario', 'Comparar períodos', 'Exportar reportes'],
    },
    {
        icon: Users,
        title: 'POS y operación',
        desc: 'Punto de venta, mesas, cuentas, propinas y cierres de caja.',
        articulos: ['Operar una jornada en POS', 'Subdividir cuentas', 'Hacer cierre de caja'],
    },
    {
        icon: Truck,
        title: 'Compras y proveedores',
        desc: 'Órdenes de compra, recepción, conciliación y cuentas por pagar.',
        articulos: ['Crear una orden de compra', 'Recepcionar mercancía', 'Conciliar facturas'],
    },
    {
        icon: CreditCard,
        title: 'Facturación y pagos',
        desc: 'Configuración de planes, métodos de pago y emisión de facturas.',
        articulos: ['Cambiar plan', 'Actualizar método de pago', 'Descargar facturas'],
    },
];

export default function AyudaPage() {
    return (
        <>
            {/* ── HERO ──────────────────────────────────────────── */}
            <section className="relative overflow-hidden px-10 pb-16 pt-20">
                <span className="cap-blob cap-blob--warm" style={{ left: -100, top: 60, width: 300, height: 300 }} />
                <span className="cap-blob cap-blob--cool" style={{ left: '75%', top: -40, width: 240, height: 240 }} />

                <div className="relative z-[1] mx-auto max-w-[880px] text-center">
                    <div className="cap-eyebrow mb-8">
                        <span>Recursos</span>
                    </div>
                    <h1 className="cap-display mx-auto mb-6 text-balance text-[clamp(48px,7vw,80px)]">
                        <span className="block">Centro de</span>
                        <span className="cap-display--italic block">ayuda.</span>
                    </h1>
                    <p className="cap-text-blue mx-auto max-w-[560px] text-[17px] leading-[1.55] opacity-85">
                        Guías rápidas y documentación para sacar el máximo provecho a la plataforma.
                    </p>
                    <p className="cap-text-soft mx-auto mt-6 max-w-[560px] text-[12px]">
                        {/* TODO: añadir buscador real (probablemente Algolia o búsqueda local sobre MD). */}
                        [Pendiente — buscador de artículos integrado]
                    </p>
                </div>
            </section>

            {/* ── CATEGORÍAS ───────────────────────────────────── */}
            <section className="relative overflow-hidden px-10 pb-[80px]">
                <div className="cap-dotgrid" />

                <div className="relative z-[1] mx-auto grid max-w-[1100px] gap-[18px] md:grid-cols-2 lg:grid-cols-3">
                    {CATEGORIAS.map((c) => (
                        <div key={c.title} className="cap-card">
                            <span className="cap-icon">
                                <c.icon className="h-[22px] w-[22px]" strokeWidth={1.5} style={{ color: 'var(--cap-accent)' }} />
                            </span>
                            <div className="mt-[22px] mb-[10px] text-[16px] font-semibold tracking-[-0.01em] text-[color:var(--cap-ink)]">
                                {c.title}
                            </div>
                            <p className="cap-text-dim mb-4 text-[13px] leading-[1.6]">{c.desc}</p>
                            <ul className="space-y-1.5 text-[12.5px]">
                                {c.articulos.map((a) => (
                                    <li key={a} className="cap-text-blue opacity-90">
                                        · {a}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <p className="cap-text-soft mx-auto mt-8 max-w-[1100px] text-center text-[12px]">
                    {/* TODO: cuando los artículos existan, linkear cada bullet a /ayuda/[slug]. */}
                    [Pendiente — generar páginas individuales de cada artículo]
                </p>
            </section>

            <hr className="cap-divider mx-14" />

            {/* ── CANALES DE SOPORTE ───────────────────────────── */}
            <section className="relative overflow-hidden px-10 py-[100px]">
                <div className="relative z-[1] mx-auto mb-12 max-w-[720px] text-center">
                    <div className="cap-eyebrow mb-7">
                        <span>¿No encuentras lo que buscas?</span>
                    </div>
                    <h2 className="cap-display mb-4 text-balance text-[clamp(28px,3.5vw,40px)] leading-[1.15] tracking-[-0.025em]">
                        Hablamos contigo directamente.
                    </h2>
                </div>

                <div className="relative z-[1] mx-auto grid max-w-[900px] gap-[18px] md:grid-cols-2">
                    <Link href="/contacto" className="cap-card block">
                        <span className="cap-icon">
                            <LifeBuoy className="h-[22px] w-[22px]" strokeWidth={1.5} style={{ color: 'var(--cap-accent)' }} />
                        </span>
                        <div className="mt-[22px] mb-[10px] text-[16px] font-semibold tracking-[-0.01em] text-[color:var(--cap-ink)]">
                            Soporte para clientes
                        </div>
                        <p className="cap-text-dim mb-4 text-[13px] leading-[1.65]">
                            Si ya eres cliente, accede al canal directo de soporte. Tiempo de respuesta
                            según plan contratado.
                        </p>
                        <div className="cap-text-blue inline-flex items-center gap-2 text-[13px] font-medium">
                            Ir a contacto <ArrowRight className="h-3.5 w-3.5" />
                        </div>
                    </Link>

                    <a href="mailto:soporte@capsula.app" className="cap-card block">
                        <span className="cap-icon">
                            <Mail className="h-[22px] w-[22px]" strokeWidth={1.5} style={{ color: 'var(--cap-accent)' }} />
                        </span>
                        <div className="mt-[22px] mb-[10px] text-[16px] font-semibold tracking-[-0.01em] text-[color:var(--cap-ink)]">
                            Escribir al equipo
                        </div>
                        <p className="cap-text-dim mb-4 text-[13px] leading-[1.65]">
                            Para preguntas generales, sugerencias de feature o problemas que no sean
                            urgentes.
                        </p>
                        <div className="cap-text-blue inline-flex items-center gap-2 text-[13px] font-medium">
                            soporte@capsula.app <ArrowRight className="h-3.5 w-3.5" />
                        </div>
                    </a>
                </div>
            </section>
        </>
    );
}
