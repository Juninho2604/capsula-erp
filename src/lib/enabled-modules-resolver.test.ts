import { describe, it, expect } from 'vitest';

/**
 * Tests sobre la lógica de "auto-incluir módulos nuevos" que vive en
 * system-config.actions.ts. Replicamos la función de parse + merge acá
 * porque la del action depende de Prisma + sesión.
 */

interface EnabledModulesPayload {
    enabled: string[];
    known: string[];
}

interface FakeModule {
    id: string;
    enabledByDefault: boolean;
}

function parseEnabledModulesValue(raw: string): EnabledModulesPayload | null {
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return { enabled: parsed, known: [] };
        }
        if (
            parsed &&
            typeof parsed === 'object' &&
            Array.isArray(parsed.enabled) &&
            Array.isArray(parsed.known)
        ) {
            return { enabled: parsed.enabled, known: parsed.known };
        }
    } catch {
        // ignore
    }
    return null;
}

function resolveEnabledModules(
    saved: EnabledModulesPayload | null,
    registry: FakeModule[],
): string[] {
    if (!saved) {
        return registry.filter((m) => m.enabledByDefault).map((m) => m.id);
    }
    const knownSet = new Set(saved.known);
    const enabledSet = new Set(saved.enabled);
    for (const m of registry) {
        if (!knownSet.has(m.id) && m.enabledByDefault) {
            enabledSet.add(m.id);
        }
    }
    return Array.from(enabledSet);
}

const fakeRegistry: FakeModule[] = [
    { id: 'sales_history', enabledByDefault: true },
    { id: 'sales_entry', enabledByDefault: true },
    { id: 'sold_items_report', enabledByDefault: true }, // módulo "nuevo"
    { id: 'beta_feature', enabledByDefault: false },
];

describe('parseEnabledModulesValue', () => {
    it('formato legacy (array) → enabled=array, known=[]', () => {
        const r = parseEnabledModulesValue('["sales_history","sales_entry"]');
        expect(r).toEqual({ enabled: ['sales_history', 'sales_entry'], known: [] });
    });

    it('formato nuevo (objeto) → preserva enabled y known', () => {
        const r = parseEnabledModulesValue(
            '{"enabled":["a"],"known":["a","b"]}',
        );
        expect(r).toEqual({ enabled: ['a'], known: ['a', 'b'] });
    });

    it('JSON inválido → null', () => {
        expect(parseEnabledModulesValue('not json')).toBeNull();
    });

    it('JSON válido pero formato desconocido → null', () => {
        expect(parseEnabledModulesValue('"hola"')).toBeNull();
        expect(parseEnabledModulesValue('42')).toBeNull();
        expect(parseEnabledModulesValue('{}')).toBeNull();
        expect(parseEnabledModulesValue('{"enabled":"no array"}')).toBeNull();
    });
});

describe('resolveEnabledModules — auto-include de módulos nuevos', () => {
    it('sin config guardada → usa enabledByDefault del registry', () => {
        const r = resolveEnabledModules(null, fakeRegistry);
        expect(r.sort()).toEqual(['sales_entry', 'sales_history', 'sold_items_report'].sort());
        expect(r).not.toContain('beta_feature');
    });

    it('legacy: array guardado sin "sold_items_report" → SE AGREGA automático (es nuevo)', () => {
        const saved = parseEnabledModulesValue('["sales_history","sales_entry"]');
        const r = resolveEnabledModules(saved, fakeRegistry);
        expect(r).toContain('sold_items_report'); // este es el bug que arreglamos
        expect(r).toContain('sales_history');
        expect(r).toContain('sales_entry');
        expect(r).not.toContain('beta_feature');
    });

    it('legacy: módulos beta (enabledByDefault=false) NO se auto-agregan', () => {
        const saved = parseEnabledModulesValue('["sales_history"]');
        const r = resolveEnabledModules(saved, fakeRegistry);
        expect(r).not.toContain('beta_feature');
    });

    it('formato nuevo: si OWNER deshabilitó un módulo CONOCIDO, se respeta', () => {
        // El OWNER sabe de "sold_items_report" pero lo deshabilitó a propósito
        const saved: EnabledModulesPayload = {
            enabled: ['sales_history'],
            known: ['sales_history', 'sales_entry', 'sold_items_report', 'beta_feature'],
        };
        const r = resolveEnabledModules(saved, fakeRegistry);
        expect(r).toEqual(['sales_history']); // respetamos la decisión
        expect(r).not.toContain('sold_items_report');
        expect(r).not.toContain('sales_entry');
    });

    it('formato nuevo: módulo NUEVO no en known se agrega si default=true', () => {
        // OWNER guardó cuando todavía no existía "sold_items_report".
        // Lo deshabilitó "sales_entry" a propósito. "sold_items_report" debe entrar.
        const saved: EnabledModulesPayload = {
            enabled: ['sales_history'],
            known: ['sales_history', 'sales_entry'],
        };
        const r = resolveEnabledModules(saved, fakeRegistry);
        expect(r).toContain('sold_items_report'); // auto-add (no estaba en known)
        expect(r).toContain('sales_history');
        expect(r).not.toContain('sales_entry'); // respeta deshabilitación
        expect(r).not.toContain('beta_feature'); // default=false
    });

    it('formato nuevo: known incluye TODO el registry → no se agrega nada extra', () => {
        const saved: EnabledModulesPayload = {
            enabled: ['sales_history', 'sales_entry'],
            known: ['sales_history', 'sales_entry', 'sold_items_report', 'beta_feature'],
        };
        const r = resolveEnabledModules(saved, fakeRegistry);
        expect(r.sort()).toEqual(['sales_entry', 'sales_history'].sort());
    });
});
