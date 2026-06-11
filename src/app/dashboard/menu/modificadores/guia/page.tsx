import Link from 'next/link';
import { ArrowLeft, BookOpen, ChefHat, Check, AlertTriangle, Lightbulb, Settings2, Layers } from 'lucide-react';

export const metadata = {
    title: 'Guía de Modificadores | CAPSULA ERP',
    description: 'Cómo configurar modificadores en el menú',
};

export default function GuiaModificadoresPage() {
    return (
        <div className="space-y-8 max-w-4xl mx-auto p-4 sm:p-6">
            <header className="space-y-3">
                <Link
                    href="/dashboard/menu/modificadores"
                    className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted hover:text-capsula-ink"
                >
                    <ArrowLeft className="h-3.5 w-3.5" /> Volver al gestor de modificadores
                </Link>
                <div className="flex items-start gap-3">
                    <BookOpen className="h-8 w-8 text-capsula-navy-deep shrink-0 mt-1" />
                    <div>
                        <h1 className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink">Guía de Modificadores</h1>
                        <p className="text-sm text-capsula-ink-soft mt-1">
                            Cómo configurar las opciones que el cliente puede elegir al pedir un plato (ej. tipo de carne, cremas, extras).
                        </p>
                    </div>
                </div>
            </header>

            {/* ── 1. CONCEPTOS ─────────────────────────────────────────── */}
            <section className="pos-card p-5 space-y-4">
                <h2 className="font-semibold text-xl tracking-[-0.02em] text-capsula-ink inline-flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-capsula-coral" /> 1 · Conceptos básicos
                </h2>
                <p className="text-sm text-capsula-ink-soft">Dos cosas que hay que distinguir:</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-capsula-line bg-capsula-ivory-surface p-4 space-y-2">
                        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-capsula-navy-deep">
                            <Layers className="h-4 w-4" /> Grupo de modificadores
                        </div>
                        <p className="text-sm text-capsula-ink-soft">
                            La <strong className="text-capsula-ink">pregunta</strong> que se le hace al cliente.
                        </p>
                        <p className="text-xs text-capsula-ink-muted italic">
                            Ej: &quot;¿De qué tipo lo quiere?&quot;, &quot;Elige tus cremas&quot;, &quot;Extras&quot;.
                        </p>
                    </div>
                    <div className="rounded-xl border border-capsula-line bg-capsula-ivory-surface p-4 space-y-2">
                        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-capsula-coral">
                            <Settings2 className="h-4 w-4" /> Modificador (opción)
                        </div>
                        <p className="text-sm text-capsula-ink-soft">
                            Una <strong className="text-capsula-ink">opción</strong> de respuesta dentro del grupo.
                        </p>
                        <p className="text-xs text-capsula-ink-muted italic">
                            Ej: &quot;Pollo&quot;, &quot;Carne&quot;, &quot;Mixto&quot; · &quot;Hummus&quot;, &quot;Tabule&quot;.
                        </p>
                    </div>
                </div>

                {/* Diagrama visual */}
                <div className="rounded-xl border border-capsula-line bg-capsula-ivory p-4 sm:p-6">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-3 text-center">
                        Cómo se ven en el POS
                    </p>
                    <div className="rounded-2xl bg-capsula-navy-deep p-4 text-capsula-cream max-w-md mx-auto">
                        <p className="text-xs font-semibold uppercase tracking-wider opacity-70">Pinchos (3 un)</p>
                        <p className="text-lg font-semibold mt-1">$15.00</p>
                        <div className="mt-3 pt-3 border-t border-capsula-cream/20 space-y-3">
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
                                    Tipo de pinchos · <span className="text-capsula-coral">obligatorio · 1 de 4</span>
                                </p>
                                <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                                    <span className="px-2 py-1 rounded bg-capsula-cream/10 text-xs text-center">Pollo</span>
                                    <span className="px-2 py-1 rounded bg-capsula-coral text-xs text-center">Carne ✓</span>
                                    <span className="px-2 py-1 rounded bg-capsula-cream/10 text-xs text-center">Mixto</span>
                                    <span className="px-2 py-1 rounded bg-capsula-cream/10 text-xs text-center">Kafta</span>
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
                                    Cremas · <span className="opacity-70">opcional · hasta 2</span>
                                </p>
                                <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                                    <span className="px-2 py-1 rounded bg-capsula-coral text-xs text-center">Hummus ✓</span>
                                    <span className="px-2 py-1 rounded bg-capsula-cream/10 text-xs text-center">Tabule</span>
                                    <span className="px-2 py-1 rounded bg-capsula-coral text-xs text-center">Toum ✓</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── 2. SELECCIONES MIN/MAX ────────────────────────────────── */}
            <section className="pos-card p-5 space-y-4">
                <h2 className="font-semibold text-xl tracking-[-0.02em] text-capsula-ink inline-flex items-center gap-2">
                    <Check className="h-5 w-5 text-capsula-coral" /> 2 · Mínimo y máximo de selecciones
                </h2>
                <p className="text-sm text-capsula-ink-soft">
                    Cada grupo tiene 2 números que controlan cuántas opciones puede elegir el cliente:
                </p>

                <div className="space-y-2">
                    <div className="grid grid-cols-[120px_1fr] gap-3 items-baseline rounded-xl border border-capsula-line bg-capsula-ivory-surface p-3">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted text-right">Mín · Máx</span>
                        <div className="text-sm text-capsula-ink-soft">
                            <strong className="text-capsula-ink">1 · 1</strong> — Debe elegir <strong>exactamente uno</strong>. Caso típico:
                            tipo de carne en pinchos, sabor de shawarma. Es como un radio button.
                        </div>
                    </div>
                    <div className="grid grid-cols-[120px_1fr] gap-3 items-baseline rounded-xl border border-capsula-line bg-capsula-ivory-surface p-3">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted text-right">Mín · Máx</span>
                        <div className="text-sm text-capsula-ink-soft">
                            <strong className="text-capsula-ink">0 · N</strong> — Puede elegir <strong>desde 0 hasta N</strong>. Caso típico:
                            extras, salsas, cremas. Son checkboxes.
                        </div>
                    </div>
                    <div className="grid grid-cols-[120px_1fr] gap-3 items-baseline rounded-xl border border-capsula-line bg-capsula-ivory-surface p-3">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted text-right">Mín · Máx</span>
                        <div className="text-sm text-capsula-ink-soft">
                            <strong className="text-capsula-ink">2 · 2</strong> — Debe elegir <strong>exactamente dos</strong>. Caso típico:
                            tabla con 2 cremas a elección.
                        </div>
                    </div>
                </div>

                <div className="rounded-xl bg-[#F3EAD6] dark:bg-[#3B2F15] text-[#946A1C] dark:text-[#E8D9B8] p-3 text-xs font-semibold inline-flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <p>
                        Si marcas el grupo como <strong>Obligatorio</strong> y dejas Mín = 0, el sistema lo ajusta a Mín = 1 al guardar (no tiene sentido obligar a elegir 0).
                    </p>
                </div>
            </section>

            {/* ── 3. VINCULACIÓN A INVENTARIO ──────────────────────────── */}
            <section className="pos-card p-5 space-y-4">
                <h2 className="font-semibold text-xl tracking-[-0.02em] text-capsula-ink inline-flex items-center gap-2">
                    <ChefHat className="h-5 w-5 text-capsula-coral" /> 3 · Vincular modificador a inventario
                </h2>
                <p className="text-sm text-capsula-ink-soft">
                    Esta es la parte clave para que <strong className="text-capsula-ink">cocina y compras</strong> funcionen sin sorpresas:
                </p>

                <div className="rounded-xl border border-capsula-line bg-capsula-ivory p-4 space-y-3">
                    <p className="text-sm text-capsula-ink-soft">
                        Cuando creas un modificador (ej. crema &quot;Hummus&quot; dentro de una Tabla), puedes <strong className="text-capsula-ink">vincularlo a un MenuItem real</strong> del menú (ej. &quot;Hummus Tradicional 125gr&quot;).
                    </p>
                    <p className="text-sm text-capsula-ink-soft">
                        Cuando un cliente pide la Tabla y elige Hummus, el sistema automáticamente:
                    </p>
                    <ol className="text-sm text-capsula-ink-soft space-y-1.5 pl-5 list-decimal">
                        <li>Busca la receta del Hummus 125gr.</li>
                        <li>Descarga del inventario los ingredientes de esa receta (garbanzos, tahini, limón, etc.).</li>
                        <li>Los costos del inventario quedan reflejados en el reporte de venta.</li>
                    </ol>
                </div>

                {/* Diagrama de flujo */}
                <div className="rounded-xl bg-capsula-ivory-alt border border-capsula-line p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-3 text-center">
                        Flujo de inventario
                    </p>
                    <div className="flex flex-col sm:flex-row items-stretch gap-2">
                        <div className="flex-1 rounded-lg bg-capsula-ivory border border-capsula-line p-3 text-center">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-capsula-ink-muted">Modificador</p>
                            <p className="font-semibold text-capsula-ink mt-1">&quot;Hummus&quot;</p>
                            <p className="text-[11px] text-capsula-ink-muted italic mt-0.5">(opción en grupo)</p>
                        </div>
                        <div className="flex items-center justify-center text-capsula-ink-muted font-mono">→</div>
                        <div className="flex-1 rounded-lg bg-capsula-navy-soft border border-capsula-line p-3 text-center">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-capsula-ink-muted">MenuItem</p>
                            <p className="font-semibold text-capsula-ink mt-1">Hummus Tradicional 125gr</p>
                            <p className="text-[11px] text-capsula-ink-muted italic mt-0.5">(plato real con receta)</p>
                        </div>
                        <div className="flex items-center justify-center text-capsula-ink-muted font-mono">→</div>
                        <div className="flex-1 rounded-lg bg-capsula-coral/10 border border-capsula-line p-3 text-center">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-capsula-ink-muted">Inventario</p>
                            <p className="font-semibold text-capsula-ink mt-1">Descarga ingredientes</p>
                            <p className="text-[11px] text-capsula-ink-muted italic mt-0.5">garbanzos, tahini, etc.</p>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl bg-[#E5EDE7] dark:bg-[#1E3B2C] text-[#2F6B4E] dark:text-[#6FB88F] p-3 text-xs font-semibold inline-flex items-start gap-2">
                    <Check className="h-4 w-4 shrink-0 mt-0.5" />
                    <p>
                        Si NO vinculas, el modificador funciona pero no descarga inventario. Útil para extras simbólicos sin coste material (&quot;sin cebolla&quot;, &quot;bien hecho&quot;).
                    </p>
                </div>
            </section>

            {/* ── 4. EJEMPLOS PRÁCTICOS ────────────────────────────────── */}
            <section className="pos-card p-5 space-y-4">
                <h2 className="font-semibold text-xl tracking-[-0.02em] text-capsula-ink inline-flex items-center gap-2">
                    <Layers className="h-5 w-5 text-capsula-coral" /> 4 · Ejemplos prácticos
                </h2>
                <div className="space-y-4">
                    <ExampleCard
                        title="Pinchos · Tipo de carne"
                        group="Tipo de pinchos"
                        required
                        min={1}
                        max={1}
                        options={['Pollo', 'Carne', 'Mixto', 'Kafta']}
                        linkNote="Cada opción se vincula al MenuItem 'Pollo de Pincho 200gr' / 'Carne de Pincho 200gr' etc. para descargar inventario."
                    />
                    <ExampleCard
                        title="Tablas · Cremas a elección"
                        group="Cremas (elige 2)"
                        required
                        min={2}
                        max={2}
                        options={['Hummus', 'Babaganoush', 'Muhammara', 'Tabule', 'Toum']}
                        linkNote="Vincular cada crema al 'Hummus 125gr', 'Babaganoush 125gr', etc. del menú principal."
                    />
                    <ExampleCard
                        title="Shawarma · Extras"
                        group="Extras"
                        required={false}
                        min={0}
                        max={3}
                        options={['+ Queso', '+ Falafel', '+ Tahina extra', '+ Picante']}
                        linkNote="Solo si tienen coste de inventario significativo. 'Sin cebolla' no necesita vincularse."
                    />
                </div>
            </section>

            {/* ── 5. PASOS PARA CREAR ──────────────────────────────────── */}
            <section className="pos-card p-5 space-y-4">
                <h2 className="font-semibold text-xl tracking-[-0.02em] text-capsula-ink inline-flex items-center gap-2">
                    <Settings2 className="h-5 w-5 text-capsula-coral" /> 5 · Pasos para crear un grupo nuevo
                </h2>
                <ol className="space-y-3">
                    {[
                        { t: 'Crear el grupo', d: 'En el gestor, click "Nuevo grupo". Pon nombre claro (ej. "Cremas a elección"), define mín/máx y si es obligatorio.' },
                        { t: 'Añadir las opciones', d: 'Click "Añadir opción" dentro del grupo. Por cada opción: nombre + ajuste de precio (puede ser $0).' },
                        { t: 'Vincular cada opción a inventario (recomendado)', d: 'En el selector de la opción, elegir el MenuItem que tiene la receta. Si no aplica, dejar "Sin vincular".' },
                        { t: 'Asignar el grupo a los platos', d: 'Desde el grupo, agregar los MenuItems que usan este grupo. Ej: la pregunta "Tipo de pinchos" se asigna a "Pinchos (3 un)" y "Pinchos (5 un)".' },
                        { t: 'Probar en el POS', d: 'Abre el POS Mesero, agrega el plato al carrito. Debe aparecer un modal con las opciones del grupo. Verifica que el mín/máx funciona y que los precios se suman.' },
                    ].map((step, i) => (
                        <li key={i} className="grid grid-cols-[36px_1fr] gap-3 items-start">
                            <span className="h-9 w-9 rounded-full bg-capsula-navy-deep text-capsula-cream font-semibold text-sm flex items-center justify-center shrink-0">
                                {i + 1}
                            </span>
                            <div className="pt-1">
                                <p className="font-semibold text-capsula-ink text-sm">{step.t}</p>
                                <p className="text-xs text-capsula-ink-soft mt-0.5">{step.d}</p>
                            </div>
                        </li>
                    ))}
                </ol>
            </section>

            {/* ── 6. PREGUNTAS FRECUENTES ──────────────────────────────── */}
            <section className="pos-card p-5 space-y-3">
                <h2 className="font-semibold text-xl tracking-[-0.02em] text-capsula-ink">6 · Preguntas frecuentes</h2>

                <FAQ
                    q="¿Cuándo debo cobrar extra por un modificador?"
                    a="Si añade coste material significativo (ej. queso extra). Si solo es una preferencia (sin sal, bien cocido), el precio queda en $0."
                />
                <FAQ
                    q="¿Puedo usar el mismo grupo en varios platos?"
                    a="Sí. Ej: 'Tipo de pinchos' aplica a 'Pinchos 3 un' y 'Pinchos 5 un'. Asignas el grupo a ambos MenuItems y listo."
                />
                <FAQ
                    q="¿Qué pasa si desactivo un modificador?"
                    a="Deja de aparecer en el POS hasta que lo reactives. Útil si se acabó temporalmente un ingrediente."
                />
                <FAQ
                    q="¿El modificador descarga inventario solo si lo vinculo?"
                    a="Exacto. Sin vinculación, el modificador es solo texto en la comanda. Con vinculación, dispara la receta del MenuItem vinculado y descarga insumos."
                />
                <FAQ
                    q="¿Puedo cambiar el orden en que aparecen las opciones?"
                    a="Por ahora salen en el orden que las creaste. Para reordenar, hay que borrarlas y recrear en el orden deseado. (Mejora futura: drag & drop)."
                />
            </section>

            <footer className="text-center pt-4">
                <Link
                    href="/dashboard/menu/modificadores"
                    className="inline-flex items-center gap-2 pos-btn px-6 py-3 text-sm"
                >
                    <ArrowLeft className="h-4 w-4" /> Volver al gestor
                </Link>
            </footer>
        </div>
    );
}

function ExampleCard({
    title,
    group,
    required,
    min,
    max,
    options,
    linkNote,
}: {
    title: string;
    group: string;
    required: boolean;
    min: number;
    max: number;
    options: string[];
    linkNote: string;
}) {
    return (
        <div className="rounded-xl border border-capsula-line bg-capsula-ivory-surface p-4 space-y-2">
            <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-semibold text-capsula-ink">{title}</h3>
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                    Grupo: <span className="text-capsula-navy-deep">{group}</span>
                </span>
            </div>
            <p className="text-xs text-capsula-ink-soft">
                {required ? <strong className="text-capsula-coral">Obligatorio</strong> : 'Opcional'} · {min === max ? `exactamente ${min}` : `${min} a ${max}`}
            </p>
            <div className="flex flex-wrap gap-1.5">
                {options.map((o) => (
                    <span key={o} className="px-2 py-1 rounded-lg bg-capsula-ivory border border-capsula-line text-xs font-semibold text-capsula-ink-soft">
                        {o}
                    </span>
                ))}
            </div>
            <p className="text-[11px] text-capsula-ink-muted italic pt-1 border-t border-capsula-line/50">
                {linkNote}
            </p>
        </div>
    );
}

function FAQ({ q, a }: { q: string; a: string }) {
    return (
        <details className="group rounded-xl border border-capsula-line bg-capsula-ivory-surface p-3 cursor-pointer">
            <summary className="font-semibold text-sm text-capsula-ink list-none inline-flex items-center justify-between w-full">
                <span>{q}</span>
                <span className="text-capsula-ink-muted text-xs group-open:rotate-180 transition-transform">▾</span>
            </summary>
            <p className="text-xs text-capsula-ink-soft mt-2 pt-2 border-t border-capsula-line">{a}</p>
        </details>
    );
}
