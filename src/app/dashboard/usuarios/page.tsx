import { getUsers } from '@/app/actions/user.actions';
import UsersView from './users-view';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
    const users = await getUsers();

    return <UsersView initialUsers={users} />;
}
