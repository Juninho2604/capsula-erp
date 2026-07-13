'use server';

/**
 * §113 — Encuesta de satisfacción del cliente.
 *
 * Registro OPCIONAL, no bloquea el cobro. Lo llena el mesonero/caja desde la
 * tablet al final del servicio (al cerrar la cuenta o manualmente). Escritura
 * abierta a roles operativos del POS; lectura de resultados restringida.
 */

import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { isSatisfactionRating, summarizeSatisfaction, type SatisfactionSummary } from '@/lib/sales/satisfaction';

// Cualquier rol que opere el POS puede registrar una encuesta.
const WRITE_ROLES = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CASHIER', 'WAITER', 'AREA_LEAD'];
// Resultados: gestión.
const READ_ROLES = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AUDITOR'];

export interface SubmitSatisfactionInput {
    rating: string;
    comment?: string | null;
    openTabId?: string | null;
    tabCode?: string | null;
    tableName?: string | null;
    waiterName?: string | null;
}

export async function submitSatisfactionSurveyAction(
    input: SubmitSatisfactionInput
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session) return { success: false, error: 'No autorizado' };
    if (!WRITE_ROLES.includes(session.role)) return { success: false, error: 'Sin permiso para registrar encuestas' };
    if (!isSatisfactionRating(input.rating)) return { success: false, error: 'Calificación inválida' };

    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        await db.satisfactionSurvey.create({
            data: {
                tenantId,
                rating: input.rating,
                comment: input.comment?.trim() ? input.comment.trim().slice(0, 500) : null,
                openTabId: input.openTabId || null,
                tabCode: input.tabCode || null,
                tableName: input.tableName || null,
                waiterName: input.waiterName || null,
                createdById: session.id,
                createdByName: `${session.firstName} ${session.lastName}`.trim() || session.email,
            },
        });
        revalidatePath('/dashboard/encuestas');
        return { success: true };
    } catch (e) {
        console.error('[submitSatisfactionSurveyAction]', e);
        return { success: false, error: 'Error al guardar la encuesta' };
    }
}

export interface SatisfactionRow {
    id: string;
    rating: string;
    comment: string | null;
    tabCode: string | null;
    tableName: string | null;
    waiterName: string | null;
    createdByName: string;
    createdAt: Date;
}

export interface SatisfactionReport {
    summary: SatisfactionSummary;
    /** % positivo por mesonero (para ver quién recibe mejores calificaciones). */
    byWaiter: { waiterName: string; total: number; avgScore: number; positivePct: number }[];
    rows: SatisfactionRow[];
}

/**
 * Resultados de un día (Caracas). `date` = 'YYYY-MM-DD'; default hoy.
 */
export async function getSatisfactionSurveysAction(
    date?: string
): Promise<{ success: boolean; data?: SatisfactionReport; error?: string }> {
    const session = await getSession();
    if (!session) return { success: false, error: 'No autorizado' };
    if (!READ_ROLES.includes(session.role)) return { success: false, error: 'Sin permiso para ver resultados' };

    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);

        const day = date || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });
        // Ventana del día en Caracas (UTC-4).
        const start = new Date(`${day}T00:00:00-04:00`);
        const end = new Date(`${day}T23:59:59.999-04:00`);

        const surveys = await db.satisfactionSurvey.findMany({
            where: { createdAt: { gte: start, lte: end } },
            orderBy: { createdAt: 'desc' },
            take: 500,
        });

        const summary = summarizeSatisfaction(surveys.map(s => s.rating));

        // Agrupar por mesonero.
        const waiterMap = new Map<string, string[]>();
        for (const s of surveys) {
            const key = (s.waiterName || '').trim() || 'Sin mesonero';
            const arr = waiterMap.get(key) ?? [];
            arr.push(s.rating);
            waiterMap.set(key, arr);
        }
        const byWaiter = Array.from(waiterMap.entries())
            .map(([waiterName, ratings]) => {
                const sum = summarizeSatisfaction(ratings);
                return { waiterName, total: sum.total, avgScore: sum.avgScore, positivePct: sum.positivePct };
            })
            .sort((a, b) => b.total - a.total);

        return {
            success: true,
            data: {
                summary,
                byWaiter,
                rows: surveys.map(s => ({
                    id: s.id,
                    rating: s.rating,
                    comment: s.comment,
                    tabCode: s.tabCode,
                    tableName: s.tableName,
                    waiterName: s.waiterName,
                    createdByName: s.createdByName,
                    createdAt: s.createdAt,
                })),
            },
        };
    } catch (e) {
        console.error('[getSatisfactionSurveysAction]', e);
        return { success: false, error: 'Error al cargar resultados' };
    }
}
