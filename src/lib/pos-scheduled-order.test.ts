import { describe, it, expect } from 'vitest';
import { scheduledInputToISO, isFutureSchedule, printJobScheduledFor } from './pos-scheduled-order';

const now = new Date('2026-07-10T15:00:00');

describe('scheduledInputToISO (§104)', () => {
    it("vacío → undefined (DE INMEDIATO)", () => {
        expect(scheduledInputToISO('', now)).toBeUndefined();
        expect(scheduledInputToISO('   ', now)).toBeUndefined();
    });

    it('datetime-local → ISO exacto (hora y día elegidos)', () => {
        const iso = scheduledInputToISO('2026-07-12T18:30', now)!;
        expect(new Date(iso).getDate()).toBe(12);
        expect(new Date(iso).getHours()).toBe(18);
        expect(new Date(iso).getMinutes()).toBe(30);
    });

    it('legacy HH:MM futuro → hoy a esa hora', () => {
        const iso = scheduledInputToISO('18:30', now)!;
        const d = new Date(iso);
        expect(d.getDate()).toBe(10);
        expect(d.getHours()).toBe(18);
    });

    it('legacy HH:MM ya pasado → mañana', () => {
        const iso = scheduledInputToISO('09:00', now)!;
        expect(new Date(iso).getDate()).toBe(11);
    });

    it('basura → undefined', () => {
        expect(scheduledInputToISO('mañana', now)).toBeUndefined();
        expect(scheduledInputToISO('25:99', now)).toBeUndefined();
    });
});

describe('isFutureSchedule / printJobScheduledFor (§104)', () => {
    it('más de 90s adelante → futuro (comanda diferida)', () => {
        const iso = new Date(now.getTime() + 60 * 60_000).toISOString();
        expect(isFutureSchedule(iso, now)).toBe(true);
        expect(printJobScheduledFor(iso, now)).toBe(iso);
    });

    it('ya / hace rato / dentro de 60s → inmediato (imprime ya)', () => {
        expect(isFutureSchedule(undefined, now)).toBe(false);
        expect(isFutureSchedule(now.toISOString(), now)).toBe(false);
        expect(isFutureSchedule(new Date(now.getTime() + 60_000).toISOString(), now)).toBe(false);
        expect(printJobScheduledFor(new Date(now.getTime() - 5000).toISOString(), now)).toBeUndefined();
    });
});
