/**
 * KPSULA Print Agent — entrypoint.
 *
 * Loop principal:
 *   1. Cada `pollIntervalMs` (default 1000), fetch jobs PENDING del ERP.
 *   2. Por cada job:
 *      a. claim → si éxito, transición a PRINTING en el servidor.
 *      b. localizar la impresora (station → IP).
 *      c. enviar ESC/POS por TCP.
 *      d. reportar complete o fail al ERP.
 *   3. Si una iteración tarda más que el intervalo, no nos solapamos
 *      (locks internos).
 *
 * Recoverable errors (printer down, ERP 5xx) → log + continúa.
 * Fatal errors (config inválido) → exit 1, Windows Service lo reinicia.
 */

import { loadConfig, findPrinters, type AgentConfig } from './config.js';
import { ApiClient, type JobFromApi } from './api-client.js';
import { printToStation } from './printer-adapter.js';

const AGENT_VERSION = '0.2.0';

async function processJob(cfg: AgentConfig, api: ApiClient, job: JobFromApi): Promise<void> {
    const printers = findPrinters(cfg, job.station);
    if (printers.length === 0) {
        const msg = `Sin impresora para estación "${job.station ?? '(default)'}". Revisar PRINTERS_JSON.`;
        log('error', `[job ${job.id}] ${msg}`);
        await api.failJob(job.id, msg, false); // no retryable
        return;
    }

    // Imprime en paralelo a todas las impresoras de la estación.
    // Si UNA falla pero al menos otra imprime → job completed con warning
    // (la otra sirvió de respaldo). Si TODAS fallan → job failed con retry.
    const results = await Promise.allSettled(
        printers.map((p) => printToStation(p, job.payload))
    );
    const failed: { printer: typeof printers[number]; reason: string }[] = [];
    const succeeded: typeof printers = [];
    for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status === 'rejected') {
            failed.push({ printer: printers[i], reason: r.reason instanceof Error ? r.reason.message : String(r.reason) });
        } else {
            succeeded.push(printers[i]);
        }
    }

    if (succeeded.length === 0) {
        const msg = failed.map((f) => `${f.printer.ip}: ${f.reason}`).join('; ');
        log('error', `[job ${job.id}] ✗ todas fallaron — ${msg}`);
        await api.failJob(job.id, msg, true);
        return;
    }

    try {
        await api.completeJob(job.id);
        const okList = succeeded.map((p) => `${p.station}@${p.ip}`).join(', ');
        if (failed.length > 0) {
            const failList = failed.map((f) => `${f.printer.ip}: ${f.reason}`).join('; ');
            log('warn', `[job ${job.id}] ✓ ${job.type} → ${okList} (${failed.length} fallaron: ${failList})`);
        } else {
            log('info', `[job ${job.id}] ✓ ${job.type} → ${okList}`);
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log('error', `[job ${job.id}] completeJob falló: ${msg}`);
    }
}

async function tick(cfg: AgentConfig, api: ApiClient): Promise<void> {
    let jobs: JobFromApi[];
    try {
        jobs = await api.fetchPendingJobs(10);
    } catch (err) {
        log('warn', `fetch pending: ${err instanceof Error ? err.message : err}`);
        return;
    }
    if (jobs.length === 0) return;

    log('info', `${jobs.length} job(s) pendientes`);

    for (const job of jobs) {
        let claimed: JobFromApi | null;
        try {
            claimed = await api.claimJob(job.id);
        } catch (err) {
            log('warn', `[job ${job.id}] claim falló: ${err instanceof Error ? err.message : err}`);
            continue;
        }
        if (!claimed) continue; // otro agent lo tomó
        await processJob(cfg, api, claimed);
    }
}

function log(level: 'info' | 'warn' | 'error', msg: string): void {
    const ts = new Date().toISOString();
    const out = `[${ts}] [${level.toUpperCase()}] ${msg}`;
    if (level === 'error') console.error(out);
    else if (level === 'warn') console.warn(out);
    else console.log(out);
}

async function main() {
    log('info', `KPSULA Print Agent v${AGENT_VERSION} arrancando…`);

    let cfg: AgentConfig;
    try {
        cfg = loadConfig();
    } catch (err) {
        log('error', `Config inválido: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
    }

    log('info', `ERP: ${cfg.erpUrl}`);
    log('info', `Tenant: ${cfg.tenantId}`);
    log('info', `Polling cada ${cfg.pollIntervalMs}ms`);
    log('info', `${cfg.printers.length} impresora(s) configurada(s):`);
    for (const p of cfg.printers) log('info', `  - ${p.station} → ${p.ip}:${p.port}`);
    if (cfg.defaultStation) log('info', `Default station: ${cfg.defaultStation}`);

    const api = new ApiClient(cfg);

    // Loop con lock para evitar solapamiento.
    let inFlight = false;
    const id = setInterval(() => {
        if (inFlight) return;
        inFlight = true;
        tick(cfg, api)
            .catch((err) => log('error', `tick error: ${err instanceof Error ? err.message : err}`))
            .finally(() => { inFlight = false; });
    }, cfg.pollIntervalMs);

    // Shutdown limpio cuando Windows Service nos para.
    const shutdown = () => {
        log('info', 'Shutdown signal — saliendo…');
        clearInterval(id);
        setTimeout(() => process.exit(0), 500);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

main();
