import { describe, it, expect } from 'vitest';
import { fiscalWeekOf, fiscalWeekLabel } from './fiscal-week';

// Fechas en mediodía UTC para que, con el offset Caracas (-4h), el día-calendario
// coincida con el día UTC y los casos sean inequívocos.
const at = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 16, 0, 0));

describe('fiscalWeekOf', () => {
    it('clasifica S4 vs S5 en el borde abril/mayo 2026 (caso real del Excel)', () => {
        // Semana Abr 20-26 (jueves Abr 23) → S4 ABRIL
        expect(fiscalWeekLabel(at(2026, 4, 20))).toBe('S4 ABRIL');
        expect(fiscalWeekLabel(at(2026, 4, 26))).toBe('S4 ABRIL');
        // Semana Abr 27-May 3 (jueves Abr 30) → S5 ABRIL (la 5ª semana real)
        expect(fiscalWeekLabel(at(2026, 4, 27))).toBe('S5 ABRIL');
        expect(fiscalWeekLabel(at(2026, 5, 3))).toBe('S5 ABRIL');
        // Semana siguiente May 4-10 (jueves May 7) → S1 MAYO
        expect(fiscalWeekLabel(at(2026, 5, 4))).toBe('S1 MAYO');
    });

    it('el domingo pertenece a la semana de su jueves, no al mes del domingo', () => {
        // Domingo May 3 2026 cae en la semana cuyo jueves (Abr 30) es de abril.
        const fw = fiscalWeekOf(at(2026, 5, 3));
        expect(fw.month).toBe(4);
        expect(fw.week).toBe(5);
    });

    it('numera S1 al inicio de mes', () => {
        // Mar 30-Abr 5 (jueves Abr 2) → S1 ABRIL
        expect(fiscalWeekLabel(at(2026, 3, 30))).toBe('S1 ABRIL');
        expect(fiscalWeekLabel(at(2026, 4, 1))).toBe('S1 ABRIL');
    });

    it('devuelve año/mes/semana estructurados', () => {
        const fw = fiscalWeekOf(at(2026, 6, 1));
        expect(fw).toEqual({ year: 2026, month: 6, week: 1, label: 'S1 JUNIO' });
    });

    it('respeta la zona Caracas: 02:00 UTC sigue siendo el día anterior local', () => {
        // 2026-05-04 02:00 UTC = 2026-05-03 22:00 Caracas → aún domingo S5 ABRIL.
        expect(fiscalWeekLabel(new Date(Date.UTC(2026, 4, 4, 2, 0, 0)))).toBe('S5 ABRIL');
    });
});
