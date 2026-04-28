/**
 * SKU Code helpers — Capsula ERP
 *
 * Patrón propuesto: [FAM]-[SUB]-[FMT]-[NNN]
 *   FAM: 2..4 letras de ProductFamily.code (ej. BEB, PRO, LAC)
 *   SUB: 2..4 letras de subcategoría (ej. CER, RES, LEC)
 *   FMT: formato/presentación (ej. 330, KG, LT, UND)
 *   NNN: secuencial 3 dígitos zero-padded (001, 002, …)
 *
 * Ejemplos:
 *   BEB-CER-330-001  (cerveza 330ml #1)
 *   PRO-RES-KG-014   (carne de res #14)
 *   LAC-LEC-LT-002   (leche 1L #2)
 *
 * Estas son funciones puras (sin Prisma) para usar en cualquier capa.
 * La asignación del secuencial real consultando la BD es responsabilidad
 * del caller (server action). Aquí solo se valida y compone el string.
 */

const SEGMENT_RE = /^[A-Z0-9]{1,5}$/;

export interface SkuParts {
    familyCode: string; // FAM
    subCode?: string; // SUB
    formatCode?: string; // FMT
    sequence: number; // NNN
}

/**
 * Sanitiza un segmento del SKU: uppercase, sin espacios, sin acentos,
 * sin caracteres especiales. Devuelve null si queda vacío.
 */
export function sanitizeSegment(input: string | undefined | null): string | null {
    if (!input) return null;
    const cleaned = input
        .toString()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 5);
    return cleaned.length > 0 ? cleaned : null;
}

/**
 * Genera un SKU formateado a partir de las partes. Lanza si los segmentos
 * obligatorios fallan validación. El secuencial se zero-padea a 3 dígitos
 * (acepta hasta 999; 1000+ se acepta sin truncar).
 */
export function generateSkuCode(parts: SkuParts): string {
    const fam = sanitizeSegment(parts.familyCode);
    if (!fam || !SEGMENT_RE.test(fam)) {
        throw new Error(`familyCode inválido: "${parts.familyCode}"`);
    }
    if (!Number.isFinite(parts.sequence) || parts.sequence < 0) {
        throw new Error(`sequence inválido: ${parts.sequence}`);
    }

    const segments: string[] = [fam];

    const sub = sanitizeSegment(parts.subCode);
    if (sub) {
        if (!SEGMENT_RE.test(sub)) throw new Error(`subCode inválido: "${parts.subCode}"`);
        segments.push(sub);
    }

    const fmt = sanitizeSegment(parts.formatCode);
    if (fmt) {
        if (!SEGMENT_RE.test(fmt)) throw new Error(`formatCode inválido: "${parts.formatCode}"`);
        segments.push(fmt);
    }

    const padded = String(Math.floor(parts.sequence)).padStart(3, '0');
    segments.push(padded);

    return segments.join('-');
}

/**
 * Parsea un SKU del patrón canónico FAM-SUB-FMT-NNN o variantes con menos
 * segmentos (FAM-NNN, FAM-SUB-NNN, FAM-FMT-NNN). Devuelve null si no
 * corresponde al patrón.
 *
 * Útil para validar imports y mostrar agrupaciones en reportes.
 */
export function parseSkuCode(sku: string): SkuParts | null {
    if (!sku) return null;
    const segments = sku.split('-').map(s => s.trim()).filter(Boolean);
    if (segments.length < 2) return null;

    const lastSegment = segments[segments.length - 1];
    if (!/^\d+$/.test(lastSegment)) return null;
    const sequence = parseInt(lastSegment, 10);

    const familyCode = segments[0];
    if (!SEGMENT_RE.test(familyCode)) return null;

    // Casos por número de segmentos:
    //   2 → [FAM, NNN]
    //   3 → [FAM, SUB|FMT, NNN]    — ambigüedad heurística: si todos son letras → SUB; si mezcla dígitos → FMT
    //   4 → [FAM, SUB, FMT, NNN]
    //   5+ → no soportado
    if (segments.length === 2) {
        return { familyCode, sequence };
    }
    if (segments.length === 3) {
        const middle = segments[1];
        if (!SEGMENT_RE.test(middle)) return null;
        // Heurística: si tiene algún dígito (KG no, 330 sí) → tratamos como formato
        const hasDigit = /\d/.test(middle);
        return hasDigit
            ? { familyCode, formatCode: middle, sequence }
            : { familyCode, subCode: middle, sequence };
    }
    if (segments.length === 4) {
        const sub = segments[1];
        const fmt = segments[2];
        if (!SEGMENT_RE.test(sub) || !SEGMENT_RE.test(fmt)) return null;
        return { familyCode, subCode: sub, formatCode: fmt, sequence };
    }
    return null;
}

/**
 * Devuelve el prefijo (todo menos el secuencial) de un SKU canónico.
 * Si no parsea, devuelve null.
 *
 * Usado para queries por familia: "todos los BEB-CER-*", etc.
 */
export function skuPrefix(sku: string): string | null {
    const parsed = parseSkuCode(sku);
    if (!parsed) return null;
    const segs = [parsed.familyCode];
    if (parsed.subCode) segs.push(parsed.subCode);
    if (parsed.formatCode) segs.push(parsed.formatCode);
    return segs.join('-');
}
