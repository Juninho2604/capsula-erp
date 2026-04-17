"use client";

import { useState } from "react";
import { transferTableAction } from "@/app/actions/waiter.actions";

interface WaiterOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  openTabId: string;
  currentWaiterId: string;
  waiters: WaiterOption[];
  onTransferred: () => void;
}

export function TableTransferModal({
  open,
  onClose,
  openTabId,
  currentWaiterId,
  waiters,
  onTransferred,
}: Props) {
  const [toWaiterId, setToWaiterId] = useState("");
  const [reason, setReason] = useState("");
  const [authPin, setAuthPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const available = waiters.filter((w) => w.id !== currentWaiterId);

  const handleSubmit = async () => {
    if (!toWaiterId) { setError("Selecciona un mesonero destino"); return; }
    if (authPin.length < 4) { setError("Ingresa PIN de autorización (mín. 4 dígitos)"); return; }

    setLoading(true);
    setError("");
    try {
      const res = await transferTableAction({
        openTabId,
        toWaiterId,
        reason: reason.trim() || undefined,
        authPin,
      });
      if (res.success) {
        onTransferred();
        handleClose();
      } else {
        setError(res.message || "Error al transferir");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setToWaiterId("");
    setReason("");
    setAuthPin("");
    setError("");
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl">
        <h2 className="mb-4 text-lg font-bold text-white">Transferir Mesa</h2>

        {/* Select waiter */}
        <label className="mb-1 block text-sm text-slate-400">Mesonero destino</label>
        <select
          value={toWaiterId}
          onChange={(e) => setToWaiterId(e.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:border-coral-500 focus:outline-none"
        >
          <option value="">— Seleccionar —</option>
          {available.map((w) => (
            <option key={w.id} value={w.id}>
              {w.firstName} {w.lastName}
            </option>
          ))}
        </select>

        {/* Reason */}
        <label className="mb-1 block text-sm text-slate-400">Motivo (opcional)</label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ej: cambio de turno"
          className="mb-4 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-coral-500 focus:outline-none"
        />

        {/* Auth PIN */}
        <label className="mb-1 block text-sm text-slate-400">PIN de autorización (capitán/gerente)</label>
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={authPin}
          onChange={(e) => { setAuthPin(e.target.value.replace(/\D/g, "")); setError(""); }}
          placeholder="••••"
          className="mb-4 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white text-center tracking-[0.5em] placeholder-slate-500 focus:border-coral-500 focus:outline-none"
        />

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 rounded-lg border border-slate-600 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 rounded-lg bg-coral-500 py-2 text-sm font-semibold text-white hover:bg-coral-600 disabled:opacity-50 transition-colors"
          >
            {loading ? "Transfiriendo..." : "Transferir"}
          </button>
        </div>
      </div>
    </div>
  );
}
