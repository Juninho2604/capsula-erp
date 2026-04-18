/**
 * Seed: usuario mesonero para POS Mesero.
 * Rol CASHIER con allowedModules: ['pos_waiter'] — solo accede al módulo de mesero.
 *
 * Uso: npx ts-node --project tsconfig.json prisma/seed-mesonero-user.ts
 * O:   npx tsx prisma/seed-mesonero-user.ts
 */

import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';

const prisma = new PrismaClient();

function hashPasswordSync(password: string): string {
    const salt = randomBytes(16).toString('hex');
    const hash = createHash('sha256')
        .update(password + salt)
        .digest('hex');
    return `${salt}:${hash}`;
}

// Instancia/dominio configurable — ajustar según tenant
const INSTANCE = process.env.INSTANCE_DOMAIN ?? 'local';
const EMAIL = `mesonero@${INSTANCE}.com`;
const PASSWORD = process.env.MESONERO_PASSWORD ?? 'mesonero2024';

async function main() {
    console.log(`👤 Creando usuario mesonero: ${EMAIL}`);

    const existing = await prisma.user.findFirst({ where: { email: EMAIL } });
    if (existing) {
        console.log(`✅ Ya existe: ${existing.id}`);
        return;
    }

    // Generar hash PBKDF2 via password lib si está disponible, sino sha256 simple
    // En producción reemplazar con hashPassword de @/lib/password
    const passwordHash = hashPasswordSync(PASSWORD);

    const user = await prisma.user.create({
        data: {
            email: EMAIL,
            passwordHash,
            firstName: 'Mesonero',
            lastName: 'POS',
            role: 'CASHIER',
            allowedModules: JSON.stringify(['pos_waiter']),
            isActive: true,
        },
    });

    console.log(`✅ Usuario mesonero creado: ${user.id}`);
    console.log(`   Email:    ${EMAIL}`);
    console.log(`   Password: ${PASSWORD}`);
    console.log(`   Módulos:  pos_waiter`);
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
