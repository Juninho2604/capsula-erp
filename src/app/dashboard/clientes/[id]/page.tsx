import { getSession } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { getCustomerDetailAction } from '@/app/actions/customer.actions';
import { CustomerDetailView } from './customer-detail-view';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CASHIER', 'CHEF'];

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) redirect('/login');
    if (!ALLOWED_ROLES.includes(session.role)) redirect('/dashboard');

    const { id } = await params;
    const res = await getCustomerDetailAction(id);
    if (!res.success || !res.data) notFound();

    return <CustomerDetailView customer={res.data} />;
}
