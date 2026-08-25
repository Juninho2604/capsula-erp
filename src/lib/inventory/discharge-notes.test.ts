import { describe, it, expect } from 'vitest';
import { summarizeDischargeNotes, normalizeNote } from './discharge-notes';

describe('normalizeNote', () => {
    it('agrupa la misma combinación escrita distinto', () => {
        expect(normalizeNote('Kibe + Pollo')).toBe(normalizeNote('kibe  +  pollo'));
        expect(normalizeNote('  Carne  ')).toBe('carne');
    });

    it('ignora acentos', () => {
        expect(normalizeNote('Champiñón')).toBe(normalizeNote('champinon'));
    });

    it('nota vacía o ausente da cadena vacía', () => {
        expect(normalizeNote(null)).toBe('');
        expect(normalizeNote(undefined)).toBe('');
        expect(normalizeNote('   ')).toBe('');
    });
});

describe('summarizeDischargeNotes (§156.1)', () => {
    it('suma unidades por combinación, la más despachada primero', () => {
        const r = summarizeDischargeNotes([
            { note: 'kibe + pollo', quantity: 2 },
            { note: 'carne', quantity: 1 },
            { note: 'Kibe + Pollo', quantity: 3 },
        ]);
        expect(r.groups[0]).toEqual({ note: 'kibe + pollo', units: 5, lines: 2 });
        expect(r.groups[1]).toEqual({ note: 'carne', units: 1, lines: 1 });
        expect(r.totalUnits).toBe(6);
    });

    it('muestra la redacción del mesonero, no la normalizada', () => {
        const r = summarizeDischargeNotes([
            { note: 'Kibe + Pollo', quantity: 1 },
            { note: 'kibe + pollo', quantity: 1 },
        ]);
        expect(r.groups[0].note).toBe('Kibe + Pollo');
        expect(r.groups[0].units).toBe(2);
    });

    it('cuenta aparte lo despachado SIN nota', () => {
        // Ese número es la señal de que los mesoneros dejaron de anotar y el
        // descargo se vuelve adivinanza.
        const r = summarizeDischargeNotes([
            { note: 'kibe', quantity: 2 },
            { note: null, quantity: 3 },
            { note: '   ', quantity: 1 },
        ]);
        expect(r.withoutNote).toBe(4);
        expect(r.totalUnits).toBe(6);
        expect(r.groups).toHaveLength(1);
    });

    it('sin ventas devuelve todo en cero', () => {
        const r = summarizeDischargeNotes([]);
        expect(r).toEqual({ groups: [], withoutNote: 0, totalUnits: 0 });
    });

    it('cantidades inválidas o no positivas se ignoran', () => {
        const r = summarizeDischargeNotes([
            { note: 'kibe', quantity: NaN },
            { note: 'kibe', quantity: 0 },
            { note: 'kibe', quantity: -2 },
            { note: 'kibe', quantity: 4 },
        ]);
        expect(r.totalUnits).toBe(4);
        expect(r.groups[0].units).toBe(4);
        expect(r.groups[0].lines).toBe(1);
    });

    it('empate de unidades se desempata alfabéticamente — orden estable', () => {
        const r = summarizeDischargeNotes([
            { note: 'zanahoria', quantity: 2 },
            { note: 'aguacate', quantity: 2 },
        ]);
        expect(r.groups.map(g => g.note)).toEqual(['aguacate', 'zanahoria']);
    });
});
