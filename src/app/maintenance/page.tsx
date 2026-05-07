import CapsulaLogo from '@/components/ui/CapsulaLogo';

export const dynamic = 'force-static';
export const metadata = {
    title: 'En mantenimiento — CÁPSULA',
    description: 'Estamos haciendo mantenimiento del sistema. Volvemos en unos minutos.',
    robots: { index: false, follow: false },
};

export default function MaintenancePage() {
    return (
        <div
            className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12"
            style={{
                background: 'linear-gradient(145deg, #FF6B4A 0%, #E85A3A 38%, #2A4060 72%, #1B2D45 100%)',
            }}
        >
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.03]"
                style={{
                    backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
                    backgroundSize: '128px 128px',
                }}
            />

            <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-white/5 blur-3xl" />

            <div className="mb-8 flex flex-col items-center gap-2 text-center">
                <CapsulaLogo variant="full" size={44} tone="ivory" />
            </div>

            <div className="w-full max-w-md">
                <div
                    className="rounded-2xl p-8 shadow-2xl"
                    style={{ background: 'rgba(255, 255, 255, 0.97)' }}
                >
                    <div className="flex justify-center">
                        <div className="relative inline-flex">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#F25C3B] opacity-30" />
                            <span className="relative inline-flex h-3 w-3 rounded-full bg-[#F25C3B]" />
                        </div>
                    </div>

                    <h1 className="mt-6 text-center text-2xl font-semibold tracking-[-0.02em] text-[#1B2A3A]">
                        Estamos en mantenimiento
                    </h1>

                    <p className="mt-4 text-center text-base leading-relaxed text-[#4A5568]">
                        Estamos actualizando la base de datos del sistema. La aplicación volverá a funcionar en pocos minutos.
                    </p>

                    <div className="mt-6 rounded-xl border border-[#E8EDF2] bg-[#F7F9FB] p-4 text-center">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6B7280]">
                            Tiempo estimado
                        </p>
                        <p className="mt-1 text-lg font-semibold tabular-nums text-[#1B2A3A]">
                            5 a 15 minutos
                        </p>
                    </div>

                    <p className="mt-6 text-center text-xs text-[#6B7280]">
                        Si la página sigue así después de 30 minutos, contacta al administrador del sistema.
                    </p>
                </div>

                <p className="mt-6 text-center text-xs text-white/60">
                    Tus datos están seguros. Las ventas y operaciones se reanudarán automáticamente.
                </p>
            </div>
        </div>
    );
}
