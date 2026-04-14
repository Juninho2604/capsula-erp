import type { Metadata } from 'next';
import { Inter, Nunito } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const nunito = Nunito({ subsets: ['latin'], weight: ['400', '600', '700', '800', '900'], variable: '--font-heading' });

export const metadata: Metadata = {
    title: 'CÁPSULA',
    description: 'El ERP inteligente para tu restaurante',
    keywords: ['CÁPSULA', 'ERP', 'restaurante', 'inventario', 'recetas', 'Caracas'],
};

import { ThemeProvider } from '@/components/theme-provider';

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="es" suppressHydrationWarning>
            <body className={`${inter.variable} ${nunito.variable} font-sans antialiased bg-background text-foreground transition-colors duration-300`}>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="light"
                    enableSystem
                    disableTransitionOnChange
                >
                    {children}
                </ThemeProvider>
                <Toaster position="top-right" />
            </body>
        </html>
    );
}
