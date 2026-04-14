'use client';

import { useState } from 'react';
import { UserRole } from '@/types';
import { updateUserRole, toggleUserStatus } from '@/app/actions/user.actions';
import { toast } from 'react-hot-toast';

interface Props {
    initialUsers: any[]; // Usando any para simplificar por ahora, idealmente User[] de prisma select
    currentUserRole: string;
}

const AVAILABLE_ROLES: { value: UserRole; label: string }[] = [
    { value: 'OWNER', label: 'Dueño (Full Access)' },
    { value: 'AUDITOR', label: 'Auditor' },
    { value: 'ADMIN_MANAGER', label: 'Administrador' },
    { value: 'OPS_MANAGER', label: 'Gerente Ops.' },
    { value: 'HR_MANAGER', label: 'RRHH' },
    { value: 'CHEF', label: 'Chef Ejecutivo' },
    { value: 'AREA_LEAD', label: 'Jefe de Área' },
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
        <div className="bg-white rounded-lg shadowoverflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Usuario
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Email
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Rol Actual
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Estado
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Acciones
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {users.map((user) => (
                            <tr key={user.id} className={user.role === 'OWNER' ? 'bg-amber-50/30' : ''}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0 h-10 w-10">
                                            <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-800 font-bold">
                                                {user.firstName[0]}{user.lastName[0]}
                                            </div>
                                        </div>
                                        <div className="ml-4">
                                            <div className="text-sm font-medium text-gray-900">
                                                {user.firstName} {user.lastName}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-500">{user.email}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <select
                                        value={user.role}
                                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                        className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                                        disabled={currentUserRole !== 'OWNER' && user.role === 'OWNER'} // No-Owners can't touch Owners
                                    >
                                        {AVAILABLE_ROLES.map((role) => (
                                            <option key={role.value} value={role.value}>
                                                {role.label}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {user.isActive ? 'Activo' : 'Inactivo'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <button
                                        onClick={() => handleStatusToggle(user.id, user.isActive)}
                                        className={`${user.isActive ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}`}
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
                <div className="p-6 text-center text-gray-500">
                    No se encontraron usuarios o no tienes permisos para verlos.
                </div>
            )}
        </div>
    );
}
