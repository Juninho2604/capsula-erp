'use client';

import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    // Evitar errores de hidratación
    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <div className="h-10 w-10 rounded-lg bg-capsula-ivory-alt" />
        );
    }

    return (
        <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-capsula-ivory-alt text-capsula-ink-muted transition-all hover:bg-capsula-navy-soft hover:text-capsula-ink"
            aria-label="Cambiar tema"
        >
            {theme === 'dark' ? (
                <Sun className="h-5 w-5 text-capsula-coral" strokeWidth={1.75} />
            ) : (
                <Moon className="h-5 w-5" strokeWidth={1.75} />
            )}
        </button>
    );
}
