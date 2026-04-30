import type { Metadata } from 'next';
import { Inter_Tight, JetBrains_Mono, Inter, Nunito } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from '@/components/theme-provider';

// ── Minimal Navy design direction ────────────────────────────
const interTight = Inter_Tight({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
    variable: '--font-body',
    display: 'swap',
});
const jetbrainsMono = JetBrains_Mono({
    subsets: ['latin'],
    weight: ['400', '500'],
    variable: '--font-mono',
    display: 'swap',
});

// ── Back-compat: componentes existentes pueden usar --font-inter
//    sin romperse mientras migramos.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const nunito = Nunito({
    subsets: ['latin'],
    weight: ['400', '600', '700', '800', '900'],
    variable: '--font-nunito',
    display: 'swap',
});

export const metadata: Metadata = {
    title: 'CÁPSULA',
    description: 'El ERP operativo para tu restaurante',
    keywords: ['CÁPSULA', 'ERP', 'restaurante', 'inventario', 'recetas', 'Caracas'],
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const fontVars = [
        interTight.variable,
        jetbrainsMono.variable,
        inter.variable,
        nunito.variable,
    ].join(' ');

    return (
        <html lang="es" suppressHydrationWarning>
            <body
                className={`${fontVars} font-sans antialiased bg-background text-foreground transition-colors duration-300`}
            >
                <ThemeProvider
                    attribute="class"
                    defaultTheme="light"
                    enableSystem
                    disableTransitionOnChange
                >
                    {children}
                </ThemeProvider>
                <Toaster
                    position="top-right"
                    toastOptions={{
                        style: {
                            background: 'var(--capsula-ivory-surface)',
                            color: 'var(--capsula-ink)',
                            border: '1px solid var(--capsula-line)',
                            borderRadius: '10px',
                            fontFamily: 'var(--font-body)',
                            fontSize: '14px',
                        },
                    }}
                />
            </body>
        </html>
    );
}
