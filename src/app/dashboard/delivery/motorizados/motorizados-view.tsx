'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Bike, Plus, Phone, Pencil, X as XIcon, Check, Power } from 'lucide-react';
import {
    createDeliveryDriverAction,
    updateDeliveryDriverAction,
    type DeliveryDriverRow,
} from '@/app/actions/delivery.actions';

const STATUS_OPTS = [
    { value: 'AVAILABLE', label: 'Disponible' },
    { value: 'ON_ROUTE', label: 'En ruta' },
    { value: 'OFFLINE', label: 'Fuera' },
];
const STATUS_TONE: Record<string, string> = {
    AVAILABLE: 'bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]',
    ON_ROUTE: 'bg-[#E6ECF4] text-[#2A4060] dark:bg-[#1A2636] dark:text-[#D1DCE9]',
    OFFLINE: 'bg-capsula-ivory-alt text-capsula-ink-muted',
};

export function MotorizadosView({
    initialDrivers,
    branches,
}: {
    initialDrivers: DeliveryDriverRow[];
    branches: { id: string; name: string }[];
}) {
    const router = useRouter();
    const [drivers, setDrivers] = useState(initialDrivers);
    const [editing, setEditing] = useState<DeliveryDriverRow | null>(null);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const branchName = (id: string | null) =>
        id ? branches.find(b => b.id === id)?.name ?? null : null;

    function refresh() {
        router.refresh();
    }

    function patch(id: string, p: Parameters<typeof updateDeliveryDriverAction>[1]) {
        setError(null);
        startTransition(async () => {
            const res = await updateDeliveryDriverAction(id, p);
            if (!res.success) {
                setError(res.message ?? 'No se pudo actualizar.');
                return;
            }
            setDrivers(prev => prev.map(d => (d.id === id ? { ...d, ...p } as DeliveryDriverRow : d)));
            refresh();
        });
    }

    return (
        <div className="p-4 sm:p-6 space-y-5">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="h-10 w-10 rounded-2xl bg-capsula-navy-deep text-capsula-cream flex items-center justify-center">
                        <Bike className="h-5 w-5" />
                    </span>
                    <div>
                        <h1 className="font-semibold text-xl tracking-[-0.02em] text-capsula-ink">
                            Motorizados
                        </h1>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                            {drivers.filter(d => d.isActive).length} activos
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setCreating(true)}
                    className="pos-btn h-10 px-4 inline-flex items-center gap-2"
                >
                    <Plus className="h-4 w-4" /> Nuevo
                </button>
            </div>

            {error && (
                <div className="rounded-2xl border border-capsula-line bg-[#F7E3DB] text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8] px-4 py-3 text-sm">
                    {error}
                </div>
            )}

            {drivers.length === 0 ? (
                <div className="pos-panel p-10 flex flex-col items-center text-capsula-ink-faint">
                    <Bike className="h-8 w-8 mb-2" />
                    <p className="text-sm">No hay motorizados cargados.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {drivers.map(d => (
                        <div
                            key={d.id}
                            className={`pos-card p-4 space-y-2 ${d.isActive ? '' : 'opacity-60'}`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <p className="font-semibold text-capsula-ink">{d.name}</p>
                                    <p className="text-xs text-capsula-ink-muted inline-flex items-center gap-1">
                                        <Phone className="h-3 w-3" /> {d.phone}
                                    </p>
                                    {branchName(d.branchId) && (
                                        <p className="text-xs text-capsula-ink-faint">{branchName(d.branchId)}</p>
                                    )}
                                </div>
                                <span
                                    className={`text-[10px] font-semibold uppercase tracking-[0.1em] rounded-full px-2 py-0.5 ${STATUS_TONE[d.status] ?? ''}`}
                                >
                                    {STATUS_OPTS.find(s => s.value === d.status)?.label ?? d.status}
                                </span>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <select
                                    value={d.status}
                                    onChange={e => patch(d.id, { status: e.target.value })}
                                    disabled={pending}
                                    className="pos-input flex-1 text-xs py-1.5"
                                >
                                    {STATUS_OPTS.map(s => (
                                        <option key={s.value} value={s.value}>
                                            {s.label}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    onClick={() => setEditing(d)}
                                    disabled={pending}
                                    className="pos-btn-secondary py-1.5 px-2.5 text-xs inline-flex items-center disabled:opacity-50"
                                    title="Editar"
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                    onClick={() => patch(d.id, { isActive: !d.isActive })}
                                    disabled={pending}
                                    className="pos-btn-secondary py-1.5 px-2.5 text-xs inline-flex items-center disabled:opacity-50"
                                    title={d.isActive ? 'Desactivar' : 'Activar'}
                                >
                                    <Power className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {(creating || editing) && (
                <DriverModal
                    driver={editing}
                    branches={branches}
                    pending={pending}
                    onClose={() => {
                        setCreating(false);
                        setEditing(null);
                    }}
                    onSubmit={(form) => {
                        setError(null);
                        startTransition(async () => {
                            const res = editing
                                ? await updateDeliveryDriverAction(editing.id, form)
                                : await createDeliveryDriverAction({
                                      name: form.name!,
                                      phone: form.phone!,
                                      branchId: form.branchId,
                                  });
                            if (!res.success) {
                                setError(res.message ?? 'No se pudo guardar.');
                                return;
                            }
                            setCreating(false);
                            setEditing(null);
                            refresh();
                        });
                    }}
                />
            )}
        </div>
    );
}

function DriverModal({
    driver,
    branches,
    pending,
    onClose,
    onSubmit,
}: {
    driver: DeliveryDriverRow | null;
    branches: { id: string; name: string }[];
    pending: boolean;
    onClose: () => void;
    onSubmit: (form: { name?: string; phone?: string; branchId?: string | null }) => void;
}) {
    const [name, setName] = useState(driver?.name ?? '');
    const [phone, setPhone] = useState(driver?.phone ?? '');
    const [branchId, setBranchId] = useState(driver?.branchId ?? '');

    const valid = name.trim() && phone.trim();

    return (
        <div className="fixed inset-0 z-[60] bg-capsula-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
            <div className="bg-capsula-ivory border border-capsula-line w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl">
                <div className="border-b border-capsula-line p-5 flex items-center justify-between">
                    <h3 className="font-semibold text-lg tracking-[-0.02em] text-capsula-ink">
                        {driver ? 'Editar motorizado' : 'Nuevo motorizado'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="h-8 w-8 rounded-full hover:bg-capsula-coral/10 hover:text-capsula-coral text-capsula-ink-muted flex items-center justify-center"
                    >
                        <XIcon className="h-4 w-4" />
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                            Nombre
                        </label>
                        <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="pos-input w-full mt-1"
                            placeholder="Luis Pérez"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                            Teléfono
                        </label>
                        <input
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            className="pos-input w-full mt-1"
                            placeholder="04141234567"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                            Sede (opcional)
                        </label>
                        <select
                            value={branchId}
                            onChange={e => setBranchId(e.target.value)}
                            className="pos-input w-full mt-1"
                        >
                            <option value="">Sin sede</option>
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>
                                    {b.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="border-t border-capsula-line p-4 flex gap-3">
                    <button onClick={onClose} className="pos-btn-secondary flex-1 py-3">
                        Cancelar
                    </button>
                    <button
                        onClick={() =>
                            onSubmit({ name: name.trim(), phone: phone.trim(), branchId: branchId || null })
                        }
                        disabled={pending || !valid}
                        className="pos-btn flex-[2] py-3 inline-flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <Check className="h-4 w-4" /> Guardar
                    </button>
                </div>
            </div>
        </div>
    );
}
