'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, ClipboardList, Package } from 'lucide-react';
import { createSkuItemAction, createProductFamily, getProductFamilies } from '@/app/actions/sku-studio.actions';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';

// ── Chip helper ──────────────────────────────────────────────────────────────
function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        selected
          ? 'border-capsula-navy-deep bg-capsula-navy-deep text-capsula-ivory'
          : 'border-capsula-line text-capsula-ink-soft hover:border-capsula-navy-deep'
      }`}
    >
      {label}
    </button>
  );
}

type Tab = 'nuevo' | 'familias' | 'plantillas';
type ItemType = 'RAW_MATERIAL' | 'SUB_RECIPE' | 'FINISHED_GOOD';

const ITEM_TYPES: { value: ItemType; label: string }[] = [
  { value: 'RAW_MATERIAL',  label: 'Materia prima' },
  { value: 'SUB_RECIPE',    label: 'Sub receta / compuesto' },
  { value: 'FINISHED_GOOD', label: 'Producto final' },
];
const OPERATIVE_ROLES = ['Ninguno', 'Insumo base', 'Intermedio', 'Compuesto', 'Final venta', 'Se transforma'];
const BASE_UNITS      = ['KG', 'G', 'L', 'ML', 'UNIT', 'PORTION'];
const TRACKING_MODES  = ['Por unidad', 'Receta', 'Compuesto', 'Solo display'];

interface Family { id: string; code: string; name: string; icon: string | null; _count: { items: number; templates: number } }
interface Template { id: string; name: string; productFamily: { id: string; code: string; name: string } | null }

const FIELD_LABEL = 'mb-1 block text-[11px] font-medium uppercase tracking-[0.1em] text-capsula-ink-muted';
const FIELD_INPUT = 'w-full rounded-xl border border-capsula-line bg-capsula-ivory px-3 py-2 text-sm text-capsula-ink focus:border-capsula-navy-deep focus:outline-none';

export default function SkuStudioView({ families: initFamilies, templates }: { families: Family[]; templates: Template[] }) {
  const [tab, setTab] = useState<Tab>('nuevo');
  const [families, setFamilies] = useState<Family[]>(initFamilies);

  // ── Nuevo SKU state ──────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [skuPrefix, setSkuPrefix] = useState('');
  const [itemType, setItemType] = useState<ItemType>('RAW_MATERIAL');
  const [operRole, setOperRole] = useState('Ninguno');
  const [unit, setUnit] = useState('KG');
  const [tracking, setTracking] = useState('Por unidad');
  const [isBeverage, setIsBeverage] = useState(false);
  const [familyId, setFamilyId] = useState('');
  const [initialCost, setInitialCost] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [lastCreated, setLastCreated] = useState<{ sku: string; name: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // ── Familia state ────────────────────────────────────────────────────────
  const [famCode, setFamCode] = useState('');
  const [famName, setFamName] = useState('');
  const [famIcon, setFamIcon] = useState('');
  const [famFeedback, setFamFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleCreate = () => {
    if (!name.trim()) { setFeedback({ ok: false, msg: 'El nombre es obligatorio' }); return; }
    startTransition(async () => {
      const r = await createSkuItemAction({
        name,
        skuPrefix: skuPrefix || undefined,
        type: itemType,
        baseUnit: unit,
        productFamilyId: familyId || undefined,
        operativeRole: operRole,
        trackingMode: tracking,
        isBeverage,
        initialCost: initialCost ? parseFloat(initialCost) : undefined,
      });
      setFeedback({ ok: r.success, msg: r.message });
      if (r.success && r.data) {
        setLastCreated({ sku: r.data.sku, name: r.data.name });
        setName(''); setSkuPrefix(''); setItemType('RAW_MATERIAL');
        setOperRole('Ninguno'); setUnit('KG'); setTracking('Por unidad');
        setIsBeverage(false); setFamilyId(''); setInitialCost('');
      }
    });
  };

  const handleCreateFamily = () => {
    if (!famCode.trim() || !famName.trim()) { setFamFeedback({ ok: false, msg: 'Código y nombre son obligatorios' }); return; }
    startTransition(async () => {
      try {
        await createProductFamily({ code: famCode, name: famName, icon: famIcon || undefined });
        const updated = await getProductFamilies();
        setFamilies(updated);
        setFamCode(''); setFamName(''); setFamIcon('');
        setFamFeedback({ ok: true, msg: 'Familia creada correctamente' });
      } catch (e: any) {
        setFamFeedback({ ok: false, msg: e.message || 'Error al crear familia' });
      }
    });
  };

  const feedbackClass = (ok: boolean) =>
    `rounded-lg px-3 py-2 text-xs ${
      ok
        ? 'bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]'
        : 'bg-[#F7E3DB] text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8]'
    }`;

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        kicker="Catálogo"
        title="SKU Studio"
        description="Creación guiada de productos con familias y plantillas. Pensado para alta rotación de carta."
      />

      <div className="space-y-5">
        {/* Tabs */}
        <div className="flex gap-1 rounded-2xl border border-capsula-line bg-capsula-ivory-alt p-1">
          {([['nuevo', 'Nuevo SKU'], ['familias', 'Familias'], ['plantillas', 'Plantillas']] as [Tab, string][]).map(([t, l]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
                tab === t
                  ? 'bg-capsula-ivory-surface text-capsula-ink shadow-cap-soft'
                  : 'text-capsula-ink-muted hover:text-capsula-ink'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* ── TAB: Nuevo SKU ────────────────────────────────────────────────── */}
        {tab === 'nuevo' && (
          <div className="rounded-2xl border border-capsula-line bg-capsula-ivory-surface p-5 shadow-cap-soft space-y-5">
            {lastCreated && (
              <div className="flex items-center gap-3 rounded-xl border border-[#D3E2D8] bg-[#E5EDE7]/40 px-4 py-3 dark:border-[#3a5b48] dark:bg-[#1E3B2C]/40">
                <CheckCircle2 className="h-4 w-4 text-[#2F6B4E] dark:text-[#6FB88F]" />
                <div>
                  <p className="text-sm font-medium text-[#2F6B4E] dark:text-[#6FB88F]">{lastCreated.name}</p>
                  <p className="font-mono text-xs text-capsula-ink-soft">SKU: {lastCreated.sku}</p>
                </div>
              </div>
            )}

            {/* Nombre */}
            <div>
              <label className={FIELD_LABEL}>Nombre del ítem</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ej. Pechuga deshuesada MAP"
                className={FIELD_INPUT}
              />
            </div>

            {/* Familia */}
            <div>
              <label className={FIELD_LABEL}>Familia / categoría</label>
              <select
                value={familyId}
                onChange={e => setFamilyId(e.target.value)}
                className={FIELD_INPUT}
              >
                <option value="">— Sin familia —</option>
                {families.map(f => (
                  <option key={f.id} value={f.id}>{f.icon ? `${f.icon} ` : ''}{f.name} ({f.code})</option>
                ))}
              </select>
            </div>

            {/* Tipo de inventario */}
            <div>
              <label className={FIELD_LABEL + ' mb-2'}>Tipo de inventario</label>
              <div className="flex flex-wrap gap-2">
                {ITEM_TYPES.map(t => (
                  <Chip key={t.value} label={t.label} selected={itemType === t.value} onClick={() => setItemType(t.value)} />
                ))}
              </div>
            </div>

            {/* Rol operativo */}
            <div>
              <label className={FIELD_LABEL + ' mb-2'}>
                Rol operativo <span className="font-normal normal-case tracking-normal text-capsula-ink-faint">(opcional)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {OPERATIVE_ROLES.map(r => (
                  <Chip key={r} label={r} selected={operRole === r} onClick={() => setOperRole(r)} />
                ))}
              </div>
            </div>

            {/* Unidad base */}
            <div>
              <label className={FIELD_LABEL + ' mb-2'}>Unidad base</label>
              <div className="flex flex-wrap gap-2">
                {BASE_UNITS.map(u => (
                  <Chip key={u} label={u} selected={unit === u} onClick={() => setUnit(u)} />
                ))}
              </div>
            </div>

            {/* Seguimiento de stock */}
            <div>
              <label className={FIELD_LABEL + ' mb-2'}>Seguimiento de stock</label>
              <div className="flex flex-wrap gap-2">
                {TRACKING_MODES.map(m => (
                  <Chip key={m} label={m} selected={tracking === m} onClick={() => setTracking(m)} />
                ))}
              </div>
            </div>

            {/* Bebida */}
            <label className="flex items-center gap-2 text-sm text-capsula-ink-soft">
              <input
                type="checkbox"
                checked={isBeverage}
                onChange={e => setIsBeverage(e.target.checked)}
                className="h-4 w-4 rounded accent-capsula-navy-deep"
              />
              Bebida (marca para reportes de bar)
            </label>

            {/* Prefijo SKU + Costo inicial */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={FIELD_LABEL}>
                  Prefijo SKU <span className="font-normal normal-case tracking-normal text-capsula-ink-faint">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={skuPrefix}
                  onChange={e => setSkuPrefix(e.target.value.toUpperCase())}
                  placeholder="Ej. CARN"
                  maxLength={8}
                  className={FIELD_INPUT + ' font-mono uppercase'}
                />
              </div>
              <div>
                <label className={FIELD_LABEL}>
                  Costo inicial $ <span className="font-normal normal-case tracking-normal text-capsula-ink-faint">(opcional)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={initialCost}
                  onChange={e => setInitialCost(e.target.value)}
                  placeholder="0.00"
                  className={FIELD_INPUT}
                />
              </div>
            </div>

            {feedback && <p className={feedbackClass(feedback.ok)}>{feedback.msg}</p>}

            <Button onClick={handleCreate} disabled={isPending} isLoading={isPending} className="w-full">
              {isPending ? 'Creando…' : 'Crear ítem en inventario'}
            </Button>
          </div>
        )}

        {/* ── TAB: Familias ────────────────────────────────────────────────── */}
        {tab === 'familias' && (
          <div className="space-y-4">
            {/* Crear familia */}
            <div className="rounded-2xl border border-capsula-line bg-capsula-ivory-surface p-5 shadow-cap-soft space-y-3">
              <h2 className="text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Nueva familia</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className={FIELD_LABEL}>Código *</label>
                  <input
                    type="text"
                    value={famCode}
                    onChange={e => setFamCode(e.target.value.toUpperCase())}
                    placeholder="Ej. CARNE"
                    className={FIELD_INPUT + ' font-mono uppercase'}
                  />
                </div>
                <div>
                  <label className={FIELD_LABEL}>Nombre *</label>
                  <input
                    type="text"
                    value={famName}
                    onChange={e => setFamName(e.target.value)}
                    placeholder="Ej. Carnes y proteínas"
                    className={FIELD_INPUT}
                  />
                </div>
                <div>
                  <label className={FIELD_LABEL}>Ícono</label>
                  <input
                    type="text"
                    value={famIcon}
                    onChange={e => setFamIcon(e.target.value)}
                    placeholder="Ej. 🥩"
                    className={FIELD_INPUT}
                  />
                </div>
              </div>
              {famFeedback && <p className={feedbackClass(famFeedback.ok)}>{famFeedback.msg}</p>}
              <Button size="sm" onClick={handleCreateFamily} disabled={isPending} isLoading={isPending}>
                {isPending ? 'Creando…' : 'Crear familia'}
              </Button>
            </div>

            {/* Lista familias */}
            <div className="overflow-hidden rounded-2xl border border-capsula-line bg-capsula-ivory-surface shadow-cap-soft">
              <div className="border-b border-capsula-line bg-capsula-ivory-alt px-5 py-3">
                <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">
                  Familias ({families.length})
                </span>
              </div>
              {families.length === 0 ? (
                <div className="py-8 text-center text-sm text-capsula-ink-muted">
                  Sin familias — crea la primera arriba
                </div>
              ) : (
                <div className="divide-y divide-capsula-line">
                  {families.map(f => (
                    <div key={f.id} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-capsula-ivory-alt/60">
                      <span className="text-xl" aria-hidden>{f.icon || ''}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-capsula-ink">{f.name}</p>
                        <p className="font-mono text-[11px] text-capsula-ink-muted">
                          {f.code} · {f._count.items} ítems · {f._count.templates} plantillas
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: Plantillas ──────────────────────────────────────────────── */}
        {tab === 'plantillas' && (
          <div className="overflow-hidden rounded-2xl border border-capsula-line bg-capsula-ivory-surface shadow-cap-soft">
            <div className="border-b border-capsula-line bg-capsula-ivory-alt px-5 py-3">
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">
                Plantillas ({templates.length})
              </span>
            </div>
            {templates.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-capsula-ink-muted">
                <ClipboardList className="h-6 w-6 opacity-50" />
                <p className="text-sm font-medium">Sin plantillas</p>
                <p className="text-xs">Las plantillas permiten pre-rellenar chips al crear nuevos SKUs</p>
              </div>
            ) : (
              <div className="divide-y divide-capsula-line">
                {templates.map(t => (
                  <div key={t.id} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-capsula-ivory-alt/60">
                    <Package className="h-4 w-4 text-capsula-ink-muted" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-capsula-ink">{t.name}</p>
                      {t.productFamily && (
                        <p className="font-mono text-[11px] text-capsula-ink-muted">{t.productFamily.name}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
