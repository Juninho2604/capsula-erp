/**
 * seed-system.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Script de bootstrap del sistema CÁPSULA ERP.
 *
 * Qué hace:
 *   1. Activa TODOS los módulos en SystemConfig (key: 'enabled_modules')
 *   2. Upsert del usuario admin@capsulapp.com con:
 *        - role = OWNER
 *        - allowedModules = null  (acceso irrestricto)
 *        - isActive = true
 *        - password plain-text "capsula2024" (legacy-compatible)
 *   3. Configura tenant: business_name = "CAPSULA", tenant_plan = "ENTERPRISE"
 *
 * Ejecutar:
 *   npx tsx prisma/seed-system.ts
 *
 * Diagnóstico previo realizado:
 *   - Si allowedModules = "[]", getVisibleModules filtra TODO (Set vacío truthy)
 *   - Si enabled_modules = "[]", ningún módulo aparece habilitado
 *   - Si el rol es "ADMIN" (no "OWNER"/"ADMIN_MANAGER"), MODULE_ROLE_ACCESS no lo cubre
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { PrismaClient } from '@prisma/client';
import { MODULE_REGISTRY } from '../src/lib/constants/modules-registry';

const prisma = new PrismaClient();

// ── Contraseña legacy (sin ':' → verifyPassword lo trata como plain-text)
const ADMIN_PASSWORD_PLAIN = 'capsula2024';

// ── Todos los IDs del registro maestro
const ALL_MODULE_IDS = MODULE_REGISTRY.map(m => m.id);

async function main() {
    console.log('🚀 seed-system — CÁPSULA ERP bootstrap\n');

    // ── 1. SystemConfig: activar TODOS los módulos ──────────────────────────
    const modulesJson = JSON.stringify(ALL_MODULE_IDS);

    await prisma.systemConfig.upsert({
        where:  { key: 'enabled_modules' },
        create: { key: 'enabled_modules', value: modulesJson },
        update: { value: modulesJson },
    });

    console.log(`✅ enabled_modules → ${ALL_MODULE_IDS.length} módulos activados`);
    console.log(`   IDs: ${ALL_MODULE_IDS.join(', ')}\n`);

    // ── 2. SystemConfig: tenant metadata ────────────────────────────────────
    const tenantConfigs: Array<{ key: string; value: string }> = [
        { key: 'business_name', value: 'CAPSULA'     },
        { key: 'tenant_plan',   value: 'ENTERPRISE'  },
        { key: 'tenant_slug',   value: 'capsula'     },
    ];

    for (const cfg of tenantConfigs) {
        await prisma.systemConfig.upsert({
            where:  { key: cfg.key },
            create: { key: cfg.key, value: cfg.value },
            update: { value: cfg.value },
        });
        console.log(`✅ SystemConfig ${cfg.key} = "${cfg.value}"`);
    }
    console.log();

    // ── 3. Usuario admin@capsulapp.com ───────────────────────────────────────
    const adminEmail = 'admin@capsulapp.com';

    const existingAdmin = await prisma.user.findUnique({
        where: { email: adminEmail },
        select: {
            id:             true,
            role:           true,
            isActive:       true,
            allowedModules: true,
            passwordHash:   true,
        },
    });

    if (existingAdmin) {
        console.log('🔍 Usuario admin encontrado:');
        console.log(`   id             : ${existingAdmin.id}`);
        console.log(`   role           : ${existingAdmin.role}   ${existingAdmin.role !== 'OWNER' ? '⚠️  (se corregirá a OWNER)' : '(ok)'}`);
        console.log(`   isActive       : ${existingAdmin.isActive}`);
        console.log(`   allowedModules : ${existingAdmin.allowedModules ?? 'null'}   ${existingAdmin.allowedModules === '[]' ? '⚠️  ¡CAUSA DEL BUG! (se pondrá a null)' : ''}`);
        console.log();

        await prisma.user.update({
            where: { email: adminEmail },
            data: {
                role:           'OWNER',
                allowedModules: null,     // sin restricción extra
                isActive:       true,
                deletedAt:      null,
                // Sólo sobreescribir la contraseña si está vacía o es un hash vacío
                ...((!existingAdmin.passwordHash || existingAdmin.passwordHash === '') && {
                    passwordHash: ADMIN_PASSWORD_PLAIN,
                }),
            },
        });

        console.log('✅ Usuario admin actualizado:');
        console.log('   role           → OWNER');
        console.log('   allowedModules → null');
        console.log('   isActive       → true');
    } else {
        // Crear usuario si no existe
        const newAdmin = await prisma.user.create({
            data: {
                email:          adminEmail,
                firstName:      'Admin',
                lastName:       'CAPSULA',
                role:           'OWNER',
                passwordHash:   ADMIN_PASSWORD_PLAIN,
                allowedModules: null,
                isActive:       true,
            },
        });
        console.log(`✅ Usuario admin CREADO: ${newAdmin.id}`);
        console.log(`   password (plain): ${ADMIN_PASSWORD_PLAIN}`);
    }

    console.log();

    // ── 4. Verificación final ────────────────────────────────────────────────
    console.log('🔎 Verificación final:\n');

    const config = await prisma.systemConfig.findUnique({
        where: { key: 'enabled_modules' },
    });
    const enabledIds: string[] = config ? JSON.parse(config.value) : [];
    console.log(`   enabled_modules en BD: ${enabledIds.length} módulos`);

    const adminFinal = await prisma.user.findUnique({
        where: { email: adminEmail },
        select: { id: true, role: true, isActive: true, allowedModules: true },
    });
    console.log(`   admin@capsulapp.com:`);
    console.log(`     role           : ${adminFinal?.role}`);
    console.log(`     isActive       : ${adminFinal?.isActive}`);
    console.log(`     allowedModules : ${adminFinal?.allowedModules ?? 'null (sin restricción)'}`);

    const issues: string[] = [];
    if (enabledIds.length === 0)             issues.push('enabled_modules está vacío');
    if (adminFinal?.role !== 'OWNER')         issues.push(`role incorrecto: ${adminFinal?.role}`);
    if (adminFinal?.allowedModules === '[]')  issues.push('allowedModules aún es []');
    if (!adminFinal?.isActive)                issues.push('usuario inactivo');

    if (issues.length === 0) {
        console.log('\n🎉 Todo correcto. El ADMIN debería ver todos los módulos tras hacer login.');
    } else {
        console.error('\n❌ Quedan problemas:');
        issues.forEach(i => console.error(`   - ${i}`));
        process.exit(1);
    }
}

main()
    .catch(e => {
        console.error('❌ Error fatal:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
