import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, UserRole } from '@/types';
import { hasPermission } from '@/lib/permissions/has-permission';
import { PERM } from '@/lib/constants/permissions-registry';

// mockCurrentUser fue removido del estado inicial: antes se cargaba como
// estado por default lo que causaba que un user nuevo (Delia/Carlos) viera
// "Omar Admin / admin@shanklish.com" en el Navbar por un instante hasta que
// Sidebar.useEffect sincronizaba con su user real del JWT. Sin el mock, el
// Navbar muestra "KPSULA" hasta que se hidrate. mockCurrentUser sigue
// exportado en @/lib/mock-data por si se usa en tests (no en prod).

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
            // Estado inicial vacío. Se hidrata desde la cookie JWT vía
            // Sidebar.useEffect → login(initialUser). Hasta entonces el
            // user es null y los components que lo usan deben manejar el
            // caso (todos lo hacen con optional chaining).
            user: null,
            isAuthenticated: false,
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

            // Granular (Capas 1-4): respeta lo configurado en /dashboard/usuarios
            // (allowedModules + grantedPerms + revokedPerms), no solo el rol.
            // Si `permissions` aún no se hidrató (null), el granular cae al rol
            // base (ROLE_BASE_PERMS), que para VIEW_COSTS == COST_VISIBLE_ROLES →
            // mismo comportamiento histórico, sin regresión. Solo para UX; la
            // seguridad real vive en los Server Actions con checkActionPermission.
            canViewCosts: () => {
                const { user, permissions } = get();
                if (!user) return false;
                return hasPermission(
                    {
                        role: user.role,
                        allowedModules: permissions?.allowedModules ?? null,
                        grantedPerms: permissions?.grantedPerms ?? null,
                        revokedPerms: permissions?.revokedPerms ?? null,
                    },
                    PERM.VIEW_COSTS,
                );
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
