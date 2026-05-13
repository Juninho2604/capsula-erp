/**
 * CLI de prueba para verificar conectividad con impresoras térmicas
 * antes de configurar el agent completo. Diseñado para que Jonathan lo
 * corra una vez desde el PC donde se hospedará el agent.
 *
 * Dos modos:
 *
 *   1. Por IP directa (no requiere .env):
 *      npm run test:print -- --ip=192.168.1.140
 *      npm run test:print -- --ip=192.168.1.140 --port=9100 --station=bar
 *
 *   2. Por nombre de estación (lee PRINTERS_JSON del .env):
 *      npm run test:print -- --station=bar
 *      npm run test:print -- --station=kitchen
 *      Si la estación tiene varias impresoras (fanout), imprime en todas.
 *
 * Si falla con timeout: revisar que la IP responda al ping y que el
 * puerto 9100 esté abierto en el firewall (Windows Defender suele
 * bloquear conexiones salientes raras).
 */

import { testPrint, type PrinterConfig } from './printer-adapter.js';
import { loadConfig, findPrinters } from './config.js';

interface Args {
    ip?: string;
    port: number;
    station?: string;
}

function parseArgs(): Args {
    const args = process.argv.slice(2);
    let ip: string | undefined;
    let port = 9100;
    let station: string | undefined;

    for (const arg of args) {
        if (arg.startsWith('--ip=')) ip = arg.slice('--ip='.length);
        else if (arg.startsWith('--port=')) port = parseInt(arg.slice('--port='.length), 10);
        else if (arg.startsWith('--station=')) station = arg.slice('--station='.length);
        else if (!arg.startsWith('--')) {
            // azúcar: "npm run test:print -- bar" equivale a "--station=bar"
            station = arg;
        }
    }

    if (!ip && !station) {
        console.error('Uso:');
        console.error('  npm run test:print -- --ip=192.168.1.140');
        console.error('  npm run test:print -- --station=bar');
        console.error('  npm run test:print -- --station=kitchen   (imprime en TODAS las impresoras de la estación)');
        process.exit(1);
    }

    return { ip, port, station };
}

async function main() {
    const { ip, port, station } = parseArgs();

    // Modo 1: IP directa, no necesita .env
    if (ip) {
        const cfg: PrinterConfig = { station: station ?? 'test', ip, port };
        console.log(`[test-print] Imprimiendo en ${cfg.station} (${ip}:${port})...`);
        try {
            await testPrint(cfg);
            console.log('[test-print] ✓ Impresión enviada. Revisa la impresora física.');
            return;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[test-print] ✗ Error: ${msg}`);
            diagnosticHints(ip);
            process.exit(1);
        }
    }

    // Modo 2: por nombre de estación, lee del .env
    if (!station) {
        // Defensa: parseArgs ya validó esto, pero TS no lo sabe.
        process.exit(1);
    }

    let printers: PrinterConfig[];
    try {
        const cfg = loadConfig();
        printers = findPrinters(cfg, station);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[test-print] ✗ No pude cargar config: ${msg}`);
        console.error('Revisa que el archivo .env exista en la carpeta print-agent/.');
        process.exit(1);
    }

    if (printers.length === 0) {
        console.error(`[test-print] ✗ No hay impresoras configuradas para estación "${station}".`);
        console.error('Revisa PRINTERS_JSON en .env.');
        process.exit(1);
    }

    console.log(`[test-print] Estación "${station}" → ${printers.length} impresora(s):`);
    for (const p of printers) console.log(`  - ${p.ip}:${p.port}`);

    // Imprimir en paralelo
    const results = await Promise.allSettled(printers.map((p) => testPrint(p)));
    let okCount = 0;
    let failCount = 0;
    for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const p = printers[i];
        if (r.status === 'fulfilled') {
            console.log(`[test-print] ✓ ${p.ip}:${p.port} — enviado`);
            okCount++;
        } else {
            const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
            console.error(`[test-print] ✗ ${p.ip}:${p.port} — ${msg}`);
            failCount++;
        }
    }

    console.log('');
    console.log(`[test-print] Resumen: ${okCount} OK, ${failCount} fallaron de ${printers.length}.`);

    if (failCount > 0) {
        diagnosticHints();
        process.exit(failCount === printers.length ? 1 : 0);
    }
}

function diagnosticHints(ip?: string): void {
    console.error('');
    console.error('Diagnóstico sugerido:');
    if (ip) {
        console.error(`  1. ¿Responde ping?               ping ${ip}`);
        console.error(`  2. ¿Está el puerto 9100 abierto? Test-NetConnection ${ip} -Port 9100 (PowerShell)`);
    } else {
        console.error('  1. ¿Responden las impresoras al ping?');
        console.error('  2. ¿Está el puerto 9100 abierto en cada una? (Test-NetConnection en PowerShell)');
    }
    console.error('  3. ¿La impresora tiene papel y rollo bien colocado?');
    console.error('  4. ¿Está encendida y con LED de red estable?');
}

main();
