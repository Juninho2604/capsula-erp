import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { getSession } from '@/lib/auth';
import { resolveTenantContext } from '@/lib/tenant-context.server';

/**
 * Endpoint de subida de archivos (notas de entrega, soportes, etc.).
 *
 * Requiere sesión autenticada. El archivo se guarda en un path
 * tenant-scoped FUERA de `public/` para que nginx no lo sirva
 * directamente — la URL pública generada apunta a `/api/files/...`
 * que valida la sesión + ownership antes de streamear el contenido.
 *
 * Path en disco:  STORAGE_ROOT/uploads/<tenantId>/notas-entrega/<uuid>.<ext>
 * URL pública:    /api/files/<tenantId>/notas-entrega/<uuid>.<ext>
 *
 * Filename con UUID v4 para que no sea guessable (defensa en profundidad
 * frente al GET endpoint).
 */

const STORAGE_ROOT = path.join(process.cwd(), 'storage');
const UPLOADS_SUBDIR = 'uploads';
const NOTAS_SUBDIR = 'notas-entrega';

const ALLOWED_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
]);
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

const EXT_BY_TYPE: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
};

export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json(
                { success: false, error: 'No autenticado' },
                { status: 401 },
            );
        }

        const { tenantId } = await resolveTenantContext();

        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json(
                { success: false, error: 'No se recibió ningún archivo' },
                { status: 400 },
            );
        }

        if (!ALLOWED_TYPES.has(file.type)) {
            return NextResponse.json(
                { success: false, error: 'Tipo de archivo no permitido. Use JPG, PNG, WebP o PDF.' },
                { status: 400 },
            );
        }

        if (file.size > MAX_SIZE) {
            return NextResponse.json(
                { success: false, error: 'El archivo excede el tamaño máximo de 5MB' },
                { status: 400 },
            );
        }

        // Path en disco: storage/uploads/<tenantId>/notas-entrega/
        const tenantDir = path.join(STORAGE_ROOT, UPLOADS_SUBDIR, tenantId, NOTAS_SUBDIR);
        if (!existsSync(tenantDir)) {
            await mkdir(tenantDir, { recursive: true });
        }

        // Filename con UUID — no derivado de input del cliente (evita path
        // traversal y predicción). Extension SOLO del MIME validado, no del
        // file.name del cliente (que podría ser .php, .sh, etc.).
        const ext = EXT_BY_TYPE[file.type] ?? 'bin';
        const fileName = `${randomUUID()}.${ext}`;
        const filePath = path.join(tenantDir, fileName);

        const bytes = await file.arrayBuffer();
        await writeFile(filePath, Buffer.from(bytes));

        // URL pública: pasa por /api/files que re-valida sesión + tenant
        const publicUrl = `/api/files/${tenantId}/${NOTAS_SUBDIR}/${fileName}`;

        return NextResponse.json({
            success: true,
            message: 'Archivo subido correctamente',
            data: {
                fileName,
                url: publicUrl,
                size: file.size,
                type: file.type,
            },
        });
    } catch (error) {
        console.error('[api/upload] error:', error);
        return NextResponse.json(
            { success: false, error: 'Error interno al procesar el archivo' },
            { status: 500 },
        );
    }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
