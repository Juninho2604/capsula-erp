/**
 * Diagnóstico de promociones (read-only). Dice, para AHORA (hora Caracas), por
 * qué cada promo activa aplica o no — flag, día, horario, fechas y alcance.
 *
 * Uso (en el VPS, con DATABASE_URL de producción):
 *   npx tsx scripts/diagnose-promociones.ts
 *   npx tsx scripts/diagnose-promociones.ts --at=2026-06-11T18:30   # simular otra hora
 */
import { PrismaClient } from '@prisma/client';
import { promotionApplies, discountPerUnitFor, type PromotionRule } from '@/lib/promotions/engine';

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function parseNumArr(raw: string | null): number[] {
  try { const v = JSON.parse(raw ?? '[]'); return Array.isArray(v) ? v.map(Number).filter(Number.isFinite) : []; } catch { return []; }
}
function parseStrArr(raw: string | null): string[] {
  try { const v = JSON.parse(raw ?? '[]'); return Array.isArray(v) ? v.map(String) : []; } catch { return []; }
}
function caracasParts(at: Date) {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Caracas', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = fmt.formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const wmap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  let hour = parseInt(get('hour'), 10); if (hour === 24) hour = 0;
  return { weekday: wmap[get('weekday')] ?? 0, minutes: hour * 60 + parseInt(get('minute'), 10), ymd: `${get('year')}-${get('month')}-${get('day')}`, hhmm: `${get('hour')}:${get('minute')}` };
}

async function main() {
  const atArg = process.argv.find((a) => a.startsWith('--at='))?.split('=')[1];
  const now = atArg ? new Date(atArg) : new Date();
  const cp = caracasParts(now);
  const prisma = new PrismaClient();

  const slug = process.env.SEED_TENANT_SLUG;
  const tenant = slug ? await prisma.tenant.findUnique({ where: { slug } }) : await prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!tenant) throw new Error('Tenant no encontrado');

  const flags = (tenant.featureFlags ?? {}) as Record<string, boolean>;
  const flagOn = !!flags.promotionsEnabled;
  console.log(`\nTenant: ${tenant.name} (${tenant.slug})`);
  console.log(`Hora evaluada (Caracas): ${cp.ymd} ${cp.hhmm} · ${DAYS[cp.weekday]}`);
  console.log(`Interruptor maestro 'promotionsEnabled': ${flagOn ? '✅ PRENDIDO' : '❌ APAGADO → ninguna promo aplica en el POS'}`);

  const promos = await prisma.promotion.findMany({ where: { deletedAt: null }, orderBy: { priority: 'desc' } });
  const active = promos.filter((p) => p.isActive);
  console.log(`\nPromociones: ${promos.length} totales · ${active.length} activas\n`);

  const items = await prisma.menuItem.findMany({ where: { isActive: true, deletedAt: null, tenantId: tenant.id }, select: { id: true, name: true, price: true, categoryId: true } });

  for (const p of promos) {
    const rule: PromotionRule = {
      id: p.id, name: p.name, discountType: p.discountType === 'FIXED' ? 'FIXED' : 'PERCENT',
      discountValue: p.discountValue, maxDiscountPerUnit: p.maxDiscountPerUnit,
      applicableCategoryIds: parseStrArr(p.applicableCategoryIds), applicableItemIds: parseStrArr(p.applicableItemIds),
      daysOfWeek: parseNumArr(p.daysOfWeek), startTime: p.startTime, endTime: p.endTime,
      startDate: p.startDate, endDate: p.endDate, priority: p.priority, isActive: p.isActive,
    };

    const reasons: string[] = [];
    if (!p.isActive) reasons.push('promo INACTIVA (toggle apagado)');
    if (rule.daysOfWeek.length > 0 && !rule.daysOfWeek.includes(cp.weekday)) reasons.push(`hoy es ${DAYS[cp.weekday]} y la promo solo aplica ${rule.daysOfWeek.map((d) => DAYS[d]).join(',')}`);
    const inTime = !rule.startTime || !rule.endTime || (() => { const s = parseInt(rule.startTime!.slice(0, 2)) * 60 + parseInt(rule.startTime!.slice(3)); const e = parseInt(rule.endTime!.slice(0, 2)) * 60 + parseInt(rule.endTime!.slice(3)); return s <= e ? cp.minutes >= s && cp.minutes <= e : cp.minutes >= s || cp.minutes <= e; })();
    if (!inTime) reasons.push(`fuera del horario ${rule.startTime}–${rule.endTime} (ahora ${cp.hhmm})`);
    if (rule.startDate && cp.ymd < caracasParts(rule.startDate).ymd) reasons.push(`aún no empieza (desde ${caracasParts(rule.startDate).ymd})`);
    if (rule.endDate && cp.ymd > caracasParts(rule.endDate).ymd) reasons.push(`ya terminó (hasta ${caracasParts(rule.endDate).ymd})`);

    const scope = rule.applicableCategoryIds.length === 0 && rule.applicableItemIds.length === 0
      ? 'TODO el menú'
      : `${rule.applicableItemIds.length} ítems + ${rule.applicableCategoryIds.length} categorías`;
    const matchItems = items.filter((it) => promotionApplies({ menuItemId: it.id, categoryId: it.categoryId ?? '', basePrice: it.price }, rule, now));

    console.log(`${reasons.length === 0 && flagOn && matchItems.length > 0 ? '✅' : '✗'} "${p.name}" · ${rule.discountType === 'PERCENT' ? rule.discountValue + '%' : '$' + rule.discountValue} · días:[${rule.daysOfWeek.map((d) => DAYS[d]).join(',') || 'todos'}] · horario:${rule.startTime || '00:00'}-${rule.endTime || '23:59'} · alcance:${scope}`);
    if (reasons.length) console.log(`    → NO aplica ahora: ${reasons.join(' · ')}`);
    else if (!flagOn) console.log('    → condiciones OK, pero el interruptor maestro está APAGADO');
    else if (matchItems.length === 0) console.log('    → condiciones de fecha/hora OK, pero NINGÚN ítem del menú está en el alcance (revisar categorías/ítems seleccionados)');
    else {
      const ex = matchItems.slice(0, 3).map((it) => `${it.name} $${it.price.toFixed(2)}→$${(it.price - discountPerUnitFor(rule, it.price)).toFixed(2)}`);
      console.log(`    → aplica a ${matchItems.length} ítem(s). Ej: ${ex.join(' · ')}`);
    }
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error('❌', e); process.exit(1); });
