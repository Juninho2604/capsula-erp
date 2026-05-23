'use server';

/**
 * Menú — multitenant (Lote 3.c — Fase 3 Paso D.b).
 *
 * Modelos tenant-aware: MenuCategory, MenuItem, Recipe, InventoryItem.
 * Todos los queries pasan por `db = withTenant(tenantId)`.
 *
 * Validaciones de ownership añadidas:
 *   - createMenuItemAction: data.categoryId
 *   - linkMenuItemToRecipeAction: menuItemId y recipeId
 *   - createRecipeStubForMenuItemAction: findUnique → findFirst (tenant-safe)
 */

import prisma from '@/server/db';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';

// ============================================================================
// TIPOS
// ============================================================================

export interface MenuItemData {
    name: string;
    description?: string;
    price: number;
    categoryId: string;
    sku?: string;
    isActive?: boolean;
}

export interface ActionResult {
    success: boolean;
    message: string;
    data?: any;
}

// ============================================================================
// LECTURA
// ============================================================================

export async function getFullMenuAction() {
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const categories = await db.menuCategory.findMany({
            include: {
                items: {
                    orderBy: { name: 'asc' },
                },
            },
            orderBy: { sortOrder: 'asc' }
        });

        // Fetch recipe ingredient counts for items that have a recipeId (tenant-scoped)
        const allItems = categories.flatMap((c) => c.items);
        const recipeIds = allItems.map((i) => i.recipeId).filter(Boolean) as string[];
        const recipesWithCounts = recipeIds.length
            ? await db.recipe.findMany({
                  where: { id: { in: recipeIds } },
                  select: { id: true, _count: { select: { ingredients: true } } },
              })
            : [];
        const recipeCountMap = new Map(recipesWithCounts.map((r) => [r.id, r._count.ingredients]));

        // Enrich each item with _recipeIngredientCount
        const enrichedCategories = categories.map((cat) => ({
            ...cat,
            items: cat.items.map((item) => ({
                ...item,
                _recipeIngredientCount: item.recipeId ? (recipeCountMap.get(item.recipeId) ?? 0) : null,
            })),
        }));

        return { success: true, data: enrichedCategories };
    } catch (error) {
        console.error('Error fetching menu:', error);
        return { success: false, message: 'Error al cargar el menú' };
    }
}

export async function getCategoriesAction() {
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const categories = await db.menuCategory.findMany({
            orderBy: { sortOrder: 'asc' }
        });
        return { success: true, data: categories };
    } catch (error) {
        return { success: false, message: 'Error al cargar categorías' };
    }
}

// ============================================================================
// ESCRITURA
// ============================================================================

export async function createMenuItemAction(data: MenuItemData): Promise<ActionResult> {
    try {
        const session = await getSession();
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);

        // Validar que la categoría pertenece al tenant antes de crear.
        const ownedCategory = await db.menuCategory.findFirst({ where: { id: data.categoryId } });
        if (!ownedCategory) return { success: false, message: 'Categoría no encontrada' };

        // Generar SKU automático si no viene
        let sku = data.sku;
        if (!sku) {
            const prefix = data.name.substring(0, 3).toUpperCase();
            const count = await db.menuItem.count();
            sku = `${prefix}-${String(count + 1).padStart(3, '0')}`;
        }

        const newItem = await db.menuItem.create({
            data: {
                tenantId,
                name: data.name,
                description: data.description,
                price: parseFloat(data.price.toString()),
                categoryId: data.categoryId,
                sku: sku,
                isActive: data.isActive ?? true,
            }
        });

        // AUTO-CREAR STUB DE RECETA vinculado al item del menú
        try {
            const invSku = `FG-${data.name.substring(0, 5).toUpperCase().replace(/\s/g, '')}-${Date.now().toString().slice(-4)}`;
            const invItem = await db.inventoryItem.create({
                data: {
                    tenantId,
                    name: data.name,
                    sku: invSku,
                    type: 'FINISHED_GOOD',
                    baseUnit: 'PORCION',
                    isActive: true,
                    description: data.description,
                    category: 'MENU',
                }
            });

            const recipe = await db.recipe.create({
                data: {
                    tenantId,
                    name: data.name,
                    description: `Receta de ${data.name} - completar ingredientes`,
                    outputItemId: invItem.id,
                    outputQuantity: 1,
                    outputUnit: 'PORCION',
                    yieldPercentage: 100,
                    isApproved: true,
                    createdById: session?.id ?? null,
                }
            });

            await db.menuItem.updateMany({
                where: { id: newItem.id },
                data: { recipeId: recipe.id }
            });
        } catch (recipeErr) {
            // No fallamos la creación del item si la receta falla
            console.warn('No se pudo auto-crear receta stub:', recipeErr);
        }

        revalidatePath('/dashboard/menu');
        revalidatePath('/dashboard/pos/restaurante');
        revalidatePath('/dashboard/pos/delivery');
        revalidatePath('/dashboard/recetas');

        return { success: true, message: 'Producto creado con receta vacía lista para completar', data: newItem };
    } catch (error) {
        console.error('Error creating item:', error);
        return { success: false, message: 'Error al crear el producto' };
    }
}

export async function updateMenuItemPriceAction(id: string, newPrice: number): Promise<ActionResult> {
    try {
        const { tenantId } = await resolveTenantContext();
        const res = await withTenant(tenantId).menuItem.updateMany({
            where: { id },
            data: { price: parseFloat(newPrice.toString()) }
        });
        if (res.count === 0) return { success: false, message: 'Producto no encontrado' };

        revalidatePath('/dashboard/menu');
        revalidatePath('/dashboard/pos/restaurante');
        revalidatePath('/dashboard/pos/delivery');

        return { success: true, message: 'Precio actualizado' };
    } catch (error) {
        return { success: false, message: 'Error al actualizar precio' };
    }
}

export async function toggleMenuItemStatusAction(id: string, isActive: boolean): Promise<ActionResult> {
    try {
        const { tenantId } = await resolveTenantContext();
        const res = await withTenant(tenantId).menuItem.updateMany({
            where: { id },
            data: { isActive }
        });
        if (res.count === 0) return { success: false, message: 'Producto no encontrado' };

        revalidatePath('/dashboard/menu');
        revalidatePath('/dashboard/pos/restaurante');

        return { success: true, message: isActive ? 'Producto activado' : 'Producto desactivado' };
    } catch (error) {
        return { success: false, message: 'Error al cambiar estado' };
    }
}

export async function updateMenuItemNameAction(id: string, newName: string): Promise<ActionResult> {
    try {
        if (!newName.trim()) return { success: false, message: 'El nombre no puede estar vacío' };

        const { tenantId } = await resolveTenantContext();
        const res = await withTenant(tenantId).menuItem.updateMany({
            where: { id },
            data: { name: newName.trim() }
        });
        if (res.count === 0) return { success: false, message: 'Producto no encontrado' };

        revalidatePath('/dashboard/menu');
        revalidatePath('/dashboard/pos/restaurante');
        revalidatePath('/dashboard/pos/delivery');
        revalidatePath('/dashboard/ventas/cargar');

        return { success: true, message: 'Nombre actualizado' };
    } catch (error) {
        return { success: false, message: 'Error al actualizar nombre' };
    }
}

// ============================================================================
// RECETAS VINCULADAS AL MENÚ
// ============================================================================

/**
 * Retorna los items del menú que NO tienen receta asignada
 */
export async function getMenuItemsWithoutRecipeAction() {
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const items = await db.menuItem.findMany({
            where: {
                isActive: true,
                recipeId: null,
            },
            include: {
                category: { select: { name: true } }
            },
            orderBy: [{ category: { sortOrder: 'asc' } }, { name: 'asc' }]
        });
        return { success: true, data: items };
    } catch (error) {
        console.error('Error fetching items without recipe:', error);
        return { success: false, message: 'Error al cargar items sin receta', data: [] };
    }
}

/**
 * Vincula manualmente un MenuItem a una Receta existente
 */
export async function linkMenuItemToRecipeAction(menuItemId: string, recipeId: string): Promise<ActionResult> {
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);

        // Validar ownership de ambos antes de vincular.
        const [item, recipe] = await Promise.all([
            db.menuItem.findFirst({ where: { id: menuItemId } }),
            db.recipe.findFirst({ where: { id: recipeId } }),
        ]);
        if (!item) return { success: false, message: 'Item no encontrado' };
        if (!recipe) return { success: false, message: 'Receta no encontrada' };

        await db.menuItem.updateMany({
            where: { id: menuItemId },
            data: { recipeId }
        });
        revalidatePath('/dashboard/menu');
        revalidatePath('/dashboard/recetas');
        return { success: true, message: 'Receta vinculada exitosamente' };
    } catch (error) {
        return { success: false, message: 'Error al vincular receta' };
    }
}

/**
 * Auto-crea stub de receta para un MenuItem existente que no tiene receta
 */
export async function createRecipeStubForMenuItemAction(menuItemId: string): Promise<ActionResult> {
    try {
        const session = await getSession();
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);

        const menuItem = await db.menuItem.findFirst({ where: { id: menuItemId } });
        if (!menuItem) return { success: false, message: 'Item no encontrado' };
        if (menuItem.recipeId) return { success: false, message: 'El item ya tiene receta' };

        const invSku = `FG-${menuItem.name.substring(0, 5).toUpperCase().replace(/\s/g, '')}-${Date.now().toString().slice(-4)}`;
        const invItem = await db.inventoryItem.create({
            data: {
                tenantId,
                name: menuItem.name,
                sku: invSku,
                type: 'FINISHED_GOOD',
                baseUnit: 'PORCION',
                isActive: true,
                category: 'MENU',
            }
        });

        const recipe = await db.recipe.create({
            data: {
                tenantId,
                name: menuItem.name,
                description: `Receta de ${menuItem.name} - completar ingredientes`,
                outputItemId: invItem.id,
                outputQuantity: 1,
                outputUnit: 'PORCION',
                yieldPercentage: 100,
                isApproved: true,
                createdById: session?.id ?? null,
            }
        });

        await db.menuItem.updateMany({
            where: { id: menuItemId },
            data: { recipeId: recipe.id }
        });

        revalidatePath('/dashboard/menu');
        revalidatePath('/dashboard/recetas');
        return { success: true, message: 'Receta stub creada exitosamente', data: { recipeId: recipe.id } };
    } catch (error) {
        console.error('Error creating recipe stub:', error);
        return { success: false, message: 'Error al crear receta stub' };
    }
}

// ============================================================================
// QUICK-ADD: PRODUCTO DE REVENTA (Pepsi, agua, bebidas, snacks, etc.)
// ============================================================================
//
// Para productos que se compran y se revenden tal cual (no preparados), crea
// en una sola transacción: InventoryItem + InventoryLocation + CostHistory +
// Recipe (self-referencing 1:1) + MenuItem con recipeId vinculado.
//
// Pensado para que personas no técnicas carguen "Pepsi 355ml" desde UNA
// pantalla en lugar de las 4 actuales (inventario / menú / receta / link).
//
// Cuando se vende, el flujo de descuento existente (sales-entry.actions.ts)
// resta 1 unidad del InventoryItem automáticamente — sin código nuevo allí.
//
// Idempotencia: si el SKU autogenerado ya existe, falla con mensaje claro.
// El operador puede pasar `sku` explícito o cambiar el `name`.

export interface CreateResaleProductInput {
    name: string;                     // "Pepsi 355ml"
    categoryId: string;               // Categoría del menú (Bebidas)
    salePrice: number;                // Precio de venta en USD
    unitCost: number;                 // Costo unitario actual
    initialStock: number;             // Stock físico al momento de cargar
    baseUnit: string;                 // 'UNIT' | 'L' | 'ML' | 'G' | 'KG'
    areaId: string;                   // Dónde está guardado el stock
    sku?: string;                     // Auto si no se pasa
    description?: string;
    inventoryCategory?: string;       // Categoría del inventario (default: igual al menú)
}

function autoSkuFromName(name: string): string {
    const cleaned = name
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toUpperCase().replace(/[^A-Z0-9\s]/g, '').trim();
    const prefix = cleaned.split(/\s+/).slice(0, 3).map(w => w.slice(0, 4)).join('-');
    const suffix = Date.now().toString().slice(-4);
    return `${prefix}-${suffix}`.slice(0, 40);
}

export async function createResaleProductAction(
    input: CreateResaleProductInput,
): Promise<ActionResult> {
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);

        // ── Validaciones de entrada ──────────────────────────────────────────
        const name = (input.name || '').trim();
        if (name.length < 2 || name.length > 100) {
            return { success: false, message: 'Nombre inválido (2-100 caracteres).' };
        }
        if (!input.categoryId) return { success: false, message: 'Falta categoría del menú.' };
        if (!input.areaId) return { success: false, message: 'Falta área de stock.' };
        if (!(input.salePrice > 0)) return { success: false, message: 'Precio de venta debe ser > 0.' };
        if (input.unitCost < 0) return { success: false, message: 'Costo no puede ser negativo.' };
        if (input.initialStock < 0) return { success: false, message: 'Stock no puede ser negativo.' };
        const baseUnit = (input.baseUnit || 'UNIT').toUpperCase();

        // ── Validar FKs antes de tocar nada ──────────────────────────────────
        const [category, area] = await Promise.all([
            db.menuCategory.findFirst({ where: { id: input.categoryId } }),
            db.area.findFirst({ where: { id: input.areaId } }),
        ]);
        if (!category) return { success: false, message: 'Categoría del menú no encontrada.' };
        if (!area) return { success: false, message: 'Área no encontrada.' };

        const sku = (input.sku?.trim() || autoSkuFromName(name)).toUpperCase();

        // ── Chequear que no haya colisión de SKU (menú o inventario) ─────────
        const [existingMenu, existingInv] = await Promise.all([
            db.menuItem.findFirst({ where: { sku } }),
            db.inventoryItem.findFirst({ where: { sku } }),
        ]);
        if (existingMenu) {
            return { success: false, message: `Ya existe un plato con SKU "${sku}". Cambiá el nombre o pasá un SKU distinto.` };
        }
        if (existingInv) {
            return { success: false, message: `Ya existe un item de inventario con SKU "${sku}". Cambiá el nombre o pasá un SKU distinto.` };
        }

        // ── Crear todo en transacción ────────────────────────────────────────
        const result = await db.$transaction(async (tx) => {
            // 1. InventoryItem (lo que está físicamente en stock)
            const invItem = await tx.inventoryItem.create({
                data: {
                    tenantId,
                    name,
                    sku,
                    type: 'RAW_MATERIAL',
                    baseUnit,
                    isActive: true,
                    category: input.inventoryCategory ?? category.name,
                    description: input.description ?? null,
                },
            });

            // 2. Stock inicial en el área indicada
            await tx.inventoryLocation.create({
                data: {
                    inventoryItemId: invItem.id,
                    areaId: input.areaId,
                    currentStock: input.initialStock,
                },
            });

            // 3. Costo unitario (CostHistory abre un periodo "vigente")
            if (input.unitCost > 0) {
                await tx.costHistory.create({
                    data: {
                        inventoryItemId: invItem.id,
                        costPerUnit: input.unitCost,
                        currency: 'USD',
                        isCalculated: false,
                        effectiveFrom: new Date(),
                        effectiveTo: null,
                        reason: 'Quick-add producto de reventa',
                        createdById: session.id,
                    },
                });
            }

            // 4. Recipe self-referencing 1:1 (output = mismo item, ingrediente = mismo item).
            //    Esto hace que al vender, el flujo de descuento existente
            //    (sales-entry.actions.ts) reste 1 unidad del InventoryItem.
            const recipe = await tx.recipe.create({
                data: {
                    tenantId,
                    name: `Receta ${name}`,
                    description: `Producto de reventa 1:1 — vender 1 ${baseUnit.toLowerCase()} consume 1 ${baseUnit.toLowerCase()} de stock`,
                    outputItemId: invItem.id,
                    outputQuantity: 1,
                    outputUnit: baseUnit,
                    yieldPercentage: 100,
                    isApproved: true,
                    isActive: true,
                    createdById: session.id,
                },
            });
            await tx.recipeIngredient.create({
                data: {
                    recipeId: recipe.id,
                    ingredientItemId: invItem.id,
                    quantity: 1,
                    unit: baseUnit,
                },
            });

            // 5. MenuItem vinculado a la recipe
            const menuItem = await tx.menuItem.create({
                data: {
                    tenantId,
                    sku,
                    name,
                    price: input.salePrice,
                    cost: input.unitCost > 0 ? input.unitCost : null,
                    categoryId: input.categoryId,
                    recipeId: recipe.id,
                    isActive: true,
                    isAvailable: true,
                    description: input.description ?? null,
                },
            });

            return {
                menuItemId: menuItem.id,
                inventoryItemId: invItem.id,
                recipeId: recipe.id,
                sku,
            };
        });

        revalidatePath('/dashboard/menu');
        revalidatePath('/dashboard/inventario');
        revalidatePath('/dashboard/recetas');

        return {
            success: true,
            message: `"${name}" creado. Stock inicial: ${input.initialStock} ${baseUnit.toLowerCase()}. Precio venta: $${input.salePrice.toFixed(2)}.`,
            data: result,
        };
    } catch (err) {
        console.error('[createResaleProductAction]', err);
        return {
            success: false,
            message: `Error creando producto: ${err instanceof Error ? err.message : 'desconocido'}.`,
        };
    }
}

// ============================================================================
// UTILIDAD: SEED CATEGORÍAS (Si está vacío)
// ============================================================================

export async function ensureBasicCategoriesAction() {
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const count = await db.menuCategory.count();
        if (count === 0) {
            // Categorías base para un tenant nuevo. Nombres genéricos —
            // el cliente las renombra/elimina desde la UI. NO incluir
            // campos que no existan en schema (ej. `icon`) o Prisma lanza
            // "Unknown argument" y la action revienta el flow del frontend.
            const basicCats = [
                { name: 'Platos', sortOrder: 1 },
                { name: 'Acompañantes', sortOrder: 2 },
                { name: 'Bebidas', sortOrder: 3 },
                { name: 'Postres', sortOrder: 4 },
            ];

            for (const cat of basicCats) {
                await db.menuCategory.create({ data: { tenantId, ...cat } });
            }
            return { success: true, message: 'Categorías base creadas' };
        }
        return { success: true, message: 'Categorías ya existen' };
    } catch (error) {
        console.error('[ensureBasicCategories] error:', error);
        // No lanzamos — el caller (page del módulo de menú) debe poder
        // mostrar UI vacía aunque el seed falle. Mejor menú vacío con botón
        // "Crear categoría" que loading infinito.
        return { success: false, message: 'Error inicializando categorías base' };
    }
}
