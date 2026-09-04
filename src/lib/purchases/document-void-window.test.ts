import { describe, it, expect } from 'vitest';
import { canVoidEnteredDocument, DOCUMENT_VOID_WINDOW_DAYS } from './document-void-window';

const NOW = new Date('2026-09-20T12:00:00Z');
const hace = (dias: number) => new Date(NOW.getTime() - dias * 86_400_000);
const base = { role: 'ADMIN_MANAGER', reason: 'Cargada por error', now: NOW };

describe('canVoidEnteredDocument (§171)', () => {
    it('dentro de la ventana, el gerente de administración puede', () => {
        const r = canVoidEnteredDocument({ ...base, enteredAt: hace(3) });
        expect(r.ok).toBe(true);
        if (r.ok) { expect(r.daysSinceEntry).toBe(3); expect(r.outsideWindow).toBe(false); }
    });

    it('el día 15 todavía está dentro; el 16 ya no', () => {
        expect(canVoidEnteredDocument({ ...base, enteredAt: hace(DOCUMENT_VOID_WINDOW_DAYS) }).ok).toBe(true);
        const fuera = canVoidEnteredDocument({ ...base, enteredAt: hace(DOCUMENT_VOID_WINDOW_DAYS + 1) });
        expect(fuera.ok).toBe(false);
        expect(fuera).toMatchObject({ reason: 'ROLE_NOT_ALLOWED_EXPIRED' });
    });

    it('fuera de la ventana el dueño sí puede, y queda marcado como fuera de plazo', () => {
        const r = canVoidEnteredDocument({ ...base, role: 'OWNER', enteredAt: hace(60) });
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.outsideWindow).toBe(true);
    });

    it('otros roles no pueden ni dentro de la ventana', () => {
        for (const role of ['OPS_MANAGER', 'AUDITOR', 'CHEF', 'CASHIER']) {
            const r = canVoidEnteredDocument({ ...base, role, enteredAt: hace(1) });
            expect(r.ok).toBe(false);
            expect(r).toMatchObject({ reason: 'ROLE_NOT_ALLOWED' });
        }
    });

    it('un conteo cerrado después de la entrada BLOQUEA, aunque sea el dueño y sea de ayer', () => {
        // Es la regla que de verdad protege: revertir movería existencias que
        // alguien ya contó a mano, y reabre el descuadre que el conteo cerró.
        const r = canVoidEnteredDocument({
            ...base, role: 'OWNER', enteredAt: hace(2),
            closedCountsAfterEntry: [{ areaName: 'Almacén Principal', closedAt: hace(1) }],
        });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.reason).toBe('COUNT_LOCKED');
        expect(r.message).toContain('Almacén Principal');
        expect(r.message).toContain('ajuste de inventario');
    });

    it('el conteo gana incluso sobre la falta de fecha de entrada', () => {
        const r = canVoidEnteredDocument({
            ...base, enteredAt: null,
            closedCountsAfterEntry: [{ areaName: 'Cocina', closedAt: hace(1) }],
        });
        expect(r).toMatchObject({ reason: 'COUNT_LOCKED' });
    });

    it('con varios conteos nombra el más reciente', () => {
        const r = canVoidEnteredDocument({
            ...base, enteredAt: hace(10),
            closedCountsAfterEntry: [
                { areaName: 'Viejo', closedAt: hace(8) },
                { areaName: 'Reciente', closedAt: hace(2) },
            ],
        });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.message).toContain('Reciente');
    });

    it('sin motivo no se anula nada', () => {
        for (const reason of ['', '   ', null, undefined]) {
            const r = canVoidEnteredDocument({ ...base, reason, enteredAt: hace(1) });
            expect(r).toMatchObject({ ok: false, reason: 'MISSING_REASON' });
        }
    });

    it('sin fecha de entrada no se adivina: se manda a revisar', () => {
        const r = canVoidEnteredDocument({ ...base, enteredAt: null });
        expect(r).toMatchObject({ reason: 'NO_ENTRY_DATE' });
    });

    it('una fecha inválida se trata como ausente, no rompe', () => {
        expect(canVoidEnteredDocument({ ...base, enteredAt: 'no-es-fecha' }))
            .toMatchObject({ reason: 'NO_ENTRY_DATE' });
    });
});
