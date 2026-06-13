/**
 * seed-poke-pok.ts
 * ----------------
 * Provisiona el tenant "Poke Pok" para el piloto del módulo Gestión de
 * Deliverys. Idempotente: se puede correr varias veces sin duplicar.
 *
 * Crea / asegura:
 *   - Tenant slug "pokepok" con feature flag `deliveryOps: true`
 *   - Users: 1 owner + 1 gerente (gerente puede usarse como manager de sede)
 *   - DeliveryTenantConfig (prefijo PP, validación MANUAL)
 *   - 4 sedes (Branch + BranchDeliveryConfig + zonas):
 *       Santa Fe · El Hatillo · San Luis · Los Palos Grandes
 *
 * NO crea menú/inventario/ventas: el módulo delivery es aislado y el bot
 * provee las comandas como JSON libre.
 *
 * Uso (en el VPS, con el .env de producción cargado):
 *   set -a && source /var/www/capsula-erp/.env && set +a && \
 *   npx tsx scripts/seed-poke-pok.ts [--password=...] [--reset]
 *
 *   --password=...  password de los usuarios (default: kpsula-pokepok)
 *   --reset         borra el tenant pokepok si existe y lo crea de cero
 *
 * Las coordenadas de las sedes son las REALES de cada local (verificadas
 *    2026-06-13). La asignación por GPS (haversine) las usa para rutear cada
 *    pedido a la sede más cercana. Re-correr el seed SIN --reset actualiza
 *    lat/lon en la BD viva (el upsert hace update), sin tocar las órdenes.
 *
 * Requiere que las migraciones del módulo delivery ya estén aplicadas
 * (prisma migrate deploy) — el deploy del VPS las corre.
 */

import { PrismaClient } from '@prisma/client';
import { webcrypto } from 'node:crypto';

// ─── Args ───────────────────────────────────────────────────────────────────

function parseArgs() {
    const map: Record<string, string> = {};
    for (const arg of process.argv.slice(2)) {
        if (!arg.startsWith('--')) continue;
        const [k, ...rest] = arg.slice(2).split('=');
        map[k] = rest.length > 0 ? rest.join('=') : 'true';
    }
    return {
        password: map['password'] ?? 'kpsula-pokepok',
        reset: map['reset'] === 'true',
    };
}

// ─── Password hashing (PBKDF2-SHA256, mismo formato que el login) ────────────

function toHex(arr: Uint8Array): string {
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}
function fromHex(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return bytes;
}
async function pbkdf2Hex(password: string, saltHex: string): Promise<string> {
    const keyMaterial = await webcrypto.subtle.importKey(
        'raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveBits'],
    );
    const buf = await webcrypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: fromHex(saltHex), iterations: 100_000, hash: 'SHA-256' },
        keyMaterial, 256,
    );
    return toHex(new Uint8Array(buf));
}
async function hash(secret: string): Promise<string> {
    const saltHex = toHex(webcrypto.getRandomValues(new Uint8Array(16)));
    return `${saltHex}:${await pbkdf2Hex(secret, saltHex)}`;
}

// ─── Datos de las sedes (coords REALES de cada local, verificadas 2026-06-13) ─

const SEDES = [
    { code: 'SANTAFE', name: 'Santa Fe',          lat: 10.463427306423812, lon: -66.8656637240326,  zones: ['Santa Fe', 'Santa Mónica', 'Las Mercedes'] },
    { code: 'HATILLO', name: 'El Hatillo',         lat: 10.424992932764802, lon: -66.82567388098285, zones: ['El Hatillo', 'La Lagunita', 'Los Naranjos'] },
    { code: 'SANLUIS', name: 'San Luis',           lat: 10.4685,            lon: -66.8431,            zones: ['San Luis', 'El Cafetal', 'Macaracuay'] },
    { code: 'LPG',     name: 'Los Palos Grandes',  lat: 10.501165404781213, lon: -66.8444560039279,  zones: ['Los Palos Grandes', 'Altamira', 'Los Dos Caminos'] },
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    const args = parseArgs();
    const prisma = new PrismaClient();
    const SLUG = 'pokepok';

    console.log('======================================================');
    console.log(' Seed Poke Pok (módulo delivery)');
    console.log('======================================================');
    console.log(`  Slug:     ${SLUG}`);
    console.log(`  Password: ${args.password}`);
    console.log(`  Reset:    ${args.reset ? 'sí' : 'no'}`);
    console.log('');

    try {
        if (args.reset) {
            const ex = await prisma.tenant.findUnique({ where: { slug: SLUG }, select: { id: true } });
            if (ex) {
                console.log('Reset: borrando tenant pokepok existente…');
                // onDelete: Cascade en los modelos delivery + Restrict en algunos
                // core; borramos en orden seguro.
                await prisma.deliveryOrder.deleteMany({ where: { tenantId: ex.id } });
                await prisma.deliveryDriver.deleteMany({ where: { tenantId: ex.id } });
                await prisma.deliveryZone.deleteMany({ where: { tenantId: ex.id } });
                await prisma.branchDeliveryConfig.deleteMany({ where: { tenantId: ex.id } });
                await prisma.itemAvailability.deleteMany({ where: { tenantId: ex.id } });
                await prisma.managerNote.deleteMany({ where: { tenantId: ex.id } });
                await prisma.routingRule.deleteMany({ where: { tenantId: ex.id } });
                await prisma.deliveryWebhookOutbox.deleteMany({ where: { tenantId: ex.id } });
                await prisma.deliveryTenantConfig.deleteMany({ where: { tenantId: ex.id } });
                await prisma.branch.deleteMany({ where: { tenantId: ex.id } });
                await prisma.user.deleteMany({ where: { tenantId: ex.id } });
                await prisma.tenant.delete({ where: { id: ex.id } });
            }
        }

        // 1. Tenant + flag deliveryOps (merge con flags existentes).
        const existing = await prisma.tenant.findUnique({
            where: { slug: SLUG },
            select: { id: true, featureFlags: true },
        });
        const prevFlags = (existing?.featureFlags ?? {}) as Record<string, boolean>;
        const tenant = await prisma.tenant.upsert({
            where: { slug: SLUG },
            create: {
                slug: SLUG,
                name: 'Poke Pok',
                displayName: 'Poke Pok',
                featureFlags: { ...prevFlags, deliveryOps: true },
            },
            update: { featureFlags: { ...prevFlags, deliveryOps: true } },
            select: { id: true },
        });
        console.log(`✓ Tenant pokepok (id: ${tenant.id}) — deliveryOps: ON`);

        // 2. Users (upsert por tenantId+email).
        const passwordHash = await hash(args.password);
        const users = [
            { email: 'owner@pokepok.kpsula.app', firstName: 'Dueño',   lastName: 'Poke Pok', role: 'OWNER',         pin: '1234' },
            { email: 'admin@pokepok.kpsula.app', firstName: 'Gerente', lastName: 'Poke Pok', role: 'ADMIN_MANAGER', pin: '2345' },
        ];
        for (const u of users) {
            const pinHash = await hash(u.pin);
            await prisma.user.upsert({
                where: { tenantId_email: { tenantId: tenant.id, email: u.email } },
                create: {
                    tenantId: tenant.id,
                    email: u.email,
                    passwordHash,
                    firstName: u.firstName,
                    lastName: u.lastName,
                    role: u.role,
                    pin: pinHash,
                    isActive: true,
                },
                update: { passwordHash, role: u.role, isActive: true },
            });
            console.log(`✓ User ${u.email} (${u.role})`);
        }

        // 3. Config del tenant (prefijo PP, MANUAL).
        await prisma.deliveryTenantConfig.upsert({
            where: { tenantId: tenant.id },
            create: { tenantId: tenant.id, correlativePrefix: 'PP', validationMode: 'MANUAL' },
            update: {},
        });
        console.log('✓ DeliveryTenantConfig (PP, MANUAL)');

        // 4. Sedes: Branch + BranchDeliveryConfig + zonas.
        for (const s of SEDES) {
            const branch = await prisma.branch.upsert({
                where: { tenantId_code: { tenantId: tenant.id, code: s.code } },
                create: { tenantId: tenant.id, code: s.code, name: s.name },
                update: { name: s.name },
                select: { id: true },
            });
            await prisma.branchDeliveryConfig.upsert({
                where: { branchId: branch.id },
                create: { tenantId: tenant.id, branchId: branch.id, lat: s.lat, lon: s.lon, printerStation: `sede-${s.code.toLowerCase()}` },
                update: { lat: s.lat, lon: s.lon },
            });
            for (const zoneName of s.zones) {
                await prisma.deliveryZone.upsert({
                    where: { branchId_name: { branchId: branch.id, name: zoneName } },
                    create: { tenantId: tenant.id, branchId: branch.id, name: zoneName },
                    update: {},
                });
            }
            console.log(`✓ Sede ${s.name} (${s.code}) + ${s.zones.length} zonas`);
        }

        console.log('');
        console.log('======================================================');
        console.log(' Listo. Poke Pok provisionado.');
        console.log('======================================================');
        console.log(`  Login:  https://${SLUG}.kpsula.app/login`);
        console.log(`  Owner:  owner@pokepok.kpsula.app / ${args.password}`);
        console.log(`  Módulo: Administración → Gestión de Deliverys`);
        console.log('  Coords reales cargadas; verificá en /dashboard/delivery/sedes si hace falta');
        console.log('');
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(err => {
    console.error('Seed Poke Pok falló:', err);
    process.exit(1);
});
