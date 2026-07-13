import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * §106 — Versión de build corriendo en el servidor.
 *
 * El cliente (pwa-register.tsx) pollea este endpoint para detectar que hubo
 * un deploy nuevo y recargar el bundle. Sin esto, una tablet con la SPA
 * abierta en memoria puede quedarse días con código viejo: el service worker
 * solo detecta updates cuando cambia sw.js (que los deploys no tocan), y la
 * navegación client-side de Next.js nunca re-descarga el HTML.
 *
 * Incidente que motivó esto (12/07/2026, TAB-3691 / TAB-3690): tablets con
 * bundle pre-deploy renderizaban el historial de ventas con campos
 * desfasados ("10% SERV: No", cobrado sin servicio) aunque la BD estaba
 * correcta. Se resolvió al salir y volver a entrar — este endpoint automatiza
 * exactamente eso.
 *
 * Sin auth a propósito: solo expone el BUILD_ID de Next (hash opaco, cero
 * información sensible) y debe ser alcanzable desde /login también.
 */

export const dynamic = 'force-dynamic';

let cachedBuildId: string | null = null;

function readBuildId(): string {
    if (cachedBuildId) return cachedBuildId;
    try {
        // En standalone (VPS) y en build normal, Next escribe .next/BUILD_ID
        // relativo al cwd del server.
        cachedBuildId = fs
            .readFileSync(path.join(process.cwd(), '.next', 'BUILD_ID'), 'utf8')
            .trim();
    } catch {
        // Dev o layout inesperado: valor constante → el cliente nunca ve
        // "cambio de versión" y no recarga. Comportamiento inocuo.
        cachedBuildId = 'dev';
    }
    return cachedBuildId;
}

export async function GET() {
    return NextResponse.json(
        { buildId: readBuildId() },
        { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
}
