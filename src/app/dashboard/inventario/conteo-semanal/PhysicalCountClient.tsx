'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import {
  previewPhysicalCountFromExcelAction,
  applyPhysicalCountAction,
  resetAllWarehouseStockAction,
  type PreviewRow,
} from '@/app/actions/inventory-count.actions';

type Props = {
  areas: { id: string; name: string }[];
  defaultPrincipalId: string | null;
  defaultProductionId: string | null;
  canReset: boolean;
};

export default function PhysicalCountClient({
  areas,
  defaultPrincipalId,
  defaultProductionId,
  canReset,
}: Props) {
  const [principalId, setPrincipalId] = useState(defaultPrincipalId || '');
  const [productionId, setProductionId] = useState(defaultProductionId || '');
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [isDual, setIsDual] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetPhrase, setResetPhrase] = useState('');
  const [resetting, setResetting] = useState(false);

  const unmatched = useMemo(() => preview?.filter((r) => !r.inventoryItemId) ?? [], [preview]);
  const matched = useMemo(() => preview?.filter((r) => r.inventoryItemId) ?? [], [preview]);

  const downloadTemplate = (dual: boolean) => {
    const headers = dual
      ? [['PRODUCTO', 'CANT. ALMACÉN PRINCIPAL', 'CANT. PRODUCCIÓN']]
      : [['PRODUCTO', 'CANTIDAD EN STOCK']];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
    XLSX.writeFile(
      wb,
      dual ? 'plantilla_inventario_dos_almacenes.xlsx' : 'plantilla_inventario_un_almacen.xlsx'
    );
    toast.success('Plantilla descargada');
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setPreview(null);
    try {
      const fd = new FormData();
      fd.set('file', file);
      const res = await previewPhysicalCountFromExcelAction(fd);
      if (!res.success || !res.rows) {
        toast.error(res.message || 'Error');
        return;
      }
      setPreview(res.rows);
      setIsDual(!!res.isDualColumn);
      toast.success(`${res.rows.length} filas leídas${res.isDualColumn ? ' (2 almacenes)' : ' (1 almacén)'}`);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const onApply = async () => {
    if (!preview || !principalId) {
      toast.error('Seleccione almacén principal y cargue un archivo');
      return;
    }
    if (unmatched.length > 0) {
      if (!confirm(`${unmatched.length} productos sin coincidencia se omitirán. ¿Continuar?`)) return;
    }
    const rows = matched.map((r) => ({
      inventoryItemId: r.inventoryItemId!,
      qtyPrincipal: r.qtyPrincipal,
      qtyProduction: r.qtyProduction,
    }));
    if (rows.length === 0) {
      toast.error('No hay filas válidas para aplicar');
      return;
    }
    setLoading(true);
    try {
      const res = await applyPhysicalCountAction({
        rows,
        principalAreaId: principalId,
        productionAreaId: productionId || null,
        dualWarehouse: isDual,
      });
      if (res.success) {
        toast.success(res.message);
        setPreview(null);
      } else toast.error(res.message);
    } finally {
      setLoading(false);
    }
  };

  const onReset = async () => {
    if (!confirm('¿Seguro? Se pondrá en CERO el stock de TODOS los almacenes. Esta acción no se puede deshacer automáticamente.')) {
      return;
    }
    setResetting(true);
    try {
      const res = await resetAllWarehouseStockAction(resetPhrase);
      if (res.success) toast.success(res.message);
      else toast.error(res.message);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 text-gray-900 dark:text-gray-100">
      <div>
        <Link
          href="/dashboard/inventario"
          className="text-sm text-amber-600 dark:text-amber-400 hover:underline mb-2 inline-block"
        >
          ← Volver a Inventario
        </Link>
        <h1 className="text-2xl font-bold">Conteo físico semanal (carga tipo Excel)</h1>
        <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
          Mismo formato que su hoja <strong>INVENTARIO GENERAL</strong>: fila con encabezado{' '}
          <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">PRODUCTO</code> y columna de cantidades.
          Opcionalmente tres columnas para cargar <strong>Almacén principal</strong> y{' '}
          <strong>Producción/Cocina</strong> en una sola pasada.
        </p>
      </div>

      {canReset && (
        <section className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/80 dark:bg-red-950/20 p-5">
          <h2 className="font-bold text-red-800 dark:text-red-300 mb-2">1. Reinicio (solo gerencia)</h2>
          <p className="text-sm text-red-900/80 dark:text-red-200/80 mb-3">
            Antes del conteo del domingo puede poner <strong>todas</strong> las ubicaciones en <strong>0</strong>.
            Luego cargue el Excel con las cantidades contadas.
          </p>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-semibold mb-1">Confirmación (escriba en mayúsculas)</label>
              <input
                value={resetPhrase}
                onChange={(e) => setResetPhrase(e.target.value)}
                placeholder="PONER EN CERO"
                className="border rounded-lg px-3 py-2 bg-white dark:bg-gray-900 border-red-300 dark:border-red-800 w-48"
              />
            </div>
            <button
              type="button"
              onClick={onReset}
              disabled={resetting}
              className="px-4 py-2 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-50"
            >
              {resetting ? '…' : 'Poner inventario en cero'}
            </button>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
        <h2 className="font-bold mb-3">2. Plantillas Excel</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => downloadTemplate(false)}
            className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-800 font-semibold text-sm"
          >
            Descargar plantilla (1 almacén)
          </button>
          <button
            type="button"
            onClick={() => downloadTemplate(true)}
            className="px-4 py-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 font-semibold text-sm"
          >
            Descargar plantilla (Principal + Producción)
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          También puede usar su archivo actual: debe incluir la fila con <strong>PRODUCTO</strong> en la primera
          columna, como en su archivo de almacén principal.
        </p>
      </section>

      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
        <h2 className="font-bold mb-3">3. Almacenes destino</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Almacén principal / conteo columna 1</label>
            <select
              value={principalId}
              onChange={(e) => setPrincipalId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-900"
            >
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">
              Producción / Cocina (solo si el Excel tiene 3 columnas)
            </label>
            <select
              value={productionId}
              onChange={(e) => setProductionId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-900"
            >
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
        <h2 className="font-bold mb-3">4. Subir Excel</h2>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={onFile}
          disabled={loading}
          className="text-sm"
        />
        {loading && <p className="text-sm text-gray-500 mt-2">Procesando…</p>}
      </section>

      {preview && (
        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
          <h2 className="font-bold mb-2">Vista previa</h2>
          <p className="text-sm mb-3">
            Modo:{' '}
            <strong>{isDual ? 'Dos almacenes (3 columnas)' : 'Un almacén (cantidad → almacén principal)'}</strong>
            . Coincidencias: {matched.length} / {preview.length}
            {unmatched.length > 0 && (
              <span className="text-amber-600 dark:text-amber-400">
                {' '}
                — {unmatched.length} sin coincidencia en el catálogo
              </span>
            )}
          </p>
          <div className="overflow-x-auto max-h-96 border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                <tr>
                  <th className="text-left p-2">Producto (Excel)</th>
                  <th className="text-right p-2">Cant. 1</th>
                  {isDual && <th className="text-right p-2">Cant. 2</th>}
                  <th className="text-left p-2">Ítem sistema</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr
                    key={i}
                    className={r.inventoryItemId ? '' : 'bg-amber-50 dark:bg-amber-950/20'}
                  >
                    <td className="p-2 border-t border-gray-100 dark:border-gray-800">{r.productName}</td>
                    <td className="p-2 border-t text-right font-mono">{r.qtyPrincipal}</td>
                    {isDual && (
                      <td className="p-2 border-t text-right font-mono">{r.qtyProduction ?? '—'}</td>
                    )}
                    <td className="p-2 border-t text-xs">
                      {r.inventoryItemId ? (
                        <span className="text-green-600 dark:text-green-400">✓ {r.matchedName}</span>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-300">Sin coincidencia</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={onApply}
            disabled={loading || matched.length === 0}
            className="mt-4 w-full sm:w-auto px-6 py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 disabled:opacity-50"
          >
            Aplicar conteo al sistema
          </button>
        </section>
      )}
    </div>
  );
}
