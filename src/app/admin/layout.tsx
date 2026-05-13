import { getSession } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/super-admin';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

/**
 * Layout de /admin/*. Doble check del middleware: rechaza render server-side
 * si el usuario no está en la SUPER_ADMIN_EMAILS allowlist. Render como 404
 * para no leakear la existencia del panel.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const session = await getSession();
    if (!session || !isSuperAdmin(session.email)) {
        notFound();
    }

    return (
        <div className="min-h-screen bg-capsula-ivory">
            <header className="border-b border-capsula-line bg-capsula-navy-deep">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
                    <Link href="/admin/tenants" className="inline-flex items-center gap-3 text-capsula-cream">
                        <ShieldCheck className="h-5 w-5" />
                        <span className="font-semibold tracking-[-0.02em]">Panel SUPER_ADMIN</span>
                    </Link>
                    <span className="text-[11px] uppercase tracking-[0.14em] text-capsula-cream/70">
                        {session.email}
                    </span>
                </div>
            </header>
            <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        </div>
    );
}
