import Link from 'next/link';
import CapsulaLogo from '@/components/ui/CapsulaLogo';

const COLUMNS: { h: string; items: { label: string; href: string }[] }[] = [
    {
        h: 'Producto',
        items: [
            { label: 'Inventario', href: '/producto/inventario' },
            { label: 'Recetas',    href: '/producto/recetas' },
            { label: 'Costos',     href: '/producto/costos' },
            { label: 'Analítica',  href: '/producto/analitica' },
        ],
    },
    {
        h: 'Empresa',
        items: [
            { label: 'Sobre nosotros', href: '/empresa' },
            { label: 'Contacto',       href: '/contacto' },
        ],
    },
    {
        h: 'Recursos',
        items: [
            { label: 'Centro de ayuda',   href: '/ayuda' },
            { label: 'Estado del sistema', href: '/estado' },
        ],
    },
];

export default function AuroraFooter() {
    return (
        <footer
            className="relative px-10 pb-12 pt-14"
            style={{ borderTop: '1px solid var(--cap-hair)' }}
        >
            <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
                <div>
                    <Link href="/" className="inline-flex items-center" aria-label="CÁPSULA — inicio">
                        <CapsulaLogo variant="full" size={22} />
                    </Link>
                    <p className="cap-text-dim mt-4 max-w-[280px] text-[13px] leading-[1.6]">
                        Plataforma de gestión para restaurantes{' '}
                        <span className="cap-text-blue">independientes y grupos gastronómicos.</span>
                    </p>
                </div>
                {COLUMNS.map((col) => (
                    <div key={col.h}>
                        <div
                            className="cap-text-soft mb-[18px] text-[11px] font-semibold uppercase"
                            style={{ letterSpacing: '0.16em' }}
                        >
                            {col.h}
                        </div>
                        {col.items.map((i) => (
                            <Link
                                key={i.label}
                                href={i.href}
                                className="cap-text-blue mb-2.5 block text-[13px] opacity-90 transition-opacity hover:opacity-100"
                            >
                                {i.label}
                            </Link>
                        ))}
                    </div>
                ))}
            </div>

            <hr className="cap-divider mx-0 mt-12" />

            <div className="mx-auto mt-6 flex max-w-[1280px] flex-col items-start justify-between gap-3 text-[12px] sm:flex-row sm:items-center">
                <div className="cap-text-soft">© 2026 CÁPSULA · Todos los derechos reservados</div>
                <div className="flex gap-6">
                    <Link href="/legal/terminos"   className="cap-link">Términos y condiciones</Link>
                    <Link href="/legal/privacidad" className="cap-link">Privacidad</Link>
                    <Link href="/legal/seguridad"  className="cap-link">Seguridad</Link>
                </div>
            </div>
        </footer>
    );
}
