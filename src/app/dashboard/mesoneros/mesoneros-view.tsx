'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
    getWaitersAction,
    createWaiterAction,
    updateWaiterAction,
    toggleWaiterActiveAction,
    deleteWaiterAction,
} from '@/app/actions/waiter.actions';

interface Waiter {
    id: string;
    firstName: string;
    lastName: string;
    isActive: boolean;
    hasPin: boolean;
    isCaptain: boolean;
    createdAt: Date | string;
}

const PIN_MANAGER_ROLES = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'];

export function MesonerosView({ currentUserRole }: { currentUserRole: string }) {
    const canManagePin = PIN_MANAGER_ROLES.includes(currentUserRole);
    const [waiters, setWaiters] = useState<Waiter[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [pin, setPin] = useState('');
    const [clearPin, setClearPin] = useState(false);
    const [isCaptain, setIsCaptain] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const load = async () => {
        setIsLoading(true);
        const res = await getWaitersAction();
        if (res.success) setWaiters(res.data as Waiter[]);
        setIsLoading(false);
    };

    useEffect(() => { load(); }, []);

    const openCreate = () => {
        setEditingId(null);
        setFirstName('');
        setLastName('');
        setPin('');
        setClearPin(false);
        setIsCaptain(false);
        setShowForm(true);
    };

    const openEdit = (w: Waiter) => {
        setEditingId(w.id);
        setFirstName(w.firstName);
        setLastName(w.lastName);
        setPin('');
        setClearPin(false);
        setIsCaptain(w.isCaptain);
        setShowForm(true);
    };

    const handleSave = async () => {
        if (!firstName.trim() || !lastName.trim()) {
            toast.error('Nombre y apellido son obligatorios');
            return;
        }
        const pinTrimmed = pin.trim();
        if (canManagePin && pinTrimmed && !/^\d{4,6}$/.test(pinTrimmed)) {
            toast.error('El PIN debe ser numérico de 4 a 6 dígitos');
            return;
        }
        setIsSaving(true);
        try {
            let res;
            if (editingId) {
                // pin: undefined → no tocar · '' → borrar (si clearPin) · string → hashear nuevo
                const pinPayload = !canManagePin
                    ? undefined
                    : clearPin
                        ? ''
                        : pinTrimmed
                            ? pinTrimmed
                            : undefined;
                res = await updateWaiterAction(editingId, {
                    firstName,
                    lastName,
                    isCaptain,
                    ...(pinPayload !== undefined ? { pin: pinPayload } : {}),
                });
            } else {
                res = await createWaiterAction({
                    firstName,
                    lastName,
                    isCaptain,
                    ...(canManagePin && pinTrimmed ? { pin: pinTrimmed } : {}),
                });
            }
            if (res.success) {
                toast.success(res.message);
                setShowForm(false);
                load();
            } else {
                toast.error(res.message);
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggle = async (w: Waiter) => {
        const res = await toggleWaiterActiveAction(w.id, !w.isActive);
        if (res.success) {
            toast.success(res.message);
            setWaiters(prev => prev.map(x => x.id === w.id ? { ...x, isActive: !w.isActive } : x));
        } else {
            toast.error(res.message);
        }
    };

    const handleDelete = async (w: Waiter) => {
        if (!confirm(`¿Eliminar a ${w.firstName} ${w.lastName}? Esta acción no se puede deshacer.`)) return;
        const res = await deleteWaiterAction(w.id);
        if (res.success) {
            toast.success(res.message);
            setWaiters(prev => prev.filter(x => x.id !== w.id));
        } else {
            toast.error(res.message);
        }
    };

    const active = waiters.filter(w => w.isActive);
    const inactive = waiters.filter(w => !w.isActive);

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-capsula-navy-deep">🧑‍🍽️ Mesoneros</h1>
                    <p className="text-sm text-capsula-ink-soft mt-1">
                        {active.length} activo{active.length !== 1 ? 's' : ''} · {inactive.length} inactivo{inactive.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <button
                    onClick={openCreate}
                    className="inline-flex items-center gap-2 rounded-xl bg-capsula-navy-deep hover:bg-capsula-navy-ink px-4 py-2.5 text-sm font-medium text-capsula-ivory-surface shadow-cap-soft transition active:scale-95"
                >
                    + Agregar mesonero
                </button>
            </div>

            {/* Waiter list */}
            {isLoading ? (
                <div className="text-center py-12 text-capsula-ink-muted">Cargando…</div>
            ) : waiters.length === 0 ? (
                <div className="text-center py-16 rounded-2xl border-2 border-dashed border-capsula-line">
                    <div className="text-5xl mb-3">🧑‍🍽️</div>
                    <p className="text-capsula-ink-soft font-medium">No hay mesoneros registrados</p>
                    <p className="text-capsula-ink-muted text-sm mt-1">Agrega los mesoneros de tu restaurante</p>
                    <button onClick={openCreate} className="mt-4 rounded-xl bg-capsula-navy-deep px-5 py-2.5 text-sm font-medium text-capsula-ivory-surface hover:bg-capsula-navy-ink transition">
                        + Agregar primer mesonero
                    </button>
                </div>
            ) : (
                <div className="space-y-2">
                    {/* Active */}
                    {active.map(w => (
                        <div key={w.id} className="flex items-center gap-4 rounded-xl border border-capsula-line bg-capsula-ivory-surface px-4 py-3 shadow-cap-soft">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F3EAD6]/60 text-xl">
                                🧑‍🍽️
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-capsula-navy-deep">{w.firstName} {w.lastName}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="inline-flex items-center rounded-full bg-[#E5EDE7]/60 px-2 py-0.5 text-xs font-medium text-[#2F6B4E] border border-[#2F6B4E]/20">
                                        Activo
                                    </span>
                                    {w.hasPin ? (
                                        <span className="inline-flex items-center rounded-full bg-[#F3EAD6]/60 px-2 py-0.5 text-xs font-medium text-[#946A1C] border border-[#946A1C]/20">
                                            🔒 PIN
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center rounded-full bg-capsula-ivory-alt px-2 py-0.5 text-xs font-medium text-capsula-ink-soft border border-capsula-line">
                                            Sin PIN
                                        </span>
                                    )}
                                    {w.isCaptain && (
                                        <span className="inline-flex items-center rounded-full bg-capsula-navy/10 px-2 py-0.5 text-xs font-medium text-capsula-navy border border-capsula-navy/20">
                                            ⭐ Capitán
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={() => openEdit(w)}
                                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[#946A1C] hover:bg-[#F3EAD6]/40 transition"
                                >
                                    Editar
                                </button>
                                <button
                                    onClick={() => handleToggle(w)}
                                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-capsula-ink-soft hover:bg-capsula-ivory-alt transition"
                                >
                                    Desactivar
                                </button>
                                <button
                                    onClick={() => handleDelete(w)}
                                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-capsula-coral hover:bg-capsula-coral/10 transition"
                                >
                                    Eliminar
                                </button>
                            </div>
                        </div>
                    ))}

                    {/* Inactive section */}
                    {inactive.length > 0 && (
                        <div className="mt-4">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-capsula-ink-muted">Inactivos</p>
                            {inactive.map(w => (
                                <div key={w.id} className="flex items-center gap-4 rounded-xl border border-capsula-line bg-capsula-ivory-alt/40 px-4 py-3 opacity-60">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-capsula-ivory-alt text-xl">
                                        🧑‍🍽️
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-capsula-ink-soft">{w.firstName} {w.lastName}</p>
                                        <span className="inline-flex items-center rounded-full bg-capsula-ivory-alt px-2 py-0.5 text-xs font-medium text-capsula-ink-soft border border-capsula-line">
                                            Inactivo
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={() => handleToggle(w)}
                                            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[#2F6B4E] hover:bg-[#E5EDE7]/40 transition"
                                        >
                                            Activar
                                        </button>
                                        <button
                                            onClick={() => handleDelete(w)}
                                            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-capsula-coral hover:bg-capsula-coral/10 transition"
                                        >
                                            Eliminar
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Form Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-sm rounded-t-3xl sm:rounded-2xl bg-capsula-ivory-surface shadow-2xl">
                        <div className="flex items-center justify-between border-b border-capsula-line px-5 py-4 ">
                            <h3 className="font-bold text-capsula-navy-deep">
                                {editingId ? 'Editar mesonero' : 'Nuevo mesonero'}
                            </h3>
                            <button onClick={() => setShowForm(false)} className="text-capsula-ink-muted hover:text-capsula-ink-soft text-xl">×</button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-capsula-ink-soft mb-1">Nombre <span className="text-capsula-coral">*</span></label>
                                <input
                                    type="text"
                                    value={firstName}
                                    onChange={e => setFirstName(e.target.value)}
                                    placeholder="Ej: Carlos"
                                    autoFocus
                                    className="w-full rounded-xl border border-capsula-line bg-capsula-ivory-surface px-3 py-2.5 text-capsula-ink text-sm focus:border-capsula-navy-deep focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-capsula-ink-soft mb-1">Apellido <span className="text-capsula-coral">*</span></label>
                                <input
                                    type="text"
                                    value={lastName}
                                    onChange={e => setLastName(e.target.value)}
                                    placeholder="Ej: López"
                                    className="w-full rounded-xl border border-capsula-line bg-capsula-ivory-surface px-3 py-2.5 text-capsula-ink text-sm focus:border-capsula-navy-deep focus:outline-none"
                                />
                            </div>
                            {/* Toggle Capitán — siempre visible para roles con acceso */}
                            <label className="flex items-center justify-between rounded-xl border border-capsula-line px-3 py-2.5 cursor-pointer hover:bg-capsula-ivory-alt/40">
                                <div>
                                    <span className="text-xs font-bold text-capsula-ink">⭐ Capitán</span>
                                    <p className="text-[11px] text-capsula-ink-muted">Puede dividir cuentas y transferir mesas</p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={isCaptain}
                                    onChange={e => setIsCaptain(e.target.checked)}
                                    className="h-4 w-4 rounded accent-sky-500"
                                />
                            </label>

                            {canManagePin && (
                            <div>
                                <label className="flex items-center justify-between text-xs font-bold text-capsula-ink-soft mb-1">
                                    <span>
                                        PIN <span className="text-capsula-ink-muted font-normal">(4-6 dígitos · opcional)</span>
                                    </span>
                                    {editingId && (
                                        <label className="flex items-center gap-1 text-[11px] font-medium text-capsula-coral cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={clearPin}
                                                onChange={e => { setClearPin(e.target.checked); if (e.target.checked) setPin(''); }}
                                                className="h-3 w-3"
                                            />
                                            Borrar PIN
                                        </label>
                                    )}
                                </label>
                                <input
                                    type="password"
                                    inputMode="numeric"
                                    autoComplete="new-password"
                                    maxLength={6}
                                    value={pin}
                                    onChange={e => {
                                        const onlyDigits = e.target.value.replace(/\D/g, '');
                                        setPin(onlyDigits);
                                        if (onlyDigits) setClearPin(false);
                                    }}
                                    disabled={clearPin}
                                    placeholder={editingId ? '(dejar vacío para no cambiar)' : 'Ej: 1234'}
                                    onKeyDown={e => e.key === 'Enter' && handleSave()}
                                    className="w-full rounded-xl border border-capsula-line bg-capsula-ivory-surface px-3 py-2.5 text-capsula-ink text-sm tracking-[0.4em] focus:border-capsula-navy-deep focus:outline-none disabled:opacity-50 disabled:bg-capsula-ivory-alt"
                                />
                                <p className="mt-1 text-[11px] text-capsula-ink-muted">
                                    El PIN permite al mesonero identificarse en el POS Mesero.
                                </p>
                            </div>
                            )}
                        </div>
                        <div className="flex gap-3 border-t border-capsula-line px-5 py-4 ">
                            <button
                                onClick={() => setShowForm(false)}
                                className="flex-1 rounded-xl border border-capsula-line py-2.5 text-sm font-semibold text-capsula-ink-soft hover:bg-capsula-ivory-alt"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving || !firstName.trim() || !lastName.trim()}
                                className="flex-[2] rounded-xl bg-capsula-navy-deep py-2.5 text-sm font-medium text-capsula-ivory-surface hover:bg-capsula-navy-ink disabled:opacity-50 transition active:scale-95"
                            >
                                {isSaving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear mesonero'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
