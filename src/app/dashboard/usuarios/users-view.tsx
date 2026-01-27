'use client';

import { useState } from 'react';
import { UserRole } from '@/types';
import { ROLE_INFO } from '@/lib/constants/roles';
import { updateUserRole, toggleUserStatus } from '@/app/actions/user.actions';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';

interface UsersViewProps {
    initialUsers: any[]; // User[]
}

export default function UsersView({ initialUsers }: UsersViewProps) {
    const { user: currentUser } = useAuthStore();
    const canManageUsers = hasPermission(currentUser?.role, PERMISSIONS.MANAGE_USERS);
    const isOwner = currentUser?.role === 'OWNER';

    const [users, setUsers] = useState(initialUsers);
    const [editingUser, setEditingUser] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Filter sensitive users (like other OWNERS) if not OWNER?
    // Requirement: "claro cada quien con su debido limite de informacion a excepcion de los dueños"
    // We will visually disable editing for higher roles if not OWNER.

    const handleRoleChange = async (userId: string, newRole: string) => {
        if (!confirm(`¿Estás seguro de cambiar el rol a ${newRole}?`)) return;

        setIsLoading(true);
        try {
            const res = await updateUserRole(userId, newRole);
            if (res.success) {
                toast.success(res.message);
                setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
                setEditingUser(null);
            } else {
                toast.error(res.message);
            }
        } catch (error) {
            toast.error('Error al actualizar rol');
        } finally {
            setIsLoading(false);
        }
    };

    const handleStatusToggle = async (userId: string, currentStatus: boolean) => {
        if (!confirm(`¿Estás seguro de ${currentStatus ? 'desactivar' : 'activar'} este usuario?`)) return;

        setIsLoading(true);
        try {
            const res = await toggleUserStatus(userId, !currentStatus);
            if (res.success) {
                toast.success(res.message);
                setUsers(users.map(u => u.id === userId ? { ...u, isActive: !currentStatus } : u));
            } else {
                toast.error(res.message);
            }
        } catch (error) {
            toast.error('Error al cambiar estado');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-in">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Gestión de Usuarios
                    </h1>
                    <p className="text-gray-500">
                        {users.length} usuarios registrados
                    </p>
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                                    Usuario
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                                    Rol
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                                    Estado
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {users.map((u) => {
                                const roleInfo = ROLE_INFO[u.role as UserRole] || { labelEs: u.role, color: '#6b7280' };
                                const isSelf = u.id === currentUser?.id;
                                const isTargetOwner = u.role === 'OWNER';

                                // Logic: Only OWNER can manage other OWNERS.
                                // Others can manage roles below them (simplified: if manage_users, can manage non-owners)
                                const canEdit = canManageUsers && !isSelf && (isOwner || !isTargetOwner);

                                return (
                                    <tr key={u.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-lg dark:bg-gray-700">
                                                    👤
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-900 dark:text-white">
                                                        {u.firstName} {u.lastName}
                                                    </p>
                                                    <p className="text-xs text-gray-500">{u.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {editingUser === u.id ? (
                                                <select
                                                    className="rounded border border-gray-300 text-sm p-1"
                                                    value={u.role}
                                                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                                    disabled={isLoading}
                                                    onBlur={() => setEditingUser(null)}
                                                    autoFocus
                                                >
                                                    {Object.keys(ROLE_INFO).map((role) => (
                                                        <option key={role} value={role}>
                                                            {ROLE_INFO[role as UserRole].labelEs}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <span
                                                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                                                    style={{
                                                        backgroundColor: `${roleInfo.color}20`,
                                                        color: roleInfo.color,
                                                    }}
                                                >
                                                    {roleInfo.labelEs}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={cn(
                                                "inline-flex rounded-full px-2 py-1 text-xs font-semibold",
                                                u.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                                            )}>
                                                {u.isActive ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-2">
                                            {canEdit && (
                                                <>
                                                    <button
                                                        onClick={() => setEditingUser(u.id)}
                                                        className="text-amber-600 hover:text-amber-900 text-sm font-medium"
                                                        disabled={isLoading}
                                                    >
                                                        Cambiar Rol
                                                    </button>
                                                    <button
                                                        onClick={() => handleStatusToggle(u.id, u.isActive)}
                                                        className={cn(
                                                            "text-sm font-medium ml-3",
                                                            u.isActive ? "text-red-600 hover:text-red-900" : "text-green-600 hover:text-green-900"
                                                        )}
                                                        disabled={isLoading}
                                                    >
                                                        {u.isActive ? 'Desactivar' : 'Activar'}
                                                    </button>
                                                </>
                                            )}
                                            {!canEdit && (
                                                <span className="text-xs text-gray-400 italic">Sólo lectura</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
