import { describe, it, expect } from 'vitest';
import { extractComandaMeta } from './comanda';

describe('extractComandaMeta — GPS combinado "lat,lon"', () => {
    it('parsea delivery.gps (el formato que emite el bot)', () => {
        const m = extractComandaMeta({ delivery: { gps: '10.466026,-66.812147' }, items: [] });
        expect(m.lat).toBeCloseTo(10.466026, 5);
        expect(m.lon).toBeCloseTo(-66.812147, 5);
    });

    it('tolera espacios y separador punto y coma', () => {
        const m = extractComandaMeta({ delivery: { gps: ' 10.466 ; -66.812 ' } });
        expect(m.lat).toBeCloseTo(10.466, 3);
        expect(m.lon).toBeCloseTo(-66.812, 3);
    });

    it('lee gps desde la raíz de la comanda', () => {
        const m = extractComandaMeta({ gps: '10.5,-66.9' });
        expect(m.lat).toBeCloseTo(10.5, 3);
        expect(m.lon).toBeCloseTo(-66.9, 3);
    });

    it('lee gps desde cliente/customer', () => {
        const m = extractComandaMeta({ customer: { gps: '10.5,-66.9' } });
        expect(m.lat).toBeCloseTo(10.5, 3);
        expect(m.lon).toBeCloseTo(-66.9, 3);
    });

    it('lat/lon numéricos explícitos GANAN sobre el string gps', () => {
        const m = extractComandaMeta({ lat: 10.1, lon: -66.1, delivery: { gps: '20.0,-70.0' } });
        expect(m.lat).toBe(10.1);
        expect(m.lon).toBe(-66.1);
    });

    it('gps inválido ("abc") deja lat/lon en null', () => {
        const m = extractComandaMeta({ delivery: { gps: 'abc' } });
        expect(m.lat).toBeNull();
        expect(m.lon).toBeNull();
    });

    it('"GPS registrado" (texto, no coords) no parsea', () => {
        const m = extractComandaMeta({ delivery: { gps: 'GPS registrado' } });
        expect(m.lat).toBeNull();
        expect(m.lon).toBeNull();
    });

    it('coordenadas fuera de rango terrestre se descartan', () => {
        const m = extractComandaMeta({ delivery: { gps: '999,-66.8' } });
        expect(m.lat).toBeNull();
        expect(m.lon).toBeNull();
    });

    it('"null island" 0,0 se descarta (sin fix real)', () => {
        const m = extractComandaMeta({ delivery: { gps: '0,0' } });
        expect(m.lat).toBeNull();
        expect(m.lon).toBeNull();
    });

    it('sin gps ni lat/lon → null, y la dirección sigue saliendo (cae a zona)', () => {
        const m = extractComandaMeta({ direccion: 'Macaracuay, calle 2' });
        expect(m.lat).toBeNull();
        expect(m.lon).toBeNull();
        expect(m.deliveryAddress).toBe('Macaracuay, calle 2');
    });
});
