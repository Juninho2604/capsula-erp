'use client';

import { useState, useEffect, useTransition } from 'react';
import { getPOSConfig, setPOSConfig, type POSConfig } from '@/lib/pos-settings';
import { setStockValidationEnabled, setDivisasDiscountPercentAction } from '@/app/actions/system-config.actions';
import toast from 'react-hot-toast';

interface Props {
  initialStockValidation: boolean;
  initialDivisasPercent: number;
  canEditDivisas: boolean;
}

export function POSConfigView({ initialStockValidation, initialDivisasPercent, canEditDivisas }: Props) {
  const [config, setConfig] = useState<POSConfig | null>(null);
  const [stockValidation, setStockValidation] = useState(initialStockValidation);
  const [divisasStr, setDivisasStr] = useState(String(Math.round(initialDivisasPercent * 100) / 100));
  const [savedDivisas, setSavedDivisas] = useState(Math.round(initialDivisasPercent * 100) / 100);
  const [savingDivisas, setSavingDivisas] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSaveDivisas = async () => {
    const n = parseFloat(divisasStr);
    if (!Number.isFinite(n) || n < 0 || n > 90) {
      toast.error('Ingresá un porcentaje entre 0 y 90');
      return;
    }
    setSavingDivisas(true);
    const res = await setDivisasDiscountPercentAction(n);
    setSavingDivisas(false);
    if (res.ok) {
      const v = res.value ?? n;
      setSavedDivisas(v);
      setDivisasStr(String(Math.round(v * 100) / 100));
      toast.success(`Descuento en divisas: ${Math.round(v * 100) / 100}%`);
    } else {
      toast.error(res.error ?? 'Error guardando');
    }
  };

  useEffect(() => {
    setConfig(getPOSConfig());
  }, []);

  const toggle = (key: keyof POSConfig, value: boolean) => {
    const next = setPOSConfig({ [key]: value });
    setConfig(next);
  };

  const toggleStockValidation = (value: boolean) => {
    setStockValidation(value);
    startTransition(async () => {
      await setStockValidationEnabled(value);
    });
  };

  if (!config) return <div className="p-8 text-white">Cargando...</div>;

  return (
    <div className="max-w-2xl mx-auto p-6 text-white">
      <div className="mb-8">
        <h1 className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink">Configuración POS</h1>
        <p className="mt-1 text-sm text-capsula-ink-soft">
          Configura impresión, validación de stock y comportamiento del sistema en cada módulo.
        </p>
      </div>

      <div className="space-y-6">
        {/* ── Control de Inventario ───────────────────────────────────── */}
        <div className={`bg-gray-800 rounded-xl border p-5 ${stockValidation ? 'border-emerald-500/50' : 'border-gray-700'}`}>
          <h2 className="font-bold text-lg text-emerald-300 mb-1 flex items-center gap-2">Control de Inventario</h2>
          <p className="text-xs text-gray-500 mb-4">
            Configuración guardada en la base de datos — aplica a todos los terminales.
          </p>
          <div className="space-y-4">
            <label className="flex items-start justify-between gap-4 cursor-pointer">
              <div>
                <p className="text-gray-300 font-medium">Validar stock antes de confirmar orden</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Si está activo y faltan ingredientes, la orden se bloquea. Actívalo solo cuando todas las recetas estén completas.
                </p>
                {stockValidation && (
                  <p className="text-xs text-emerald-400 font-bold mt-1">
                    ✅ Activo — las órdenes sin stock serán rechazadas
                  </p>
                )}
                {!stockValidation && (
                  <p className="text-xs text-amber-400 mt-1">
                    ⚠️ Desactivado — se permite vender aunque falten insumos
                  </p>
                )}
              </div>
              <button
                onClick={() => toggleStockValidation(!stockValidation)}
                disabled={isPending}
                className={`relative flex-shrink-0 w-12 h-6 rounded-full transition-colors ${
                  stockValidation ? 'bg-emerald-600' : 'bg-gray-600'
                } disabled:opacity-50`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    stockValidation ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </label>
          </div>
        </div>

        {/* ── Descuento por divisas (§87) ──────────────────────────────── */}
        <div className="bg-gray-800 rounded-xl border border-amber-500/40 p-5">
          <h2 className="font-bold text-lg text-amber-300 mb-1 flex items-center gap-2">Descuento por pago en divisas</h2>
          <p className="text-xs text-gray-500 mb-4">
            Descuento que se aplica cuando el cliente paga en efectivo USD/EUR o Zelle. Aplica a los ítems en todos los POS (mesa, delivery, pickup). Editable por dueño, auditor o administrador. El fee de delivery mantiene su piso de $3 al motorizado — este % no lo toca.
          </p>
          {canEditDivisas ? (
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-1">Porcentaje de descuento</label>
                <div className="flex items-center bg-gray-900 rounded-lg border border-gray-600 px-3 py-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={90}
                    step="any"
                    value={divisasStr}
                    onChange={(e) => setDivisasStr(e.target.value)}
                    className="w-24 bg-transparent text-right text-lg font-semibold text-white tabular-nums focus:outline-none"
                  />
                  <span className="text-lg font-semibold text-gray-400 ml-1">%</span>
                </div>
              </div>
              <button
                onClick={handleSaveDivisas}
                disabled={savingDivisas || parseFloat(divisasStr) === savedDivisas}
                className="rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {savingDivisas ? 'Guardando…' : 'Guardar'}
              </button>
              <p className="text-xs text-gray-500 self-center">Actual: <span className="font-semibold text-amber-300">{savedDivisas}%</span></p>
            </div>
          ) : (
            <p className="text-sm text-gray-300">Descuento actual: <span className="font-semibold text-amber-300">{savedDivisas}%</span> — solo dueño, auditor o administrador pueden cambiarlo.</p>
          )}
        </div>

        {/* ── POS Delivery ─────────────────────────────────────────────── */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <h2 className="font-bold text-lg text-blue-300 mb-4 flex items-center gap-2">POS Delivery</h2>
          <div className="space-y-4">
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <span className="text-gray-300">Imprimir comanda cocina al confirmar</span>
              <button
                onClick={() => toggle('printComandaOnDelivery', !config.printComandaOnDelivery)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  config.printComandaOnDelivery ? 'bg-blue-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    config.printComandaOnDelivery ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </label>
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <span className="text-gray-300">Imprimir factura automáticamente al confirmar</span>
              <button
                onClick={() => toggle('printReceiptOnDelivery', !config.printReceiptOnDelivery)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  config.printReceiptOnDelivery ? 'bg-blue-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    config.printReceiptOnDelivery ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </label>
          </div>
        </div>

        {/* ── POS Restaurante ──────────────────────────────────────────── */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <h2 className="font-bold text-lg text-green-300 mb-4 flex items-center gap-2">POS Restaurante</h2>
          <div className="space-y-4">
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <span className="text-gray-300">Imprimir comanda cocina al enviar a mesa</span>
              <button
                onClick={() => toggle('printComandaOnRestaurant', !config.printComandaOnRestaurant)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  config.printComandaOnRestaurant ? 'bg-green-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    config.printComandaOnRestaurant ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </label>
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <span className="text-gray-300">Imprimir factura al registrar pago (cerrar cuenta)</span>
              <button
                onClick={() => toggle('printReceiptOnRestaurant', !config.printReceiptOnRestaurant)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  config.printReceiptOnRestaurant ? 'bg-green-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    config.printReceiptOnRestaurant ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </label>
          </div>
        </div>
      </div>

      <p className="mt-6 text-xs text-gray-500">
        La configuración de impresión se guarda en este navegador. La validación de stock aplica a todos los terminales.
      </p>
    </div>
  );
}
