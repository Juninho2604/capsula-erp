import { describe, it, expect } from 'vitest';
import { parseInventoryWorksheet } from './inventory-excel-parse';

describe('parseInventoryWorksheet', () => {
    it('formato legacy: PRODUCTO + CANTIDAD EN STOCK (1 almacén)', () => {
        const rows = [
            ['INVENTARIO GENERAL'],
            ['PRODUCTO', 'CANTIDAD EN STOCK'],
            ['Queso de mano', 5.5],
            ['Tomate', 2.3],
            ['', ''],   // fila vacía → ignorada
            ['TOTAL', 7.8],  // ignorada
        ];
        const out = parseInventoryWorksheet(rows);
        expect(out).toEqual([
            { sku: null, productName: 'Queso de mano', qtyPrincipal: 5.5, qtyProduction: null },
            { sku: null, productName: 'Tomate',         qtyPrincipal: 2.3, qtyProduction: null },
        ]);
    });

    it('formato legacy dual: PRODUCTO + 2 columnas con header texto en col 2', () => {
        const rows = [
            ['PRODUCTO', 'PRINCIPAL', 'COCINA'],
            ['Queso', 10, 4],
            ['Tomate', 5, 1.5],
        ];
        const out = parseInventoryWorksheet(rows);
        expect(out).toHaveLength(2);
        expect(out[0]).toEqual({ sku: null, productName: 'Queso', qtyPrincipal: 10, qtyProduction: 4 });
    });

    it('formato nuevo con SKU detectado por header', () => {
        const rows = [
            ['SKU', 'PRODUCTO', 'CATEGORÍA', 'UNIDAD', 'CANTIDAD'],
            ['QM-001', 'Queso de mano', 'Lácteos', 'KG', 5.5],
            ['TM-002', 'Tomate',         'Vegetales', 'KG', 2.3],
        ];
        const out = parseInventoryWorksheet(rows);
        expect(out).toEqual([
            { sku: 'QM-001', productName: 'Queso de mano', qtyPrincipal: 5.5, qtyProduction: null },
            { sku: 'TM-002', productName: 'Tomate',         qtyPrincipal: 2.3, qtyProduction: null },
        ]);
    });

    it('formato nuevo dual con SKU + Principal + Producción', () => {
        const rows = [
            ['SKU', 'PRODUCTO', 'CATEGORÍA', 'UNIDAD', 'PRINCIPAL', 'PRODUCCIÓN'],
            ['QM-001', 'Queso de mano', 'Lácteos', 'KG', 10, 4],
            ['TM-002', 'Tomate',         'Vegetales', 'KG', 5, 1.5],
        ];
        const out = parseInventoryWorksheet(rows);
        expect(out).toHaveLength(2);
        expect(out[0]).toEqual({ sku: 'QM-001', productName: 'Queso de mano', qtyPrincipal: 10, qtyProduction: 4 });
        expect(out[1].sku).toBe('TM-002');
        expect(out[1].qtyProduction).toBe(1.5);
    });

    it('filas separadoras de categoría ("## LÁCTEOS ##") se ignoran', () => {
        const rows = [
            ['SKU', 'PRODUCTO', 'CANTIDAD'],
            ['## LÁCTEOS ##', '', ''],
            ['QM-001', 'Queso de mano', 5.5],
            ['## VEGETALES ##', '', ''],
            ['TM-002', 'Tomate', 2.3],
        ];
        const out = parseInventoryWorksheet(rows);
        expect(out).toHaveLength(2);
        expect(out.map(r => r.sku)).toEqual(['QM-001', 'TM-002']);
    });

    it('SKU vacío se devuelve como null (no string vacío)', () => {
        const rows = [
            ['SKU', 'PRODUCTO', 'CANTIDAD'],
            ['', 'Item sin SKU registrado', 3],
        ];
        const out = parseInventoryWorksheet(rows);
        expect(out[0].sku).toBeNull();
        expect(out[0].productName).toBe('Item sin SKU registrado');
    });

    it('cantidad con coma decimal se parsea como número', () => {
        const rows = [
            ['PRODUCTO', 'CANTIDAD EN STOCK'],
            ['Queso', '5,5'],
        ];
        const out = parseInventoryWorksheet(rows);
        expect(out[0].qtyPrincipal).toBe(5.5);
    });

    it('lanza error si no hay encabezado PRODUCTO', () => {
        expect(() => parseInventoryWorksheet([['SKU', 'NOPE', 'CANT']]))
            .toThrow(/encabezado/i);
    });

    it('tolerancia de aliases en headers (CANT., CANTIDAD, STOCK)', () => {
        const rows = [
            ['CODIGO', 'NOMBRE', 'STOCK'],
            ['ABC-1', 'Aceite', 12],
        ];
        const out = parseInventoryWorksheet(rows);
        expect(out).toEqual([
            { sku: 'ABC-1', productName: 'Aceite', qtyPrincipal: 12, qtyProduction: null },
        ]);
    });

    it('items con todas las cantidades vacías se filtran (dual)', () => {
        const rows = [
            ['SKU', 'PRODUCTO', 'PRINCIPAL', 'PRODUCCIÓN'],
            ['A', 'Tiene principal', 5, ''],
            ['B', 'Vacio total', '', ''],
            ['C', 'Tiene produccion', '', 3],
        ];
        const out = parseInventoryWorksheet(rows);
        expect(out.map(r => r.sku)).toEqual(['A', 'C']);
    });
});
