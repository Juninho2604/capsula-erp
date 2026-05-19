import { describe, it, expect } from 'vitest';
import {
    parseModifier,
    groupModifiersForSinCon,
    toggleStateFor,
    type MinimalModifier,
} from './pos-modifier-grouping';

function mod(id: string, name: string, priceAdjustment = 0, isAvailable = true): MinimalModifier {
    return { id, name, priceAdjustment, isAvailable };
}

describe('parseModifier', () => {
    it('detecta "Sin X"', () => {
        expect(parseModifier(mod('a', 'Sin Cebolla'))).toEqual({
            original: expect.any(Object),
            ingredient: 'Cebolla',
            action: 'SIN',
        });
    });

    it('detecta "Con X"', () => {
        expect(parseModifier(mod('a', 'Con Tabulé'))).toEqual({
            original: expect.any(Object),
            ingredient: 'Tabulé',
            action: 'CON',
        });
    });

    it('detecta "+ X" y "+X"', () => {
        expect(parseModifier(mod('a', '+ Hummus')).action).toBe('CON');
        expect(parseModifier(mod('a', '+Falafel')).action).toBe('CON');
        expect(parseModifier(mod('a', '+ Hummus')).ingredient).toBe('Hummus');
    });

    it('case-insensitive en el prefijo', () => {
        expect(parseModifier(mod('a', 'sin cebolla')).action).toBe('SIN');
        expect(parseModifier(mod('a', 'SIN CEBOLLA')).action).toBe('SIN');
        expect(parseModifier(mod('a', 'con tabule')).action).toBe('CON');
    });

    it('preserva mayúsculas/acentos del ingrediente', () => {
        expect(parseModifier(mod('a', 'Sin Cebolla')).ingredient).toBe('Cebolla');
        expect(parseModifier(mod('a', 'Con Tabulé')).ingredient).toBe('Tabulé');
    });

    it('no matchea palabras que empiezan con sin/con sin espacio', () => {
        expect(parseModifier(mod('a', 'Continental')).action).toBe('NONE');
        expect(parseModifier(mod('a', 'Single')).action).toBe('NONE');
    });

    it('no matchea modifiers genéricos', () => {
        expect(parseModifier(mod('a', 'Extra Salsa')).action).toBe('NONE');
        expect(parseModifier(mod('a', 'Extra Proteína 250gr')).action).toBe('NONE');
        expect(parseModifier(mod('a', 'Picante')).action).toBe('NONE');
    });
});

describe('groupModifiersForSinCon', () => {
    it('agrupa Sin y Con del mismo ingrediente en un toggle', () => {
        const result = groupModifiersForSinCon([
            mod('sin-tab', 'Sin Tabulé'),
            mod('con-tab', 'Con Tabulé'),
        ]);
        expect(result.toggles).toHaveLength(1);
        expect(result.toggles[0].label).toBe('Tabulé');
        expect(result.toggles[0].sin?.id).toBe('sin-tab');
        expect(result.toggles[0].con?.id).toBe('con-tab');
        expect(result.passThrough).toHaveLength(0);
    });

    it('un solo Sin → toggle con sólo Sin', () => {
        const result = groupModifiersForSinCon([mod('sin-ceb', 'Sin Cebolla')]);
        expect(result.toggles).toHaveLength(1);
        expect(result.toggles[0].sin?.id).toBe('sin-ceb');
        expect(result.toggles[0].con).toBeUndefined();
    });

    it('un solo "+ X" → toggle con sólo Con', () => {
        const result = groupModifiersForSinCon([mod('add-hum', '+ Hummus', 1.5)]);
        expect(result.toggles).toHaveLength(1);
        expect(result.toggles[0].con?.id).toBe('add-hum');
        expect(result.toggles[0].con?.priceAdjustment).toBe(1.5);
        expect(result.toggles[0].sin).toBeUndefined();
    });

    it('caseless: "Sin Tabulé" y "Con tabule" se unen al mismo toggle', () => {
        const result = groupModifiersForSinCon([
            mod('sin-tab', 'Sin Tabulé'),
            mod('con-tab', 'Con tabule'),
        ]);
        expect(result.toggles).toHaveLength(1);
        expect(result.toggles[0].sin?.id).toBe('sin-tab');
        expect(result.toggles[0].con?.id).toBe('con-tab');
    });

    it('modifiers que no encajan van al passThrough', () => {
        const result = groupModifiersForSinCon([
            mod('extra-salsa', 'Extra Salsa'),
            mod('extra-prot', 'Extra Proteína 250gr', 1.0),
            mod('sin-ceb', 'Sin Cebolla'),
        ]);
        expect(result.toggles).toHaveLength(1);
        expect(result.toggles[0].sin?.id).toBe('sin-ceb');
        expect(result.passThrough.map((m) => m.id)).toEqual(['extra-salsa', 'extra-prot']);
    });

    it('omite modifiers con isAvailable=false', () => {
        const result = groupModifiersForSinCon([
            mod('sin-ceb', 'Sin Cebolla', 0, true),
            mod('con-ceb', 'Con Cebolla', 0.5, false),
        ]);
        expect(result.toggles).toHaveLength(1);
        expect(result.toggles[0].sin?.id).toBe('sin-ceb');
        expect(result.toggles[0].con).toBeUndefined();
    });

    it('lista típica de shawarma: agrupa correctamente', () => {
        const result = groupModifiersForSinCon([
            mod('m1', '+ Kibbe Crudo'),
            mod('m2', '+ Falafel'),
            mod('m3', '+ Hummus'),
            mod('m4', 'Sin Cebolla'),
            mod('m5', 'Sin Vegetales'),
            mod('m6', 'Sin Tabulé'),
            mod('m7', 'Con Tabulé'),
            mod('m8', 'Con Vegetales Salteados'),
            mod('m9', 'Extra Salsa'),
            mod('m10', 'Extra Proteína 250gr', 1.0),
        ]);
        // 7 toggles esperados:
        //   Kibbe Crudo (con)
        //   Falafel (con)
        //   Hummus (con)
        //   Cebolla (sin)
        //   Vegetales (sin) + Vegetales Salteados (con) → ojo, son distintos textos
        //   Tabulé (sin+con)
        // Como "Vegetales" y "Vegetales Salteados" tienen keys distintas, son
        // 2 toggles separados. Sumando: Kibbe Crudo, Falafel, Hummus,
        // Cebolla, Vegetales, Tabulé, Vegetales Salteados = 7
        expect(result.toggles.length).toBe(7);
        // 2 pass-through (Extra Salsa, Extra Proteína 250gr)
        expect(result.passThrough.length).toBe(2);
        // Tabulé tiene ambos
        const tabule = result.toggles.find((t) => t.label === 'Tabulé');
        expect(tabule?.sin).toBeDefined();
        expect(tabule?.con).toBeDefined();
        // Cebolla solo sin
        const cebolla = result.toggles.find((t) => t.label === 'Cebolla');
        expect(cebolla?.sin).toBeDefined();
        expect(cebolla?.con).toBeUndefined();
    });

    it('preserva orden de aparición del primer modifier por ingrediente', () => {
        const result = groupModifiersForSinCon([
            mod('z', '+ Zanahoria'),
            mod('a', '+ Aceitunas'),
            mod('z2', 'Sin Zanahoria'),
        ]);
        expect(result.toggles.map((t) => t.label)).toEqual(['Zanahoria', 'Aceitunas']);
    });
});

describe('toggleStateFor', () => {
    it('devuelve SIN si está seleccionado el modifier sin', () => {
        const result = groupModifiersForSinCon([
            mod('sin-tab', 'Sin Tabulé'),
            mod('con-tab', 'Con Tabulé'),
        ]);
        const toggle = result.toggles[0];
        expect(toggleStateFor(toggle, new Set(['sin-tab']))).toBe('SIN');
    });

    it('devuelve CON si está seleccionado el modifier con', () => {
        const result = groupModifiersForSinCon([
            mod('sin-tab', 'Sin Tabulé'),
            mod('con-tab', 'Con Tabulé'),
        ]);
        const toggle = result.toggles[0];
        expect(toggleStateFor(toggle, new Set(['con-tab']))).toBe('CON');
    });

    it('NEUTRAL si nada seleccionado', () => {
        const result = groupModifiersForSinCon([
            mod('sin-tab', 'Sin Tabulé'),
            mod('con-tab', 'Con Tabulé'),
        ]);
        const toggle = result.toggles[0];
        expect(toggleStateFor(toggle, new Set())).toBe('NEUTRAL');
        expect(toggleStateFor(toggle, new Set(['otro-id']))).toBe('NEUTRAL');
    });

    it('SIN tiene prioridad si ambos seleccionados (defensivo)', () => {
        const result = groupModifiersForSinCon([
            mod('sin-tab', 'Sin Tabulé'),
            mod('con-tab', 'Con Tabulé'),
        ]);
        const toggle = result.toggles[0];
        expect(toggleStateFor(toggle, new Set(['sin-tab', 'con-tab']))).toBe('SIN');
    });
});
