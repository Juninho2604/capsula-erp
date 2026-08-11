import { describe, it, expect } from 'vitest';
import {
    COUNT_ROLES,
    APPLY_SESSION_ROLES,
    canCount,
    canApplyCount,
    canCancelCount,
} from './count-permissions';

describe('permisos del conteo de inventario', () => {
    it('los jefes de cocina cuentan — era el reporte de Ramiro y Óscar', () => {
        expect(canCount('KITCHEN_CHEF')).toBe(true);
    });

    it('auditoría aplica el ajuste — regla de Omar: "gerencia o auditoría"', () => {
        expect(canApplyCount('AUDITOR')).toBe(true);
        expect(canApplyCount('OWNER')).toBe(true);
        expect(canApplyCount('ADMIN_MANAGER')).toBe(true);
        expect(canApplyCount('OPS_MANAGER')).toBe(true);
    });

    it('quien cuenta no confirma su propio conteo', () => {
        // Victor es CHEF: cuenta, deja la sesión lista, y el ajuste lo
        // confirma otro. Si esto se abriera, el módulo pierde su razón de ser.
        for (const role of ['CHEF', 'AREA_LEAD', 'KITCHEN_CHEF']) {
            expect(canCount(role)).toBe(true);
            expect(canApplyCount(role)).toBe(false);
        }
    });

    it('roles sin nada que hacer en inventario quedan afuera', () => {
        for (const role of ['CASHIER', 'WAITER', 'STAFF', 'HR_MANAGER']) {
            expect(canCount(role)).toBe(false);
            expect(canApplyCount(role)).toBe(false);
        }
    });

    it('rol vacío o desconocido no pasa ningún candado', () => {
        for (const role of [undefined, null, '', 'INVENTADO']) {
            expect(canCount(role)).toBe(false);
            expect(canApplyCount(role)).toBe(false);
            expect(canCancelCount(role)).toBe(false);
        }
    });

    it('quien aplica también puede contar — no hay callejones sin salida', () => {
        // Un auditor que puede aprobar pero no abrir el módulo no sirve.
        for (const role of APPLY_SESSION_ROLES) {
            expect(canCount(role)).toBe(true);
        }
    });

    it('cancelar exige lo mismo que aplicar', () => {
        for (const role of COUNT_ROLES) {
            expect(canCancelCount(role)).toBe(canApplyCount(role));
        }
    });
});
