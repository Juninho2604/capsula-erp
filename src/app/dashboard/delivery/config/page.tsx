import { requireDeliveryPage } from '@/lib/delivery/require-delivery-page';
import { getDeliveryConfigAction } from '@/app/actions/delivery-config.actions';
import { DeliveryConfigView } from './config-view';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Config Delivery | KPSULA' };

export default async function DeliveryConfigPage() {
    await requireDeliveryPage();
    const { config } = await getDeliveryConfigAction();
    return <DeliveryConfigView initialConfig={config} />;
}
