'use client';

import { useState, useEffect } from 'react';
import { Calendar, Download, Printer, BarChart3, Search, FileX2, X as XIcon, ChevronRight, ChevronDown, Receipt, UserCircle2, Ban, RefreshCw, Tag, ShoppingBag, ClipboardCheck } from 'lucide-react';
import { getSalesHistoryAction } from '@/app/actions/sales/history.actions';
import { getDailyZReportAction, type ZReportData } from '@/app/actions/sales/z-report.actions';
import { getEndOfDaySummaryAction, type EndOfDaySummary } from '@/app/actions/sales/end-of-day.actions';
import { voidSalesOrderAction } from '@/app/actions/sales/void.actions';
import { getSalesAuditAction } from '@/app/actions/sales/audit-export.actions';
import { validateManagerPinAction } from '@/app/actions/pos.actions';
import toast from 'react-hot-toast';
import { printReceipt, printEndOfDaySummary } from '@/lib/print-command';
import { useTenantBranding } from '@/lib/hooks/use-tenant-branding';
import { exportZReportToExcel } from '@/lib/export-z-report';
import { exportSalesAuditToExcel } from '@/lib/export-sales-audit';
import { extractTabCode } from '@/lib/sales/collective-tip-ref';

export default function SalesHistoryPage() {
    const branding = useTenantBranding();
    const [sales, setSales] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [zReport, setZReport] = useState<ZReportData | null>(null);
    const [showZReport, setShowZReport] = useState(false);
    // Blindaje cajera: si el feature flag `hideCashierPaymentMethod` está
    // activo en el tenant y el rol del usuario no es OWNER/ADMIN_MANAGER,
    // el server ya stripeó los métodos del response. Acá ocultamos también
    // las columnas/filtros/secciones del UI para que no quede el header
    // vacío ni el filtro inútil.
    const [hidePaymentMethod, setHidePaymentMethod] = useState(false);
    // Capacidades de gestión (vienen del server según el rol). La cajera entra
    // en modo solo-lectura: ve el historial pero no exporta/anula/genera Z.
    const [canExport, setCanExport] = useState(true);
    const [canVoid, setCanVoid] = useState(true);
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
        if (result.success && result.data) {
            setSales(result.data as any[]);
        } else if (!result.success) {
            // §98: antes el error se tragaba y la página mostraba "sin ventas"
            // — enmascaraba problemas de permisos como si no hubiera ventas.
            setSales([]);
            toast.error((result as { message?: string }).message || 'Error cargando historial');
        }
        const r = result as { hidePaymentMethod?: boolean; canExport?: boolean; canVoid?: boolean };
        setHidePaymentMethod(Boolean(r.hidePaymentMethod));
        // Si el server no manda la capacidad (respuesta vieja), default a false
        // para no exponer acciones de gestión por error.
        setCanExport(r.canExport ?? false);
        setCanVoid(r.canVoid ?? false);
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

    const handleExportAudit = async () => {
        const result = await getSalesAuditAction(filterDate || undefined);
        if (!result.success || !result.data) {
            alert(result.message || 'Error generando auditoría');
            return;
        }
        if (result.data.items.length === 0) {
            alert('No hay ventas para la fecha seleccionada.');
            return;
        }
        exportSalesAuditToExcel(result.data);
    };

    const setFilterDateToYesterday = () => {
        const todayCaracas = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });
        const [y, m, d] = todayCaracas.split('-').map(Number);
        const yesterday = new Date(Date.UTC(y, m - 1, d - 1));
        const stamp = `${yesterday.getUTCFullYear()}-${String(yesterday.getUTCMonth() + 1).padStart(2, '0')}-${String(yesterday.getUTCDate()).padStart(2, '0')}`;
        setFilterDate(stamp);
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
            // Si el server response trae Content-Disposition con filename
            // (caso del endpoint /api/arqueo en producción), se sobreescribe
            // abajo. Este fallback solo se usa si el header no llega.
            const safeName = (branding?.name ?? 'tenant').replace(/[^a-zA-Z0-9]/g, '_');
            let fileName = `Arqueo_Caja_${safeName}_${dateParam}.xlsx`;
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
        const itemsSubtotal = (sale.items || []).reduce((s: number, i: any) => s + (i.lineTotal || 0), 0);
        const deliveryFee = sale.orderType === 'DELIVERY' && sale.subtotal != null ? Math.max(0, sale.subtotal - itemsSubtotal) : undefined;
        // serviceFee: se computa sobre el subtotal post-descuento (consistente
        // con cómo lo calcula el cobro en pos/restaurante). 10% sólo si el
        // cliente lo pagó (sale.serviceFeeIncluded).
        const saleDiscount = sale.discount ?? 0;
        const subtotalForService = (sale.subtotal ?? itemsSubtotal) - saleDiscount;
        const serviceFee = sale.orderType === 'RESTAURANT' && sale.serviceFeeIncluded
          ? subtotalForService * 0.1
          : 0;
        // discountReason auditable: prefiere el reason real guardado en
        // SalesOrder.discountReason (post-PR #63). Para sales viejas sin ese
        // campo, fallback a "Descuento aplicado".
        const discountReason = saleDiscount > 0
          ? (sale.discountReason || 'Descuento aplicado')
          : undefined;
        const isDivisasDiscount = sale.discountType === 'DIVISAS_33';
        printReceipt({
            orderNumber: sale.orderNumber,
            dailyLabel: sale.dailyLabel ?? undefined,
            orderType: (sale.orderType || 'RESTAURANT') as 'RESTAURANT' | 'DELIVERY',
            date: sale.createdAt,
            cashierName: `${sale.createdBy?.firstName || 'Cajera'} ${sale.createdBy?.lastName || ''}`.trim(),
            customerName: sale.customerName || undefined,
            customerPhone: sale.customerPhone || undefined,
            customerAddress: sale.customerAddress || undefined,
            subtotal: sale.orderType === 'DELIVERY' && deliveryFee ? itemsSubtotal : (sale.subtotal ?? itemsSubtotal),
            discount: saleDiscount,
            discountReason,
            hideDiscount: isDivisasDiscount,
            deliveryFee,
            total: sale.total,
            serviceFee,
            items: (sale.items || []).map((item: any) => ({
                name: item.itemName || item.name,
                quantity: item.quantity,
                unitPrice: item.unitPrice ?? (item.lineTotal / (item.quantity || 1)),
                total: item.lineTotal || item.total,
                modifiers: Array.isArray(item.modifiers) ? item.modifiers.filter((m: any) => typeof m === 'string' || !m?.hideFromKitchen).map((m: any) => typeof m === 'string' ? m : m?.name) : []
            })),
            // Forma de pago en la nota reimpresa. Respeta el blindaje cajera:
            // si hidePaymentMethod, el server ya stripeó los datos y acá se omite.
            payments: hidePaymentMethod
                ? undefined
                : (Array.isArray(sale.paymentBreakdown) && sale.paymentBreakdown.length > 0
                    ? sale.paymentBreakdown.map((p: { method: string; amount: number }) => ({ method: p.method, amountUSD: p.amount }))
                    : sale.paymentMethod
                        ? [{ method: sale.paymentMethod, amountUSD: sale.total }]
                        : undefined),
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
        try {
            const res = await validateManagerPinAction(voidPin);
            if (res.success && res.data) {
                await executeVoid(res.data.managerId, res.data.managerName);
            } else {
                setVoidPinError(res.message || 'PIN inválido o sin permisos suficientes');
            }
        } catch {
            // §130: sin esto, un error de red dejaba el botón mudo en "Procesando".
            setVoidPinError('Error de conexión validando el PIN. Intenta de nuevo.');
        } finally {
            setVoidLoading(false);
        }
    };

    const executeVoid = async (managerId: string, managerName: string) => {
        if (!voidTarget) return;
        const orderIds = voidTarget._orderIds || [voidTarget.id];
        const isMesa = orderIds.length > 1;
        let anyVoided = false;      // ≥1 comanda se anuló AHORA
        let allResolved = true;     // todas quedaron anuladas (nuevas o ya lo estaban)
        let hardError = '';
        try {
            for (const orderId of orderIds) {
                const res = await voidSalesOrderAction({
                    orderId,
                    voidReason,
                    authorizedById: managerId,
                    authorizedByName: managerName,
                });
                if (res.success) {
                    anyVoided = true;
                } else if (/ya (está|fue) anulada/i.test(res.message || '')) {
                    // §130: idempotente — una comanda ya anulada (por un intento
                    // previo que murió a medias) NO es un error: cuenta como hecha.
                } else {
                    hardError = res.message || 'Error al anular';
                    allResolved = false;
                }
            }
        } catch {
            hardError = 'Error de conexión al anular. Verifica el estado de la orden.';
            allResolved = false;
        }

        // §130: SIEMPRE refrescamos para reflejar el estado real (antes, en el
        // camino de error no se llamaba loadData → parecía que "no pasaba nada").
        await loadData();

        if (allResolved) {
            setVoidTarget(null);
            toast.success(
                anyVoided
                    ? (isMesa ? 'Mesa anulada correctamente' : 'Orden anulada correctamente')
                    : 'La orden ya estaba anulada — vista actualizada'
            );
        } else {
            toast.error(hardError || 'No se pudo anular. Revisa el estado de la orden.');
        }
    };

    // ---- BADGES ----
    const getPaymentBadge = (method: string) => {
        switch (method?.toUpperCase()) {
            case 'CASH':
            case 'CASH_USD': return <span className="bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F] px-2 py-0.5 rounded text-xs font-semibold">Cash $</span>;
            case 'CASH_EUR': return <span className="bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F] px-2 py-0.5 rounded text-xs font-semibold">Cash €</span>;
            case 'CARD':
            case 'BS_POS':
            case 'PDV_SHANKLISH': return <span className="bg-[#E6ECF4] text-[#2A4060] dark:bg-[#1A2636] dark:text-[#D1DCE9] px-2 py-0.5 rounded text-xs font-semibold">PDV Shanklish</span>;
            case 'PDV_SUPERFERRO': return <span className="bg-[#E6ECF4] text-[#2A4060] dark:bg-[#1A2636] dark:text-[#D1DCE9] px-2 py-0.5 rounded text-xs font-semibold">PDV Superferro</span>;
            case 'ZELLE': return <span className="bg-[#E6ECF4] text-[#2A4060] dark:bg-[#1A2636] dark:text-[#D1DCE9] px-2 py-0.5 rounded text-xs font-semibold">ZELLE</span>;
            case 'MOBILE_PAY': return <span className="bg-[#E6ECF4] text-[#2A4060] dark:bg-[#1A2636] dark:text-[#D1DCE9] px-2 py-0.5 rounded text-xs font-semibold">PAGO MÓVIL</span>;
            case 'MOVIL_NG': return <span className="bg-[#E6ECF4] text-[#2A4060] dark:bg-[#1A2636] dark:text-[#D1DCE9] px-2 py-0.5 rounded text-xs font-semibold">MÓVIL NG</span>;
            case 'TRANSFER': return <span className="bg-[#E6ECF4] text-[#2A4060] dark:bg-[#1A2636] dark:text-[#D1DCE9] px-2 py-0.5 rounded text-xs font-semibold">TRANSFER</span>;
            case 'CASH_BS': return <span className="bg-[#F3EAD6] text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8] px-2 py-0.5 rounded text-xs font-semibold">Bs</span>;
            case 'CORTESIA': return <span className="bg-[#E6ECF4] text-[#2A4060] dark:bg-[#1A2636] dark:text-[#D1DCE9] px-2 py-0.5 rounded text-xs font-semibold">CORTESÍA</span>;
            default: return <span className="bg-capsula-navy-soft text-capsula-ink px-2 py-0.5 rounded text-xs font-semibold">{method || '-'}</span>;
        }
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

    const hasActiveFilters = filterSearch !== '' || (!hidePaymentMethod && filterPaymentMethod !== 'ALL') || filterOrderType !== 'ALL' || filterHasDiscount || cancelledFilter !== 'active';

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
        // Método de pago — skip si el blindaje está activo (no hay dato).
        if (!hidePaymentMethod && filterPaymentMethod !== 'ALL') {
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
            // §107: Mesa y Pickup separados. Mesa = solo RESTAURANT.
            if ((s.orderType || '').toUpperCase() !== 'RESTAURANT') return false;
        } else if (filterOrderType === 'PICKUP') {
            // §107: Pickup excluye las propinas colectivas (son órdenes PICKUP
            // ficticias — tienen su propio filtro "Propinas").
            if ((s.orderType || '').toUpperCase() !== 'PICKUP') return false;
            if ((s.customerName || '') === 'PROPINA COLECTIVA') return false;
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
            <div className="flex flex-col items-center gap-3 text-capsula-ink-muted">
                <RefreshCw className="h-6 w-6 animate-spin" />
                <p className="text-sm">Cargando historial…</p>
            </div>
        </div>
    );

    return (
        <div className="p-6 max-w-7xl mx-auto text-capsula-ink animate-in">
            {/* HEADER */}
            <div className="flex flex-wrap justify-between items-start mb-5 gap-4">
                <div>
                    <h1 className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink">Historial de ventas</h1>
                    <p className="mt-1 text-sm text-capsula-ink-muted">
                        Registro de transacciones y cierres
                        {' · '}
                        <span className="text-capsula-ink-soft font-medium tabular-nums">{shownCount} de {totalCount} órdenes</span>
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {/* Date filter */}
                    <div className="inline-flex items-center gap-1.5 rounded-lg border border-capsula-line bg-capsula-ivory-surface px-3 py-2">
                        <Calendar className="h-3.5 w-3.5 text-capsula-ink-muted" />
                        <input
                            type="date"
                            value={filterDate}
                            onChange={e => setFilterDate(e.target.value)}
                            className="bg-transparent text-capsula-ink text-sm tabular-nums focus:outline-none cursor-pointer w-32"
                        />
                    </div>
                    <button
                        onClick={setFilterDateToYesterday}
                        title="Filtrar por ayer (Caracas)"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-capsula-line bg-capsula-ivory text-capsula-ink-soft hover:bg-capsula-ivory-alt px-3 py-2 text-xs font-semibold transition-colors"
                    >
                        Ayer
                    </button>
                    {/* Acciones de gestión — ocultas para roles de solo lectura (cajera) */}
                    {canExport && (
                        <>
                            <button
                                onClick={handleExportAudit}
                                title={`Descargar auditoría de inventario (detalle por producto) — ${displayDate || 'hoy'}`}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-capsula-line bg-capsula-ivory text-capsula-ink-soft hover:bg-capsula-ivory-alt px-4 py-2 text-xs font-semibold transition-colors"
                            >
                                <ClipboardCheck className="h-3.5 w-3.5" />
                                Auditoría {displayDate ? `· ${displayDate}` : ''}
                            </button>
                            <button
                                onClick={handleExportArqueo}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-capsula-line bg-capsula-ivory text-capsula-ink-soft hover:bg-capsula-ivory-alt px-4 py-2 text-xs font-semibold transition-colors"
                            >
                                <Download className="h-3.5 w-3.5" />
                                Exportar Excel
                            </button>
                            <button
                                onClick={handleGenerateZReport}
                                title={`Generar reporte Z para ${displayDate || 'hoy'}`}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-capsula-line bg-capsula-ivory text-capsula-ink-soft hover:bg-capsula-ivory-alt px-4 py-2 text-xs font-semibold transition-colors"
                            >
                                <Printer className="h-3.5 w-3.5" />
                                Reporte Z {displayDate ? `· ${displayDate}` : '(hoy)'}
                            </button>
                            <button
                                onClick={handleDaySummary}
                                title={`Resumen de cierre del día para ${displayDate || 'hoy'}`}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-capsula-navy-deep text-capsula-cream hover:bg-capsula-navy-deep/90 px-4 py-2 text-xs font-semibold transition-colors"
                            >
                                <BarChart3 className="h-3.5 w-3.5" />
                                Cierre del día {displayDate ? `· ${displayDate}` : '(hoy)'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* ── BARRA DE FILTROS AVANZADOS ─────────────────────────────────── */}
            <div className="rounded-2xl border border-capsula-line bg-capsula-ivory p-4 mb-4 flex flex-wrap gap-3 items-end">
                {/* Búsqueda libre */}
                <div className="flex-1 min-w-[200px]">
                    <label className="text-[10px] text-capsula-ink-muted uppercase font-semibold mb-1.5 block tracking-[0.14em]">Buscar</label>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-capsula-ink-muted pointer-events-none" />
                        <input
                            type="text"
                            value={filterSearch}
                            onChange={e => setFilterSearch(e.target.value)}
                            placeholder="Orden #, cliente, teléfono..."
                            className="pos-input pl-8 w-full text-sm"
                        />
                    </div>
                </div>
                {/* Método de pago — oculto si el tenant tiene blindaje activo y el rol no puede ver método */}
                {!hidePaymentMethod && (
                    <div>
                        <label className="text-[10px] text-capsula-ink-muted uppercase font-semibold mb-1.5 block tracking-[0.14em]">Método</label>
                        <select
                            value={filterPaymentMethod}
                            onChange={e => setFilterPaymentMethod(e.target.value)}
                            className="pos-input text-sm cursor-pointer"
                        >
                            <option value="ALL">Todos</option>
                            <option value="CASH_USD">Cash $</option>
                            <option value="CASH_EUR">€ Cash €</option>
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
                )}
                {/* Tipo de orden */}
                <div>
                    <label className="text-[10px] text-capsula-ink-muted uppercase font-semibold mb-1.5 block tracking-[0.14em]">Tipo</label>
                    <select
                        value={filterOrderType}
                        onChange={e => setFilterOrderType(e.target.value)}
                        className="pos-input text-sm cursor-pointer"
                    >
                        <option value="ALL">Todos</option>
                        <option value="RESTAURANT">Mesa</option>
                        <option value="PICKUP">Pickup</option>
                        <option value="DELIVERY">Delivery</option>
                        <option value="PEDIDOSYA">PedidosYA</option>
                        <option value="PROPINAS">Propinas</option>
                    </select>
                </div>
                {/* Con descuento */}
                <label className="flex items-center gap-2 text-sm text-capsula-ink-soft cursor-pointer select-none rounded-lg border border-capsula-line bg-capsula-ivory-surface px-3 py-2 hover:border-capsula-navy-deep/40 transition-colors">
                    <input
                        type="checkbox"
                        checked={filterHasDiscount}
                        onChange={e => setFilterHasDiscount(e.target.checked)}
                        className="rounded accent-capsula-navy-deep"
                    />
                    <span className="font-medium">Con descuento</span>
                </label>
                {/* Estado / Anuladas */}
                <div className="flex rounded-lg border border-capsula-line overflow-hidden text-xs font-semibold">
                    {([
                        { value: 'active', label: 'Activas' },
                        { value: 'all',    label: 'Todas' },
                        { value: 'only',   label: 'Anuladas' },
                    ] as const).map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => setCancelledFilter(opt.value)}
                            className={`px-3 py-2 transition-colors ${
                                cancelledFilter === opt.value
                                    ? opt.value === 'only'
                                        ? 'bg-[#B04A2E] text-capsula-cream dark:bg-[#3B1F14] dark:text-[#EFD2C8]'
                                        : 'bg-capsula-navy-deep text-capsula-cream'
                                    : 'bg-capsula-ivory-surface text-capsula-ink-muted hover:bg-capsula-ivory-alt'
                            }`}
                        >
                            {opt.value === 'only' && <Ban className="inline-block h-3 w-3 mr-1" />}
                            {opt.label}
                        </button>
                    ))}
                </div>
                {/* Clear all */}
                {hasActiveFilters && (
                    <button
                        onClick={clearAllFilters}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-capsula-line bg-capsula-ivory text-capsula-ink-soft hover:bg-capsula-coral/10 hover:text-capsula-coral hover:border-capsula-coral/30 px-3 py-2 text-xs font-semibold transition-colors"
                    >
                        <XIcon className="h-3.5 w-3.5" />
                        Limpiar filtros
                    </button>
                )}
            </div>

            {/* ── RESUMEN DE RESULTADOS FILTRADOS ───────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
                <div className="rounded-xl border border-capsula-line bg-capsula-ivory px-4 py-3 shadow-cap-soft">
                    <p className="text-[10px] text-capsula-ink-muted uppercase font-semibold tracking-[0.14em] mb-1">Órdenes</p>
                    <p className="font-semibold text-2xl tracking-[-0.02em] text-capsula-ink tabular-nums">{shownCount}</p>
                    {shownCount !== totalCount && <p className="text-xs text-capsula-ink-faint tabular-nums">de {totalCount} total</p>}
                </div>
                <div className="rounded-xl border border-capsula-line bg-capsula-ivory px-4 py-3 shadow-cap-soft">
                    <p className="text-[10px] text-capsula-ink-muted uppercase font-semibold tracking-[0.14em] mb-1">Facturado</p>
                    <p className="font-semibold text-2xl tracking-[-0.02em] text-capsula-ink tabular-nums">{formatMoney(filteredTotals.invoiced)}</p>
                    <p className="text-xs text-capsula-ink-faint">con 10% servicio</p>
                </div>
                <div className="rounded-xl border border-[#D3E2D8] bg-[#E5EDE7]/40 dark:border-[#244935] dark:bg-[#1E3B2C]/40 px-4 py-3">
                    <p className="text-[10px] text-[#2F6B4E] dark:text-[#6FB88F] uppercase font-semibold tracking-[0.14em] mb-1">Cobrado</p>
                    <p className="font-semibold text-2xl tracking-[-0.02em] text-[#2F6B4E] dark:text-[#6FB88F] tabular-nums">{formatMoney(filteredTotals.collected)}</p>
                    <p className="text-xs text-[#2F6B4E]/70 dark:text-[#6FB88F]/70">con servicio y propinas</p>
                </div>
                <div className="rounded-xl border border-capsula-line bg-capsula-ivory px-4 py-3 shadow-cap-soft">
                    <p className="text-[10px] text-capsula-ink-muted uppercase font-semibold tracking-[0.14em] mb-1">Descuentos</p>
                    <p className={`font-semibold text-2xl tracking-[-0.02em] tabular-nums ${filteredTotals.discounts > 0 ? 'text-capsula-coral' : 'text-capsula-ink-faint'}`}>
                        {filteredTotals.discounts > 0 ? `−${formatMoney(filteredTotals.discounts)}` : '$0.00'}
                    </p>
                </div>
                <div className={`rounded-xl px-4 py-3 border ${voidCount > 0 ? 'bg-[#F7E3DB]/50 border-[#E8C2B7] dark:bg-[#3B1F14]/50 dark:border-[#5b3328]' : 'border-capsula-line bg-capsula-ivory shadow-cap-soft'}`}>
                    <p className={`text-[10px] uppercase font-semibold tracking-[0.14em] mb-1 ${voidCount > 0 ? 'text-[#B04A2E] dark:text-[#EFD2C8]' : 'text-capsula-ink-muted'}`}>Anuladas hoy</p>
                    <p className={`font-semibold text-2xl tracking-[-0.02em] tabular-nums ${voidCount > 0 ? 'text-[#B04A2E] dark:text-[#EFD2C8]' : 'text-capsula-ink-faint'}`}>{voidCount}</p>
                    {voidAmount > 0 && <p className="text-xs font-semibold tabular-nums text-[#B04A2E]/80 dark:text-[#EFD2C8]/80">{formatMoney(voidAmount)}</p>}
                </div>
            </div>

            {/* TABLA */}
            <div className="rounded-2xl border border-capsula-line bg-capsula-ivory overflow-x-auto shadow-cap-soft">
                <table className="w-full min-w-[900px] text-left border-collapse">
                    <thead className="bg-capsula-ivory-alt text-capsula-ink-muted text-[11px] font-semibold uppercase tracking-[0.14em]">
                        <tr>
                            <th className="px-4 py-3">Orden #</th>
                            <th className="px-4 py-3">Fecha</th>
                            <th className="px-4 py-3">Hora</th>
                            <th className="px-4 py-3">Cliente</th>
                            {!hidePaymentMethod && <th className="px-4 py-3">Método</th>}
                            <th className="px-4 py-3 text-right">Total factura</th>
                            <th className="px-4 py-3 text-right">Cobrado</th>
                            <th className="px-4 py-3 text-center">10% serv.</th>
                            <th className="px-4 py-3">Descuento / auth</th>
                            <th className="px-4 py-3 text-center">Ítems</th>
                            <th className="px-4 py-3 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-capsula-line text-sm">
                        {filteredSales.length === 0 && (
                            <tr>
                                <td colSpan={11} className="p-12 text-center">
                                    <FileX2 className="mx-auto h-10 w-10 text-capsula-ink-muted mb-2" />
                                    <p className="text-capsula-ink-muted text-sm">No hay ventas en este período.</p>
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
                                <>
                                    <tr
                                        key={sale.id}
                                        onClick={() => itemCount > 0 && toggleRow(sale.id)}
                                        className={`transition-colors ${isVoided ? 'opacity-60 bg-[#F7E3DB]/30 dark:bg-[#3B1F14]/30' : isPropina ? 'bg-[#F3EAD6]/40 hover:bg-[#F3EAD6]/60 dark:bg-[#3B2F15]/40 dark:hover:bg-[#3B2F15]/60' : 'hover:bg-capsula-ivory-alt'} ${itemCount > 0 ? 'cursor-pointer' : ''}`}
                                    >
                                        {/* ORDEN # */}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className={`font-semibold font-mono text-xs tabular-nums ${isVoided ? 'text-capsula-coral line-through' : isPropina ? 'text-[#946A1C] dark:text-[#E8D9B8]' : 'text-capsula-ink'}`}>
                                                    {sale.orderNumber}
                                                </span>
                                                {isPropina && (
                                                    <span className="rounded bg-[#F3EAD6] text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8] text-[10px] px-1.5 py-0.5 font-semibold uppercase tracking-[0.14em]">Propina</span>
                                                )}
                                                {isPropina && extractTabCode(sale.notes) && (
                                                    <span className="rounded bg-capsula-navy-soft text-capsula-ink text-[10px] px-1.5 py-0.5 font-semibold font-mono tabular-nums inline-flex items-center gap-1" title={`Propina vinculada a la mesa ${extractTabCode(sale.notes)}`}>
                                                        <Tag className="h-2.5 w-2.5" /> {extractTabCode(sale.notes)}
                                                    </span>
                                                )}
                                                {isVoided && (
                                                    <span className="rounded bg-[#F7E3DB] text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8] text-[10px] px-1.5 py-0.5 font-semibold uppercase tracking-[0.14em]">Anulada</span>
                                                )}
                                            </div>
                                            {sale._consolidated && sale.orderNumbers?.length > 1 && (
                                                <div className="text-[10px] text-capsula-ink-muted font-mono mt-0.5 tabular-nums" title={sale.orderNumbers.join(', ')}>
                                                    {sale.orderNumbers.length} tandas
                                                </div>
                                            )}
                                            {isVoided && sale.voidReason && (
                                                <div className="text-[10px] text-capsula-coral/80 mt-0.5 max-w-[160px] truncate" title={sale.voidReason}>
                                                    {sale.voidReason}
                                                </div>
                                            )}
                                        </td>
                                        {/* FECHA */}
                                        <td className="px-4 py-3 text-capsula-ink-soft text-xs font-mono tabular-nums whitespace-nowrap">
                                            {saleDate}
                                            {isVoided && sale.voidedAt && (
                                                <div className="text-capsula-coral/70 mt-0.5 inline-flex items-center gap-0.5">
                                                    <Ban className="h-2.5 w-2.5" />
                                                    {new Date(sale.voidedAt).toLocaleDateString('es-VE', { timeZone: 'America/Caracas', day: '2-digit', month: 'numeric' })}
                                                </div>
                                            )}
                                        </td>
                                        {/* HORA */}
                                        <td className="px-4 py-3 text-capsula-ink-soft text-xs font-mono tabular-nums whitespace-nowrap">
                                            {saleTime}
                                        </td>
                                        {/* CLIENTE */}
                                        <td className="px-4 py-3 max-w-[180px]">
                                            {(() => {
                                                const raw = (sale.customerName || '').trim();
                                                const phone = (sale.customerPhone || '').trim();
                                                if (!raw) {
                                                    return (
                                                        <span className="inline-flex items-center gap-1 text-xs italic text-capsula-ink-muted">
                                                            <UserCircle2 className="h-3.5 w-3.5" />
                                                            Cliente general
                                                        </span>
                                                    );
                                                }
                                                // Detectar si el "customerName" es solo un nombre de mesa
                                                // (ej. "Mesa 5", "Bar 1") — en ese caso renderizamos
                                                // como tag de mesa, no como cliente.
                                                const isJustTable = /^(Mesa|Bar|Barra|Jardín|Jardin|Salón|Salon|Pickup|Delivery)\b/i.test(raw)
                                                    && !raw.includes(' — ');
                                                if (isJustTable) {
                                                    return (
                                                        <div>
                                                            <span className="inline-flex items-center gap-1 text-xs font-medium text-capsula-ink">
                                                                <Tag className="h-3 w-3 text-capsula-ink-muted" />
                                                                {raw}
                                                            </span>
                                                            <p className="text-[10px] italic text-capsula-ink-muted">sin nombre de cliente</p>
                                                        </div>
                                                    );
                                                }
                                                // Formato típico tabs con subcuenta: "Mesa 5 — Juan"
                                                const [head, ...rest] = raw.split(' — ');
                                                const tail = rest.join(' — ');
                                                return (
                                                    <div className="min-w-0">
                                                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-capsula-ink truncate" title={raw}>
                                                            <UserCircle2 className="h-3.5 w-3.5 shrink-0 text-capsula-ink-muted" />
                                                            <span className="truncate">{tail || head}</span>
                                                        </span>
                                                        {tail && (
                                                            <p className="text-[10px] text-capsula-ink-muted truncate">{head}</p>
                                                        )}
                                                        {phone && (
                                                            <p className="text-[10px] tabular-nums text-capsula-ink-faint">{phone}</p>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                        {/* MÉTODO — oculto bajo blindaje cajera */}
                                        {!hidePaymentMethod && (
                                            <td className="px-4 py-3">
                                                {(sale.paymentBreakdown || []).length > 1 ? (
                                                    <div className="flex flex-wrap gap-1" title={(sale.paymentBreakdown || []).map((p: { method: string; amount: number }) => `${p.method}: $${p.amount.toFixed(2)}`).join(' | ')}>
                                                        {(sale.paymentBreakdown || []).map((p: { method: string; amount: number }, i: number) => (
                                                            <span key={i} className="flex items-center gap-0.5">
                                                                {getPaymentBadge(p.method)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    getPaymentBadge(sale.paymentMethod)
                                                )}
                                            </td>
                                        )}
                                        {/* TOTAL FACTURA */}
                                        <td className="px-4 py-3 text-right text-capsula-ink-muted text-sm font-mono">
                                            {isPropina ? <span className="text-capsula-ink-soft">—</span> : formatMoney(totalFactura)}
                                        </td>
                                        {/* COBRADO */}
                                        <td className="px-4 py-3 text-right font-semibold font-mono">
                                            {isPropina ? (
                                                <span className="text-[#946A1C] dark:text-[#E8D9B8]">{formatMoney(totalCobrado)}</span>
                                            ) : (
                                                <>
                                                    <span className="text-capsula-ink">{formatMoney(totalCobrado)}</span>
                                                    {propina > 0.01 && (
                                                        <div className="text-[10px] text-[#946A1C] dark:text-[#E8D9B8] font-normal text-right">
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
                                                    <span className="text-[#2F6B4E] dark:text-[#6FB88F] text-xs font-semibold">Sí</span>
                                                ) : (
                                                    <span className="text-capsula-ink-soft text-xs">No</span>
                                                )
                                            ) : (
                                                <span className="text-capsula-ink-soft">-</span>
                                            )}
                                        </td>
                                        {/* DESCUENTO / AUTH */}
                                        <td className="px-4 py-3">
                                            {sale.discount > 0 ? (
                                                <div className="flex flex-col gap-0.5">
                                                    {sale.discountType === 'DIVISAS_33' && (
                                                        <span className="text-[#2A4060] dark:text-[#D1DCE9] text-xs">-{formatMoney(sale.discount)}</span>
                                                    )}
                                                    {(sale.discountType === 'CORTESIA_100' || sale.discountType === 'CORTESIA') && (
                                                        <span className="text-[#2A4060] dark:text-[#D1DCE9] text-xs font-semibold">-{formatMoney(sale.discount)}</span>
                                                    )}
                                                    {sale.discountType === 'CORTESIA_PERCENT' && (
                                                        <span className="text-[#2A4060] dark:text-[#D1DCE9] text-xs font-semibold">-{formatMoney(sale.discount)}</span>
                                                    )}
                                                    {sale.authorizedById && (
                                                        <span className="text-[#2F6B4E] dark:text-[#6FB88F] text-[10px] bg-[#E5EDE7]/40 dark:bg-[#1E3B2C]/40 px-1 rounded w-fit">
                                                            ✓ {sale.authorizedBy?.firstName}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : <span className="text-capsula-ink-soft">-</span>}
                                        </td>
                                        {/* ÍTEMS */}
                                        <td className="px-4 py-3 text-center">
                                            {itemCount > 0 ? (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); toggleRow(sale.id); }}
                                                    className="inline-flex items-center gap-1 bg-capsula-navy-soft hover:bg-capsula-navy hover:text-capsula-cream text-capsula-ink px-2 py-1 rounded text-xs font-semibold transition-colors"
                                                >
                                                    {itemCount}
                                                    <span className={`transition-transform text-[10px] ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                                                </button>
                                            ) : (
                                                <span className="text-capsula-ink-soft">-</span>
                                            )}
                                        </td>
                                        {/* ACCIONES */}
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <button
                                                    onClick={(e) => handleReprint(sale, e)}
                                                    title="Reimprimir factura"
                                                    className="bg-capsula-navy-soft hover:bg-capsula-navy hover:text-capsula-cream text-capsula-ink px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                                                >
                                                    <Printer className="h-3.5 w-3.5 inline-block mr-1" />Imprimir
                                                </button>
                                                {!isVoided && canVoid && (
                                                    <button
                                                        onClick={(e) => openVoidModal(sale, e)}
                                                        title="Anular venta"
                                                        className="bg-[#F7E3DB] dark:bg-[#3B1F14]/40 hover:bg-[#F7E3DB] dark:hover:bg-[#3B1F14] text-[#B04A2E] dark:text-[#EFD2C8] px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                                                    >
                                                        Anular
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                    {/* FILA EXPANDIDA - ÍTEMS */}
                                    {isExpanded && itemCount > 0 && (
                                        <tr key={`${sale.id}-expanded`} className="bg-capsula-ivory-alt/60">
                                            <td colSpan={11} className="px-6 py-4">
                                                {/* Tabla de productos */}
                                                <div className="rounded-lg overflow-hidden border border-capsula-line mb-3">
                                                    <table className="w-full text-xs">
                                                        <thead className="bg-capsula-ivory-alt text-capsula-ink-muted uppercase text-[10px] font-semibold">
                                                            <tr>
                                                                <th className="px-3 py-2 text-left">Producto</th>
                                                                <th className="px-3 py-2 text-center">Cant.</th>
                                                                <th className="px-3 py-2 text-right">P. Unit.</th>
                                                                <th className="px-3 py-2 text-right">Subtotal</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-capsula-line">
                                                            {(sale.items || []).map((item: any, idx: number) => {
                                                                const unitPrice = item.unitPrice ?? (item.lineTotal / (item.quantity || 1));
                                                                const modifiers = Array.isArray(item.modifiers)
                                                                    ? item.modifiers.map((m: any) => typeof m === 'string' ? m : m?.name).filter(Boolean)
                                                                    : [];
                                                                return (
                                                                    <tr key={idx} className="hover:bg-capsula-ivory-alt/40">
                                                                        <td className="px-3 py-2 text-capsula-ink">
                                                                            {item.itemName || item.name}
                                                                            {modifiers.length > 0 && (
                                                                                <div className="text-capsula-ink-muted text-[10px]">+ {modifiers.join(', ')}</div>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-3 py-2 text-center text-capsula-ink">×{item.quantity}</td>
                                                                        <td className="px-3 py-2 text-right text-capsula-ink-muted font-mono">${unitPrice.toFixed(2)}</td>
                                                                        <td className="px-3 py-2 text-right text-capsula-ink font-semibold font-mono">${(item.lineTotal || 0).toFixed(2)}</td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>

                                                {/* Resumen de totales */}
                                                <div className="flex flex-wrap gap-3 text-xs font-mono text-capsula-ink-muted">
                                                    <span>Productos: <span className="text-capsula-ink">{formatMoney(itemsSubtotal)}</span></span>
                                                    {sale.orderType === 'RESTAURANT' && sale.serviceFeeIncluded && servicioAmount > 0 && (
                                                        <span>10% Servicio: <span className="text-[#2F6B4E] dark:text-[#6FB88F]">+{formatMoney(servicioAmount)}</span></span>
                                                    )}
                                                    {(sale.discount || 0) > 0 && (
                                                        <span>Descuento: <span className="text-[#B04A2E] dark:text-[#EFD2C8]">-{formatMoney(sale.discount)}</span></span>
                                                    )}
                                                    <span>Total factura: <span className="text-capsula-ink">{formatMoney(totalFactura)}</span></span>
                                                    <span>Cobrado: <span className="text-capsula-ink font-semibold">{formatMoney(totalCobrado)}</span></span>
                                                    {propina > 0.01 && (
                                                        <span>Propina/excedente: <span className="text-[#946A1C] dark:text-[#E8D9B8]">+{formatMoney(propina)}</span></span>
                                                    )}
                                                </div>

                                                {/* Desglose de pagos — oculto bajo blindaje cajera */}
                                                {!hidePaymentMethod && (sale.paymentBreakdown || []).length > 0 && (
                                                    <div className="mt-2 text-xs text-capsula-ink-muted">
                                                        <span className="font-semibold uppercase text-capsula-ink-soft">Desglose de pagos: </span>
                                                        {(sale.paymentBreakdown || []).map((p: { method: string; amount: number; amountBS?: number; exchangeRate?: number; label?: string }, i: number) => (
                                                            <span key={i} className="mr-3 inline-flex items-center gap-1">
                                                                {getPaymentBadge(p.method)}
                                                                {p.label && <span className="ml-1 text-capsula-ink-muted">{p.label}</span>}
                                                                <span className="text-capsula-ink font-semibold font-mono">{formatMoney(p.amount)}</span>
                                                                {p.amountBS != null && p.amountBS > 0 && (
                                                                    <span className="text-[#946A1C] dark:text-[#E8D9B8] font-mono text-[10px]">
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
                                                    <div className="mt-3 bg-[#F7E3DB] dark:bg-[#3B1F14]/20 border border-[#F7E3DB] dark:border-[#3B1F14] rounded-lg px-3 py-2 text-xs space-y-1">
                                                        <div className="font-semibold text-[#B04A2E] dark:text-[#EFD2C8] uppercase tracking-wider text-[10px]">Detalle de Anulación</div>
                                                        {sale.voidedBy && (
                                                            <div className="flex gap-2 text-capsula-cream">
                                                                <span className="text-capsula-ink-muted">Anulado por:</span>
                                                                <span className="font-semibold text-[#B04A2E] dark:text-[#EFD2C8]">{sale.voidedBy.firstName} {sale.voidedBy.lastName}</span>
                                                            </div>
                                                        )}
                                                        {sale.voidedAt && (
                                                            <div className="flex gap-2 text-capsula-cream">
                                                                <span className="text-capsula-ink-muted">Fecha anulación:</span>
                                                                <span>{new Date(sale.voidedAt).toLocaleString('es-VE', { timeZone: 'America/Caracas', day: '2-digit', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                            </div>
                                                        )}
                                                        {sale.voidReason && (
                                                            <div className="flex gap-2 text-capsula-cream">
                                                                <span className="text-capsula-ink-muted shrink-0">Motivo:</span>
                                                                <span className="text-[#B04A2E] dark:text-[#EFD2C8]">{sale.voidReason}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* ================================================================ */}
            {/* MODAL REPORTE Z                                                    */}
            {/* ================================================================ */}
            {showZReport && zReport && (
                <div className="fixed inset-0 bg-capsula-ink/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white text-black rounded-lg w-full max-w-sm p-8 font-mono shadow-2xl relative">
                        <button onClick={() => setShowZReport(false)} className="absolute top-2 right-2 text-capsula-ink-muted hover:text-[#B04A2E] dark:text-[#EFD2C8] font-semibold text-2xl tracking-[-0.02em] no-print">×</button>
                        <div className="text-center mb-6 border-b-2 border-dashed border-black pb-4">
                            <h2 className="font-semibold text-2xl tracking-[-0.02em]">REPORTE Z</h2>
                            <p className="text-sm">{(branding?.name ?? '').toUpperCase()}</p>
                            <p className="text-sm">{new Date().toLocaleString()}</p>
                            <p className="text-sm mt-1 font-semibold">CIERRE DE CAJA DIARIO</p>
                        </div>
                        {/* ── VENTAS ── */}
                        <div className="space-y-1 mb-4 border-b-2 border-dashed border-black pb-4">
                            <div className="flex justify-between"><span>VENTAS BRUTAS</span><span>{formatMoney(zReport.grossTotal)}</span></div>
                            {zReport.totalDiscounts > 0 && (<>
                                <div className="flex justify-between text-[#B04A2E] dark:text-[#EFD2C8]"><span>(-) DESCUENTOS</span><span>-{formatMoney(zReport.totalDiscounts)}</span></div>
                                {zReport.discountBreakdown.divisas > 0 && (
                                    <div className="flex justify-between text-xs text-capsula-ink-muted pl-4"><span>Divisas (33%)</span><span>-{formatMoney(zReport.discountBreakdown.divisas)}</span></div>
                                )}
                                {zReport.discountBreakdown.cortesias > 0 && (
                                    <div className="flex justify-between text-xs text-capsula-ink-muted pl-4"><span>Cortesías</span><span>-{formatMoney(zReport.discountBreakdown.cortesias)}</span></div>
                                )}
                                {zReport.discountBreakdown.other > 0 && (
                                    <div className="flex justify-between text-xs text-capsula-ink-muted pl-4"><span>Otros</span><span>-{formatMoney(zReport.discountBreakdown.other)}</span></div>
                                )}
                            </>)}
                            <div className="flex justify-between font-semibold text-base mt-1 pt-1 border-t border-capsula-line"><span>VENTA NETA</span><span>{formatMoney(zReport.netTotal)}</span></div>
                            {zReport.totalServiceFee > 0 && (
                                <div className="flex justify-between text-[#2A4060] dark:text-[#D1DCE9]"><span>(+) SERVICIO 10%</span><span>+{formatMoney(zReport.totalServiceFee)}</span></div>
                            )}
                            {zReport.totalTips > 0 && (
                                <div className="flex justify-between text-[#2F6B4E] dark:text-[#6FB88F]"><span>(+) PROPINAS{zReport.tipCount > 0 ? ` (${zReport.tipCount})` : ''}</span><span>+{formatMoney(zReport.totalTips)}</span></div>
                            )}
                            <div className="flex justify-between font-semibold text-xl tracking-[-0.02em] mt-2 pt-2 border-t-2 border-black"><span>TOTAL COBRADO</span><span>{formatMoney(zReport.totalCollected)}</span></div>
                            {(zReport.bsRate ?? 0) > 0 && (
                                <>
                                    <div className="flex justify-between font-semibold text-base tabular-nums">
                                        <span>TOTAL EN Bs</span>
                                        <span>Bs {(zReport.totalCollectedBs ?? 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-capsula-ink-muted tabular-nums">
                                        <span>Tasa del día (al consultar)</span>
                                        <span>1 USD = Bs {(zReport.bsRate ?? 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                </>
                            )}
                            {zReport.openTabsPending && zReport.openTabsPending.count > 0 && (
                                <div className="mt-2 p-2 border border-dashed border-amber-600 rounded text-xs bg-[#F3EAD6] text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8]">
                                    <span className="font-semibold">CUENTAS PENDIENTES ({zReport.openTabsPending.count})</span>{' — '}{formatMoney(zReport.openTabsPending.total)} no cobradas aún (excluidas del cierre)
                                </div>
                            )}
                        </div>

                        {/* ── ARQUEO DE CAJA — oculto bajo blindaje cajera ── */}
                        {!zReport.hidePaymentMethod && (
                            <div className="mb-4 border-b-2 border-dashed border-black pb-4">
                                <h3 className="font-semibold underline mb-2">ARQUEO DE CAJA</h3>
                                <div className="space-y-0.5 text-sm">
                                    {zReport.paymentBreakdown.cash > 0 && <div className="flex justify-between"><span>Efectivo USD</span><span className="font-semibold">{formatMoney(zReport.paymentBreakdown.cash)}</span></div>}
                                    {zReport.paymentBreakdown.zelle > 0 && <div className="flex justify-between"><span>Zelle</span><span className="font-semibold">{formatMoney(zReport.paymentBreakdown.zelle)}</span></div>}
                                    {zReport.paymentBreakdown.card > 0 && (
                                        <>
                                            <div className="flex justify-between"><span>Punto PDV</span><span className="font-semibold">{formatMoney(zReport.paymentBreakdown.card)}</span></div>
                                            {(zReport.pdvBreakdown?.shanklish ?? 0) > 0 && (
                                                <div className="flex justify-between text-xs text-capsula-ink-muted pl-4"><span>PDV Shanklish</span><span>{formatMoney(zReport.pdvBreakdown!.shanklish)}</span></div>
                                            )}
                                            {(zReport.pdvBreakdown?.superferro ?? 0) > 0 && (
                                                <div className="flex justify-between text-xs text-capsula-ink-muted pl-4"><span>PDV Superferro</span><span>{formatMoney(zReport.pdvBreakdown!.superferro)}</span></div>
                                            )}
                                            {(zReport.pdvBreakdown?.otherCard ?? 0) > 0 && (
                                                <div className="flex justify-between text-xs text-capsula-ink-muted pl-4"><span>Otros PDV / tarjeta</span><span>{formatMoney(zReport.pdvBreakdown!.otherCard)}</span></div>
                                            )}
                                        </>
                                    )}
                                    {zReport.paymentBreakdown.mobile > 0 && <div className="flex justify-between"><span>Pago Móvil</span><span className="font-semibold">{formatMoney(zReport.paymentBreakdown.mobile)}</span></div>}
                                    {zReport.paymentBreakdown.transfer > 0 && <div className="flex justify-between"><span>Transferencia</span><span className="font-semibold">{formatMoney(zReport.paymentBreakdown.transfer)}</span></div>}
                                    {zReport.paymentBreakdown.external > 0 && <div className="flex justify-between"><span>PedidosYA / Externo</span><span className="font-semibold">{formatMoney(zReport.paymentBreakdown.external)}</span></div>}
                                    {zReport.paymentBreakdown.other > 0 && <div className="flex justify-between text-capsula-ink-muted"><span>Otros</span><span>{formatMoney(zReport.paymentBreakdown.other)}</span></div>}
                                </div>
                            </div>
                        )}

                        {/* ── PEDIDOS POR CANAL ── */}
                        <div className="mb-4 text-sm border-b-2 border-dashed border-black pb-4">
                            <h3 className="font-semibold underline mb-2">PEDIDOS POR CANAL</h3>
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

                        {/* ── AUDITORÍA: ANULACIONES ── */}
                        {zReport.ordersByStatus['CANCELLED'] > 0 && (
                            <div className="mb-4 text-sm border-b-2 border-dashed border-black pb-4">
                                <h3 className="font-semibold underline mb-2">AUDITORÍA — ANULACIONES</h3>
                                <div className="space-y-0.5">
                                    <div className="flex justify-between">
                                        <span>Órdenes anuladas hoy</span>
                                        <span className="font-semibold">{zReport.ordersByStatus['CANCELLED']}</span>
                                    </div>
                                    <div className="flex justify-between text-capsula-ink-soft">
                                        <span>Monto anulado</span>
                                        <span>-{formatMoney(zReport.cancelledTotal ?? 0)}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="text-center text-xs text-capsula-ink-muted pt-2">
                            <p className="font-semibold">Total transacciones: {zReport.totalOrders}</p>
                        </div>
                        <div className="flex gap-3 mt-6 no-print">
                            <button
                                onClick={() => exportZReportToExcel(zReport)}
                                className="flex-1 bg-capsula-navy-deep hover:bg-capsula-navy text-capsula-ink py-3 rounded font-semibold transition flex items-center justify-center gap-2"
                            >
                                📥 Exportar a Excel
                            </button>
                            <button
                                onClick={() => window.print()}
                                className="flex-1 bg-black text-capsula-ink py-3 rounded font-semibold hover:bg-capsula-ivory-alt transition"
                            >
                                <Printer className="h-3.5 w-3.5 inline-block mr-1" />Imprimir
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ================================================================ */}
            {/* MODAL CIERRE DEL DÍA                                               */}
            {/* ================================================================ */}
            {showDaySummary && daySummary && (
                <div className="fixed inset-0 bg-capsula-ink/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-capsula-ivory border border-[#F3EAD6] dark:border-[#3B2F15] rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="font-semibold text-xl tracking-[-0.02em] text-[#946A1C] dark:text-[#E8D9B8]">Resumen de Cierre del Día</h2>
                                <p className="text-sm text-capsula-ink-muted font-mono mt-0.5">{daySummary.date}</p>
                            </div>
                            <button onClick={() => setShowDaySummary(false)} className="text-capsula-ink-muted hover:text-capsula-ink font-semibold text-2xl tracking-[-0.02em]">×</button>
                        </div>

                        {/* Ventas por canal */}
                        <div className="bg-capsula-ivory-alt rounded-xl p-4 mb-4">
                            <h3 className="text-xs font-semibold uppercase text-capsula-ink-muted tracking-widest mb-3">Ventas por Canal</h3>
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
                                        <div key={r.key} className="flex justify-between items-center text-sm">
                                            <span className="text-capsula-cream">{r.label} <span className="text-capsula-ink-muted text-xs">({daySummary.countByChannel[r.key]})</span></span>
                                            <span className="font-semibold font-mono text-capsula-ink">${daySummary.byChannel[r.key].toFixed(2)}</span>
                                        </div>
                                    ))
                                }
                            </div>
                        </div>

                        {/* Totales */}
                        <div className="bg-capsula-ivory-alt rounded-xl p-4 mb-4">
                            <h3 className="text-xs font-semibold uppercase text-capsula-ink-muted tracking-widest mb-3">Totales</h3>
                            <div className="space-y-1.5 text-sm">
                                {daySummary.totalDiscounts > 0 && (
                                    <div className="flex justify-between"><span className="text-capsula-ink-muted">Descuentos:</span><span className="text-[#B04A2E] dark:text-[#EFD2C8] font-mono">-${daySummary.totalDiscounts.toFixed(2)}</span></div>
                                )}
                                {daySummary.totalServiceFee > 0 && (
                                    <div className="flex justify-between"><span className="text-capsula-ink-muted">10% Servicio:</span><span className="text-[#2F6B4E] dark:text-[#6FB88F] font-mono">+${daySummary.totalServiceFee.toFixed(2)}</span></div>
                                )}
                                {daySummary.propinas > 0 && (
                                    <div className="flex justify-between"><span className="text-capsula-ink-muted">Propinas{daySummary.propinaCount > 0 ? ` (${daySummary.propinaCount})` : ''}:</span><span className="text-[#946A1C] dark:text-[#E8D9B8] font-mono">+${daySummary.propinas.toFixed(2)}</span></div>
                                )}
                                <div className="flex justify-between pt-2 border-t border-capsula-line">
                                    <span className="font-semibold text-capsula-ink">Total Cobrado:</span>
                                    <span className="font-semibold text-xl tracking-[-0.02em] text-capsula-ink font-mono">${daySummary.totalUSD.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Divisas vs Bs */}
                        <div className="bg-capsula-ivory-alt rounded-xl p-4 mb-4">
                            <h3 className="text-xs font-semibold uppercase text-capsula-ink-muted tracking-widest mb-3">Desglose por Moneda</h3>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-capsula-cream">Divisas (Cash / Zelle)</span>
                                    <div className="text-right">
                                        <span className="font-semibold font-mono text-[#2A4060] dark:text-[#D1DCE9]">${daySummary.receivedInDivisas.toFixed(2)}</span>
                                        <span className="text-capsula-ink-muted text-xs ml-2">{daySummary.pctDivisas.toFixed(1)}%</span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-capsula-cream">Bolívares (PDV / Móvil)</span>
                                    <div className="text-right">
                                        <span className="font-semibold font-mono text-[#2A4060] dark:text-[#D1DCE9]">${daySummary.receivedInBs.toFixed(2)}</span>
                                        <span className="text-capsula-ink-muted text-xs ml-2">{daySummary.pctBs.toFixed(1)}%</span>
                                    </div>
                                </div>
                                {/* Progress bar */}
                                <div className="h-2 bg-capsula-navy-soft rounded-full overflow-hidden mt-1">
                                    <div className="h-full bg-capsula-navy-deep rounded-full" style={{ width: `${daySummary.pctDivisas}%` }} />
                                </div>
                                <div className="flex justify-between text-[10px] text-capsula-ink-muted">
                                    <span>Divisas {daySummary.pctDivisas.toFixed(0)}%</span>
                                    <span>Bs {daySummary.pctBs.toFixed(0)}%</span>
                                </div>
                            </div>
                        </div>

                        {/* Facturas */}
                        <div className="bg-capsula-ivory-alt rounded-xl p-4 mb-4">
                            <h3 className="text-xs font-semibold uppercase text-capsula-ink-muted tracking-widest mb-2">Facturas</h3>
                            <div className="flex gap-6 text-sm">
                                <div><span className="text-capsula-ink-muted">Procesadas: </span><span className="font-semibold text-capsula-ink">{daySummary.totalInvoices}</span></div>
                                {daySummary.invoicesCancelled > 0 && (
                                    <div><span className="text-capsula-ink-muted">Anuladas: </span><span className="font-semibold text-[#B04A2E] dark:text-[#EFD2C8]">{daySummary.invoicesCancelled}</span></div>
                                )}
                            </div>
                        </div>

                        <button
                            onClick={() => printEndOfDaySummary(daySummary)}
                            className="w-full bg-capsula-navy-deep hover:bg-capsula-navy text-capsula-ink py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2"
                        >
                            <Printer className="h-3.5 w-3.5 inline-block mr-1" />Imprimir Resumen
                        </button>
                    </div>
                </div>
            )}

            {/* ================================================================ */}
            {/* MODAL ANULACIÓN                                                    */}
            {/* ================================================================ */}
            {voidTarget && (
                <div className="fixed inset-0 bg-capsula-ink/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-capsula-ivory border border-[#F7E3DB] dark:border-[#3B1F14] rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h2 className="font-semibold text-xl tracking-[-0.02em] text-[#B04A2E] dark:text-[#EFD2C8]">Anular Venta</h2>
                                <p className="text-sm text-capsula-ink-muted font-mono mt-0.5">{voidTarget.orderNumber} — {formatMoney(voidTarget.totalCobrado ?? voidTarget.total)}</p>
                            </div>
                            <button onClick={() => setVoidTarget(null)} className="text-capsula-ink-muted hover:text-capsula-ink font-semibold text-2xl tracking-[-0.02em]">×</button>
                        </div>

                        <div className="bg-capsula-ivory-alt rounded-xl p-4 mb-5 text-sm space-y-1">
                            <div className="flex justify-between text-capsula-cream">
                                <span>Cliente:</span><span>{voidTarget.customerName || 'Cliente General'}</span>
                            </div>
                            <div className="flex justify-between text-capsula-cream">
                                <span>Cajera:</span><span>{voidTarget.createdBy?.firstName || '-'}</span>
                            </div>
                            {voidTarget.authorizedById && (
                                <div className="flex justify-between text-capsula-cream">
                                    <span>Autorizado por:</span><span>{voidTarget.authorizedBy?.firstName || voidTarget.authorizedByName || '-'}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-capsula-cream">
                                <span>Items:</span><span>{(voidTarget.items || []).length} productos</span>
                            </div>
                            <div className="flex justify-between font-semibold text-capsula-ink pt-1 border-t border-capsula-line">
                                <span>Total cobrado:</span><span>{formatMoney(voidTarget.totalCobrado ?? voidTarget.total)}</span>
                            </div>
                        </div>

                        {voidStep === 'reason' && (
                            <>
                                <label className="block text-sm font-medium text-capsula-cream mb-2">
                                    Motivo de la anulación <span className="text-[#B04A2E] dark:text-[#EFD2C8]">*</span>
                                </label>
                                <textarea
                                    value={voidReason}
                                    onChange={e => setVoidReason(e.target.value)}
                                    placeholder="Ej: Error de facturación, cliente solicitó cambio de mesa..."
                                    rows={3}
                                    className="w-full bg-capsula-ivory-alt border border-gray-600 rounded-xl px-4 py-3 text-capsula-ink text-sm focus:border-red-500 focus:outline-none resize-none mb-5"
                                />
                                <div className="flex gap-3">
                                    <button onClick={() => setVoidTarget(null)} className="flex-1 bg-capsula-navy-soft hover:bg-capsula-navy-soft text-capsula-cream py-3 rounded-xl font-semibold transition-colors">
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={() => setVoidStep('pin')}
                                        disabled={!voidReason.trim()}
                                        className="flex-1 bg-capsula-coral hover:bg-capsula-coral-hover disabled:opacity-40 disabled:cursor-not-allowed text-capsula-ink py-3 rounded-xl font-semibold transition-colors"
                                    >
                                        Continuar →
                                    </button>
                                </div>
                            </>
                        )}

                        {voidStep === 'pin' && (
                            <>
                                <div className="mb-4 p-3 bg-[#F3EAD6]/40 dark:bg-[#3B2F15]/40 border border-[#F3EAD6] dark:border-[#3B2F15] rounded-xl text-xs text-[#946A1C] dark:text-[#E8D9B8] leading-relaxed">
                                    🔐 Requiere PIN de Gerente, Auditor o Dueño. El inventario se reintegrará automáticamente.
                                </div>
                                <label className="block text-sm font-medium text-capsula-cream mb-2">PIN de Autorización</label>
                                <input
                                    type="password"
                                    value={voidPin}
                                    onChange={e => { setVoidPin(e.target.value); setVoidPinError(''); }}
                                    onKeyDown={e => e.key === 'Enter' && voidPin && handleVoidPinConfirm()}
                                    placeholder="••••"
                                    maxLength={8}
                                    autoFocus
                                    className="w-full bg-capsula-ivory-alt border border-gray-600 rounded-xl px-4 py-3 text-capsula-ink text-center text-2xl tracking-widest focus:border-red-500 focus:outline-none mb-1"
                                />
                                {voidPinError && <p className="text-[#B04A2E] dark:text-[#EFD2C8] text-xs mb-3 text-center">{voidPinError}</p>}
                                <div className="flex gap-3 mt-4">
                                    <button
                                        onClick={() => { setVoidStep('reason'); setVoidPin(''); setVoidPinError(''); }}
                                        className="flex-1 bg-capsula-navy-soft hover:bg-capsula-navy-soft text-capsula-cream py-3 rounded-xl font-semibold transition-colors"
                                    >
                                        ← Volver
                                    </button>
                                    <button
                                        onClick={handleVoidPinConfirm}
                                        disabled={!voidPin || voidLoading}
                                        className="flex-1 bg-capsula-coral hover:bg-capsula-coral-hover disabled:opacity-40 disabled:cursor-not-allowed text-capsula-ink py-3 rounded-xl font-semibold transition-colors"
                                    >
                                        {voidLoading ? '⏳ Procesando...' : 'Autorizar Anulación'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
