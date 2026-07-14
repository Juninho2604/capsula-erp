'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Plus, X as XIcon, Check, Loader2, Building2, Search, Pencil, Phone, Mail } from 'lucide-react';
import { upsertSupplierAction, setSupplierActiveAction, type SupplierData } from '@/app/actions/supplier.actions';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { ModalPortal } from '@/components/ui/modal-portal';

const fmt = (n: number) => n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Props {
  initialSuppliers: SupplierData[];
  canManage: boolean;
}

export function ProveedoresView({ initialSuppliers, canManage }: Props) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<SupplierData | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = initialSuppliers.filter(s =>
    !q.trim() || [s.name, s.rif, s.code, s.contactName].some(v => (v ?? '').toLowerCase().includes(q.trim().toLowerCase()))
  );

  const totalPending = initialSuppliers.reduce((s, x) => s + x.pendingUsd, 0);
  const totalAdvance = initialSuppliers.reduce((s, x) => s + x.advanceBalanceUsd, 0);

  const toggleActive = async (s: SupplierData) => {
    const res = await setSupplierActiveAction(s.id, !s.isActive);
    if (res.success) { toast.success(s.isActive ? 'Proveedor desactivado' : 'Proveedor activado'); router.refresh(); }
    else toast.error(res.error ?? 'Error');
  };

  return (
    <div>
      <PageHeader
        kicker="Finanzas"
        title="Proveedores"
        description="Registro de proveedores — se reflejan en Documentos y Cuentas por pagar"
        actions={canManage ? (
          <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Nuevo proveedor</Button>
        ) : undefined}
      />

      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-capsula-line bg-capsula-ivory-surface p-5 shadow-cap-soft">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Proveedores</p>
            <p className="mt-1 font-semibold text-2xl tracking-[-0.02em] tabular-nums text-capsula-ink">{initialSuppliers.filter(s => s.isActive).length}</p>
          </div>
          <div className="rounded-2xl border border-[#E8D9B8] bg-[#F3EAD6]/40 p-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Por pagar (total)</p>
            <p className="mt-1 font-semibold text-2xl tracking-[-0.02em] tabular-nums text-capsula-ink">${fmt(totalPending)}</p>
          </div>
          <div className="rounded-2xl border border-[#D3E2D8] bg-[#E5EDE7]/40 p-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Anticipos a favor</p>
            <p className="mt-1 font-semibold text-2xl tracking-[-0.02em] tabular-nums text-[#2F6B4E] dark:text-[#6FB88F]">${fmt(totalAdvance)}</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-capsula-ink-muted" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nombre, RIF, código…" className="pos-input w-full pl-10" />
        </div>

        <div className="rounded-2xl border border-capsula-line bg-capsula-ivory overflow-hidden shadow-cap-soft">
          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Building2 className="mx-auto h-10 w-10 text-capsula-ink-faint" />
              <p className="mt-2 text-sm text-capsula-ink-muted">Sin proveedores. Crea el primero.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead className="border-b border-capsula-line bg-capsula-ivory-surface text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                  <tr>
                    <th className="px-5 py-3 text-left">Proveedor</th>
                    <th className="px-5 py-3 text-left">RIF</th>
                    <th className="px-5 py-3 text-left">Contacto</th>
                    <th className="px-5 py-3 text-right">Por pagar</th>
                    <th className="px-5 py-3 text-right">Anticipo</th>
                    {canManage && <th className="px-5 py-3 text-center">Acción</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-capsula-line">
                  {filtered.map(s => (
                    <tr key={s.id} className={`hover:bg-capsula-ivory-surface ${!s.isActive ? 'opacity-50' : ''}`}>
                      <td className="px-5 py-3">
                        <div className="font-semibold text-capsula-ink">{s.name}{!s.isActive && <span className="ml-2 text-[10px] uppercase text-capsula-ink-muted">inactivo</span>}</div>
                        {s.code && <div className="text-xs text-capsula-ink-muted">Cód. {s.code}</div>}
                      </td>
                      <td className="px-5 py-3 text-capsula-ink-soft tabular-nums">{s.rif || '—'}</td>
                      <td className="px-5 py-3 text-capsula-ink-soft">
                        {s.contactName && <div>{s.contactName}</div>}
                        <div className="flex flex-wrap gap-2 text-xs text-capsula-ink-muted">
                          {s.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{s.phone}</span>}
                          {s.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{s.email}</span>}
                        </div>
                      </td>
                      <td className={`px-5 py-3 text-right font-semibold tabular-nums ${s.pendingUsd > 0 ? 'text-capsula-coral' : 'text-capsula-ink-muted'}`}>{s.pendingUsd > 0 ? `$${fmt(s.pendingUsd)}` : '—'}</td>
                      <td className={`px-5 py-3 text-right font-semibold tabular-nums ${s.advanceBalanceUsd > 0 ? 'text-[#2F6B4E] dark:text-[#6FB88F]' : 'text-capsula-ink-muted'}`}>{s.advanceBalanceUsd > 0 ? `$${fmt(s.advanceBalanceUsd)}` : '—'}</td>
                      {canManage && (
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => setEditing(s)} className="rounded-lg bg-capsula-navy-soft text-capsula-ink px-2.5 py-1.5 text-xs font-semibold hover:bg-capsula-navy hover:text-capsula-cream transition"><Pencil className="h-3.5 w-3.5" /></button>
                            <button onClick={() => toggleActive(s)} className="rounded-lg border border-capsula-line px-2.5 py-1.5 text-xs font-semibold text-capsula-ink-soft hover:border-capsula-navy-deep transition">{s.isActive ? 'Desactivar' : 'Activar'}</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {(creating || editing) && (
        <SupplierModal
          supplier={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

function SupplierModal({ supplier, onClose, onSaved }: { supplier: SupplierData | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    name: supplier?.name ?? '', rif: supplier?.rif ?? '', code: supplier?.code ?? '',
    contactName: supplier?.contactName ?? '', phone: supplier?.phone ?? '', email: supplier?.email ?? '',
    address: supplier?.address ?? '', notes: supplier?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!f.name.trim()) { setError('El nombre es requerido'); return; }
    setSaving(true);
    const res = await upsertSupplierAction({ id: supplier?.id, ...f });
    setSaving(false);
    if (res.success) { toast.success(supplier ? 'Proveedor actualizado' : 'Proveedor creado'); onSaved(); }
    else setError(res.error ?? 'Error');
  };

  const field = (label: string, key: keyof typeof f, opts?: { placeholder?: string; type?: string }) => (
    <label className="block space-y-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">{label}</span>
      <input type={opts?.type ?? 'text'} value={f[key]} onChange={e => setF(p => ({ ...p, [key]: e.target.value }))} placeholder={opts?.placeholder} className="pos-input w-full py-2.5" />
    </label>
  );

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[60] bg-capsula-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
        <div className="bg-capsula-ivory border border-capsula-line w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto">
          <div className="border-b border-capsula-line p-5 flex items-center justify-between sticky top-0 bg-capsula-ivory z-10">
            <h3 className="font-semibold text-lg tracking-[-0.02em] text-capsula-ink">{supplier ? 'Editar proveedor' : 'Nuevo proveedor'}</h3>
            <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-capsula-coral/10 hover:text-capsula-coral text-capsula-ink-muted flex items-center justify-center" aria-label="Cerrar"><XIcon className="h-4 w-4" /></button>
          </div>
          <div className="p-5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {field('Nombre *', 'name', { placeholder: 'Distribuidora X' })}
              {field('RIF', 'rif', { placeholder: 'J-12345678-9' })}
              {field('Código interno', 'code')}
              {field('Contacto', 'contactName')}
              {field('Teléfono', 'phone')}
              {field('Email', 'email', { type: 'email' })}
            </div>
            {field('Dirección', 'address')}
            <label className="block space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Notas</span>
              <textarea value={f.notes} onChange={e => setF(p => ({ ...p, notes: e.target.value }))} rows={2} className="pos-input w-full resize-none" />
            </label>
            {error && <p className="text-sm text-capsula-coral">{error}</p>}
          </div>
          <div className="border-t border-capsula-line p-4 flex gap-3">
            <button onClick={onClose} className="pos-btn-secondary flex-1 py-3">Cancelar</button>
            <button onClick={submit} disabled={saving} className="pos-btn flex-[2] py-3 inline-flex items-center justify-center gap-2 disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Guardar
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
