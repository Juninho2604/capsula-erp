import { describe, it, expect } from 'vitest';
import { parseViewParam, buildViewSearch } from './view-param';

const VISTAS = ['orders', 'create', 'receive', 'config'] as const;

describe('parseViewParam (§167)', () => {
    it('lee la vista de la dirección', () => {
        expect(parseViewParam('?v=receive', 'v', VISTAS, 'orders')).toBe('receive');
        expect(parseViewParam('v=create', 'v', VISTAS, 'orders')).toBe('create');
    });

    it('sin parámetro cae a la vista de entrada', () => {
        expect(parseViewParam('', 'v', VISTAS, 'orders')).toBe('orders');
        expect(parseViewParam('?otro=1', 'v', VISTAS, 'orders')).toBe('orders');
    });

    it('una vista inventada NO deja la pantalla en un estado que no existe', () => {
        // Alguien edita la URL a mano, o queda un enlace viejo de una vista que
        // ya se quitó del módulo: se entra por la puerta principal, no en blanco.
        expect(parseViewParam('?v=inventada', 'v', VISTAS, 'orders')).toBe('orders');
    });

    it('respeta otros parámetros del módulo', () => {
        expect(parseViewParam('?buscar=harina&v=config', 'v', VISTAS, 'orders')).toBe('config');
    });

    it('una query rota no rompe la pantalla', () => {
        expect(parseViewParam('?%', 'v', VISTAS, 'orders')).toBe('orders');
    });
});

describe('buildViewSearch', () => {
    it('escribe la vista activa', () => {
        expect(buildViewSearch('', 'v', 'receive', 'orders')).toBe('?v=receive');
    });

    it('la vista de entrada limpia el parámetro — la dirección no junta ruido', () => {
        expect(buildViewSearch('?v=receive', 'v', 'orders', 'orders')).toBe('');
    });

    it('conserva los demás parámetros al cambiar de vista', () => {
        const r = buildViewSearch('?buscar=harina', 'v', 'config', 'orders');
        expect(r).toContain('buscar=harina');
        expect(r).toContain('v=config');
    });

    it('conserva los demás parámetros al volver a la entrada', () => {
        expect(buildViewSearch('?buscar=harina&v=config', 'v', 'orders', 'orders'))
            .toBe('?buscar=harina');
    });

    it('cambiar dos veces no duplica el parámetro', () => {
        const uno = buildViewSearch('', 'v', 'create', 'orders');
        const dos = buildViewSearch(uno, 'v', 'receive', 'orders');
        expect(dos).toBe('?v=receive');
    });
});
