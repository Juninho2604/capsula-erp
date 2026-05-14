import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import NewTenantForm from './new-tenant-form';

/**
 * Form para crear un tenant nuevo desde el panel SUPER_ADMIN.
 * Equivalente UI del script `scripts/create-tenant.ts`. Auth ya gated por layout.
 */
export default function NewTenantPage() {
    return (
        <div className="space-y-6">
            <Link
                href="/admin/tenants"
                className="inline-flex items-center gap-1 text-sm text-capsula-ink-soft hover:text-capsula-coral"
            >
                <ArrowLeft className="h-3.5 w-3.5" />
                Tenants
            </Link>

            <div>
                <h1 className="text-2xl font-semibold tracking-[-0.02em] text-capsula-ink">
                    Crear tenant nuevo
                </h1>
                <p className="mt-1 text-sm text-capsula-ink-soft">
                    Se creará el tenant + un usuario OWNER + una sucursal MAIN en una sola
                    transacción. El owner deberá cambiar su password al primer login.
                </p>
            </div>

            <NewTenantForm />
        </div>
    );
}
