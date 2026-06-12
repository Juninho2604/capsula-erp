'use client';

import { useEffect } from 'react';

/**
 * Motor de animaciones de la landing editorial (CSS + IntersectionObserver).
 * Progresivo: si este JS no corre, todo el contenido queda visible (los
 * estados ocultos viven bajo `.is-ready`, que solo se agrega acá).
 *
 * - Cascada de entrada del hero ([data-anim]).
 * - Scroll-reveal one-shot ([data-reveal]) con stagger entre hermanos.
 * - Respeta prefers-reduced-motion (vía el CSS).
 */
export default function EditorialMotion() {
    useEffect(() => {
        const root = document.querySelector('.kpsula-editorial');
        if (!root) return;

        // Activa los estados iniciales ocultos + dispara la cascada del hero.
        const raf = requestAnimationFrame(() => root.classList.add('is-ready'));

        const io = new IntersectionObserver(
            (entries) => {
                for (const e of entries) {
                    if (!e.isIntersecting) continue;
                    e.target.classList.add('is-in');
                    io.unobserve(e.target);
                }
            },
            { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
        );

        root.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
            const parent = el.parentElement;
            if (parent) {
                const sibs = Array.from(parent.querySelectorAll<HTMLElement>('[data-reveal]'));
                el.style.setProperty('--i', String(Math.max(0, sibs.indexOf(el))));
            }
            io.observe(el);
        });

        return () => {
            cancelAnimationFrame(raf);
            io.disconnect();
        };
    }, []);

    return null;
}
