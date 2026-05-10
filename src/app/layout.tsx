import type { Metadata, Viewport } from 'next';
import { Inter_Tight, JetBrains_Mono, Inter, Nunito } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from '@/components/theme-provider';
import { PWARegister } from '@/components/pwa-register';

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
    title: 'KPSULA',
    description: 'El ERP operativo para tu restaurante',
    keywords: ['KPSULA', 'ERP', 'restaurante', 'inventario', 'recetas', 'Caracas'],
    applicationName: 'KPSULA',
    appleWebApp: {
        capable: true,
        title: 'KPSULA',
        statusBarStyle: 'black-translucent',
    },
    manifest: '/manifest.json',
    icons: {
        icon: [
            { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
            { url: '/icons/favicon-16.png', sizes: '16x16', type: 'image/png' },
        ],
        apple: [
            { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
        ],
    },
    formatDetection: {
        telephone: false,
    },
};

// theme-color cambia entre light/dark para que la barra del sistema en
// modo standalone (PWA instalada) siga el tema actual.
export const viewport: Viewport = {
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: '#F7F5F0' },
        { media: '(prefers-color-scheme: dark)', color: '#1B2438' },
    ],
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    viewportFit: 'cover',
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
                <PWARegister />
            </body>
        </html>
    );
}
