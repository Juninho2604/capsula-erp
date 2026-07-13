import { describe, it, expect } from 'vitest';
import { packUnits, packLineTotal, packUnitCost, effectiveUnitsPerPack } from './pack-line';

describe('pack-line — presentación por bulto (§108.1)', () => {
  it('caso canónico: 5 bultos × 12 paquetes a $30 el bulto', () => {
    const line = { quantity: '5', unitsPerPack: '12', unitCost: '30' };
    expect(packUnits(line)).toBe(60);       // exactamente 60 al almacén
    expect(packUnitCost(line)).toBe(2.5);   // $2.50 por paquete
    expect(packLineTotal(line)).toBe(150);  // 5 × $30
    // Invariante: unidades × costo unitario === total de la línea
    expect(Math.round(packUnits(line) * packUnitCost(line) * 100) / 100).toBe(packLineTotal(line));
  });

  it('unitsPerPack vacío se comporta como compra por unidad (default 1)', () => {
    const line = { quantity: '8', unitsPerPack: '', unitCost: '4.20' };
    expect(effectiveUnitsPerPack(line)).toBe(1);
    expect(packUnits(line)).toBe(8);
    expect(packUnitCost(line)).toBe(4.2);
    expect(packLineTotal(line)).toBe(33.6);
  });

  it('unitsPerPack 0 o inválido cae a 1 (nunca divide por cero)', () => {
    expect(packUnits({ quantity: '3', unitsPerPack: '0', unitCost: '10' })).toBe(3);
    expect(packUnitCost({ quantity: '3', unitsPerPack: 'abc', unitCost: '10' })).toBe(10);
  });

  it('mata el ruido de punto flotante en cantidades', () => {
    // 0.1 × 3 = 0.30000000000000004 en FP crudo
    expect(packUnits({ quantity: '0.1', unitsPerPack: '3', unitCost: '1' })).toBe(0.3);
    // 5.5 bultos × 12 = 66 exacto
    expect(packUnits({ quantity: '5.5', unitsPerPack: '12', unitCost: '30' })).toBe(66);
  });

  it('costo con división periódica queda acotado a 6 decimales', () => {
    // $10 el bulto de 3 unidades → 3.333333
    const line = { quantity: '2', unitsPerPack: '3', unitCost: '10' };
    expect(packUnitCost(line)).toBe(3.333333);
    expect(packUnits(line)).toBe(6);
    expect(packLineTotal(line)).toBe(20);
  });

  it('campos vacíos producen cero, no NaN', () => {
    const line = { quantity: '', unitsPerPack: '', unitCost: '' };
    expect(packUnits(line)).toBe(0);
    expect(packLineTotal(line)).toBe(0);
    expect(packUnitCost(line)).toBe(0);
  });
});
