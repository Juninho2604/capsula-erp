'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquareText, Plus, Trash2, Power, Route } from 'lucide-react';
import {
    createManagerNoteAction,
    updateManagerNoteAction,
    deleteManagerNoteAction,
    createRoutingRuleAction,
    updateRoutingRuleAction,
    deleteRoutingRuleAction,
    type NoteRow,
    type RuleRow,
} from '@/app/actions/delivery-config.actions';
import { DeliveryNav } from '../_components/delivery-nav';

type Branch = { id: string; name: string };

export function InstruccionesView({
    initialNotes,
    initialRules,
    branches,
}: {
    initialNotes: NoteRow[];
    initialRules: RuleRow[];
    branches: Branch[];
}) {
    const router = useRouter();
    const [notes, setNotes] = useState(initialNotes);
    const [rules, setRules] = useState(initialRules);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const branchName = (id: string | null) =>
        id ? branches.find(b => b.id === id)?.name ?? id : 'Todas las sedes';

    function run(fn: () => Promise<{ success: boolean; message?: string }>) {
        setError(null);
        startTransition(async () => {
            const res = await fn();
            if (!res.success) {
                setError(res.message ?? 'Error.');
                return;
            }
            router.refresh();
        });
    }

    // Form notas
    const [noteText, setNoteText] = useState('');
    const [noteBranch, setNoteBranch] = useState('');
    const [noteExpiry, setNoteExpiry] = useState('');

    function addNote() {
        const text = noteText.trim();
        if (!text) return;
        run(async () => {
            const res = await createManagerNoteAction({
                text,
                branchId: noteBranch || null,
                expiresAt: noteExpiry || null,
            });
            if (res.success) {
                setNoteText('');
                setNoteExpiry('');
            }
            return res;
        });
    }

    // Form reglas
    const [ruleProduct, setRuleProduct] = useState('');
    const [ruleBranch, setRuleBranch] = useState(branches[0]?.id ?? '');
    const [rulePriority, setRulePriority] = useState('0');

    function addRule() {
        const matchProduct = ruleProduct.trim();
        if (!matchProduct || !ruleBranch) return;
        run(async () => {
            const res = await createRoutingRuleAction({
                matchProduct,
                branchId: ruleBranch,
                priority: parseInt(rulePriority, 10) || 0,
            });
            if (res.success) setRuleProduct('');
            return res;
        });
    }

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <DeliveryNav />
            <div className="flex items-center gap-3">
                <span className="h-10 w-10 rounded-2xl bg-capsula-navy-deep text-capsula-cream flex items-center justify-center">
                    <MessageSquareText className="h-5 w-5" />
                </span>
                <div>
                    <h1 className="font-semibold text-xl tracking-[-0.02em] text-capsula-ink">
                        Instrucciones del gerente
                    </h1>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                        Notas para el bot + reglas de ruteo producto → sede
                    </p>
                </div>
            </div>

            {error && (
                <div className="rounded-2xl border border-capsula-line bg-[#F7E3DB] text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8] px-4 py-3 text-sm">
                    {error}
                </div>
            )}

            {/* ─── Notas ─────────────────────────────────────────── */}
            <section className="space-y-3">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                    Notas del bot (orientativas, nunca anulan las reglas de oro)
                </h2>
                <div className="pos-panel p-4 space-y-2">
                    <textarea
                        value={noteText}
                        onChange={e => setNoteText(e.target.value)}
                        placeholder="Ej: Hoy +15 min por lluvia en El Hatillo"
                        rows={2}
                        className="pos-input w-full resize-none"
                    />
                    <div className="flex flex-col sm:flex-row gap-2">
                        <select value={noteBranch} onChange={e => setNoteBranch(e.target.value)} className="pos-input sm:w-48">
                            <option value="">Todas las sedes</option>
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                        <input
                            type="date"
                            value={noteExpiry}
                            onChange={e => setNoteExpiry(e.target.value)}
                            className="pos-input sm:w-44"
                            title="Vence (opcional)"
                        />
                        <button
                            onClick={addNote}
                            disabled={pending || !noteText.trim()}
                            className="pos-btn px-4 py-2 inline-flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <Plus className="h-4 w-4" /> Agregar nota
                        </button>
                    </div>
                </div>

                {notes.length > 0 && (
                    <div className="space-y-2">
                        {notes.map(n => (
                            <div key={n.id} className={`pos-card p-3 ${n.isActive ? '' : 'opacity-60'}`}>
                                <p className="text-sm text-capsula-ink">{n.text}</p>
                                <div className="flex items-center justify-between gap-2 mt-2">
                                    <p className="text-xs text-capsula-ink-muted">
                                        {branchName(n.branchId)}
                                        {n.expiresAt ? ` · vence ${n.expiresAt.slice(0, 10)}` : ''}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                setNotes(prev => prev.map(x => x.id === n.id ? { ...x, isActive: !x.isActive } : x));
                                                run(() => updateManagerNoteAction(n.id, { isActive: !n.isActive }));
                                            }}
                                            disabled={pending}
                                            className="pos-btn-secondary py-1 px-2.5 text-xs inline-flex items-center gap-1 disabled:opacity-50"
                                        >
                                            <Power className="h-3.5 w-3.5" /> {n.isActive ? 'Activa' : 'Inactiva'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setNotes(prev => prev.filter(x => x.id !== n.id));
                                                run(() => deleteManagerNoteAction(n.id));
                                            }}
                                            disabled={pending}
                                            className="pos-btn-secondary py-1 px-2.5 inline-flex items-center disabled:opacity-50"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* ─── Reglas de ruteo ───────────────────────────────── */}
            <section className="space-y-3">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted inline-flex items-center gap-1.5">
                    <Route className="h-3.5 w-3.5" /> Reglas de ruteo (determinístico, se aplica al crear la orden)
                </h2>
                <div className="pos-panel p-4 flex flex-col sm:flex-row gap-2">
                    <input
                        value={ruleProduct}
                        onChange={e => setRuleProduct(e.target.value)}
                        placeholder="Si incluye… (ej: Sushi especial)"
                        className="pos-input flex-1"
                    />
                    <select value={ruleBranch} onChange={e => setRuleBranch(e.target.value)} className="pos-input sm:w-44">
                        {branches.length === 0 && <option value="">Sin sedes</option>}
                        {branches.map(b => (
                            <option key={b.id} value={b.id}>→ {b.name}</option>
                        ))}
                    </select>
                    <input
                        type="number"
                        value={rulePriority}
                        onChange={e => setRulePriority(e.target.value)}
                        className="pos-input sm:w-20"
                        title="Prioridad (mayor gana)"
                    />
                    <button
                        onClick={addRule}
                        disabled={pending || !ruleProduct.trim() || !ruleBranch}
                        className="pos-btn px-4 py-2 inline-flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <Plus className="h-4 w-4" /> Agregar
                    </button>
                </div>

                {rules.length > 0 && (
                    <div className="space-y-2">
                        {rules.map(r => (
                            <div key={r.id} className={`pos-card p-3 flex items-center justify-between gap-3 ${r.isActive ? '' : 'opacity-60'}`}>
                                <p className="text-sm text-capsula-ink min-w-0 truncate">
                                    <span className="font-medium">{r.matchProduct}</span>
                                    <span className="text-capsula-ink-muted"> → {branchName(r.branchId)}</span>
                                    <span className="text-capsula-ink-faint text-xs"> · prioridad {r.priority}</span>
                                </p>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={() => {
                                            setRules(prev => prev.map(x => x.id === r.id ? { ...x, isActive: !x.isActive } : x));
                                            run(() => updateRoutingRuleAction(r.id, { isActive: !r.isActive }));
                                        }}
                                        disabled={pending}
                                        className="pos-btn-secondary py-1 px-2.5 text-xs inline-flex items-center gap-1 disabled:opacity-50"
                                    >
                                        <Power className="h-3.5 w-3.5" /> {r.isActive ? 'Activa' : 'Inactiva'}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setRules(prev => prev.filter(x => x.id !== r.id));
                                            run(() => deleteRoutingRuleAction(r.id));
                                        }}
                                        disabled={pending}
                                        className="pos-btn-secondary py-1 px-2.5 inline-flex items-center disabled:opacity-50"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
