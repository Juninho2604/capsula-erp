import { describe, it, expect } from 'vitest';
import { classifyStation, isDualStationDessert, stationsForItem } from './station-routing';

describe('classifyStation — barra vs cocina', () => {
    it('Bebidas y afines → barra', () => {
        expect(classifyStation('Bebidas')).toBe('bar');
        expect(classifyStation('Licores premium')).toBe('bar');
        expect(classifyStation('Cocteles de la casa')).toBe('bar');
        expect(classifyStation('Café')).toBe('bar');
        expect(classifyStation('Cervezas artesanales')).toBe('bar');
    });
    it('comida y sin categoría → cocina', () => {
        expect(classifyStation('Shawarmas')).toBe('kitchen');
        expect(classifyStation('Platos Principales')).toBe('kitchen');
        expect(classifyStation(undefined)).toBe('kitchen');
        expect(classifyStation(null)).toBe('kitchen');
    });
});

describe('isDualStationDessert — postres salen por barra + cocina', () => {
    it('detecta por categoría Postres', () => {
        expect(isDualStationDessert({ name: 'Dulce Árabe', categoryName: 'Postres' })).toBe(true);
    });
    it('detecta por nombre del producto aunque la categoría no sea Postres', () => {
        expect(isDualStationDessert({ name: 'Cheesecake Helado', categoryName: 'Especiales' })).toBe(true);
        expect(isDualStationDessert({ name: 'Brooklyn', categoryName: 'Especiales' })).toBe(true);
        expect(isDualStationDessert({ name: 'Tina de Helado Grande', categoryName: 'Retail' })).toBe(true);
    });
    it('insensible a acentos y mayúsculas', () => {
        expect(isDualStationDessert({ name: 'POSTRE de la casa' })).toBe(true);
    });
    it('un plato salado NO es postre', () => {
        expect(isDualStationDessert({ name: 'Shawarma de Pollo', categoryName: 'Shawarmas' })).toBe(false);
        expect(isDualStationDessert({ name: 'Pincho Mixto', categoryName: 'Parrilla' })).toBe(false);
    });
});

describe('stationsForItem — ruteo final', () => {
    it('postre → ambas estaciones (barra + cocina)', () => {
        expect(stationsForItem({ name: 'Cheesecake Helado', categoryName: 'Postres' }))
            .toEqual(['bar', 'kitchen']);
        expect(stationsForItem({ name: 'Brooklyn', categoryName: 'Postres' }))
            .toEqual(['bar', 'kitchen']);
    });
    it('bebida → solo barra', () => {
        expect(stationsForItem({ name: 'Coca-Cola', categoryName: 'Bebidas' })).toEqual(['bar']);
    });
    it('comida no-postre → solo cocina', () => {
        expect(stationsForItem({ name: 'Shawarma', categoryName: 'Shawarmas' })).toEqual(['kitchen']);
    });
    it('nunca vacío', () => {
        expect(stationsForItem({ name: 'X' }).length).toBeGreaterThan(0);
    });
});
