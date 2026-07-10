import { describe, it, expect } from 'vitest';
import { filterKitchenModifiers, isParentWithChildren } from './kitchen-modifiers';

// Ración "Pincho Mixto" (despliega cg-varas) + 2 varas elegidas del sub-grupo.
const padre = { name: 'Pincho Mixto', modifier: { groupId: 'g-principales', childGroupId: 'cg-varas' } };
const varaPollo = { name: 'Pincho de Pollo', modifier: { groupId: 'cg-varas', childGroupId: null } };
const varaMixta = { name: 'Pincho Mixto', modifier: { groupId: 'cg-varas', childGroupId: null } };
const kibbe = { name: 'Kibbe Frito', modifier: { groupId: 'g-principales', childGroupId: null } };

describe('filterKitchenModifiers (§93 — comanda sin el título del padre)', () => {
    it('oculta el padre cuando hay varas del sub-grupo en el mismo item', () => {
        const out = filterKitchenModifiers([padre, varaPollo, varaMixta, kibbe]);
        expect(out.map(m => m.name)).toEqual(['Pincho de Pollo', 'Pincho Mixto', 'Kibbe Frito']);
    });

    it('la VARA mixta (mismo nombre que el padre) NO se oculta — se filtra por relación, no por nombre', () => {
        const out = filterKitchenModifiers([padre, varaMixta]);
        expect(out).toEqual([varaMixta]);
    });

    it('padre SIN hijos seleccionados se muestra (no perder información)', () => {
        const out = filterKitchenModifiers([padre, kibbe]);
        expect(out).toEqual([padre, kibbe]);
    });

    it('modificadores legacy sin relación viva (modifier null) nunca se ocultan', () => {
        const legacy = { name: 'Extra Ajo', modifier: null };
        expect(filterKitchenModifiers([legacy, padre, varaPollo]).map(m => m.name))
            .toEqual(['Extra Ajo', 'Pincho de Pollo']);
    });

    it('isParentWithChildren no se marca a sí mismo como hermano', () => {
        expect(isParentWithChildren(padre, [padre])).toBe(false);
    });
});
