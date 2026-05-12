/**
 * CLI de prueba para verificar conectividad con una impresora térmica
 * antes de configurar el agent completo. Diseñado para que Jonathan lo
 * corra una vez desde el PC donde se hospedará el agent.
 *
 * Uso:
 *   npx tsx src/cli-test-print.ts --ip=192.168.1.50
 *   npx tsx src/cli-test-print.ts --ip=192.168.1.50 --port=9100 --station=kitchen-1
 *
 * Si todo funciona, sale por la impresora una hoja con:
 *   ┌─────────────────────────────────┐
 *   │     KPSULA PRINT AGENT          │
 *   │     Test de conectividad        │
 *   │     ──────────────────          │
 *   │     Estación: kitchen-1         │
 *   │     IP: 192.168.1.50:9100       │
 *   │     Fecha: ...                  │
 *   │     ──────────────────          │
 *   │   Si ves esto, la impresora     │
 *   │   está conectada correctamente. │
 *   └─────────────────────────────────┘
 *
 * Si falla con timeout: revisar que la IP responda al ping y que el
 * puerto 9100 esté abierto en el firewall (Windows Defender suele
 * bloquear conexiones salientes raras).
 */

import { testPrint, type PrinterConfig } from './printer-adapter.js';

function parseArgs(): { ip: string; port: number; station: string } {
    const args = process.argv.slice(2);
    let ip = '';
    let port = 9100;
    let station = 'test';

    for (const arg of args) {
        if (arg.startsWith('--ip=')) ip = arg.slice('--ip='.length);
        else if (arg.startsWith('--port=')) port = parseInt(arg.slice('--port='.length), 10);
        else if (arg.startsWith('--station=')) station = arg.slice('--station='.length);
    }

    if (!ip) {
        console.error('Falta --ip=192.168.x.y');
        console.error('');
        console.error('Uso:');
        console.error('  npx tsx src/cli-test-print.ts --ip=192.168.1.50');
        console.error('  npx tsx src/cli-test-print.ts --ip=192.168.1.50 --port=9100 --station=kitchen-1');
        process.exit(1);
    }

    return { ip, port, station };
}

async function main() {
    const { ip, port, station } = parseArgs();
    const cfg: PrinterConfig = { station, ip, port };

    console.log(`[test-print] Intentando imprimir en ${station} (${ip}:${port})...`);

    try {
        await testPrint(cfg);
        console.log('[test-print] ✓ Impresión enviada. Revisa la impresora física.');
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[test-print] ✗ Error: ${msg}`);
        console.error('');
        console.error('Diagnóstico:');
        console.error('  1. ¿Puedes hacer ping a la impresora?  ping ' + ip);
        console.error('  2. ¿Está el puerto 9100 abierto?       telnet ' + ip + ' 9100');
        console.error('  3. ¿La impresora tiene papel y rollo bien colocado?');
        console.error('  4. ¿Está encendida y con LED de red estable?');
        process.exit(1);
    }
}

main();
