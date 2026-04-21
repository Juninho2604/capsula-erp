'use client';

import { useState, useTransition } from 'react';
import type { AreaItem } from '@/app/actions/areas.actions';
import { createAreaAction, toggleAreaStatusAction, findDuplicateAreasAction, getAreasAction } from '@/app/actions/areas.actions';
import { Search, Plus, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/Badge';

const inputClass =
  'w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2 text-[14px] text-capsula-ink outline-none transition-colors focus:border-capsula-navy-deep';
const labelClass = 'mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted';

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
    <div className="mx-auto max-w-5xl animate-in">
      <PageHeader
        kicker="Inventario"
        title="Almacenes"
        description={`Gestiona las áreas de almacenamiento del sistema. ${active.length} activos · ${inactive.length} inactivos.`}
        actions={
          <>
            <Button variant="ghost" onClick={handleDuplicates} disabled={isPending}>
              <Search className="h-4 w-4" strokeWidth={1.5} /> Analizar duplicados
            </Button>
            <Button variant="primary" onClick={() => { setShowForm(true); setFeedback(''); }}>
              <Plus className="h-4 w-4" strokeWidth={2} /> Nuevo almacén
            </Button>
          </>
        }
      />

      {/* Resultado duplicados */}
      {duplicates !== null && (
        <div className={`mb-4 rounded-[var(--radius)] border p-4 ${duplicates.length === 0 ? 'border-[#D3E2D8] bg-[#E5EDE7]' : 'border-[#E8D9B8] bg-[#F3EAD6]'}`}>
          {duplicates.length === 0 ? (
            <p className="flex items-center gap-2 text-[13px] font-medium text-[#2F6B4E]">
              <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} /> No se encontraron duplicados
            </p>
          ) : (
            <>
              <p className="mb-2 flex items-center gap-2 text-[13px] font-medium text-[#946A1C]">
                <AlertTriangle className="h-4 w-4" strokeWidth={1.5} /> {duplicates.length} grupo(s) con nombres similares:
              </p>
              {duplicates.map((group, i) => (
                <div key={i} className="mb-1 font-mono text-[12px] text-capsula-ink-soft">
                  {group.join(' · ')}
                </div>
              ))}
            </>
          )}
          <button
            onClick={() => setDuplicates(null)}
            className="mt-2 inline-flex items-center gap-1 text-[11px] text-capsula-ink-muted hover:text-capsula-ink"
          >
            <X className="h-3 w-3" strokeWidth={1.5} /> Cerrar
          </button>
        </div>
      )}

      {/* Formulario crear */}
      {showForm && (
        <div className="mb-4 space-y-4 rounded-[var(--radius)] border border-capsula-navy-deep/30 bg-capsula-ivory-surface p-5">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Nuevo almacén</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Nombre *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value.toUpperCase())}
                placeholder="Ej: DEPOSITO PRINCIPAL"
                className={inputClass + ' font-mono uppercase'}
              />
            </div>
            <div>
              <label className={labelClass}>Descripción</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Ej: Almacén de insumos secos"
                className={inputClass}
              />
            </div>
          </div>
          {feedback && <p className="text-[12px] text-capsula-coral">{feedback}</p>}
          <div className="flex gap-2">
            <Button variant="primary" onClick={handleCreate} isLoading={isPending}>
              {isPending ? 'Creando…' : 'Crear almacén'}
            </Button>
            <Button variant="ghost" onClick={() => { setShowForm(false); setFeedback(''); }}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {feedback && !showForm && (
        <p className="mb-4 rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-alt px-3 py-2 text-[12px] text-capsula-ink-soft">{feedback}</p>
      )}

      {/* Tabla */}
      <div className="overflow-hidden rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-capsula-line bg-capsula-ivory">
                <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Nombre</th>
                <th className="hidden px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted sm:table-cell">Descripción</th>
                <th className="hidden px-4 py-3 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted md:table-cell">Registros</th>
                <th className="px-4 py-3 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Estado</th>
                <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Acción</th>
              </tr>
            </thead>
            <tbody>
              {areas.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-[13px] text-capsula-ink-muted">No hay almacenes registrados</td>
                </tr>
              )}
              {areas.map(area => (
                <tr key={area.id} className="border-b border-capsula-line transition-colors last:border-b-0 hover:bg-capsula-ivory">
                  <td className="px-4 py-3">
                    <span className="font-mono text-[13px] font-semibold text-capsula-ink">{area.name}</span>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <span className="text-[12px] text-capsula-ink-muted">{area.description || '—'}</span>
                  </td>
                  <td className="hidden px-4 py-3 text-center md:table-cell">
                    <span className="font-mono text-[12px] text-capsula-ink-soft">{area.stockCount}</span>
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
                      className={`text-[12px] font-medium transition-colors disabled:opacity-50 ${area.isActive ? 'text-capsula-coral hover:text-capsula-coral-hover' : 'text-[#2F6B4E] hover:text-[#1F4E37]'}`}
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
  );
}
