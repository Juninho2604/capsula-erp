import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, UserRole, canViewCosts } from '@/types';
import { mockCurrentUser } from '@/lib/mock-data';

/**
 * Bolsillo de permisos del usuario actual — sincronizado desde la session JWT.
 * Se usan como strings JSON tal como viven en la BD para que el client-side
 * `hasPermission()` los parsee con la misma lógica defensiva que el server.
 */
export interface AuthPermissions {
    allowedModules: string | null;
    grantedPerms: string | null;
    revokedPerms: string | null;
}

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    permissions: AuthPermissions | null;

    // Actions
    login: (user: User) => void;
    logout: () => void;
    setRole: (role: UserRole) => void; // Para testing de roles
    setPermissions: (p: AuthPermissions | null) => void;

    // Helpers
    canViewCosts: () => boolean;
    hasRole: (roles: UserRole[]) => boolean;
    getRoleLevel: () => number;
}

const ROLE_LEVELS: Record<UserRole, number> = {
    OWNER: 1,
    AUDITOR: 2,
    ADMIN_MANAGER: 3,
    OPS_MANAGER: 4,
    HR_MANAGER: 5,
    CHEF: 6,
    AREA_LEAD: 7,
    CASHIER: 8,
    KITCHEN_CHEF: 9,
    WAITER: 9,
};

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            // Estado inicial - usuario mock para desarrollo
            user: mockCurrentUser,
            isAuthenticated: true, // En desarrollo, siempre autenticado
            isLoading: false,
            permissions: null,

            login: (user) => set({ user, isAuthenticated: true }),

            logout: () => set({ user: null, isAuthenticated: false, permissions: null }),

            setPermissions: (p) => set({ permissions: p }),

            // Permite cambiar rol para probar permisos en UI
            setRole: (role) => {
                const currentUser = get().user;
                if (currentUser) {
                    set({ user: { ...currentUser, role } });
                }
            },

            canViewCosts: () => {
                const user = get().user;
                return user ? canViewCosts(user.role) : false;
            },

            hasRole: (roles) => {
                const user = get().user;
                return user ? roles.includes(user.role) : false;
            },

            getRoleLevel: () => {
                const user = get().user;
                return user ? ROLE_LEVELS[user.role] : 999;
            },
        }),
        {
            name: 'shanklish-auth',
            partialize: (state) => ({ user: state.user, permissions: state.permissions }),
        }
    )
);
