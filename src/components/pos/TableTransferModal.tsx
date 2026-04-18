'use client';

import { useEffect, useState } from 'react';
import { getActiveWaitersAction, transferTableAction } from '@/app/actions/waiter.actions';

interface Waiter {
    id: string;
    firstName: string;
    lastName: string;
    isCaptain: boolean;
    hasPin: boolean;
}

interface Props {
    openTabId: string;
    fromWaiterId: string;
    tableName: string;
    onClose: () => void;
    onTransferred: () => void;
}

export function TableTransferModal({
    openTabId,
    fromWaiterId,
    tableName,
    onClose,
    onTransferred,
}: Props) {
    const [waiters, setWaiters] = useState<Waiter[]>([]);
    const [toWaiterId, setToWaiterId] = useState('');
    const [reason, setReason] = useState('');
    const [authPin, setAuthPin] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingWaiters, setIsLoadingWaiters] = useState(true);

    useEffect(() => {
        const load = async () => {
            const res = await getActiveWaitersAction();
            if (res.success) {
                setWaiters((res.data as Waiter[]).filter((w) => w.id !== fromWaiterId));
            }
            setIsLoadingWaiters(false);
        };
        load();
    }, [fromWaiterId]);

    const handleSubmit = async () => {
        if (!toWaiterId) { setError('Selecciona el mesonero destino'); return; }
        if (authPin.length < 4) { setError('PIN de autorización requerido (mínimo 4 dígitos)'); return; }
        setIsLoading(true);
        setError('');
        try {
            const res = await transferTableAction({
                openTabId,
                fromWaiterId,
                toWaiterId,
                authPin,
                reason: reason.trim() || undefined,
            });
            if (!res.success) { setError(res.message); return; }
            onTransferred();
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[65] bg-black/60 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-card rounded-3xl shadow-2xl border border-border p-6 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-2xl">
                        🔄
                    </div>
                    <div>
                        <h3 className="font-black text-base text-foreground">Transferir mesa</h3>
                        <p className="text-xs text-muted-foreground">{tableName}</p>
                    </div>
                </div>

                {isLoadingWaiters ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                        Cargando mesoneros…
                    </p>
                ) : (
                    <>
                        <div>
                            <label className="block text-xs font-bold text-muted-foreground mb-1 uppercase tracking-widest">
                                Mesonero destino
                            </label>
                            <select
                                value={toWaiterId}
                                onChange={(e) => { setToWaiterId(e.target.value); setError(''); }}
                                className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm font-bold focus:border-amber-500 focus:outline-none"
                            >
                                <option value="">Seleccionar…</option>
                                {waiters.map((w) => (
                                    <option key={w.id} value={w.id}>
                                        {w.firstName} {w.lastName}{w.isCaptain ? ' ⭐' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-muted-foreground mb-1 uppercase tracking-widest">
                                Motivo (opcional)
                            </label>
                            <input
                                type="text"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="Ej: cambio de turno…"
                                className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm focus:border-amber-500 focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-muted-foreground mb-1 uppercase tracking-widest">
                                PIN de autorización
                            </label>
                            <p className="text-[10px] text-muted-foreground mb-1.5">
                                PIN de un capitán activo o administrador (OWNER/ADMIN/OPS)
                            </p>
                            <input
                                type="password"
                                inputMode="numeric"
                                maxLength={6}
                                value={authPin}
                                onChange={(e) => {
                                    setAuthPin(e.target.value.replace(/\D/g, '').slice(0, 6));
                                    setError('');
                                }}
                                placeholder="••••"
                                className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm font-bold tracking-widest focus:border-amber-500 focus:outline-none"
                            />
                        </div>

                        {error && (
                            <p className="text-red-400 text-xs font-bold">{error}</p>
                        )}

                        <div className="flex gap-3 pt-1">
                            <button
                                onClick={onClose}
                                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-secondary transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={isLoading || !toWaiterId || authPin.length < 4}
                                className="flex-[2] py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-black text-sm transition disabled:opacity-40 active:scale-95"
                            >
                                {isLoading ? 'Transfiriendo…' : '✓ Confirmar'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
