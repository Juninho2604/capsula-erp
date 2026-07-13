'use client';

import { useState } from 'react';
import { X as XIcon, Check, Loader2, MessageSquare } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ModalPortal } from '@/components/ui/modal-portal';
import { submitSatisfactionSurveyAction } from '@/app/actions/satisfaction.actions';
import { SATISFACTION_RATINGS, SATISFACTION_META, type SatisfactionRating } from '@/lib/sales/satisfaction';

interface Props {
    tabCode?: string | null;
    tableName?: string | null;
    waiterName?: string | null;
    openTabId?: string | null;
    /** Se invoca al guardar o al omitir — el POS cierra la tarjeta. */
    onDone: () => void;
}

/**
 * §113 — Tarjeta de encuesta de satisfacción (tablet).
 *
 * Diseño para ser rápida: un toque en la calificación general la selecciona
 * y ya se puede guardar. Comentario opcional (colapsado — solo si la
 * respuesta no fue la esperada). SIEMPRE omitible ("Omitir") — nunca bloquea
 * la operación. Los emojis aquí son intencionales (contenido de la encuesta,
 * no chrome — excepción permitida por CLAUDE.md §2).
 */
export function SatisfactionSurveyCard({ tabCode, tableName, waiterName, openTabId, onDone }: Props) {
    const [rating, setRating] = useState<SatisfactionRating | null>(null);
    const [showComment, setShowComment] = useState(false);
    const [comment, setComment] = useState('');
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        if (!rating) return;
        setSaving(true);
        const res = await submitSatisfactionSurveyAction({
            rating,
            comment: comment.trim() || null,
            openTabId: openTabId ?? null,
            tabCode: tabCode ?? null,
            tableName: tableName ?? null,
            waiterName: waiterName ?? null,
        });
        setSaving(false);
        if (res.success) {
            toast.success('¡Gracias! Calificación registrada');
            onDone();
        } else {
            toast.error(res.error ?? 'Error al guardar');
        }
    };

    return (
        <ModalPortal>
            <div className="fixed inset-0 z-[65] bg-capsula-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                <div className="bg-capsula-ivory border border-capsula-line w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl">
                    <div className="border-b border-capsula-line p-5 flex items-center justify-between">
                        <div>
                            <h3 className="font-semibold text-lg tracking-[-0.02em] text-capsula-ink">¿Cómo estuvo la experiencia?</h3>
                            <p className="text-xs text-capsula-ink-muted">
                                {tableName ? `Mesa ${tableName}` : tabCode || 'Encuesta de satisfacción'}
                                {waiterName ? ` · ${waiterName}` : ''}
                            </p>
                        </div>
                        <button
                            onClick={onDone}
                            className="h-8 w-8 rounded-full hover:bg-capsula-coral/10 hover:text-capsula-coral text-capsula-ink-muted flex items-center justify-center"
                            aria-label="Omitir"
                        >
                            <XIcon className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="p-5 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            {SATISFACTION_RATINGS.map(r => {
                                const meta = SATISFACTION_META[r];
                                const active = rating === r;
                                return (
                                    <button
                                        key={r}
                                        onClick={() => setRating(r)}
                                        className={`flex flex-col items-center gap-1 rounded-2xl border-2 px-3 py-4 transition-colors ${
                                            active
                                                ? 'border-capsula-navy-deep bg-capsula-navy-soft'
                                                : 'border-capsula-line bg-capsula-ivory-surface hover:border-capsula-navy-deep/40'
                                        }`}
                                    >
                                        <span className="text-3xl leading-none">{meta.emoji}</span>
                                        <span className={`text-sm font-semibold ${active ? 'text-capsula-ink' : 'text-capsula-ink-soft'}`}>{meta.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {!showComment ? (
                            <button
                                onClick={() => setShowComment(true)}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-capsula-ink-muted hover:text-capsula-ink"
                            >
                                <MessageSquare className="h-3.5 w-3.5" /> Agregar comentario (opcional)
                            </button>
                        ) : (
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Comentario</label>
                                <textarea
                                    value={comment}
                                    onChange={e => setComment(e.target.value)}
                                    rows={2}
                                    maxLength={500}
                                    autoFocus
                                    placeholder="Si algo no fue lo esperado, cuéntanos…"
                                    className="pos-input w-full resize-none"
                                />
                            </div>
                        )}
                    </div>

                    <div className="border-t border-capsula-line p-4 flex gap-3">
                        <button onClick={onDone} className="pos-btn-secondary flex-1 py-3">Omitir</button>
                        <button
                            onClick={submit}
                            disabled={!rating || saving}
                            className="pos-btn flex-[2] py-3 inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Guardar
                        </button>
                    </div>
                </div>
            </div>
        </ModalPortal>
    );
}
