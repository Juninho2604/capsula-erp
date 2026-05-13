/**
 * Configuración del Print Agent — leída desde `.env` al arrancar.
 *
 * Las variables sensibles (API_KEY) NO se loggean. El mapping de
 * estaciones → IPs vive en `PRINTERS_JSON` como JSON serializado para
 * que sea trivial editarlo sin recompilar el binario.
 *
 * Ejemplo de `.env` (Windows-friendly, sin comillas):
 *
 *   ERP_URL=https://shanklish-erp-main.vercel.app
 *   API_KEY=cambia-esto-por-una-clave-larga-y-aleatoria
 *   TENANT_ID=tnt_shanklish_caracas
 *   POLL_INTERVAL_MS=1000
 *   PRINTERS_JSON=[{"station":"kitchen-1","ip":"192.168.1.50","port":9100},{"station":"cajera-1","ip":"192.168.1.51","port":9100}]
 *   DEFAULT_STATION=kitchen-1
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { PrinterConfig } from './printer-adapter.js';

// Cargar .env del directorio del agent (no del cwd).
const here = dirname(fileURLToPath(import.meta.url));
config({ path: join(here, '..', '..', '.env') });

export interface AgentConfig {
    erpUrl: string;
    apiKey: string;
    tenantId: string;
    pollIntervalMs: number;
    printers: PrinterConfig[];
    defaultStation: string | null;
}

function requireEnv(name: string): string {
    const v = process.env[name];
    if (!v) {
        throw new Error(`Falta variable de entorno ${name} en .env`);
    }
    return v;
}

export function loadConfig(): AgentConfig {
    const erpUrl = requireEnv('ERP_URL').replace(/\/$/, ''); // sin trailing slash
    const apiKey = requireEnv('API_KEY');
    const tenantId = process.env.TENANT_ID ?? 'tnt_shanklish_caracas';
    const pollIntervalMs = parseInt(process.env.POLL_INTERVAL_MS ?? '1000', 10);

    const printersJson = requireEnv('PRINTERS_JSON');
    let printers: PrinterConfig[];
    try {
        printers = JSON.parse(printersJson);
        if (!Array.isArray(printers)) throw new Error('PRINTERS_JSON debe ser array');
        for (const p of printers) {
            if (!p.station || !p.ip) throw new Error('Cada printer requiere station + ip');
            if (typeof p.port !== 'number') p.port = 9100;
        }
    } catch (err) {
        throw new Error(`PRINTERS_JSON inválido: ${err instanceof Error ? err.message : err}`);
    }

    const defaultStation = process.env.DEFAULT_STATION ?? printers[0]?.station ?? null;

    return {
        erpUrl,
        apiKey,
        tenantId,
        pollIntervalMs,
        printers,
        defaultStation,
    };
}

export function findPrinter(cfg: AgentConfig, stationOrNull: string | null): PrinterConfig | null {
    const station = stationOrNull ?? cfg.defaultStation;
    if (!station) return null;
    return cfg.printers.find((p) => p.station === station) ?? null;
}

/**
 * Devuelve TODAS las impresoras configuradas para una station.
 * Permite el modo "fanout" donde varias entradas en PRINTERS_JSON tienen
 * el mismo `station` → el agent imprime el mismo job en todas (espejo).
 *
 * Útil cuando hay 2 impresoras físicas en una misma estación lógica (ej.
 * 2 comanderas en cocina que deben recibir todas las comandas, una como
 * respaldo de la otra o una para entrada y otra para pase).
 */
export function findPrinters(cfg: AgentConfig, stationOrNull: string | null): PrinterConfig[] {
    const station = stationOrNull ?? cfg.defaultStation;
    if (!station) return [];
    return cfg.printers.filter((p) => p.station === station);
}
