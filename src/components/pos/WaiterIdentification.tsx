"use client";

import { useEffect, useState } from "react";
import {
  getActiveWaitersForBranchAction,
  validateWaiterPinAction,
} from "@/app/actions/waiter.actions";

interface WaiterProfile {
  id: string;
  firstName: string;
  lastName: string;
  hasPin: boolean;
  isCaptain: boolean;
}

interface IdentifiedWaiter {
  id: string;
  firstName: string;
  lastName: string;
  isCaptain: boolean;
}

interface Props {
  onIdentified: (waiter: IdentifiedWaiter) => void;
}

export function WaiterIdentification({ onIdentified }: Props) {
  const [waiters, setWaiters] = useState<WaiterProfile[]>([]);
  const [selectedWaiter, setSelectedWaiter] = useState<WaiterProfile | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await getActiveWaitersForBranchAction();
      if (res.success && res.data) setWaiters(res.data);
      setLoading(false);
    })();
  }, []);

  const handleDigit = (d: string) => {
    if (pin.length >= 6) return;
    setPin((p) => p + d);
    setError("");
  };

  const handleDelete = () => {
    setPin((p) => p.slice(0, -1));
    setError("");
  };

  const handleSubmit = async () => {
    if (!selectedWaiter || pin.length < 4) return;
    setValidating(true);
    setError("");
    try {
      const res = await validateWaiterPinAction(selectedWaiter.id, pin);
      if (res.success && res.data) {
        sessionStorage.setItem("activeWaiter", JSON.stringify(res.data));
        onIdentified(res.data);
      } else {
        setError(res.message || "PIN incorrecto");
        setPin("");
      }
    } catch {
      setError("Error de conexión");
      setPin("");
    } finally {
      setValidating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="animate-pulse text-slate-400 text-lg">Cargando mesoneros...</div>
      </div>
    );
  }

  // Step 1: Select waiter
  if (!selectedWaiter) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-950 px-4">
        <h1 className="mb-2 text-2xl font-bold text-white">Identificación de Mesonero</h1>
        <p className="mb-8 text-slate-400">Selecciona tu perfil para continuar</p>

        {waiters.length === 0 && (
          <p className="text-slate-500">No hay mesoneros activos configurados.</p>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 max-w-2xl">
          {waiters.map((w) => (
            <button
              key={w.id}
              onClick={() => { setSelectedWaiter(w); setPin(""); setError(""); }}
              disabled={!w.hasPin}
              className={`
                relative flex flex-col items-center gap-2 rounded-xl border-2 p-5 transition-all
                ${w.hasPin
                  ? "border-slate-700 bg-slate-800 hover:border-coral-500 hover:bg-slate-700 cursor-pointer"
                  : "border-slate-800 bg-slate-900 opacity-50 cursor-not-allowed"
                }
              `}
            >
              {/* Avatar */}
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-coral-500 to-coral-600 text-xl font-bold text-white">
                {w.firstName[0]}{w.lastName[0]}
              </div>
              {/* Captain badge */}
              {w.isCaptain && (
                <span className="absolute -top-1 -right-1 text-lg" title="Capitán">⭐</span>
              )}
              <span className="text-sm font-medium text-white text-center">
                {w.firstName} {w.lastName}
              </span>
              {!w.hasPin && (
                <span className="text-[10px] text-slate-500">Sin PIN</span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Step 2: PIN entry
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-slate-950 px-4">
      <button
        onClick={() => { setSelectedWaiter(null); setPin(""); setError(""); }}
        className="mb-6 text-sm text-slate-500 hover:text-slate-300 transition-colors"
      >
        ← Volver a selección
      </button>

      {/* Avatar */}
      <div className="relative mb-2">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-coral-500 to-coral-600 text-2xl font-bold text-white">
          {selectedWaiter.firstName[0]}{selectedWaiter.lastName[0]}
        </div>
        {selectedWaiter.isCaptain && (
          <span className="absolute -top-1 -right-1 text-xl">⭐</span>
        )}
      </div>
      <h2 className="mb-1 text-xl font-semibold text-white">
        {selectedWaiter.firstName} {selectedWaiter.lastName}
      </h2>
      {selectedWaiter.isCaptain && (
        <span className="mb-4 text-xs text-amber-400 font-medium">Capitán</span>
      )}

      {/* PIN dots */}
      <div className="mb-4 mt-4 flex gap-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-4 w-4 rounded-full transition-all ${
              i < pin.length
                ? "bg-coral-500 scale-110"
                : "border-2 border-slate-600 bg-transparent"
            }`}
          />
        ))}
      </div>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      {/* Numeric keypad */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <button
            key={d}
            onClick={() => handleDigit(String(d))}
            className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-800 text-xl font-semibold text-white hover:bg-slate-700 active:bg-slate-600 transition-colors"
          >
            {d}
          </button>
        ))}
        {/* Bottom row: empty, 0, delete */}
        <div />
        <button
          onClick={() => handleDigit("0")}
          className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-800 text-xl font-semibold text-white hover:bg-slate-700 active:bg-slate-600 transition-colors"
        >
          0
        </button>
        <button
          onClick={handleDelete}
          className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-800 text-lg text-slate-400 hover:bg-red-900/50 hover:text-red-400 transition-colors"
        >
          ⌫
        </button>
      </div>

      {/* Enter button */}
      <button
        onClick={handleSubmit}
        disabled={pin.length < 4 || validating}
        className={`
          mt-2 w-[224px] rounded-xl py-3 text-base font-semibold transition-all
          ${pin.length >= 4
            ? "bg-coral-500 text-white hover:bg-coral-600 active:bg-coral-700"
            : "bg-slate-800 text-slate-500 cursor-not-allowed"
          }
        `}
      >
        {validating ? "Validando..." : "Entrar"}
      </button>
    </div>
  );
}
