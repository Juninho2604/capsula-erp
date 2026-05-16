'use server';

/**
 * Acciones SUPER_ADMIN sobre tenants.
 *
 * Suspender = `User.isActive=false` para todos los users del tenant +
 *             `tokenVersion += 1` para invalidar JWTs vivos.
 * Reactivar = `User.isActive=true` para todos los users del tenant.
 *             (No revertimos tokenVersion — los users tendrán que loguearse
 *             de nuevo, que es el comportamiento esperado tras suspensión.)
 *
 * Editar nombre = solo cambia `Tenant.name`. El `slug` NO se cambia desde
 *                 la UI (rompería subdominios y links existentes).
 *
 * Reset password = genera password nueva (o usa la provista), la hashea con
 *                  PBKDF2-SHA256 y `tokenVersion += 1` para invalidar JWTs.
 *                  Solo se permite resetear la del OWNER del tenant.
 *
 * Pagos = registro manual. No suspende automáticamente — eso es feature
 *         futura si el operador lo pide.
 */

import prisma from '@/server/db';
import { getSession } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/super-admin';
import { hashPassword } from '@/lib/password';
import { isReservedSlug } from '@/lib/signup/reserved-slugs';
import { revalidatePath } from 'next/cache';

export interface AdminActionState {
    success: boolean;
    message: string;
    /** Solo para resetPassword: la password en plano para mostrarla una vez. */
    plaintextPassword?: string;
}

async function requireSuperAdmin(): Promise<{ ok: true; userId: string } | { ok: false; state: AdminActionState }> {
    const session = await getSession();
    if (!session || !isSuperAdmin(session.email)) {
        return {
            ok: false,
            state: { success: false, message: 'No autorizado.' },
        };
    }
    return { ok: true, userId: session.id };
}

export async function suspendTenantAction(tenantId: string): Promise<AdminActionState> {
    const auth = await requireSuperAdmin();
    if (!auth.ok) return auth.state;

    if (!tenantId || typeof tenantId !== 'string') {
        return { success: false, message: 'tenantId inválido.' };
    }

    try {
        const res = await prisma.user.updateMany({
            where: { tenantId, isActive: true },
            data: {
                isActive: false,
                tokenVersion: { increment: 1 },
            },
        });
        revalidatePath('/admin/tenants');
        revalidatePath(`/admin/tenants/${tenantId}`);
        return {
            success: true,
            message: `Tenant suspendido. ${res.count} usuario(s) desactivado(s).`,
        };
    } catch (err) {
        console.error('[suspendTenantAction]', err);
        return { success: false, message: 'Error al suspender el tenant.' };
    }
}

export async function reactivateTenantAction(tenantId: string): Promise<AdminActionState> {
    const auth = await requireSuperAdmin();
    if (!auth.ok) return auth.state;

    if (!tenantId || typeof tenantId !== 'string') {
        return { success: false, message: 'tenantId inválido.' };
    }

    try {
        const res = await prisma.user.updateMany({
            where: { tenantId, isActive: false },
            data: { isActive: true },
        });
        revalidatePath('/admin/tenants');
        revalidatePath(`/admin/tenants/${tenantId}`);
        return {
            success: true,
            message: `Tenant reactivado. ${res.count} usuario(s) habilitado(s).`,
        };
    } catch (err) {
        console.error('[reactivateTenantAction]', err);
        return { success: false, message: 'Error al reactivar el tenant.' };
    }
}

export async function updateTenantNameAction(
    tenantId: string,
    newName: string,
): Promise<AdminActionState> {
    const auth = await requireSuperAdmin();
    if (!auth.ok) return auth.state;

    const name = (newName ?? '').trim();
    if (!tenantId || !name || name.length < 2 || name.length > 80) {
        return { success: false, message: 'Nombre inválido (2-80 caracteres).' };
    }

    try {
        await prisma.tenant.update({ where: { id: tenantId }, data: { name } });
        revalidatePath('/admin/tenants');
        revalidatePath(`/admin/tenants/${tenantId}`);
        return { success: true, message: 'Nombre actualizado.' };
    } catch (err) {
        console.error('[updateTenantNameAction]', err);
        return { success: false, message: 'Error al actualizar nombre.' };
    }
}

/**
 * Resetea password del OWNER del tenant. Solo del owner para evitar que un
 * SUPER_ADMIN cambie passwords de cualquier user via UI; otros resets se
 * hacen vía CLI o desde el propio tenant.
 *
 * Si `customPassword` viene vacío/undefined → genera una random de 12 chars.
 * El plaintext se devuelve UNA sola vez en el state para mostrarse al admin.
 */
export async function resetOwnerPasswordAction(
    tenantId: string,
    customPassword?: string,
): Promise<AdminActionState> {
    const auth = await requireSuperAdmin();
    if (!auth.ok) return auth.state;

    if (!tenantId) return { success: false, message: 'tenantId inválido.' };

    const owner = await prisma.user.findFirst({
        where: { tenantId, role: 'OWNER' },
        orderBy: { createdAt: 'asc' },
    });
    if (!owner) return { success: false, message: 'No se encontró un OWNER en este tenant.' };

    let plaintext = (customPassword ?? '').trim();
    if (plaintext && plaintext.length < 8) {
        return { success: false, message: 'Password debe tener ≥ 8 caracteres.' };
    }
    if (!plaintext) {
        plaintext = generateRandomPassword(12);
    }

    try {
        const passwordHash = await hashPassword(plaintext);
        await prisma.user.update({
            where: { id: owner.id },
            data: { passwordHash, tokenVersion: { increment: 1 } },
        });
        revalidatePath(`/admin/tenants/${tenantId}`);
        return {
            success: true,
            message: `Password reseteada para ${owner.email}. Copiala ahora — no se vuelve a mostrar.`,
            plaintextPassword: plaintext,
        };
    } catch (err) {
        console.error('[resetOwnerPasswordAction]', err);
        return { success: false, message: 'Error al resetear password.' };
    }
}

function generateRandomPassword(len: number): string {
    // Alfabeto sin chars ambiguos (0/O, 1/l/I) — más fácil de dictar.
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(len));
    let out = '';
    for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
    return out;
}

// ─── Billing: registro manual de pagos ──────────────────────────────────────

export async function recordTenantPaymentAction(input: {
    tenantId: string;
    amount: number;
    currency: string;
    paidAt: string; // ISO date (yyyy-mm-dd o full ISO)
    method: string;
    periodStart?: string;
    periodEnd?: string;
    note?: string;
}): Promise<AdminActionState> {
    const auth = await requireSuperAdmin();
    if (!auth.ok) return auth.state;

    const { tenantId, amount, currency, paidAt, method } = input;
    if (!tenantId) return { success: false, message: 'tenantId inválido.' };
    if (!Number.isFinite(amount) || amount <= 0) {
        return { success: false, message: 'Monto inválido.' };
    }
    if (!currency || currency.length > 6) {
        return { success: false, message: 'Currency inválida.' };
    }
    if (!method || method.length > 30) {
        return { success: false, message: 'Método inválido.' };
    }
    const paid = new Date(paidAt);
    if (Number.isNaN(paid.getTime())) {
        return { success: false, message: 'Fecha de pago inválida.' };
    }
    const periodStart = input.periodStart ? new Date(input.periodStart) : null;
    const periodEnd = input.periodEnd ? new Date(input.periodEnd) : null;
    if (periodStart && Number.isNaN(periodStart.getTime())) {
        return { success: false, message: 'Período desde inválido.' };
    }
    if (periodEnd && Number.isNaN(periodEnd.getTime())) {
        return { success: false, message: 'Período hasta inválido.' };
    }

    try {
        await prisma.tenantPayment.create({
            data: {
                tenantId,
                amount,
                currency: currency.toUpperCase(),
                paidAt: paid,
                method,
                periodStart,
                periodEnd,
                note: input.note?.trim() || null,
                recordedById: auth.userId,
            },
        });
        revalidatePath(`/admin/tenants/${tenantId}`);
        return { success: true, message: 'Pago registrado.' };
    } catch (err) {
        console.error('[recordTenantPaymentAction]', err);
        return { success: false, message: 'Error al registrar pago.' };
    }
}

// ─── Crear tenant desde UI ──────────────────────────────────────────────────

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,29}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CreateTenantState extends AdminActionState {
    /** Solo si success: redirigir al detalle del tenant creado. */
    tenantId?: string;
}

/**
 * Áreas default que se siembran al crear un tenant nuevo (si seedDefaults=true).
 * Sin estas, el OWNER loggea y no puede operar (no hay InventoryLocation, no
 * hay daily inventory, no hay destino para requisitions ni procesamientos).
 */
const DEFAULT_SEED_AREAS = [
    { name: 'Almacén',     description: 'Stock principal' },
    { name: 'Cocina',      description: 'Producción de comida caliente' },
    { name: 'Bar',         description: 'Bebidas y bar' },
    { name: 'Producción',  description: 'Procesamiento y preparación' },
];

export async function createTenantAction(input: {
    slug: string;
    name: string;
    ownerEmail: string;
    ownerPassword: string;
    ownerFirstName: string;
    ownerLastName: string;
    /** Por default true: siembra áreas básicas para que el OWNER pueda operar. */
    seedDefaults?: boolean;
}): Promise<CreateTenantState> {
    const auth = await requireSuperAdmin();
    if (!auth.ok) return auth.state;

    const slug = (input.slug ?? '').trim().toLowerCase();
    const name = (input.name ?? '').trim();
    const ownerEmail = (input.ownerEmail ?? '').trim().toLowerCase();
    const ownerPassword = input.ownerPassword ?? '';
    const ownerFirstName = (input.ownerFirstName ?? '').trim();
    const ownerLastName = (input.ownerLastName ?? '').trim();

    if (!SLUG_RE.test(slug)) {
        return {
            success: false,
            message:
                'Slug inválido. 2-30 chars, solo minúsculas, dígitos y guiones; empezar por letra/dígito.',
        };
    }
    if (isReservedSlug(slug)) {
        return { success: false, message: `Slug "${slug}" está reservado.` };
    }
    if (name.length < 2 || name.length > 100) {
        return { success: false, message: 'Nombre del negocio inválido (2-100 chars).' };
    }
    if (!EMAIL_RE.test(ownerEmail) || ownerEmail.length > 200) {
        return { success: false, message: 'Email del owner inválido.' };
    }
    if (ownerPassword.length < 8 || ownerPassword.length > 200) {
        return { success: false, message: 'Password del owner debe tener entre 8 y 200 caracteres.' };
    }
    if (ownerFirstName.length < 1 || ownerFirstName.length > 50) {
        return { success: false, message: 'Nombre del owner inválido (1-50 chars).' };
    }
    if (ownerLastName.length < 1 || ownerLastName.length > 50) {
        return { success: false, message: 'Apellido del owner inválido (1-50 chars).' };
    }

    try {
        const existing = await prisma.tenant.findUnique({
            where: { slug },
            select: { id: true, name: true },
        });
        if (existing) {
            return {
                success: false,
                message: `Slug "${slug}" ya existe (tenant: ${existing.name}).`,
            };
        }

        const passwordHash = await hashPassword(ownerPassword);

        const result = await prisma.$transaction(async (tx) => {
            const tenant = await tx.tenant.create({
                data: { slug, name },
                select: { id: true, slug: true, name: true },
            });
            await tx.user.create({
                data: {
                    tenantId: tenant.id,
                    email: ownerEmail,
                    passwordHash,
                    firstName: ownerFirstName,
                    lastName: ownerLastName,
                    role: 'OWNER',
                    isActive: true,
                },
            });
            const branch = await tx.branch.create({
                data: {
                    tenantId: tenant.id,
                    code: 'MAIN',
                    name,
                    timezone: 'America/Caracas',
                    currencyCode: 'USD',
                    isActive: true,
                },
                select: { id: true },
            });

            // Seed mínimo: áreas básicas para que el OWNER pueda operar de una.
            // Sin esto loggea y ve todo vacío — no puede ni recibir mercancía.
            const shouldSeed = input.seedDefaults !== false;
            if (shouldSeed) {
                await tx.area.createMany({
                    data: DEFAULT_SEED_AREAS.map((a) => ({
                        tenantId: tenant.id,
                        branchId: branch.id,
                        name: a.name,
                        description: a.description,
                        isActive: true,
                    })),
                });
            }

            return tenant;
        });

        revalidatePath('/admin/tenants');
        return {
            success: true,
            message: `Tenant "${name}" creado. Owner: ${ownerEmail}.`,
            tenantId: result.id,
        };
    } catch (err) {
        console.error('[createTenantAction]', err);
        return {
            success: false,
            message: `Error al crear tenant: ${err instanceof Error ? err.message : 'desconocido'}.`,
        };
    }
}

export async function deleteTenantPaymentAction(
    paymentId: string,
): Promise<AdminActionState> {
    const auth = await requireSuperAdmin();
    if (!auth.ok) return auth.state;

    if (!paymentId) return { success: false, message: 'paymentId inválido.' };

    try {
        const p = await prisma.tenantPayment.delete({ where: { id: paymentId } });
        revalidatePath(`/admin/tenants/${p.tenantId}`);
        return { success: true, message: 'Pago eliminado.' };
    } catch (err) {
        console.error('[deleteTenantPaymentAction]', err);
        return { success: false, message: 'Error al eliminar pago.' };
    }
}
