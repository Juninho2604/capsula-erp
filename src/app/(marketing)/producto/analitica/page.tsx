import type { Metadata } from 'next';
import { BarChart3, Activity, Receipt, TrendingUp, CalendarRange } from 'lucide-react';
import ProductoShell from '@/components/marketing/ProductoShell';

export const metadata: Metadata = {
    title: 'Analítica · CÁPSULA',
    description:
        'Ventas, ticket promedio y utilidad operativa por jornada. Reportes consolidados que no requieren un analista para entenderlos.',
};

export default function AnaliticaPage() {
    return (
        <ProductoShell
            slug="analitica"
            Icon={BarChart3}
            title="Analítica"
            tagline="La operación, en una sola pantalla."
            intro={
                <p>
                    Ventas, ticket promedio, mix de productos, utilidad operativa y comparativas entre
                    períodos. Todo consolidado, todo accesible, sin esperar al cierre contable.
                </p>
            }
            features={[
                {
                    icon: Activity,
                    title: 'Ventas en vivo',
                    desc: 'Dashboard de la jornada actual con ingresos, productos más vendidos, distribución por canal y comparación contra el mismo día de la semana pasada.',
                },
                {
                    icon: Receipt,
                    title: 'Ticket promedio y rotación',
                    desc: 'Ticket promedio por turno, por mesero, por canal de venta. Rotación de mesas, tiempo promedio entre apertura y cierre de cuenta. Métricas que sirven para coachear al equipo.',
                },
                {
                    icon: TrendingUp,
                    title: 'Utilidad operativa diaria',
                    desc: 'Ingresos menos COGS menos gastos del día, en una sola línea. Saber si el día cerró rentable antes de irte a casa, no a fin de mes.',
                },
                {
                    icon: CalendarRange,
                    title: 'Comparativas entre períodos',
                    desc: 'Comparación libre entre cualquier par de períodos: día contra día, semana contra semana, mes contra mes. Detección de tendencias antes de que sean problema.',
                },
            ]}
            whyMatters={
                <>
                    <p>
                        La mayoría de operadores toma decisiones con información atrasada: el cierre del
                        mes anterior llega a mediados del siguiente, y para entonces ya pasaron 30 días
                        sin actuar sobre lo que muestra.
                    </p>
                    <p>
                        Cuando la analítica vive en tiempo real, los ajustes pasan a ser semanales o
                        diarios: corregir el mix de un menú que no funciona, reasignar promociones, o
                        identificar un turno que está dejando margen sobre la mesa.
                    </p>
                    <p>
                        El objetivo no es generar más reportes; es que el operador de turno tenga la
                        información que necesita en el momento que la necesita, sin tener que
                        pedírsela a nadie.
                    </p>
                </>
            }
        />
    );
}
