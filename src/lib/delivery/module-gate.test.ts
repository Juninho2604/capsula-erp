import { describe, it, expect } from 'vitest';
import {
    filterModuleIdsByFeatureFlags,
    getVisibleModules,
    MODULE_REGISTRY,
} from '@/lib/constants/modules-registry';

describe('filterModuleIdsByFeatureFlags', () => {
    it('oculta el módulo delivery cuando deliveryOps está OFF', () => {
        const ids = ['dashboard', 'delivery', 'users'];
        expect(filterModuleIdsByFeatureFlags(ids, {})).toEqual(['dashboard', 'users']);
        expect(filterModuleIdsByFeatureFlags(ids, { deliveryOps: false })).toEqual([
            'dashboard',
            'users',
        ]);
    });

    it('muestra el módulo delivery cuando deliveryOps está ON', () => {
        const ids = ['dashboard', 'delivery', 'users'];
        expect(filterModuleIdsByFeatureFlags(ids, { deliveryOps: true })).toEqual(ids);
    });

    it('no toca módulos sin requiresFeatureFlag', () => {
        const ids = ['dashboard', 'inventory', 'users'];
        expect(filterModuleIdsByFeatureFlags(ids, {})).toEqual(ids);
    });

    it('delivery está registrado y gated por deliveryOps', () => {
        const mod = MODULE_REGISTRY.find(m => m.id === 'delivery');
        expect(mod).toBeDefined();
        expect(mod?.requiresFeatureFlag).toBe('deliveryOps');
        expect(mod?.section).toBe('admin');
    });
});

describe('getVisibleModules — módulos OWNER-only', () => {
    const allIds = MODULE_REGISTRY.map(m => m.id);

    it('feature_flags y module_config NO visibles para no-OWNER, ni con allowedModules que los incluyan', () => {
        const cajera = getVisibleModules('CASHIER', allIds, ['feature_flags', 'module_config', 'dashboard']);
        expect(cajera.some(m => m.id === 'feature_flags')).toBe(false);
        expect(cajera.some(m => m.id === 'module_config')).toBe(false);
        expect(cajera.some(m => m.id === 'dashboard')).toBe(true);

        const admin = getVisibleModules('ADMIN_MANAGER', allIds, null);
        expect(admin.some(m => m.id === 'feature_flags')).toBe(false);
    });

    it('OWNER sí los ve', () => {
        const owner = getVisibleModules('OWNER', allIds, null);
        expect(owner.some(m => m.id === 'feature_flags')).toBe(true);
        expect(owner.some(m => m.id === 'module_config')).toBe(true);
    });

    it('allowedModules sigue pudiendo extender módulos operativos (no OWNER-only)', () => {
        // AREA_LEAD no tiene pos_restaurant por rol, pero sí vía allowedModules (§4 Fase 4)
        const lead = getVisibleModules('AREA_LEAD', allIds, ['pos_restaurant']);
        expect(lead.some(m => m.id === 'pos_restaurant')).toBe(true);
    });
});
