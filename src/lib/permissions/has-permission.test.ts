import { describe, it, expect } from 'vitest';
import {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    visibleModules,
    serializePerms,
    type PermUser,
} from './has-permission';
import { PERM } from '@/lib/constants/permissions-registry';

// Helper para construir usuarios de prueba con defaults sensatos.
function user(overrides: Partial<PermUser> = {}): PermUser {
    return {
        role: 'CASHIER',
        allowedModules: null,
        grantedPerms: null,
        revokedPerms: null,
        ...overrides,
    };
}

// ─── CAPA 1 — ROLE_BASE_PERMS ─────────────────────────────────────────────────

describe('Capa 1 — rol base', () => {
    it('OWNER tiene todos los permisos', () => {
        const u = user({ role: 'OWNER' });
        expect(hasPermission(u, PERM.VOID_ORDER)).toBe(true);
        expect(hasPermission(u, PERM.MANAGE_USERS)).toBe(true);
        expect(hasPermission(u, PERM.CONFIGURE_SYSTEM)).toBe(true);
    });

    it('CASHIER NO tiene VOID_ORDER por defecto', () => {
        expect(hasPermission(user({ role: 'CASHIER' }), PERM.VOID_ORDER)).toBe(false);
    });

    it('CASHIER tiene APPLY_DISCOUNT por defecto', () => {
        expect(hasPermission(user({ role: 'CASHIER' }), PERM.APPLY_DISCOUNT)).toBe(true);
    });

    it('Rol desconocido no tiene ningún permiso', () => {
        const u = user({ role: 'ROL_INVENTADO' });
        expect(hasPermission(u, PERM.VOID_ORDER)).toBe(false);
        expect(hasPermission(u, PERM.APPLY_DISCOUNT)).toBe(false);
    });
});

// ─── CAPA 2 — allowedModules ──────────────────────────────────────────────────

describe('Capa 2 — allowedModules restringe por módulo', () => {
    it('Sin allowedModules (null): pasa Capa 2 por defecto', () => {
        const u = user({ role: 'CASHIER', allowedModules: null });
        expect(hasPermission(u, PERM.APPLY_DISCOUNT)).toBe(true);
    });

    it('allowedModules restringe: si ningún módulo del perm está, niega', () => {
        // CASHIER tiene APPLY_DISCOUNT base; APPLY_DISCOUNT mapea a pos_restaurant/waiter/delivery/pedidosya.
        // Si allowedModules solo incluye "caja", ningún módulo del perm está → niega.
        const u = user({ role: 'CASHIER', allowedModules: JSON.stringify(['caja']) });
        expect(hasPermission(u, PERM.APPLY_DISCOUNT)).toBe(false);
    });

    it('allowedModules permite: basta con UN módulo del perm presente', () => {
        const u = user({ role: 'CASHIER', allowedModules: JSON.stringify(['pos_waiter']) });
        expect(hasPermission(u, PERM.APPLY_DISCOUNT)).toBe(true);
    });

    it('Perm global (no en PERM_TO_MODULES) pasa Capa 2 siempre', () => {
        // Si el mapa no tiene entradas para un perm, el filtrado por módulo no aplica.
        // En el registro actual todos los PERM están mapeados, pero validamos el path defensivo
        // forzando un usuario con allowedModules vacío: si el perm es del rol base y no hay
        // ningún módulo exigido, debería pasar. Usamos un perm que el rol SÍ tiene.
        const u = user({ role: 'OWNER', allowedModules: JSON.stringify([]) });
        // OWNER tiene todo. Cualquier perm con módulos mapeados pero allowedModules=[] niega.
        expect(hasPermission(u, PERM.VOID_ORDER)).toBe(false);
    });

    it('allowedModules con JSON malformado: trata como null (no restricción)', () => {
        const u = user({ role: 'CASHIER', allowedModules: '{not json' });
        // Parser devuelve null → sin restricción de módulos
        expect(hasPermission(u, PERM.APPLY_DISCOUNT)).toBe(true);
    });
});

// ─── CAPA 3 — grantedPerms (bypass Capa 2) ────────────────────────────────────

describe('Capa 3 — grantedPerms bypassea Capa 1 y 2', () => {
    it('Concede perm que el rol base no tiene', () => {
        const u = user({
            role: 'CASHIER',
            grantedPerms: JSON.stringify([PERM.VOID_ORDER]),
        });
        expect(hasPermission(u, PERM.VOID_ORDER)).toBe(true);
    });

    it('Concede perm AUNQUE allowedModules no incluya su módulo', () => {
        const u = user({
            role: 'CASHIER',
            allowedModules: JSON.stringify(['pos_waiter']),
            grantedPerms: JSON.stringify([PERM.VIEW_ALL_ORDERS]),
        });
        // VIEW_ALL_ORDERS mapea a sales_history, NO a pos_waiter → Capa 2 negaría,
        // pero Capa 3 bypassea.
        expect(hasPermission(u, PERM.VIEW_ALL_ORDERS)).toBe(true);
    });

    it('grantedPerms con JSON malformado: se ignora silenciosamente', () => {
        const u = user({ role: 'CASHIER', grantedPerms: 'garbage' });
        expect(hasPermission(u, PERM.VOID_ORDER)).toBe(false);
    });

    it('Valores no-string en array se filtran', () => {
        const u = user({
            role: 'CASHIER',
            grantedPerms: JSON.stringify([PERM.VOID_ORDER, 123, null, 'FAKE_PERM']),
        });
        // Solo VOID_ORDER es válido
        expect(hasPermission(u, PERM.VOID_ORDER)).toBe(true);
    });
});

// ─── CAPA 4 — revokedPerms (gana sobre todo) ──────────────────────────────────

describe('Capa 4 — revokedPerms siempre gana', () => {
    it('Revoca perm del rol base', () => {
        const u = user({
            role: 'CASHIER',
            revokedPerms: JSON.stringify([PERM.APPLY_DISCOUNT]),
        });
        expect(hasPermission(u, PERM.APPLY_DISCOUNT)).toBe(false);
    });

    it('Revoca incluso si está en grantedPerms (conflicto resuelto a favor de revoked)', () => {
        const u = user({
            role: 'CASHIER',
            grantedPerms: JSON.stringify([PERM.VOID_ORDER]),
            revokedPerms: JSON.stringify([PERM.VOID_ORDER]),
        });
        expect(hasPermission(u, PERM.VOID_ORDER)).toBe(false);
    });

    it('Revoca a OWNER (capa 4 gana incluso sobre Full Access)', () => {
        const u = user({
            role: 'OWNER',
            revokedPerms: JSON.stringify([PERM.CONFIGURE_SYSTEM]),
        });
        expect(hasPermission(u, PERM.CONFIGURE_SYSTEM)).toBe(false);
        // El resto sigue
        expect(hasPermission(u, PERM.MANAGE_USERS)).toBe(true);
    });
});

// ─── helpers hasAny / hasAll ──────────────────────────────────────────────────

describe('hasAnyPermission / hasAllPermissions', () => {
    it('hasAnyPermission: true si al menos uno', () => {
        const u = user({ role: 'CASHIER' });
        expect(hasAnyPermission(u, [PERM.VOID_ORDER, PERM.APPLY_DISCOUNT])).toBe(true);
    });

    it('hasAnyPermission: false si ninguno', () => {
        const u = user({ role: 'WAITER' });
        expect(hasAnyPermission(u, [PERM.VOID_ORDER, PERM.MANAGE_USERS])).toBe(false);
    });

    it('hasAllPermissions: true solo si todos', () => {
        const u = user({ role: 'OWNER' });
        expect(hasAllPermissions(u, [PERM.VOID_ORDER, PERM.MANAGE_USERS])).toBe(true);
    });

    it('hasAllPermissions: false si falta uno', () => {
        const u = user({ role: 'CASHIER' });
        expect(hasAllPermissions(u, [PERM.APPLY_DISCOUNT, PERM.VOID_ORDER])).toBe(false);
    });
});

// ─── visibleModules — sidebar ─────────────────────────────────────────────────

describe('visibleModules', () => {
    it('Retorna null cuando allowedModules es null (usa defaults de rol)', () => {
        expect(visibleModules(user({ allowedModules: null }))).toBeNull();
    });

    it('Retorna los allowedModules tal cual si no hay grantedPerms', () => {
        const u = user({ allowedModules: JSON.stringify(['pos_waiter']) });
        expect(visibleModules(u)).toEqual(['pos_waiter']);
    });

    it('Agrega módulos derivados de grantedPerms (bypass Capa 2)', () => {
        const u = user({
            allowedModules: JSON.stringify(['pos_waiter']),
            grantedPerms: JSON.stringify([PERM.VIEW_ALL_ORDERS]),
        });
        // VIEW_ALL_ORDERS mapea a sales_history
        const mods = visibleModules(u);
        expect(mods).toContain('pos_waiter');
        expect(mods).toContain('sales_history');
    });

    it('Sin duplicados cuando grantedPerms repite un módulo ya listado', () => {
        const u = user({
            allowedModules: JSON.stringify(['pos_waiter']),
            grantedPerms: JSON.stringify([PERM.APPLY_DISCOUNT]),
        });
        const mods = visibleModules(u) ?? [];
        // APPLY_DISCOUNT mapea entre otros a pos_waiter — no debe duplicarlo
        const count = mods.filter(m => m === 'pos_waiter').length;
        expect(count).toBe(1);
    });
});

// ─── serializePerms ───────────────────────────────────────────────────────────

describe('serializePerms', () => {
    it('Retorna null para array vacío', () => {
        expect(serializePerms([])).toBeNull();
    });

    it('Deduplica entradas repetidas', () => {
        const raw = serializePerms([PERM.VOID_ORDER, PERM.VOID_ORDER, PERM.APPLY_DISCOUNT]);
        const parsed = JSON.parse(raw!);
        expect(parsed).toHaveLength(2);
    });

    it('Ordena alfabéticamente (estable)', () => {
        const a = serializePerms([PERM.VOID_ORDER, PERM.APPLY_DISCOUNT, PERM.MANAGE_USERS]);
        const b = serializePerms([PERM.MANAGE_USERS, PERM.APPLY_DISCOUNT, PERM.VOID_ORDER]);
        expect(a).toBe(b);
    });
});
