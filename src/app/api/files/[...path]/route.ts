import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import path from 'path';
import { getSession } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/super-admin';
import { resolveTenantContext } from '@/lib/tenant-context.server';

/**
 * Endpoint de lectura de archivos uploadeados — replaza el acceso directo
 * a /public/uploads que era el bug histórico de aislación.
 *
 * Path esperado:  /api/files/<tenantId>/<subdir>/<filename>
 * Path en disco:  STORAGE_ROOT/uploads/<tenantId>/<subdir>/<filename>
 *
 * Validaciones:
 *   1. Sesión válida (401 sin cookie).
 *   2. El primer segmento del path DEBE ser el tenantId del request
 *      (resolveTenantContext). Super admins exentos — pueden leer
 *      cualquier tenant para soporte.
 *   3. El path normalizado debe quedar dentro del directorio del tenant
 *      (anti path-traversal vía `../`).
 *
 * NO sirve listados de directorio. Solo archivos individuales.
 */

const STORAGE_ROOT = path.join(process.cwd(), 'storage');
const UPLOADS_ROOT = path.join(STORAGE_ROOT, 'uploads');

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    pdf: 'application/pdf',
};

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> },
) {
    try {
        const session = await getSession();
        if (!session) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const { path: pathSegments } = await params;
        if (!pathSegments || pathSegments.length < 2) {
            return new NextResponse('Not Found', { status: 404 });
        }

        const [requestedTenantId, ...rest] = pathSegments;

        // Validación de tenant: super admins pueden leer cualquier tenant,
        // resto solo el suyo. resolveTenantContext() lanza si la sesión es
        // cross-subdomain (defensa transitiva del fix CrossTenantAccessError).
        if (!isSuperAdmin(session.email)) {
            const ctx = await resolveTenantContext();
            if (ctx.tenantId !== requestedTenantId) {
                // 404 (no 403) para no leakear que el archivo existe en otro tenant.
                return new NextResponse('Not Found', { status: 404 });
            }
        }

        // Construir path y verificar que no escapa del root via `..`.
        const tenantDir = path.join(UPLOADS_ROOT, requestedTenantId);
        const filePath = path.join(tenantDir, ...rest);
        const normalizedPath = path.normalize(filePath);
        if (!normalizedPath.startsWith(tenantDir + path.sep)) {
            return new NextResponse('Not Found', { status: 404 });
        }

        let fileStat;
        try {
            fileStat = await stat(normalizedPath);
        } catch {
            return new NextResponse('Not Found', { status: 404 });
        }
        if (!fileStat.isFile()) {
            return new NextResponse('Not Found', { status: 404 });
        }

        const ext = path.extname(normalizedPath).slice(1).toLowerCase();
        const contentType = CONTENT_TYPE_BY_EXT[ext] ?? 'application/octet-stream';

        const buffer = await readFile(normalizedPath);

        return new NextResponse(buffer as unknown as BodyInit, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Content-Length': String(fileStat.size),
                'Cache-Control': 'private, max-age=300',
                'X-Content-Type-Options': 'nosniff',
            },
        });
    } catch (error) {
        console.error('[api/files] error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
