import type { Metadata } from 'next';
import { Box, Layers, Bell, MapPin, Tag } from 'lucide-react';
import ProductoShell from '@/components/marketing/ProductoShell';

export const metadata: Metadata = {
    title: 'Inventario · CÁPSULA',
    description:
        'Stock en tiempo real, multi-ubicación, alertas de reabastecimiento y trazabilidad por lote. Conectado con recetas y costos.',
};

export default function InventarioPage() {
    return (
        <ProductoShell
            slug="inventario"
            Icon={Box}
            title="Inventario"
            tagline="Sabes qué tienes, dónde y cuánto vale."
            intro={
                <p>
                    Stock vivo, no estimaciones. Cada entrada, salida y traslado se refleja al instante,
                    con costo recalculado automáticamente al cambiar una receta o un proveedor.
                </p>
            }
            features={[
                {
                    icon: Layers,
                    title: 'Stock en tiempo real',
                    desc: 'Cada venta descuenta los insumos consumidos según la receta. El inventario refleja la realidad operativa, sin desfases ni cierres manuales al final del día.',
                },
                {
                    icon: MapPin,
                    title: 'Multi-ubicación',
                    desc: 'Bodegas, barras, cocinas y puntos de venta gestionados como ubicaciones independientes. Traslados entre ellas con un solo movimiento, totalmente trazado.',
                },
                {
                    icon: Bell,
                    title: 'Alertas de reabastecimiento',
                    desc: 'Configura puntos mínimos por ítem y ubicación. El sistema avisa cuando un insumo se acerca al mínimo, antes de que se quede sin stock en plena operación.',
                },
                {
                    icon: Tag,
                    title: 'Trazabilidad por lote',
                    desc: 'Registro de entradas con número de lote, fecha de vencimiento y proveedor. Útil para FIFO, gestión de mermas y cumplimiento sanitario.',
                },
            ]}
            whyMatters={
                <>
                    <p>
                        Un inventario que no refleja la realidad operativa cuesta plata todos los días.
                        Genera mermas invisibles, costos calculados sobre datos viejos y reposiciones de
                        última hora que pagas más caro.
                    </p>
                    <p>
                        Con stock vivo, los costos se actualizan en cuanto cambia un precio de compra,
                        las recetas conocen su disponibilidad real, y las decisiones de menú dejan de
                        depender del olfato.
                    </p>
                    <p>
                        Para grupos con varias sedes, la visibilidad cruzada permite balancear stock
                        entre ubicaciones antes de hacer una nueva compra.
                    </p>
                </>
            }
        />
    );
}
