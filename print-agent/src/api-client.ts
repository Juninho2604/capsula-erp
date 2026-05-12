/**
 * Cliente HTTP del agent hacia el ERP. Pequeño wrapper sobre `fetch`
 * que añade headers de auth y maneja errores de red de forma uniforme.
 *
 * No usa librería externa (axios, ky) — fetch nativo de Node 20+ basta
 * y mantiene el bundle mínimo.
 */

import type { AgentConfig } from './config.js';
import type { PrintPayload } from './printer-adapter.js';

export interface JobFromApi {
    id: string;
    type: 'RECEIPT' | 'PRECUENTA' | 'KITCHEN' | 'VOID_KITCHEN';
    station: string | null;
    payload: PrintPayload;
    retries: number;
    createdAt: string;
}

export class ApiClient {
    constructor(private readonly cfg: AgentConfig) {}

    private headers(): Record<string, string> {
        return {
            Authorization: `Bearer ${this.cfg.apiKey}`,
            'X-Tenant-Id': this.cfg.tenantId,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };
    }

    /** Lista jobs PENDING. Devuelve [] si no hay nada o si el ERP no responde. */
    async fetchPendingJobs(limit = 10): Promise<JobFromApi[]> {
        const url = `${this.cfg.erpUrl}/api/print-agent/jobs?status=PENDING&limit=${limit}`;
        const res = await fetch(url, { method: 'GET', headers: this.headers() });
        if (!res.ok) {
            throw new Error(`fetchPendingJobs HTTP ${res.status}: ${await res.text()}`);
        }
        const data = (await res.json()) as { jobs: JobFromApi[] };
        return data.jobs ?? [];
    }

    /** Reclama un job. Devuelve el job (que incluye payload) o null si conflicto (otro agent lo tomó). */
    async claimJob(id: string): Promise<JobFromApi | null> {
        const url = `${this.cfg.erpUrl}/api/print-agent/jobs/${encodeURIComponent(id)}/claim`;
        const res = await fetch(url, { method: 'POST', headers: this.headers() });
        if (res.status === 409 || res.status === 404) return null;
        if (!res.ok) {
            throw new Error(`claimJob HTTP ${res.status}: ${await res.text()}`);
        }
        const data = (await res.json()) as { job: JobFromApi };
        return data.job;
    }

    async completeJob(id: string): Promise<void> {
        const url = `${this.cfg.erpUrl}/api/print-agent/jobs/${encodeURIComponent(id)}/complete`;
        const res = await fetch(url, { method: 'POST', headers: this.headers() });
        if (!res.ok) {
            throw new Error(`completeJob HTTP ${res.status}: ${await res.text()}`);
        }
    }

    async failJob(id: string, errorMessage: string, retryable = true): Promise<void> {
        const url = `${this.cfg.erpUrl}/api/print-agent/jobs/${encodeURIComponent(id)}/fail`;
        const res = await fetch(url, {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify({ errorMessage, retryable }),
        });
        if (!res.ok) {
            throw new Error(`failJob HTTP ${res.status}: ${await res.text()}`);
        }
    }
}
