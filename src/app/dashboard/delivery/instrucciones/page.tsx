import { requireDeliveryPage } from '@/lib/delivery/require-delivery-page';
import {
    listManagerNotesAction,
    listRoutingRulesAction,
} from '@/app/actions/delivery-config.actions';
import { InstruccionesView } from './instrucciones-view';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Instrucciones del gerente | KPSULA' };

export default async function InstruccionesPage() {
    await requireDeliveryPage();
    const [notesRes, rulesRes] = await Promise.all([
        listManagerNotesAction(),
        listRoutingRulesAction(),
    ]);
    return (
        <InstruccionesView
            initialNotes={notesRes.notes}
            initialRules={rulesRes.rules}
            branches={notesRes.branches}
        />
    );
}
