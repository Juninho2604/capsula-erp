import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n══════════════════════════════════════════');
    console.log('   DIAGNÓSTICO — WAITER PIN SETUP');
    console.log('══════════════════════════════════════════\n');

    // ── 1. Sucursales activas ─────────────────────────────────────────────────
    const branches = await prisma.branch.findMany({
        select: { id: true, name: true, code: true, isActive: true },
        orderBy: { isActive: 'desc' },
    });

    console.log(`📍 SUCURSALES (${branches.length} total)`);
    if (branches.length === 0) {
        console.log('   ⛔ NO HAY SUCURSALES EN LA BASE DE DATOS');
    } else {
        branches.forEach(b => {
            const status = b.isActive ? '✅ ACTIVA' : '❌ inactiva';
            console.log(`   ${status}  id=${b.id}  code=${b.code}  name="${b.name}"`);
        });
    }

    const activeBranch = branches.find(b => b.isActive);
    if (!activeBranch) {
        console.log('\n   ⛔ PROBLEMA CRÍTICO: Ninguna sucursal tiene isActive=true.');
        console.log('      validateWaiterPinAction fallará con "Sin sucursal activa".');
    }

    // ── 2. Mesoneros por sucursal ─────────────────────────────────────────────
    console.log('\n──────────────────────────────────────────');
    const waiters = await prisma.waiter.findMany({
        select: {
            id: true,
            firstName: true,
            lastName: true,
            isActive: true,
            isCaptain: true,
            pin: true,
            branchId: true,
        },
        orderBy: [{ isActive: 'desc' }, { firstName: 'asc' }],
    });

    console.log(`🧑‍🍳 MESONEROS (${waiters.length} total)`);

    if (waiters.length === 0) {
        console.log('   ⛔ NO HAY MESONEROS EN LA BASE DE DATOS.');
        console.log('      Crea mesoneros en /dashboard/mesoneros y asígnales un PIN.');
    } else {
        const withPin    = waiters.filter(w => w.pin !== null);
        const withoutPin = waiters.filter(w => w.pin === null);
        const active     = waiters.filter(w => w.isActive);
        const captains   = waiters.filter(w => w.isCaptain);

        console.log(`   Total: ${waiters.length}  |  Activos: ${active.length}  |  Con PIN: ${withPin.length}  |  Sin PIN: ${withoutPin.length}  |  Capitanes: ${captains.length}`);
        console.log('');

        waiters.forEach(w => {
            const pinStatus = w.pin === null
                ? '🔓 sin PIN'
                : w.pin.includes(':')
                    ? '🔒 PIN hashed (PBKDF2)'
                    : '⚠️  PIN TEXTO PLANO';
            const activeStr  = w.isActive  ? '✅' : '❌';
            const captainStr = w.isCaptain ? ' ⭐cap' : '';
            console.log(`   ${activeStr} ${w.firstName} ${w.lastName}${captainStr}  —  ${pinStatus}  (branchId=${w.branchId})`);
        });

        // ── Candidatos válidos para validateWaiterPinAction ──────────────────
        if (activeBranch) {
            const candidates = waiters.filter(
                w => w.branchId === activeBranch.id && w.isActive && w.pin !== null
            );
            console.log('');
            console.log(`   🎯 Candidatos para validateWaiterPinAction en sucursal activa "${activeBranch.name}":`);
            if (candidates.length === 0) {
                console.log('   ⛔ NINGUNO — El POS Mesero mostrará pantalla vacía / "sin mesoneros con PIN".');
            } else {
                candidates.forEach(w => {
                    const fmt = w.pin!.includes(':') ? 'PBKDF2' : 'PLAINTEXT';
                    console.log(`      ✅ ${w.firstName} ${w.lastName} (${fmt})`);
                });
            }
        }

        if (withoutPin.length > 0) {
            console.log('');
            console.log('   ⚠️  Mesoneros SIN PIN (no aparecerán en la pantalla de identificación):');
            withoutPin.forEach(w => console.log(`      • ${w.firstName} ${w.lastName} (activo=${w.isActive})`));
        }
    }

    // ── 3. Usuarios con acceso a pos_waiter ───────────────────────────────────
    console.log('\n──────────────────────────────────────────');
    const posWaiterRoles = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'WAITER', 'CASHIER', 'AREA_LEAD', 'JEFE_AREA'];
    const posUsers = await prisma.user.findMany({
        where: { role: { in: posWaiterRoles }, isActive: true },
        select: { firstName: true, lastName: true, email: true, role: true, allowedModules: true },
        orderBy: { firstName: 'asc' },
    });

    console.log(`👤 USUARIOS ACTIVOS CON ROL QUE PUEDE ACCEDER A pos_waiter (${posUsers.length})`);
    posUsers.forEach(u => {
        let modules = 'todos (por rol)';
        if (u.allowedModules) {
            try {
                const arr: string[] = JSON.parse(u.allowedModules);
                modules = arr.includes('pos_waiter') ? `restringido ✅ incluye pos_waiter` : `restringido ⛔ NO incluye pos_waiter → [${arr.join(', ')}]`;
            } catch { modules = 'JSON inválido'; }
        }
        console.log(`   ${u.firstName} ${u.lastName} (${u.role}) — ${u.email} — módulos: ${modules}`);
    });

    console.log('\n══════════════════════════════════════════\n');
}

main()
    .catch(e => { console.error('Error:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
