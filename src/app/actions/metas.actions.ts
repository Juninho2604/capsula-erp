'use server';

import prisma from '@/server/db';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { getCaracasDayRange, getCaracasNowParts } from '@/lib/datetime';

// ============================================================================
// TIPOS
// ============================================================================

export interface MetasConfig {
  daily: number;    // Meta de venta diaria en USD
  weekly: number;   // Meta semanal
  monthly: number;  // Meta mensual
  wastePercent: number; // % de merma aceptable global
}

export interface MetasData {
  config: MetasConfig;
  actual: {
    today: number;
    todayOrders: number;
    week: number;
    weekOrders: number;
    month: number;
    monthOrders: number;
    wasteThisMonth: number; // Total USD desechado este mes (WASTE / ADJUSTMENT_OUT)
  };
  progress: {
    daily: number;  // % logrado (0–100+)
    weekly: number;
    monthly: number;
  };
  projection: {
    dailyProjected: number; // A este ritmo, cuánto se hará hoy
    willHitDaily: boolean;
  };
  role: string;
  canEdit: boolean;
}

const METAS_CONFIG_KEY = 'metas_config';

const DEFAULT_CONFIG: MetasConfig = {
  daily: 500,
  weekly: 3000,
  monthly: 12000,
  wastePercent: 5,
};

// ============================================================================
// LEER CONFIGURACIÓN DE METAS
// ============================================================================

async function getMetasConfig(): Promise<MetasConfig> {
  try {
    const record = await prisma.systemConfig.findUnique({ where: { key: METAS_CONFIG_KEY } });
    if (!record) return DEFAULT_CONFIG;
    const parsed = JSON.parse(record.value) as Partial<MetasConfig>;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return DEFAULT_CONFIG;
  }
}

// ============================================================================
// ACCIÓN PRINCIPAL — LEER METAS + DATOS ACTUALES
// ============================================================================

export async function getMetasAction(): Promise<{ success: boolean; data?: MetasData; message?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, message: 'No autorizado' };

    const config = await getMetasConfig();
    const role = session.role;
    const canEdit = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'].includes(role);

    // Rangos Caracas (UTC-4)
    const { start: todayStart, end: todayEnd } = getCaracasDayRange();
    const { year: _cy, month: _cm, day: _cd } = getCaracasNowParts();

    // Semana: lunes a domingo (basado en día Caracas)
    const caracasDayRef = new Date(Date.UTC(_cy, _cm, _cd));
    const dayOfWeek = caracasDayRef.getUTCDay(); // 0=Dom, 1=Lun...
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(todayStart.getTime() - daysFromMonday * 86400000);

    // Mes actual en Caracas
    const monthStart = new Date(Date.UTC(_cy, _cm, 1, 4, 0, 0, 0));

    const [todayAgg, weekAgg, monthAgg, wasteAgg] = await Promise.all([
      prisma.salesOrder.aggregate({
        where: { createdAt: { gte: todayStart, lte: todayEnd }, status: { not: 'CANCELLED' }, customerName: { not: 'PROPINA COLECTIVA' } },
        _sum: { total: true },
        _count: { id: true },
      }),
      prisma.salesOrder.aggregate({
        where: { createdAt: { gte: weekStart }, status: { not: 'CANCELLED' }, customerName: { not: 'PROPINA COLECTIVA' } },
        _sum: { total: true },
        _count: { id: true },
      }),
      prisma.salesOrder.aggregate({
        where: { createdAt: { gte: monthStart }, status: { not: 'CANCELLED' }, customerName: { not: 'PROPINA COLECTIVA' } },
        _sum: { total: true },
        _count: { id: true },
      }),
      // Merma del mes: movimientos tipo WASTE o ADJUSTMENT_OUT con totalCost
      prisma.inventoryMovement.aggregate({
        where: {
          movementType: { in: ['WASTE', 'ADJUSTMENT_OUT', 'ADJUSTMENT'] },
          quantity: { lt: 0 }, // solo salidas (negativas)
          createdAt: { gte: monthStart },
        },
        _sum: { totalCost: true },
      }),
    ]);

    const todayRevenue  = Number(todayAgg._sum.total  || 0);
    const weekRevenue   = Number(weekAgg._sum.total   || 0);
    const monthRevenue  = Number(monthAgg._sum.total  || 0);
    const wasteThisMonth = Math.abs(Number(wasteAgg._sum.totalCost || 0));

    // Proyección: fracción del día transcurrida en Venezuela (UTC-4)
    const _now = new Date();
    const caracasHour = (_now.getUTCHours() - 4 + 24) % 24;
    const caracasMin  = _now.getUTCMinutes();
    const minutesPassed = caracasHour * 60 + caracasMin;
    // Solo proyectar en horario operativo (06:00–23:59)
    const operativeStart = 6 * 60; // 6 AM
    const operativeTotal = 18 * 60; // 18 horas de operación (6am–midnight)
    const operativeElapsed = Math.max(0, minutesPassed - operativeStart);
    const fractionElapsed = Math.min(1, operativeElapsed / operativeTotal);

    const dailyProjected = fractionElapsed > 0.05
      ? Math.round(todayRevenue / fractionElapsed)
      : todayRevenue; // muy temprano — no proyectar

    return {
      success: true,
      data: {
        config,
        actual: {
          today:        todayRevenue,
          todayOrders:  todayAgg._count.id,
          week:         weekRevenue,
          weekOrders:   weekAgg._count.id,
          month:        monthRevenue,
          monthOrders:  monthAgg._count.id,
          wasteThisMonth,
        },
        progress: {
          daily:   config.daily   > 0 ? Math.round((todayRevenue  / config.daily)   * 100) : 0,
          weekly:  config.weekly  > 0 ? Math.round((weekRevenue   / config.weekly)  * 100) : 0,
          monthly: config.monthly > 0 ? Math.round((monthRevenue  / config.monthly) * 100) : 0,
        },
        projection: {
          dailyProjected,
          willHitDaily: dailyProjected >= config.daily,
        },
        role,
        canEdit,
      },
    };
  } catch (error) {
    console.error('[metas] getMetasAction error:', error);
    return { success: false, message: 'Error al cargar los objetivos' };
  }
}

// ============================================================================
// GUARDAR CONFIGURACIÓN DE METAS (solo admin)
// ============================================================================

export async function saveMetasAction(input: Partial<MetasConfig>): Promise<{ success: boolean; message: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, message: 'No autorizado' };
    if (!['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'].includes(session.role)) {
      return { success: false, message: 'Solo gerentes pueden cambiar las metas' };
    }

    const current = await getMetasConfig();
    const updated: MetasConfig = {
      daily:        Number(input.daily        ?? current.daily),
      weekly:       Number(input.weekly       ?? current.weekly),
      monthly:      Number(input.monthly      ?? current.monthly),
      wastePercent: Number(input.wastePercent ?? current.wastePercent),
    };

    if (updated.daily    < 0) return { success: false, message: 'La meta diaria no puede ser negativa' };
    if (updated.weekly   < 0) return { success: false, message: 'La meta semanal no puede ser negativa' };
    if (updated.monthly  < 0) return { success: false, message: 'La meta mensual no puede ser negativa' };
    if (updated.wastePercent < 0 || updated.wastePercent > 100) {
      return { success: false, message: 'El % de merma debe estar entre 0 y 100' };
    }

    await prisma.systemConfig.upsert({
      where:  { key: METAS_CONFIG_KEY },
      create: { key: METAS_CONFIG_KEY, value: JSON.stringify(updated), updatedBy: session.id },
      update: { value: JSON.stringify(updated), updatedBy: session.id },
    });

    revalidatePath('/dashboard/metas');
    return { success: true, message: 'Metas actualizadas correctamente' };
  } catch (error) {
    console.error('[metas] saveMetasAction error:', error);
    return { success: false, message: 'Error al guardar las metas' };
  }
}
