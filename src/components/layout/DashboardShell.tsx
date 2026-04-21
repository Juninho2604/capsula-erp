'use client';

import { useUIStore } from '@/stores/ui.store';
import { Minimize2 } from 'lucide-react';
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
                    className="fixed bottom-4 right-4 z-[80] inline-flex items-center gap-1.5 rounded-full bg-capsula-navy-deep px-3.5 py-2 text-xs font-medium text-capsula-ivory shadow-cap-raised backdrop-blur-sm transition-all hover:bg-capsula-navy"
                >
                    <Minimize2 className="h-3.5 w-3.5" strokeWidth={1.75} />
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
