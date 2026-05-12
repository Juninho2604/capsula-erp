/**
 * Registra el Print Agent como Windows Service usando `node-windows`.
 *
 * Tras correr este script:
 *  - Aparece "KPSULA Print Agent" en services.msc
 *  - Startup Type: Automatic (arranca al boot)
 *  - Logs en daemon/*.out.log y daemon/*.err.log
 *  - Si el proceso muere, Windows lo reinicia (con backoff)
 *
 * Uso (desde la raíz del agent, en PowerShell elevado):
 *   npx tsx scripts/install-service.ts
 */

// @ts-expect-error — node-windows no expone tipos perfectos
import { Service } from 'node-windows';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const agentRoot = join(here, '..');
const distEntry = join(agentRoot, 'dist', 'index.js');

const svc = new Service({
    name: 'KPSULA Print Agent',
    description: 'Daemon que imprime print jobs del ERP en las impresoras térmicas AON por TCP/IP.',
    script: distEntry,
    nodeOptions: [],
    workingDirectory: agentRoot,
    // Restart con backoff si crashea: 1s primer intento, 5s segundo, etc.
    wait: 1,
    grow: 0.5,
    maxRetries: 40,
});

svc.on('install', () => {
    console.log('✓ Servicio instalado. Arrancando…');
    svc.start();
});

svc.on('start', () => {
    console.log('✓ Servicio arrancado.');
    console.log('Ver logs:');
    console.log(`  Get-Content -Path "${agentRoot}/daemon/*.out.log" -Wait -Tail 50`);
});

svc.on('error', (err: Error) => {
    console.error('✗ Error registrando servicio:', err.message);
    process.exit(1);
});

console.log(`Instalando servicio para entry: ${distEntry}`);
console.log('NOTA: ejecutar como Administrador. Si falla "Access denied",');
console.log('      abrir PowerShell con "Run as Administrator".');
svc.install();
