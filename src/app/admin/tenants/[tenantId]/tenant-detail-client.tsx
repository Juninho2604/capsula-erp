'use client';

import { useState, useTransition } from 'react';
import {
    Pencil,
    Check,
    X as XIcon,
    AlertTriangle,
    KeyRound,
    Plus,
    Trash2,
    Users,
    Store,
    Receipt,
    Wallet,
} from 'lucide-react';
import {
    updateTenantNameAction,
    resetOwnerPasswordAction,
    recordTenantPaymentAction,
    deleteTenantPaymentAction,
} from '../actions';

interface TenantSummary {
    id: string;
    slug: string;
    name: string;
    createdAt: string;
    url: string;
}

interface UserRow {
    id: string;
    email: string;
    fullName: string;
    role: string;
    isActive: boolean;
    createdAt: string;
}

interface BranchRow {
    id: string;
    name: string;
    code: string;
    isActive: boolean;
    createdAt: string;
}

interface SaleRow {
    id: string;
    orderNumber: string;
    total: number;
    status: string;
    createdAt: string;
}

interface PaymentRow {
    id: string;
    amount: number;
    currency: string;
    paidAt: string;
    method: string;
    periodStart: string | null;
    periodEnd: string | null;
    note: string | null;
    recordedBy: string;
}

interface Stats {
    salesCount30d: number;
    salesTotal30d: number;
}

export default function TenantDetailClient({
    tenant,
    owner,
    users,
    branches,
    recentSales,
    stats,
    payments,
}: {
    tenant: TenantSummary;
    owner: { id: string; email: string } | null;
    users: UserRow[];
    branches: BranchRow[];
    recentSales: SaleRow[];
    stats: Stats;
    payments: PaymentRow[];
}) {
    const [pending, startTransition] = useTransition();
    const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
    const [resetResult, setResetResult] = useState<string | null>(null);

    function showToast(res: { success: boolean; message: string }) {
        setToast({ kind: res.success ? 'ok' : 'err', msg: res.message });
        window.setTimeout(() => setToast(null), 5000);
    }

    return (
        <div className="space-y-8">
            {toast && (
                <div
                    className={
                        toast.kind === 'ok'
                            ? 'rounded-2xl border border-capsula-line bg-[#E5EDE7] px-4 py-3 text-sm text-[#2F6B4E] inline-flex items-center gap-2'
                            : 'rounded-2xl border border-capsula-line bg-[#F7E3DB] px-4 py-3 text-sm text-[#B04A2E] inline-flex items-center gap-2'
                    }
                >
                    {toast.kind === 'ok' ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    {toast.msg}
                </div>
            )}

            <TenantHeader
                tenant={tenant}
                pending={pending}
                onSave={(newName) =>
                    startTransition(async () => {
                        const res = await updateTenantNameAction(tenant.id, newName);
                        showToast(res);
                    })
                }
            />

            <StatsRow
                userCount={users.length}
                activeUserCount={users.filter((u) => u.isActive).length}
                branchCount={branches.length}
                stats={stats}
            />

            <Section title="Owner & reset password" icon={<KeyRound className="h-4 w-4" />}>
                <OwnerResetPanel
                    owner={owner}
                    pending={pending}
                    resetResult={resetResult}
                    onReset={(custom) =>
                        startTransition(async () => {
                            const res = await resetOwnerPasswordAction(tenant.id, custom);
                            showToast(res);
                            if (res.success && res.plaintextPassword) {
                                setResetResult(res.plaintextPassword);
                            }
                        })
                    }
                    onClearResult={() => setResetResult(null)}
                />
            </Section>

            <Section title={`Usuarios (${users.length})`} icon={<Users className="h-4 w-4" />}>
                <UsersTable users={users} />
            </Section>

            <Section title={`Sucursales (${branches.length})`} icon={<Store className="h-4 w-4" />}>
                <BranchesTable branches={branches} />
            </Section>

            <Section title="Últimas 10 ventas" icon={<Receipt className="h-4 w-4" />}>
                <SalesTable sales={recentSales} />
            </Section>

            <Section title={`Pagos al SaaS (${payments.length})`} icon={<Wallet className="h-4 w-4" />}>
                <PaymentsPanel
                    tenantId={tenant.id}
                    payments={payments}
                    pending={pending}
                    onRecord={(input) =>
                        startTransition(async () => {
                            const res = await recordTenantPaymentAction(input);
                            showToast(res);
                        })
                    }
                    onDelete={(paymentId) =>
                        startTransition(async () => {
                            const res = await deleteTenantPaymentAction(paymentId);
                            showToast(res);
                        })
                    }
                />
            </Section>
        </div>
    );
}

// ─── Subcomponentes ──────────────────────────────────────────────────────────

function TenantHeader({
    tenant,
    pending,
    onSave,
}: {
    tenant: TenantSummary;
    pending: boolean;
    onSave: (newName: string) => void;
}) {
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(tenant.name);

    return (
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
                {editing ? (
                    <div className="flex items-center gap-2">
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="pos-input text-2xl font-semibold tracking-[-0.02em] text-capsula-ink"
                            maxLength={80}
                        />
                        <button
                            type="button"
                            disabled={pending || !name.trim() || name === tenant.name}
                            onClick={() => {
                                onSave(name.trim());
                                setEditing(false);
                            }}
                            className="pos-btn inline-flex items-center gap-1 px-3 py-2 text-sm disabled:opacity-50"
                        >
                            <Check className="h-3.5 w-3.5" />
                            Guardar
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setName(tenant.name);
                                setEditing(false);
                            }}
                            className="pos-btn-secondary inline-flex items-center gap-1 px-3 py-2 text-sm"
                        >
                            <XIcon className="h-3.5 w-3.5" />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-capsula-ink">
                            {tenant.name}
                        </h1>
                        <button
                            type="button"
                            onClick={() => setEditing(true)}
                            className="rounded-full p-1.5 text-capsula-ink-muted hover:bg-capsula-coral/10 hover:text-capsula-coral"
                            title="Editar nombre"
                        >
                            <Pencil className="h-3.5 w-3.5" />
                        </button>
                    </div>
                )}
                <div className="text-[11px] uppercase tracking-[0.14em] text-capsula-ink-muted">
                    slug: <span className="font-mono">{tenant.slug}</span>
                    {' · '}
                    creado{' '}
                    {new Date(tenant.createdAt).toLocaleDateString('es-VE', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                    })}
                </div>
            </div>
        </div>
    );
}

function StatsRow({
    userCount,
    activeUserCount,
    branchCount,
    stats,
}: {
    userCount: number;
    activeUserCount: number;
    branchCount: number;
    stats: Stats;
}) {
    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card label="Usuarios activos" value={`${activeUserCount}/${userCount}`} />
            <Card label="Sucursales" value={String(branchCount)} />
            <Card label="Ventas 30d" value={String(stats.salesCount30d)} />
            <Card
                label="Total ventas 30d"
                value={`$${stats.salesTotal30d.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            />
        </div>
    );
}

function Card({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-3xl border border-capsula-line bg-capsula-ivory-surface px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                {label}
            </div>
            <div className="mt-1 text-xl font-semibold tabular-nums text-capsula-ink">{value}</div>
        </div>
    );
}

function Section({
    title,
    icon,
    children,
}: {
    title: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <section className="space-y-3">
            <h2 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                {icon}
                {title}
            </h2>
            {children}
        </section>
    );
}

function OwnerResetPanel({
    owner,
    pending,
    resetResult,
    onReset,
    onClearResult,
}: {
    owner: { id: string; email: string } | null;
    pending: boolean;
    resetResult: string | null;
    onReset: (custom?: string) => void;
    onClearResult: () => void;
}) {
    const [custom, setCustom] = useState('');
    const [showCustom, setShowCustom] = useState(false);

    if (!owner) {
        return (
            <div className="rounded-3xl border border-capsula-line bg-capsula-ivory-surface p-5 text-sm text-capsula-ink-muted">
                Este tenant no tiene un usuario con rol OWNER.
            </div>
        );
    }

    return (
        <div className="rounded-3xl border border-capsula-line bg-capsula-ivory-surface p-5 space-y-3">
            <div className="text-sm">
                <span className="text-capsula-ink-muted">Owner:</span>{' '}
                <span className="font-mono text-capsula-ink">{owner.email}</span>
            </div>

            {resetResult && (
                <div className="rounded-2xl border border-capsula-line bg-[#F3EAD6] px-4 py-3 text-sm text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8]">
                    <div className="font-semibold mb-1">Password generada (cópiala ahora):</div>
                    <code className="block bg-capsula-ivory rounded-xl px-3 py-2 font-mono text-base text-capsula-ink select-all">
                        {resetResult}
                    </code>
                    <button
                        type="button"
                        onClick={onClearResult}
                        className="mt-2 text-[11px] uppercase tracking-[0.14em] text-capsula-ink-muted hover:text-capsula-coral"
                    >
                        Ocultar
                    </button>
                </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                        if (
                            !confirm(
                                `Resetear password del owner ${owner.email}? Se generará una password aleatoria y los JWTs activos serán invalidados.`,
                            )
                        )
                            return;
                        onReset(undefined);
                    }}
                    className="pos-btn inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
                >
                    <KeyRound className="h-4 w-4" />
                    Generar password aleatoria
                </button>
                <button
                    type="button"
                    onClick={() => setShowCustom((v) => !v)}
                    className="pos-btn-secondary inline-flex items-center gap-2 px-4 py-2 text-sm"
                >
                    {showCustom ? 'Cancelar custom' : 'Usar password custom'}
                </button>
            </div>

            {showCustom && (
                <div className="flex items-center gap-2">
                    <input
                        value={custom}
                        onChange={(e) => setCustom(e.target.value)}
                        placeholder="Password custom (≥ 8 chars)"
                        className="pos-input flex-1"
                        type="text"
                    />
                    <button
                        type="button"
                        disabled={pending || custom.length < 8}
                        onClick={() => {
                            if (
                                !confirm(
                                    `Resetear password del owner ${owner.email} a la password ingresada?`,
                                )
                            )
                                return;
                            onReset(custom);
                            setCustom('');
                            setShowCustom(false);
                        }}
                        className="pos-btn inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
                    >
                        <Check className="h-4 w-4" />
                        Aplicar
                    </button>
                </div>
            )}
        </div>
    );
}

function UsersTable({ users }: { users: UserRow[] }) {
    if (users.length === 0) {
        return (
            <div className="rounded-3xl border border-capsula-line bg-capsula-ivory-surface p-5 text-sm text-capsula-ink-muted">
                Sin usuarios.
            </div>
        );
    }
    return (
        <div className="overflow-x-auto rounded-3xl border border-capsula-line bg-capsula-ivory-surface">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-capsula-line">
                        <Th>Email</Th>
                        <Th>Nombre</Th>
                        <Th>Rol</Th>
                        <Th>Estado</Th>
                    </tr>
                </thead>
                <tbody>
                    {users.map((u) => (
                        <tr key={u.id} className="border-b border-capsula-line last:border-b-0">
                            <Td className="font-mono">{u.email}</Td>
                            <Td>{u.fullName || '—'}</Td>
                            <Td>
                                <span className="inline-flex items-center rounded-full bg-capsula-navy-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-navy-deep">
                                    {u.role}
                                </span>
                            </Td>
                            <Td>
                                {u.isActive ? (
                                    <span className="inline-flex items-center rounded-full bg-[#E5EDE7] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]">
                                        Activo
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center rounded-full bg-[#F7E3DB] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8]">
                                        Inactivo
                                    </span>
                                )}
                            </Td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function BranchesTable({ branches }: { branches: BranchRow[] }) {
    if (branches.length === 0) {
        return (
            <div className="rounded-3xl border border-capsula-line bg-capsula-ivory-surface p-5 text-sm text-capsula-ink-muted">
                Sin sucursales.
            </div>
        );
    }
    return (
        <div className="overflow-x-auto rounded-3xl border border-capsula-line bg-capsula-ivory-surface">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-capsula-line">
                        <Th>Código</Th>
                        <Th>Nombre</Th>
                        <Th>Estado</Th>
                        <Th>Creada</Th>
                    </tr>
                </thead>
                <tbody>
                    {branches.map((b) => (
                        <tr key={b.id} className="border-b border-capsula-line last:border-b-0">
                            <Td className="font-mono">{b.code}</Td>
                            <Td>{b.name}</Td>
                            <Td>{b.isActive ? 'Activa' : 'Inactiva'}</Td>
                            <Td className="text-capsula-ink-soft">
                                {new Date(b.createdAt).toLocaleDateString('es-VE', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                })}
                            </Td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function SalesTable({ sales }: { sales: SaleRow[] }) {
    if (sales.length === 0) {
        return (
            <div className="rounded-3xl border border-capsula-line bg-capsula-ivory-surface p-5 text-sm text-capsula-ink-muted">
                Sin ventas registradas.
            </div>
        );
    }
    return (
        <div className="overflow-x-auto rounded-3xl border border-capsula-line bg-capsula-ivory-surface">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-capsula-line">
                        <Th>Orden</Th>
                        <Th className="text-right">Total</Th>
                        <Th>Estado</Th>
                        <Th>Fecha</Th>
                    </tr>
                </thead>
                <tbody>
                    {sales.map((s) => (
                        <tr key={s.id} className="border-b border-capsula-line last:border-b-0">
                            <Td className="font-mono">{s.orderNumber}</Td>
                            <Td className="text-right tabular-nums">
                                ${s.total.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                            </Td>
                            <Td>{s.status}</Td>
                            <Td className="text-capsula-ink-soft">
                                {new Date(s.createdAt).toLocaleString('es-VE', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </Td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function PaymentsPanel({
    tenantId,
    payments,
    pending,
    onRecord,
    onDelete,
}: {
    tenantId: string;
    payments: PaymentRow[];
    pending: boolean;
    onRecord: (input: {
        tenantId: string;
        amount: number;
        currency: string;
        paidAt: string;
        method: string;
        periodStart?: string;
        periodEnd?: string;
        note?: string;
    }) => void;
    onDelete: (id: string) => void;
}) {
    const [showForm, setShowForm] = useState(false);
    const todayIso = new Date().toISOString().slice(0, 10);

    const totalUSD = payments
        .filter((p) => p.currency === 'USD')
        .reduce((sum, p) => sum + p.amount, 0);

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-capsula-ink-soft">
                    Total acumulado USD:{' '}
                    <span className="font-semibold tabular-nums text-capsula-ink">
                        ${totalUSD.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={() => setShowForm((v) => !v)}
                    className="pos-btn inline-flex items-center gap-2 px-4 py-2 text-sm"
                >
                    <Plus className="h-4 w-4" />
                    {showForm ? 'Cancelar' : 'Registrar pago'}
                </button>
            </div>

            {showForm && (
                <PaymentForm
                    tenantId={tenantId}
                    todayIso={todayIso}
                    pending={pending}
                    onSubmit={(input) => {
                        onRecord(input);
                        setShowForm(false);
                    }}
                />
            )}

            {payments.length === 0 ? (
                <div className="rounded-3xl border border-capsula-line bg-capsula-ivory-surface p-5 text-sm text-capsula-ink-muted">
                    Sin pagos registrados todavía.
                </div>
            ) : (
                <div className="overflow-x-auto rounded-3xl border border-capsula-line bg-capsula-ivory-surface">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-capsula-line">
                                <Th>Pagado</Th>
                                <Th className="text-right">Monto</Th>
                                <Th>Método</Th>
                                <Th>Período</Th>
                                <Th>Nota</Th>
                                <Th>Registrado por</Th>
                                <Th />
                            </tr>
                        </thead>
                        <tbody>
                            {payments.map((p) => (
                                <tr
                                    key={p.id}
                                    className="border-b border-capsula-line last:border-b-0"
                                >
                                    <Td>
                                        {new Date(p.paidAt).toLocaleDateString('es-VE', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric',
                                        })}
                                    </Td>
                                    <Td className="text-right tabular-nums font-semibold text-capsula-ink">
                                        {p.currency}{' '}
                                        {p.amount.toLocaleString('es-VE', {
                                            minimumFractionDigits: 2,
                                        })}
                                    </Td>
                                    <Td>{p.method}</Td>
                                    <Td className="text-capsula-ink-soft">
                                        {p.periodStart && p.periodEnd
                                            ? `${formatShort(p.periodStart)} → ${formatShort(p.periodEnd)}`
                                            : p.periodStart
                                              ? `desde ${formatShort(p.periodStart)}`
                                              : p.periodEnd
                                                ? `hasta ${formatShort(p.periodEnd)}`
                                                : '—'}
                                    </Td>
                                    <Td className="text-capsula-ink-soft">{p.note ?? '—'}</Td>
                                    <Td className="text-capsula-ink-muted text-xs">
                                        {p.recordedBy}
                                    </Td>
                                    <Td className="text-right">
                                        <button
                                            type="button"
                                            disabled={pending}
                                            onClick={() => {
                                                if (
                                                    !confirm(
                                                        `Eliminar pago de ${p.currency} ${p.amount}?`,
                                                    )
                                                )
                                                    return;
                                                onDelete(p.id);
                                            }}
                                            className="rounded-full p-1.5 text-capsula-ink-muted hover:bg-capsula-coral/10 hover:text-capsula-coral disabled:opacity-50"
                                            title="Eliminar"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </Td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function PaymentForm({
    tenantId,
    todayIso,
    pending,
    onSubmit,
}: {
    tenantId: string;
    todayIso: string;
    pending: boolean;
    onSubmit: (input: {
        tenantId: string;
        amount: number;
        currency: string;
        paidAt: string;
        method: string;
        periodStart?: string;
        periodEnd?: string;
        note?: string;
    }) => void;
}) {
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState('USD');
    const [paidAt, setPaidAt] = useState(todayIso);
    const [method, setMethod] = useState('transfer');
    const [periodStart, setPeriodStart] = useState('');
    const [periodEnd, setPeriodEnd] = useState('');
    const [note, setNote] = useState('');

    const amountNum = Number(amount);
    const valid = Number.isFinite(amountNum) && amountNum > 0 && method && paidAt;

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                if (!valid) return;
                onSubmit({
                    tenantId,
                    amount: amountNum,
                    currency,
                    paidAt,
                    method,
                    periodStart: periodStart || undefined,
                    periodEnd: periodEnd || undefined,
                    note: note.trim() || undefined,
                });
            }}
            className="rounded-3xl border border-capsula-line bg-capsula-ivory-surface p-5 space-y-3"
        >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Monto">
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="pos-input"
                        required
                    />
                </Field>
                <Field label="Moneda">
                    <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="pos-input"
                    >
                        <option value="USD">USD</option>
                        <option value="BSD">BSD</option>
                        <option value="EUR">EUR</option>
                    </select>
                </Field>
                <Field label="Fecha de pago">
                    <input
                        type="date"
                        value={paidAt}
                        onChange={(e) => setPaidAt(e.target.value)}
                        className="pos-input"
                        required
                    />
                </Field>
                <Field label="Método">
                    <select
                        value={method}
                        onChange={(e) => setMethod(e.target.value)}
                        className="pos-input"
                    >
                        <option value="transfer">Transferencia</option>
                        <option value="cash">Efectivo</option>
                        <option value="zelle">Zelle</option>
                        <option value="pdv">PDV / POS</option>
                        <option value="crypto">Crypto</option>
                        <option value="other">Otro</option>
                    </select>
                </Field>
                <Field label="Período desde (opcional)">
                    <input
                        type="date"
                        value={periodStart}
                        onChange={(e) => setPeriodStart(e.target.value)}
                        className="pos-input"
                    />
                </Field>
                <Field label="Período hasta (opcional)">
                    <input
                        type="date"
                        value={periodEnd}
                        onChange={(e) => setPeriodEnd(e.target.value)}
                        className="pos-input"
                    />
                </Field>
                <Field label="Nota" className="sm:col-span-2 lg:col-span-2">
                    <input
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="pos-input"
                        maxLength={200}
                        placeholder="opcional"
                    />
                </Field>
            </div>
            <div className="flex justify-end">
                <button
                    type="submit"
                    disabled={pending || !valid}
                    className="pos-btn inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
                >
                    <Check className="h-4 w-4" />
                    Guardar pago
                </button>
            </div>
        </form>
    );
}

function Field({
    label,
    children,
    className,
}: {
    label: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <label className={'block ' + (className ?? '')}>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                {label}
            </div>
            {children}
        </label>
    );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
    return (
        <th
            className={
                'px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted ' +
                (className ?? '')
            }
        >
            {children}
        </th>
    );
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
    return <td className={'px-4 py-3 ' + (className ?? '')}>{children}</td>;
}

function formatShort(iso: string): string {
    return new Date(iso).toLocaleDateString('es-VE', {
        year: '2-digit',
        month: 'short',
        day: 'numeric',
    });
}
