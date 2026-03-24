import { getStockValidationEnabled } from '@/app/actions/system-config.actions';
import { POSConfigView } from './pos-config-view';

export const dynamic = 'force-dynamic';

export default async function POSConfigPage() {
  const stockValidationEnabled = await getStockValidationEnabled();
  return <POSConfigView initialStockValidation={stockValidationEnabled} />;
}
