
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🧪 Probando creación de orden CON ITEMS...');

    // 1. Obtener Usuario
    const user = await prisma.user.findFirst();
    if (!user) throw new Error('No hay usuarios');

    // 2. Obtener Área
    const area = await prisma.area.findFirst();
    const areaId = area ? area.id : 'default-fail';

    if (!area) console.warn('⚠️ No hay áreas, esto fallará por FK si no se crea una');

    // 3. Obtener Producto
    let item = await prisma.menuItem.findFirst();
    if (!item) {
        // Crear categoría temporal si hace falta
        let cat = await prisma.menuCategory.findFirst();
        if (!cat) {
            cat = await prisma.menuCategory.create({ data: { name: 'Temp Cat' } });
        }
        item = await prisma.menuItem.create({
            data: {
                name: 'Test Product',
                price: 10,
                sku: 'TEST-001-' + Date.now(),
                categoryId: cat.id
            }
        });
        console.log('Item creado:', item.id);
    }

    // 4. Intentar crear orden con items
    try {
        const order = await prisma.salesOrder.create({
            data: {
                orderNumber: 'TEST-' + Date.now(),
                orderType: 'RESTAURANT',
                status: 'CONFIRMED',
                paymentStatus: 'PAID',
                createdById: user.id,
                areaId: areaId,
                total: 20,

                items: {
                    create: [{
                        menuItemId: item.id,
                        quantity: 1,
                        unitPrice: 10,
                        lineTotal: 10,
                        notes: 'Test item'
                    }]
                }
            }
        });
        console.log('✅ Orden CON ITEMS creada exitosamente:', order.id);
    } catch (e: any) {
        console.error('❌ ERROR AL CREAR ORDEN:');
        console.error(e);
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
