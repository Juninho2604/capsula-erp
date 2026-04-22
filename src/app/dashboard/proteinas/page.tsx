import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import ProteinProcessingView from './protein-processing-view';

export const dynamic = 'force-dynamic';

export default function ProteinasPage() {
    return (
        <Suspense fallback={
            <div className="flex min-h-[60vh] items-center justify-center">
                <div className="text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-capsula-navy-deep" strokeWidth={1.5} />
                    <p className="mt-4 text-[13px] text-capsula-ink-muted">Cargando módulo de proteínas…</p>
                </div>
            </div>
        }>
            <ProteinProcessingView />
        </Suspense>
    );
}
