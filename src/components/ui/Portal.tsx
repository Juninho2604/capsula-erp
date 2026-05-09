'use client';

/**
 * Portal — renderiza children como hijo directo de document.body.
 *
 * Útil para modales/dropdowns que necesitan escapar del stacking context
 * creado por padres con backdrop-filter, transform, filter, perspective,
 * will-change, contain, etc. Sin Portal, position:fixed de los hijos se
 * posiciona relativo al ancestor con esas propiedades, no al viewport,
 * resultando en modales recortados o mal posicionados.
 *
 * Casos típicos en Cápsula/Kpsula:
 *   - Navbar tiene backdrop-blur-md → afecta NotificationBell, HelpPanel.
 *   - Cards (.capsula-card) tienen transform en hover y overflow-hidden →
 *     afecta modales emergentes desde widgets (FinancialSummary).
 *
 * Uso:
 *   <Portal>
 *     <div className="fixed inset-0 z-[70] ...">...</div>
 *   </Portal>
 *
 * Patrón mounted: el primer render en SSR no monta nada; tras hidratar,
 * el portal se monta. Esto evita errores de "document is not defined" en
 * server-side y warnings de hydration mismatch.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function Portal({ children }: { children: ReactNode }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted || typeof document === 'undefined') return null;
    return createPortal(children, document.body);
}
