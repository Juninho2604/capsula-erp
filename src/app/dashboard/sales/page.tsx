'use client';

import React, { useState, useEffect } from 'react';
import { getSalesHistoryAction, getDailyZReportAction, getEndOfDaySummaryAction, voidSalesOrderAction, type ZReportData, type EndOfDaySummary } from '@/app/actions/sales.actions';
import { validateManagerPinAction } from '@/app/actions/pos.actions';
import { printReceipt, printEndOfDaySummary } from '@/lib/print-command';
import { exportZReportToExcel } from '@/lib/export-z-report';
import { cn } from '@/lib/utils';
import {
    Calendar, FileDown, Printer, BarChart3, Search, CreditCard, Package,
    X, Loader2, Receipt, Coins, AlertTriangle, Check, ChevronDown, ChevronRight,
    UtensilsCrossed, Bike, Pizza, Banknote, Euro, Zap, Smartphone, Landmark,
    Gift, Split, Shuffle, Eye, Trash2, Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/Badge';

export default function SalesHistoryPage() {
    const [sales, setSales] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [zReport, setZReport] = useState<ZReportData | null>(null);
    const [showZReport, setShowZReport] = useState(false);
    const [daySummary, setDaySummary] = useState<EndOfDaySummary | null>(null);
    const [showDaySummary, setShowDaySummary] = useState(false);

    // --- EXPANSIÓN DE FILAS ---
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    // --- ANULACIÓN ---
    const [voidTarget, setVoidTarget] = useState<any | null>(null);
    const [voidStep, setVoidStep] = useState<'reason' | 'pin'>('reason');
    const [voidReason, setVoidReason] = useState('');
    const [voidPin, setVoidPin] = useState('');
    const [voidPinError, setVoidPinError] = useState('');
    const [voidLoading, setVoidLoading] = useState(false);

    // --- FILTROS ---
    const [cancelledFilter, setCancelledFilter] = useState<'active' | 'all' | 'only'>('active');
    const [filterDate, setFilterDate] = useState(() => {
        // Default: today en Caracas
        return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });
    });
    const [filterSearch, setFilterSearch] = useState('');
    const [filterPaymentMethod, setFilterPaymentMethod] = useState('ALL');
    const [filterOrderType, setFilterOrderType] = useState('ALL');
    const [filterHasDiscount, setFilterHasDiscount] = useState(false);

    // Recargar datos cada vez que cambia la fecha seleccionada
    useEffect(() => { loadData(filterDate); }, [filterDate]);

    const loadData = async (date?: string) => {
        setIsLoading(true);
        const result = await getSalesHistoryAction(date || undefined);
        if (result.success && result.data) setSales(result.data as any[]);
        setIsLoading(false);
    };

    const toggleRow = (id: string) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleGenerateZReport = async () => {
        const result = await getDailyZReportAction(filterDate || undefined);
        if (result.success && result.data) { setZReport(result.data); setShowZReport(true); }
        else alert('Error generando reporte Z');
    };

    const handleDaySummary = async () => {
        const result = await getEndOfDaySummaryAction(filterDate || undefined);
        if (result.success && result.data) { setDaySummary(result.data); setShowDaySummary(true); }
        else alert('Error generando resumen de cierre');
    };

    const handleExportArqueo = async () => {
        const date = filterDate ? new Date(filterDate + 'T12:00:00') : new Date();
        const dateParam = date.toISOString().slice(0, 10);
        try {
            const res = await fetch(`/api/arqueo?date=${dateParam}`);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                alert(err.error || 'Error exportando arqueo');
                return;
            }
            const blob = await res.blob();
            const contentDisposition = res.headers.get('Content-Disposition');
            let fileName = `Arqueo_Caja_Shanklish_${dateParam}.xlsx`;
            if (contentDisposition) {
                const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;\s]+)/);
                if (utf8Match) fileName = decodeURIComponent(utf8Match[1]);
                else {
                    const simpleMatch = contentDisposition.match(/filename=["']?([^"';]+)/);
                    if (simpleMatch) fileName = simpleMatch[1].trim();
                }
            }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            alert('Error exportando arqueo');
        }
    };

    // ---- REIMPRESIÓN ----
    const handleReprint = (sale: any, e: React.MouseEvent) => {
        e.stopPropagation();
        const serviceFee = sale.orderType === 'RESTAURANT' && sale.serviceFeeIncluded ? (sale.total || 0) * 0.1 : 0;
        const itemsSubtotal = (sale.items || []).reduce((s: number, i: any) => s + (i.lineTotal || 0), 0);
        const deliveryFee = sale.orderType === 'DELIVERY' && sale.subtotal != null ? Math.max(0, sale.subtotal - itemsSubtotal) : undefined;
        const discountReason = (sale.discount || 0) > 0 ? 'Descuento aplicado' : undefined;
        printReceipt({
            orderNumber: sale.orderNumber,
            orderType: (sale.orderType || 'RESTAURANT') as 'RESTAURANT' | 'DELIVERY',
            date: sale.createdAt,
            cashierName: `${sale.createdBy?.firstName || 'Cajera'} ${sale.createdBy?.lastName || ''}`.trim(),
            customerName: sale.customerName || undefined,
            customerPhone: sale.customerPhone || undefined,
            customerAddress: sale.customerAddress || undefined,
            subtotal: sale.orderType === 'DELIVERY' && deliveryFee ? itemsSubtotal : (sale.subtotal ?? itemsSubtotal),
            discount: sale.discount ?? 0,
            discountReason,
            deliveryFee,
            total: sale.total,
            serviceFee,
            items: (sale.items || []).map((item: any) => ({
                name: item.itemName || item.name,
                quantity: item.quantity,
                unitPrice: item.unitPrice ?? (item.lineTotal / (item.quantity || 1)),
                total: item.lineTotal || item.total,
                modifiers: Array.isArray(item.modifiers) ? item.modifiers.map((m: any) => typeof m === 'string' ? m : m?.name) : []
            }))
        });
    };

    // ---- ANULACIÓN ----
    const openVoidModal = (sale: any, e: React.MouseEvent) => {
        e.stopPropagation();
        setVoidTarget(sale);
        setVoidStep('reason');
        setVoidReason('');
        setVoidPin('');
        setVoidPinError('');
    };

    const handleVoidPinConfirm = async () => {
        setVoidPinError('');
        setVoidLoading(true);
        const res = await validateManagerPinAction(voidPin);
        if (res.success && res.data) {
            await executeVoid(res.data.managerId, res.data.managerName);
        } else {
            setVoidPinError('PIN inválido o sin permisos suficientes');
            setVoidLoading(false);
        }
    };

    const executeVoid = async (managerId: string, managerName: string) => {
        if (!voidTarget) return;
        const orderIds = voidTarget._orderIds || [voidTarget.id];
        let lastError = '';
        for (const orderId of orderIds) {
            const res = await voidSalesOrderAction({
                orderId,
                voidReason,
                authorizedById: managerId,
                authorizedByName: managerName
            });
            if (!res.success) lastError = res.message || 'Error';
        }
        setVoidLoading(false);
        if (!lastError) {
            alert(`✅ ${orderIds.length > 1 ? 'Mesa anulada correctamente' : 'Orden anulada correctamente'}`);
            setVoidTarget(null);
            loadData();
        } else {
            alert(`❌ ${lastError}`);
        }
    };

    // ---- BADGES ----
    const getPaymentBadge = (method: string) => {
        const map: Record<string, { label: string; variant: 'ok' | 'info' | 'coral' | 'warn' | 'neutral' | 'navy'; Icon: typeof Banknote }> = {
            CASH:            { label: 'Cash $',        variant: 'ok',      Icon: Banknote },
            CASH_USD:        { label: 'Cash $',        variant: 'ok',      Icon: Banknote },
            CASH_EUR:        { label: 'Cash €',        variant: 'ok',      Icon: Euro },
            CARD:            { label: 'PDV Shanklish', variant: 'info',    Icon: CreditCard },
            BS_POS:          { label: 'PDV Shanklish', variant: 'info',    Icon: CreditCard },
            PDV_SHANKLISH:   { label: 'PDV Shanklish', variant: 'info',    Icon: CreditCard },
            PDV_SUPERFERRO:  { label: 'PDV Superferro', variant: 'navy',   Icon: CreditCard },
            ZELLE:           { label: 'Zelle',         variant: 'info',    Icon: Zap },
            MOBILE_PAY:      { label: 'Pago móvil',    variant: 'coral',   Icon: Smartphone },
            MOVIL_NG:        { label: 'Móvil NG',      variant: 'coral',   Icon: Smartphone },
            TRANSFER:        { label: 'Transfer',      variant: 'info',    Icon: Landmark },
            CASH_BS:         { label: 'Bs',            variant: 'warn',    Icon: Banknote },
            CORTESIA:        { label: 'Cortesía',      variant: 'coral',   Icon: Gift },
        };
        const m = map[method?.toUpperCase()];
        if (!m) return <Badge variant="neutral">{method || '-'}</Badge>;
        const { label, variant, Icon } = m;
        return <Badge variant={variant}><Icon className="h-3 w-3" strokeWidth={1.5} /> {label}</Badge>;
    };

    const formatMoney = (amount: number) => `$${(amount || 0).toFixed(2)}`;

    // ---- FILTRADO ----
    const clearAllFilters = () => {
        setFilterSearch('');
        setFilterPaymentMethod('ALL');
        setFilterOrderType('ALL');
        setFilterHasDiscount(false);
        setCancelledFilter('active');
    };

    const hasActiveFilters = filterSearch !== '' || filterPaymentMethod !== 'ALL' || filterOrderType !== 'ALL' || filterHasDiscount || cancelledFilter !== 'active';

    // La fecha ya se filtra en el servidor (getSalesHistoryAction). Aquí solo filtros adicionales.
    const allFilteredSales = sales.filter(s => {
        if (cancelledFilter === 'only') return s.status === 'CANCELLED';
        if (cancelledFilter === 'all') return true;
        return s.status !== 'CANCELLED'; // 'active' = hide cancelled
    });
    const filteredSales = allFilteredSales.filter(s => {
        // Búsqueda libre
        if (filterSearch.trim()) {
            const q = filterSearch.trim().toLowerCase();
            const matchesOrder = (s.orderNumber || '').toLowerCase().includes(q);
            const matchesCustomer = (s.customerName || '').toLowerCase().includes(q);
            const matchesPhone = (s.customerPhone || '').toLowerCase().includes(q);
            if (!matchesOrder && !matchesCustomer && !matchesPhone) return false;
        }
        // Método de pago
        if (filterPaymentMethod !== 'ALL') {
            const breakdown: { method: string }[] = s.paymentBreakdown || [];
            if (filterPaymentMethod === 'MIXED') {
                if (breakdown.length <= 1) return false;
            } else {
                const methodMatch =
                    breakdown.length > 0
                        ? breakdown.some(p => p.method?.toUpperCase() === filterPaymentMethod)
                        : (s.paymentMethod || '').toUpperCase() === filterPaymentMethod;
                if (!methodMatch) return false;
            }
        }
        // Tipo de orden
        if (filterOrderType === 'PROPINAS') {
            if ((s.customerName || '') !== 'PROPINA COLECTIVA') return false;
        } else if (filterOrderType === 'RESTAURANT') {
            // Mesa/Pickup: incluye RESTAURANT y PICKUP (propinas colectivas son PICKUP)
            const ot = (s.orderType || '').toUpperCase();
            if (ot !== 'RESTAURANT' && ot !== 'PICKUP') return false;
        } else if (filterOrderType !== 'ALL') {
            if ((s.orderType || '').toUpperCase() !== filterOrderType) return false;
        }
        // Con descuento
        if (filterHasDiscount && !(s.discount > 0)) return false;
        return true;
    });

    const shownCount = filteredSales.length;
    const totalCount = allFilteredSales.length;

    // Totales del filtro activo
    const filteredTotals = filteredSales.reduce(
        (acc, s) => {
            if (s.status === 'CANCELLED') return acc;
            acc.invoiced += s.totalFactura ?? s.total ?? 0;
            acc.collected += s.totalCobrado ?? s.total ?? 0;
            acc.discounts += s.discount ?? 0;
            return acc;
        },
        { invoiced: 0, collected: 0, discounts: 0 }
    );

    // Anulaciones del día (sobre el total del día, no sobre el filtro)
    const todayVoids = sales.filter(s => s.status === 'CANCELLED');
    const voidCount = todayVoids.length;
    const voidAmount = todayVoids.reduce((sum, s) => sum + (s.totalFactura ?? s.total ?? 0), 0);

    // Formatted date for display
    const displayDate = filterDate
        ? new Date(filterDate + 'T12:00:00').toLocaleDateString('es-VE', { day: '2-digit', month: 'numeric', year: 'numeric' })
        : '';

    if (isLoading) return (
        <div className="flex min-h-[60vh] items-center justify-center">
            <div className="text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-capsula-navy" strokeWidth={1.5} />
                <p className="mt-3 text-[13px] text-capsula-ink-muted">Cargando historial…</p>
            </div>
        </div>
    );

    return (
        <div className="mx-auto max-w-7xl animate-in p-6 text-capsula-ink">
            {/* HEADER */}
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-capsula-line pb-6">
                <div>
                    <div className="mb-2 text-[11px] uppercase tracking-[0.12em] text-capsula-ink-muted">Ventas</div>
                    <h1 className="font-heading text-[32px] leading-tight tracking-[-0.02em] text-capsula-navy-deep">
                        Historial de ventas
                    </h1>
                    <p className="mt-1 text-[13px] text-capsula-ink-soft">
                        Registro de transacciones y cierres
                        {' · '}
                        <span className="font-medium text-capsula-ink">{shownCount} de {totalCount} órdenes</span>
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 rounded-full border border-capsula-line bg-capsula-ivory-surface px-3 py-2">
                        <Calendar className="h-4 w-4 text-capsula-ink-muted" strokeWidth={1.5} />
                        <input
                            type="date"
                            value={filterDate}
                            onChange={e => setFilterDate(e.target.value)}
                            className="w-32 cursor-pointer bg-transparent font-mono text-[12.5px] text-capsula-ink outline-none"
                        />
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleExportArqueo}>
                        <FileDown className="h-4 w-4" strokeWidth={1.5} /> Exportar Excel
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleGenerateZReport} title={`Generar reporte Z para ${displayDate || 'hoy'}`}>
                        <Printer className="h-4 w-4" strokeWidth={1.5} /> Reporte "Z" {displayDate ? `· ${displayDate}` : '(hoy)'}
                    </Button>
                    <Button variant="primary" size="sm" onClick={handleDaySummary} title={`Resumen de cierre del día para ${displayDate || 'hoy'}`}>
                        <BarChart3 className="h-4 w-4" strokeWidth={1.5} /> Cierre del día {displayDate ? `· ${displayDate}` : '(hoy)'}
                    </Button>
                </div>
            </div>

            {/* ── BARRA DE FILTROS AVANZADOS ─────────────────────────────────── */}
            <div className="mb-4 flex flex-wrap items-end gap-3 rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-4">
                {/* Búsqueda libre */}
                <div className="min-w-[200px] flex-1">
                    <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Buscar</label>
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-capsula-ink-muted" strokeWidth={1.5} />
                        <input
                            type="text"
                            value={filterSearch}
                            onChange={e => setFilterSearch(e.target.value)}
                            placeholder="Orden #, cliente, teléfono…"
                            className="w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory py-2 pl-9 pr-3 text-[13px] text-capsula-ink outline-none placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep"
                        />
                    </div>
                </div>
                {/* Método de pago */}
                <div>
                    <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Método</label>
                    <select
                        value={filterPaymentMethod}
                        onChange={e => setFilterPaymentMethod(e.target.value)}
                        className="cursor-pointer rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory px-3 py-2 text-[13px] text-capsula-ink outline-none focus:border-capsula-navy-deep"
                    >
                        <option value="ALL">Todos</option>
                        <option value="CASH_USD">Cash $</option>
                        <option value="CASH_EUR">Cash €</option>
                        <option value="ZELLE">Zelle</option>
                        <option value="PDV_SHANKLISH">PDV Shanklish</option>
                        <option value="PDV_SUPERFERRO">PDV Superferro</option>
                        <option value="MOBILE_PAY">Pago Móvil</option>
                        <option value="MOVIL_NG">Móvil NG</option>
                        <option value="TRANSFER">Transferencia</option>
                        <option value="CASH_BS">Efectivo Bs</option>
                        <option value="CORTESIA">Cortesía</option>
                        <option value="MIXED">Pago Mixto</option>
                    </select>
                </div>
                {/* Tipo de orden */}
                <div>
                    <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Tipo</label>
                    <select
                        value={filterOrderType}
                        onChange={e => setFilterOrderType(e.target.value)}
                        className="cursor-pointer rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory px-3 py-2 text-[13px] text-capsula-ink outline-none focus:border-capsula-navy-deep"
                    >
                        <option value="ALL">Todos</option>
                        <option value="DELIVERY">Delivery</option>
                        <option value="RESTAURANT">Mesa / Pickup</option>
                        <option value="PEDIDOSYA">PedidosYA</option>
                        <option value="PROPINAS">Propinas</option>
                    </select>
                </div>
                {/* Con descuento */}
                <label className="flex cursor-pointer select-none items-center gap-2 rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory px-3 py-2 text-[13px] text-capsula-ink-soft transition-colors hover:border-capsula-navy-deep hover:text-capsula-ink">
                    <input
                        type="checkbox"
                        checked={filterHasDiscount}
                        onChange={e => setFilterHasDiscount(e.target.checked)}
                        className="rounded border-capsula-line text-capsula-navy-deep focus:ring-capsula-navy-deep"
                    />
                    <span className="font-medium">Con descuento</span>
                </label>
                {/* Estado / Anuladas */}
                <div className="flex overflow-hidden rounded-full border border-capsula-line text-[12px] font-medium">
                    {([
                        { value: 'active', label: 'Activas' },
                        { value: 'all',    label: 'Todas' },
                        { value: 'only',   label: 'Anuladas' },
                    ] as const).map(opt => {
                        const active = cancelledFilter === opt.value;
                        return (
                            <button
                                key={opt.value}
                                onClick={() => setCancelledFilter(opt.value)}
                                className={cn(
                                    "px-3 py-2 transition-colors",
                                    active
                                        ? opt.value === 'only'
                                            ? "bg-capsula-coral text-white"
                                            : "bg-capsula-navy-deep text-capsula-ivory"
                                        : "bg-capsula-ivory text-capsula-ink-muted hover:bg-capsula-ivory-alt",
                                )}
                            >
                                {opt.label}
                            </button>
                        );
                    })}
                </div>
                {/* Clear all */}
                {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                        <X className="h-3.5 w-3.5" strokeWidth={1.5} /> Limpiar filtros
                    </Button>
                )}
            </div>

            {/* ── RESUMEN DE RESULTADOS FILTRADOS ───────────────────────────── */}
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-4 py-3 shadow-cap-soft">
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Órdenes</p>
                    <p className="font-mono text-[22px] font-semibold text-capsula-ink">{shownCount}</p>
                    {shownCount !== totalCount && <p className="text-[11px] text-capsula-ink-muted">de {totalCount} total</p>}
                </div>
                <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-4 py-3 shadow-cap-soft">
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Facturado</p>
                    <p className="font-mono text-[22px] font-semibold text-capsula-navy-deep">{formatMoney(filteredTotals.invoiced)}</p>
                </div>
                <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-4 py-3 shadow-cap-soft">
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Cobrado</p>
                    <p className="font-mono text-[22px] font-semibold text-[#2F6B4E]">{formatMoney(filteredTotals.collected)}</p>
                </div>
                <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-4 py-3 shadow-cap-soft">
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Descuentos</p>
                    <p className={cn("font-mono text-[22px] font-semibold", filteredTotals.discounts > 0 ? "text-capsula-coral" : "text-capsula-ink-faint")}>
                        {filteredTotals.discounts > 0 ? `-${formatMoney(filteredTotals.discounts)}` : '$0.00'}
                    </p>
                </div>
                <div className={cn(
                    "rounded-[var(--radius)] border px-4 py-3 shadow-cap-soft",
                    voidCount > 0 ? "border-capsula-coral/30 bg-capsula-coral-subtle/40" : "border-capsula-line bg-capsula-ivory-surface",
                )}>
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Anuladas hoy</p>
                    <p className={cn("font-mono text-[22px] font-semibold", voidCount > 0 ? "text-capsula-coral" : "text-capsula-ink-faint")}>{voidCount}</p>
                    {voidAmount > 0 && <p className="font-mono text-[11px] font-medium text-capsula-coral/80">{formatMoney(voidAmount)}</p>}
                </div>
            </div>

            {/* TABLA */}
            <div className="overflow-x-auto rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface shadow-cap-soft">
                <table className="w-full min-w-[900px] border-collapse text-left">
                    <thead>
                        <tr className="border-b border-capsula-line bg-capsula-ivory">
                            <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Orden #</th>
                            <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Fecha</th>
                            <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Hora</th>
                            <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Cliente</th>
                            <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Método</th>
                            <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Total factura</th>
                            <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Cobrado</th>
                            <th className="px-4 py-3 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">10% Serv.</th>
                            <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Descuento / Auth</th>
                            <th className="px-4 py-3 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Ítems</th>
                            <th className="px-4 py-3 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="text-[13px]">
                        {filteredSales.length === 0 && (
                            <tr>
                                <td colSpan={11} className="p-10 text-center text-[13px] text-capsula-ink-muted">
                                    No hay ventas en este período.
                                </td>
                            </tr>
                        )}
                        {filteredSales.map(sale => {
                            const isVoided = sale.status === 'CANCELLED';
                            const isPropina = (sale.customerName || '') === 'PROPINA COLECTIVA';
                            const isExpanded = expandedRows.has(sale.id);
                            const itemCount = (sale.items || []).length;
                            const itemsSubtotal = (sale.items || []).reduce((s: number, i: any) => s + (i.lineTotal || 0), 0);
                            const servicioAmount = sale.servicioAmount ?? (sale.orderType === 'RESTAURANT' && sale.serviceFeeIncluded ? (sale.total || 0) * 0.1 : 0);
                            const totalFactura = sale.totalFactura ?? sale.total;
                            const totalCobrado = sale.totalCobrado ?? sale.total;
                            const propina = sale.propina ?? 0;
                            const saleDate = sale.createdAt
                                ? new Date(sale.createdAt).toLocaleDateString('es-VE', { timeZone: 'America/Caracas', day: '2-digit', month: 'numeric', year: 'numeric' })
                                : '-';
                            const saleTime = sale.createdAt
                                ? new Date(sale.createdAt).toLocaleTimeString('es-VE', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit' })
                                : '-';

                            return (
                                <React.Fragment key={sale.id}>
                                    <tr
                                        onClick={() => itemCount > 0 && toggleRow(sale.id)}
                                        className={cn(
                                            "border-b border-capsula-line transition-colors",
                                            isVoided ? "bg-capsula-coral-subtle/20 opacity-60" :
                                            isPropina ? "bg-[#F3EAD6]/40 hover:bg-[#F3EAD6]/60" :
                                            "hover:bg-capsula-ivory",
                                            itemCount > 0 && "cursor-pointer",
                                        )}
                                    >
                                        {/* ORDEN # */}
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <span className={cn(
                                                    "font-mono text-[12.5px] font-semibold",
                                                    isVoided ? "text-capsula-coral line-through" :
                                                    isPropina ? "text-[#946A1C]" :
                                                    "text-capsula-navy-deep",
                                                )}>
                                                    {sale.orderNumber}
                                                </span>
                                                {isPropina && (
                                                    <Badge variant="warn">
                                                        <Coins className="h-3 w-3" strokeWidth={1.5} /> Propina
                                                    </Badge>
                                                )}
                                                {isVoided && <Badge variant="danger">Anulada</Badge>}
                                            </div>
                                            {sale._consolidated && sale.orderNumbers?.length > 1 && (
                                                <div className="mt-0.5 font-mono text-[10px] text-capsula-ink-muted" title={sale.orderNumbers.join(', ')}>
                                                    {sale.orderNumbers.length} tandas
                                                </div>
                                            )}
                                            {isVoided && sale.voidReason && (
                                                <div className="mt-0.5 max-w-[160px] truncate text-[10px] text-capsula-coral/80" title={sale.voidReason}>
                                                    {sale.voidReason}
                                                </div>
                                            )}
                                        </td>
                                        {/* FECHA */}
                                        <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-capsula-ink-muted">
                                            {saleDate}
                                            {isVoided && sale.voidedAt && (
                                                <div className="mt-0.5 inline-flex items-center gap-0.5 text-capsula-coral/70">
                                                    <X className="h-3 w-3" strokeWidth={1.5} />
                                                    {new Date(sale.voidedAt).toLocaleDateString('es-VE', { timeZone: 'America/Caracas', day: '2-digit', month: 'numeric' })}
                                                </div>
                                            )}
                                        </td>
                                        {/* HORA */}
                                        <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-capsula-ink-muted">
                                            {saleTime}
                                        </td>
                                        {/* CLIENTE */}
                                        <td className="max-w-[120px] truncate px-4 py-3 font-medium text-capsula-ink">
                                            {sale.customerName || 'Gral.'}
                                        </td>
                                        {/* MÉTODO */}
                                        <td className="px-4 py-3">
                                            {(sale.paymentBreakdown || []).length > 1 ? (
                                                <div className="flex flex-wrap gap-1" title={(sale.paymentBreakdown || []).map((p: { method: string; amount: number }) => `${p.method}: $${p.amount.toFixed(2)}`).join(' | ')}>
                                                    {(sale.paymentBreakdown || []).map((p: { method: string; amount: number }, i: number) => (
                                                        <span key={i}>{getPaymentBadge(p.method)}</span>
                                                    ))}
                                                </div>
                                            ) : (
                                                getPaymentBadge(sale.paymentMethod)
                                            )}
                                        </td>
                                        {/* TOTAL FACTURA */}
                                        <td className="px-4 py-3 text-right font-mono text-capsula-ink-soft">
                                            {isPropina ? <span className="text-capsula-ink-faint">—</span> : formatMoney(totalFactura)}
                                        </td>
                                        {/* COBRADO */}
                                        <td className="px-4 py-3 text-right font-mono font-semibold">
                                            {isPropina ? (
                                                <span className="text-[#946A1C]">{formatMoney(totalCobrado)}</span>
                                            ) : (
                                                <>
                                                    <span className="text-capsula-ink">{formatMoney(totalCobrado)}</span>
                                                    {propina > 0.01 && (
                                                        <div className="text-right text-[10px] font-normal text-[#946A1C]">
                                                            +{formatMoney(propina)} propina
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </td>
                                        {/* 10% SERV */}
                                        <td className="px-4 py-3 text-center">
                                            {sale.orderType === 'RESTAURANT' ? (
                                                sale.serviceFeeIncluded ? (
                                                    <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[#2F6B4E]">
                                                        <Check className="h-3 w-3" strokeWidth={2} /> Sí
                                                    </span>
                                                ) : (
                                                    <span className="text-[11px] text-capsula-ink-faint">No</span>
                                                )
                                            ) : (
                                                <span className="text-capsula-ink-faint">—</span>
                                            )}
                                        </td>
                                        {/* DESCUENTO / AUTH */}
                                        <td className="px-4 py-3">
                                            {sale.discount > 0 ? (
                                                <div className="flex flex-col gap-0.5">
                                                    {sale.discountType === 'DIVISAS_33' && (
                                                        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-capsula-navy">
                                                            <Banknote className="h-3 w-3" strokeWidth={1.5} /> -{formatMoney(sale.discount)}
                                                        </span>
                                                    )}
                                                    {(sale.discountType === 'CORTESIA_100' || sale.discountType === 'CORTESIA' || sale.discountType === 'CORTESIA_PERCENT') && (
                                                        <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-capsula-coral">
                                                            <Gift className="h-3 w-3" strokeWidth={1.5} /> -{formatMoney(sale.discount)}
                                                        </span>
                                                    )}
                                                    {sale.authorizedById && (
                                                        <span className="inline-flex w-fit items-center gap-0.5 rounded border border-capsula-line bg-capsula-ivory px-1 text-[10px] text-[#2F6B4E]">
                                                            <Check className="h-2.5 w-2.5" strokeWidth={2} /> {sale.authorizedBy?.firstName}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : <span className="text-capsula-ink-faint">—</span>}
                                        </td>
                                        {/* ÍTEMS */}
                                        <td className="px-4 py-3 text-center">
                                            {itemCount > 0 ? (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); toggleRow(sale.id); }}
                                                    className="inline-flex items-center gap-1 rounded-full border border-capsula-line bg-capsula-ivory px-2.5 py-1 text-[11px] font-medium text-capsula-ink transition-colors hover:bg-capsula-ivory-alt"
                                                >
                                                    {itemCount}
                                                    <ChevronDown className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-180")} strokeWidth={1.5} />
                                                </button>
                                            ) : (
                                                <span className="text-capsula-ink-faint">—</span>
                                            )}
                                        </td>
                                        {/* ACCIONES */}
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <button
                                                    onClick={(e) => handleReprint(sale, e)}
                                                    title="Reimprimir factura"
                                                    className="inline-flex items-center gap-1 rounded-md border border-capsula-line bg-capsula-ivory-surface px-2 py-1 text-[11px] font-medium text-capsula-ink-soft transition-colors hover:border-capsula-navy-deep/40 hover:text-capsula-ink"
                                                >
                                                    <Printer className="h-3 w-3" strokeWidth={1.5} /> Imprimir
                                                </button>
                                                {!isVoided && (
                                                    <button
                                                        onClick={(e) => openVoidModal(sale, e)}
                                                        title="Anular venta"
                                                        className="inline-flex items-center gap-1 rounded-md border border-capsula-coral/30 bg-capsula-coral-subtle/50 px-2 py-1 text-[11px] font-medium text-capsula-coral transition-colors hover:bg-capsula-coral hover:text-white"
                                                    >
                                                        Anular
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                    {/* FILA EXPANDIDA - ÍTEMS */}
                                    {isExpanded && itemCount > 0 && (
                                        <tr className="bg-capsula-ivory">
                                            <td colSpan={11} className="px-6 py-4">
                                                {/* Tabla de productos */}
                                                <div className="mb-3 overflow-hidden rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface">
                                                    <table className="w-full text-[12px]">
                                                        <thead>
                                                            <tr className="border-b border-capsula-line bg-capsula-ivory">
                                                                <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Producto</th>
                                                                <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Cant.</th>
                                                                <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">P. unit.</th>
                                                                <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Subtotal</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {(sale.items || []).map((item: any, idx: number) => {
                                                                const unitPrice = item.unitPrice ?? (item.lineTotal / (item.quantity || 1));
                                                                const modifiers = Array.isArray(item.modifiers)
                                                                    ? item.modifiers.map((m: any) => typeof m === 'string' ? m : m?.name).filter(Boolean)
                                                                    : [];
                                                                return (
                                                                    <tr key={idx} className="border-b border-capsula-line last:border-b-0 hover:bg-capsula-ivory">
                                                                        <td className="px-3 py-2 text-capsula-ink">
                                                                            {item.itemName || item.name}
                                                                            {modifiers.length > 0 && (
                                                                                <div className="text-[10px] text-capsula-ink-muted">+ {modifiers.join(', ')}</div>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-3 py-2 text-center font-mono text-capsula-ink-soft">×{item.quantity}</td>
                                                                        <td className="px-3 py-2 text-right font-mono text-capsula-ink-muted">${unitPrice.toFixed(2)}</td>
                                                                        <td className="px-3 py-2 text-right font-mono font-semibold text-capsula-ink">${(item.lineTotal || 0).toFixed(2)}</td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>

                                                {/* Resumen de totales */}
                                                <div className="flex flex-wrap gap-3 font-mono text-[11px] text-capsula-ink-muted">
                                                    <span>Productos: <span className="font-semibold text-capsula-ink">{formatMoney(itemsSubtotal)}</span></span>
                                                    {sale.orderType === 'RESTAURANT' && sale.serviceFeeIncluded && servicioAmount > 0 && (
                                                        <span>10% Servicio: <span className="font-semibold text-[#2F6B4E]">+{formatMoney(servicioAmount)}</span></span>
                                                    )}
                                                    {(sale.discount || 0) > 0 && (
                                                        <span>Descuento: <span className="font-semibold text-capsula-coral">-{formatMoney(sale.discount)}</span></span>
                                                    )}
                                                    <span>Total factura: <span className="font-semibold text-capsula-ink">{formatMoney(totalFactura)}</span></span>
                                                    <span>Cobrado: <span className="font-semibold text-capsula-navy-deep">{formatMoney(totalCobrado)}</span></span>
                                                    {propina > 0.01 && (
                                                        <span>Propina/excedente: <span className="font-semibold text-[#946A1C]">+{formatMoney(propina)}</span></span>
                                                    )}
                                                </div>

                                                {/* Desglose de pagos */}
                                                {(sale.paymentBreakdown || []).length > 0 && (
                                                    <div className="mt-2 text-[11px]">
                                                        <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Desglose de pagos: </span>
                                                        {(sale.paymentBreakdown || []).map((p: { method: string; amount: number; amountBS?: number; exchangeRate?: number; label?: string }, i: number) => (
                                                            <span key={i} className="mr-3 inline-flex items-center gap-1">
                                                                {getPaymentBadge(p.method)}
                                                                {p.label && <span className="ml-1 text-capsula-ink-muted">{p.label}</span>}
                                                                <span className="font-mono font-semibold text-capsula-ink">{formatMoney(p.amount)}</span>
                                                                {p.amountBS != null && p.amountBS > 0 && (
                                                                    <span className="font-mono text-[10px] text-[#946A1C]">
                                                                        · Bs{p.amountBS.toLocaleString('es-VE', { maximumFractionDigits: 0 })}
                                                                        {p.exchangeRate ? ` @${p.exchangeRate.toFixed(0)}` : ''}
                                                                    </span>
                                                                )}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Detalle de anulación */}
                                                {isVoided && (sale.voidReason || sale.voidedBy || sale.voidedAt) && (
                                                    <div className="mt-3 space-y-1 rounded-[var(--radius)] border border-capsula-coral/30 bg-capsula-coral-subtle/50 px-3 py-2 text-[11px]">
                                                        <div className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.12em] text-capsula-coral">
                                                            <AlertTriangle className="h-3 w-3" strokeWidth={1.5} /> Detalle de anulación
                                                        </div>
                                                        {sale.voidedBy && (
                                                            <div className="flex gap-2 text-capsula-ink-soft">
                                                                <span className="text-capsula-ink-muted">Anulado por:</span>
                                                                <span className="font-semibold text-capsula-coral">{sale.voidedBy.firstName} {sale.voidedBy.lastName}</span>
                                                            </div>
                                                        )}
                                                        {sale.voidedAt && (
                                                            <div className="flex gap-2 text-capsula-ink-soft">
                                                                <span className="text-capsula-ink-muted">Fecha anulación:</span>
                                                                <span className="font-mono">{new Date(sale.voidedAt).toLocaleString('es-VE', { timeZone: 'America/Caracas', day: '2-digit', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                            </div>
                                                        )}
                                                        {sale.voidReason && (
                                                            <div className="flex gap-2 text-capsula-ink-soft">
                                                                <span className="shrink-0 text-capsula-ink-muted">Motivo:</span>
                                                                <span className="text-capsula-coral/90">{sale.voidReason}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* ================================================================ */}
            {/* MODAL REPORTE Z                                                    */}
            {/* ================================================================ */}
            {showZReport && zReport && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-capsula-navy-deep/40 p-4 backdrop-blur-sm">
                    <div className="relative w-full max-w-sm rounded-[var(--radius)] bg-white p-8 font-mono text-black shadow-[0_20px_60px_-20px_rgba(11,23,39,0.35)]">
                        <button
                            onClick={() => setShowZReport(false)}
                            className="no-print absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-capsula-coral"
                        >
                            <X className="h-4 w-4" strokeWidth={1.5} />
                        </button>
                        <div className="mb-6 border-b-2 border-dashed border-black pb-4 text-center">
                            <h2 className="text-[22px] font-bold tracking-[-0.01em]">REPORTE Z</h2>
                            <p className="text-[12px]">SHANKLISH CARACAS</p>
                            <p className="text-[12px]">{new Date().toLocaleString()}</p>
                            <p className="mt-1 text-[12px] font-bold">CIERRE DE CAJA DIARIO</p>
                        </div>
                        {/* ── VENTAS ── */}
                        <div className="mb-4 space-y-1 border-b-2 border-dashed border-black pb-4">
                            <div className="flex justify-between"><span>VENTAS BRUTAS</span><span>{formatMoney(zReport.grossTotal)}</span></div>
                            {zReport.totalDiscounts > 0 && (<>
                                <div className="flex justify-between text-red-700"><span>(-) DESCUENTOS</span><span>-{formatMoney(zReport.totalDiscounts)}</span></div>
                                {zReport.discountBreakdown.divisas > 0 && (
                                    <div className="flex justify-between pl-4 text-[11px] text-gray-600"><span>Divisas (33%)</span><span>-{formatMoney(zReport.discountBreakdown.divisas)}</span></div>
                                )}
                                {zReport.discountBreakdown.cortesias > 0 && (
                                    <div className="flex justify-between pl-4 text-[11px] text-gray-600"><span>Cortesías</span><span>-{formatMoney(zReport.discountBreakdown.cortesias)}</span></div>
                                )}
                                {zReport.discountBreakdown.other > 0 && (
                                    <div className="flex justify-between pl-4 text-[11px] text-gray-600"><span>Otros</span><span>-{formatMoney(zReport.discountBreakdown.other)}</span></div>
                                )}
                            </>)}
                            <div className="mt-1 flex justify-between border-t border-gray-300 pt-1 font-bold text-[13px]"><span>VENTA NETA</span><span>{formatMoney(zReport.netTotal)}</span></div>
                            {zReport.totalServiceFee > 0 && (
                                <div className="flex justify-between text-blue-800"><span>(+) SERVICIO 10%</span><span>+{formatMoney(zReport.totalServiceFee)}</span></div>
                            )}
                            {zReport.totalTips > 0 && (
                                <div className="flex justify-between text-green-800"><span>(+) PROPINAS{zReport.tipCount > 0 ? ` (${zReport.tipCount})` : ''}</span><span>+{formatMoney(zReport.totalTips)}</span></div>
                            )}
                            <div className="mt-2 flex justify-between border-t-2 border-black pt-2 text-[18px] font-bold"><span>TOTAL COBRADO</span><span>{formatMoney(zReport.totalCollected)}</span></div>
                        </div>

                        {/* ── ARQUEO DE CAJA ── */}
                        <div className="mb-4 border-b-2 border-dashed border-black pb-4">
                            <h3 className="mb-2 font-bold underline">ARQUEO DE CAJA</h3>
                            <div className="space-y-0.5 text-[12px]">
                                {zReport.paymentBreakdown.cash > 0 && <div className="flex justify-between"><span>Efectivo USD</span><span className="font-bold">{formatMoney(zReport.paymentBreakdown.cash)}</span></div>}
                                {zReport.paymentBreakdown.zelle > 0 && <div className="flex justify-between"><span>Zelle</span><span className="font-bold">{formatMoney(zReport.paymentBreakdown.zelle)}</span></div>}
                                {zReport.paymentBreakdown.card > 0 && <div className="flex justify-between"><span>Punto PDV</span><span className="font-bold">{formatMoney(zReport.paymentBreakdown.card)}</span></div>}
                                {zReport.paymentBreakdown.mobile > 0 && <div className="flex justify-between"><span>Pago Móvil</span><span className="font-bold">{formatMoney(zReport.paymentBreakdown.mobile)}</span></div>}
                                {zReport.paymentBreakdown.transfer > 0 && <div className="flex justify-between"><span>Transferencia</span><span className="font-bold">{formatMoney(zReport.paymentBreakdown.transfer)}</span></div>}
                                {zReport.paymentBreakdown.external > 0 && <div className="flex justify-between"><span>PedidosYA / Externo</span><span className="font-bold">{formatMoney(zReport.paymentBreakdown.external)}</span></div>}
                                {zReport.paymentBreakdown.other > 0 && <div className="flex justify-between text-gray-600"><span>Otros</span><span>{formatMoney(zReport.paymentBreakdown.other)}</span></div>}
                            </div>
                        </div>

                        {/* ── PEDIDOS POR CANAL ── */}
                        <div className="mb-4 border-b-2 border-dashed border-black pb-4 text-[12px]">
                            <h3 className="mb-2 font-bold underline">PEDIDOS POR CANAL</h3>
                            <div className="space-y-0.5">
                                {zReport.ordersByType.restaurant > 0 && <div className="flex justify-between"><span>Restaurante / Mesas</span><span>{zReport.ordersByType.restaurant}</span></div>}
                                {zReport.ordersByType.pickup > 0 && <div className="flex justify-between"><span>Pickup / Mostrador</span><span>{zReport.ordersByType.pickup}</span></div>}
                                {zReport.ordersByType.delivery > 0 && <div className="flex justify-between"><span>Delivery</span><span>{zReport.ordersByType.delivery}</span></div>}
                                {zReport.ordersByType.pedidosya > 0 && <div className="flex justify-between"><span>PedidosYA</span><span>{zReport.ordersByType.pedidosya}</span></div>}
                                {zReport.ordersByType.wink > 0 && <div className="flex justify-between"><span>Wink</span><span>{zReport.ordersByType.wink}</span></div>}
                                {zReport.ordersByType.evento > 0 && <div className="flex justify-between"><span>Evento</span><span>{zReport.ordersByType.evento}</span></div>}
                                {zReport.ordersByType.tablePong > 0 && <div className="flex justify-between"><span>Table Pong</span><span>{zReport.ordersByType.tablePong}</span></div>}
                            </div>
                        </div>

                        <div className="pt-2 text-center text-[11px] text-gray-600">
                            <p className="font-bold">Total transacciones: {zReport.totalOrders}</p>
                        </div>
                        <div className="no-print mt-6 flex gap-2">
                            <Button variant="ghost" onClick={() => exportZReportToExcel(zReport)} className="flex-1">
                                <FileDown className="h-4 w-4" strokeWidth={1.5} /> Exportar a Excel
                            </Button>
                            <Button variant="primary" onClick={() => window.print()} className="flex-1">
                                <Printer className="h-4 w-4" strokeWidth={1.5} /> Imprimir
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ================================================================ */}
            {/* MODAL CIERRE DEL DÍA                                               */}
            {/* ================================================================ */}
            {showDaySummary && daySummary && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-capsula-navy-deep/40 p-4 backdrop-blur-sm">
                    <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-6 shadow-[0_20px_60px_-20px_rgba(11,23,39,0.35)]">
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <h2 className="inline-flex items-center gap-2 font-heading text-[22px] leading-tight tracking-[-0.01em] text-capsula-navy-deep">
                                    <BarChart3 className="h-5 w-5 text-capsula-coral" strokeWidth={1.5} />
                                    Resumen de cierre del día
                                </h2>
                                <p className="mt-0.5 font-mono text-[12px] text-capsula-ink-muted">{daySummary.date}</p>
                            </div>
                            <button
                                onClick={() => setShowDaySummary(false)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-capsula-ink-muted transition-colors hover:bg-capsula-ivory-alt hover:text-capsula-ink"
                            >
                                <X className="h-4 w-4" strokeWidth={1.5} />
                            </button>
                        </div>

                        {/* Ventas por canal */}
                        <div className="mb-4 rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory p-4">
                            <h3 className="mb-3 text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Ventas por canal</h3>
                            <div className="space-y-1.5">
                                {([
                                    { key: 'restaurant', label: 'Restaurante / Mesas' },
                                    { key: 'delivery',   label: 'Delivery' },
                                    { key: 'pickup',     label: 'Pickup / Mostrador' },
                                    { key: 'pedidosya',  label: 'PedidosYA' },
                                    { key: 'wink',       label: 'Wink' },
                                    { key: 'evento',     label: 'Evento' },
                                    { key: 'tablePong',  label: 'Table Pong' },
                                ] as { key: keyof typeof daySummary.byChannel; label: string }[])
                                    .filter(r => daySummary.byChannel[r.key] > 0 || daySummary.countByChannel[r.key] > 0)
                                    .map(r => (
                                        <div key={r.key} className="flex items-center justify-between text-[13px]">
                                            <span className="text-capsula-ink-soft">
                                                {r.label} <span className="text-[11px] text-capsula-ink-muted">({daySummary.countByChannel[r.key]})</span>
                                            </span>
                                            <span className="font-mono font-semibold text-capsula-ink">${daySummary.byChannel[r.key].toFixed(2)}</span>
                                        </div>
                                    ))
                                }
                            </div>
                        </div>

                        {/* Totales */}
                        <div className="mb-4 rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory p-4">
                            <h3 className="mb-3 text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Totales</h3>
                            <div className="space-y-1.5 text-[13px]">
                                {daySummary.totalDiscounts > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-capsula-ink-muted">Descuentos:</span>
                                        <span className="font-mono text-capsula-coral">-${daySummary.totalDiscounts.toFixed(2)}</span>
                                    </div>
                                )}
                                {daySummary.totalServiceFee > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-capsula-ink-muted">10% Servicio:</span>
                                        <span className="font-mono text-[#2F6B4E]">+${daySummary.totalServiceFee.toFixed(2)}</span>
                                    </div>
                                )}
                                {daySummary.propinas > 0 && (
                                    <div className="flex justify-between">
                                        <span className="inline-flex items-center gap-1 text-capsula-ink-muted">
                                            <Coins className="h-3 w-3" strokeWidth={1.5} /> Propinas{daySummary.propinaCount > 0 ? ` (${daySummary.propinaCount})` : ''}:
                                        </span>
                                        <span className="font-mono text-[#946A1C]">+${daySummary.propinas.toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="flex items-baseline justify-between border-t border-capsula-line pt-2">
                                    <span className="font-medium text-capsula-ink">Total cobrado:</span>
                                    <span className="font-mono text-[20px] font-semibold text-capsula-navy-deep">${daySummary.totalUSD.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Divisas vs Bs */}
                        <div className="mb-4 rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory p-4">
                            <h3 className="mb-3 text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Desglose por moneda</h3>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-[13px]">
                                    <span className="text-capsula-ink-soft">Divisas (Cash / Zelle)</span>
                                    <div className="text-right">
                                        <span className="font-mono font-semibold text-capsula-navy-deep">${daySummary.receivedInDivisas.toFixed(2)}</span>
                                        <span className="ml-2 text-[11px] text-capsula-ink-muted">{daySummary.pctDivisas.toFixed(1)}%</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between text-[13px]">
                                    <span className="text-capsula-ink-soft">Bolívares (PDV / Móvil)</span>
                                    <div className="text-right">
                                        <span className="font-mono font-semibold text-capsula-coral">${daySummary.receivedInBs.toFixed(2)}</span>
                                        <span className="ml-2 text-[11px] text-capsula-ink-muted">{daySummary.pctBs.toFixed(1)}%</span>
                                    </div>
                                </div>
                                {/* Progress bar */}
                                <div className="mt-1 h-2 overflow-hidden rounded-full bg-capsula-line">
                                    <div className="h-full rounded-full bg-capsula-navy-deep" style={{ width: `${daySummary.pctDivisas}%` }} />
                                </div>
                                <div className="flex justify-between text-[10px] text-capsula-ink-muted">
                                    <span>Divisas {daySummary.pctDivisas.toFixed(0)}%</span>
                                    <span>Bs {daySummary.pctBs.toFixed(0)}%</span>
                                </div>
                            </div>
                        </div>

                        {/* Facturas */}
                        <div className="mb-4 rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory p-4">
                            <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Facturas</h3>
                            <div className="flex gap-6 text-[13px]">
                                <div>
                                    <span className="text-capsula-ink-muted">Procesadas: </span>
                                    <span className="font-mono font-semibold text-capsula-ink">{daySummary.totalInvoices}</span>
                                </div>
                                {daySummary.invoicesCancelled > 0 && (
                                    <div>
                                        <span className="text-capsula-ink-muted">Anuladas: </span>
                                        <span className="font-mono font-semibold text-capsula-coral">{daySummary.invoicesCancelled}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <Button
                            variant="primary"
                            size="lg"
                            onClick={() => printEndOfDaySummary(daySummary)}
                            className="w-full"
                        >
                            <Printer className="h-4 w-4" strokeWidth={1.5} /> Imprimir resumen
                        </Button>
                    </div>
                </div>
            )}

            {/* ================================================================ */}
            {/* MODAL ANULACIÓN                                                    */}
            {/* ================================================================ */}
            {voidTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-capsula-navy-deep/40 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-[var(--radius)] border border-capsula-coral/30 bg-capsula-ivory-surface p-6 shadow-[0_20px_60px_-20px_rgba(11,23,39,0.35)]">
                        <div className="mb-5 flex items-center justify-between">
                            <div>
                                <h2 className="inline-flex items-center gap-2 font-heading text-[20px] leading-tight tracking-[-0.01em] text-capsula-coral">
                                    <Trash2 className="h-5 w-5" strokeWidth={1.5} />
                                    Anular venta
                                </h2>
                                <p className="mt-0.5 font-mono text-[12px] text-capsula-ink-muted">
                                    {voidTarget.orderNumber} — {formatMoney(voidTarget.totalCobrado ?? voidTarget.total)}
                                </p>
                            </div>
                            <button
                                onClick={() => setVoidTarget(null)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-capsula-ink-muted transition-colors hover:bg-capsula-ivory-alt hover:text-capsula-ink"
                            >
                                <X className="h-4 w-4" strokeWidth={1.5} />
                            </button>
                        </div>

                        <div className="mb-5 space-y-1 rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory p-4 text-[13px]">
                            <div className="flex justify-between text-capsula-ink-soft">
                                <span className="text-capsula-ink-muted">Cliente:</span>
                                <span className="font-medium text-capsula-ink">{voidTarget.customerName || 'Cliente general'}</span>
                            </div>
                            <div className="flex justify-between text-capsula-ink-soft">
                                <span className="text-capsula-ink-muted">Cajera:</span>
                                <span className="font-medium text-capsula-ink">{voidTarget.createdBy?.firstName || '—'}</span>
                            </div>
                            {voidTarget.authorizedById && (
                                <div className="flex justify-between text-capsula-ink-soft">
                                    <span className="text-capsula-ink-muted">Autorizado por:</span>
                                    <span className="font-medium text-capsula-ink">{voidTarget.authorizedBy?.firstName || voidTarget.authorizedByName || '—'}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-capsula-ink-soft">
                                <span className="text-capsula-ink-muted">Ítems:</span>
                                <span className="font-medium text-capsula-ink">{(voidTarget.items || []).length} productos</span>
                            </div>
                            <div className="flex items-baseline justify-between border-t border-capsula-line pt-1">
                                <span className="font-medium text-capsula-ink">Total cobrado:</span>
                                <span className="font-mono text-[16px] font-semibold text-capsula-navy-deep">{formatMoney(voidTarget.totalCobrado ?? voidTarget.total)}</span>
                            </div>
                        </div>

                        {voidStep === 'reason' && (
                            <>
                                <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">
                                    Motivo de la anulación <span className="text-capsula-coral">*</span>
                                </label>
                                <textarea
                                    value={voidReason}
                                    onChange={e => setVoidReason(e.target.value)}
                                    placeholder="Ej: Error de facturación, cliente solicitó cambio de mesa…"
                                    rows={3}
                                    className="mb-5 w-full resize-none rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2.5 text-[13px] text-capsula-ink outline-none placeholder:text-capsula-ink-muted focus:border-capsula-coral"
                                />
                                <div className="flex gap-2">
                                    <Button variant="ghost" onClick={() => setVoidTarget(null)} className="flex-1">
                                        Cancelar
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        onClick={() => setVoidStep('pin')}
                                        disabled={!voidReason.trim()}
                                        className="flex-1"
                                    >
                                        Continuar <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
                                    </Button>
                                </div>
                            </>
                        )}

                        {voidStep === 'pin' && (
                            <>
                                <div className="mb-4 inline-flex items-start gap-2 rounded-[var(--radius)] border border-[#E8D9B8] bg-[#F3EAD6] p-3 text-[12px] leading-relaxed text-[#946A1C]">
                                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                                    <span>Requiere PIN de Gerente, Auditor o Dueño. El inventario se reintegrará automáticamente.</span>
                                </div>
                                <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">
                                    PIN de autorización
                                </label>
                                <input
                                    type="password"
                                    value={voidPin}
                                    onChange={e => { setVoidPin(e.target.value); setVoidPinError(''); }}
                                    onKeyDown={e => e.key === 'Enter' && voidPin && handleVoidPinConfirm()}
                                    placeholder="••••"
                                    maxLength={8}
                                    autoFocus
                                    className="mb-1 w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-3 text-center font-mono text-[24px] tracking-[0.3em] text-capsula-navy-deep outline-none focus:border-capsula-coral"
                                />
                                {voidPinError && (
                                    <p className="mb-3 inline-flex w-full items-center justify-center gap-1 text-center text-[11px] font-medium text-capsula-coral">
                                        <AlertTriangle className="h-3 w-3" strokeWidth={1.5} /> {voidPinError}
                                    </p>
                                )}
                                <div className="mt-4 flex gap-2">
                                    <Button
                                        variant="ghost"
                                        onClick={() => { setVoidStep('reason'); setVoidPin(''); setVoidPinError(''); }}
                                        className="flex-1"
                                    >
                                        <ChevronRight className="h-4 w-4 rotate-180" strokeWidth={1.5} /> Volver
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        onClick={handleVoidPinConfirm}
                                        disabled={!voidPin || voidLoading}
                                        isLoading={voidLoading}
                                        className="flex-1"
                                    >
                                        {voidLoading ? 'Procesando…' : 'Autorizar anulación'}
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
