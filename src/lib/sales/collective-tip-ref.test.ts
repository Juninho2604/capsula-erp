import { describe, it, expect } from 'vitest';
import { embedTabCode, extractTabCode, stripTabMarker } from './collective-tip-ref';

describe('collective-tip-ref — vínculo propina colectiva → mesa', () => {
    it('embed + extract ida y vuelta', () => {
        const note = embedTabCode('Propina colectiva — Mesa: Juan', 'TAB-M5-0012');
        expect(note).toContain('[tab:TAB-M5-0012]');
        expect(extractTabCode(note)).toBe('TAB-M5-0012');
    });

    it('sin tabCode no agrega marcador', () => {
        expect(embedTabCode('Propina colectiva', '')).toBe('Propina colectiva');
        expect(embedTabCode('Propina colectiva', null)).toBe('Propina colectiva');
        expect(embedTabCode('Propina colectiva', undefined)).toBe('Propina colectiva');
    });

    it('nota vacía → default', () => {
        expect(embedTabCode('', 'X-1')).toBe('Propina colectiva [tab:X-1]');
    });

    it('extractTabCode devuelve null si no hay marcador', () => {
        expect(extractTabCode('Propina colectiva — Mesa/Ref: Juan')).toBeNull();
        expect(extractTabCode('')).toBeNull();
        expect(extractTabCode(null)).toBeNull();
        expect(extractTabCode(undefined)).toBeNull();
    });

    it('stripTabMarker deja la nota legible sin el marcador', () => {
        expect(stripTabMarker('Propina colectiva — Mesa: Juan [tab:TAB-9]')).toBe('Propina colectiva — Mesa: Juan');
        expect(stripTabMarker('Propina colectiva')).toBe('Propina colectiva');
    });

    it('soporta correlativos con guiones y números', () => {
        expect(extractTabCode(embedTabCode('x', 'M04-2026-0866'))).toBe('M04-2026-0866');
    });
});
