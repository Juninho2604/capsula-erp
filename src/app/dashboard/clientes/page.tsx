import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ClientesView } from './clientes-view';
import { listCustomersAction } from '@/app/actions/customer.actions';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Clientes | CAPSULA ERP',
    description: 'Gestión de clientes recurrentes',
};

// Quién puede gestionar clientes — superset de los que operan delivery/POS
// que es donde se consulta la cédula. Se puede ampliar con HR_MANAGER, etc.
const ALLOWED_ROLES = [
    'OWNER',
    'ADMIN_MANAGER',
    'OPS_MANAGER',
    'CASHIER',
    'CHEF',
];

export default async function ClientesPage() {
    const session = await getSession();
    if (!session) redirect('/login');
    if (!ALLOWED_ROLES.includes(session.role)) redirect('/dashboard');

    const { customers } = await listCustomersAction({ includeInactive: true });
    return <ClientesView initialCustomers={customers} currentUserRole={session.role} />;
}
