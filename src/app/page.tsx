import Link from 'next/link';
import CapsulaLogo from '@/components/ui/CapsulaLogo';

export default function HomePage() {
    return (
        <div
            className="min-h-screen"
            style={{ background: 'linear-gradient(160deg, #FFF8F5 0%, #ffffff 50%, #F0F2F5 100%)' }}
        >
            {/* Nav mínima */}
            <nav className="flex items-center justify-between px-8 py-5">
                <CapsulaLogo variant="full" size={32} />
                <Link
                    href="/login"
                    className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100"
                >
                    Iniciar Sesión →
                </Link>
            </nav>

            {/* Hero */}
            <div className="relative mx-auto max-w-5xl px-8 pb-32 pt-20 text-center">
                {/* Glow de fondo */}
                <div
                    className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-80 w-80 rounded-full blur-3xl"
                    style={{ background: 'rgba(255, 107, 74, 0.12)' }}
                />

                {/* Badge */}
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#FF6B4A]/20 bg-[#FFF0EC] px-4 py-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#FF6B4A] animate-pulse" />
                    <span className="text-xs font-semibold text-[#E85A3A] tracking-wide">
                        ERP para Restaurantes
                    </span>
                </div>

                {/* Título */}
                <h1
                    className="mb-4 text-5xl tracking-tight text-[#1B2D45] sm:text-6xl lg:text-7xl"
                    style={{ fontFamily: "'Nunito', system-ui, sans-serif", fontWeight: 900 }}
                >
                    Tu negocio,{' '}
                    <span style={{ color: '#FF6B4A' }}>una cápsula.</span>
                </h1>

                <p className="mx-auto mb-10 max-w-xl text-lg text-gray-500 leading-relaxed">
                    Controla tu inventario, recetas y costos en tiempo real.
                    Simple para el mesero, poderoso para el gerente.
                </p>

                {/* CTA */}
                <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <Link
                        href="/login"
                        className="group inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-base font-semibold text-white transition-all duration-200 hover:shadow-lg active:scale-[0.98]"
                        style={{
                            background: 'linear-gradient(135deg, #FF6B4A 0%, #E85A3A 100%)',
                            boxShadow: '0 4px 14px rgba(255, 107, 74, 0.35)',
                        }}
                    >
                        Entrar al Sistema
                        <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                    </Link>
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-7 py-3.5 text-base font-semibold text-gray-700 transition-all hover:border-gray-300 hover:shadow-sm"
                    >
                        Ver Dashboard
                    </Link>
                </div>
            </div>

            {/* Features */}
            <div className="mx-auto max-w-5xl px-8 pb-24">
                <div className="grid gap-4 md:grid-cols-3">
                    {[
                        {
                            icon: '📦',
                            color: '#3B82F6',
                            bg: '#EFF6FF',
                            title: 'Control de Inventario',
                            desc: 'Stock en tiempo real, alertas de reabastecimiento y gestión multi-ubicación.',
                        },
                        {
                            icon: '📋',
                            color: '#10B981',
                            bg: '#ECFDF5',
                            title: 'Recetas y Sub-recetas',
                            desc: 'Gestión recursiva con cálculo automático de costos y control de mermas.',
                        },
                        {
                            icon: '💰',
                            color: '#FF6B4A',
                            bg: '#FFF0EC',
                            title: 'Costos en Tiempo Real',
                            desc: 'COGS automático, histórico de costos y márgenes por plato.',
                        },
                    ].map((f) => (
                        <div
                            key={f.title}
                            className="group rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
                        >
                            <div
                                className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl text-2xl"
                                style={{ background: f.bg }}
                            >
                                {f.icon}
                            </div>
                            <h3 className="mb-2 text-base font-bold text-gray-900">{f.title}</h3>
                            <p className="text-sm leading-relaxed text-gray-500">{f.desc}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer */}
            <footer className="border-t border-gray-100 py-6">
                <div className="mx-auto max-w-5xl px-8 flex items-center justify-between">
                    <CapsulaLogo variant="favicon" size={20} />
                    <p className="text-xs text-gray-400">© 2026 CÁPSULA · Todos los derechos reservados</p>
                </div>
            </footer>
        </div>
    );
}
