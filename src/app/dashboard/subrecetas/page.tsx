import SubRecetasTab from '../produccion/SubRecetasTab';

export const dynamic = 'force-dynamic';

// §125 — Submódulo propio de Sub-recetas en el sidebar (debajo de Recetas),
// en vez de una pestaña dentro de Producción. Reutiliza el componente que ya
// lista las sub-recetas con su encabezado, buscador y botón "Nueva sub-receta".
export default function SubRecetasPage() {
    return (
        <div className="space-y-6 animate-in">
            <SubRecetasTab />
        </div>
    );
}
