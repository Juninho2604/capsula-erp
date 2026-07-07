/**
 * Seed de desarrollo del módulo Conversaciones WhatsApp (§8 del spec):
 *  - 3 plantillas típicas (confirmacion_pedido, pedido_en_camino UTILITY,
 *    reactivacion_cliente MARKETING — para probar el bloqueo por opt-in).
 *  - 2 conversaciones fake con mensajes, para desarrollar la UI sin Meta.
 *
 * Idempotente: upsert por claves naturales. No toca credenciales.
 *
 * Uso: SEED_TENANT_SLUG=<slug> npx tsx scripts/seed-wa-demo.ts
 */
import { PrismaClient } from '@prisma/client';

async function main() {
    const prisma = new PrismaClient();
    try {
        const slug = process.env.SEED_TENANT_SLUG;
        const tenant = slug
            ? await prisma.tenant.findUnique({ where: { slug } })
            : await prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } });
        if (!tenant) throw new Error('Tenant no encontrado');
        console.log(`Seed WA demo — tenant: ${tenant.name} (${tenant.slug})`);

        // ── Plantillas ───────────────────────────────────────────────────────
        const templates = [
            {
                name: 'confirmacion_pedido', category: 'UTILITY',
                bodyPreview: 'Su pedido #{{1}} fue confirmado. Total: {{2}} REF.',
                variablesCount: 2, approvalStatus: 'APPROVED',
            },
            {
                name: 'pedido_en_camino', category: 'UTILITY',
                bodyPreview: 'Su pedido #{{1}} va en camino con nuestro motorizado. Tiempo estimado: {{2}} minutos.',
                variablesCount: 2, approvalStatus: 'APPROVED',
            },
            {
                name: 'reactivacion_cliente', category: 'MARKETING',
                bodyPreview: '¡Hola {{1}}! Te extrañamos en Shanklish. Esta semana tenemos 15% de descuento en shawarmas. ¿Te aparto uno?',
                variablesCount: 1, approvalStatus: 'APPROVED',
            },
        ];
        for (const t of templates) {
            await prisma.waTemplate.upsert({
                where: { tenantId_name_language: { tenantId: tenant.id, name: t.name, language: 'es' } },
                create: { tenantId: tenant.id, language: 'es', ...t, approvalStatus: t.approvalStatus as any },
                update: { bodyPreview: t.bodyPreview, variablesCount: t.variablesCount, category: t.category, approvalStatus: t.approvalStatus as any },
            });
            console.log(`  ✓ plantilla ${t.name} (${t.category})`);
        }

        // ── Conversaciones fake ──────────────────────────────────────────────
        const now = Date.now();
        const convs = [
            {
                waId: '584121234567', name: 'María Pérez',
                windowOffsetMs: -2 * 60 * 60 * 1000, // escribió hace 2h → ventana abierta (22h restantes)
                optedOut: false,
                messages: [
                    { dir: 'INBOUND', sender: 'CUSTOMER', kind: 'TEXT', body: 'Hola! Quiero pedir 2 shawarmas de pollo medianos para delivery', minAgo: 125 },
                    { dir: 'OUTBOUND', sender: 'BOT', kind: 'TEXT', body: '¡Hola María! 🙌 Claro que sí: 2 Shawarmas de Pollo Medianos. ¿A qué dirección te los enviamos?', minAgo: 124 },
                    { dir: 'INBOUND', sender: 'CUSTOMER', kind: 'TEXT', body: 'Av. Francisco de Miranda, edificio Parque Cristal, torre oeste', minAgo: 122 },
                    { dir: 'OUTBOUND', sender: 'BOT', kind: 'TEXT', body: 'Perfecto. Total: 17 REF. ¿Método de pago? (Pago móvil / Zelle / Efectivo)', minAgo: 121 },
                    { dir: 'INBOUND', sender: 'CUSTOMER', kind: 'TEXT', body: 'Pago móvil. Ya les paso el comprobante', minAgo: 120 },
                ],
            },
            {
                waId: '584149876543', name: 'Carlos Rondón',
                windowOffsetMs: -30 * 60 * 60 * 1000, // escribió hace 30h → ventana EXPIRADA (probar plantillas)
                optedOut: true, // pidió BAJA — probar bloqueo de MARKETING
                messages: [
                    { dir: 'INBOUND', sender: 'CUSTOMER', kind: 'TEXT', body: 'A qué hora abren hoy?', minAgo: 30 * 60 },
                    { dir: 'OUTBOUND', sender: 'BOT', kind: 'TEXT', body: '¡Hola Carlos! Hoy abrimos de 11:30 am a 10:00 pm. ¿Te tomo un pedido?', minAgo: 30 * 60 - 1 },
                    { dir: 'INBOUND', sender: 'CUSTOMER', kind: 'TEXT', body: 'BAJA', minAgo: 30 * 60 - 2 },
                    { dir: 'OUTBOUND', sender: 'BOT', kind: 'TEXT', body: 'Entendido, no te enviaremos más mensajes promocionales. Si necesitas hacer un pedido o tienes una consulta, escríbenos cuando quieras.', minAgo: 30 * 60 - 2 },
                ],
            },
        ];

        for (const c of convs) {
            const lastMsgAt = new Date(now + c.windowOffsetMs);
            const conv = await prisma.waConversation.upsert({
                where: { tenantId_waId: { tenantId: tenant.id, waId: c.waId } },
                create: {
                    tenantId: tenant.id,
                    waId: c.waId,
                    customerPhone: c.waId,
                    customerName: c.name,
                    status: 'BOT',
                    lastCustomerMsgAt: lastMsgAt,
                    windowExpiresAt: new Date(lastMsgAt.getTime() + 24 * 60 * 60 * 1000),
                    optedOutAt: c.optedOut ? lastMsgAt : null,
                    unreadCount: 1,
                },
                update: {},
            });
            const existing = await prisma.waMessage.count({ where: { conversationId: conv.id } });
            if (existing === 0) {
                for (const m of c.messages) {
                    await prisma.waMessage.create({
                        data: {
                            tenantId: tenant.id,
                            conversationId: conv.id,
                            direction: m.dir as any,
                            senderType: m.sender as any,
                            kind: m.kind as any,
                            body: m.body,
                            deliveryStatus: m.dir === 'OUTBOUND' ? 'READ' : 'DELIVERED',
                            createdAt: new Date(now - m.minAgo * 60_000),
                        },
                    });
                }
            }
            console.log(`  ✓ conversación ${c.name} (${c.waId}) — ${c.messages.length} mensajes${c.optedOut ? ' · OPTED-OUT' : ''}`);
        }

        console.log('\nListo. Prendé el flag "waConversations" del tenant para ver el módulo.');
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(e => { console.error(e); process.exit(1); });
