'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Plus, UserCircle2, Lock, Star, X } from 'lucide-react';
import {
    getWaitersAction,
    createWaiterAction,
    updateWaiterAction,
    toggleWaiterActiveAction,
    deleteWaiterAction,
} from '@/app/actions/waiter.actions';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/Badge';

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
        <div className="max-w-3xl mx-auto">
            <PageHeader
                kicker="Operaciones"
                title="Mesoneros"
                description={`${active.length} activo${active.length !== 1 ? 's' : ''} · ${inactive.length} inactivo${inactive.length !== 1 ? 's' : ''}`}
                actions={
                    <Button size="sm" onClick={openCreate}>
                        <Plus className="h-4 w-4" />
                        Agregar mesonero
                    </Button>
                }
            />

            {/* Waiter list */}
            {isLoading ? (
                <div className="py-12 text-center text-sm text-capsula-ink-muted">Cargando…</div>
            ) : waiters.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-capsula-line-strong bg-capsula-ivory-surface py-16 text-center">
                    <UserCircle2 className="mx-auto mb-3 h-12 w-12 text-capsula-ink-faint" />
                    <p className="font-medium text-capsula-ink-soft">No hay mesoneros registrados</p>
                    <p className="mt-1 text-sm text-capsula-ink-muted">Agrega los mesoneros de tu restaurante</p>
                    <div className="mt-4 flex justify-center">
                        <Button size="sm" onClick={openCreate}>
                            <Plus className="h-4 w-4" />
                            Agregar primer mesonero
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="space-y-2">
                    {active.map(w => (
                        <div
                            key={w.id}
                            className="flex items-center gap-4 rounded-2xl border border-capsula-line bg-capsula-ivory-surface px-4 py-3 shadow-cap-soft"
                        >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-capsula-navy-soft text-capsula-ink">
                                <UserCircle2 className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="font-medium text-capsula-ink">{w.firstName} {w.lastName}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                    <Badge variant="ok">Activo</Badge>
                                    {w.hasPin ? (
                                        <Badge variant="warn">
                                            <Lock className="h-3 w-3" />
                                            PIN
                                        </Badge>
                                    ) : (
                                        <Badge variant="neutral">Sin PIN</Badge>
                                    )}
                                    {w.isCaptain && (
                                        <Badge variant="info">
                                            <Star className="h-3 w-3" />
                                            Capitán
                                        </Badge>
                                    )}
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                                <button
                                    onClick={() => openEdit(w)}
                                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-capsula-ink transition-colors hover:bg-capsula-navy-soft"
                                >
                                    Editar
                                </button>
                                <button
                                    onClick={() => handleToggle(w)}
                                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-capsula-ink-muted transition-colors hover:bg-capsula-ivory-alt"
                                >
                                    Desactivar
                                </button>
                                <button
                                    onClick={() => handleDelete(w)}
                                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-capsula-coral transition-colors hover:bg-capsula-coral-subtle"
                                >
                                    Eliminar
                                </button>
                            </div>
                        </div>
                    ))}

                    {inactive.length > 0 && (
                        <div className="mt-4">
                            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">
                                Inactivos
                            </p>
                            {inactive.map(w => (
                                <div
                                    key={w.id}
                                    className="flex items-center gap-4 rounded-2xl border border-capsula-line bg-capsula-ivory-alt px-4 py-3 opacity-70"
                                >
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-capsula-ivory text-capsula-ink-muted">
                                        <UserCircle2 className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium text-capsula-ink-soft">{w.firstName} {w.lastName}</p>
                                        <div className="mt-1">
                                            <Badge variant="neutral">Inactivo</Badge>
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1">
                                        <button
                                            onClick={() => handleToggle(w)}
                                            className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#2F6B4E] transition-colors hover:bg-[#E5EDE7]/60"
                                        >
                                            Activar
                                        </button>
                                        <button
                                            onClick={() => handleDelete(w)}
                                            className="rounded-lg px-3 py-1.5 text-xs font-medium text-capsula-coral transition-colors hover:bg-capsula-coral-subtle"
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
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-capsula-navy-deep/60 p-4 backdrop-blur-sm sm:items-center">
                    <div className="w-full max-w-sm overflow-hidden rounded-t-3xl border border-capsula-line bg-capsula-ivory-surface shadow-cap-deep sm:rounded-2xl">
                        <div className="flex items-center justify-between border-b border-capsula-line px-5 py-4">
                            <h3 className="font-medium text-capsula-ink">{editingId ? 'Editar mesonero' : 'Nuevo mesonero'}</h3>
                            <button
                                onClick={() => setShowForm(false)}
                                className="rounded-full p-1 text-capsula-ink-muted transition-colors hover:bg-capsula-ivory-alt hover:text-capsula-ink"
                                aria-label="Cerrar"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="space-y-4 p-5">
                            <div>
                                <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.1em] text-capsula-ink-muted">
                                    Nombre <span className="text-capsula-coral">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={firstName}
                                    onChange={e => setFirstName(e.target.value)}
                                    placeholder="Ej: Carlos"
                                    autoFocus
                                    className="w-full rounded-xl border border-capsula-line bg-capsula-ivory px-3 py-2.5 text-sm text-capsula-ink focus:border-capsula-navy-deep focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.1em] text-capsula-ink-muted">
                                    Apellido <span className="text-capsula-coral">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={lastName}
                                    onChange={e => setLastName(e.target.value)}
                                    placeholder="Ej: López"
                                    className="w-full rounded-xl border border-capsula-line bg-capsula-ivory px-3 py-2.5 text-sm text-capsula-ink focus:border-capsula-navy-deep focus:outline-none"
                                />
                            </div>

                            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-capsula-line px-3 py-2.5 transition-colors hover:bg-capsula-ivory-alt">
                                <div>
                                    <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-capsula-ink-soft">
                                        <Star className="h-3.5 w-3.5" /> Capitán
                                    </span>
                                    <p className="mt-0.5 text-[11px] text-capsula-ink-muted">
                                        Puede dividir cuentas y transferir mesas
                                    </p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={isCaptain}
                                    onChange={e => setIsCaptain(e.target.checked)}
                                    className="h-4 w-4 rounded accent-capsula-navy-deep"
                                />
                            </label>

                            {canManagePin && (
                                <div>
                                    <label className="mb-1 flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.1em] text-capsula-ink-muted">
                                        <span>
                                            PIN <span className="font-normal normal-case text-capsula-ink-faint">(4-6 dígitos · opcional)</span>
                                        </span>
                                        {editingId && (
                                            <label className="flex cursor-pointer items-center gap-1 text-[11px] font-medium normal-case tracking-normal text-capsula-coral">
                                                <input
                                                    type="checkbox"
                                                    checked={clearPin}
                                                    onChange={e => { setClearPin(e.target.checked); if (e.target.checked) setPin(''); }}
                                                    className="h-3 w-3 accent-capsula-coral"
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
                                        className="w-full rounded-xl border border-capsula-line bg-capsula-ivory px-3 py-2.5 text-sm tracking-[0.4em] text-capsula-ink focus:border-capsula-navy-deep focus:outline-none disabled:bg-capsula-ivory-alt disabled:opacity-50"
                                    />
                                    <p className="mt-1 text-[11px] text-capsula-ink-muted">
                                        El PIN permite al mesonero identificarse en el POS Mesero.
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-3 border-t border-capsula-line px-5 py-4">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowForm(false)}
                                className="flex-1"
                            >
                                Cancelar
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleSave}
                                disabled={isSaving || !firstName.trim() || !lastName.trim()}
                                isLoading={isSaving}
                                className="flex-[2]"
                            >
                                {isSaving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear mesonero'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
