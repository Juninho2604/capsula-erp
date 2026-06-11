/**
 * Diagnóstico de PIN de autorización (read-only, NO escribe nada).
 *
 * Uso (en el VPS, con DATABASE_URL de producción):
 *   npx tsx scripts/diagnose-pin.ts            # lista quién tiene PIN configurado
 *   npx tsx scripts/diagnose-pin.ts 1234       # además prueba si ese PIN valida
 *
 * Replica EXACTAMENTE la verificación del POS (PBKDF2 "saltHex:hashHex" +
 * fallback texto plano). Para cada usuario/mesonero con PIN dice:
 *   - si el PIN persistió (pinSet) · rol · activo · tenant
 *   - con qué PIN coincide el que pruebes y en qué POOL de autorización entra:
 *       MANAGER  → cortesías/pago/anular   (OWNER, ADMIN_MANAGER, OPS_MANAGER, AREA_LEAD)
 *       CAPTAIN  → anular (mesonero capitán de la sucursal)
 *       (otros roles con PIN: NO autorizan por diseño)
 */
import { PrismaClient } from '@prisma/client';

function hexToU8(hex: string) { const p = hex.match(/.{2}/g) ?? []; return new Uint8Array(p.map((b) => parseInt(b, 16))); }
function u8hex(b: Uint8Array) { return Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join(''); }
async function pbkdf2Hex(pin: string, saltHex: string) {
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const buf = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: hexToU8(saltHex), iterations: 100_000, hash: 'SHA-256' }, km, 256);
  return u8hex(new Uint8Array(buf));
}
async function verifyPin(pin: string, stored: string) {
  try {
    if (stored.includes(':')) {
      const i = stored.indexOf(':');
      const salt = stored.slice(0, i), hash = stored.slice(i + 1);
      if (!salt || !hash) return false;
      return (await pbkdf2Hex(pin, salt)) === hash;
    }
    return pin === stored;
  } catch { return false; }
}

const MANAGER_ROLES = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AREA_LEAD'];

async function main() {
  const candidate = process.argv[2]?.trim();
  const prisma = new PrismaClient();

  const users = await prisma.user.findMany({
    where: { pin: { not: null } },
    select: { id: true, firstName: true, lastName: true, role: true, isActive: true, pin: true, tenant: { select: { slug: true } } },
    orderBy: [{ isActive: 'desc' }, { role: 'asc' }],
  });
  const waiters = await prisma.waiter.findMany({
    where: { pin: { not: null } },
    select: { id: true, firstName: true, lastName: true, isActive: true, isCaptain: true, pin: true, branchId: true },
  });

  console.log(`\n══ USUARIOS con PIN configurado: ${users.length} ══`);
  for (const u of users) {
    const fmt = u.pin!.includes(':') ? 'hash ✓' : 'TEXTO PLANO ⚠';
    const authPool = MANAGER_ROLES.includes(u.role) ? 'autoriza (MANAGER)' : 'NO autoriza (rol sin permiso)';
    console.log(`  ${u.isActive ? '●' : '○'} ${u.firstName} ${u.lastName} · ${u.role} · ${u.isActive ? 'activo' : 'INACTIVO'} · tenant=${u.tenant?.slug ?? '?'} · ${fmt} · ${authPool}`);
  }
  console.log(`\n══ MESONEROS con PIN: ${waiters.length} ══`);
  for (const w of waiters) {
    const fmt = w.pin!.includes(':') ? 'hash ✓' : 'TEXTO PLANO ⚠';
    console.log(`  ${w.isActive ? '●' : '○'} ${w.firstName} ${w.lastName} · ${w.isCaptain ? 'CAPITÁN' : 'mesonero'} · ${w.isActive ? 'activo' : 'INACTIVO'} · sucursal=${w.branchId.slice(0, 8)} · ${fmt}`);
  }

  if (!candidate) {
    console.log('\n(Para probar un PIN: npx tsx scripts/diagnose-pin.ts <pin>)');
    await prisma.$disconnect(); return;
  }

  console.log(`\n══ PROBANDO PIN "${candidate}" ══`);
  let hits = 0;
  for (const u of users) {
    if (await verifyPin(candidate, u.pin!)) {
      hits++;
      const ok = MANAGER_ROLES.includes(u.role) && u.isActive;
      console.log(`  ✔ coincide con USUARIO ${u.firstName} ${u.lastName} (${u.role}, ${u.isActive ? 'activo' : 'INACTIVO'}) → ${ok ? '✅ PUEDE autorizar' : '❌ NO autoriza (rol sin permiso o inactivo)'}`);
    }
  }
  for (const w of waiters) {
    if (await verifyPin(candidate, w.pin!)) {
      hits++;
      const ok = w.isCaptain && w.isActive;
      console.log(`  ✔ coincide con MESONERO ${w.firstName} ${w.lastName} (${w.isCaptain ? 'capitán' : 'mesonero'}, ${w.isActive ? 'activo' : 'INACTIVO'}) → ${ok ? '✅ PUEDE autorizar anulaciones' : '❌ NO autoriza (no es capitán o inactivo)'}`);
    }
  }
  if (hits === 0) console.log('  ✗ NO coincide con NINGÚN usuario ni mesonero. → el PIN no quedó guardado, o lo tecleás distinto.');

  await prisma.$disconnect();
}
main().catch((e) => { console.error('❌', e); process.exit(1); });
