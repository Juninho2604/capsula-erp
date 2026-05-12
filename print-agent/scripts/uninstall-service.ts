/**
 * Desinstala el Windows Service "KPSULA Print Agent".
 *
 * Uso (PowerShell elevado):
 *   npx tsx scripts/uninstall-service.ts
 */

// @ts-expect-error
import { Service } from 'node-windows';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const agentRoot = join(here, '..');

const svc = new Service({
    name: 'KPSULA Print Agent',
    script: join(agentRoot, 'dist', 'index.js'),
});

svc.on('uninstall', () => {
    console.log('✓ Servicio desinstalado.');
});

svc.on('error', (err: Error) => {
    console.error('✗ Error:', err.message);
    process.exit(1);
});

svc.uninstall();
