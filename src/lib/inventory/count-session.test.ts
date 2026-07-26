import { describe, it, expect } from 'vitest';
import {
    computeVariances,
    flagForReview,
    progressByArea,
    buildSessionCode,
    canTransition,
    transitionError,
    entryKey,
    round4,
} from './count-session';

describe('count-session — varianzas', () => {
    it('calcula contado − sistema por (item, área)', () => {
        const rows = computeVariances(
            [{ inventoryItemId: 'i1', areaId: 'a1', qtyCounted: 8 }],
            [{ inventoryItemId: 'i1', areaId: 'a1', currentStock: 10 }],
        );
        expect(rows[0].variance).toBe(-2);
        expect(rows[0].system).toBe(10);
        expect(rows[0].counted).toBe(8);
        expect(rows[0].variancePct).toBe(-20);
    });

    it('el mismo item en dos almacenes no se mezcla', () => {
        const rows = computeVariances(
            [
                { inventoryItemId: 'i1', areaId: 'a1', qtyCounted: 5 },
                { inventoryItemId: 'i1', areaId: 'a2', qtyCounted: 3 },
            ],
            [
                { inventoryItemId: 'i1', areaId: 'a1', currentStock: 5 },
                { inventoryItemId: 'i1', areaId: 'a2', currentStock: 9 },
            ],
        );
        expect(rows.find(r => r.areaId === 'a1')!.variance).toBe(0);
        expect(rows.find(r => r.areaId === 'a2')!.variance).toBe(-6);
    });

    it('item sin ubicación previa cuenta como sistema 0 (alta legítima)', () => {
        const rows = computeVariances(
            [{ inventoryItemId: 'nuevo', areaId: 'a1', qtyCounted: 4 }],
            [],
        );
        expect(rows[0].system).toBe(0);
        expect(rows[0].variance).toBe(4);
        expect(rows[0].variancePct).toBeNull();
    });

    it('no genera varianzas fantasma por coma flotante', () => {
        const rows = computeVariances(
            [{ inventoryItemId: 'i1', areaId: 'a1', qtyCounted: 0.1 + 0.2 }],
            [{ inventoryItemId: 'i1', areaId: 'a1', currentStock: 0.3 }],
        );
        expect(rows[0].variance).toBe(0);
    });
});

describe('count-session — diferencias a revisar', () => {
    const base = { inventoryItemId: 'i', areaId: 'a', counted: 0, system: 0 };

    it('marca por diferencia absoluta', () => {
        const flagged = flagForReview([
            { ...base, counted: 100, system: 94, variance: 6, variancePct: 6.38 },
        ]);
        expect(flagged).toHaveLength(1);
    });

    it('marca por porcentaje aunque la diferencia absoluta sea chica', () => {
        const flagged = flagForReview([
            { ...base, counted: 1, system: 2, variance: -1, variancePct: -50 },
        ]);
        expect(flagged).toHaveLength(1);
    });

    it('no marca diferencias chicas en ambos criterios', () => {
        const flagged = flagForReview([
            { ...base, counted: 99, system: 100, variance: -1, variancePct: -1 },
        ]);
        expect(flagged).toHaveLength(0);
    });

    it('ignora varianza cero', () => {
        expect(
            flagForReview([{ ...base, counted: 10, system: 10, variance: 0, variancePct: 0 }]),
        ).toHaveLength(0);
    });

    it('ordena por magnitud: lo más grave primero', () => {
        const flagged = flagForReview([
            { ...base, inventoryItemId: 'chico', variance: -6, variancePct: -6, counted: 94, system: 100 },
            { ...base, inventoryItemId: 'grande', variance: -80, variancePct: -80, counted: 20, system: 100 },
        ]);
        expect(flagged[0].inventoryItemId).toBe('grande');
    });

    it('respeta umbrales personalizados', () => {
        const row = { ...base, counted: 97, system: 100, variance: -3, variancePct: -3 };
        expect(flagForReview([row])).toHaveLength(0);
        expect(flagForReview([row], { absThreshold: 2 })).toHaveLength(1);
    });
});

describe('count-session — avance por almacén', () => {
    it('cuenta items distintos por área, sin duplicar', () => {
        const p = progressByArea(
            [
                { inventoryItemId: 'i1', areaId: 'a1', qtyCounted: 1 },
                { inventoryItemId: 'i2', areaId: 'a1', qtyCounted: 1 },
                { inventoryItemId: 'i1', areaId: 'a2', qtyCounted: 1 },
            ],
            ['a1', 'a2', 'a3'],
            4,
        );
        expect(p.find(x => x.areaId === 'a1')).toMatchObject({ counted: 2, total: 4, pct: 50 });
        expect(p.find(x => x.areaId === 'a2')).toMatchObject({ counted: 1, pct: 25 });
        expect(p.find(x => x.areaId === 'a3')).toMatchObject({ counted: 0, pct: 0 });
    });

    it('no divide por cero con catálogo vacío', () => {
        expect(progressByArea([], ['a1'], 0)[0].pct).toBe(0);
    });
});

describe('count-session — correlativo', () => {
    it('arma CNT-año-mes-secuencia', () => {
        expect(buildSessionCode(new Date(Date.UTC(2026, 6, 26)), 0)).toBe('CNT-2026-07-001');
        expect(buildSessionCode(new Date(Date.UTC(2026, 6, 26)), 11)).toBe('CNT-2026-07-012');
    });
});

describe('count-session — transiciones de estado', () => {
    it('permite el camino normal', () => {
        expect(canTransition('OPEN', 'REVIEW')).toBe(true);
        expect(canTransition('REVIEW', 'APPLIED')).toBe(true);
    });

    it('permite volver de revisión a contar', () => {
        expect(canTransition('REVIEW', 'OPEN')).toBe(true);
    });

    it('NO permite aplicar dos veces (evita duplicar ajustes de stock)', () => {
        expect(canTransition('APPLIED', 'APPLIED')).toBe(false);
        expect(canTransition('APPLIED', 'OPEN')).toBe(false);
        expect(transitionError('APPLIED', 'OPEN')).toContain('ya fue aplicada');
    });

    it('NO permite aplicar directo sin pasar por revisión', () => {
        expect(canTransition('OPEN', 'APPLIED')).toBe(false);
    });

    it('una sesión cancelada queda cerrada', () => {
        expect(canTransition('CANCELLED', 'OPEN')).toBe(false);
        expect(transitionError('CANCELLED', 'OPEN')).toContain('cancelada');
    });
});

describe('count-session — utilidades', () => {
    it('entryKey distingue item y área', () => {
        expect(entryKey('i1', 'a1')).not.toBe(entryKey('i1', 'a2'));
    });

    it('round4 recorta el ruido de coma flotante', () => {
        expect(round4(0.1 + 0.2)).toBe(0.3);
    });
});
