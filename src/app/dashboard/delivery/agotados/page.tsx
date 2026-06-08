import { requireDeliveryPage } from '@/lib/delivery/require-delivery-page';
import { listItemAvailabilityAction } from '@/app/actions/delivery-config.actions';
import { AgotadosView } from './agotados-view';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Agotados | KPSULA' };

export default async function AgotadosPage() {
    await requireDeliveryPage();
    const { items, branches } = await listItemAvailabilityAction();
    return <AgotadosView initialItems={items} branches={branches} />;
}
