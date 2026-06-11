'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
    Building2,
    Plus,
    Pencil,
    Power,
    X as XIcon,
    Check,
    MapPin,
    Printer,
    Phone,
    UserCog,
    Leaf,
    Trash2,
} from 'lucide-react';
import {
    createSedeAction,
    updateSedeAction,
    addDeliveryZoneAction,
    removeDeliveryZoneAction,
    type SedeRow,
    type ManagerOption,
} from '@/app/actions/delivery-sedes.actions';
import { DeliveryNav } from '../_components/delivery-nav';

export function SedesView({
    initialSedes,
    managers,
}: {
    initialSedes: SedeRow[];
    managers: ManagerOption[];
}) {
    const router = useRouter();
    const [sedes] = useState(initialSedes);
    const [editing, setEditing] = useState<SedeRow | null>(null);
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const managerName = (id: string | null) =>
        id ? managers.find(m => m.id === id)?.name ?? null : null;

    function run(fn: () => Promise<{ success: boolean; message?: string }>, after?: () => void) {
        setError(null);
        startTransition(async () => {
            const res = await fn();
            if (!res.success) {
                setError(res.message ?? 'Error.');
                return;
            }
            after?.();
            router.refresh();
        });
    }

    return (
        <div className="p-4 sm:p-6 space-y-5">
            <DeliveryNav />
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="h-10 w-10 rounded-2xl bg-capsula-navy-deep text-capsula-cream flex items-center justify-center">
                        <Building2 className="h-5 w-5" />
                    </span>
                    <div>
                        <h1 className="font-semibold text-xl tracking-[-0.02em] text-capsula-ink">Sedes</h1>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                            {sedes.length} sedes · coordenadas, impresora, zonas
                        </p>
                    </div>
                </div>
                <button onClick={() => setCreating(true)} className="pos-btn h-10 px-4 inline-flex items-center gap-2">
                    <Plus className="h-4 w-4" /> Nueva sede
                </button>
            </div>

            {error && (
                <div className="rounded-2xl border border-capsula-line bg-[#F7E3DB] text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8] px-4 py-3 text-sm">
                    {error}
                </div>
            )}

            {sedes.length === 0 ? (
                <div className="pos-panel p-10 flex flex-col items-center text-capsula-ink-faint">
                    <Building2 className="h-8 w-8 mb-2" />
                    <p className="text-sm">No hay sedes. Crea la primera.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {sedes.map(s => (
                        <div key={s.branchId} className={`pos-card p-4 space-y-3 ${s.isActive ? '' : 'opacity-60'}`}>
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <p className="font-semibold text-capsula-ink">{s.name}</p>
                                    <p className="text-[11px] text-capsula-ink-faint uppercase tracking-[0.1em]">{s.code}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setEditing(s)}
                                        disabled={pending}
                                        className="pos-btn-secondary py-1.5 px-2.5 text-xs inline-flex items-center disabled:opacity-50"
                                        title="Editar config"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        onClick={() => run(() => updateSedeAction(s.branchId, { isActive: !s.isActive }))}
                                        disabled={pending}
                                        className="pos-btn-secondary py-1.5 px-2.5 text-xs inline-flex items-center disabled:opacity-50"
                                        title={s.isActive ? 'Desactivar' : 'Activar'}
                                    >
                                        <Power className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-capsula-ink-muted">
                                <span className="inline-flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {s.lat != null && s.lon != null ? `${s.lat.toFixed(4)}, ${s.lon.toFixed(4)}` : 'sin GPS'}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <Printer className="h-3 w-3" /> {s.printerStation || 'sin impresora'}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <Phone className="h-3 w-3" /> {s.whatsappGroup || 'sin grupo WA'}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <UserCog className="h-3 w-3" /> {managerName(s.managerUserId) || 'sin gerente'}
                                </span>
                            </div>

                            <ZonesEditor sede={s} pending={pending} run={run} />
                        </div>
                    ))}
                </div>
            )}

            {creating && (
                <div className="fixed inset-0 z-[60] bg-capsula-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                    <div className="bg-capsula-ivory border border-capsula-line w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl">
                        <div className="border-b border-capsula-line p-5 flex items-center justify-between">
                            <h3 className="font-semibold text-lg tracking-[-0.02em] text-capsula-ink">Nueva sede</h3>
                            <button
                                onClick={() => { setCreating(false); setNewName(''); }}
                                className="h-8 w-8 rounded-full hover:bg-capsula-coral/10 hover:text-capsula-coral text-capsula-ink-muted flex items-center justify-center"
                            >
                                <XIcon className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="p-5">
                            <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                                Nombre de la sede
                            </label>
                            <input
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                placeholder="El Hatillo"
                                className="pos-input w-full mt-1"
                            />
                            <p className="text-xs text-capsula-ink-faint mt-2">
                                Las coordenadas, impresora y zonas se configuran después.
                            </p>
                        </div>
                        <div className="border-t border-capsula-line p-4 flex gap-3">
                            <button onClick={() => { setCreating(false); setNewName(''); }} className="pos-btn-secondary flex-1 py-3">
                                Cancelar
                            </button>
                            <button
                                onClick={() => run(() => createSedeAction({ name: newName.trim() }), () => { setCreating(false); setNewName(''); })}
                                disabled={pending || !newName.trim()}
                                className="pos-btn flex-[2] py-3 inline-flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <Check className="h-4 w-4" /> Crear sede
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {editing && (
                <SedeConfigModal
                    sede={editing}
                    managers={managers}
                    pending={pending}
                    onClose={() => setEditing(null)}
                    onSave={(patch) => run(() => updateSedeAction(editing.branchId, patch), () => setEditing(null))}
                />
            )}
        </div>
    );
}

function ZonesEditor({
    sede,
    pending,
    run,
}: {
    sede: SedeRow;
    pending: boolean;
    run: (fn: () => Promise<{ success: boolean; message?: string }>, after?: () => void) => void;
}) {
    const [newZone, setNewZone] = useState('');
    return (
        <div className="border-t border-capsula-line pt-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted inline-flex items-center gap-1 mb-1.5">
                <Leaf className="h-3 w-3" /> Zonas que cubre
            </p>
            <div className="flex flex-wrap gap-1.5 mb-2">
                {sede.zones.length === 0 && <span className="text-xs text-capsula-ink-faint">sin zonas</span>}
                {sede.zones.map(z => (
                    <span
                        key={z.id}
                        className="inline-flex items-center gap-1 rounded-full bg-capsula-ivory-alt px-2.5 py-0.5 text-xs text-capsula-ink"
                    >
                        {z.name}
                        <button
                            onClick={() => run(() => removeDeliveryZoneAction(z.id))}
                            disabled={pending}
                            className="text-capsula-ink-faint hover:text-capsula-coral disabled:opacity-50"
                        >
                            <Trash2 className="h-3 w-3" />
                        </button>
                    </span>
                ))}
            </div>
            <div className="flex gap-2">
                <input
                    value={newZone}
                    onChange={e => setNewZone(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && newZone.trim()) {
                            run(() => addDeliveryZoneAction(sede.branchId, newZone.trim()), () => setNewZone(''));
                        }
                    }}
                    placeholder="Agregar zona (ej: La Lagunita)"
                    className="pos-input flex-1 text-xs py-1.5"
                />
                <button
                    onClick={() => newZone.trim() && run(() => addDeliveryZoneAction(sede.branchId, newZone.trim()), () => setNewZone(''))}
                    disabled={pending || !newZone.trim()}
                    className="pos-btn-secondary py-1.5 px-2.5 inline-flex items-center disabled:opacity-50"
                >
                    <Plus className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}

function SedeConfigModal({
    sede,
    managers,
    pending,
    onClose,
    onSave,
}: {
    sede: SedeRow;
    managers: ManagerOption[];
    pending: boolean;
    onClose: () => void;
    onSave: (patch: {
        name?: string;
        lat?: number | null;
        lon?: number | null;
        printerStation?: string | null;
        whatsappGroup?: string | null;
        managerUserId?: string | null;
    }) => void;
}) {
    const [name, setName] = useState(sede.name);
    const [lat, setLat] = useState(sede.lat != null ? String(sede.lat) : '');
    const [lon, setLon] = useState(sede.lon != null ? String(sede.lon) : '');
    const [printer, setPrinter] = useState(sede.printerStation ?? '');
    const [wa, setWa] = useState(sede.whatsappGroup ?? '');
    const [manager, setManager] = useState(sede.managerUserId ?? '');

    const numOrNull = (v: string): number | null => {
        const t = v.trim();
        if (!t) return null;
        const n = Number(t);
        return Number.isFinite(n) ? n : null;
    };

    return (
        <div className="fixed inset-0 z-[60] bg-capsula-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
            <div className="bg-capsula-ivory border border-capsula-line w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="border-b border-capsula-line p-5 flex items-center justify-between sticky top-0 bg-capsula-ivory">
                    <h3 className="font-semibold text-lg tracking-[-0.02em] text-capsula-ink">Configurar sede</h3>
                    <button
                        onClick={onClose}
                        className="h-8 w-8 rounded-full hover:bg-capsula-coral/10 hover:text-capsula-coral text-capsula-ink-muted flex items-center justify-center"
                    >
                        <XIcon className="h-4 w-4" />
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <Field label="Nombre">
                        <input value={name} onChange={e => setName(e.target.value)} className="pos-input w-full" />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Latitud">
                            <input value={lat} onChange={e => setLat(e.target.value)} placeholder="10.42" className="pos-input w-full" />
                        </Field>
                        <Field label="Longitud">
                            <input value={lon} onChange={e => setLon(e.target.value)} placeholder="-66.82" className="pos-input w-full" />
                        </Field>
                    </div>
                    <Field label="Impresora (station del Print Agent)">
                        <input value={printer} onChange={e => setPrinter(e.target.value)} placeholder="sede-elhatillo" className="pos-input w-full" />
                    </Field>
                    <Field label="Grupo WhatsApp de motorizados">
                        <input value={wa} onChange={e => setWa(e.target.value)} placeholder="id/nombre del grupo" className="pos-input w-full" />
                    </Field>
                    <Field label="Gerente">
                        <select value={manager} onChange={e => setManager(e.target.value)} className="pos-input w-full">
                            <option value="">Sin gerente</option>
                            {managers.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </Field>
                </div>
                <div className="border-t border-capsula-line p-4 flex gap-3">
                    <button onClick={onClose} className="pos-btn-secondary flex-1 py-3">Cancelar</button>
                    <button
                        onClick={() =>
                            onSave({
                                name: name.trim(),
                                lat: numOrNull(lat),
                                lon: numOrNull(lon),
                                printerStation: printer.trim() || null,
                                whatsappGroup: wa.trim() || null,
                                managerUserId: manager || null,
                            })
                        }
                        disabled={pending || !name.trim()}
                        className="pos-btn flex-[2] py-3 inline-flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <Check className="h-4 w-4" /> Guardar
                    </button>
                </div>
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">{label}</label>
            <div className="mt-1">{children}</div>
        </div>
    );
}
