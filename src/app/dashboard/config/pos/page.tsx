import { getStockValidationEnabled, getDivisasDiscountPercentAction, getDeliveryFeesAction } from '@/app/actions/system-config.actions';
import { getSession } from '@/lib/auth';
import { POSConfigView } from './pos-config-view';

export const dynamic = 'force-dynamic';

export default async function POSConfigPage() {
  const [stockValidationEnabled, divisasPercent, deliveryFees, session] = await Promise.all([
    getStockValidationEnabled(),
    getDivisasDiscountPercentAction(),
    getDeliveryFeesAction(),
    getSession(),
  ]);
  const canEditDivisas = !!session && ['OWNER', 'AUDITOR', 'ADMIN_MANAGER'].includes(session.role);
  return (
    <POSConfigView
      initialStockValidation={stockValidationEnabled}
      initialDivisasPercent={divisasPercent}
      canEditDivisas={canEditDivisas}
      initialDeliveryFees={deliveryFees}
    />
  );
}
