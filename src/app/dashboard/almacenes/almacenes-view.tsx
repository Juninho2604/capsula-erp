'use client';

import { useState, useTransition } from 'react';
import { Search, Plus, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { AreaItem } from '@/app/actions/areas.actions';
import { createAreaAction, toggleAreaStatusAction, findDuplicateAreasAction, getAreasAction } from '@/app/actions/areas.actions';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/Badge';

export default function AlmacenesView({ initialData }: { initialData: AreaItem[] }) {
  const [areas, setAreas] = useState<AreaItem[]>(initialData);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [feedback, setFeedback] = useState('');
  const [duplicates, setDuplicates] = useState<string[][] | null>(null);
  const [isPending, startTransition] = useTransition();

  const reload = async () => {
    const r = await getAreasAction();
    if (r.success) setAreas(r.data ?? []);
  };

  const handleCreate = () => {
    if (!name.trim()) { setFeedback('El nombre es obligatorio'); return; }
    startTransition(async () => {
      const r = await createAreaAction(name, description);
      setFeedback(r.message);
      if (r.success) { setName(''); setDescription(''); setShowForm(false); reload(); }
    });
  };

  const handleToggle = (id: string, current: boolean) => {
    startTransition(async () => {
      const r = await toggleAreaStatusAction(id, !current);
      setFeedback(r.message);
      if (r.success) reload();
    });
  };

  const handleDuplicates = () => {
    startTransition(async () => {
      const r = await findDuplicateAreasAction();
      setDuplicates(r.groups ?? []);
    });
  };

  const active = areas.filter(a => a.isActive);
  const inactive = areas.filter(a => !a.isActive);

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        kicker="Operaciones"
        title="Almacenes"
        description={`Gestiona las áreas de almacenamiento del sistema. ${active.length} activos · ${inactive.length} inactivos.`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleDuplicates} disabled={isPending}>
              <Search className="h-4 w-4" />
              Analizar duplicados
            </Button>
            <Button size="sm" onClick={() => { setShowForm(true); setFeedback(''); }}>
              <Plus className="h-4 w-4" />
              Nuevo almacén
            </Button>
          </>
        }
      />

      <div className="space-y-5">
        {/* Resultado duplicados */}
        {duplicates !== null && (
          <div
            className={`rounded-2xl border p-4 ${
              duplicates.length === 0
                ? 'border-[#D3E2D8] bg-[#E5EDE7]/40 dark:border-[#3a5b48] dark:bg-[#1E3B2C]/40'
                : 'border-[#E8D9B8] bg-[#F3EAD6]/40 dark:border-[#5a4a22] dark:bg-[#3B2F15]/40'
            }`}
          >
            {duplicates.length === 0 ? (
              <p className="flex items-center gap-2 text-sm font-medium text-[#2F6B4E] dark:text-[#6FB88F]">
                <CheckCircle2 className="h-4 w-4" /> No se encontraron duplicados
              </p>
            ) : (
              <>
                <p className="mb-2 flex items-center gap-2 text-sm font-medium text-[#946A1C] dark:text-[#E8D9B8]">
                  <AlertTriangle className="h-4 w-4" /> {duplicates.length} grupo(s) con nombres similares:
                </p>
                {duplicates.map((group, i) => (
                  <div key={i} className="mb-1 text-xs text-capsula-ink-soft">
                    <span className="font-mono">{group.join(' · ')}</span>
                  </div>
                ))}
              </>
            )}
            <button
              onClick={() => setDuplicates(null)}
              className="mt-2 text-xs text-capsula-ink-muted hover:text-capsula-ink"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Formulario crear */}
        {showForm && (
          <div className="rounded-2xl border border-capsula-line-strong bg-capsula-ivory-surface p-5 space-y-4 shadow-cap-soft">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Nuevo almacén</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.1em] text-capsula-ink-muted">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value.toUpperCase())}
                  placeholder="Ej: DEPOSITO PRINCIPAL"
                  className="w-full rounded-xl border border-capsula-line bg-capsula-ivory px-3 py-2 font-mono text-sm uppercase text-capsula-ink focus:border-capsula-navy-deep focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.1em] text-capsula-ink-muted">
                  Descripción
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Ej: Almacén de insumos secos"
                  className="w-full rounded-xl border border-capsula-line bg-capsula-ivory px-3 py-2 text-sm text-capsula-ink focus:border-capsula-navy-deep focus:outline-none"
                />
              </div>
            </div>
            {feedback && <p className="text-xs text-capsula-coral">{feedback}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={isPending} isLoading={isPending}>
                {isPending ? 'Creando…' : 'Crear almacén'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setFeedback(''); }}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {feedback && !showForm && (
          <p className="rounded-lg bg-capsula-ivory-alt px-3 py-2 text-xs text-capsula-ink-soft">
            {feedback}
          </p>
        )}

        {/* Tabla */}
        <div className="overflow-hidden rounded-2xl border border-capsula-line bg-capsula-ivory-surface shadow-cap-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-capsula-line bg-capsula-ivory-alt">
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.1em] text-capsula-ink-muted">Nombre</th>
                  <th className="hidden px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.1em] text-capsula-ink-muted sm:table-cell">Descripción</th>
                  <th className="hidden px-4 py-3 text-center text-[11px] font-medium uppercase tracking-[0.1em] text-capsula-ink-muted md:table-cell">Registros</th>
                  <th className="px-4 py-3 text-center text-[11px] font-medium uppercase tracking-[0.1em] text-capsula-ink-muted">Estado</th>
                  <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-[0.1em] text-capsula-ink-muted">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-capsula-line">
                {areas.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-sm text-capsula-ink-muted">
                      No hay almacenes registrados
                    </td>
                  </tr>
                )}
                {areas.map(area => (
                  <tr key={area.id} className="transition-colors hover:bg-capsula-ivory-alt/60">
                    <td className="px-4 py-3">
                      <span className="font-mono font-medium text-capsula-ink">{area.name}</span>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <span className="text-xs text-capsula-ink-soft">{area.description || '—'}</span>
                    </td>
                    <td className="hidden px-4 py-3 text-center md:table-cell">
                      <span className="text-xs text-capsula-ink-soft">{area.stockCount}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={area.isActive ? 'ok' : 'danger'}>
                        {area.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleToggle(area.id, area.isActive)}
                        disabled={isPending}
                        className={`text-xs font-medium transition-colors disabled:opacity-50 ${
                          area.isActive
                            ? 'text-capsula-coral hover:text-capsula-coral-hover'
                            : 'text-[#2F6B4E] hover:text-[#1f4a37] dark:text-[#6FB88F] dark:hover:text-[#9CD4B5]'
                        }`}
                      >
                        {area.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
