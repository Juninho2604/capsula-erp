'use client';

import { useAuthStore } from '@/stores/auth.store';
import { useUIStore } from '@/stores/ui.store';
import { Menu, Maximize2, Minimize2 } from 'lucide-react';
import { HelpPanel } from './HelpPanel';
import { NotificationBell } from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';

export function Navbar() {
    const { user } = useAuthStore();
    const { toggleSidebar, posFullscreen, togglePosFullscreen } = useUIStore();

    return (
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-capsula-line bg-capsula-ivory/85 px-6 backdrop-blur-md">
            {/* Left side - Hamburger + Breadcrumb */}
            <div className="flex items-center gap-4">
                {/* Mobile hamburger */}
                <button
                    onClick={toggleSidebar}
                    className="rounded-lg p-2 text-capsula-ink-muted transition-colors hover:bg-capsula-ivory-alt hover:text-capsula-ink md:hidden"
                    aria-label="Toggle Sidebar"
                >
                    <Menu className="h-5 w-5" strokeWidth={1.75} />
                </button>
                <h2 className="font-heading text-lg tracking-[-0.01em] text-capsula-navy-deep">
                    {user?.firstName ? `${user.firstName}` : 'CÁPSULA'}
                </h2>
            </div>

            {/* Right side - Actions */}
            <div className="flex items-center gap-2">
                {/* Fullscreen POS toggle */}
                <button
                    onClick={togglePosFullscreen}
                    title={posFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa (POS)'}
                    className="rounded-lg p-2 text-capsula-ink-muted transition-colors hover:bg-capsula-ivory-alt hover:text-capsula-ink"
                >
                    {posFullscreen
                        ? <Minimize2 className="h-[18px] w-[18px]" strokeWidth={1.75} />
                        : <Maximize2 className="h-[18px] w-[18px]" strokeWidth={1.75} />}
                </button>
                {/* Toggle Dark/Light mode */}
                <ThemeToggle />
                {/* Notificaciones del sistema */}
                <NotificationBell />
                {/* Help Panel con guía por módulo */}
                <HelpPanel />

                {/* Date/Time */}
                <div className="hidden rounded-full border border-capsula-line bg-capsula-ivory-surface px-3 py-1.5 font-mono text-[12px] font-medium text-capsula-ink-soft lg:block">
                    {new Date().toLocaleDateString('es-VE', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        timeZone: 'America/Caracas',
                    })}
                </div>
            </div>
        </header>
    );
}
