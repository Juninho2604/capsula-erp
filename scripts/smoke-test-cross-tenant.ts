/**
 * smoke-test-cross-tenant.ts
 * --------------------------
 * Smoke test E2E del aislamiento multi-tenant. Toma un user de un tenant
 * ATACANTE, firma una cookie de sesión válida con el JWT secret real, e
 * intenta varios accesos cross-tenant contra otro tenant VÍCTIMA. Cada
 * ataque debe ser rechazado (redirect a login, 401, 404, o respuesta
 * con datos del ATACANTE en vez del víctima).
 *
 * NO modifica BD ni hace requests destructivos. Es read-only intent —
 * cualquier escritura que el código no detenga sería un bug que el script
 * reportaría como FAIL.
 *
 * Uso (en el VPS, como root):
 *   set -a && source /var/www/capsula-erp/.env && set +a
 *   npx tsx scripts/smoke-test-cross-tenant.ts \
 *     --attacker-email=delia@kpsula.app \
 *     --victim-host=shanklish.kpsula.app
 *
 * El attacker-email debe existir en BD. Se toma su userId, tenantId, role
 * y se firma la sesión con esos campos. NO loguea al user de verdad — solo
 * usa sus datos para generar la cookie firmada.
 *
 * Salida:
 *   - Lista de ataques con [PASS]/[FAIL]
 *   - Exit code 0 si TODOS pasan, 1 si alguno falla.
 */

import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';

// ─── Args ───────────────────────────────────────────────────────────────────

interface Args {
    attackerEmail: string;
    victimHost: string;
}

function parseArgs(): Args {
    const map: Record<string, string> = {};
    for (const arg of process.argv.slice(2)) {
        if (!arg.startsWith('--')) continue;
        const [k, ...rest] = arg.slice(2).split('=');
        map[k] = rest.join('=');
    }
    const attackerEmail = map['attacker-email'];
    const victimHost = map['victim-host'];
    if (!attackerEmail || !victimHost) {
        console.error('ABORT: faltan --attacker-email=... --victim-host=...');
        process.exit(1);
    }
    return { attackerEmail, victimHost };
}

// ─── JWT signing (mismo formato que src/lib/auth.ts) ────────────────────────

function getSecretKey(): Uint8Array {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 16) {
        console.error('ABORT: JWT_SECRET no está seteado o es muy corto.');
        console.error('Ejecutar primero: set -a && source /var/www/capsula-erp/.env && set +a');
        process.exit(1);
    }
    return new TextEncoder().encode(secret);
}

interface SessionPayload {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    tokenVersion?: number;
    tenantId?: string;
    tenantSlug?: string;
}

async function signSession(payload: SessionPayload): Promise<string> {
    return new SignJWT(payload as any)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h') // corto, solo para este test
        .sign(getSecretKey());
}

// ─── Ataque individual ──────────────────────────────────────────────────────

interface AttackSpec {
    name: string;
    url: string;
    cookie?: string;
    /** Status codes considerados aceptables (= aislamiento OK) */
    expectStatus: number[];
    /** Si el body contiene cualquiera de estos strings, FALLA (data del víctima leaked) */
    bodyMustNotContain?: string[];
    /** Si redirect, la URL final debe contener uno de estos paths */
    redirectMustGoTo?: string[];
}

interface AttackResult {
    name: string;
    pass: boolean;
    detail: string;
}

async function runAttack(spec: AttackSpec): Promise<AttackResult> {
    try {
        const res = await fetch(spec.url, {
            headers: spec.cookie ? { Cookie: `session=${spec.cookie}` } : {},
            redirect: 'manual',
        });

        const statusOk = spec.expectStatus.includes(res.status);
        if (!statusOk) {
            return {
                name: spec.name,
                pass: false,
                detail: `status=${res.status} (esperaba ${spec.expectStatus.join('|')})`,
            };
        }

        // Si redirige, validar destino
        if ([301, 302, 303, 307, 308].includes(res.status) && spec.redirectMustGoTo) {
            const loc = res.headers.get('location') ?? '';
            const ok = spec.redirectMustGoTo.some(p => loc.includes(p));
            if (!ok) {
                return {
                    name: spec.name,
                    pass: false,
                    detail: `redirect a "${loc}" (esperaba uno de ${spec.redirectMustGoTo.join(',')})`,
                };
            }
            return { name: spec.name, pass: true, detail: `${res.status} → ${loc}` };
        }

        // Si la respuesta es OK (200), validar que NO leakee data del víctima
        if (spec.bodyMustNotContain && res.status === 200) {
            const body = await res.text();
            for (const forbidden of spec.bodyMustNotContain) {
                if (body.includes(forbidden)) {
                    return {
                        name: spec.name,
                        pass: false,
                        detail: `body contiene "${forbidden}" (data leak)`,
                    };
                }
            }
        }

        return { name: spec.name, pass: true, detail: `status=${res.status}` };
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { name: spec.name, pass: false, detail: `excepción: ${msg}` };
    }
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
    const args = parseArgs();
    const prisma = new PrismaClient();

    console.log('======================================================');
    console.log(' Smoke test multi-tenant — cross-tenant attacks');
    console.log('======================================================');
    console.log(`  Atacante:  ${args.attackerEmail}`);
    console.log(`  Víctima:   ${args.victimHost}`);
    console.log('');

    // 1. Lookup del attacker user
    const attacker = await prisma.user.findFirst({
        where: { email: { equals: args.attackerEmail, mode: 'insensitive' } },
        include: { tenant: { select: { slug: true, id: true } } },
    });
    if (!attacker) {
        console.error(`ABORT: user ${args.attackerEmail} no existe en BD.`);
        process.exit(1);
    }
    if (!attacker.tenant) {
        console.error(`ABORT: user ${args.attackerEmail} no tiene tenant asociado.`);
        process.exit(1);
    }
    console.log(`Atacante resuelto:`);
    console.log(`  userId:      ${attacker.id}`);
    console.log(`  tenantId:    ${attacker.tenantId}`);
    console.log(`  tenantSlug:  ${attacker.tenant.slug}`);
    console.log(`  role:        ${attacker.role}`);
    console.log('');

    // 2. Lookup tenant víctima por slug derivado del host
    const victimSlug = args.victimHost.split('.')[0];
    const victim = await prisma.tenant.findUnique({
        where: { slug: victimSlug },
        select: { id: true, slug: true, name: true },
    });
    if (!victim) {
        console.error(`ABORT: tenant víctima con slug "${victimSlug}" no existe.`);
        process.exit(1);
    }
    if (victim.id === attacker.tenantId) {
        console.error(`ABORT: atacante y víctima son el mismo tenant. No tiene sentido el test.`);
        process.exit(1);
    }
    console.log(`Víctima resuelta:`);
    console.log(`  tenantId:    ${victim.id}`);
    console.log(`  slug:        ${victim.slug}`);
    console.log(`  name:        ${victim.name}`);
    console.log('');

    // 3. Firmar cookie del atacante
    const cookie = await signSession({
        id: attacker.id,
        email: attacker.email,
        firstName: attacker.firstName,
        lastName: attacker.lastName,
        role: attacker.role,
        tokenVersion: attacker.tokenVersion,
        tenantId: attacker.tenantId ?? undefined,
        tenantSlug: attacker.tenant.slug ?? undefined,
    });
    console.log(`Cookie firmada (${cookie.length} chars). Iniciando ataques...`);
    console.log('');

    // 4. Definir ataques
    const victimHostBase = `https://${args.victimHost}`;
    const attackerHostBase = `https://${attacker.tenant.slug}.kpsula.app`;

    const attacks: AttackSpec[] = [
        {
            name: 'A1. Sin cookie: dashboard víctima → debe redirect a login',
            url: `${victimHostBase}/dashboard`,
            expectStatus: [307, 302, 303],
            redirectMustGoTo: ['/login'],
        },
        {
            name: 'A2. Cookie atacante: dashboard víctima → middleware debe patear',
            url: `${victimHostBase}/dashboard`,
            cookie,
            expectStatus: [307, 302, 303],
            redirectMustGoTo: ['/login'],
        },
        {
            name: 'A3. Cookie atacante: ruta profunda víctima (/dashboard/sales)',
            url: `${victimHostBase}/dashboard/sales`,
            cookie,
            expectStatus: [307, 302, 303],
            redirectMustGoTo: ['/login'],
        },
        {
            name: 'A4. Cookie atacante: /api/tenant/whoami víctima → no debe devolver tenant víctima',
            url: `${victimHostBase}/api/tenant/whoami`,
            cookie,
            // Acepta tanto redirect (middleware patea) o 200 con tenant del atacante (whoami devolvió lo suyo)
            expectStatus: [200, 307, 302, 303, 401, 403],
            bodyMustNotContain: [victim.id, victim.slug],
        },
        {
            name: 'A5. Cookie atacante: /api/files/<victim_tenant_id>/test.png',
            url: `${victimHostBase}/api/files/${victim.id}/test.png`,
            cookie,
            expectStatus: [401, 403, 404],
        },
        {
            name: 'A6. Sanity: cookie atacante en su PROPIO subdomain → debe funcionar',
            url: `${attackerHostBase}/api/tenant/whoami`,
            cookie,
            expectStatus: [200],
        },
        {
            name: 'A7. Cookie atacante: /api/debug/whoami (solo super admin) → debe rechazar',
            url: `${victimHostBase}/api/debug/whoami`,
            cookie,
            expectStatus: [401, 403, 307, 302, 303],
        },
    ];

    // 5. Ejecutar ataques
    const results: AttackResult[] = [];
    for (const spec of attacks) {
        const result = await runAttack(spec);
        results.push(result);
        const tag = result.pass ? '\x1b[32m[PASS]\x1b[0m' : '\x1b[31m[FAIL]\x1b[0m';
        console.log(`${tag} ${result.name}`);
        console.log(`        ${result.detail}`);
    }

    // 6. Resumen
    const passed = results.filter(r => r.pass).length;
    const failed = results.filter(r => !r.pass).length;
    console.log('');
    console.log('======================================================');
    console.log(` Resumen: ${passed} PASS / ${failed} FAIL`);
    console.log('======================================================');

    await prisma.$disconnect();
    process.exit(failed === 0 ? 0 : 1);
}

main().catch(err => {
    console.error('Error fatal:', err instanceof Error ? err.message : err);
    if (err instanceof Error && err.stack) console.error(err.stack);
    process.exit(1);
});
