/**
 * create-tenant.ts
 * ----------------
 * Crea un tenant nuevo en producción con su User OWNER + Branch MAIN en una
 * sola transacción atómica. Sin abrir signup público.
 *
 * Uso:
 *   npx tsx scripts/create-tenant.ts \
 *     --slug=tablepong \
 *     --name="Table Pong" \
 *     --owner-email=juan@tablepong.com \
 *     --owner-password='ContraseñaInicialSegura123' \
 *     --owner-first-name=Juan \
 *     --owner-last-name=Pérez
 *
 * Resultado en éxito:
 *   - Imprime tenant.id, login URL y avisos importantes.
 *   - Exit code 0.
 *
 * Resultado en fallo (slug existente, validación, FK, etc.):
 *   - Imprime el motivo en stderr.
 *   - NO toca nada (transacción se hace rollback).
 *   - Exit code 1.
 *
 * Convenciones:
 *   - Slug: regex `^[a-z0-9][a-z0-9-]{1,29}$` y NO debe estar en reserved list.
 *   - Email: debe matchear el regex estándar; no se permiten emails repetidos
 *     dentro del mismo tenant (compound unique tenantId+email lo asegura).
 *   - Password: mínimo 8 chars. Se hashea con PBKDF2-SHA256 (mismo formato que
 *     login normal).
 *   - Branch default: code="MAIN", name=tenant.name, timezone "America/Caracas",
 *     currency "USD".
 */

import { PrismaClient } from '@prisma/client';
import { webcrypto } from 'node:crypto';
import { isReservedSlug } from '../src/lib/signup/reserved-slugs';

// PBKDF2 idéntico al de src/lib/password.ts pero usando node:crypto subtle
// para no depender de window.crypto (este script corre en Node, no browser).
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEYLEN = 32;

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
        'raw',
        enc.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits'],
    );
    const salt = hexToUint8Array(saltHex);
    const hashBuf = await webcrypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
        keyMaterial,
        PBKDF2_KEYLEN * 8,
    );
    return uint8ArrayToHex(new Uint8Array(hashBuf));
}

async function hashPassword(password: string): Promise<string> {
    const saltBytes = webcrypto.getRandomValues(new Uint8Array(16));
    const saltHex = uint8ArrayToHex(saltBytes);
    const hashHex = await pbkdf2Hex(password, saltHex);
    return `${saltHex}:${hashHex}`;
}

// ─── Parse CLI args ─────────────────────────────────────────────────────────

interface Args {
    slug: string;
    name: string;
    ownerEmail: string;
    ownerPassword: string;
    ownerFirstName: string;
    ownerLastName: string;
    tenantId?: string; // opcional, se autogenera si no se pasa
}

function parseArgs(): Args {
    const args = process.argv.slice(2);
    const map: Record<string, string> = {};
    for (const arg of args) {
        if (!arg.startsWith('--')) continue;
        const [k, ...rest] = arg.slice(2).split('=');
        map[k] = rest.join('=');
    }
    const required = ['slug', 'name', 'owner-email', 'owner-password', 'owner-first-name', 'owner-last-name'];
    const missing = required.filter((r) => !map[r]);
    if (missing.length > 0) {
        console.error(`Faltan argumentos requeridos: ${missing.join(', ')}`);
        console.error('');
        console.error('Uso:');
        console.error('  npx tsx scripts/create-tenant.ts \\');
        console.error('    --slug=tablepong \\');
        console.error('    --name="Table Pong" \\');
        console.error('    --owner-email=juan@tablepong.com \\');
        console.error('    --owner-password=\'ContraseñaInicialSegura123\' \\');
        console.error('    --owner-first-name=Juan \\');
        console.error('    --owner-last-name=Pérez');
        process.exit(1);
    }
    return {
        slug: map['slug'].toLowerCase(),
        name: map['name'],
        ownerEmail: map['owner-email'].toLowerCase(),
        ownerPassword: map['owner-password'],
        ownerFirstName: map['owner-first-name'],
        ownerLastName: map['owner-last-name'],
        tenantId: map['tenant-id'],
    };
}

// ─── Validaciones de input ──────────────────────────────────────────────────

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,29}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(args: Args): string | null {
    if (!SLUG_RE.test(args.slug)) {
        return 'Slug inválido. Debe ser 2-30 chars, solo minúsculas, dígitos y guiones; empezar por letra/dígito.';
    }
    if (isReservedSlug(args.slug)) {
        return `Slug "${args.slug}" está reservado. Elegí otro (ver src/lib/signup/reserved-slugs.ts).`;
    }
    if (!EMAIL_RE.test(args.ownerEmail) || args.ownerEmail.length > 200) {
        return 'Email del owner inválido.';
    }
    if (args.ownerPassword.length < 8 || args.ownerPassword.length > 200) {
        return 'Password del owner debe tener entre 8 y 200 caracteres.';
    }
    if (args.ownerFirstName.trim().length < 1 || args.ownerFirstName.length > 50) {
        return 'firstName del owner inválido (1-50 chars).';
    }
    if (args.ownerLastName.trim().length < 1 || args.ownerLastName.length > 50) {
        return 'lastName del owner inválido (1-50 chars).';
    }
    if (args.name.trim().length < 2 || args.name.length > 100) {
        return 'name del negocio inválido (2-100 chars).';
    }
    return null;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    const args = parseArgs();

    const validationError = validate(args);
    if (validationError) {
        console.error(`Validación falló: ${validationError}`);
        process.exit(1);
    }

    const prisma = new PrismaClient();

    try {
        // Pre-check: slug no debe existir
        const existing = await prisma.tenant.findUnique({
            where: { slug: args.slug },
            select: { id: true, name: true },
        });
        if (existing) {
            console.error(`Slug "${args.slug}" ya existe (tenant: ${existing.name}, id: ${existing.id}). Abortando.`);
            process.exit(1);
        }

        // Pre-check: email + tenant del owner. Como el tenant es nuevo, basta con
        // verificar que el slug no choque. El compound unique (tenantId, email)
        // garantiza el resto.

        const passwordHash = await hashPassword(args.ownerPassword);

        const result = await prisma.$transaction(async (tx) => {
            const tenant = await tx.tenant.create({
                data: {
                    ...(args.tenantId ? { id: args.tenantId } : {}),
                    slug: args.slug,
                    name: args.name,
                },
                select: { id: true, slug: true, name: true },
            });

            const owner = await tx.user.create({
                data: {
                    tenantId: tenant.id,
                    email: args.ownerEmail,
                    passwordHash,
                    firstName: args.ownerFirstName.trim(),
                    lastName: args.ownerLastName.trim(),
                    role: 'OWNER',
                    isActive: true,
                },
                select: { id: true, email: true },
            });

            const branch = await tx.branch.create({
                data: {
                    tenantId: tenant.id,
                    code: 'MAIN',
                    name: args.name,
                    timezone: 'America/Caracas',
                    currencyCode: 'USD',
                    isActive: true,
                },
                select: { id: true, code: true },
            });

            return { tenant, owner, branch };
        });

        const TENANT_ROOT_DOMAIN = 'kpsula.app';
        const loginUrl = `https://${result.tenant.slug}.${TENANT_ROOT_DOMAIN}/login`;

        console.log('');
        console.log('===========================================');
        console.log(' Tenant creado exitosamente');
        console.log('===========================================');
        console.log(`  tenantId:  ${result.tenant.id}`);
        console.log(`  slug:      ${result.tenant.slug}`);
        console.log(`  name:      ${result.tenant.name}`);
        console.log(`  owner:     ${result.owner.email} (id: ${result.owner.id})`);
        console.log(`  branch:    ${result.branch.code} (id: ${result.branch.id})`);
        console.log('');
        console.log('  Login URL:');
        console.log(`    ${loginUrl}`);
        console.log('');
        console.log('  Próximos pasos:');
        console.log(`    1. Comparte la URL y credenciales con el owner.`);
        console.log(`    2. El owner DEBE cambiar su password al entrar.`);
        console.log(`    3. Configurar branches/áreas adicionales desde el dashboard.`);
        console.log('');

        process.exit(0);
    } catch (err) {
        console.error(`Falló la creación del tenant: ${err instanceof Error ? err.message : String(err)}`);
        if (err instanceof Error && err.stack) {
            console.error(err.stack.split('\n').slice(0, 5).join('\n'));
        }
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
