/**
 * seed-demo-tenant.ts
 * --------------------
 * Crea un tenant "demo" completo con datos sintéticos creíbles para ventas
 * y demos a prospectos, sin exponer datos reales de clientes existentes.
 *
 * Contenido del tenant demo:
 *   - Tenant: "Capsula Demo Bistró"
 *   - Slug: "demo"
 *   - Users: 1 owner + 1 admin + 1 cajera + 1 mesero + 1 chef
 *   - Branch: "Sucursal Principal"
 *   - Areas: 4 (Almacén Principal, Cocina, Bar, Producción)
 *   - Service Zones + Tables: ~12 mesas
 *   - Menu: 5 categorías, ~25 items
 *   - Recipes con ingredientes
 *   - InventoryItems: ~25
 *   - InventoryLocations con stock realista
 *   - SalesOrders: ~30 ventas distribuidas en los últimos 14 días
 *   - Expense categories + gastos
 *   - ExchangeRate
 *
 * Uso:
 *   set -a && source /var/www/capsula-erp/.env && set +a && \
 *   npx tsx scripts/seed-demo-tenant.ts \
 *     [--slug=demo]                 # default: demo
 *     [--reset]                     # borra el tenant demo si ya existe y crea de cero
 *
 * Idempotente con --reset: si querés rebuild desde cero, pasalo.
 * Sin --reset: si el tenant ya existe, aborta para evitar duplicar data.
 */

import { PrismaClient } from '@prisma/client';
import { webcrypto } from 'node:crypto';

// ─── Args ───────────────────────────────────────────────────────────────────

interface Args {
    slug: string;
    reset: boolean;
}

function parseArgs(): Args {
    const args = process.argv.slice(2);
    const map: Record<string, string> = {};
    for (const arg of args) {
        if (!arg.startsWith('--')) continue;
        const [k, ...rest] = arg.slice(2).split('=');
        map[k] = rest.length > 0 ? rest.join('=') : 'true';
    }
    return {
        slug: map['slug'] ?? 'demo',
        reset: map['reset'] === 'true',
    };
}

// ─── Password hashing (PBKDF2-SHA256, mismo formato que login) ─────────────

function uint8ArrayToHex(arr: Uint8Array): string {
    return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToUint8Array(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return bytes;
}

async function pbkdf2Hex(password: string, saltHex: string): Promise<string> {
    const enc = new TextEncoder();
    const keyMaterial = await webcrypto.subtle.importKey(
        'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits'],
    );
    const salt = hexToUint8Array(saltHex);
    const hashBuf = await webcrypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
        keyMaterial, 256,
    );
    return uint8ArrayToHex(new Uint8Array(hashBuf));
}

async function hashPassword(password: string): Promise<string> {
    const saltBytes = webcrypto.getRandomValues(new Uint8Array(16));
    const saltHex = uint8ArrayToHex(saltBytes);
    const hashHex = await pbkdf2Hex(password, saltHex);
    return `${saltHex}:${hashHex}`;
}

// PIN: misma idea pero más corto (4-6 dígitos)
async function hashPin(pin: string): Promise<string> {
    const saltBytes = webcrypto.getRandomValues(new Uint8Array(16));
    const saltHex = uint8ArrayToHex(saltBytes);
    const hashHex = await pbkdf2Hex(pin, saltHex);
    return `${saltHex}:${hashHex}`;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function daysAgo(days: number, hour = 18, minute = 30): Date {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(hour, minute, 0, 0);
    return d;
}

function rand<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
    const args = parseArgs();
    const prisma = new PrismaClient();

    console.log('======================================================');
    console.log(' Seed Demo Tenant');
    console.log('======================================================');
    console.log(`  Slug:  ${args.slug}`);
    console.log(`  Reset: ${args.reset ? 'sí (borra y crea de cero)' : 'no'}`);
    console.log('');

    try {
        // Pre-check / reset
        const existing = await prisma.tenant.findUnique({
            where: { slug: args.slug },
            select: { id: true, name: true },
        });

        if (existing) {
            if (args.reset) {
                console.log(`Tenant "${args.slug}" ya existe (id: ${existing.id}). RESETEANDO...`);
                await resetTenantData(prisma, existing.id);
            } else {
                console.error(`Tenant "${args.slug}" ya existe (id: ${existing.id}). Usá --reset para reconstruir desde cero, o cambia el --slug.`);
                process.exit(1);
            }
        }

        // ─── 1. Tenant + Owner + Users ──────────────────────────────────
        console.log('1. Creando tenant + usuarios...');
        const tenantId = existing?.id ?? null;
        const tenant = tenantId
            ? await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })
            : await prisma.tenant.create({
                data: { slug: args.slug, name: 'Capsula Demo Bistró' },
            });

        const usersToCreate = [
            { email: 'owner@demo.kpsula.app', password: 'Demo2026!', firstName: 'Ana',     lastName: 'Demo',    role: 'OWNER',          pin: '1234' },
            { email: 'admin@demo.kpsula.app', password: 'Demo2026!', firstName: 'Carlos',  lastName: 'Demo',    role: 'ADMIN_MANAGER',  pin: '2345' },
            { email: 'caja@demo.kpsula.app',  password: 'Demo2026!', firstName: 'María',   lastName: 'Cajera',  role: 'CASHIER',        pin: '3456' },
            { email: 'chef@demo.kpsula.app',  password: 'Demo2026!', firstName: 'Jorge',   lastName: 'Chef',    role: 'CHEF',           pin: '4567' },
            { email: 'mesero@demo.kpsula.app',password: 'Demo2026!', firstName: 'Luis',    lastName: 'Mesero',  role: 'WAITER',         pin: '5678' },
        ];

        const users: Record<string, { id: string }> = {};
        for (const u of usersToCreate) {
            const passwordHash = await hashPassword(u.password);
            const pinHash = await hashPin(u.pin);
            const created = await prisma.user.create({
                data: {
                    tenantId: tenant.id,
                    email: u.email,
                    passwordHash,
                    firstName: u.firstName,
                    lastName: u.lastName,
                    role: u.role,
                    pin: pinHash,
                    isActive: true,
                },
            });
            users[u.role] = { id: created.id };
        }
        const ownerId = users.OWNER.id;

        // ─── 2. Branch + Areas + Service Zones ──────────────────────────
        console.log('2. Branch + áreas + zonas...');
        const branch = await prisma.branch.create({
            data: {
                tenantId: tenant.id,
                code: 'MAIN',
                name: 'Sucursal Principal Demo',
                legalName: 'Capsula Demo Bistró, C.A.',
                timezone: 'America/Caracas',
                currencyCode: 'USD',
                isActive: true,
            },
        });

        const areaPrincipal = await prisma.area.create({
            data: { tenantId: tenant.id, name: 'ALMACÉN PRINCIPAL', description: 'Stock general', isActive: true },
        });
        const areaCocina = await prisma.area.create({
            data: { tenantId: tenant.id, name: 'COCINA', description: 'Cocina y producción', isActive: true },
        });
        const areaBar = await prisma.area.create({
            data: { tenantId: tenant.id, name: 'BAR', description: 'Barra y licores', isActive: true },
        });
        const areaProduccion = await prisma.area.create({
            data: { tenantId: tenant.id, name: 'PRODUCCIÓN', description: 'Centro de procesamiento', isActive: true },
        });

        // Zones
        const zoneSalon = await prisma.serviceZone.create({
            data: { tenantId: tenant.id, branchId: branch.id, code: 'SALON', name: 'Salón Principal', zoneType: 'DINING' },
        });
        const zoneTerraza = await prisma.serviceZone.create({
            data: { tenantId: tenant.id, branchId: branch.id, code: 'TERRAZA', name: 'Terraza', zoneType: 'TERRACE' },
        });
        const zoneBarra = await prisma.serviceZone.create({
            data: { tenantId: tenant.id, branchId: branch.id, code: 'BARRA', name: 'Barra', zoneType: 'BAR' },
        });

        // Tables: 6 en Salón, 4 en Terraza, 2 en Barra
        const tables = [];
        for (let i = 1; i <= 6; i++) {
            tables.push(await prisma.tableOrStation.create({
                data: { tenantId: tenant.id, branchId: branch.id, serviceZoneId: zoneSalon.id, code: `M${i}`, name: `Mesa ${i}`, capacity: i <= 2 ? 2 : i <= 4 ? 4 : 6, currentStatus: 'AVAILABLE', isActive: true },
            }));
        }
        for (let i = 7; i <= 10; i++) {
            tables.push(await prisma.tableOrStation.create({
                data: { tenantId: tenant.id, branchId: branch.id, serviceZoneId: zoneTerraza.id, code: `T${i - 6}`, name: `Terraza ${i - 6}`, capacity: 4, currentStatus: 'AVAILABLE', isActive: true },
            }));
        }
        for (let i = 1; i <= 2; i++) {
            tables.push(await prisma.tableOrStation.create({
                data: { tenantId: tenant.id, branchId: branch.id, serviceZoneId: zoneBarra.id, code: `B${i}`, name: `Barra ${i}`, capacity: 2, currentStatus: 'AVAILABLE', isActive: true },
            }));
        }

        // Waiter profile for the mesero user
        const waiter = await prisma.waiter.create({
            data: {
                tenantId: tenant.id,
                branchId: branch.id,
                firstName: 'Luis',
                lastName: 'Mesero',
                pin: await hashPin('5678'),
                isActive: true,
                isCaptain: false,
            },
        });

        // ─── 3. Suppliers ────────────────────────────────────────────────
        console.log('3. Proveedores...');
        const supplierMercaCarne = await prisma.supplier.create({
            data: { tenantId: tenant.id, name: 'MercaCarne Distribuidora', code: 'MC001', contactName: 'Pedro Ramírez', phone: '04141234567', email: 'pedidos@mercacarne.demo', isActive: true },
        });
        const supplierFrutas = await prisma.supplier.create({
            data: { tenantId: tenant.id, name: 'Frutas y Vegetales del Valle', code: 'FV001', contactName: 'Sandra López', phone: '04241234567', email: 'pedidos@frutasvalle.demo', isActive: true },
        });

        // ─── 4. ExpenseCategories ────────────────────────────────────────
        console.log('4. Categorías de gasto...');
        const expCatProveedores = await prisma.expenseCategory.create({
            data: { tenantId: tenant.id, name: 'Proveedores', description: 'Pagos a proveedores de insumos', color: '#3B82F6' },
        });
        const expCatServicios = await prisma.expenseCategory.create({
            data: { tenantId: tenant.id, name: 'Servicios', description: 'Luz, agua, internet', color: '#10B981' },
        });
        const expCatNomina = await prisma.expenseCategory.create({
            data: { tenantId: tenant.id, name: 'Nómina', description: 'Sueldos y beneficios', color: '#F59E0B' },
        });

        // ─── 5. ExchangeRate ─────────────────────────────────────────────
        console.log('5. Tasa de cambio...');
        await prisma.exchangeRate.create({
            data: { tenantId: tenant.id, rate: 89.50, effectiveDate: new Date(), source: 'BCV' },
        });

        // ─── 6. InventoryItems ───────────────────────────────────────────
        console.log('6. Items de inventario...');
        const invItems: Record<string, { id: string; baseUnit: string }> = {};
        const itemDefs = [
            { sku: 'CAR001', name: 'Lomito de Res',       category: 'PROTEINA',  baseUnit: 'KG',      type: 'RAW_MATERIAL', cost: 12.50 },
            { sku: 'CAR002', name: 'Pollo Entero',        category: 'PROTEINA',  baseUnit: 'KG',      type: 'RAW_MATERIAL', cost: 4.20 },
            { sku: 'CAR003', name: 'Pescado del Día',     category: 'PROTEINA',  baseUnit: 'KG',      type: 'RAW_MATERIAL', cost: 8.80 },
            { sku: 'VEG001', name: 'Tomate',              category: 'VEGETALES', baseUnit: 'KG',      type: 'RAW_MATERIAL', cost: 1.20 },
            { sku: 'VEG002', name: 'Cebolla',             category: 'VEGETALES', baseUnit: 'KG',      type: 'RAW_MATERIAL', cost: 0.95 },
            { sku: 'VEG003', name: 'Papa',                category: 'VEGETALES', baseUnit: 'KG',      type: 'RAW_MATERIAL', cost: 0.80 },
            { sku: 'VEG004', name: 'Lechuga Romana',      category: 'VEGETALES', baseUnit: 'UNIT',    type: 'RAW_MATERIAL', cost: 1.50 },
            { sku: 'GRA001', name: 'Arroz',               category: 'GRANOS',    baseUnit: 'KG',      type: 'RAW_MATERIAL', cost: 1.10 },
            { sku: 'GRA002', name: 'Caraotas Negras',     category: 'GRANOS',    baseUnit: 'KG',      type: 'RAW_MATERIAL', cost: 2.30 },
            { sku: 'LAC001', name: 'Queso Mozzarella',    category: 'LACTEOS',   baseUnit: 'KG',      type: 'RAW_MATERIAL', cost: 7.50 },
            { sku: 'LAC002', name: 'Queso Blanco',        category: 'LACTEOS',   baseUnit: 'KG',      type: 'RAW_MATERIAL', cost: 5.20 },
            { sku: 'PAN001', name: 'Harina de Maíz',      category: 'PANIFICADO',baseUnit: 'KG',      type: 'RAW_MATERIAL', cost: 1.40 },
            { sku: 'PAN002', name: 'Harina de Trigo',     category: 'PANIFICADO',baseUnit: 'KG',      type: 'RAW_MATERIAL', cost: 1.20 },
            { sku: 'BEB001', name: 'Coca Cola 350ml',     category: 'BEBIDAS',   baseUnit: 'UNIT',    type: 'RAW_MATERIAL', cost: 0.80 },
            { sku: 'BEB002', name: 'Agua Mineral 500ml',  category: 'BEBIDAS',   baseUnit: 'UNIT',    type: 'RAW_MATERIAL', cost: 0.50 },
            { sku: 'BEB003', name: 'Cerveza Polar 250ml', category: 'BEBIDAS',   baseUnit: 'UNIT',    type: 'RAW_MATERIAL', cost: 1.20 },
            { sku: 'BEB004', name: 'Vino Tinto Casa',     category: 'BEBIDAS',   baseUnit: 'UNIT',    type: 'RAW_MATERIAL', cost: 18.00 },
            { sku: 'ACE001', name: 'Aceite Vegetal',      category: 'ACEITES',   baseUnit: 'LT',      type: 'RAW_MATERIAL', cost: 3.40 },
            { sku: 'CON001', name: 'Sal Marina',          category: 'CONDIMENTOS',baseUnit: 'KG',     type: 'RAW_MATERIAL', cost: 0.70 },
            { sku: 'CON002', name: 'Pimienta Negra',      category: 'CONDIMENTOS',baseUnit: 'KG',     type: 'RAW_MATERIAL', cost: 15.00 },
        ];

        for (const def of itemDefs) {
            const item = await prisma.inventoryItem.create({
                data: {
                    tenantId: tenant.id, sku: def.sku, name: def.name, category: def.category,
                    baseUnit: def.baseUnit, type: def.type, isActive: true,
                    minimumStock: 5, reorderPoint: 10,
                },
            });
            invItems[def.sku] = { id: item.id, baseUnit: def.baseUnit };
            // Cost history
            await prisma.costHistory.create({
                data: { inventoryItemId: item.id, costPerUnit: def.cost, currency: 'USD',
                    effectiveFrom: daysAgo(30), reason: 'Costo inicial seed', createdById: ownerId },
            });
            // Stock en almacén principal
            await prisma.inventoryLocation.create({
                data: { inventoryItemId: item.id, areaId: areaPrincipal.id, currentStock: randInt(15, 60), lastCountDate: daysAgo(2) },
            });
        }

        // ─── 7. Menu ─────────────────────────────────────────────────────
        console.log('7. Menú...');
        const catEntradas = await prisma.menuCategory.create({
            data: { tenantId: tenant.id, name: 'Entradas', sortOrder: 1, isActive: true, icon: 'Salad' },
        });
        const catPrincipales = await prisma.menuCategory.create({
            data: { tenantId: tenant.id, name: 'Platos Principales', sortOrder: 2, isActive: true, icon: 'UtensilsCrossed' },
        });
        const catPostres = await prisma.menuCategory.create({
            data: { tenantId: tenant.id, name: 'Postres', sortOrder: 3, isActive: true, icon: 'Cookie' },
        });
        const catBebidas = await prisma.menuCategory.create({
            data: { tenantId: tenant.id, name: 'Bebidas', sortOrder: 4, isActive: true, icon: 'GlassWater' },
        });
        const catCocteles = await prisma.menuCategory.create({
            data: { tenantId: tenant.id, name: 'Cócteles', sortOrder: 5, isActive: true, icon: 'Wine' },
        });

        const menuItemDefs = [
            { sku: 'ENT001', cat: catEntradas, name: 'Tequeños (5u)',              price: 8.00 },
            { sku: 'ENT002', cat: catEntradas, name: 'Carpaccio de Lomito',        price: 14.00 },
            { sku: 'ENT003', cat: catEntradas, name: 'Ceviche del Día',            price: 16.00 },
            { sku: 'ENT004', cat: catEntradas, name: 'Tabla de Quesos',            price: 22.00 },
            { sku: 'PRI001', cat: catPrincipales, name: 'Lomito a la Pimienta',    price: 28.00 },
            { sku: 'PRI002', cat: catPrincipales, name: 'Pollo en Salsa de Champi.', price: 18.00 },
            { sku: 'PRI003', cat: catPrincipales, name: 'Pescado del Día',         price: 24.00 },
            { sku: 'PRI004', cat: catPrincipales, name: 'Pasta Bolognesa',         price: 14.00 },
            { sku: 'PRI005', cat: catPrincipales, name: 'Risotto de Hongos',       price: 16.00 },
            { sku: 'PRI006', cat: catPrincipales, name: 'Pabellón Criollo',        price: 15.00 },
            { sku: 'PRI007', cat: catPrincipales, name: 'Hamburguesa Capsula',     price: 12.00 },
            { sku: 'PRI008', cat: catPrincipales, name: 'Pizza Margarita',         price: 13.00 },
            { sku: 'POS001', cat: catPostres,  name: 'Quesillo',                   price: 6.00 },
            { sku: 'POS002', cat: catPostres,  name: 'Brownie con Helado',         price: 8.00 },
            { sku: 'POS003', cat: catPostres,  name: 'Cheesecake',                 price: 8.00 },
            { sku: 'BEB001', cat: catBebidas,  name: 'Coca Cola',                  price: 3.00 },
            { sku: 'BEB002', cat: catBebidas,  name: 'Agua Mineral',               price: 2.50 },
            { sku: 'BEB003', cat: catBebidas,  name: 'Jugo Natural',               price: 4.50 },
            { sku: 'BEB004', cat: catBebidas,  name: 'Café Espresso',              price: 2.50 },
            { sku: 'BEB005', cat: catBebidas,  name: 'Cerveza Polar',              price: 3.50 },
            { sku: 'COC001', cat: catCocteles, name: 'Mojito Clásico',             price: 9.00 },
            { sku: 'COC002', cat: catCocteles, name: 'Caipirinha',                 price: 9.00 },
            { sku: 'COC003', cat: catCocteles, name: 'Negroni',                    price: 11.00 },
            { sku: 'COC004', cat: catCocteles, name: 'Margarita',                  price: 10.00 },
            { sku: 'COC005', cat: catCocteles, name: 'Aperol Spritz',              price: 10.00 },
        ];

        const menuItems: { id: string; name: string; price: number; sku: string }[] = [];
        for (const def of menuItemDefs) {
            const item = await prisma.menuItem.create({
                data: {
                    tenantId: tenant.id, categoryId: def.cat.id, sku: def.sku, name: def.name,
                    price: def.price, isActive: true, isAvailable: true,
                },
            });
            menuItems.push({ id: item.id, name: def.name, price: def.price, sku: def.sku });
        }

        // ─── 8. SalesOrders sintéticas (últimos 14 días) ────────────────
        console.log('8. Ventas históricas (últimos 14 días)...');
        const paymentMethods = ['CASH_USD', 'ZELLE', 'CARD', 'CASH_BS', 'PAGO_MOVIL'];
        const orderTypes = ['RESTAURANT', 'DELIVERY', 'PICKUP'];
        const customerNames = ['Pedro Sánchez', 'María García', 'Juan Pérez', 'Ana Martínez', 'Cliente', 'Luis Rodríguez', 'Carmen Núñez', 'Ricardo López'];

        let orderCounter = 1;
        const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

        for (let day = 0; day < 14; day++) {
            const ordersForDay = randInt(2, 5);
            for (let o = 0; o < ordersForDay; o++) {
                const numItems = randInt(1, 4);
                const orderItemsData: { menuItemId: string; itemName: string; unitPrice: number; quantity: number; lineTotal: number }[] = [];
                let subtotal = 0;
                for (let i = 0; i < numItems; i++) {
                    const menuItem = rand(menuItems);
                    const qty = randInt(1, 2);
                    const lineTotal = menuItem.price * qty;
                    subtotal += lineTotal;
                    orderItemsData.push({ menuItemId: menuItem.id, itemName: menuItem.name, unitPrice: menuItem.price, quantity: qty, lineTotal });
                }
                const total = subtotal;
                const orderType = rand(orderTypes);
                const pm = rand(paymentMethods);
                const orderDate = daysAgo(day, randInt(12, 22), randInt(0, 59));
                const customer = orderType === 'DELIVERY' || orderType === 'PICKUP' ? rand(customerNames) : null;
                const orderNumber = `${todayStr}-${String(orderCounter).padStart(4, '0')}`;
                orderCounter++;

                await prisma.salesOrder.create({
                    data: {
                        tenantId: tenant.id, areaId: areaPrincipal.id, orderNumber, orderType,
                        status: 'COMPLETED', subtotal, total, discount: 0,
                        paymentMethod: pm, paymentStatus: 'PAID', amountPaid: total,
                        createdById: users.CASHIER.id, customerName: customer,
                        createdAt: orderDate, updatedAt: orderDate,
                        items: { create: orderItemsData.map(d => ({ ...d, tenantId: tenant.id })) },
                    },
                });
            }
        }

        // ─── 9. Algunos Expenses ────────────────────────────────────────
        console.log('9. Gastos de muestra...');
        const expenseDefs = [
            { categoryId: expCatProveedores.id, description: 'Compra MercaCarne (semanal)', amountUsd: 450 },
            { categoryId: expCatProveedores.id, description: 'Compra Frutas y Vegetales',  amountUsd: 180 },
            { categoryId: expCatServicios.id,   description: 'Electricidad enero',          amountUsd: 320 },
            { categoryId: expCatServicios.id,   description: 'Internet + cable',           amountUsd: 95 },
            { categoryId: expCatNomina.id,      description: 'Quincena enero personal',    amountUsd: 2400 },
        ];
        const now = new Date();
        for (const exp of expenseDefs) {
            await prisma.expense.create({
                data: {
                    tenantId: tenant.id, categoryId: exp.categoryId, description: exp.description,
                    amountUsd: exp.amountUsd, status: 'CONFIRMED',
                    paidAt: daysAgo(randInt(1, 14)), createdById: ownerId,
                    periodMonth: now.getMonth() + 1, periodYear: now.getFullYear(),
                },
            });
        }

        console.log('');
        console.log('======================================================');
        console.log(' Demo tenant listo!');
        console.log('======================================================');
        console.log('');
        console.log(`  Login URL:  https://${args.slug}.kpsula.app/login`);
        console.log('');
        console.log('  Credenciales:');
        for (const u of usersToCreate) {
            console.log(`    ${u.role.padEnd(15)} → ${u.email}  /  ${u.password}  (PIN ${u.pin})`);
        }
        console.log('');
        console.log('  Datos cargados:');
        console.log(`    - ${usersToCreate.length} usuarios`);
        console.log(`    - 1 sucursal, 4 áreas, 3 zonas, ${tables.length} mesas`);
        console.log(`    - ${itemDefs.length} items de inventario con stock`);
        console.log(`    - ${menuItemDefs.length} items de menú en 5 categorías`);
        console.log(`    - 2 proveedores`);
        console.log(`    - ~${orderCounter - 1} ventas en los últimos 14 días`);
        console.log(`    - ${expenseDefs.length} gastos de muestra`);
        console.log('');
    } finally {
        await prisma.$disconnect();
    }
}

// ─── Reset (borrar todo lo del tenant) ─────────────────────────────────────

async function resetTenantData(prisma: PrismaClient, tenantId: string) {
    // Borrar en orden de FKs (children primero)
    console.log('  borrando SalesOrderItem...');
    await prisma.salesOrderItem.deleteMany({ where: { tenantId } });
    console.log('  borrando SalesOrder...');
    await prisma.salesOrder.deleteMany({ where: { tenantId } });
    console.log('  borrando OpenTab...');
    await prisma.openTab.deleteMany({ where: { tenantId } });
    console.log('  borrando Expense...');
    await prisma.expense.deleteMany({ where: { tenantId } });
    console.log('  borrando InventoryLocation (vía items)...');
    const items = await prisma.inventoryItem.findMany({ where: { tenantId }, select: { id: true } });
    for (const it of items) {
        await prisma.inventoryLocation.deleteMany({ where: { inventoryItemId: it.id } });
        await prisma.costHistory.deleteMany({ where: { inventoryItemId: it.id } });
    }
    console.log('  borrando MenuItem...');
    await prisma.menuItem.deleteMany({ where: { tenantId } });
    console.log('  borrando MenuCategory...');
    await prisma.menuCategory.deleteMany({ where: { tenantId } });
    console.log('  borrando InventoryItem...');
    await prisma.inventoryItem.deleteMany({ where: { tenantId } });
    console.log('  borrando TableOrStation...');
    await prisma.tableOrStation.deleteMany({ where: { tenantId } });
    console.log('  borrando ServiceZone...');
    await prisma.serviceZone.deleteMany({ where: { tenantId } });
    console.log('  borrando Waiter...');
    await prisma.waiter.deleteMany({ where: { tenantId } });
    console.log('  borrando Area...');
    await prisma.area.deleteMany({ where: { tenantId } });
    console.log('  borrando Branch...');
    await prisma.branch.deleteMany({ where: { tenantId } });
    console.log('  borrando ExchangeRate...');
    await prisma.exchangeRate.deleteMany({ where: { tenantId } });
    console.log('  borrando Supplier...');
    await prisma.supplier.deleteMany({ where: { tenantId } });
    console.log('  borrando ExpenseCategory...');
    await prisma.expenseCategory.deleteMany({ where: { tenantId } });
    console.log('  borrando User...');
    await prisma.user.deleteMany({ where: { tenantId } });
    console.log('  borrando Tenant...');
    await prisma.tenant.delete({ where: { id: tenantId } });
    console.log('  reset completo.');
}

main().catch((err) => {
    console.error('Error fatal:', err instanceof Error ? err.message : err);
    if (err instanceof Error && err.stack) console.error(err.stack);
    process.exit(1);
});
