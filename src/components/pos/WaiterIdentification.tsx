"use client";

import { useEffect, useState } from "react";
import { ChefHat, AlertTriangle, Delete, ArrowRight } from "lucide-react";
import {
    getActiveWaitersAction,
    validateWaiterPinAction,
} from "@/app/actions/waiter.actions";

export interface ActiveWaiter {
    id: string;
    firstName: string;
    lastName: string;
    isCaptain: boolean;
}

interface WaiterSummary {
    id: string;
    firstName: string;
    lastName: string;
    hasPin: boolean;
}

// Paleta de avatares alineada a Minimal Navy (subtle pills)
const AVATAR_PALETTE = [
    "bg-capsula-navy-soft text-capsula-ink",
    "bg-[#E5EDE7] text-[#2F6B4E]",
    "bg-[#F3EAD6] text-[#946A1C]",
    "bg-capsula-coral-subtle text-capsula-coral",
    "bg-[#E6ECF4] text-[#2A4060]",
    "bg-capsula-ivory-alt text-capsula-ink-soft",
];

function paletteFor(id: string) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
    return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function initialsOf(first: string, last: string) {
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export function WaiterIdentification({
    onIdentified,
}: {
    onIdentified: (waiter: ActiveWaiter) => void;
}) {
    const [waiters, setWaiters] = useState<WaiterSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [pin, setPin] = useState("");
    const [error, setError] = useState("");
    const [isValidating, setIsValidating] = useState(false);

    useEffect(() => {
        (async () => {
            const res = await getActiveWaitersAction();
            if (res.success) setWaiters(res.data as WaiterSummary[]);
            setIsLoading(false);
        })();
    }, []);

    const handleDigit = (d: string) => {
        if (pin.length >= 6 || isValidating) return;
        setError("");
        setPin((p) => p + d);
    };
    const handleDelete = () => {
        if (isValidating) return;
        setError("");
        setPin((p) => p.slice(0, -1));
    };
    const handleClear = () => {
        if (isValidating) return;
        setError("");
        setPin("");
    };

    const handleValidate = async () => {
        if (pin.length < 4) {
            setError("El PIN debe tener al menos 4 dígitos");
            return;
        }
        setIsValidating(true);
        setError("");
        try {
            const res = await validateWaiterPinAction(pin);
            if (res.success && res.data) {
                onIdentified({
                    id: res.data.waiterId,
                    firstName: res.data.firstName,
                    lastName: res.data.lastName,
                    isCaptain: res.data.isCaptain,
                });
            } else {
                setError(res.message || "PIN incorrecto");
                setPin("");
            }
        } finally {
            setIsValidating(false);
        }
    };

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key >= "0" && e.key <= "9") handleDigit(e.key);
            else if (e.key === "Backspace") handleDelete();
            else if (e.key === "Enter") handleValidate();
            else if (e.key === "Escape") handleClear();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pin, isValidating]);

    const waitersWithPin = waiters.filter((w) => w.hasPin);

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto bg-capsula-ivory px-4 py-6">
            <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6">
                {/* Header */}
                <div className="text-center">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-capsula-navy-soft text-capsula-ink">
                        <ChefHat className="h-7 w-7" />
                    </div>
                    <h1 className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink md:text-4xl">
                        ¿Quién eres?
                    </h1>
                    <p className="pos-kicker mt-2">
                        Introduce tu PIN para identificarte
                    </p>
                </div>

                {/* Avatares de mesoneros activos */}
                {isLoading ? (
                    <div className="text-sm text-capsula-ink-muted">Cargando mesoneros…</div>
                ) : waitersWithPin.length === 0 ? (
                    <div className="max-w-md rounded-2xl border border-[#E8D9B8] bg-[#F3EAD6]/60 px-6 py-4 text-center">
                        <p className="flex items-center justify-center gap-2 text-sm font-medium text-[#946A1C]">
                            <AlertTriangle className="h-4 w-4" />
                            Ningún mesonero tiene PIN configurado.
                        </p>
                        <p className="mt-1 text-xs text-capsula-ink-soft">
                            Solicita al administrador que asigne PINs desde el módulo Mesoneros.
                        </p>
                    </div>
                ) : (
                    <div className="grid max-w-2xl grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6">
                        {waitersWithPin.map((w) => (
                            <div
                                key={w.id}
                                className="flex flex-col items-center gap-1.5 opacity-80"
                            >
                                <div
                                    className={`flex h-14 w-14 items-center justify-center rounded-full text-lg font-medium md:h-16 md:w-16 md:text-xl ${paletteFor(
                                        w.id,
                                    )}`}
                                >
                                    {initialsOf(w.firstName, w.lastName)}
                                </div>
                                <p className="text-center text-[11px] font-medium leading-tight text-capsula-ink-soft md:text-xs">
                                    {w.firstName}
                                </p>
                            </div>
                        ))}
                    </div>
                )}

                {/* PIN display */}
                <div className="mt-2 flex items-center justify-center gap-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div
                            key={i}
                            className={`h-4 w-4 rounded-full border-2 transition-all md:h-5 md:w-5 ${
                                pin.length > i
                                    ? "scale-110 border-capsula-navy-deep bg-capsula-navy-deep"
                                    : "border-capsula-line-strong"
                            }`}
                        />
                    ))}
                </div>
                {error && (
                    <p className="-mt-2 text-sm font-medium text-capsula-coral">{error}</p>
                )}

                {/* Numeric keypad */}
                <div className="grid w-full max-w-xs grid-cols-3 gap-3">
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                        <button
                            key={d}
                            onClick={() => handleDigit(d)}
                            disabled={isValidating}
                            className="pos-btn pos-btn-secondary !min-h-[64px] text-2xl disabled:opacity-40"
                        >
                            {d}
                        </button>
                    ))}
                    <button
                        onClick={handleClear}
                        disabled={isValidating}
                        className="pos-btn pos-btn-secondary !min-h-[64px] text-sm text-capsula-coral disabled:opacity-40"
                    >
                        Limpiar
                    </button>
                    <button
                        onClick={() => handleDigit("0")}
                        disabled={isValidating}
                        className="pos-btn pos-btn-secondary !min-h-[64px] text-2xl disabled:opacity-40"
                    >
                        0
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={isValidating}
                        className="pos-btn pos-btn-secondary !min-h-[64px] disabled:opacity-40"
                        aria-label="Borrar"
                    >
                        <Delete className="h-6 w-6" />
                    </button>
                </div>

                {/* Validate button */}
                <button
                    onClick={handleValidate}
                    disabled={pin.length < 4 || isValidating}
                    className="pos-btn w-full max-w-xs !min-h-[64px] text-base tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {isValidating ? "Validando…" : (
                        <>
                            Entrar
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
