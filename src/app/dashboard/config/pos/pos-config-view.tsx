'use client';

import { useState, useEffect, useTransition } from 'react';
import { getPOSConfig, setPOSConfig, type POSConfig } from '@/lib/pos-settings';
import { setStockValidationEnabled } from '@/app/actions/system-config.actions';

interface Props {
  initialStockValidation: boolean;
}

export function POSConfigView({ initialStockValidation }: Props) {
  const [config, setConfig] = useState<POSConfig | null>(null);
  const [stockValidation, setStockValidation] = useState(initialStockValidation);
  const [isPending, startTransition] = useTransition();

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
        <h1 className="font-heading text-3xl tracking-[-0.02em] text-capsula-ink">
          Configuración POS
        </h1>
        <p className="mt-1 text-sm text-capsula-ink-soft">
          Configura impresión, validación de stock y comportamiento del sistema en cada módulo.
        </p>
      </div>

      <div className="space-y-6">
        {/* ── Control de Inventario ───────────────────────────────────── */}
        <div className={`bg-gray-800 rounded-xl border p-5 ${stockValidation ? 'border-emerald-500/50' : 'border-gray-700'}`}>
          <h2 className="font-bold text-lg text-emerald-300 mb-1 flex items-center gap-2">
            📦 Control de Inventario
          </h2>
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

        {/* ── POS Delivery ─────────────────────────────────────────────── */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <h2 className="font-bold text-lg text-blue-300 mb-4 flex items-center gap-2">
            🛵 POS Delivery
          </h2>
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
          <h2 className="font-bold text-lg text-green-300 mb-4 flex items-center gap-2">
            🥙 POS Restaurante
          </h2>
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
