import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { MesonerosView } from './mesoneros-view';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Mesoneros | CAPSULA ERP',
    description: 'Gestión de mesoneros del restaurante',
};

const ALLOWED_ROLES = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'HR_MANAGER'];

export default async function MesonerosPage() {
    const session = await getSession();
    if (!session) {
        redirect('/login');
    }
    if (!ALLOWED_ROLES.includes(session.role)) {
        redirect('/dashboard');
    }
    return <MesonerosView currentUserRole={session.role} />;
}
