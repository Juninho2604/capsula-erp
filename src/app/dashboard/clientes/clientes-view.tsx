'use client';

import { useMemo, useState, useTransition } from 'react';
import { Plus as PlusIcon, Search, X as XIcon, Pencil, Phone, MapPin, Mail, CreditCard, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import {
    createCustomerAction,
    updateCustomerAction,
    deactivateCustomerAction,
    reactivateCustomerAction,
    type CustomerSummary,
    type CustomerInput,
} from '@/app/actions/customer.actions';

interface Props {
    initialCustomers: CustomerSummary[];
    currentUserRole: string;
}

type EditState =
    | { mode: 'closed' }
    | { mode: 'create' }
    | { mode: 'edit'; id: string };

export function ClientesView({ initialCustomers, currentUserRole: _currentUserRole }: Props) {
    const [customers, setCustomers] = useState<CustomerSummary[]>(initialCustomers);
    const [query, setQuery] = useState('');
    const [editing, setEditing] = useState<EditState>({ mode: 'closed' });
    const [showInactive, setShowInactive] = useState(false);
    const [isPending, startTransition] = useTransition();

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        let list = customers;
        if (!showInactive) list = list.filter((c) => c.isActive);
        if (!q) return list;
        return list.filter(
            (c) =>
                c.fullName.toLowerCase().includes(q) ||
                (c.idDocument ?? '').toLowerCase().includes(q) ||
                (c.phone ?? '').toLowerCase().includes(q) ||
                (c.email ?? '').toLowerCase().includes(q),
        );
    }, [customers, query, showInactive]);

    function handleEdit(id: string) {
        setEditing({ mode: 'edit', id });
    }

    function handleCreate() {
        setEditing({ mode: 'create' });
    }

    function handleDeactivate(id: string) {
        if (!window.confirm('¿Desactivar cliente? Ya no aparecerá en autocomplete del POS, pero el historial se conserva.')) return;
        startTransition(async () => {
            const res = await deactivateCustomerAction(id);
            if (!res.success) {
                toast.error(res.message ?? 'Error desactivando');
                return;
            }
            setCustomers((cs) => cs.map((c) => (c.id === id ? { ...c, isActive: false } : c)));
            toast.success('Cliente desactivado');
        });
    }

    function handleReactivate(id: string) {
        startTransition(async () => {
            const res = await reactivateCustomerAction(id);
            if (!res.success) {
                toast.error(res.message ?? 'Error reactivando');
                return;
            }
            setCustomers((cs) => cs.map((c) => (c.id === id ? { ...c, isActive: true } : c)));
            toast.success('Cliente reactivado');
        });
    }

    function handleSaved(saved: CustomerSummary, isNew: boolean) {
        setCustomers((cs) =>
            isNew ? [saved, ...cs] : cs.map((c) => (c.id === saved.id ? saved : c)),
        );
        setEditing({ mode: 'closed' });
    }

    const editingCustomer =
        editing.mode === 'edit' ? customers.find((c) => c.id === editing.id) ?? null : null;

    return (
        <div className="space-y-4 p-4 sm:p-6 max-w-6xl mx-auto">
            <header className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-[-0.02em] text-capsula-ink">Clientes</h1>
                    <p className="text-xs text-capsula-ink-muted font-semibold uppercase tracking-[0.14em] mt-1">
                        Clientes recurrentes · {filtered.length} {filtered.length === 1 ? 'registro' : 'registros'}
                    </p>
                </div>
                <button
                    onClick={handleCreate}
                    className="pos-btn inline-flex items-center gap-2 px-4 py-2 text-sm"
                >
                    <PlusIcon className="h-4 w-4" /> Nuevo cliente
                </button>
            </header>

            {/* Buscador */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[260px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-capsula-ink-muted" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar por nombre, cédula, teléfono o email…"
                        className="pos-input w-full pl-9"
                    />
                    {query && (
                        <button
                            onClick={() => setQuery('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full hover:bg-capsula-coral/10 hover:text-capsula-coral text-capsula-ink-muted flex items-center justify-center"
                        >
                            <XIcon className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-capsula-ink-soft cursor-pointer">
                    <input
                        type="checkbox"
                        checked={showInactive}
                        onChange={(e) => setShowInactive(e.target.checked)}
                        className="accent-capsula-navy-deep"
                    />
                    Mostrar inactivos
                </label>
            </div>

            {/* Lista */}
            {filtered.length === 0 ? (
                <div className="pos-card text-center py-12">
                    <p className="text-capsula-ink-muted font-semibold">
                        {query ? 'Sin resultados para esa búsqueda.' : 'Aún no hay clientes registrados.'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filtered.map((c) => (
                        <article
                            key={c.id}
                            className={`pos-card p-4 space-y-2 ${!c.isActive ? 'opacity-60' : ''}`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <h3 className="font-semibold text-capsula-ink truncate">{c.fullName}</h3>
                                    {c.idDocument && (
                                        <p className="text-[11px] text-capsula-ink-muted font-semibold tabular-nums mt-0.5 inline-flex items-center gap-1">
                                            <CreditCard className="h-3 w-3" /> {c.idDocument}
                                        </p>
                                    )}
                                </div>
                                {!c.isActive && (
                                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted bg-capsula-ivory-alt border border-capsula-line px-1.5 py-0.5 rounded">
                                        Inactivo
                                    </span>
                                )}
                            </div>
                            <div className="space-y-0.5 text-xs text-capsula-ink-soft">
                                {c.phone && (
                                    <p className="inline-flex items-center gap-1.5">
                                        <Phone className="h-3 w-3 text-capsula-ink-muted" /> {c.phone}
                                    </p>
                                )}
                                {c.email && (
                                    <p className="inline-flex items-center gap-1.5 truncate">
                                        <Mail className="h-3 w-3 text-capsula-ink-muted shrink-0" /> <span className="truncate">{c.email}</span>
                                    </p>
                                )}
                                {c.address && (
                                    <p className="inline-flex items-start gap-1.5">
                                        <MapPin className="h-3 w-3 text-capsula-ink-muted mt-0.5 shrink-0" />
                                        <span className="line-clamp-2">{c.address}</span>
                                    </p>
                                )}
                            </div>
                            {(c.totalOrders > 0 || c.totalSpent > 0) && (
                                <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted pt-2 border-t border-capsula-line">
                                    <span>{c.totalOrders} órdenes</span>
                                    <span className="tabular-nums">${c.totalSpent.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex gap-2 pt-1">
                                <button
                                    onClick={() => handleEdit(c.id)}
                                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-capsula-line bg-capsula-ivory-surface hover:border-capsula-navy-deep/40 text-xs font-semibold text-capsula-ink"
                                >
                                    <Pencil className="h-3 w-3" /> Editar
                                </button>
                                {c.isActive ? (
                                    <button
                                        disabled={isPending}
                                        onClick={() => handleDeactivate(c.id)}
                                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-capsula-line bg-capsula-ivory-surface hover:border-capsula-coral hover:text-capsula-coral text-xs font-semibold text-capsula-ink-muted"
                                    >
                                        Desactivar
                                    </button>
                                ) : (
                                    <button
                                        disabled={isPending}
                                        onClick={() => handleReactivate(c.id)}
                                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-capsula-line bg-capsula-ivory-surface hover:border-capsula-navy-deep/40 text-xs font-semibold text-capsula-ink-soft"
                                    >
                                        <Check className="h-3 w-3" /> Reactivar
                                    </button>
                                )}
                            </div>
                        </article>
                    ))}
                </div>
            )}

            {/* Modal crear/editar */}
            {editing.mode !== 'closed' && (
                <CustomerFormModal
                    initial={editingCustomer ?? undefined}
                    onClose={() => setEditing({ mode: 'closed' })}
                    onSaved={(c) => handleSaved(c, editing.mode === 'create')}
                />
            )}
        </div>
    );
}

function CustomerFormModal({
    initial,
    onClose,
    onSaved,
}: {
    initial?: CustomerSummary;
    onClose: () => void;
    onSaved: (c: CustomerSummary) => void;
}) {
    const [fullName, setFullName] = useState(initial?.fullName ?? '');
    const [idDocument, setIdDocument] = useState(initial?.idDocument ?? '');
    const [phone, setPhone] = useState(initial?.phone ?? '');
    const [email, setEmail] = useState(initial?.email ?? '');
    const [address, setAddress] = useState(initial?.address ?? '');
    const [notes, setNotes] = useState(initial?.notes ?? '');
    const [isPending, startTransition] = useTransition();

    function handleSave() {
        const input: CustomerInput = {
            fullName: fullName.trim(),
            idDocument: idDocument.trim() || undefined,
            phone: phone.trim() || undefined,
            email: email.trim() || undefined,
            address: address.trim() || undefined,
            notes: notes.trim() || undefined,
        };
        startTransition(async () => {
            const res = initial
                ? await updateCustomerAction(initial.id, input)
                : await createCustomerAction(input);
            if (!res.success) {
                toast.error(res.message ?? 'Error guardando');
                return;
            }
            const saved: CustomerSummary | null = initial
                ? { ...initial, ...input, idDocument: input.idDocument ?? null, phone: input.phone ?? null, email: input.email ?? null, address: input.address ?? null, notes: input.notes ?? null }
                : (res as { customer?: CustomerSummary }).customer ?? null;
            if (!saved) {
                toast.error('Se guardó pero no se pudo recuperar el cliente');
                onClose();
                return;
            }
            toast.success(initial ? 'Cliente actualizado' : 'Cliente creado');
            onSaved(saved);
        });
    }

    return (
        <div className="fixed inset-0 z-[60] bg-capsula-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
            <div className="bg-capsula-ivory border border-capsula-line w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl">
                <div className="border-b border-capsula-line p-5 flex items-center justify-between">
                    <h3 className="font-semibold text-lg tracking-[-0.02em] text-capsula-ink">
                        {initial ? 'Editar cliente' : 'Nuevo cliente'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="h-8 w-8 rounded-full hover:bg-capsula-coral/10 hover:text-capsula-coral text-capsula-ink-muted flex items-center justify-center"
                    >
                        <XIcon className="h-4 w-4" />
                    </button>
                </div>
                <div className="p-5 space-y-3">
                    <div>
                        <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Nombre completo *</label>
                        <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="pos-input w-full mt-1" placeholder="Julio Acosta" autoFocus />
                    </div>
                    <div>
                        <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Cédula / RIF</label>
                        <input value={idDocument} onChange={(e) => setIdDocument(e.target.value)} className="pos-input w-full mt-1" placeholder="V-12345678 · E-... · J-..." />
                        <p className="text-[10px] text-capsula-ink-muted mt-1">Opcional. Si la cliente no tiene cédula, dejar vacío.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Teléfono</label>
                            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="pos-input w-full mt-1" placeholder="0424-1234567" />
                        </div>
                        <div>
                            <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Email</label>
                            <input value={email} onChange={(e) => setEmail(e.target.value)} className="pos-input w-full mt-1" placeholder="julio@gmail.com" />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Dirección (delivery)</label>
                        <textarea value={address} onChange={(e) => setAddress(e.target.value)} className="pos-input w-full mt-1 min-h-[60px]" placeholder="Av. Principal, Edif Vista, Apto 5-B, Caracas" />
                    </div>
                    <div>
                        <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Notas</label>
                        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="pos-input w-full mt-1 min-h-[50px]" placeholder="Sin cebolla, le gusta el shawarma de carne…" />
                    </div>
                </div>
                <div className="border-t border-capsula-line p-4 flex gap-3">
                    <button onClick={onClose} className="pos-btn-secondary flex-1 py-3">Cancelar</button>
                    <button
                        onClick={handleSave}
                        disabled={isPending || !fullName.trim()}
                        className="pos-btn flex-[2] py-3 inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Check className="h-4 w-4" /> {isPending ? 'Guardando…' : 'Guardar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
