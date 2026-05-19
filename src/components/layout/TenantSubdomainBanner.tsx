'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, X as XIcon } from 'lucide-react';

const ROOT_DOMAIN = 'kpsula.app';
const DISMISSED_KEY = 'tenant-subdomain-banner-dismissed-v1';

/**
 * Banner discreto y NO bloqueante que se muestra cuando:
 *   - El user está en `kpsula.app` (root, sin subdomain de tenant), Y
 *   - Tiene un tenant identificado con slug, Y
 *   - El slug NO coincide con el host actual.
 *
 * Click → navega al subdomain del tenant. Es una sugerencia, no un forzado.
 *
 * Por qué un banner y no un redirect automático:
 *   - Las cookies son host-restringidas. Un redirect a `<slug>.kpsula.app`
 *     causa pérdida de sesión (no llega la cookie). Mejor que sea decisión
 *     consciente del operador, no un trampolín que lo deslogue.
 *   - El comportamiento actual (todo en root) funciona perfectamente. El
 *     redirect cambia UX sin necesidad operativa inmediata.
 *
 * Dismissible: el banner guarda en localStorage que el user lo cerró. No
 * vuelve a aparecer en esa sesión/browser. Reset: limpiar localStorage o
 * cambiar la versión del key.
 *
 * Renderiza null en:
 *   - SSR (sin window)
 *   - localhost / preview / dev
 *   - cualquier host que ya sea el subdomain del tenant
 *   - cuando el user es CASHIER / WAITER (no necesitan saber esto)
 *   - cuando no hay slug (single-tenant fallback)
 *
 * 100% reversible: si falla a renderizar, no afecta nada del resto del
 * dashboard.
 */
export interface TenantSubdomainBannerProps {
    /** Slug del tenant del session/JWT. Null/undefined → banner no se muestra. */
    tenantSlug: string | null;
    /** Rol del user. Banner se oculta para roles operativos (WAITER/CASHIER). */
    userRole: string | null;
}

export function TenantSubdomainBanner({
    tenantSlug,
    userRole,
}: TenantSubdomainBannerProps) {
    const [show, setShow] = useState(false);
    const [targetUrl, setTargetUrl] = useState<string | null>(null);

    useEffect(() => {
        // Server-side render — no decisión hasta cliente.
        if (typeof window === 'undefined') return;

        // Defensive: si no tenemos slug, nada que hacer.
        if (!tenantSlug || tenantSlug.length < 2) return;

        // Roles operativos no ven esto — solo confunde al staff.
        if (userRole === 'CASHIER' || userRole === 'WAITER') return;

        // Host actual sin puerto.
        const host = window.location.host.split(':')[0].toLowerCase();

        // Solo aplica en producción kpsula.app. Dev/preview/IP raw → skip.
        if (!host.endsWith(ROOT_DOMAIN)) return;

        // Si ya estamos en el subdomain del tenant → no mostrar.
        const expectedHost = `${tenantSlug}.${ROOT_DOMAIN}`;
        if (host === expectedHost) return;

        // Si el user dismisseó el banner antes → no mostrar de nuevo.
        try {
            if (window.localStorage.getItem(DISMISSED_KEY) === '1') return;
        } catch {
            // localStorage puede fallar en modo privado o políticas
            // estrictas — degradamos a mostrar el banner siempre, no peor.
        }

        // OK, mostrar banner con URL al subdomain.
        const protocol = window.location.protocol;
        const path = window.location.pathname + window.location.search;
        setTargetUrl(`${protocol}//${expectedHost}${path}`);
        setShow(true);
    }, [tenantSlug, userRole]);

    if (!show || !targetUrl) return null;

    const handleDismiss = () => {
        try {
            window.localStorage.setItem(DISMISSED_KEY, '1');
        } catch {}
        setShow(false);
    };

    return (
        <div className="border-b border-capsula-line bg-[#E6ECF4] dark:bg-[#1A2636] px-4 py-2 text-xs text-[#2A4060] dark:text-[#D1DCE9]">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
                <span>
                    Estás en <span className="font-mono font-semibold">{ROOT_DOMAIN}</span>.
                    Para mejor experiencia y separación por negocio, accedé desde el
                    subdominio de tu empresa.
                </span>
                <div className="flex items-center gap-2 shrink-0">
                    <a
                        href={targetUrl}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A4060]/30 dark:border-[#D1DCE9]/30 bg-capsula-ivory dark:bg-capsula-navy-deep px-3 py-1 font-semibold hover:opacity-80 transition"
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Ir al subdominio
                    </a>
                    <button
                        type="button"
                        onClick={handleDismiss}
                        title="No mostrar de nuevo"
                        className="h-6 w-6 rounded-full hover:bg-[#2A4060]/10 dark:hover:bg-[#D1DCE9]/10 inline-flex items-center justify-center transition"
                    >
                        <XIcon className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
