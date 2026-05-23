/**
 * reset-demo-password.ts
 * ----------------------
 * Resetea el password (y opcionalmente los PINs) de los 5 users del tenant
 * demo SIN borrar la data sintética (ventas, inventario, menú, mesas).
 *
 * Útil cuando querés rotar el password público sin pasar por --reset del
 * seed completo (que borra todo y recrea desde cero, perdiendo las ventas
 * sintéticas de los últimos 14 días).
 *
 * Uso:
 *   set -a && source /var/www/capsula-erp/.env && set +a && \
 *   npx tsx scripts/reset-demo-password.ts \
 *     [--slug=demo]      # default: demo
 *     [--dry-run]        # muestra qué haría sin tocar BD
 *     [--reset-pins]     # también resetea los PINs (default: solo password)
 *
 * La password está hardcoded en este script Y en
 * src/app/login/demo-credentials-card.tsx (DEMO_PASSWORD). Si cambia,
 * sincronizar ambos.
 */

import { PrismaClient } from '@prisma/client';
import { webcrypto } from 'node:crypto';

// ─── Args ───────────────────────────────────────────────────────────────────

interface Args {
    slug: string;
    dryRun: boolean;
    resetPins: boolean;
}

function parseArgs(): Args {
    const args = process.argv.slice(2);
    const map: Record<string, string> = {};
    for (const arg of args) {
        if (!arg.startsWith('--')) continue;
        const [k, ...rest] = arg.slice(2).split('=');
        map[k] = rest.length > 0 ? rest.join('=') : 'true';
    }
    return {
        slug: map['slug'] ?? 'demo',
        dryRun: map['dry-run'] === 'true',
        resetPins: map['reset-pins'] === 'true',
    };
}

// ─── Password hashing (PBKDF2-SHA256, mismo formato que login) ─────────────

function uint8ArrayToHex(arr: Uint8Array): string {
    return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToUint8Array(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return bytes;
}

async function pbkdf2Hex(password: string, saltHex: string): Promise<string> {
    const enc = new TextEncoder();
    const keyMaterial = await webcrypto.subtle.importKey(
        'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits'],
    );
    const salt = hexToUint8Array(saltHex);
    const hashBuf = await webcrypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
        keyMaterial, 256,
    );
    return uint8ArrayToHex(new Uint8Array(hashBuf));
}

async function hashSecret(secret: string): Promise<string> {
    const saltBytes = webcrypto.getRandomValues(new Uint8Array(16));
    const saltHex = uint8ArrayToHex(saltBytes);
    const hashHex = await pbkdf2Hex(secret, saltHex);
    return `${saltHex}:${hashHex}`;
}

// ─── Config ────────────────────────────────────────────────────────────────

const DEMO_PASSWORD = 'kpsula-demo';

const DEMO_USERS: { email: string; role: string; pin: string }[] = [
    { email: 'owner@demo.kpsula.app',  role: 'OWNER',         pin: '1234' },
    { email: 'admin@demo.kpsula.app',  role: 'ADMIN_MANAGER', pin: '2345' },
    { email: 'caja@demo.kpsula.app',   role: 'CASHIER',       pin: '3456' },
    { email: 'chef@demo.kpsula.app',   role: 'CHEF',          pin: '4567' },
    { email: 'mesero@demo.kpsula.app', role: 'WAITER',        pin: '5678' },
];

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
    const args = parseArgs();
    const prisma = new PrismaClient();

    console.log('======================================================');
    console.log(' Reset Demo Password');
    console.log('======================================================');
    console.log(`  Slug:         ${args.slug}`);
    console.log(`  Dry-run:      ${args.dryRun ? 'sí (no toca BD)' : 'NO (modifica BD)'}`);
    console.log(`  Reset PINs:   ${args.resetPins ? 'sí' : 'no (solo password)'}`);
    console.log(`  Password:     ${DEMO_PASSWORD}`);
    console.log('');

    try {
        const tenant = await prisma.tenant.findUnique({
            where: { slug: args.slug },
            select: { id: true, name: true },
        });
        if (!tenant) {
            console.error(`ABORT: tenant con slug "${args.slug}" no existe.`);
            process.exit(1);
        }

        console.log(`Tenant encontrado: ${tenant.name} (${tenant.id})`);
        console.log('');

        let updated = 0;
        let notFound = 0;

        for (const u of DEMO_USERS) {
            const existing = await prisma.user.findFirst({
                where: { tenantId: tenant.id, email: { equals: u.email, mode: 'insensitive' } },
                select: { id: true, email: true, role: true, isActive: true },
            });

            if (!existing) {
                console.log(`  ⚠ ${u.email} → NO encontrado en demo, skip`);
                notFound++;
                continue;
            }
            if (existing.role !== u.role) {
                console.log(`  ⚠ ${u.email} → role en BD (${existing.role}) ≠ esperado (${u.role}), skip por seguridad`);
                notFound++;
                continue;
            }

            if (args.dryRun) {
                console.log(`  ✓ ${u.email.padEnd(28)} [${u.role.padEnd(15)}] → password${args.resetPins ? ' + PIN' : ''} (dry-run)`);
                updated++;
                continue;
            }

            const passwordHash = await hashSecret(DEMO_PASSWORD);
            const data: { passwordHash: string; pin?: string; tokenVersion: { increment: number } } = {
                passwordHash,
                // Bumpea tokenVersion para invalidar JWTs activos del demo user.
                // Sin esto, sessions vivas seguirían funcionando con la
                // password vieja en la cookie. El bump fuerza relogin.
                tokenVersion: { increment: 1 },
            };
            if (args.resetPins) {
                data.pin = await hashSecret(u.pin);
            }

            await prisma.user.update({ where: { id: existing.id }, data });
            console.log(`  ✓ ${u.email.padEnd(28)} [${u.role.padEnd(15)}] → password${args.resetPins ? ' + PIN' : ''} actualizado`);
            updated++;
        }

        console.log('');
        console.log('======================================================');
        console.log(' Resumen');
        console.log('======================================================');
        console.log(`  Updated:    ${updated} / ${DEMO_USERS.length}`);
        console.log(`  Not found:  ${notFound}`);
        if (args.dryRun) {
            console.log('  ');
            console.log('  Dry-run completado. Para aplicar: re-ejecutar sin --dry-run.');
        } else if (updated > 0) {
            console.log('  ');
            console.log(`  Password actualizada en BD. Los users del demo deben loguear con:`);
            console.log(`    ${DEMO_PASSWORD}`);
            console.log('  ');
            console.log('  tokenVersion bumpeada → sesiones vivas serán invalidadas en el');
            console.log('  próximo request del middleware.');
        }
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((err) => {
    console.error('Error fatal:', err instanceof Error ? err.message : err);
    if (err instanceof Error && err.stack) console.error(err.stack);
    process.exit(1);
});
