/**
 * Seed idempotente de cuentas bancarias + terminales (Tesorería Fase 0).
 *
 * NO se cablea al deploy. Correr a mano una sola vez:
 *   npx tsx prisma/seed-bank-accounts.ts
 *
 * Resuelve el tenant por env SEED_TENANT_SLUG, o el primero si hay uno solo.
 * Usa upsert por (tenantId, name) → re-ejecutar no duplica ni pisa cambios
 * manuales hechos desde la UI (solo crea lo que falte).
 *
 * Las comisiones (commissionPct) quedan en 0: se ajustan desde la UI o en la
 * Fase 1. El mapeo terminal→cuenta de PDV_SUPERFERRO/PDV_SHANKLISH es el único
 * inequívoco; el resto (MOVIL_NG, ZELLE…) se completa desde la UI.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// currency: BS | USD · kind: BANK | CASH | DIGITAL
const ACCOUNTS: Array<{
  name: string; bankName?: string; currency: string; kind: string; sortOrder: number;
}> = [
  { name: 'PROVINCIAL NOUR', bankName: 'Banco Provincial', currency: 'BS', kind: 'BANK', sortOrder: 10 },
  { name: 'SUPERFERRO', bankName: 'Banco Provincial', currency: 'BS', kind: 'BANK', sortOrder: 20 },
  { name: 'SHANKLISH', bankName: 'Banco Provincial', currency: 'BS', kind: 'BANK', sortOrder: 30 },
  { name: 'CANUR', bankName: 'Banco Provincial', currency: 'BS', kind: 'BANK', sortOrder: 40 },
  { name: 'PITACHEF', bankName: 'Banco Provincial', currency: 'BS', kind: 'BANK', sortOrder: 50 },
  { name: 'BOFA', bankName: 'Bank of America', currency: 'USD', kind: 'BANK', sortOrder: 60 },
  // Cajas / billeteras virtuales (para etiquetar gastos/pagos en efectivo o Zelle)
  { name: 'CASH USD', currency: 'USD', kind: 'CASH', sortOrder: 70 },
  { name: 'CASH BS', currency: 'BS', kind: 'CASH', sortOrder: 80 },
  { name: 'ZELLE', currency: 'USD', kind: 'DIGITAL', sortOrder: 90 },
];

// Terminales inequívocos (posMethodKey → cuenta). El resto desde la UI.
const TERMINALS: Array<{ label: string; account: string; posMethodKey: string }> = [
  { label: 'PDV Superferro', account: 'SUPERFERRO', posMethodKey: 'PDV_SUPERFERRO' },
  { label: 'PDV Shanklish', account: 'SHANKLISH', posMethodKey: 'PDV_SHANKLISH' },
];

async function main() {
  const slug = process.env.SEED_TENANT_SLUG;
  const tenant = slug
    ? await prisma.tenant.findUnique({ where: { slug } })
    : await prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } });

  if (!tenant) {
    throw new Error(
      slug ? `No existe tenant con slug "${slug}"` : 'No se encontró ningún tenant'
    );
  }
  console.log(`🏦 Sembrando cuentas para tenant: ${tenant.name} (${tenant.slug})`);

  for (const a of ACCOUNTS) {
    const acc = await prisma.bankAccount.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: a.name } },
      update: {}, // no pisa cambios manuales
      create: {
        tenantId: tenant.id,
        name: a.name,
        bankName: a.bankName ?? null,
        currency: a.currency,
        kind: a.kind,
        sortOrder: a.sortOrder,
      },
    });
    console.log(`  ✓ ${acc.name} (${acc.currency})`);
  }

  for (const t of TERMINALS) {
    const account = await prisma.bankAccount.findUnique({
      where: { tenantId_name: { tenantId: tenant.id, name: t.account } },
    });
    if (!account) { console.warn(`  ! cuenta ${t.account} no encontrada, omito ${t.label}`); continue; }
    await prisma.posTerminal.upsert({
      where: { tenantId_label: { tenantId: tenant.id, label: t.label } },
      update: {},
      create: {
        tenantId: tenant.id,
        label: t.label,
        posMethodKey: t.posMethodKey,
        commissionPct: 0,
        bankAccountId: account.id,
      },
    });
    console.log(`  ✓ terminal ${t.label} → ${t.account} (${t.posMethodKey})`);
  }

  console.log('✅ Seed de cuentas bancarias completo.');
}

main()
  .catch((e) => { console.error('❌ Seed falló:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
