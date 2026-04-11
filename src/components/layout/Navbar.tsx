'use client';

import { useAuthStore } from '@/stores/auth.store';
import { useUIStore } from '@/stores/ui.store';
import { HelpPanel } from './HelpPanel';
import { NotificationBell } from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';

export function Navbar() {
    const { user } = useAuthStore();
    const { toggleSidebar, posFullscreen, togglePosFullscreen } = useUIStore();

    return (
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-gray-200 bg-white/80 px-6 backdrop-blur-md dark:border-gray-700 dark:bg-gray-900/80">
            {/* Left side - Hamburger + Breadcrumb */}
            <div className="flex items-center gap-4">
                {/* Mobile hamburger */}
                <button
                    onClick={toggleSidebar}
                    className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 md:hidden"
                    aria-label="Toggle Sidebar"
                >
                    <span className="text-xl">☰</span>
                </button>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {user?.firstName ? `${user.firstName}` : 'CAPSULA ERP'}
                </h2>
            </div>

            {/* Right side - Actions */}
            <div className="flex items-center gap-2">
                {/* Fullscreen POS toggle */}
                <button
                    onClick={togglePosFullscreen}
                    title={posFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa (POS)'}
                    className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                    {posFullscreen ? (
                        /* Minimize / compress icon */
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M8 3v3a2 2 0 0 1-2 2H3" />
                            <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
                            <path d="M3 16h3a2 2 0 0 1 2 2v3" />
                            <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
                        </svg>
                    ) : (
                        /* Maximize / expand icon */
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 3 21 3 21 9" />
                            <polyline points="9 21 3 21 3 15" />
                            <line x1="21" y1="3" x2="14" y2="10" />
                            <line x1="3" y1="21" x2="10" y2="14" />
                        </svg>
                    )}
                </button>
                {/* Toggle Dark/Light mode */}
                <ThemeToggle />
                {/* Notificaciones del sistema */}
                <NotificationBell />
                {/* Help Panel con guía por módulo */}
                <HelpPanel />

                {/* Date/Time */}
                <div className="hidden text-sm text-gray-500 lg:block px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg font-medium">
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
