/**
 * audit-pins.ts (§132) — Estado de PINs y roles de los usuarios. SOLO LECTURA.
 *
 * No revela ni compara PINs (están hasheados con sal). Muestra, por usuario:
 * rol, si el rol AUTORIZA con PIN de gerente, y si tiene PIN asignado. Sirve
 * para ver por qué "los gerentes usan el PIN de Omar" (rol no-gerente o PIN
 * sin asignar).
 *
 * Uso: npx tsx scripts/audit-pins.ts --tenant-slug=shanklish
 */

import { PrismaClient } from '@prisma/client';

// Roles que validateManagerPinAction acepta para autorizar (anulaciones, etc.).
const MANAGER_ROLES = new Set(['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER']);

async function main() {
    const args: Record<string, string> = {};
    for (const a of process.argv.slice(2)) {
        if (!a.startsWith('--')) continue;
        const [k, ...rest] = a.slice(2).split('=');
        args[k] = rest.length ? rest.join('=') : 'true';
    }
    const slug = args['tenant-slug'] || 'shanklish';

    const prisma = new PrismaClient();
    try {
        const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true, name: true } });
        if (!tenant) { console.error(`Tenant "${slug}" no existe`); process.exit(2); }

        console.log(`\n═══ AUDITORÍA DE PINES · ${tenant.name} ═══ (solo lectura, no muestra PINs)\n`);

        const users = await prisma.user.findMany({
            where: { tenantId: tenant.id },
            select: { firstName: true, lastName: true, role: true, isActive: true, pin: true },
            orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
        });

        const pad = (s: string, n: number) => (s + ' '.repeat(n)).slice(0, n);
        console.log(pad('NOMBRE', 24), pad('ROL', 16), pad('¿AUTORIZA?', 12), 'PIN');
        console.log('─'.repeat(66));
        for (const u of users) {
            if (!u.isActive) continue;
            const name = `${u.firstName} ${u.lastName}`.trim();
            const autoriza = MANAGER_ROLES.has(u.role) ? 'SÍ (gerente)' : 'no';
            const pinState = u.pin ? '✅ asignado' : '❌ sin PIN';
            console.log(pad(name, 24), pad(u.role, 16), pad(autoriza, 12), pinState);
        }

        console.log('\nNotas:');
        console.log('  • "¿AUTORIZA?" = SÍ solo si el rol es OWNER/ADMIN_MANAGER/OPS_MANAGER.');
        console.log('    Un gerente con rol distinto NO podrá autorizar aunque tenga PIN.');
        console.log('  • Si David/Mauricio salen "sin PIN" → asígnales uno en Usuarios.');
        console.log('  • Si salen "no" en ¿AUTORIZA? → primero cámbiales el rol a gerente.');
        console.log('  • Tras §132 el sistema RECHAZA asignar un PIN repetido (con aviso).');
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((e) => { console.error(e); process.exit(1); });
