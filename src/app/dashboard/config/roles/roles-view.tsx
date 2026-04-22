'use client';

import { useState } from 'react';
import { UserRole } from '@/types';
import { updateUserRole, toggleUserStatus } from '@/app/actions/user.actions';
import { toast } from 'react-hot-toast';
import { Badge } from '@/components/ui/Badge';
import { Users } from 'lucide-react';

interface Props {
    initialUsers: any[]; // Usando any para simplificar por ahora, idealmente User[] de prisma select
    currentUserRole: string;
}

const AVAILABLE_ROLES: { value: UserRole; label: string }[] = [
    { value: 'OWNER', label: 'Dueño (Full Access)' },
    { value: 'AUDITOR', label: 'Auditor' },
    { value: 'ADMIN_MANAGER', label: 'Gerente Adm.' },
    { value: 'OPS_MANAGER', label: 'Gerente Ops.' },
    { value: 'HR_MANAGER', label: 'RRHH' },
    { value: 'CHEF', label: 'Chef Ejecutivo' },
    { value: 'AREA_LEAD', label: 'Jefe de Área' },
    { value: 'CASHIER', label: 'Cajera' },
    { value: 'KITCHEN_CHEF', label: 'Jefe de Cocina' },
    { value: 'WAITER', label: 'Mesero' },
];

export function RolesView({ initialUsers, currentUserRole }: Props) {
    const [users, setUsers] = useState(initialUsers);

    const handleRoleChange = async (userId: string, newRole: string) => {
        // Optimistic update
        const oldUsers = [...users];
        setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));

        const result = await updateUserRole(userId, newRole);

        if (result.success) {
            toast.success('Rol actualizado');
        } else {
            toast.error(result.message || 'Error al actualizar');
            setUsers(oldUsers); // Revert
        }
    };

    const handleStatusToggle = async (userId: string, currentStatus: boolean) => {
        const newStatus = !currentStatus;
        // Optimistic update
        const oldUsers = [...users];
        setUsers(users.map(u => u.id === userId ? { ...u, isActive: newStatus } : u));

        const result = await toggleUserStatus(userId, newStatus);

        if (result.success) {
            toast.success(`Usuario ${newStatus ? 'activado' : 'desactivado'}`);
        } else {
            toast.error(result.message || 'Error al cambiar estado');
            setUsers(oldUsers); // Revert
        }
    };

    return (
        <div className="overflow-hidden rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface shadow-cap-soft">
            <div className="overflow-x-auto">
                <table className="min-w-full">
                    <thead className="border-b border-capsula-line bg-capsula-ivory-alt">
                        <tr>
                            {['Usuario', 'Email', 'Rol actual', 'Estado', 'Acciones'].map(h => (
                                <th key={h} className="px-6 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-capsula-line">
                        {users.map((user) => (
                            <tr key={user.id} className={user.role === 'OWNER' ? 'bg-[#F3EAD6]/30' : 'hover:bg-capsula-ivory-alt/40'}>
                                <td className="whitespace-nowrap px-6 py-4">
                                    <div className="flex items-center">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-capsula-line bg-capsula-ivory-alt font-medium text-capsula-navy-deep">
                                            {user.firstName[0]}{user.lastName[0]}
                                        </div>
                                        <div className="ml-4 text-[13px] font-medium text-capsula-ink">
                                            {user.firstName} {user.lastName}
                                        </div>
                                    </div>
                                </td>
                                <td className="whitespace-nowrap px-6 py-4 text-[13px] text-capsula-ink-soft">{user.email}</td>
                                <td className="whitespace-nowrap px-6 py-4">
                                    <select
                                        value={user.role}
                                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                        className="block w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2 text-[13px] text-capsula-ink focus:border-capsula-navy-deep focus:outline-none"
                                        disabled={currentUserRole !== 'OWNER' && user.role === 'OWNER'}
                                    >
                                        {AVAILABLE_ROLES.map((role) => (
                                            <option key={role.value} value={role.value}>
                                                {role.label}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                <td className="whitespace-nowrap px-6 py-4">
                                    <Badge variant={user.isActive ? 'ok' : 'danger'}>
                                        {user.isActive ? 'Activo' : 'Inactivo'}
                                    </Badge>
                                </td>
                                <td className="whitespace-nowrap px-6 py-4">
                                    <button
                                        onClick={() => handleStatusToggle(user.id, user.isActive)}
                                        className={`text-[13px] font-medium transition-colors ${user.isActive ? 'text-capsula-coral hover:text-capsula-coral/80' : 'text-[#2F6B4E] hover:text-[#2F6B4E]/80'}`}
                                        disabled={currentUserRole !== 'OWNER' && user.role === 'OWNER'}
                                    >
                                        {user.isActive ? 'Desactivar' : 'Activar'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {users.length === 0 && (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                    <Users className="h-10 w-10 text-capsula-ink-muted/50" strokeWidth={1.25} />
                    <p className="mt-3 text-[13px] text-capsula-ink-soft">
                        No se encontraron usuarios o no tienes permisos para verlos.
                    </p>
                </div>
            )}
        </div>
    );
}
