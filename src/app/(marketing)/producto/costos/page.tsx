import type { Metadata } from 'next';
import { Coins, TrendingUp, History, Percent, AlertTriangle } from 'lucide-react';
import ProductoShell from '@/components/marketing/ProductoShell';

export const metadata: Metadata = {
    title: 'Costos · CÁPSULA',
    description:
        'COGS automático, histórico de costos y margen real por plato el mismo día de la venta. Sin hojas de cálculo, sin sorpresas a fin de mes.',
};

export default function CostosPage() {
    return (
        <ProductoShell
            slug="costos"
            Icon={Coins}
            title="Costos"
            tagline="El margen real de cada plato. Hoy."
            intro={
                <p>
                    El costo de cada plato se calcula al momento, con los precios de compra más
                    recientes y las mermas reales registradas. Conoces tu margen el mismo día de la
                    venta, no dos meses después en un Excel.
                </p>
            }
            features={[
                {
                    icon: TrendingUp,
                    title: 'COGS automático por venta',
                    desc: 'Cada venta descuenta el costo real de los insumos consumidos. El COGS del día es un número en vivo, no una estimación al cierre del mes.',
                },
                {
                    icon: History,
                    title: 'Histórico de costos',
                    desc: 'Cada cambio en el precio de compra de un insumo queda registrado. Puedes comparar el costo de un plato hoy contra el de hace 30, 60 o 90 días, e identificar qué ingrediente se disparó.',
                },
                {
                    icon: Percent,
                    title: 'Margen real por plato',
                    desc: 'Precio de venta menos costo real, en porcentaje y en valor absoluto. Saber qué platos efectivamente dejan margen, no solo los que parecen rentables en teoría.',
                },
                {
                    icon: AlertTriangle,
                    title: 'Análisis de variaciones',
                    desc: 'Reportes que destacan platos con margen por debajo de objetivo, ingredientes con mayor impacto en costo y oportunidades de optimización en la carta.',
                },
            ]}
            whyMatters={
                <>
                    <p>
                        El costo "estimado" de un plato suele estar entre 5% y 15% por debajo del costo
                        real, simplemente porque no incluye mermas, fluctuaciones de precio del último
                        mes ni los insumos secundarios.
                    </p>
                    <p>
                        Cuando el costo se calcula con datos vivos, dos cosas cambian: la pricing
                        decisions se vuelven defendibles con números, y la carta puede rotarse en
                        función de margen real, no de intuición.
                    </p>
                    <p>
                        Para gerencia, esto convierte el "creo que estamos rentables" en "estos 12
                        platos representan el 70% del margen y estos 8 están comprometiendo el
                        resultado".
                    </p>
                </>
            }
        />
    );
}
