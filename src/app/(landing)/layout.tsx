import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { Archivo, Archivo_Black } from 'next/font/google';
import './editorial.css';
import EditorialMotion from './EditorialMotion';

// Tipografías de la identidad editorial. Archivo Black = display (uppercase
// gigante); Archivo = cuerpo/labels. Scoped al wrapper de la landing.
const archivo = Archivo({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
    variable: '--font-archivo',
    display: 'swap',
});
const archivoBlack = Archivo_Black({
    subsets: ['latin'],
    weight: '400',
    variable: '--font-archivo-black',
    display: 'swap',
});

export const metadata: Metadata = {
    title: 'KPSULA — Software de gestión gastronómica',
    description: 'Tu negocio, una kpsula. Una sola plataforma, del salón a la dirección.',
};

export default function LandingLayout({ children }: { children: ReactNode }) {
    return (
        <div className={`kpsula-editorial ${archivo.variable} ${archivoBlack.variable}`}>
            <EditorialMotion />
            {children}
        </div>
    );
}
