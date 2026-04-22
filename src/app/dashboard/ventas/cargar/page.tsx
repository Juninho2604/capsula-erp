import { Suspense } from 'react';
import SalesEntryView from './sales-entry-view';

export const dynamic = 'force-dynamic';

export default function CargarVentasPage() {
    return (
        <Suspense fallback={
            <div className="flex min-h-[60vh] items-center justify-center">
                <div className="text-center">
                    <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-capsula-navy-deep"></div>
                    <p className="mt-4 text-sm text-capsula-ink-muted">Cargando módulo de ventas…</p>
                </div>
            </div>
        }>
            <SalesEntryView />
        </Suspense>
    );
}
