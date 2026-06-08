import { requireDeliveryPage } from '@/lib/delivery/require-delivery-page';
import { listDeliveryCustomersAction } from '@/app/actions/delivery-config.actions';
import { DeliveryClientesView } from './clientes-view';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Clientes Delivery | KPSULA' };

export default async function DeliveryClientesPage() {
    await requireDeliveryPage();
    const { customers } = await listDeliveryCustomersAction();
    return <DeliveryClientesView customers={customers} />;
}
