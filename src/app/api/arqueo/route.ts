import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSalesForArqueoAction } from '@/app/actions/sales/arqueo.actions';
import { buildArqueoWorkbookFromTemplate, getArqueoFileName } from '@/lib/arqueo-excel-utils';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import prisma from '@/server/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const dateParam = searchParams.get('date');
        const date = dateParam ? new Date(dateParam + 'T12:00:00') : new Date();

        const result = await getSalesForArqueoAction(date);
        if (!result.success || !result.data) {
            return NextResponse.json(
                { error: result.message || 'Error generando arqueo' },
                { status: 500 }
            );
        }

        const dateStr = date.toLocaleDateString('es-VE', { timeZone: 'America/Caracas' });
        const buffer = await buildArqueoWorkbookFromTemplate(result.data, dateStr);
        // Filename con nombre del tenant. ANTES "Shanklish" hardcoded para
        // todos los tenants. Ahora usa displayName ?? name del tenant.
        // Para Shanklish, displayName='Shanklish' (backfilleado en
        // migration 20260523200000) → mantiene "Arqueo_Caja_Shanklish_*.xlsx"
        // exactamente igual al historial.
        const tenantCtx = await resolveTenantContext();
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantCtx.tenantId },
            select: { name: true, displayName: true },
        });
        const fileName = getArqueoFileName(dateStr, tenant?.displayName ?? tenant?.name);
        const encodedFileName = encodeURIComponent(fileName);

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${fileName}"; filename*=UTF-8''${encodedFileName}`,
            },
        });
    } catch (error) {
        console.error('Error exporting arqueo:', error);
        return NextResponse.json(
            { error: 'Error interno al exportar arqueo' },
            { status: 500 }
        );
    }
}
