'use client';

import { useState } from 'react';
import { validateWaiterPinAction } from '@/app/actions/waiter.actions';

export interface ActiveWaiter {
    id: string;
    firstName: string;
    lastName: string;
    isCaptain: boolean;
}

interface Props {
    onIdentified: (waiter: ActiveWaiter) => void;
}

export function WaiterIdentification({ onIdentified }: Props) {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const pressKey = (k: string) => {
        if (isLoading) return;
        if (k === '⌫') {
            setPin(p => p.slice(0, -1));
            setError('');
        } else if (pin.length < 6) {
            setPin(p => p + k);
            setError('');
        }
    };

    const handleSubmit = async () => {
        if (pin.length < 4 || isLoading) return;
        setIsLoading(true);
        setError('');
        try {
            const res = await validateWaiterPinAction(pin);
            if (!res.success || !res.data) {
                setError(res.message || 'PIN incorrecto');
                setPin('');
                return;
            }
            const d = res.data as { waiterId: string; firstName: string; lastName: string; isCaptain: boolean };
            onIdentified({ id: d.waiterId, firstName: d.firstName, lastName: d.lastName, isCaptain: d.isCaptain });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
            <div className="w-full max-w-[300px] space-y-6">
                {/* Header */}
                <div className="text-center space-y-2">
                    <div className="text-6xl">🧑‍🍳</div>
                    <h1 className="text-2xl font-black text-foreground">POS Mesero</h1>
                    <p className="text-sm text-muted-foreground">
                        Ingresa tu PIN para identificarte
                    </p>
                </div>

                {/* PIN dots */}
                <div className="flex justify-center gap-3">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                        <div
                            key={i}
                            className={`h-4 w-4 rounded-full border-2 transition-all duration-150 ${
                                i < pin.length
                                    ? 'bg-emerald-400 border-emerald-400 scale-110'
                                    : 'border-border'
                            }`}
                        />
                    ))}
                </div>

                {/* Error */}
                {error && (
                    <p className="text-red-400 text-sm font-bold text-center">{error}</p>
                )}

                {/* Keypad */}
                <div className="grid grid-cols-3 gap-3">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                        <button
                            key={n}
                            onClick={() => pressKey(String(n))}
                            disabled={isLoading}
                            className="h-16 rounded-2xl bg-card border border-border text-xl font-black text-foreground hover:bg-secondary hover:border-emerald-500/50 active:scale-95 transition-all disabled:opacity-40"
                        >
                            {n}
                        </button>
                    ))}
                    {/* spacer, 0, backspace */}
                    <div />
                    <button
                        onClick={() => pressKey('0')}
                        disabled={isLoading}
                        className="h-16 rounded-2xl bg-card border border-border text-xl font-black text-foreground hover:bg-secondary hover:border-emerald-500/50 active:scale-95 transition-all disabled:opacity-40"
                    >
                        0
                    </button>
                    <button
                        onClick={() => pressKey('⌫')}
                        disabled={isLoading}
                        className="h-16 rounded-2xl bg-card border border-border text-xl text-muted-foreground hover:bg-secondary hover:border-red-500/50 hover:text-red-400 active:scale-95 transition-all disabled:opacity-40"
                    >
                        ⌫
                    </button>
                </div>

                {/* Confirm */}
                <button
                    onClick={handleSubmit}
                    disabled={pin.length < 4 || isLoading}
                    className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-600/20"
                >
                    {isLoading ? 'Verificando…' : '✓ Entrar'}
                </button>
            </div>
        </div>
    );
}
