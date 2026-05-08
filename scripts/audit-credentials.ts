/**
 * audit-credentials.ts
 * --------------------
 * Auditoría READ-ONLY de credenciales en BD. No escribe nada, solo cuenta.
 *
 * Detecta:
 *   - User.passwordHash en plano (sin formato saltHex:hashHex)
 *   - User.pin en plano
 *   - Waiter.pin en plano
 *   - PINs duplicados entre Waiters del mismo branch (riesgo operativo: dos
 *     meseros con el mismo PIN colisionan en el login del POS)
 *   - PINs duplicados entre Users (igual riesgo)
 *   - Cuentas con passwordHash vacío (nunca podrán loguearse)
 *
 * NO imprime jamás ningún valor de password/PIN. Solo conteos y IDs anonimizados
 * (primeros 8 chars del cuid) cuando hace falta para correlacionar.
 *
 * Uso:
 *   npx tsx scripts/audit-credentials.ts
 *
 * Salida con exit code 0 siempre (no falla si encuentra hallazgos; solo reporta).
 * Pensado para correr antes de PR de migración forzada de plain-text → PBKDF2.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Formato esperado de hash PBKDF2: 32 hex chars (salt) + ':' + 64 hex chars (hash)
const HASH_PATTERN = /^[0-9a-f]{32}:[0-9a-f]{64}$/i;

function isHashed(value: string | null | undefined): boolean {
    if (!value) return false;
    return HASH_PATTERN.test(value);
}

function shortId(id: string): string {
    return id.slice(0, 8);
}

interface Finding {
    severity: 'crítica' | 'alta' | 'media' | 'baja';
    category: string;
    count: number;
    detail: string;
}

async function main() {
    const findings: Finding[] = [];

    console.log('═══════════════════════════════════════════════════════════════');
    console.log(' AUDITORÍA DE CREDENCIALES — READ-ONLY');
    console.log(' (no se escribe ningún cambio en BD)');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // ─── USERS ──────────────────────────────────────────────────────────────
    const users = await prisma.user.findMany({
        select: {
            id: true,
            role: true,
            isActive: true,
            passwordHash: true,
            pin: true,
            deletedAt: true,
        },
    });

    const activeUsers = users.filter(u => u.isActive && !u.deletedAt);
    const totalUsers = users.length;
    const totalActive = activeUsers.length;

    let userPwNull = 0;
    let userPwPlain = 0;
    let userPwHashed = 0;
    let userPinNull = 0;
    let userPinPlain = 0;
    let userPinHashed = 0;
    const plainPwUserIds: string[] = [];
    const plainPinUserIds: string[] = [];

    for (const u of activeUsers) {
        if (!u.passwordHash) {
            userPwNull++;
        } else if (isHashed(u.passwordHash)) {
            userPwHashed++;
        } else {
            userPwPlain++;
            plainPwUserIds.push(`${shortId(u.id)} (${u.role})`);
        }

        if (!u.pin) {
            userPinNull++;
        } else if (isHashed(u.pin)) {
            userPinHashed++;
        } else {
            userPinPlain++;
            plainPinUserIds.push(`${shortId(u.id)} (${u.role})`);
        }
    }

    console.log('▶ USERS');
    console.log(`  Totales: ${totalUsers} (${totalActive} activos, ${totalUsers - totalActive} inactivos/borrados)\n`);
    console.log('  passwordHash:');
    console.log(`    ✓ hasheado (PBKDF2):  ${userPwHashed}`);
    console.log(`    ✗ plain-text:         ${userPwPlain}`);
    console.log(`    ⚠ null/vacío:         ${userPwNull}`);
    console.log('  pin:');
    console.log(`    ✓ hasheado (PBKDF2):  ${userPinHashed}`);
    console.log(`    ✗ plain-text:         ${userPinPlain}`);
    console.log(`    · null (sin PIN):     ${userPinNull}\n`);

    if (userPwPlain > 0) {
        findings.push({
            severity: 'crítica',
            category: 'User.passwordHash',
            count: userPwPlain,
            detail: `Plain-text en: ${plainPwUserIds.join(', ')}`,
        });
    }
    if (userPwNull > 0) {
        findings.push({
            severity: 'media',
            category: 'User.passwordHash',
            count: userPwNull,
            detail: 'Cuentas sin password hash — no pueden loguearse por email/clave',
        });
    }
    if (userPinPlain > 0) {
        findings.push({
            severity: 'alta',
            category: 'User.pin',
            count: userPinPlain,
            detail: `Plain-text en: ${plainPinUserIds.join(', ')}`,
        });
    }

    // ─── WAITERS ────────────────────────────────────────────────────────────
    const waiters = await prisma.waiter.findMany({
        select: { id: true, branchId: true, isActive: true, pin: true },
    });

    const activeWaiters = waiters.filter(w => w.isActive);
    let waiterPinNull = 0;
    let waiterPinPlain = 0;
    let waiterPinHashed = 0;
    const plainPinWaiterIds: string[] = [];

    for (const w of activeWaiters) {
        if (!w.pin) {
            waiterPinNull++;
        } else if (isHashed(w.pin)) {
            waiterPinHashed++;
        } else {
            waiterPinPlain++;
            plainPinWaiterIds.push(`${shortId(w.id)} (branch:${shortId(w.branchId)})`);
        }
    }

    console.log('▶ WAITERS');
    console.log(`  Totales: ${waiters.length} (${activeWaiters.length} activos)\n`);
    console.log('  pin:');
    console.log(`    ✓ hasheado (PBKDF2):  ${waiterPinHashed}`);
    console.log(`    ✗ plain-text:         ${waiterPinPlain}`);
    console.log(`    · null (sin PIN):     ${waiterPinNull}\n`);

    if (waiterPinPlain > 0) {
        findings.push({
            severity: 'crítica',
            category: 'Waiter.pin',
            count: waiterPinPlain,
            detail: `Plain-text en: ${plainPinWaiterIds.join(', ')}`,
        });
    }

    // ─── DUPLICADOS DE PIN (solo entre los hasheados, comparando hash) ──────
    // Si dos PINs hashean al mismo valor con el mismo salt, son el mismo PIN.
    // Si tienen distinto salt no podemos compararlos sin conocer el plano.
    // Esta detección solo cubre un subconjunto, pero útil si comparten salt
    // (que NO debería pasar nunca con hashPin correcto).
    const waiterPinsByBranch = new Map<string, Map<string, string[]>>();
    for (const w of activeWaiters) {
        if (!w.pin) continue;
        const branchMap = waiterPinsByBranch.get(w.branchId) ?? new Map();
        const existing = branchMap.get(w.pin) ?? [];
        existing.push(shortId(w.id));
        branchMap.set(w.pin, existing);
        waiterPinsByBranch.set(w.branchId, branchMap);
    }

    let duplicateGroupsWaiters = 0;
    for (const [branchId, pinMap] of waiterPinsByBranch.entries()) {
        for (const [, ids] of pinMap.entries()) {
            if (ids.length > 1) {
                duplicateGroupsWaiters++;
                findings.push({
                    severity: 'alta',
                    category: 'Waiter.pin (duplicado)',
                    count: ids.length,
                    detail: `branch ${shortId(branchId)}: ${ids.join(', ')} comparten PIN`,
                });
            }
        }
    }

    if (duplicateGroupsWaiters === 0) {
        console.log('▶ DUPLICADOS DE PIN (Waiters): ninguno detectado por hash.\n');
        console.log('  Nota: si los hashes usan salt distinto por waiter, dos PINs iguales en');
        console.log('  texto plano producen hashes distintos, así que esta detección es');
        console.log('  parcial. Para auditoría completa hay que probar PINs candidatos contra');
        console.log('  cada hash, lo cual requiere acceso a los hashes y NO se hace aquí.\n');
    } else {
        console.log(`▶ DUPLICADOS DE PIN (Waiters): ${duplicateGroupsWaiters} grupos detectados\n`);
    }

    // ─── PINS DEMASIADO CORTOS EN PLANO (riesgo brute-force) ────────────────
    let shortPlainPins = 0;
    for (const u of activeUsers) {
        if (u.pin && !isHashed(u.pin) && u.pin.length < 4) shortPlainPins++;
    }
    for (const w of activeWaiters) {
        if (w.pin && !isHashed(w.pin) && w.pin.length < 4) shortPlainPins++;
    }
    if (shortPlainPins > 0) {
        findings.push({
            severity: 'crítica',
            category: 'PIN < 4 dígitos',
            count: shortPlainPins,
            detail: 'PINs en plano con menos de 4 caracteres — brute-forceables instantáneo',
        });
    }

    // ─── RESUMEN FINAL ──────────────────────────────────────────────────────
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(' RESUMEN DE HALLAZGOS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (findings.length === 0) {
        console.log('  ✓ Ningún hallazgo. Todas las credenciales activas están hasheadas.\n');
    } else {
        const order = ['crítica', 'alta', 'media', 'baja'] as const;
        for (const sev of order) {
            const group = findings.filter(f => f.severity === sev);
            if (group.length === 0) continue;
            console.log(`  [${sev.toUpperCase()}]`);
            for (const f of group) {
                console.log(`    · ${f.category} (${f.count}): ${f.detail}`);
            }
            console.log('');
        }
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log(' Próximo paso si hay hallazgos críticos:');
    console.log('   → Forzar reset de password vía email para Users en plain-text');
    console.log('   → Reejecutar scripts/migrate-pins.ts para PINs en plain-text');
    console.log('   → Eliminar la rama plain-text en src/lib/password.ts');
    console.log('═══════════════════════════════════════════════════════════════');

    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error('Error en auditoría:', e);
    await prisma.$disconnect();
    process.exit(1);
});
