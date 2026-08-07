/**
 * tenant-access.ts (§147) — Acceso a un tenant: listar usuarios y asignar
 * contraseña nueva.
 *
 * Las contraseñas se guardan hasheadas con PBKDF2-SHA256 (un solo sentido):
 * NO se pueden leer, ni con acceso total al servidor. Este script permite
 * lo único posible — ver QUIÉN puede entrar y ASIGNAR una clave nueva.
 *
 * Uso:
 *   # 1) Listar los usuarios del tenant (solo lectura, no muestra claves)
 *   sudo bash -c 'cd /var/www/capsula-erp && \
 *     npx tsx scripts/tenant-access.ts --tenant-slug=tablepong'
 *
 *   # 2) Asignar una contraseña nueva a un usuario
 *   sudo bash -c 'cd /var/www/capsula-erp && \
 *     npx tsx scripts/tenant-access.ts --tenant-slug=tablepong \
 *       --email=juan@tablepong.com --set-password="LaQueVosElijas123"'
 *
 * La contraseña se pasa por parámetro y NO queda escrita en el código.
 * Al cambiarla se incrementa tokenVersion → las sesiones vivas de ESE
 * usuario se invalidan (tendrá que volver a entrar). Nadie más se ve
 * afectado.
 *
 * Nota de seguridad: el comando queda en el historial del shell. Para
 * borrarlo después:  history -d $(history 1)   (o `unset HISTFILE`).
 */

import { PrismaClient } from '@prisma/client';
import { webcrypto } from 'node:crypto';

/** PBKDF2-SHA256, formato "saltHex:hashHex" — idéntico a src/lib/password.ts */
async function hashPassword(password: string): Promise<string> {
    const salt = webcrypto.getRandomValues(new Uint8Array(16));
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
    const keyMaterial = await webcrypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        'PBKDF2',
        false,
        ['deriveBits'],
    );
    const hashBuf = await webcrypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
        keyMaterial,
        256,
    );
    const hashHex = Array.from(new Uint8Array(hashBuf))
        .map(b => b.toString(16).padStart(2, '0')).join('');
    return `${saltHex}:${hashHex}`;
}

async function main() {
    const args: Record<string, string> = {};
    for (const a of process.argv.slice(2)) {
        if (!a.startsWith('--')) continue;
        const [k, ...rest] = a.slice(2).split('=');
        args[k] = rest.length ? rest.join('=') : 'true';
    }

    const slug = args['tenant-slug'];
    if (!slug) {
        console.error('Falta --tenant-slug. Ejemplo: --tenant-slug=tablepong');
        process.exit(2);
    }
    const email = args['email'];
    const newPassword = args['set-password'];

    const prisma = new PrismaClient();
    try {
        const tenant = await prisma.tenant.findUnique({
            where: { slug },
            select: { id: true, name: true },
        });
        if (!tenant) {
            console.error(`Tenant "${slug}" no existe.`);
            const all = await prisma.tenant.findMany({ select: { slug: true, name: true } });
            console.error('Tenants disponibles:', all.map(t => t.slug).join(', ') || '(ninguno)');
            process.exit(2);
        }

        // ── Modo 2: asignar contraseña ──────────────────────────────────────
        if (newPassword) {
            if (!email) {
                console.error('Para asignar contraseña hace falta --email=<correo del usuario>');
                process.exit(2);
            }
            if (newPassword.length < 8) {
                console.error('La contraseña debe tener al menos 8 caracteres.');
                process.exit(2);
            }
            const user = await prisma.user.findFirst({
                where: { tenantId: tenant.id, email: { equals: email, mode: 'insensitive' } },
                select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true },
            });
            if (!user) {
                console.error(`No existe el usuario "${email}" en el tenant ${tenant.name}.`);
                console.error('Corré el script sin --set-password para ver la lista de usuarios.');
                process.exit(2);
            }

            const passwordHash = await hashPassword(newPassword);
            await prisma.user.update({
                where: { id: user.id },
                data: { passwordHash, tokenVersion: { increment: 1 } },
            });

            console.log(`\n✅ Contraseña actualizada.\n`);
            console.log(`   Tenant:  ${tenant.name} (${slug})`);
            console.log(`   Usuario: ${user.firstName} ${user.lastName} — ${user.email}`);
            console.log(`   Rol:     ${user.role}${user.isActive ? '' : '  ⚠ INACTIVO — no podrá entrar hasta activarlo'}`);
            console.log(`\n   Entrá con ese correo y la contraseña que acabás de definir.`);
            console.log(`   Las sesiones abiertas de este usuario quedaron cerradas.\n`);
            return;
        }

        // ── Modo 1: listar usuarios ─────────────────────────────────────────
        const users = await prisma.user.findMany({
            where: { tenantId: tenant.id },
            select: {
                email: true, firstName: true, lastName: true, role: true,
                isActive: true, passwordHash: true,
            },
            orderBy: [{ isActive: 'desc' }, { role: 'asc' }, { firstName: 'asc' }],
        });

        console.log(`\n═══ USUARIOS · ${tenant.name} (${slug}) ═══`);
        console.log('(las contraseñas están hasheadas — NO se pueden leer)\n');

        const pad = (s: string, n: number) => (s + ' '.repeat(n)).slice(0, n);
        console.log(pad('CORREO (usuario)', 34), pad('NOMBRE', 22), pad('ROL', 15), pad('ESTADO', 10), 'CLAVE');
        console.log('─'.repeat(96));
        for (const u of users) {
            const name = `${u.firstName} ${u.lastName}`.trim();
            const estado = u.isActive ? 'activo' : 'INACTIVO';
            const clave = u.passwordHash ? 'definida' : '❌ sin clave';
            console.log(pad(u.email, 34), pad(name, 22), pad(u.role, 15), pad(estado, 10), clave);
        }
        if (users.length === 0) console.log('  (el tenant no tiene usuarios)');

        console.log(`\nPara entrar, usá el CORREO como usuario.`);
        console.log(`Si no sabés la contraseña, asignale una nueva:\n`);
        console.log(`  npx tsx scripts/tenant-access.ts --tenant-slug=${slug} \\`);
        console.log(`    --email=<correo> --set-password="LaQueVosElijas123"\n`);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(e => { console.error(e); process.exit(1); });
