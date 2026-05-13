'use server';

/**
 * GAMES ACTIONS — Módulo Entretenimiento
 * CAPSULA ERP — Table-Pong integration
 *
 * Cubre: GameType, GameStation, GameSession, WristbandPlan, Reservation, QueueTicket
 */

import prisma from '@/server/db';
import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { getNextCorrelativo } from '@/lib/invoice-counter';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GAMES_ROLES = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'] as const;
const CASHIER_ROLES = [...GAMES_ROLES, 'CASHIER'] as const;

async function requireRole(roles: readonly string[]) {
    const session = await getSession();
    if (!session) throw new Error('No autorizado');
    if (!roles.includes(session.role)) throw new Error('Sin permiso para esta acción');
    return session;
}

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export type GameStationWithType = Awaited<ReturnType<typeof getGameStations>>[number];
export type ActiveSessionWithStation = Awaited<ReturnType<typeof getActiveSessions>>[number];
export type ReservationFull = Awaited<ReturnType<typeof getReservations>>[number];
export type QueueTicketFull = Awaited<ReturnType<typeof getQueueTickets>>[number];

// =============================================================================
// GAME TYPES
// =============================================================================

export async function getGameTypes() {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const session = await getSession();
    if (!session) throw new Error('No autorizado');

    return db.gameType.findMany({
        where: { isActive: true },
        include: {
            _count: { select: { stations: true, sessions: true } },
        },
        orderBy: { name: 'asc' },
    });
}

export async function createGameType(data: {
    code: string;
    name: string;
    description?: string;
    icon?: string;
    color?: string;
    defaultSessionMinutes?: number;
}) {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const session = await requireRole(GAMES_ROLES);

    const gameType = await db.gameType.create({ data });
    revalidatePath('/dashboard/games');
    return { ok: true, gameType };
}

export async function updateGameType(
    id: string,
    data: Partial<{
        name: string;
        description: string;
        icon: string;
        color: string;
        defaultSessionMinutes: number;
        isActive: boolean;
    }>
) {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    await requireRole(GAMES_ROLES);
    const gameType = await db.gameType.update({ where: { id }, data });
    revalidatePath('/dashboard/games');
    return { ok: true, gameType };
}

// =============================================================================
// GAME STATIONS
// =============================================================================

export async function getGameStations(filters?: {
    gameTypeId?: string;
    currentStatus?: string;
    isActive?: boolean;
}) {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const session = await getSession();
    if (!session) throw new Error('No autorizado');

    return db.gameStation.findMany({
        where: {
            isActive: filters?.isActive ?? true,
            ...(filters?.gameTypeId && { gameTypeId: filters.gameTypeId }),
            ...(filters?.currentStatus && { currentStatus: filters.currentStatus }),
        },
        include: {
            gameType: true,
            sessions: {
                where: { status: 'ACTIVE' },
                take: 1,
                include: { startedBy: { select: { firstName: true, lastName: true } } },
            },
        },
        orderBy: { code: 'asc' },
    });
}

export async function createGameStation(data: {
    code: string;
    name: string;
    gameTypeId: string;
    branchId?: string;
    hourlyRate?: number;
    notes?: string;
}) {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    await requireRole(GAMES_ROLES);

    const station = await db.gameStation.create({ data });
    revalidatePath('/dashboard/games');
    return { ok: true, station };
}

export async function updateStationStatus(
    stationId: string,
    currentStatus: 'AVAILABLE' | 'IN_USE' | 'RESERVED' | 'MAINTENANCE'
) {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    await requireRole(CASHIER_ROLES);
    const station = await db.gameStation.update({
        where: { id: stationId },
        data: { currentStatus },
    });
    revalidatePath('/dashboard/games');
    return { ok: true, station };
}

// =============================================================================
// GAME SESSIONS
// =============================================================================

export async function getActiveSessions() {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const session = await getSession();
    if (!session) throw new Error('No autorizado');

    return db.gameSession.findMany({
        where: { status: { in: ['ACTIVE', 'PAUSED'] } },
        include: {
            station: { include: { gameType: true } },
            startedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { startedAt: 'asc' },
    });
}

export async function getSessionHistory(filters?: {
    stationId?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
}) {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const session = await getSession();
    if (!session) throw new Error('No autorizado');

    return db.gameSession.findMany({
        where: {
            status: { in: ['ENDED'] },
            ...(filters?.stationId && { stationId: filters.stationId }),
            ...(filters?.fromDate && { startedAt: { gte: filters.fromDate } }),
            ...(filters?.toDate && { endedAt: { lte: filters.toDate } }),
        },
        include: {
            station: { include: { gameType: true } },
            startedBy: { select: { firstName: true, lastName: true } },
            endedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { startedAt: 'desc' },
        take: filters?.limit ?? 50,
    });
}

export async function startSession(data: {
    stationId: string;
    customerName?: string;
    guestCount?: number;
    billingType?: 'HOURLY' | 'WRISTBAND' | 'FLAT';
    wristbandCode?: string;
    reservationId?: string;
    scheduledEndAt?: Date;
    notes?: string;
}) {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const session = await requireRole(CASHIER_ROLES);

    // Verificar que la estación está disponible
    const station = await db.gameStation.findUniqueOrThrow({
        where: { id: data.stationId },
    });

    if (station.currentStatus !== 'AVAILABLE') {
        throw new Error(`La estación "${station.name}" no está disponible (estado: ${station.currentStatus})`);
    }

    // Generar código de sesión (contador global, nunca se resetea)
    const code = await getNextCorrelativo('GAME_SESSION');

    const [gameSession] = await db.$transaction([
        db.gameSession.create({
            data: {
                code,
                stationId: data.stationId,
                gameTypeId: station.gameTypeId,
                reservationId: data.reservationId,
                wristbandCode: data.wristbandCode,
                customerName: data.customerName,
                guestCount: data.guestCount ?? 1,
                billingType: data.billingType ?? 'HOURLY',
                scheduledEndAt: data.scheduledEndAt,
                notes: data.notes,
                status: 'ACTIVE',
                startedById: session.id,
            },
        }),
        db.gameStation.update({
            where: { id: data.stationId },
            data: { currentStatus: 'IN_USE' },
        }),
    ]);

    revalidatePath('/dashboard/games');
    return { ok: true, gameSession };
}

export async function endSession(sessionId: string, notes?: string) {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const authSession = await requireRole(CASHIER_ROLES);

    const gameSession = await db.gameSession.findUniqueOrThrow({
        where: { id: sessionId },
        include: { station: true },
    });

    if (gameSession.status === 'ENDED') {
        throw new Error('La sesión ya fue cerrada');
    }

    const endedAt = new Date();
    const startedAt = gameSession.startedAt;
    const minutesBilled = Math.ceil((endedAt.getTime() - startedAt.getTime()) / 60000);

    // Calcular monto según tipo de facturación
    let amountBilled = 0;
    if (gameSession.billingType === 'HOURLY' && gameSession.station.hourlyRate) {
        amountBilled = (minutesBilled / 60) * gameSession.station.hourlyRate;
    }

    const [updatedSession] = await db.$transaction([
        db.gameSession.update({
            where: { id: sessionId },
            data: {
                status: 'ENDED',
                endedAt,
                minutesBilled,
                amountBilled: Math.round(amountBilled * 100) / 100,
                endedById: authSession.id,
                notes: notes ?? gameSession.notes,
            },
        }),
        db.gameStation.update({
            where: { id: gameSession.stationId },
            data: { currentStatus: 'AVAILABLE' },
        }),
    ]);

    revalidatePath('/dashboard/games');
    return {
        ok: true,
        gameSession: updatedSession,
        minutesBilled,
        amountBilled: Math.round(amountBilled * 100) / 100,
    };
}

export async function pauseSession(sessionId: string) {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const authSession = await requireRole(CASHIER_ROLES);

    const updated = await db.gameSession.update({
        where: { id: sessionId },
        data: { status: 'PAUSED' },
    });

    revalidatePath('/dashboard/games');
    return { ok: true, gameSession: updated };
}

export async function resumeSession(sessionId: string) {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const authSession = await requireRole(CASHIER_ROLES);

    const updated = await db.gameSession.update({
        where: { id: sessionId },
        data: { status: 'ACTIVE' },
    });

    revalidatePath('/dashboard/games');
    return { ok: true, gameSession: updated };
}

// =============================================================================
// WRISTBAND PLANS
// =============================================================================

export async function getWristbandPlans(activeOnly = true) {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const session = await getSession();
    if (!session) throw new Error('No autorizado');

    return db.wristbandPlan.findMany({
        where: activeOnly ? { isActive: true } : {},
        include: { _count: { select: { reservations: true } } },
        orderBy: { price: 'asc' },
    });
}

export async function createWristbandPlan(data: {
    code: string;
    name: string;
    description?: string;
    durationMinutes: number;
    price: number;
    color?: string;
    maxSessions?: number;
}) {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    await requireRole(GAMES_ROLES);

    const plan = await db.wristbandPlan.create({ data });
    revalidatePath('/dashboard/wristbands');
    return { ok: true, plan };
}

export async function updateWristbandPlan(
    id: string,
    data: Partial<{
        name: string;
        description: string;
        durationMinutes: number;
        price: number;
        color: string;
        maxSessions: number;
        isActive: boolean;
    }>
) {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    await requireRole(GAMES_ROLES);
    const plan = await db.wristbandPlan.update({ where: { id }, data });
    revalidatePath('/dashboard/wristbands');
    return { ok: true, plan };
}

// =============================================================================
// RESERVATIONS
// =============================================================================

export async function getReservations(filters?: {
    date?: Date;
    stationId?: string;
    status?: string;
}) {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const session = await getSession();
    if (!session) throw new Error('No autorizado');

    let dateFrom: Date | undefined;
    let dateTo: Date | undefined;

    if (filters?.date) {
        dateFrom = new Date(filters.date);
        dateFrom.setHours(0, 0, 0, 0);
        dateTo = new Date(filters.date);
        dateTo.setHours(23, 59, 59, 999);
    }

    return db.reservation.findMany({
        where: {
            deletedAt: null,
            ...(filters?.stationId && { stationId: filters.stationId }),
            ...(filters?.status && { status: filters.status }),
            ...(dateFrom && dateTo && { scheduledStart: { gte: dateFrom, lte: dateTo } }),
        },
        include: {
            station: { include: { gameType: true } },
            wristbandPlan: true,
            createdBy: { select: { firstName: true, lastName: true } },
            session: { select: { id: true, status: true, startedAt: true } },
        },
        orderBy: { scheduledStart: 'asc' },
    });
}

export async function createReservation(data: {
    stationId: string;
    wristbandPlanId?: string;
    customerName: string;
    customerPhone?: string;
    guestCount?: number;
    scheduledStart: Date;
    scheduledEnd: Date;
    depositAmount?: number;
    depositPaid?: boolean;
    notes?: string;
}) {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const session = await requireRole(CASHIER_ROLES);

    // Validar que no haya choque de horario en esa estación
    const conflict = await db.reservation.findFirst({
        where: {
            stationId: data.stationId,
            deletedAt: null,
            status: { in: ['PENDING', 'CONFIRMED'] },
            OR: [
                {
                    scheduledStart: { lt: data.scheduledEnd },
                    scheduledEnd: { gt: data.scheduledStart },
                },
            ],
        },
    });

    if (conflict) {
        throw new Error(
            `La estación ya tiene una reserva para ese horario (${conflict.customerName} — ${new Date(conflict.scheduledStart).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })})`
        );
    }

    const count = await db.reservation.count();
    const code  = `RES-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const reservation = await db.reservation.create({
        data: {
            code,
            ...data,
            guestCount: data.guestCount ?? 1,
            depositAmount: data.depositAmount ?? 0,
            depositPaid: data.depositPaid ?? false,
            status: 'PENDING',
            createdById: session.id,
        },
        include: {
            station: { include: { gameType: true } },
            wristbandPlan: true,
        },
    });

    revalidatePath('/dashboard/reservations');
    return { ok: true, reservation };
}

export async function confirmReservation(id: string) {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    await requireRole(CASHIER_ROLES);
    const reservation = await db.reservation.update({
        where: { id },
        data: { status: 'CONFIRMED' },
    });
    revalidatePath('/dashboard/reservations');
    return { ok: true, reservation };
}

export async function cancelReservation(id: string, reason?: string) {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    await requireRole(CASHIER_ROLES);
    const reservation = await db.reservation.update({
        where: { id },
        data: { status: 'CANCELLED', notes: reason },
    });
    revalidatePath('/dashboard/reservations');
    return { ok: true, reservation };
}

export async function checkInReservation(reservationId: string) {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const authSession = await requireRole(CASHIER_ROLES);

    const reservation = await db.reservation.findUniqueOrThrow({
        where: { id: reservationId },
        include: { station: true },
    });

    if (reservation.status !== 'CONFIRMED' && reservation.status !== 'PENDING') {
        throw new Error('La reserva no está en estado válido para check-in');
    }

    // Marcar como CHECKED_IN y arrancar sesión automáticamente
    const code = await getNextCorrelativo('GAME_SESSION');
    const [updatedReservation, gameSession] = await db.$transaction(async tx => {
        const sess = await tx.gameSession.create({
            data: {
                code,
                stationId: reservation.stationId,
                gameTypeId: reservation.station.gameTypeId,
                reservationId: reservation.id,
                customerName: reservation.customerName,
                guestCount: reservation.guestCount,
                billingType: reservation.wristbandPlanId ? 'WRISTBAND' : 'HOURLY',
                status: 'ACTIVE',
                startedById: authSession.id,
                scheduledEndAt: reservation.scheduledEnd,
            },
        });

        const updated = await tx.reservation.update({
            where: { id: reservationId },
            data: { status: 'CHECKED_IN' },
        });

        await tx.gameStation.update({
            where: { id: reservation.stationId },
            data: { currentStatus: 'IN_USE' },
        });

        return [updated, sess];
    });

    revalidatePath('/dashboard/games');
    revalidatePath('/dashboard/reservations');
    return { ok: true, reservation: updatedReservation, gameSession };
}

// =============================================================================
// QUEUE TICKETS
// =============================================================================

export async function getQueueTickets(statusFilter?: string[]) {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const session = await getSession();
    if (!session) throw new Error('No autorizado');

    return db.queueTicket.findMany({
        where: {
            status: { in: statusFilter ?? ['WAITING', 'CALLED'] },
        },
        include: {
            station: { include: { gameType: true } },
        },
        orderBy: { ticketNumber: 'asc' },
    });
}

export async function issueQueueTicket(data: {
    customerName: string;
    customerPhone?: string;
    guestCount?: number;
    stationId?: string;
    gameTypeId?: string;
    notes?: string;
}) {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const session = await requireRole(CASHIER_ROLES);

    // Calcular siguiente número de ticket (reset diario)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastToday = await db.queueTicket.findFirst({
        where: { createdAt: { gte: today } },
        orderBy: { ticketNumber: 'desc' },
    });

    const ticketNumber = (lastToday?.ticketNumber ?? 0) + 1;

    // Estimar espera: tickets en espera × 30 min promedio
    const waitingCount = await db.queueTicket.count({
        where: { status: 'WAITING' },
    });

    const ticket = await db.queueTicket.create({
        data: {
            ticketNumber,
            customerName: data.customerName,
            customerPhone: data.customerPhone,
            guestCount: data.guestCount ?? 1,
            stationId: data.stationId,
            gameTypeId: data.gameTypeId,
            notes: data.notes,
            status: 'WAITING',
            estimatedWaitMinutes: waitingCount * 30,
        },
    });

    revalidatePath('/dashboard/queue');
    return { ok: true, ticket, ticketNumber };
}

export async function callQueueTicket(ticketId: string) {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    await requireRole(CASHIER_ROLES);

    const ticket = await db.queueTicket.update({
        where: { id: ticketId },
        data: { status: 'CALLED', calledAt: new Date() },
    });

    revalidatePath('/dashboard/queue');
    return { ok: true, ticket };
}

export async function seatQueueTicket(ticketId: string) {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    await requireRole(CASHIER_ROLES);

    const ticket = await db.queueTicket.update({
        where: { id: ticketId },
        data: { status: 'SEATED', seatedAt: new Date() },
    });

    revalidatePath('/dashboard/queue');
    return { ok: true, ticket };
}

export async function expireQueueTicket(ticketId: string) {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    await requireRole(CASHIER_ROLES);

    const ticket = await db.queueTicket.update({
        where: { id: ticketId },
        data: { status: 'EXPIRED' },
    });

    revalidatePath('/dashboard/queue');
    return { ok: true, ticket };
}

export async function cancelQueueTicket(ticketId: string) {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    await requireRole(CASHIER_ROLES);

    const ticket = await db.queueTicket.update({
        where: { id: ticketId },
        data: { status: 'CANCELLED' },
    });

    revalidatePath('/dashboard/queue');
    return { ok: true, ticket };
}

// =============================================================================
// DASHBOARD STATS (para el widget de Games en el dashboard principal)
// =============================================================================

export async function getGamesDashboardStats() {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const session = await getSession();
    if (!session) throw new Error('No autorizado');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
        stationsTotal,
        stationsAvailable,
        activeSessionsCount,
        reservationsToday,
        queueWaiting,
        revenueToday,
    ] = await Promise.all([
        db.gameStation.count({ where: { isActive: true } }),
        db.gameStation.count({ where: { isActive: true, currentStatus: 'AVAILABLE' } }),
        db.gameSession.count({ where: { status: 'ACTIVE' } }),
        db.reservation.count({
            where: {
                deletedAt: null,
                scheduledStart: { gte: today },
                status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
            },
        }),
        db.queueTicket.count({ where: { status: 'WAITING' } }),
        db.gameSession.aggregate({
            where: { startedAt: { gte: today }, status: 'ENDED' },
            _sum: { amountBilled: true },
        }),
    ]);

    return {
        stationsTotal,
        stationsAvailable,
        stationsOccupied: stationsTotal - stationsAvailable,
        activeSessionsCount,
        reservationsToday,
        queueWaiting,
        revenueToday: revenueToday._sum.amountBilled ?? 0,
    };
}
