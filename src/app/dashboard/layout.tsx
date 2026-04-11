import { Sidebar } from '@/components/layout/Sidebar';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { getSession } from '@/lib/auth';
import { getEnabledModulesFromDB } from '@/app/actions/system-config.actions';
import prisma from '@/server/db';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getSession();

    // Leer módulos habilitados desde BD (una sola vez por request, en el servidor)
    const enabledModuleIds = await getEnabledModulesFromDB();

    // Leer módulos permitidos del usuario actual (null = sin restricción extra)
    let userAllowedModules: string[] | null = null;
    if (session?.id) {
        const dbUser = await prisma.user.findUnique({
            where: { id: session.id },
            select: { allowedModules: true },
        });
        if (dbUser?.allowedModules) {
            try {
                userAllowedModules = JSON.parse(dbUser.allowedModules);
            } catch {
                userAllowedModules = null;
            }
        }
    }

    const sidebar = (
        <Sidebar initialUser={session} enabledModuleIds={enabledModuleIds} userAllowedModules={userAllowedModules} />
    );

    return (
        <DashboardShell sidebar={sidebar}>
            {children}
        </DashboardShell>
    );
}
