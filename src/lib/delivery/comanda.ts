/**
 * Parsing defensivo de la "comanda" JSON que emite el bot. El shape exacto lo
 * controla la IA/n8n y puede variar, así que toleramos varias convenciones de
 * nombre (es/en) y nunca lanzamos: si no entendemos algo, lo ignoramos.
 *
 * Solo lo usamos para derivar:
 *   - nombres de ítems (para reglas de ruteo y firma de idempotencia)
 *   - una firma estable de la comanda (orden-independiente) para dedupe
 *
 * NO interpretamos precios ni stock acá — el módulo es aislado de la
 * contabilidad; los montos llegan aparte como informativos.
 */

export interface ComandaItem {
    name: string;
    qty: number;
    modifiers: string[];
}

type Json = unknown;

function asRecord(v: Json): Record<string, unknown> | null {
    return v && typeof v === 'object' && !Array.isArray(v)
        ? (v as Record<string, unknown>)
        : null;
}

function pickString(rec: Record<string, unknown>, keys: string[]): string {
    for (const k of keys) {
        const val = rec[k];
        if (typeof val === 'string' && val.trim()) return val.trim();
    }
    return '';
}

function pickNumber(rec: Record<string, unknown>, keys: string[], fallback: number): number {
    for (const k of keys) {
        const val = rec[k];
        if (typeof val === 'number' && Number.isFinite(val)) return val;
        if (typeof val === 'string' && val.trim() && Number.isFinite(Number(val))) {
            return Number(val);
        }
    }
    return fallback;
}

/**
 * Parsea un par de coordenadas desde un string combinado "lat,lon" — el
 * formato que emiten los bots de chat al compartir ubicación (ej. Telegram:
 * "10.466026,-66.812147"). Tolera separador coma o punto y coma e ignora
 * espacios. Devuelve null si no parsea o si las coordenadas no son plausibles
 * (fuera de rango terrestre, o "null island" 0,0 = sin fix real de GPS), para
 * que el caller siga cayendo al ruteo por zona/fallback sin romperse.
 */
function parseGpsPair(raw: string): { lat: number; lon: number } | null {
    const parts = raw.split(/[,;]/);
    if (parts.length !== 2) return null;
    const lat = parseFloat(parts[0].trim());
    const lon = parseFloat(parts[1].trim());
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    if (lat === 0 && lon === 0) return null;
    return { lat, lon };
}

/** Devuelve el array de ítems crudos de la comanda, tolerando shapes. */
function rawItems(comanda: Json): Record<string, unknown>[] {
    const rec = asRecord(comanda);
    if (!rec) return [];
    const candidates = [rec.items, rec.productos, rec.lineas, rec.lines];
    for (const c of candidates) {
        if (Array.isArray(c)) {
            return c.map(asRecord).filter((x): x is Record<string, unknown> => x !== null);
        }
    }
    return [];
}

/** Extrae una lista de strings de modificadores, tolerando array de strings
 *  o array de objetos `{name|nombre|label}`. */
function pickStringArray(rec: Record<string, unknown>, keys: string[]): string[] {
    for (const k of keys) {
        const val = rec[k];
        if (Array.isArray(val)) {
            return val
                .map(v => {
                    if (typeof v === 'string') return v.trim();
                    const r = asRecord(v);
                    return r ? pickString(r, ['name', 'nombre', 'label', 'opcion']) : '';
                })
                .filter(Boolean);
        }
    }
    return [];
}

export function parseComandaItems(comanda: Json): ComandaItem[] {
    return rawItems(comanda).map(it => ({
        name: pickString(it, ['name', 'nombre', 'producto', 'item', 'title']),
        qty: pickNumber(it, ['qty', 'cantidad', 'quantity', 'cant'], 1),
        modifiers: pickStringArray(it, [
            'modifiers',
            'modificadores',
            'personalizaciones',
            'opciones',
            'extras',
            'toppings',
        ]),
    }));
}

/** Solo los nombres no vacíos de los ítems (para reglas de ruteo). */
export function extractItemNames(comanda: Json): string[] {
    return parseComandaItems(comanda)
        .map(i => i.name)
        .filter(Boolean);
}

export interface ComandaMeta {
    customerName: string | null;
    customerPhone: string | null;
    deliveryAddress: string | null;
    deliveryRef: string | null;
    lat: number | null;
    lon: number | null;
    totalUsd: number | null;
    totalBs: number | null;
}

/**
 * Extrae metadatos de cliente/entrega/total de la comanda, tolerando que el
 * bot los ponga en la raíz o anidados bajo `cliente`/`customer`. Best-effort:
 * cualquier campo ausente queda null.
 */
export function extractComandaMeta(comanda: Json): ComandaMeta {
    const root = asRecord(comanda) ?? {};
    const cliente = asRecord(root.cliente) ?? asRecord(root.customer) ?? {};
    const merged = { ...root, ...cliente };

    const num = (rec: Record<string, unknown>, keys: string[]): number | null => {
        const v = pickNumber(rec, keys, NaN);
        return Number.isFinite(v) ? v : null;
    };
    const str = (rec: Record<string, unknown>, keys: string[]): string | null => {
        const v = pickString(rec, keys);
        return v || null;
    };

    // Coordenadas. Prioridad: lat/lon numéricos explícitos (raíz o cliente).
    // Si falta alguno, se intenta un string combinado "lat,lon" desde
    // `delivery.gps`, `gps` en la raíz, o `cliente/customer.gps` — el formato
    // que emite el bot al compartir la ubicación de Telegram. Sin esto el GPS
    // del bot nunca llegaba a assignBranch y la sede caía a zona/fallback.
    let lat = num(merged, ['lat', 'latitude', 'latitud']);
    let lon = num(merged, ['lon', 'lng', 'longitude', 'longitud']);
    if (lat === null || lon === null) {
        const delivery = asRecord(root.delivery) ?? {};
        const gpsRaw =
            pickString(delivery, ['gps', 'ubicacion', 'location', 'coords', 'coordenadas']) ||
            pickString(merged, ['gps', 'ubicacion', 'location', 'coords', 'coordenadas']);
        const pair = gpsRaw ? parseGpsPair(gpsRaw) : null;
        if (pair) {
            if (lat === null) lat = pair.lat;
            if (lon === null) lon = pair.lon;
        }
    }

    return {
        customerName: str(merged, ['nombre', 'name', 'cliente_nombre', 'fullName']),
        customerPhone: str(merged, ['telefono', 'phone', 'celular', 'whatsapp']),
        deliveryAddress: str(merged, ['direccion', 'address', 'direccion_entrega']),
        deliveryRef: str(merged, ['referencia', 'reference', 'punto_referencia', 'ref']),
        lat,
        lon,
        totalUsd: num(root, ['total_usd', 'totalUsd', 'total', 'monto_usd']),
        totalBs: num(root, ['total_bs', 'totalBs', 'monto_bs']),
    };
}

/**
 * Firma estable de la comanda para idempotencia. Orden-independiente
 * (ordena los ítems) y normaliza espacios → mismo pedido = misma firma
 * aunque el bot reordene los ítems.
 */
export function computeComandaSignature(comanda: Json): string {
    const parts = parseComandaItems(comanda)
        .map(i => `${i.name.toLowerCase().replace(/\s+/g, ' ').trim()}x${i.qty}`)
        .filter(s => s !== 'x1' && s.length > 1)
        .sort();
    return parts.join('|');
}
