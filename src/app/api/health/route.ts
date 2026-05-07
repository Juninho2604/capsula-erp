import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Endpoint de health para monitoreo externo.
 *
 * Responde 200 con un payload mínimo INCLUSO durante MAINTENANCE_MODE
 * (el middleware lo whitelistea), permitiendo que servicios de uptime
 * monitoring (UptimeRobot, BetterStack, etc.) detecten que el server
 * está vivo aunque el resto de la app esté en mantenimiento.
 *
 * NO toca la base de datos: si la BD está caída pero la app responde,
 * este endpoint sigue devolviendo 200.
 */
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        maintenance: process.env.MAINTENANCE_MODE === 'true',
        timestamp: new Date().toISOString(),
    });
}
