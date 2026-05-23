import { getSession } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/super-admin';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, LayoutDashboard, Users, ArrowUpRight } from 'lucide-react';

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
                <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
                    <Link href="/admin" className="inline-flex items-center gap-3 text-capsula-cream">
                        <ShieldCheck className="h-5 w-5" />
                        <span className="font-semibold tracking-[-0.02em]">Panel SUPER_ADMIN</span>
                    </Link>
                    <nav className="inline-flex items-center gap-1 text-sm">
                        <Link
                            href="/admin"
                            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-capsula-cream/80 hover:bg-capsula-cream/10 hover:text-capsula-cream"
                        >
                            <LayoutDashboard className="h-3.5 w-3.5" />
                            Dashboard
                        </Link>
                        <Link
                            href="/admin/tenants"
                            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-capsula-cream/80 hover:bg-capsula-cream/10 hover:text-capsula-cream"
                        >
                            <Users className="h-3.5 w-3.5" />
                            Tenants
                        </Link>
                    </nav>
                    <div className="inline-flex items-center gap-3">
                        <Link
                            href="/dashboard/home"
                            className="inline-flex items-center gap-1.5 rounded-full border border-capsula-cream/20 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-cream/80 hover:bg-capsula-cream/10 hover:text-capsula-cream"
                            title="Salir del panel SUPER_ADMIN y entrar al dashboard del tenant del usuario"
                        >
                            Ver dashboard
                            <ArrowUpRight className="h-3 w-3" />
                        </Link>
                        <span className="text-[11px] uppercase tracking-[0.14em] text-capsula-cream/70">
                            {session.email}
                        </span>
                    </div>
                </div>
            </header>
            <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        </div>
    );
}
