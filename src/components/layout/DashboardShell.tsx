'use client';

import { useUIStore } from '@/stores/ui.store';
import { Navbar } from './Navbar';

interface DashboardShellProps {
    sidebar: React.ReactNode;
    children: React.ReactNode;
}

export function DashboardShell({ sidebar, children }: DashboardShellProps) {
    const { posFullscreen, togglePosFullscreen } = useUIStore();

    if (posFullscreen) {
        return (
            <div className="h-screen w-screen overflow-hidden bg-background">
                {children}
                {/* Floating exit button — bottom-right, z above POS modals */}
                <button
                    onClick={togglePosFullscreen}
                    title="Salir de pantalla completa"
                    className="fixed bottom-4 right-4 z-[80] flex items-center gap-1.5 rounded-xl bg-gray-900/80 px-3 py-2 text-xs font-medium text-white shadow-lg backdrop-blur-sm transition-all hover:bg-gray-800 dark:bg-gray-100/20 dark:hover:bg-gray-100/30"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8 3v3a2 2 0 0 1-2 2H3" />
                        <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
                        <path d="M3 16h3a2 2 0 0 1 2 2v3" />
                        <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
                    </svg>
                    Salir POS
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {sidebar}
            <div className="md:pl-64">
                <Navbar />
                <main className="min-h-[calc(100vh-4rem)] p-4 md:p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
