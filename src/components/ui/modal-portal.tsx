'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * §112 — Renderiza un modal directamente en <body> vía portal.
 *
 * Por qué: un modal `fixed inset-0 z-[60]` anidado en la página puede quedar
 * atrapado en el stacking context de un ancestro (animaciones filled,
 * transform, opacity…) y pintarse DEBAJO del sidebar `z-50` — visto en
 * Recetas a media pantalla. El portal saca el modal del árbol de la página:
 * su z-index compite en el stacking context raíz, siempre por encima del
 * chrome del dashboard.
 *
 * SSR-safe: no renderiza nada hasta montar en cliente (los modales se abren
 * por interacción, nunca en el HTML inicial).
 */
export function ModalPortal({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    if (!mounted) return null;
    return createPortal(children, document.body);
}
