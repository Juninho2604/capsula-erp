import { redirect } from 'next/navigation';

/**
 * /dashboard/estadisticas fue absorbida por /dashboard.
 *
 * Este archivo se mantiene únicamente como redirect para preservar
 * compatibilidad con bookmarks y links externos que apunten a la URL
 * antigua. Toda la lógica role-based ahora vive en
 * src/components/dashboard/RoleBasedSections.tsx y se renderiza desde
 * el dashboard principal.
 *
 * En una futura limpieza este archivo y su carpeta pueden eliminarse,
 * pero por ahora el redirect tiene costo despreciable y evita 404s.
 */
export default function EstadisticasRedirectPage(): never {
    redirect('/dashboard');
}
