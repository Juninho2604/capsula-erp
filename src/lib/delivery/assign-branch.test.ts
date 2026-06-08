import { describe, it, expect } from 'vitest';
import { assignBranch, haversineKm, type BranchCandidate } from './assign-branch';

const hatillo: BranchCandidate = {
    id: 'b-hatillo',
    name: 'El Hatillo',
    lat: 10.42,
    lon: -66.82,
    zones: ['El Hatillo', 'La Lagunita'],
    isActive: true,
};
const losPalos: BranchCandidate = {
    id: 'b-lpg',
    name: 'Los Palos Grandes',
    lat: 10.5,
    lon: -66.84,
    zones: ['Los Palos Grandes', 'Altamira'],
    isActive: true,
};
const branches = [hatillo, losPalos];

describe('haversineKm', () => {
    it('da ~0 para el mismo punto', () => {
        expect(haversineKm(10.42, -66.82, 10.42, -66.82)).toBeCloseTo(0, 5);
    });
    it('crece con la distancia', () => {
        const d = haversineKm(10.42, -66.82, 10.5, -66.84);
        expect(d).toBeGreaterThan(0);
        expect(d).toBeLessThan(50);
    });
});

describe('assignBranch — precedencia', () => {
    it('1. regla de ruteo gana sobre todo', () => {
        const r = assignBranch({
            itemNames: ['Sushi especial', 'Coca-Cola'],
            address: 'Los Palos Grandes, calle 3',
            lat: 10.5,
            lon: -66.84,
            branches,
            routingRules: [
                { matchProduct: 'sushi especial', branchId: 'b-hatillo', priority: 10, isActive: true },
            ],
        });
        expect(r).toEqual({ branchId: 'b-hatillo', reason: 'routing_rule' });
    });

    it('respeta prioridad entre reglas', () => {
        const r = assignBranch({
            itemNames: ['Poke clásico'],
            branches,
            routingRules: [
                { matchProduct: 'poke', branchId: 'b-hatillo', priority: 1, isActive: true },
                { matchProduct: 'poke', branchId: 'b-lpg', priority: 9, isActive: true },
            ],
        });
        expect(r.branchId).toBe('b-lpg');
    });

    it('ignora reglas inactivas', () => {
        const r = assignBranch({
            itemNames: ['Sushi'],
            lat: 10.5,
            lon: -66.84,
            branches,
            routingRules: [
                { matchProduct: 'sushi', branchId: 'b-hatillo', priority: 10, isActive: false },
            ],
        });
        expect(r.reason).toBe('gps'); // cae a GPS
    });

    it('2. GPS: sede más cercana cuando no hay regla', () => {
        const r = assignBranch({
            itemNames: ['Poke'],
            lat: 10.43,
            lon: -66.82,
            branches,
        });
        expect(r).toEqual({ branchId: 'b-hatillo', reason: 'gps' });
    });

    it('3. zona por texto cuando no hay GPS', () => {
        const r = assignBranch({
            itemNames: ['Poke'],
            address: 'Av principal de La Lagunita, qta X',
            branches,
        });
        expect(r).toEqual({ branchId: 'b-hatillo', reason: 'zone' });
    });

    it('zona es case/acento-insensible', () => {
        const r = assignBranch({
            itemNames: [],
            address: 'ALTAMIRA norte',
            branches,
        });
        expect(r.branchId).toBe('b-lpg');
        expect(r.reason).toBe('zone');
    });

    it('4. fallback cuando nada matchea', () => {
        const r = assignBranch({
            itemNames: ['Poke'],
            address: 'zona desconocida',
            branches,
            fallbackBranchId: 'b-hatillo',
        });
        expect(r).toEqual({ branchId: 'b-hatillo', reason: 'fallback' });
    });

    it('none cuando no hay match ni fallback', () => {
        const r = assignBranch({ itemNames: [], branches });
        expect(r).toEqual({ branchId: null, reason: 'none' });
    });

    it('ignora sedes inactivas en GPS', () => {
        const r = assignBranch({
            itemNames: [],
            lat: 10.42,
            lon: -66.82,
            branches: [{ ...hatillo, isActive: false }, losPalos],
        });
        expect(r.branchId).toBe('b-lpg');
    });
});
