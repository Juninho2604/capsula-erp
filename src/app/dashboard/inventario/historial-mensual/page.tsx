import { Suspense } from 'react';
import MovementHistoryView from './movement-history-view';

export default function HistorialMensualPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-[60vh] items-center justify-center">
                    <div className="text-center">
                        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-capsula-navy-deep"></div>
                        <p className="mt-4 text-sm text-capsula-ink-muted">Cargando historial…</p>
                    </div>
                </div>
            }
        >
            <MovementHistoryView />
        </Suspense>
    );
}
