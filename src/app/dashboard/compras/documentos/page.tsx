import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getSupplierDocumentsAction } from '@/app/actions/supplier-document.actions';
import { getInventoryItemsForSelect, getAreasForSelect } from '@/app/actions/entrada.actions';
import { getSuppliersAction, getPurchaseOrdersAction } from '@/app/actions/purchase.actions';
import { DocumentosView } from './documentos-view';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Facturas y Notas | CAPSULA ERP',
  description: 'Documentos de proveedor: facturas y notas de entrega',
};

export default async function DocumentosPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AUDITOR'].includes(session.role)) {
    redirect('/dashboard');
  }

  const [docs, items, areas, suppliers, receivedPOs] = await Promise.all([
    getSupplierDocumentsAction(),
    getInventoryItemsForSelect(),
    getAreasForSelect(),
    getSuppliersAction(),
    getPurchaseOrdersAction('RECEIVED'),
  ]);

  return (
    <DocumentosView
      initialDocuments={docs.data ?? []}
      items={(items ?? []).map((i) => ({ id: i.id, name: i.name, unit: i.baseUnit }))}
      areas={areas ?? []}
      suppliers={(suppliers ?? []).map((s) => ({ id: s.id, name: s.name }))}
      receivedPOs={(receivedPOs ?? []).map((p) => ({ id: p.id, orderNumber: p.orderNumber, orderName: p.orderName }))}
      canEdit={['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'].includes(session.role)}
    />
  );
}
