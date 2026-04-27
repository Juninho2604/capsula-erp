import type { Metadata } from 'next';
import { BookOpen, GitBranch, Scale, FileText, Layers } from 'lucide-react';
import ProductoShell from '@/components/marketing/ProductoShell';

export const metadata: Metadata = {
    title: 'Recetas · CÁPSULA',
    description:
        'Sub-recetas recursivas, control de mermas y costo recalculado en cada cambio. Estandarización completa de la cocina.',
};

export default function RecetasPage() {
    return (
        <ProductoShell
            slug="recetas"
            Icon={BookOpen}
            title="Recetas"
            tagline="La cocina, estandarizada de verdad."
            intro={
                <p>
                    Cada plato definido como ficha técnica viva. Sub-recetas, mermas y rendimientos se
                    calculan en cascada, así un cambio en un insumo base actualiza el costo de todos los
                    platos que lo usan.
                </p>
            }
            features={[
                {
                    icon: GitBranch,
                    title: 'Sub-recetas recursivas',
                    desc: 'Una salsa madre puede ser ingrediente de otra preparación, que a su vez forma parte de un plato. El sistema recorre el árbol completo y mantiene el costo consistente en todos los niveles.',
                },
                {
                    icon: Scale,
                    title: 'Mermas y rendimientos',
                    desc: 'Configura porcentaje de merma por ingrediente o por receta completa. El costo final refleja la realidad de la cocina, no el ideal del proveedor.',
                },
                {
                    icon: FileText,
                    title: 'Ficha técnica imprimible',
                    desc: 'Cada receta tiene su ficha técnica con ingredientes, cantidades, procedimiento y emplatado. Útil para entrenamientos, replicación entre sedes y consistencia entre turnos.',
                },
                {
                    icon: Layers,
                    title: 'Versiones y cambios',
                    desc: 'Historial completo de modificaciones a cada receta. Sabes quién cambió qué, cuándo y cómo se reflejó en el costo final.',
                },
            ]}
            whyMatters={
                <>
                    <p>
                        Sin recetas estandarizadas, cada cocinero hace una versión ligeramente distinta
                        del mismo plato. El costo es estimado, las mermas son intuitivas y la calidad
                        depende del turno.
                    </p>
                    <p>
                        Una ficha técnica viva resuelve los tres problemas a la vez: estandariza el
                        plato, calcula su costo real con mermas incluidas, y se actualiza
                        automáticamente cuando cambia el precio de un ingrediente.
                    </p>
                    <p>
                        Para grupos gastronómicos, las recetas son la pieza que permite que el mismo
                        plato salga igual en cualquier sede.
                    </p>
                </>
            }
        />
    );
}
