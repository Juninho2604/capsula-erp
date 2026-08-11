'use client';

/**
 * Conteo de inventario — pantalla de entrada (§138.3).
 *
 * Antes el borrador vivía en localStorage: se perdía al cambiar de dispositivo
 * y solo cabía uno. Acá se listan los conteos EN PROGRESO para retomarlos
 * desde donde sea, y se abre uno nuevo eligiendo N almacenes.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
    ArrowLeft, Plus, ClipboardList, Loader2, EyeOff, Clock, UserCircle2, Check, X as XIcon,
} from 'lucide-react';
import {
    createCountSessionAction,
    type CountSessionListRow,
} from '@/app/actions/count-session.actions';

interface Props {
    areas: { id: string; name: string }[];
    initialSessions: CountSessionListRow[];
    canApply: boolean;
}

/** "hace 2 h", "ayer", "hace 3 d" — para ubicar rápido un conteo dormido. */
function timeAgo(d: Date | string): string {
    const then = new Date(d).getTime();
    const mins = Math.floor((Date.now() - then) / 60000);
    if (mins < 1) return 'recién';
    if (mins < 60) return `hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `hace ${hours} h`;
    const days = Math.floor(hours / 24);
    return days === 1 ? 'ayer' : `hace ${days} días`;
}

const STATUS_STYLE: Record<string, string> = {
    OPEN: 'bg-[#E6ECF4] text-[#2A4060] dark:bg-[#1A2636] dark:text-[#D1DCE9]',
    REVIEW: 'bg-[#F3EAD6] text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8]',
    APPLIED: 'bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]',
    CANCELLED: 'bg-[#F7E3DB] text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8]',
};
const STATUS_LABEL: Record<string, string> = {
    OPEN: 'Contando',
    REVIEW: 'En revisión',
    APPLIED: 'Aplicado',
    CANCELLED: 'Cancelado',
};

export default function CountSessionsView({ areas, initialSessions, canApply }: Props) {
    const router = useRouter();
    const [creating, setCreating] = useState(false);
    const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
    const [name, setName] = useState('');
    const [blindMode, setBlindMode] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const toggleArea = (id: string) => {
        setSelectedAreas(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
        );
    };

    async function handleCreate() {
        if (selectedAreas.length === 0) {
            toast.error('Seleccioná al menos un almacén');
            return;
        }
        setSubmitting(true);
        const res = await createCountSessionAction({
            areaIds: selectedAreas,
            name: name.trim() || null,
            blindMode,
        });
        setSubmitting(false);
        if (!res.success || !res.data) {
            toast.error(res.message);
            return;
        }
        toast.success(res.message);
        router.push(`/dashboard/inventario/conteo-rapido/${res.data.id}`);
    }

    const inProgress = initialSessions.filter(s => s.status === 'OPEN' || s.status === 'REVIEW');

    return (
        <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
            <div>
                <Link
                    href="/dashboard/inventario"
                    className="mb-2 inline-flex items-center gap-1 text-sm text-capsula-coral hover:underline"
                >
                    <ArrowLeft className="h-3.5 w-3.5" /> Inventario
                </Link>
                <h1 className="font-semibold text-2xl tracking-[-0.02em] text-capsula-ink sm:text-3xl">
                    Conteo de inventario
                </h1>
                <p className="mt-1 text-sm text-capsula-ink-soft">
                    Los conteos quedan guardados en el servidor: podés empezar hoy, seguir mañana
                    y retomarlos desde cualquier equipo. Queda registrado quién contó qué.
                </p>
            </div>

            {/* ── Conteos en progreso ─────────────────────────────────────── */}
            {inProgress.length > 0 && (
                <div className="space-y-2">
                    <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                        En progreso — tocá para continuar
                    </h2>
                    {inProgress.map(s => (
                        <Link
                            key={s.id}
                            href={`/dashboard/inventario/conteo-rapido/${s.id}`}
                            className="block rounded-2xl border border-capsula-line bg-capsula-ivory p-4 transition-colors hover:border-capsula-line-strong hover:bg-capsula-ivory-alt"
                        >
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-sm font-semibold text-capsula-ink">{s.code}</span>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[s.status] ?? ''}`}>
                                    {STATUS_LABEL[s.status] ?? s.status}
                                </span>
                                {s.blindMode && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-capsula-navy-soft px-2 py-0.5 text-[10px] font-semibold text-capsula-ink">
                                        <EyeOff className="h-3 w-3" /> A ciegas
                                    </span>
                                )}
                            </div>
                            {s.name && <p className="mt-1 text-sm font-medium text-capsula-ink">{s.name}</p>}
                            <p className="mt-1 text-xs text-capsula-ink-muted">
                                {s.areaNames.join(' · ')}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-capsula-ink-muted">
                                <span className="inline-flex items-center gap-1">
                                    <UserCircle2 className="h-3 w-3" /> {s.createdByName}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <Clock className="h-3 w-3" /> {timeAgo(s.lastActivityAt)}
                                </span>
                                <span className="tabular-nums">{s.entryCount} cantidades cargadas</span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {/* ── Nuevo conteo ────────────────────────────────────────────── */}
            {!creating ? (
                <button
                    onClick={() => setCreating(true)}
                    className="pos-btn inline-flex w-full items-center justify-center gap-2 py-3"
                >
                    <Plus className="h-4 w-4" /> Nuevo conteo
                </button>
            ) : (
                <div className="space-y-4 rounded-2xl border border-capsula-line bg-capsula-ivory p-5">
                    <div className="flex items-center justify-between">
                        <h2 className="font-semibold text-lg tracking-[-0.02em] text-capsula-ink">Nuevo conteo</h2>
                        <button
                            onClick={() => setCreating(false)}
                            aria-label="Cerrar"
                            className="flex h-8 w-8 items-center justify-center rounded-full text-capsula-ink-muted hover:bg-capsula-coral/10 hover:text-capsula-coral"
                        >
                            <XIcon className="h-4 w-4" />
                        </button>
                    </div>

                    <div>
                        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                            Almacenes a contar
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {areas.map(a => {
                                const on = selectedAreas.includes(a.id);
                                return (
                                    <button
                                        key={a.id}
                                        type="button"
                                        onClick={() => toggleArea(a.id)}
                                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                                            on
                                                ? 'border-capsula-navy-deep bg-capsula-navy-deep text-capsula-cream'
                                                : 'border-capsula-line bg-capsula-ivory-surface text-capsula-ink hover:border-capsula-line-strong'
                                        }`}
                                    >
                                        {on && <Check className="h-3.5 w-3.5" />}
                                        {a.name}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="mt-1.5 text-[11px] text-capsula-ink-muted">
                            Podés elegir los que necesites — cada uno tendrá su propia columna.
                        </p>
                    </div>

                    <div>
                        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                            Nombre (opcional)
                        </label>
                        <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Ej: Conteo semanal cocina"
                            className="pos-input w-full"
                        />
                    </div>

                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-capsula-line bg-capsula-ivory-surface p-3">
                        <input
                            type="checkbox"
                            checked={blindMode}
                            onChange={e => setBlindMode(e.target.checked)}
                            className="mt-0.5 h-4 w-4"
                        />
                        <span>
                            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-capsula-ink">
                                <EyeOff className="h-3.5 w-3.5" /> Conteo a ciegas
                            </span>
                            <span className="mt-0.5 block text-[11px] text-capsula-ink-muted">
                                El que cuenta no ve lo que dice el sistema — escribe lo que
                                realmente hay. Evita que se ajuste el número para no reportar
                                faltantes.
                            </span>
                        </span>
                    </label>

                    <button
                        onClick={handleCreate}
                        disabled={submitting || selectedAreas.length === 0}
                        className="pos-btn inline-flex w-full items-center justify-center gap-2 py-3 disabled:opacity-50"
                    >
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
                        {submitting ? 'Abriendo…' : 'Comenzar conteo'}
                    </button>
                </div>
            )}

            {inProgress.length === 0 && !creating && (
                <div className="rounded-xl bg-[#E6ECF4] p-4 text-xs text-[#2A4060] dark:bg-[#1A2636] dark:text-[#D1DCE9]">
                    <p className="text-[10px] font-semibold uppercase tracking-wider">Cómo funciona</p>
                    <ol className="mt-1 list-inside list-decimal space-y-1 opacity-90">
                        <li>Abrís un conteo y elegís los almacenes.</li>
                        <li>Imprimís la hoja — trae una columna por almacén, igual que la pantalla.</li>
                        <li>El personal cuenta y anota. Vos tipeás: se guarda solo, al instante.</li>
                        <li>Si no terminan hoy, cierran y mañana lo retoman desde donde sea.</li>
                        <li>Al final se revisan las diferencias y {canApply ? 'aplicás' : 'gerencia o auditoría aplica'} el ajuste.</li>
                    </ol>
                </div>
            )}
        </div>
    );
}
