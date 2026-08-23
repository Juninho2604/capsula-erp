import { describe, it, expect } from 'vitest';
import { PERM, ROLE_BASE_PERMS, PERM_LABELS } from './permissions-registry';
import { PERM_TO_MODULES } from '@/lib/permissions/perm-to-modules';
import { MODULE_ROLE_ACCESS } from './modules-registry';

/**
 * §158 — Renombrar mesoneros por rotación de personal.
 *
 * Julián (Jefe de Área) necesita cambiar el nombre de los usuarios de
 * mesonero. Antes las actions no ped\u00edan NADA más que estar logueado, y el
 * módulo estaba cerrado a gerencia. Ahora: el módulo se ve por rol, pero
 * editar exige el permiso individual MANAGE_WAITERS.
 */
describe('MANAGE_WAITERS (§158)', () => {
    it('el jefe de área ve el módulo de mesoneros', () => {
        expect(MODULE_ROLE_ACCESS.mesoneros).toContain('AREA_LEAD');
    });

    it('pero NO puede editar sin el permiso concedido', () => {
        // Ver la lista no es lo mismo que renombrar. El permiso se concede
        // por usuario en Usuarios → Permisos, no viene con el rol.
        expect(ROLE_BASE_PERMS.AREA_LEAD).not.toContain(PERM.MANAGE_WAITERS);
    });

    it('gerencia y RRHH lo traen de base — nadie pierde lo que ya hacía', () => {
        for (const role of ['ADMIN_MANAGER', 'OPS_MANAGER', 'HR_MANAGER']) {
            expect(ROLE_BASE_PERMS[role]).toContain(PERM.MANAGE_WAITERS);
        }
        expect(ROLE_BASE_PERMS.OWNER).toContain(PERM.MANAGE_WAITERS);
    });

    it('el permiso mapea al módulo mesoneros y tiene etiqueta legible', () => {
        expect(PERM_TO_MODULES[PERM.MANAGE_WAITERS]).toEqual(['mesoneros']);
        expect(PERM_LABELS[PERM.MANAGE_WAITERS].label).toBeTruthy();
    });

    it('no habilita PINes — eso sigue siendo de gerencia', () => {
        expect(PERM.MANAGE_WAITERS).not.toBe(PERM.MANAGE_PINS);
        expect(ROLE_BASE_PERMS.AREA_LEAD).not.toContain(PERM.MANAGE_PINS);
    });
});
