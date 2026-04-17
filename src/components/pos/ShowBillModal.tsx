"use client";

import { useEffect, useState } from "react";
import { getExchangeRateValue } from "@/app/actions/exchange.actions";

interface BillItem {
  itemName: string;
  quantity: number;
  lineTotal: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  items: BillItem[];
  tableName?: string;
}

export function ShowBillModal({ open, onClose, items, tableName }: Props) {
  const [bsRate, setBsRate] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      getExchangeRateValue().then((r) => setBsRate(r));
    }
  }, [open]);

  if (!open) return null;

  const subtotal = items.reduce((sum, it) => sum + it.lineTotal, 0);
  const service = subtotal * 0.10;
  const totalUsd = subtotal + service;
  const totalCrypto = totalUsd * 1.33;
  const totalBs = bsRate ? totalUsd * bsRate : null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-4 text-center">
          <h2 className="text-lg font-bold text-slate-900">Cuenta</h2>
          {tableName && <p className="text-sm text-slate-500">{tableName}</p>}
        </div>

        {/* Items */}
        <div className="mb-4 max-h-64 overflow-y-auto divide-y divide-slate-200">
          {items.map((it, i) => (
            <div key={i} className="flex items-center justify-between py-2 text-sm">
              <span className="text-slate-700">
                {it.quantity} × {it.itemName}
              </span>
              <span className="font-medium text-slate-900">
                ${it.lineTotal.toFixed(2)}
              </span>
            </div>
          ))}
          {items.length === 0 && (
            <p className="py-4 text-center text-sm text-slate-400">Sin items</p>
          )}
        </div>

        {/* Totals */}
        <div className="space-y-2 border-t border-slate-200 pt-3 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Servicio 10%</span>
            <span>${service.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-base font-bold text-slate-900 border-t border-slate-300 pt-2">
            <span>Total USD</span>
            <span>${totalUsd.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Total Cripto</span>
            <span>${totalCrypto.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Total Bs</span>
            <span>
              {totalBs !== null
                ? `Bs ${totalBs.toFixed(2)}`
                : "Bs — tasa no disponible"}
            </span>
          </div>
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="mt-5 w-full rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
