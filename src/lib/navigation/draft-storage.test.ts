import { describe, it, expect } from 'vitest';
import { draftKey, parseDraft, isDraftWorthRestoring } from './draft-storage';

describe('draftKey (§167)', () => {
    it('separa por módulo y formulario', () => {
        expect(draftKey('compras', 'recepcion')).toBe('kpsula.draft.compras.recepcion');
        expect(draftKey('compras', 'orden')).not.toBe(draftKey('compras', 'recepcion'));
    });
});

describe('parseDraft', () => {
    it('devuelve lo guardado', () => {
        expect(parseDraft('{"a":1}', {})).toEqual({ a: 1 });
        expect(parseDraft('[1,2]', [])).toEqual([1, 2]);
    });

    it('sin borrador devuelve el valor inicial', () => {
        expect(parseDraft(null, { vacio: true })).toEqual({ vacio: true });
        expect(parseDraft('', 'nada')).toBe('nada');
    });

    it('un borrador corrupto se descarta en silencio', () => {
        // Mejor un formulario en blanco que uno con basura a medio leer.
        expect(parseDraft('{roto', { ok: true })).toEqual({ ok: true });
        expect(parseDraft('null', 'inicial')).toBe('inicial');
    });

    it('un borrador de otra versión del formulario se descarta', () => {
        const esLista = (v: unknown) => Array.isArray(v);
        expect(parseDraft('{"formaVieja":1}', [], esLista)).toEqual([]);
        expect(parseDraft('[1]', [], esLista)).toEqual([1]);
    });
});

describe('isDraftWorthRestoring', () => {
    it('un borrador vacío no se le ofrece a nadie', () => {
        expect(isDraftWorthRestoring({})).toBe(false);
        expect(isDraftWorthRestoring([])).toBe(false);
        expect(isDraftWorthRestoring('   ')).toBe(false);
        expect(isDraftWorthRestoring(null)).toBe(false);
        expect(isDraftWorthRestoring(0)).toBe(false);
    });

    it('uno con contenido sí', () => {
        expect(isDraftWorthRestoring({ harina: 5 })).toBe(true);
        expect(isDraftWorthRestoring([1])).toBe(true);
        expect(isDraftWorthRestoring('nota')).toBe(true);
        expect(isDraftWorthRestoring(3)).toBe(true);
    });
});
