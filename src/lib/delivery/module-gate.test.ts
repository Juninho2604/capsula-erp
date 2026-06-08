import { describe, it, expect } from 'vitest';
import {
    filterModuleIdsByFeatureFlags,
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
