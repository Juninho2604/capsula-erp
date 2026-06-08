/**
 * Asignación determinística de sede a una orden de delivery.
 *
 * Precedencia (de mayor a menor):
 *   1. Regla de ruteo producto → sede (RoutingRule). Si la comanda incluye un
 *      producto con regla activa, gana sobre todo lo demás.
 *   2. GPS: sede activa más cercana (haversine) que cubre, si hay coords.
 *   3. Zona: sede cuya DeliveryZone aparece como substring de la dirección.
 *   4. Fallback: sede default provista por el caller (o null).
 *
 * Funciones PURAS — el caller (POST /ordenes) carga sedes/reglas/zonas de la
 * BD y se las pasa. Acá no hay Prisma.
 *
 * NOTA: la disponibilidad de ítem por sede (agotados) se aplica en Fase 4;
 * por ahora `assignBranch` no filtra por stock — el hook está marcado abajo.
 */

export interface BranchCandidate {
    id: string;
    name: string;
    lat?: number | null;
    lon?: number | null;
    /** Zonas de cobertura (nombres) de esta sede. */
    zones: string[];
    isActive: boolean;
}

export interface RoutingRuleLite {
    /** substring/keyword a buscar en los nombres de ítems de la comanda. */
    matchProduct: string;
    branchId: string;
    priority: number;
    isActive: boolean;
}

export interface AssignInput {
    /** Nombres de los ítems de la comanda (para matchear reglas de ruteo). */
    itemNames: string[];
    address?: string | null;
    lat?: number | null;
    lon?: number | null;
    branches: BranchCandidate[];
    routingRules?: RoutingRuleLite[];
    /** Sede a usar si nada matchea. */
    fallbackBranchId?: string | null;
}

export type AssignReason = 'routing_rule' | 'gps' | 'zone' | 'fallback' | 'none';

export interface AssignResult {
    branchId: string | null;
    reason: AssignReason;
}

/** Distancia haversine en km entre dos coordenadas. */
export function haversineKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
): number {
    const R = 6371; // radio terrestre km
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** lowercase + quita acentos (combining marks U+0300–U+036F). */
function norm(s: string): string {
    return s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '');
}

export function assignBranch(input: AssignInput): AssignResult {
    const active = input.branches.filter(b => b.isActive);
    const byId = new Map(active.map(b => [b.id, b]));

    // 1. Reglas de ruteo (mayor prioridad primero).
    const rules = (input.routingRules ?? [])
        .filter(r => r.isActive && byId.has(r.branchId))
        .sort((a, b) => b.priority - a.priority);
    const items = input.itemNames.map(norm);
    for (const rule of rules) {
        const needle = norm(rule.matchProduct);
        if (needle && items.some(it => it.includes(needle))) {
            return { branchId: rule.branchId, reason: 'routing_rule' };
        }
    }

    // 2. GPS: sede activa más cercana con coords.
    if (input.lat != null && input.lon != null) {
        let best: { id: string; dist: number } | null = null;
        for (const b of active) {
            if (b.lat == null || b.lon == null) continue;
            const dist = haversineKm(input.lat, input.lon, b.lat, b.lon);
            if (!best || dist < best.dist) best = { id: b.id, dist };
        }
        if (best) return { branchId: best.id, reason: 'gps' };
    }

    // 3. Zona por texto en la dirección.
    if (input.address) {
        const addr = norm(input.address);
        for (const b of active) {
            if (b.zones.some(z => z && addr.includes(norm(z)))) {
                return { branchId: b.id, reason: 'zone' };
            }
        }
    }

    // 4. Fallback.
    if (input.fallbackBranchId && byId.has(input.fallbackBranchId)) {
        return { branchId: input.fallbackBranchId, reason: 'fallback' };
    }

    return { branchId: null, reason: 'none' };
}
