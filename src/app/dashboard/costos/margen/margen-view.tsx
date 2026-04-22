'use client';

import { useState, useMemo } from 'react';
import type { DishMargin, DishMarginsResult } from '@/app/actions/cost.actions';
import {
  FileDown, Search, AlertOctagon, CheckCircle2, AlertTriangle,
  ChevronUp, ChevronDown, ChevronsUpDown, UtensilsCrossed,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/Badge';

function fmt(n: number) {
  return n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function marginColor(pct: number, status: string) {
  if (status !== 'COMPLETE') return { bar: 'bg-capsula-line-strong', text: 'text-capsula-ink-muted' };
  if (pct < 20)  return { bar: 'bg-capsula-coral',  text: 'text-capsula-coral' };
  if (pct < 35)  return { bar: 'bg-[#D96A2E]',       text: 'text-[#D96A2E]' };
  if (pct < 50)  return { bar: 'bg-[#946A1C]',       text: 'text-[#946A1C]' };
  return           { bar: 'bg-[#2F6B4E]',           text: 'text-[#2F6B4E]' };
}

function statusLabel(d: DishMargin) {
  if (d.status === 'NO_RECIPE')     return { text: 'Sin receta',          variant: 'danger' as const };
  if (d.status === 'EMPTY_RECIPE')  return { text: 'Receta vacía',        variant: 'warn' as const };
  if (d.status === 'PARTIAL_COSTS') return { text: `${d.missingCostCount} sin costo`, variant: 'warn' as const };
  return { text: 'Completo', variant: 'ok' as const };
}

type SortKey = 'marginPct' | 'margin' | 'price' | 'recipeCost' | 'name';
type FilterKey = 'all' | 'at_risk' | 'healthy' | 'incomplete';

export function MargenView({ result }: { result: DishMarginsResult }) {
  const { data = [], summary } = result;

  const [sort, setSort] = useState<SortKey>('marginPct');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');

  const toggleSort = (key: SortKey) => {
    if (sort === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSort(key); setSortDir('asc'); }
  };

  const filtered = useMemo(() => {
    let rows = [...data];
    if (search) rows = rows.filter(d => d.name.toLowerCase().includes(search.toLowerCase()) || d.categoryName.toLowerCase().includes(search.toLowerCase()));
    if (filter === 'at_risk')    rows = rows.filter(d => d.status === 'COMPLETE' && d.marginPct < 30);
    if (filter === 'healthy')    rows = rows.filter(d => d.status === 'COMPLETE' && d.marginPct >= 50);
    if (filter === 'incomplete') rows = rows.filter(d => d.status !== 'COMPLETE');
    rows.sort((a, b) => {
      let va = a[sort as keyof DishMargin] as number;
      let vb = b[sort as keyof DishMargin] as number;
      if (sort === 'name') { va = a.name.localeCompare(b.name) as any; vb = 0; }
      const diff = typeof va === 'string' ? (a.name < b.name ? -1 : 1) : va - vb;
      return sortDir === 'asc' ? diff : -diff;
    });
    return rows;
  }, [data, sort, sortDir, filter, search]);

  const exportCSV = () => {
    const headers = ['SKU', 'Plato', 'Categoría', 'Precio ($)', 'Costo Receta ($)', 'Margen ($)', 'Margen %', 'Estado'];
    const rows = filtered.map(d => [
      d.sku, d.name, d.categoryName,
      d.price.toFixed(2), d.recipeCost.toFixed(2), d.margin.toFixed(2),
      d.marginPct.toFixed(1) + '%', d.status,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `margen_platos_${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const SortBtn = ({ col, label }: { col: SortKey; label: string }) => (
    <button onClick={() => toggleSort(col)} className="inline-flex items-center gap-1 text-left text-capsula-ink-muted transition-colors hover:text-capsula-ink">
      {label}
      {sort === col
        ? (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" strokeWidth={2} /> : <ChevronDown className="h-3 w-3" strokeWidth={2} />)
        : <ChevronsUpDown className="h-3 w-3" strokeWidth={1.5} />}
    </button>
  );

  const filterOptions: [FilterKey, string, typeof AlertOctagon | null][] = [
    ['all',        'Todos',        null],
    ['at_risk',    'En riesgo',    AlertOctagon],
    ['healthy',    'Rentables',    CheckCircle2],
    ['incomplete', 'Incompletos',  AlertTriangle],
  ];

  return (
    <div className="mx-auto max-w-7xl animate-in">
      <PageHeader
        kicker="Costos"
        title="Margen por plato"
        description="Costo de receta vs precio de venta · en tiempo real."
        actions={
          <Button variant="ghost" size="sm" onClick={exportCSV}>
            <FileDown className="h-4 w-4" strokeWidth={1.5} /> Exportar CSV
          </Button>
        }
      />

      {/* KPI cards */}
      {summary && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-4 shadow-cap-soft">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Margen promedio</p>
            <p className={cn("mt-1 font-mono text-[28px] font-semibold", summary.avgMarginPct < 35 ? "text-[#946A1C]" : "text-[#2F6B4E]")}>
              {summary.avgMarginPct}%
            </p>
            <p className="mt-0.5 text-[11px] text-capsula-ink-muted">{summary.withFullData} platos con datos completos</p>
          </div>
          <div className="rounded-[var(--radius)] border border-capsula-coral/30 bg-capsula-coral-subtle/40 p-4 shadow-cap-soft">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">En riesgo (&lt;30%)</p>
            <p className="mt-1 font-mono text-[28px] font-semibold text-capsula-coral">{summary.atRisk}</p>
            <p className="mt-0.5 text-[11px] text-capsula-ink-muted">Margen insuficiente</p>
          </div>
          <div className="rounded-[var(--radius)] border border-[#D3E2D8] bg-[#E5EDE7]/50 p-4 shadow-cap-soft">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Rentables (≥50%)</p>
            <p className="mt-1 font-mono text-[28px] font-semibold text-[#2F6B4E]">{summary.healthy}</p>
            <p className="mt-0.5 text-[11px] text-capsula-ink-muted">Margen saludable</p>
          </div>
          <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-4 shadow-cap-soft">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Total platos</p>
            <p className="mt-1 font-mono text-[28px] font-semibold text-capsula-ink">{summary.total}</p>
            {summary.worstDish && (
              <p className="mt-0.5 inline-flex items-center gap-1 truncate text-[11px] text-capsula-coral" title={`Menor margen: ${summary.worstDish}`}>
                <ChevronDown className="h-3 w-3" strokeWidth={1.5} /> {summary.worstDish}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-capsula-ink-muted" strokeWidth={1.5} />
          <input
            type="text" placeholder="Buscar plato o categoría…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full rounded-full border border-capsula-line bg-capsula-ivory-surface py-2 pl-9 pr-3 text-[13px] text-capsula-ink outline-none placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep"
          />
        </div>
        {filterOptions.map(([key, label, Icon]) => {
          const active = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-3 py-2 text-[12px] font-medium transition-colors",
                active
                  ? "border-capsula-navy-deep bg-capsula-navy-deep text-capsula-ivory"
                  : "border-capsula-line bg-capsula-ivory-surface text-capsula-ink-muted hover:text-capsula-ink",
              )}
            >
              {Icon && <Icon className="h-3 w-3" strokeWidth={1.5} />}
              {label}
            </button>
          );
        })}
        <span className="ml-auto text-[11px] text-capsula-ink-muted">{filtered.length} platos</span>
      </div>

      {/* Tabla */}
      <div className="overflow-hidden rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface shadow-cap-soft">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-capsula-line bg-capsula-ivory">
                <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em]">
                  <SortBtn col="name" label="Plato" />
                </th>
                <th className="hidden px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted sm:table-cell">
                  Categoría
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-[0.08em]">
                  <SortBtn col="price" label="Precio" />
                </th>
                <th className="hidden px-4 py-3 text-right text-[11px] font-medium uppercase tracking-[0.08em] md:table-cell">
                  <SortBtn col="recipeCost" label="Costo receta" />
                </th>
                <th className="hidden px-4 py-3 text-right text-[11px] font-medium uppercase tracking-[0.08em] md:table-cell">
                  <SortBtn col="margin" label="Margen $" />
                </th>
                <th className="px-4 py-3 text-center text-[11px] font-medium uppercase tracking-[0.08em]">
                  <SortBtn col="marginPct" label="Margen %" />
                </th>
                <th className="hidden px-4 py-3 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted lg:table-cell">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(dish => {
                const colors = marginColor(dish.marginPct, dish.status);
                const sl = statusLabel(dish);
                const pctCapped = Math.min(dish.marginPct, 100);
                return (
                  <tr key={dish.id} className="border-b border-capsula-line transition-colors last:border-b-0 hover:bg-capsula-ivory">
                    <td className="px-4 py-3">
                      <div className="font-medium text-capsula-ink">{dish.name}</div>
                      <div className="font-mono text-[10.5px] text-capsula-ink-muted">{dish.sku}</div>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <span className="rounded-full border border-capsula-line bg-capsula-ivory px-2 py-0.5 text-[11px] text-capsula-ink-muted">{dish.categoryName}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-capsula-ink">
                      ${fmt(dish.price)}
                    </td>
                    <td className="hidden px-4 py-3 text-right font-mono text-capsula-ink-muted md:table-cell">
                      {dish.status === 'NO_RECIPE' ? '—' : `$${fmt(dish.recipeCost)}`}
                    </td>
                    <td className={cn("hidden px-4 py-3 text-right font-mono font-semibold md:table-cell", colors.text)}>
                      {dish.status === 'NO_RECIPE' ? '—' : `$${fmt(dish.margin)}`}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-center gap-1">
                        <span className={cn("font-mono text-[13px] font-semibold", colors.text)}>
                          {dish.status === 'NO_RECIPE' ? '—' : `${dish.marginPct.toFixed(1)}%`}
                        </span>
                        {dish.status === 'COMPLETE' && (
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-capsula-line">
                            <div className={cn("h-full rounded-full", colors.bar)} style={{ width: `${pctCapped}%` }} />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-center lg:table-cell">
                      <Badge variant={sl.variant}>{sl.text}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <UtensilsCrossed className="mx-auto mb-2 h-8 w-8 text-capsula-ink-faint" strokeWidth={1.5} />
            <p className="font-medium text-capsula-ink">Sin resultados</p>
            <p className="mt-1 text-[11px] text-capsula-ink-muted">Prueba cambiando el filtro o la búsqueda</p>
          </div>
        )}
      </div>

      {/* Leyenda */}
      <div className="mt-4 flex flex-wrap gap-4 px-1 text-[11px] text-capsula-ink-muted">
        {[
          { cls: 'bg-capsula-coral', label: 'Crítico < 20%' },
          { cls: 'bg-[#D96A2E]',     label: 'Bajo 20–35%' },
          { cls: 'bg-[#946A1C]',     label: 'Regular 35–50%' },
          { cls: 'bg-[#2F6B4E]',     label: 'Saludable ≥ 50%' },
        ].map(({ cls, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={cn("h-2.5 w-2.5 rounded-full", cls)} />
            {label}
          </div>
        ))}
        <span className="ml-auto italic">Los costos requieren insumos con precio registrado en módulo Costos.</span>
      </div>
    </div>
  );
}
