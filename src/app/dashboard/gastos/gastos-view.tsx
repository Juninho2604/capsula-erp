'use client';

import { useState, useTransition, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  getExpensesAction, createExpenseAction, voidExpenseAction,
  createExpenseCategoryAction,
  type ExpenseData, type ExpenseSummary, type ExpenseCategoryData,
} from '@/app/actions/expense.actions';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import ExcelJS from 'exceljs';
import { cn } from '@/lib/utils';
import {
  Coins, FileDown, Plus, ChevronLeft, ChevronRight as ChevronRightIcon, Loader2,
  ClipboardList, FolderOpen, CreditCard, TrendingUp, TrendingDown, X, PieChart as PieChartIcon,
  BarChart3, AlertTriangle, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/Badge';

// ─── CONSTANTES ──────────────────────────────────────────────────────────────

const PAYMENT_METHODS = [
  { value: 'CASH_USD', label: 'Efectivo USD' },
  { value: 'CASH_BS', label: 'Efectivo Bs' },
  { value: 'ZELLE', label: 'Zelle' },
  { value: 'BANK_TRANSFER', label: 'Transferencia Bancaria' },
  { value: 'MOBILE_PAY', label: 'Pago Móvil' },
  { value: 'CHECK', label: 'Cheque' },
  { value: 'OTHER', label: 'Otro' },
];

const PIE_COLORS = ['#11203A', '#F25C3B', '#2F6B4E', '#946A1C', '#253D5C', '#B04A2E', '#3A4656', '#6B7584'];

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function fmt(n: number) {
  return n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function paymentLabel(method: string) {
  return PAYMENT_METHODS.find(m => m.value === method)?.label ?? method;
}

// ─── PROPS ───────────────────────────────────────────────────────────────────

interface Props {
  initialExpenses: ExpenseData[];
  initialSummary: ExpenseSummary;
  categories: ExpenseCategoryData[];
  currentUserRole: string;
  currentMonth: number;
  currentYear: number;
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────

export function GastosView({ initialExpenses, initialSummary, categories: initialCategories, currentUserRole, currentMonth, currentYear }: Props) {
  const [expenses, setExpenses] = useState<ExpenseData[]>(initialExpenses);
  const [summary, setSummary] = useState<ExpenseSummary>(initialSummary);
  const [categories, setCategories] = useState<ExpenseCategoryData[]>(initialCategories);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [showForm, setShowForm] = useState(false);
  const [showCatForm, setShowCatForm] = useState(false);
  const [voidTarget, setVoidTarget] = useState<ExpenseData | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [isPending, startTransition] = useTransition();
  const [prevSummary, setPrevSummary] = useState<ExpenseSummary | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterMethod, setFilterMethod] = useState<string>('');
  const [expenseTrend, setExpenseTrend] = useState<{ label: string; total: number }[]>([]);

  const canManage = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'].includes(currentUserRole);
  const canAdmin = ['OWNER', 'ADMIN_MANAGER'].includes(currentUserRole);

  // Form state
  const [form, setForm] = useState({
    description: '', notes: '', categoryId: '',
    amountUsd: '', amountBs: '', exchangeRate: '',
    paymentMethod: 'CASH_USD', paymentRef: '',
    paidAt: new Date().toISOString().slice(0, 10),
  });
  const [catForm, setCatForm] = useState({ name: '', description: '', color: '#11203A', icon: '📁' });

  // ── Cargar período ──────────────────────────────────────────────────────────
  const loadPeriod = (month: number, year: number) => {
    startTransition(async () => {
      const result = await getExpensesAction({ month, year });
      if (result.success && result.data) {
        setExpenses(result.data);
        setSummary(result.summary ?? { totalUsd: 0, countByCategory: [], countByPaymentMethod: [] });
      }
      // Fetch previous month for comparison
      const prevM = month === 1 ? 12 : month - 1;
      const prevY = month === 1 ? year - 1 : year;
      const prevResult = await getExpensesAction({ month: prevM, year: prevY });
      if (prevResult.success) {
        setPrevSummary(prevResult.summary ?? null);
      }
    });
  };

  // Load previous month on initial mount for MoM comparison
  useEffect(() => {
    const prevM = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevY = currentMonth === 1 ? currentYear - 1 : currentYear;
    getExpensesAction({ month: prevM, year: prevY }).then(r => {
      if (r.success) setPrevSummary(r.summary ?? null);
    });
  }, []);

  // Load 6-month trend
  useEffect(() => {
    const loadTrend = async () => {
      const months: { label: string; total: number }[] = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const m = d.getMonth() + 1;
        const y = d.getFullYear();
        const result = await getExpensesAction({ month: m, year: y });
        const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        months.push({
          label: `${monthNames[m - 1]} ${y}`,
          total: result.summary?.totalUsd ?? 0,
        });
      }
      setExpenseTrend(months);
    };
    loadTrend();
  }, []);

  const handleMonthChange = (delta: number) => {
    let m = selectedMonth + delta;
    let y = selectedYear;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setSelectedMonth(m); setSelectedYear(y);
    loadPeriod(m, y);
  };

  // ── Crear gasto ─────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim() || !form.categoryId || !form.amountUsd || !form.paymentMethod) {
      toast.error('Completa todos los campos requeridos'); return;
    }
    startTransition(async () => {
      const result = await createExpenseAction({
        description: form.description,
        notes: form.notes || undefined,
        categoryId: form.categoryId,
        amountUsd: parseFloat(form.amountUsd),
        amountBs: form.amountBs ? parseFloat(form.amountBs) : undefined,
        exchangeRate: form.exchangeRate ? parseFloat(form.exchangeRate) : undefined,
        paymentMethod: form.paymentMethod,
        paymentRef: form.paymentRef || undefined,
        paidAt: form.paidAt,
      });
      if (result.success) {
        toast.success('Gasto registrado');
        setShowForm(false);
        setForm({ description: '', notes: '', categoryId: '', amountUsd: '', amountBs: '', exchangeRate: '', paymentMethod: 'CASH_USD', paymentRef: '', paidAt: new Date().toISOString().slice(0, 10) });
        loadPeriod(selectedMonth, selectedYear);
      } else {
        toast.error(result.error ?? 'Error al registrar gasto');
      }
    });
  };

  // ── Crear categoría ─────────────────────────────────────────────────────────
  const handleCreateCat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catForm.name.trim()) { toast.error('El nombre es requerido'); return; }
    startTransition(async () => {
      const result = await createExpenseCategoryAction({ name: catForm.name, description: catForm.description, color: catForm.color, icon: catForm.icon });
      if (result.success) {
        toast.success('Categoría creada');
        setShowCatForm(false);
        setCatForm({ name: '', description: '', color: '#3B82F6', icon: '💸' });
        // Refresh categories
        const cats = await import('@/app/actions/expense.actions').then(m => m.getExpenseCategoriesAction());
        if (cats.data) setCategories(cats.data);
      } else {
        toast.error(result.error ?? 'Error');
      }
    });
  };

  // ── Anular gasto ─────────────────────────────────────────────────────────────
  const handleVoid = async () => {
    if (!voidTarget || !voidReason.trim()) { toast.error('Escribe el motivo de anulación'); return; }
    startTransition(async () => {
      const result = await voidExpenseAction(voidTarget.id, voidReason);
      if (result.success) {
        toast.success('Gasto anulado');
        setVoidTarget(null); setVoidReason('');
        loadPeriod(selectedMonth, selectedYear);
      } else {
        toast.error(result.error ?? 'Error');
      }
    });
  };

  // ─── FILTRADO ────────────────────────────────────────────────────────────────
  const filteredExpenses = expenses.filter(e => {
    if (filterCategory && e.categoryId !== filterCategory) return false;
    if (filterMethod && e.paymentMethod !== filterMethod) return false;
    return true;
  });

  // ── Exportar a Excel ────────────────────────────────────────────────────────
  const exportExpensesExcel = async () => {
    if (filteredExpenses.length === 0) return;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Gastos');

    ws.mergeCells('A1:F1');
    ws.getCell('A1').value = `Gastos Operativos — ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`;
    ws.getCell('A1').font = { bold: true, size: 14 };

    ws.getRow(3).values = ['Fecha', 'Descripción', 'Categoría', 'Método de Pago', 'Monto USD', 'Registrado por'];
    ws.getRow(3).font = { bold: true };
    ws.getColumn(1).width = 14;
    ws.getColumn(2).width = 35;
    ws.getColumn(3).width = 20;
    ws.getColumn(4).width = 20;
    ws.getColumn(5).width = 15;
    ws.getColumn(5).numFmt = '#,##0.00';
    ws.getColumn(6).width = 20;

    filteredExpenses.forEach((e, i) => {
      ws.getRow(4 + i).values = [
        new Date(e.paidAt).toLocaleDateString('es-VE'),
        e.description,
        e.categoryName,
        paymentLabel(e.paymentMethod),
        e.amountUsd,
        e.createdByName,
      ];
    });

    // Total row
    const totalRow = 4 + filteredExpenses.length + 1;
    ws.getCell(`A${totalRow}`).value = 'TOTAL';
    ws.getCell(`A${totalRow}`).font = { bold: true };
    ws.getCell(`E${totalRow}`).value = filteredExpenses.reduce((s: number, e) => s + e.amountUsd, 0);
    ws.getCell(`E${totalRow}`).font = { bold: true };
    ws.getCell(`E${totalRow}`).numFmt = '#,##0.00';

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Gastos_${MONTH_NAMES[selectedMonth - 1]}_${selectedYear}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-[1400px] animate-in space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-capsula-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 text-[11px] uppercase tracking-[0.12em] text-capsula-ink-muted">Finanzas</div>
          <h1 className="inline-flex items-center gap-2 font-heading text-[28px] leading-tight tracking-[-0.01em] text-capsula-navy-deep">
            <Coins className="h-6 w-6 text-capsula-coral" strokeWidth={1.5} />
            Gastos operativos
          </h1>
          <p className="mt-1 text-[13px] text-capsula-ink-soft">Registro y control de gastos del negocio.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={exportExpensesExcel}>
            <FileDown className="h-4 w-4" strokeWidth={1.5} /> Exportar Excel
          </Button>
          {canManage && (
            <>
              {canAdmin && (
                <Button variant="outline" size="sm" onClick={() => setShowCatForm(true)}>
                  <Plus className="h-3.5 w-3.5" strokeWidth={2} /> Categoría
                </Button>
              )}
              <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4" strokeWidth={2} /> Registrar gasto
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Navegador de período */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleMonthChange(-1)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-capsula-line bg-capsula-ivory-surface text-capsula-ink transition-colors hover:bg-capsula-ivory-alt"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
        </button>
        <span className="min-w-[160px] text-center font-heading text-[18px] tracking-[-0.01em] text-capsula-navy-deep">
          {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
        </span>
        <button
          onClick={() => handleMonthChange(1)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-capsula-line bg-capsula-ivory-surface text-capsula-ink transition-colors hover:bg-capsula-ivory-alt"
        >
          <ChevronRightIcon className="h-4 w-4" strokeWidth={1.5} />
        </button>
        {isPending && (
          <span className="inline-flex items-center gap-1 text-[11px] text-capsula-ink-muted">
            <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} /> Cargando…
          </span>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total gastos"
          value={`$${fmt(summary.totalUsd)}`}
          Icon={Coins}
          accent="coral"
          change={prevSummary ? (prevSummary.totalUsd > 0 ? Math.round(((summary.totalUsd - prevSummary.totalUsd) / prevSummary.totalUsd) * 1000) / 10 : null) : null}
          invertChange
        />
        <KpiCard label="Nº de gastos" value={`${expenses.length}`} Icon={ClipboardList} accent="navy" />
        <KpiCard
          label="Mayor categoría"
          value={summary.countByCategory[0]?.categoryName ?? '—'}
          Icon={FolderOpen}
          accent="warn"
          sub={summary.countByCategory[0] ? `$${fmt(summary.countByCategory[0].totalUsd)}` : undefined}
        />
        <KpiCard
          label="Método principal"
          value={summary.countByPaymentMethod[0] ? paymentLabel(summary.countByPaymentMethod[0].method) : '—'}
          Icon={CreditCard}
          accent="neutral"
          sub={summary.countByPaymentMethod[0] ? `$${fmt(summary.countByPaymentMethod[0].totalUsd)}` : undefined}
        />
      </div>

      {/* Desglose por categoría */}
      {summary.countByCategory.length > 0 && (
        <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-5 shadow-cap-soft">
          <h3 className="mb-4 text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Por categoría</h3>
          <div className="space-y-2">
            {summary.countByCategory.sort((a, b) => b.totalUsd - a.totalUsd).map(cat => {
              const pct = summary.totalUsd > 0 ? (cat.totalUsd / summary.totalUsd) * 100 : 0;
              return (
                <div key={cat.categoryId} className="flex items-center gap-3">
                  <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: cat.categoryColor ?? '#11203A' }} />
                  <span className="flex-1 truncate text-[13px] text-capsula-ink">{cat.categoryName}</span>
                  <span className="text-[11px] text-capsula-ink-muted">{cat.count} gastos</span>
                  <span className="w-24 text-right font-mono text-[13px] font-semibold text-capsula-ink">${fmt(cat.totalUsd)}</span>
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-capsula-line">
                    <div className="h-full rounded-full bg-capsula-navy-deep transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {summary.countByCategory.length > 0 && (
          <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-6 shadow-cap-soft">
            <h3 className="mb-4 inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">
              <PieChartIcon className="h-3 w-3" strokeWidth={1.5} />
              Distribución por categoría
            </h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={summary.countByCategory}
                    dataKey="totalUsd"
                    nameKey="categoryName"
                    cx="50%" cy="50%"
                    innerRadius={45} outerRadius={80}
                    paddingAngle={2}
                  >
                    {summary.countByCategory.map((entry, index) => (
                      <Cell key={entry.categoryId} fill={entry.categoryColor || PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`$${fmt(value)}`, undefined]}
                    contentStyle={{ background: '#FDFBF7', border: '1px solid #E7E2D7', borderRadius: '10px', fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {summary.countByPaymentMethod.length > 0 && (
          <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-6 shadow-cap-soft">
            <h3 className="mb-4 inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">
              <BarChart3 className="h-3 w-3" strokeWidth={1.5} />
              Por método de pago
            </h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.countByPaymentMethod} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <XAxis type="number" tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}`} tick={{ fontSize: 10, fill: '#6B7584' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="method" tick={{ fontSize: 10, fill: '#6B7584' }} axisLine={false} tickLine={false} width={100} tickFormatter={(v: string) => paymentLabel(v)} />
                  <Tooltip formatter={(value: number) => [`$${fmt(value)}`, 'Monto']} contentStyle={{ background: '#FDFBF7', border: '1px solid #E7E2D7', borderRadius: '10px', fontSize: 12 }} />
                  <Bar dataKey="totalUsd" fill="#11203A" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Expense Trend */}
      {expenseTrend.length > 0 && (
        <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-6 shadow-cap-soft">
          <h3 className="mb-4 text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Tendencia de gastos (6 meses)</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={expenseTrend} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6B7584' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v: number) => `$${v >= 1000 ? `${(v/1000).toFixed(1)}k` : v.toFixed(0)}`} tick={{ fontSize: 10, fill: '#6B7584' }} axisLine={false} tickLine={false} width={50} />
                <Tooltip formatter={(value: number) => [`$${value.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Gastos']} contentStyle={{ background: '#FDFBF7', border: '1px solid #E7E2D7', borderRadius: '10px', fontSize: 12 }} />
                <Bar dataKey="total" name="Gastos" fill="#F25C3B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-1.5 text-[13px] text-capsula-ink outline-none focus:border-capsula-navy-deep"
        >
          <option value="">Todas las categorías</option>
          {categories.filter(c => c.isActive).map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={filterMethod}
          onChange={e => setFilterMethod(e.target.value)}
          className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-1.5 text-[13px] text-capsula-ink outline-none focus:border-capsula-navy-deep"
        >
          <option value="">Todos los métodos</option>
          {PAYMENT_METHODS.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        {(filterCategory || filterMethod) && (
          <button
            onClick={() => { setFilterCategory(''); setFilterMethod(''); }}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-capsula-coral transition-colors hover:text-capsula-coral-hover"
          >
            <X className="h-3 w-3" strokeWidth={1.5} /> Limpiar filtros
          </button>
        )}
        <span className="ml-auto text-[11px] text-capsula-ink-muted">{filteredExpenses.length} gastos</span>
      </div>

      {/* Tabla de gastos */}
      <div className="overflow-hidden rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface shadow-cap-soft">
        <div className="border-b border-capsula-line bg-capsula-ivory px-5 py-4">
          <h3 className="font-medium text-capsula-ink">Detalle de gastos</h3>
        </div>
        {filteredExpenses.length === 0 ? (
          <div className="p-12 text-center">
            <Coins className="mx-auto h-10 w-10 text-capsula-ink-faint" strokeWidth={1.5} />
            <p className="mt-3 font-medium text-capsula-ink">Sin gastos en este período</p>
            {canManage && <p className="mt-1 text-[13px] text-capsula-ink-muted">Haz clic en "+ Registrar gasto" para agregar el primero</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-capsula-line bg-capsula-ivory">
                  <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Fecha</th>
                  <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Descripción</th>
                  <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Categoría</th>
                  <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Método</th>
                  <th className="px-5 py-3 text-right text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Monto USD</th>
                  <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Registrado por</th>
                  {canAdmin && <th className="px-5 py-3 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Acción</th>}
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map(e => (
                  <tr key={e.id} className={cn("border-b border-capsula-line transition-colors last:border-b-0 hover:bg-capsula-ivory", e.status === 'VOID' && 'opacity-50 bg-capsula-coral-subtle/20')}>
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-capsula-ink-soft">
                      {new Date(e.paidAt).toLocaleDateString('es-VE')}
                    </td>
                    <td className="px-5 py-3 text-capsula-ink">
                      <div className="font-medium">{e.description}</div>
                      {e.notes && <div className="text-[11px] text-capsula-ink-muted">{e.notes}</div>}
                      {e.paymentRef && <div className="text-[11px] text-capsula-ink-muted">Ref: {e.paymentRef}</div>}
                      {e.status === 'VOID' && <Badge variant="danger">Anulado</Badge>}
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-capsula-line bg-capsula-ivory px-2 py-0.5 text-[11px] text-capsula-ink">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: e.categoryColor ?? '#11203A' }} />
                        {e.categoryName}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-capsula-ink-soft">{paymentLabel(e.paymentMethod)}</td>
                    <td className="px-5 py-3 text-right font-mono font-semibold text-capsula-ink">${fmt(e.amountUsd)}</td>
                    <td className="px-5 py-3 text-[11px] text-capsula-ink-muted">{e.createdByName}</td>
                    {canAdmin && (
                      <td className="px-5 py-3 text-center">
                        {e.status !== 'VOID' && (
                          <button
                            onClick={() => setVoidTarget(e)}
                            className="text-[11px] font-medium text-capsula-coral transition-colors hover:text-capsula-coral-hover"
                          >
                            Anular
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal: Nuevo Gasto ── */}
      {showForm && (
        <Modal title="Registrar gasto" onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelCls}>Descripción *</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className={inputCls} placeholder="Ej: Pago alquiler local enero" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Categoría *</label>
                <select value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
                  className={inputCls} required>
                  <option value="">Seleccionar…</option>
                  {categories.filter(c => c.isActive).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Fecha *</label>
                <input type="date" value={form.paidAt} onChange={e => setForm(f => ({ ...f, paidAt: e.target.value }))}
                  className={inputCls} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Monto USD *</label>
                <input type="number" step="0.01" min="0.01" value={form.amountUsd}
                  onChange={e => setForm(f => ({ ...f, amountUsd: e.target.value }))}
                  className={`${inputCls} font-mono`} placeholder="0.00" required />
              </div>
              <div>
                <label className={labelCls}>Monto Bs (opcional)</label>
                <input type="number" step="0.01" min="0" value={form.amountBs}
                  onChange={e => setForm(f => ({ ...f, amountBs: e.target.value }))}
                  className={`${inputCls} font-mono`} placeholder="0.00" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Método de pago *</label>
                <select value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}
                  className={inputCls}>
                  {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Referencia (opcional)</label>
                <input value={form.paymentRef} onChange={e => setForm(f => ({ ...f, paymentRef: e.target.value }))}
                  className={inputCls} placeholder="Nº transferencia, cheque…" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Notas (opcional)</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className={inputCls} rows={2} placeholder="Información adicional…" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" variant="primary" disabled={isPending} isLoading={isPending}>
                {isPending ? 'Guardando…' : (<><Check className="h-4 w-4" strokeWidth={2} /> Registrar gasto</>)}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Modal: Nueva Categoría ── */}
      {showCatForm && (
        <Modal title="Nueva categoría" onClose={() => setShowCatForm(false)}>
          <form onSubmit={handleCreateCat} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Icono</label>
                <input value={catForm.icon} onChange={e => setCatForm(f => ({ ...f, icon: e.target.value }))}
                  className={inputCls} placeholder="📁" />
              </div>
              <div>
                <label className={labelCls}>Color</label>
                <input type="color" value={catForm.color} onChange={e => setCatForm(f => ({ ...f, color: e.target.value }))}
                  className="h-10 w-full cursor-pointer rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Nombre *</label>
              <input value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                className={inputCls} placeholder="Ej: Alquiler, servicios públicos…" required />
            </div>
            <div>
              <label className={labelCls}>Descripción</label>
              <input value={catForm.description} onChange={e => setCatForm(f => ({ ...f, description: e.target.value }))}
                className={inputCls} placeholder="Descripción breve…" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setShowCatForm(false)}>Cancelar</Button>
              <Button type="submit" variant="primary" disabled={isPending} isLoading={isPending}>
                {isPending ? 'Creando…' : 'Crear categoría'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Modal: Anular Gasto ── */}
      {voidTarget && (
        <Modal title="Anular gasto" onClose={() => { setVoidTarget(null); setVoidReason(''); }}>
          <div className="space-y-4">
            <div className="rounded-[var(--radius)] border border-capsula-coral/30 bg-capsula-coral-subtle/40 p-4">
              <p className="inline-flex items-center gap-2 font-medium text-capsula-ink">
                <AlertTriangle className="h-4 w-4 text-capsula-coral" strokeWidth={1.5} />
                {voidTarget.description}
              </p>
              <p className="mt-1 font-mono text-[13px] text-capsula-ink-muted">${fmt(voidTarget.amountUsd)} — {new Date(voidTarget.paidAt).toLocaleDateString('es-VE')}</p>
            </div>
            <div>
              <label className={labelCls}>Motivo de anulación *</label>
              <textarea value={voidReason} onChange={e => setVoidReason(e.target.value)}
                className={inputCls} rows={3} placeholder="Describe el motivo…" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => { setVoidTarget(null); setVoidReason(''); }}>Cancelar</Button>
              <Button variant="destructive" onClick={handleVoid} disabled={isPending} isLoading={isPending}>
                {isPending ? 'Anulando…' : 'Confirmar anulación'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── COMPONENTES AUXILIARES ──────────────────────────────────────────────────

const inputCls =
  'w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2.5 text-[14px] text-capsula-ink outline-none transition-colors placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep';
const labelCls = 'mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted';

type KpiAccent = 'coral' | 'navy' | 'warn' | 'neutral';

function KpiCard({ label, value, Icon, accent, sub, change, invertChange }: {
  label: string;
  value: string;
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  accent: KpiAccent;
  sub?: string;
  change?: number | null;
  invertChange?: boolean;
}) {
  const accentClass: Record<KpiAccent, string> = {
    coral: 'border-capsula-coral/30 bg-capsula-coral-subtle/30',
    navy: 'border-capsula-line bg-capsula-ivory-surface',
    warn: 'border-[#E8D9B8] bg-[#F3EAD6]/40',
    neutral: 'border-capsula-line bg-capsula-ivory-surface',
  };
  const iconClass: Record<KpiAccent, string> = {
    coral: 'text-capsula-coral',
    navy: 'text-capsula-navy',
    warn: 'text-[#946A1C]',
    neutral: 'text-capsula-ink-muted',
  };
  const positive = invertChange ? (change != null && change <= 0) : (change != null && change >= 0);
  const ChangeIcon = change != null && change >= 0 ? TrendingUp : TrendingDown;
  return (
    <div className={cn("rounded-[var(--radius)] border p-5 shadow-cap-soft", accentClass[accent])}>
      <div className="mb-1 flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">{label}</p>
        <Icon className={cn("h-4 w-4", iconClass[accent])} strokeWidth={1.5} />
      </div>
      <p className="truncate font-mono text-[22px] font-semibold text-capsula-ink">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-capsula-ink-muted">{sub}</p>}
      {change != null && (
        <span className={cn("mt-1 inline-flex items-center gap-1 text-[10.5px] font-medium", positive ? 'text-[#2F6B4E]' : 'text-capsula-coral')}>
          <ChangeIcon className="h-3 w-3" strokeWidth={1.5} /> {Math.abs(change).toFixed(1)}% vs mes ant.
        </span>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-capsula-navy-deep/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface shadow-[0_20px_60px_-20px_rgba(11,23,39,0.35)]">
        <div className="flex items-center justify-between border-b border-capsula-line px-6 py-4">
          <h2 className="font-heading text-[18px] leading-tight tracking-[-0.01em] text-capsula-navy-deep">{title}</h2>
          <button
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-capsula-ink-muted transition-colors hover:bg-capsula-ivory-alt hover:text-capsula-ink"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
