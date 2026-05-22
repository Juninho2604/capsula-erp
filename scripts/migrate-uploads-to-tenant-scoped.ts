/**
 * Migración one-off: mover archivos uploadeados de `public/uploads/notas-entrega/`
 * a `storage/uploads/<tenantId>/notas-entrega/` + actualizar las URLs en
 * `InventoryMovement.documentUrl` para que apunten al nuevo endpoint protegido.
 *
 * Contexto: hasta el fix del Bloque B, el upload era anónimo y los archivos
 * vivían bajo `public/` (servidos por nginx sin auth). Este script ejecuta
 * el cleanup en el VPS post-deploy.
 *
 * Asunción: solo existe un tenant activo cuando este script corre (el
 * histórico). Si hay más de uno, aborta — la migración requiere clasificar
 * archivos por tenant manualmente.
 *
 * Uso:
 *   npx tsx scripts/migrate-uploads-to-tenant-scoped.ts [--dry-run]
 *
 * Idempotente: si los archivos ya fueron movidos o las URLs ya tienen el
 * nuevo formato, las operaciones se skipean en lugar de fallar.
 */

import { rename, mkdir, readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const DRY_RUN = process.argv.includes('--dry-run');
const ROOT = process.cwd();
const OLD_DIR = path.join(ROOT, 'public', 'uploads', 'notas-entrega');
const STORAGE_ROOT = path.join(ROOT, 'storage', 'uploads');
const OLD_URL_PREFIX = '/uploads/notas-entrega/';
const NEW_URL_PREFIX_FN = (tenantId: string) => `/api/files/${tenantId}/notas-entrega/`;

const prisma = new PrismaClient();

async function main() {
    console.log(`[migrate-uploads] dry-run=${DRY_RUN}`);

    // 1. Identificar tenant target
    const tenants = await prisma.tenant.findMany({
        select: { id: true, slug: true },
        orderBy: { createdAt: 'asc' },
    });
    if (tenants.length === 0) {
        console.error('[migrate-uploads] No hay tenants en BD. Aborto.');
        process.exit(1);
    }
    if (tenants.length > 1) {
        console.error(
            `[migrate-uploads] Hay ${tenants.length} tenants en BD; el script ` +
                `solo soporta migración single-tenant. Tenants encontrados:\n` +
                tenants.map((t) => `  - ${t.slug} (${t.id})`).join('\n') +
                '\nMover archivos manualmente por tenant.',
        );
        process.exit(1);
    }
    const tenantId = tenants[0].id;
    console.log(`[migrate-uploads] Tenant target: ${tenants[0].slug} (${tenantId})`);

    // 2. Mover archivos físicos
    const newDir = path.join(STORAGE_ROOT, tenantId, 'notas-entrega');
    if (existsSync(OLD_DIR)) {
        const entries = await readdir(OLD_DIR);
        const files = [];
        for (const e of entries) {
            const s = await stat(path.join(OLD_DIR, e));
            if (s.isFile()) files.push(e);
        }
        console.log(`[migrate-uploads] ${files.length} archivos en ${OLD_DIR}`);
        if (files.length > 0) {
            if (!DRY_RUN) {
                await mkdir(newDir, { recursive: true });
            }
            for (const f of files) {
                const src = path.join(OLD_DIR, f);
                const dst = path.join(newDir, f);
                if (existsSync(dst)) {
                    console.log(`  - skip (ya existe en destino): ${f}`);
                    continue;
                }
                if (DRY_RUN) {
                    console.log(`  - [dry] mv ${src} → ${dst}`);
                } else {
                    await rename(src, dst);
                    console.log(`  - mv ${f}`);
                }
            }
        }
    } else {
        console.log(`[migrate-uploads] ${OLD_DIR} no existe — nada que mover`);
    }

    // 3. Actualizar URLs en BD
    const movements = await prisma.inventoryMovement.findMany({
        where: { documentUrl: { startsWith: OLD_URL_PREFIX } },
        select: { id: true, documentUrl: true },
    });
    console.log(`[migrate-uploads] ${movements.length} InventoryMovement con URL vieja`);

    const newPrefix = NEW_URL_PREFIX_FN(tenantId);
    for (const m of movements) {
        if (!m.documentUrl) continue;
        const newUrl = m.documentUrl.replace(OLD_URL_PREFIX, newPrefix);
        if (DRY_RUN) {
            console.log(`  - [dry] ${m.id}: ${m.documentUrl} → ${newUrl}`);
        } else {
            await prisma.inventoryMovement.update({
                where: { id: m.id },
                data: { documentUrl: newUrl },
            });
            console.log(`  - upd ${m.id}`);
        }
    }

    console.log(`[migrate-uploads] ${DRY_RUN ? 'dry-run ' : ''}OK`);
}

main()
    .catch((err) => {
        console.error('[migrate-uploads] FAIL:', err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
