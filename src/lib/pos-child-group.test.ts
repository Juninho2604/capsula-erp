import { describe, it, expect } from 'vitest';
import {
    hasChildGroup,
    purgeChildSelections,
    childGroupsValid,
    childGroupSelectedTotal,
} from './pos-child-group';

const sabores = {
    id: 'cg-sabores',
    name: 'Sabores Pincho Mixto',
    isRequired: true,
    minSelections: 1,
    maxSelections: 4,
    modifiers: [
        { id: 'pollo', name: 'Pincho de Pollo', priceAdjustment: 0, isAvailable: true },
        { id: 'carne', name: 'Pincho de Carne', priceAdjustment: 0, isAvailable: true },
        { id: 'kafta', name: 'Pincho de Kafta', priceAdjustment: 0, isAvailable: true },
    ],
};

const grupoPrincipales = {
    id: 'g-principales',
    modifiers: [
        { id: 'mixto', childGroup: sabores },
        { id: 'falafel', childGroup: null },
    ],
};

const sel = (groupId: string, id: string, quantity = 1) => ({ groupId, id, quantity });

describe('hasChildGroup', () => {
    it('true con grupo activo y con opciones', () => {
        expect(hasChildGroup({ childGroup: sabores })).toBe(true);
    });
    it('false sin childGroup, inactivo o vacío', () => {
        expect(hasChildGroup({ childGroup: null })).toBe(false);
        expect(hasChildGroup({})).toBe(false);
        expect(hasChildGroup({ childGroup: { ...sabores, isActive: false } })).toBe(false);
        expect(hasChildGroup({ childGroup: { ...sabores, modifiers: [] } })).toBe(false);
    });
});

describe('purgeChildSelections', () => {
    it('mantiene hijos mientras el padre está seleccionado', () => {
        const selections = [sel('g-principales', 'mixto'), sel('cg-sabores', 'pollo', 2)];
        expect(purgeChildSelections(selections, grupoPrincipales)).toHaveLength(2);
    });

    it('elimina hijos cuando el padre se deselecciona', () => {
        const selections = [sel('cg-sabores', 'pollo', 2), sel('cg-sabores', 'kafta', 1)];
        const out = purgeChildSelections(selections, grupoPrincipales);
        expect(out).toHaveLength(0);
    });

    it('radio replace: al cambiar a otra opción del grupo, purga los hijos del anterior', () => {
        // El usuario tenía Mixto + sabores y cambió a Falafel (radio maxSelections 1)
        const selections = [sel('g-principales', 'falafel'), sel('cg-sabores', 'carne', 3)];
        const out = purgeChildSelections(selections, grupoPrincipales);
        expect(out).toEqual([sel('g-principales', 'falafel')]);
    });

    it('no toca selecciones de otros grupos', () => {
        const selections = [sel('g-otro', 'x'), sel('cg-sabores', 'pollo')];
        const out = purgeChildSelections(selections, grupoPrincipales);
        expect(out).toEqual([sel('g-otro', 'x')]);
    });
});

describe('childGroupsValid', () => {
    const groups = [grupoPrincipales];

    it('padre no seleccionado → no exige nada', () => {
        expect(childGroupsValid([sel('g-principales', 'falafel')], groups)).toBe(true);
        expect(childGroupsValid([], groups)).toBe(true);
    });

    it('padre seleccionado sin hijos y sub-grupo requerido → inválido', () => {
        expect(childGroupsValid([sel('g-principales', 'mixto')], groups)).toBe(false);
    });

    it('padre seleccionado con hijos suficientes → válido', () => {
        expect(childGroupsValid(
            [sel('g-principales', 'mixto'), sel('cg-sabores', 'pollo', 2)],
            groups,
        )).toBe(true);
    });

    it('minSelections > 1 exige la suma de cantidades', () => {
        const exigente = {
            id: 'g',
            modifiers: [{ id: 'mixto', childGroup: { ...sabores, minSelections: 4 } }],
        };
        const base = [sel('g', 'mixto')];
        expect(childGroupsValid([...base, sel('cg-sabores', 'pollo', 2)], [exigente])).toBe(false);
        expect(childGroupsValid(
            [...base, sel('cg-sabores', 'pollo', 2), sel('cg-sabores', 'kafta', 2)],
            [exigente],
        )).toBe(true);
    });

    it('sub-grupo opcional (min 0, no requerido) nunca bloquea', () => {
        const opcional = {
            id: 'g',
            modifiers: [{ id: 'mixto', childGroup: { ...sabores, isRequired: false, minSelections: 0 } }],
        };
        expect(childGroupsValid([sel('g', 'mixto')], [opcional])).toBe(true);
    });

    it('sub-grupo inactivo o vacío no bloquea aunque sea requerido', () => {
        const inactivo = {
            id: 'g',
            modifiers: [{ id: 'mixto', childGroup: { ...sabores, isActive: false } }],
        };
        expect(childGroupsValid([sel('g', 'mixto')], [inactivo])).toBe(true);
    });
});

describe('childGroupSelectedTotal', () => {
    it('suma cantidades solo del sub-grupo', () => {
        const selections = [
            sel('cg-sabores', 'pollo', 2),
            sel('cg-sabores', 'kafta', 1),
            sel('g-principales', 'mixto', 1),
        ];
        expect(childGroupSelectedTotal(selections, 'cg-sabores')).toBe(3);
        expect(childGroupSelectedTotal([], 'cg-sabores')).toBe(0);
    });
});
