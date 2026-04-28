import { describe, it, expect } from 'vitest';
import { fuzzySearch, normalizeForSearch, paginate } from './fuzzy-search';

interface Item {
    id: string;
    name: string;
    sku: string;
    category?: string;
}

const SAMPLE: Item[] = [
    { id: '1', name: 'Lomito de Res', sku: 'PRO-RES-KG-001', category: 'Carne' },
    { id: '2', name: 'Cerveza Polar', sku: 'BEB-CER-330-001', category: 'Cerveza' },
    { id: '3', name: 'Aceite de Oliva Extra Virgen', sku: 'PAN-ACE-LT-002', category: 'Pantry' },
    { id: '4', name: 'Café de Grano', sku: 'BEB-CAF-KG-001', category: 'Bebida caliente' },
    { id: '5', name: 'Crema de Ajo', sku: 'PRO-AJO-LT-001', category: 'Salsa' },
];

describe('normalizeForSearch', () => {
    it('lowercases and strips diacritics', () => {
        expect(normalizeForSearch('CAFÉ')).toBe('cafe');
        expect(normalizeForSearch('  Año  ')).toBe('ano');
    });
});

describe('fuzzySearch', () => {
    it('returns all items on empty query (default behavior)', () => {
        expect(fuzzySearch(SAMPLE, '', { keys: ['name'] })).toHaveLength(SAMPLE.length);
        expect(fuzzySearch(SAMPLE, '   ', { keys: ['name'] })).toHaveLength(SAMPLE.length);
    });

    it('returns empty array on empty query when includeAllOnEmpty=false', () => {
        expect(fuzzySearch(SAMPLE, '', { keys: ['name'], includeAllOnEmpty: false })).toHaveLength(0);
    });

    it('finds exact name', () => {
        const result = fuzzySearch(SAMPLE, 'Cerveza Polar', { keys: ['name'] });
        expect(result[0]?.id).toBe('2');
    });

    it('finds by SKU prefix', () => {
        const result = fuzzySearch(SAMPLE, 'BEB-CER', { keys: ['sku'] });
        expect(result.find(r => r.id === '2')).toBeDefined();
    });

    it('tolerates typos', () => {
        const result = fuzzySearch(SAMPLE, 'aciete', { keys: ['name'] });
        expect(result.find(r => r.id === '3')).toBeDefined();
    });

    it('tolerates missing diacritics', () => {
        const result = fuzzySearch(SAMPLE, 'cafe', { keys: ['name'] });
        expect(result.find(r => r.id === '4')).toBeDefined();
    });

    it('searches across multiple keys', () => {
        // "carne" no aparece en name pero sí en category
        const result = fuzzySearch(SAMPLE, 'carne', { keys: ['name', 'category'] });
        expect(result.find(r => r.id === '1')).toBeDefined();
    });

    it('returns empty for unrelated query', () => {
        expect(fuzzySearch(SAMPLE, 'helicoptero', { keys: ['name'] })).toEqual([]);
    });

    it('preserves order on empty list', () => {
        expect(fuzzySearch([], 'whatever', { keys: ['name'] })).toEqual([]);
    });
});

describe('paginate', () => {
    const items = Array.from({ length: 23 }, (_, i) => ({ id: i + 1 }));

    it('returns first page with correct slice', () => {
        const res = paginate(items, 1, 10);
        expect(res.items).toHaveLength(10);
        expect(res.items[0].id).toBe(1);
        expect(res.totalPages).toBe(3);
        expect(res.total).toBe(23);
    });

    it('handles partial last page', () => {
        const res = paginate(items, 3, 10);
        expect(res.items).toHaveLength(3);
        expect(res.items[0].id).toBe(21);
    });

    it('clamps out-of-range page to last available', () => {
        const res = paginate(items, 99, 10);
        expect(res.page).toBe(3);
    });

    it('clamps zero/negative page to first', () => {
        expect(paginate(items, 0, 10).page).toBe(1);
        expect(paginate(items, -5, 10).page).toBe(1);
    });

    it('handles empty list', () => {
        const res = paginate([], 1, 10);
        expect(res.items).toEqual([]);
        expect(res.totalPages).toBe(1);
        expect(res.total).toBe(0);
    });

    it('floors fractional pageSize', () => {
        const res = paginate(items, 1, 5.7);
        expect(res.pageSize).toBe(5);
        expect(res.items).toHaveLength(5);
    });
});
