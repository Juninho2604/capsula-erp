import { WifiOff } from 'lucide-react';

export const metadata = {
    title: 'Sin conexión — Cápsula',
};

/**
 * Página servida por el Service Worker cuando el usuario navega sin red
 * y la página solicitada no está en cache. Diseño Minimal Navy completo
 * (light + dark) y sin dependencias externas para que funcione cuando
 * solo el SW esté vivo.
 */
export default function OfflinePage() {
    return (
        <div className="min-h-screen bg-capsula-ivory text-capsula-ink flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-capsula-ivory-surface border border-capsula-line rounded-3xl p-8 text-center space-y-5">
                <div className="mx-auto w-14 h-14 rounded-full bg-capsula-navy-soft flex items-center justify-center">
                    <WifiOff className="h-6 w-6 text-capsula-ink" />
                </div>
                <div className="space-y-2">
                    <h1 className="text-2xl font-semibold tracking-[-0.02em] text-capsula-ink">
                        Sin conexión
                    </h1>
                    <p className="text-sm text-capsula-ink-soft leading-relaxed">
                        Esta pantalla no está disponible sin internet. Lo que ya
                        cargaste sigue funcionando.
                    </p>
                </div>
                <div className="rounded-xl bg-capsula-ivory border border-capsula-line p-4 text-left space-y-2 text-xs text-capsula-ink-soft">
                    <p className="font-semibold text-capsula-ink uppercase tracking-[0.14em] text-[10px]">
                        Qué hacer
                    </p>
                    <ul className="space-y-1 list-disc list-inside">
                        <li>Verifica que el Wi-Fi esté conectado.</li>
                        <li>Vuelve a la pantalla anterior si la tenías abierta.</li>
                        <li>Intenta de nuevo cuando vuelva la señal.</li>
                    </ul>
                </div>
                <a
                    href="/dashboard"
                    className="inline-flex items-center justify-center w-full rounded-xl bg-capsula-navy-deep text-capsula-cream py-3 text-sm font-semibold transition active:scale-95"
                >
                    Reintentar
                </a>
            </div>
        </div>
    );
}
