import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://capsula.app';

export default function sitemap(): MetadataRoute.Sitemap {
    const lastModified = new Date();
    const routes = [
        '',
        '/producto/inventario',
        '/producto/recetas',
        '/producto/costos',
        '/producto/analitica',
        '/empresa',
        '/contacto',
        '/ayuda',
        '/estado',
        '/legal/terminos',
        '/legal/privacidad',
        '/legal/seguridad',
    ];

    return routes.map((path) => ({
        url: `${BASE_URL}${path}`,
        lastModified,
        changeFrequency: path.startsWith('/legal') ? 'yearly' : 'monthly',
        priority: path === '' ? 1 : path.startsWith('/producto') ? 0.8 : 0.5,
    }));
}
