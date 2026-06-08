import { requireDeliveryPage } from '@/lib/delivery/require-delivery-page';
import { listDeliverySedesAction } from '@/app/actions/delivery-sedes.actions';
import { SedesView } from './sedes-view';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sedes Delivery | KPSULA' };

export default async function SedesPage() {
    await requireDeliveryPage();
    const { sedes, managers } = await listDeliverySedesAction();
    return <SedesView initialSedes={sedes} managers={managers} />;
}
