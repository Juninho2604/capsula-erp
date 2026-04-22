'use client';

import { useState, useEffect, useTransition } from 'react';
import { getPOSConfig, setPOSConfig, type POSConfig } from '@/lib/pos-settings';
import { setStockValidationEnabled } from '@/app/actions/system-config.actions';
import { Package, Bike, Utensils, Settings, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

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

  if (!config) return (
    <div className="flex items-center gap-2 p-8 text-capsula-ink-soft">
      <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
      Cargando…
    </div>
  );

  const Toggle = ({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative h-6 w-12 flex-shrink-0 rounded-full transition-colors ${on ? 'bg-capsula-navy-deep' : 'bg-capsula-line'} disabled:opacity-50`}
    >
      <span className={`absolute top-1 h-4 w-4 rounded-full bg-capsula-ivory-surface shadow transition-transform ${on ? 'left-7' : 'left-1'}`} />
    </button>
  );

  return (
    <div className="mx-auto max-w-2xl animate-in space-y-6">
      <div className="flex items-center gap-3 border-b border-capsula-line pb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-capsula-line bg-capsula-ivory-surface text-capsula-navy-deep">
          <Settings className="h-4 w-4" strokeWidth={1.5} />
        </div>
        <div>
          <div className="mb-1 text-[11px] uppercase tracking-[0.12em] text-capsula-ink-muted">Configuración</div>
          <h1 className="font-heading text-[28px] leading-tight tracking-[-0.01em] text-capsula-navy-deep">POS</h1>
          <p className="mt-1 text-[13px] text-capsula-ink-soft">Configura impresión, validación de stock y comportamiento del sistema en cada módulo.</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className={`rounded-[var(--radius)] border p-5 shadow-cap-soft ${stockValidation ? 'border-[#2F6B4E]/40 bg-[#E5EDE7]/30' : 'border-capsula-line bg-capsula-ivory-surface'}`}>
          <h2 className="mb-1 flex items-center gap-2 font-heading text-[15px] text-capsula-navy-deep">
            <Package className="h-4 w-4 text-[#2F6B4E]" strokeWidth={1.5} />
            Control de inventario
          </h2>
          <p className="mb-4 text-[12px] text-capsula-ink-muted">
            Configuración guardada en la base de datos — aplica a todos los terminales.
          </p>
          <label className="flex cursor-pointer items-start justify-between gap-4">
            <div>
              <p className="text-[13px] font-medium text-capsula-ink">Validar stock antes de confirmar orden</p>
              <p className="mt-0.5 text-[12px] text-capsula-ink-soft">
                Si está activo y faltan ingredientes, la orden se bloquea. Actívalo solo cuando todas las recetas estén completas.
              </p>
              {stockValidation && (
                <p className="mt-1.5 flex items-center gap-1 text-[12px] font-medium text-[#2F6B4E]">
                  <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Activo — las órdenes sin stock serán rechazadas
                </p>
              )}
              {!stockValidation && (
                <p className="mt-1.5 flex items-center gap-1 text-[12px] text-[#946A1C]">
                  <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Desactivado — se permite vender aunque falten insumos
                </p>
              )}
            </div>
            <Toggle on={stockValidation} onClick={() => toggleStockValidation(!stockValidation)} disabled={isPending} />
          </label>
        </div>

        <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-5 shadow-cap-soft">
          <h2 className="mb-4 flex items-center gap-2 font-heading text-[15px] text-capsula-navy-deep">
            <Bike className="h-4 w-4 text-capsula-navy" strokeWidth={1.5} />
            POS Delivery
          </h2>
          <div className="space-y-4">
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <span className="text-[13px] text-capsula-ink">Imprimir comanda cocina al confirmar</span>
              <Toggle on={config.printComandaOnDelivery} onClick={() => toggle('printComandaOnDelivery', !config.printComandaOnDelivery)} />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <span className="text-[13px] text-capsula-ink">Imprimir factura automáticamente al confirmar</span>
              <Toggle on={config.printReceiptOnDelivery} onClick={() => toggle('printReceiptOnDelivery', !config.printReceiptOnDelivery)} />
            </label>
          </div>
        </div>

        <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-5 shadow-cap-soft">
          <h2 className="mb-4 flex items-center gap-2 font-heading text-[15px] text-capsula-navy-deep">
            <Utensils className="h-4 w-4 text-capsula-coral" strokeWidth={1.5} />
            POS Restaurante
          </h2>
          <div className="space-y-4">
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <span className="text-[13px] text-capsula-ink">Imprimir comanda cocina al enviar a mesa</span>
              <Toggle on={config.printComandaOnRestaurant} onClick={() => toggle('printComandaOnRestaurant', !config.printComandaOnRestaurant)} />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <span className="text-[13px] text-capsula-ink">Imprimir factura al registrar pago (cerrar cuenta)</span>
              <Toggle on={config.printReceiptOnRestaurant} onClick={() => toggle('printReceiptOnRestaurant', !config.printReceiptOnRestaurant)} />
            </label>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-capsula-ink-muted">
        La configuración de impresión se guarda en este navegador. La validación de stock aplica a todos los terminales.
      </p>
    </div>
  );
}
