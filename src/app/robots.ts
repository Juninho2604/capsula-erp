import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://capsula.app';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: ['/dashboard/', '/api/', '/login', '/kitchen/'],
            },
        ],
        sitemap: `${BASE_URL}/sitemap.xml`,
    };
}
