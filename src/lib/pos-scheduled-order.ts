/**
 * §104 — Pedidos FUTUROS (pickup/delivery programados) — helpers PUROS.
 *
 * El input del POS es `datetime-local` (hora Y día). Vacío = DE INMEDIATO.
 * Por compatibilidad se acepta el formato legacy "HH:MM" (pickups guardados
 * antes del cambio): hoy a esa hora, o mañana si ya pasó.
 */

/** 'YYYY-MM-DDTHH:MM' (datetime-local) o 'HH:MM' (legacy) → ISO. '' → undefined. */
export function scheduledInputToISO(value: string, now: Date = new Date()): string | undefined {
    const v = (value || '').trim();
    if (!v) return undefined;

    if (/^\d{2}:\d{2}$/.test(v)) {
        // Legacy HH:MM: hoy; si ya pasó (>60s), asumir mañana.
        const [h, m] = v.split(':').map(Number);
        if (h > 23 || m > 59) return undefined;
        const d = new Date(now);
        d.setHours(h, m, 0, 0);
        if (d.getTime() < now.getTime() - 60_000) d.setDate(d.getDate() + 1);
        return d.toISOString();
    }

    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
        const d = new Date(v); // datetime-local se interpreta en zona local
        if (Number.isNaN(d.getTime())) return undefined;
        return d.toISOString();
    }

    return undefined;
}

/**
 * ¿El pedido es FUTURO (imprimir diferido)? Umbral 90s: lo tipeado "para ya"
 * no se difiere aunque técnicamente esté unos segundos adelante.
 */
export function isFutureSchedule(iso: string | undefined | null, now: Date = new Date()): boolean {
    if (!iso) return false;
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return false;
    return t > now.getTime() + 90_000;
}

/**
 * scheduledFor para el print job: la hora asignada si el pedido es futuro
 * (la comanda se imprime sola al llegar), undefined si es de inmediato.
 */
export function printJobScheduledFor(iso: string | undefined | null, now: Date = new Date()): string | undefined {
    return isFutureSchedule(iso, now) ? (iso as string) : undefined;
}
