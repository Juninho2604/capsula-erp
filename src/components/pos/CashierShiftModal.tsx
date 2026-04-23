'use client';

import { useRef, useState, useEffect } from 'react';
import { UserCircle2, ArrowRight } from 'lucide-react';

const STORAGE_KEY = 'shanklish_cashier_shift';

function getTodayStr() {
    return new Date().toISOString().slice(0, 10);
}

function loadStoredShift(): { date: string; cashierName: string } | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as { date: string; cashierName: string };
    } catch {
        return null;
    }
}

function saveShift(cashierName: string) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: getTodayStr(), cashierName }));
}

interface CashierShiftModalProps {
    onShiftOpen: (name: string) => void;
    /** Si true, fuerza mostrar el modal (ej. al hacer "Cambiar cajera") */
    forceOpen?: boolean;
}

export function CashierShiftModal({ onShiftOpen, forceOpen = false }: CashierShiftModalProps) {
    const [name, setName] = useState('');
    const [isVisible, setIsVisible] = useState(false);
    const onShiftOpenRef = useRef(onShiftOpen);
    onShiftOpenRef.current = onShiftOpen;

    useEffect(() => {
        if (forceOpen) {
            setIsVisible(true);
            return;
        }
        const stored = loadStoredShift();
        const today = getTodayStr();
        if (stored && stored.date === today && stored.cashierName) {
            onShiftOpenRef.current(stored.cashierName);
        } else {
            setIsVisible(true);
        }
    }, [forceOpen]);

    const handleOpen = () => {
        if (!name.trim()) return;
        saveShift(name.trim());
        setIsVisible(false);
        onShiftOpenRef.current(name.trim());
    };

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-capsula-navy-deep/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-capsula-line bg-capsula-ivory-surface p-6 shadow-cap-deep">
                <div className="mb-6 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-capsula-navy-soft text-capsula-ink">
                        <UserCircle2 className="h-6 w-6" />
                    </div>
                    <h2 className="font-semibold text-xl tracking-[-0.02em] text-capsula-ink">Apertura de caja</h2>
                    <p className="mt-1 text-sm text-capsula-ink-soft">
                        {forceOpen ? 'Cambio de cajera' : 'Ingresa tu nombre para iniciar el turno (una vez al día)'}
                    </p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="pos-label">Nombre de cajera</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleOpen()}
                            className="w-full rounded-xl border border-capsula-line bg-capsula-ivory px-4 py-3 text-lg font-medium text-capsula-ink transition-colors focus:border-capsula-navy-deep focus:outline-none"
                            placeholder="Ej: María Pérez"
                            autoFocus
                        />
                    </div>

                    <button
                        onClick={handleOpen}
                        disabled={!name.trim()}
                        className="pos-btn w-full !min-h-[56px] text-base disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {forceOpen ? 'Cambiar cajera' : 'Abrir turno'}
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
