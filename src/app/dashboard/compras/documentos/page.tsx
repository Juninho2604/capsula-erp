import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getSupplierDocumentsAction } from '@/app/actions/supplier-document.actions';
import { getInventoryItemsForSelect, getAreasForSelect } from '@/app/actions/entrada.actions';
import { getSuppliersAction, getLinkablePurchaseOrdersAction } from '@/app/actions/purchase.actions';
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

  const [docs, items, areas, suppliers, linkablePOs] = await Promise.all([
    getSupplierDocumentsAction(),
    getInventoryItemsForSelect(),
    getAreasForSelect(),
    getSuppliersAction(),
    // §164: vinculables = todo lo no cancelado que no tenga tomado otro
    // documento. Antes sólo las RECEIVED, y una OC recién generada no aparecía.
    getLinkablePurchaseOrdersAction(),
  ]);

  return (
    <DocumentosView
      initialDocuments={docs.data ?? []}
      items={(items ?? []).map((i) => ({ id: i.id, name: i.name, unit: i.baseUnit }))}
      areas={areas ?? []}
      suppliers={(suppliers ?? []).map((s) => ({ id: s.id, name: s.name }))}
      receivedPOs={(linkablePOs ?? []).map((p) => ({
        id: p.id, orderNumber: p.orderNumber, orderName: p.orderName,
        supplierName: p.supplierName, statusLabel: p.statusLabel, totalAmount: p.totalAmount,
      }))}
      canEdit={['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'].includes(session.role)}
    />
  );
}
