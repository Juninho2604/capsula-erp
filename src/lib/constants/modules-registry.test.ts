import { describe, it, expect } from 'vitest';
import { MODULE_ROLE_ACCESS } from './modules-registry';

/**
 * "Jefe de área y jefe de cocina es el mismo rol" (Omar, 2026-08-09).
 *
 * En el sistema son dos roles, y diferían en 13 módulos: quien estaba cargado
 * como KITCHEN_CHEF no veía ni Inventario, ni Producción, ni el POS — por eso
 * Ramiro y Óscar chocaban contra una pared. La decisión fue unificar en
 * AREA_LEAD y dejar KITCHEN_CHEF para las cuentas de pantalla de cocina.
 *
 * Para que mover a alguien de un rol al otro nunca le quite acceso, AREA_LEAD
 * tiene que ser un superconjunto de KITCHEN_CHEF. Esto lo vigila.
 */
describe('MODULE_ROLE_ACCESS · jefe de área vs jefe de cocina', () => {
    it('Jefe de Área ve todo lo que ve Jefe de Cocina', () => {
        const soloCocina = Object.entries(MODULE_ROLE_ACCESS)
            .filter(([, roles]) => roles.includes('KITCHEN_CHEF') && !roles.includes('AREA_LEAD'))
            .map(([moduleId]) => moduleId);

        expect(soloCocina).toEqual([]);
    });

    it('la pantalla de cocina la ven ambos', () => {
        expect(MODULE_ROLE_ACCESS.kitchen_display).toContain('AREA_LEAD');
        expect(MODULE_ROLE_ACCESS.kitchen_display).toContain('KITCHEN_CHEF');
    });

    it('los módulos de conteo salen de count-permissions, no de una lista suelta', () => {
        // Si alguien vuelve a escribir la lista a mano acá, estos dos dejan de
        // coincidir con la matriz y reaparece el bug de §150.
        expect(MODULE_ROLE_ACCESS.inventory_count).toEqual(MODULE_ROLE_ACCESS.inventory_quick_count);
        expect(MODULE_ROLE_ACCESS.inventory_count).toContain('AUDITOR');
        expect(MODULE_ROLE_ACCESS.inventory_count).toContain('KITCHEN_CHEF');
    });

    it('ningún módulo deja afuera al dueño', () => {
        const sinDueno = Object.entries(MODULE_ROLE_ACCESS)
            .filter(([, roles]) => !roles.includes('OWNER'))
            .map(([moduleId]) => moduleId);

        expect(sinDueno).toEqual([]);
    });
});
