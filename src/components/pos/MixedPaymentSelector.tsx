'use client';

import { useState, useCallback } from 'react';
import {
  DollarSign, Euro, Zap, Banknote, CreditCard, Smartphone, Gift, X as XIcon, CheckCircle2,
} from 'lucide-react';

export interface PaymentLine {
  id: string;
  method: string;
  amountUSD: number;
  amountBS?: number;
  exchangeRate?: number;
  reference?: string;
}

interface Props {
  totalAmount: number;
  exchangeRate?: number | null;
  onChange: (lines: PaymentLine[], totalPaid: number, isComplete: boolean) => void;
  disabled?: boolean;
  /** If true, shows the CORTESIA method button */
  allowCortesia?: boolean;
}

type MethodDef = {
  id: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
};

const METHODS: readonly MethodDef[] = [
  { id: 'CASH_USD',       label: 'Cash $',        Icon: DollarSign },
  { id: 'CASH_EUR',       label: 'Cash €',        Icon: Euro },
  { id: 'ZELLE',          label: 'Zelle',         Icon: Zap },
  { id: 'CASH_BS',        label: 'Efectivo Bs',   Icon: Banknote },
  { id: 'PDV_SHANKLISH',  label: 'PDV Shanklish', Icon: CreditCard },
  { id: 'PDV_SUPERFERRO', label: 'PDV Superferro',Icon: CreditCard },
  { id: 'MOVIL_NG',       label: 'Pago Móvil NG', Icon: Smartphone },
  { id: 'CORTESIA',       label: 'Cortesía',      Icon: Gift },
];

/** These methods are paid in Bs — show conversion when exchangeRate available */
const BS_METHODS = new Set(['CASH_BS', 'PDV_SHANKLISH', 'PDV_SUPERFERRO', 'MOVIL_NG', 'MOBILE_PAY', 'CARD', 'TRANSFER']);

function methodLabel(id: string) {
  return METHODS.find((m) => m.id === id)?.label ?? id;
}

export default function MixedPaymentSelector({
  totalAmount,
  exchangeRate,
  onChange,
  disabled,
  allowCortesia = false,
}: Props) {
  const [lines, setLines] = useState<PaymentLine[]>([]);

  const totalPaid = lines.reduce((s, l) => s + l.amountUSD, 0);
  const remaining = Math.max(0, totalAmount - totalPaid);
  const overpay   = Math.max(0, totalPaid - totalAmount);
  const isComplete = totalPaid >= totalAmount - 0.001;

  const notify = useCallback(
    (nextLines: PaymentLine[]) => {
      const paid = nextLines.reduce((s, l) => s + l.amountUSD, 0);
      const complete = paid >= totalAmount - 0.001;
      onChange(nextLines, paid, complete);
    },
    [totalAmount, onChange]
  );

  const addLine = (method: string) => {
    if (disabled) return;
    const autoAmount = remaining > 0.001 ? parseFloat(remaining.toFixed(2)) : 0;
    const newLine: PaymentLine = {
      id: `${method}-${Date.now()}`,
      method,
      amountUSD: autoAmount,
      amountBS: (BS_METHODS.has(method) && exchangeRate && autoAmount > 0)
        ? parseFloat((autoAmount * exchangeRate).toFixed(0))
        : undefined,
      exchangeRate: BS_METHODS.has(method) && exchangeRate ? exchangeRate : undefined,
    };
    const next = [...lines, newLine];
    setLines(next);
    notify(next);
  };

  const updateLine = (id: string, field: 'amountUSD' | 'reference', value: string) => {
    const next = lines.map((l) => {
      if (l.id !== id) return l;
      if (field === 'amountUSD') {
        const usd = parseFloat(value) || 0;
        return {
          ...l,
          amountUSD: usd,
          amountBS: (BS_METHODS.has(l.method) && exchangeRate && usd > 0)
            ? parseFloat((usd * exchangeRate).toFixed(0))
            : undefined,
        };
      }
      return { ...l, reference: value };
    });
    setLines(next);
    notify(next);
  };

  const removeLine = (id: string) => {
    const next = lines.filter((l) => l.id !== id);
    setLines(next);
    notify(next);
  };

  const visibleMethods = allowCortesia
    ? METHODS
    : METHODS.filter((m) => m.id !== 'CORTESIA');

  return (
    <div className="space-y-3">
      {/* Method buttons */}
      <div className="grid grid-cols-3 gap-1.5">
        {visibleMethods.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => addLine(m.id)}
            disabled={disabled}
            className="inline-flex items-center justify-center gap-1 rounded-xl border border-capsula-line bg-capsula-ivory-surface px-1 py-2.5 text-[11px] font-medium uppercase tracking-[0.04em] text-capsula-ink-soft transition-all hover:border-capsula-navy-deep hover:text-capsula-ink active:scale-95 disabled:opacity-40"
          >
            <m.Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{m.label}</span>
          </button>
        ))}
      </div>

      {/* Payment lines */}
      {lines.length > 0 && (
        <div className="space-y-2">
          {lines.map((line) => (
            <div
              key={line.id}
              className="flex items-center gap-2 rounded-xl border border-capsula-line bg-capsula-ivory-surface p-2 text-sm"
            >
              <span className="w-20 shrink-0 text-[11px] font-medium uppercase leading-tight tracking-[0.04em] text-capsula-ink-soft">
                {methodLabel(line.method)}
              </span>

              {/* USD amount */}
              <div className="flex flex-1 items-center rounded-lg border border-capsula-line bg-capsula-ivory px-2">
                <span className="mr-1 text-xs text-capsula-ink-muted">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.amountUSD || ''}
                  onChange={(e) => updateLine(line.id, 'amountUSD', e.target.value)}
                  disabled={disabled}
                  placeholder="0.00"
                  className="w-0 flex-1 bg-transparent py-1.5 text-sm font-medium tabular-nums text-capsula-ink focus:outline-none"
                />
              </div>

              {/* Bs conversion for Bs methods */}
              {BS_METHODS.has(line.method) && exchangeRate && line.amountUSD > 0 && (
                <span className="shrink-0 text-[11px] font-medium tabular-nums text-capsula-navy">
                  Bs&nbsp;{(line.amountUSD * exchangeRate).toLocaleString('es-VE', { maximumFractionDigits: 0 })}
                </span>
              )}

              {/* Remove */}
              <button
                type="button"
                onClick={() => removeLine(line.id)}
                disabled={disabled}
                className="rounded-full p-1 text-capsula-ink-muted transition-colors hover:bg-capsula-coral-subtle hover:text-capsula-coral"
                aria-label="Quitar línea"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Balance footer */}
      {lines.length > 0 && (
        <div
          className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm font-medium ${
            isComplete
              ? overpay > 0.001
                ? 'border-[#E8D9B8] bg-[#F3EAD6]/60 text-[#946A1C]'
                : 'border-[#D3E2D8] bg-[#E5EDE7]/60 text-[#2F6B4E]'
              : 'border-capsula-line bg-capsula-ivory-alt text-capsula-ink-soft'
          }`}
        >
          {overpay > 0.001 ? (
            <>
              <span>Vuelto</span>
              <span className="font-heading text-base tabular-nums tracking-[-0.01em]">${overpay.toFixed(2)}</span>
            </>
          ) : isComplete ? (
            <>
              <span>Completado</span>
              <CheckCircle2 className="h-4 w-4" />
            </>
          ) : (
            <>
              <span>Pendiente</span>
              <span className="font-heading text-base tabular-nums tracking-[-0.01em] text-[#946A1C]">
                ${remaining.toFixed(2)}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
