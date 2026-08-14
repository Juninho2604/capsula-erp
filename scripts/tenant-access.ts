/**
 * tenant-access.ts (§147) — Acceso a un tenant: listar usuarios, asignar
 * contraseña y asignar PIN del POS.
 *
 * Contraseñas y PINs se guardan hasheados con PBKDF2-SHA256 (un solo
 * sentido): NO se pueden leer, ni con acceso total al servidor. Este script
 * permite lo único posible — ver QUIÉN puede entrar y ASIGNAR credenciales
 * nuevas.
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
 *   # 3) Asignar el PIN del POS (autorizar cobros, anulaciones, cortesías)
 *   sudo bash -c 'cd /var/www/capsula-erp && \
 *     npx tsx scripts/tenant-access.ts --tenant-slug=tablepong \
 *       --email=gerente1@kpsula.app --set-pin=4821'
 *
 *   # 4) DIAGNÓSTICO: ¿por qué el POS rechaza este PIN? (solo lectura)
 *   sudo bash -c 'cd /var/www/capsula-erp && \
 *     npx tsx scripts/tenant-access.ts --tenant-slug=tablepong --test-pin=4821'
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
// Fuente única (§153) — la misma lista que usa validateManagerPinAction.
import { CHARGE_AUTH_ROLES as MANAGER_ROLES } from '../src/lib/pin-roles';

const toHex = (bytes: Uint8Array) =>
    Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex: string) =>
    new Uint8Array((hex.match(/.{2}/g) ?? []).map(b => parseInt(b, 16)));

async function pbkdf2Hex(input: string, saltHex: string): Promise<string> {
    const keyMaterial = await webcrypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(input),
        'PBKDF2',
        false,
        ['deriveBits'],
    );
    const hashBuf = await webcrypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: fromHex(saltHex), iterations: 100_000, hash: 'SHA-256' },
        keyMaterial,
        256,
    );
    return toHex(new Uint8Array(hashBuf));
}

/**
 * PBKDF2-SHA256, formato "saltHex:hashHex" — idéntico a src/lib/password.ts
 * y al hashPin de user.actions.ts (el POS usa el mismo esquema para el PIN).
 */
async function hashSecret(secret: string): Promise<string> {
    const saltHex = toHex(webcrypto.getRandomValues(new Uint8Array(16)));
    return `${saltHex}:${await pbkdf2Hex(secret, saltHex)}`;
}

/** §132 — ¿el PIN crudo corresponde al guardado? (fallback legacy a texto plano) */
async function pinMatches(rawPin: string, stored: string): Promise<boolean> {
    try {
        if (stored.includes(':')) {
            const i = stored.indexOf(':');
            const saltHex = stored.slice(0, i);
            const storedHash = stored.slice(i + 1);
            if (!saltHex || !storedHash) return false;
            return (await pbkdf2Hex(rawPin, saltHex)) === storedHash;
        }
        return rawPin === stored;
    } catch { return false; }
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
    const newPin = args['set-pin'];

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

        // ── Modo 4: PROBAR un PIN (réplica exacta de validateManagerPinAction) ──
        if (args['test-pin']) {
            const pin = args['test-pin'].trim();
            console.log(`\n═══ DIAGNÓSTICO DE PIN · ${tenant.name} (${slug}) ═══\n`);
            console.log(`Probando el PIN tecleado contra TODOS los usuarios del tenant.`);
            console.log(`(el POS solo acepta ${MANAGER_ROLES.join(' / ')}, activos y con PIN)\n`);

            const all = await prisma.user.findMany({
                where: { tenantId: tenant.id },
                select: {
                    email: true, firstName: true, lastName: true,
                    role: true, isActive: true, pin: true,
                },
                orderBy: [{ role: 'asc' }, { email: 'asc' }],
            });

            let matchedBy: string | null = null;
            let matchedButRejected: string | null = null;

            for (const u of all) {
                const who = `${u.firstName} ${u.lastName} <${u.email}> [${u.role}]`;
                if (!u.pin) continue;
                if (await pinMatches(pin, u.pin)) {
                    const esCandidato = MANAGER_ROLES.includes(u.role) && u.isActive;
                    if (esCandidato) matchedBy = who;
                    else {
                        const motivo = !u.isActive ? 'usuario INACTIVO' : `rol ${u.role} NO autoriza`;
                        matchedButRejected = `${who} — ${motivo}`;
                    }
                }
            }

            // Panorama: quiénes PODRÍAN autorizar hoy.
            const candidatos = all.filter(u => MANAGER_ROLES.includes(u.role) && u.isActive && u.pin);
            console.log(`Usuarios que el POS aceptaría (rol OK + activo + con PIN): ${candidatos.length}`);
            for (const c of candidatos) {
                console.log(`   · ${c.firstName} ${c.lastName} <${c.email}> [${c.role}]`);
            }
            if (candidatos.length === 0) {
                console.log('   (ninguno — por eso NINGÚN PIN funciona en este tenant)');
                const sinPin = all.filter(u => MANAGER_ROLES.includes(u.role) && u.isActive && !u.pin);
                if (sinPin.length > 0) {
                    console.log('\n   Gerentes activos SIN PIN asignado:');
                    for (const u of sinPin) console.log(`   · ${u.firstName} ${u.lastName} <${u.email}> [${u.role}]`);
                }
            }

            console.log('\n── RESULTADO ──');
            if (matchedBy) {
                console.log(`✅ El PIN es VÁLIDO — autoriza como: ${matchedBy}`);
                console.log('   Si en el POS igual falla, el problema NO es el PIN:');
                console.log('   revisá que el POS esté apuntando a ESTE servidor/base.');
            } else if (matchedButRejected) {
                console.log(`⚠ El PIN existe pero el POS lo RECHAZA: ${matchedButRejected}`);
                console.log('   Corregí el rol (o activá el usuario) y volverá a funcionar.');
            } else {
                console.log('❌ Ese PIN no corresponde a NINGÚN usuario de este tenant.');
                console.log('   Se guardó en otro tenant, en otra base, o nunca se guardó.');
            }
            console.log('');
            return;
        }

        // ── Modo 3: asignar PIN del POS ─────────────────────────────────────
        if (newPin) {
            if (!email) {
                console.error('Para asignar PIN hace falta --email=<correo del usuario>');
                process.exit(2);
            }
            const pin = newPin.trim();
            if (!/^\d{4,6}$/.test(pin)) {
                console.error('El PIN debe ser de 4 a 6 dígitos (solo números).');
                process.exit(2);
            }
            const user = await prisma.user.findFirst({
                where: { tenantId: tenant.id, email: { equals: email, mode: 'insensitive' } },
                select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true },
            });
            if (!user) {
                console.error(`No existe el usuario "${email}" en el tenant ${tenant.name}.`);
                process.exit(2);
            }

            // §132 — unicidad: dos personas con el mismo PIN hacen imposible
            // saber quién autorizó. Se rechaza igual que en la UI.
            const others = await prisma.user.findMany({
                where: { tenantId: tenant.id, id: { not: user.id }, pin: { not: null } },
                select: { firstName: true, lastName: true, pin: true },
            });
            for (const o of others) {
                if (o.pin && (await pinMatches(pin, o.pin))) {
                    console.error(`\n❌ Ese PIN ya lo usa ${o.firstName} ${o.lastName}.`);
                    console.error('   Cada persona debe tener un PIN distinto — elegí otro.\n');
                    process.exit(2);
                }
            }

            await prisma.user.update({
                where: { id: user.id },
                data: { pin: await hashSecret(pin) },
            });

            console.log(`\n✅ PIN asignado.\n`);
            console.log(`   Tenant:  ${tenant.name} (${slug})`);
            console.log(`   Usuario: ${user.firstName} ${user.lastName} — ${user.email}`);
            console.log(`   Rol:     ${user.role}`);
            if (!user.isActive) {
                console.log(`\n   ⚠ El usuario está INACTIVO — el PIN no funcionará hasta activarlo.`);
            }
            if (!MANAGER_ROLES.includes(user.role)) {
                console.log(`\n   ⚠ ATENCIÓN: el rol ${user.role} NO autoriza en el POS.`);
                console.log(`      Solo ${MANAGER_ROLES.join(' / ')} pueden autorizar cobros,`);
                console.log(`      anulaciones y cortesías. El PIN quedó guardado, pero no servirá`);
                console.log(`      para autorizar hasta que le cambies el rol.`);
            } else {
                console.log(`\n   Ya puede autorizar cobros, anulaciones y cortesías con ese PIN.`);
            }
            console.log('');
            return;
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

            const passwordHash = await hashSecret(newPassword);
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
        console.log(`Para el PIN del POS (autorizar cobros/anulaciones/cortesías):\n`);
        console.log(`  npx tsx scripts/tenant-access.ts --tenant-slug=${slug} \\`);
        console.log(`    --email=<correo> --set-pin=4821\n`);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(e => { console.error(e); process.exit(1); });
