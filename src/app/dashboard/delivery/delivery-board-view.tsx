'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
    Truck,
    Phone,
    MapPin,
    ChevronRight,
    Ban,
    Clock,
    RefreshCw,
    Inbox,
    Check,
    Receipt,
    Bike,
} from 'lucide-react';
import {
    nextStates,
    type DeliveryState,
} from '@/lib/delivery/state-machine';
import {
    listDeliveryOrdersAction,
    transitionDeliveryOrderAction,
    validateDeliveryPaymentAction,
    assignDriverAction,
    type DeliveryOrderRow,
    type DeliveryDriverRow,
} from '@/app/actions/delivery.actions';

// Columnas del flujo feliz (CANCELADA se muestra como contador aparte).
const FLOW: { state: DeliveryState; label: string }[] = [
    { state: 'ESPERANDO_PAGO', label: 'Esperando pago' },
    { state: 'PAGO_POR_VALIDAR', label: 'Pago por validar' },
    { state: 'EN_COCINA', label: 'En cocina' },
    { state: 'LISTA', label: 'Lista' },
    { state: 'EN_CAMINO', label: 'En camino' },
    { state: 'ENTREGADA', label: 'Entregada' },
];

const STATE_LABEL: Record<string, string> = {
    ...Object.fromEntries(FLOW.map(f => [f.state, f.label])),
    CANCELADA: 'Cancelada',
};

// Tonos sutiles autorizados (ok/warn/danger/info) con override dark.
const STATE_TONE: Record<string, string> = {
    ESPERANDO_PAGO: 'bg-[#F3EAD6] text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8]',
    PAGO_POR_VALIDAR: 'bg-[#E6ECF4] text-[#2A4060] dark:bg-[#1A2636] dark:text-[#D1DCE9]',
    EN_COCINA: 'bg-[#E6ECF4] text-[#2A4060] dark:bg-[#1A2636] dark:text-[#D1DCE9]',
    LISTA: 'bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]',
    EN_CAMINO: 'bg-[#E6ECF4] text-[#2A4060] dark:bg-[#1A2636] dark:text-[#D1DCE9]',
    ENTREGADA: 'bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]',
    CANCELADA: 'bg-[#F7E3DB] text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8]',
};

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'ahora';
    if (min < 60) return `hace ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `hace ${h} h`;
    return `hace ${Math.floor(h / 24)} d`;
}

export function DeliveryBoardView({
    initialOrders,
    branches,
    drivers,
}: {
    initialOrders: DeliveryOrderRow[];
    branches: { id: string; name: string }[];
    drivers: DeliveryDriverRow[];
}) {
    const router = useRouter();
    const [orders, setOrders] = useState(initialOrders);
    const [branchFilter, setBranchFilter] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const filtered = useMemo(
        () => (branchFilter ? orders.filter(o => o.branchId === branchFilter) : orders),
        [orders, branchFilter],
    );

    const byState = useMemo(() => {
        const map = new Map<string, DeliveryOrderRow[]>();
        for (const o of filtered) {
            const list = map.get(o.status) ?? [];
            list.push(o);
            map.set(o.status, list);
        }
        return map;
    }, [filtered]);

    const canceladasCount = (byState.get('CANCELADA') ?? []).length;

    async function refresh() {
        const res = await listDeliveryOrdersAction(
            branchFilter ? { branchId: branchFilter } : undefined,
        );
        if (res.success) setOrders(res.orders);
    }

    function transition(orderId: string, to: DeliveryState, reason?: string) {
        setError(null);
        startTransition(async () => {
            const res = await transitionDeliveryOrderAction(orderId, to, reason);
            if (!res.success) {
                setError(res.message ?? 'No se pudo actualizar la orden.');
                return;
            }
            // Optimista local + refresh del server.
            setOrders(prev =>
                prev.map(o =>
                    o.id === orderId ? { ...o, status: to } : o,
                ),
            );
            router.refresh();
        });
    }

    function validate(orderId: string) {
        setError(null);
        startTransition(async () => {
            const res = await validateDeliveryPaymentAction(orderId);
            if (!res.success) {
                setError(res.message ?? 'No se pudo validar el pago.');
                return;
            }
            setOrders(prev =>
                prev.map(o => (o.id === orderId ? { ...o, status: 'EN_COCINA' } : o)),
            );
            router.refresh();
        });
    }

    function assign(orderId: string, driverId: string) {
        setError(null);
        startTransition(async () => {
            const res = await assignDriverAction(orderId, driverId);
            if (!res.success) {
                setError(res.message ?? 'No se pudo asignar el motorizado.');
                return;
            }
            const dn = drivers.find(d => d.id === driverId)?.name ?? null;
            setOrders(prev =>
                prev.map(o =>
                    o.id === orderId
                        ? { ...o, status: 'EN_CAMINO', driverId, driverName: dn }
                        : o,
                ),
            );
            router.refresh();
        });
    }

    const availableDrivers = drivers.filter(d => d.isActive);

    return (
        <div className="p-4 sm:p-6 space-y-5">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="h-10 w-10 rounded-2xl bg-capsula-navy-deep text-capsula-cream flex items-center justify-center">
                        <Truck className="h-5 w-5" />
                    </span>
                    <div>
                        <h1 className="font-semibold text-xl tracking-[-0.02em] text-capsula-ink">
                            Gestión de Deliverys
                        </h1>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                            Centro de operaciones · {filtered.length} órdenes
                            {canceladasCount > 0 ? ` · ${canceladasCount} canceladas` : ''}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {branches.length > 0 && (
                        <select
                            value={branchFilter}
                            onChange={e => setBranchFilter(e.target.value)}
                            className="pos-input h-10 text-sm"
                        >
                            <option value="">Todas las sedes</option>
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>
                                    {b.name}
                                </option>
                            ))}
                        </select>
                    )}
                    <button
                        onClick={() => startTransition(refresh)}
                        disabled={pending}
                        className="pos-btn-secondary h-10 px-3 inline-flex items-center gap-2 disabled:opacity-50"
                    >
                        <RefreshCw className={`h-4 w-4 ${pending ? 'animate-spin' : ''}`} />
                        Refrescar
                    </button>
                </div>
            </div>

            {error && (
                <div className="rounded-2xl border border-capsula-line bg-[#F7E3DB] text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8] px-4 py-3 text-sm">
                    {error}
                </div>
            )}

            {/* Tablero */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3">
                {FLOW.map(col => {
                    const list = byState.get(col.state) ?? [];
                    return (
                        <div key={col.state} className="pos-panel min-h-[120px] p-3 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                                    {col.label}
                                </span>
                                <span className="text-xs font-semibold tabular-nums text-capsula-ink-soft bg-capsula-ivory-alt rounded-full px-2 py-0.5">
                                    {list.length}
                                </span>
                            </div>

                            {list.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-6 text-capsula-ink-faint">
                                    <Inbox className="h-5 w-5 mb-1" />
                                    <span className="text-[11px]">vacío</span>
                                </div>
                            ) : (
                                list.map(o => (
                                    <OrderCard
                                        key={o.id}
                                        order={o}
                                        pending={pending}
                                        drivers={availableDrivers}
                                        onAdvance={(to) => transition(o.id, to)}
                                        onValidate={() => validate(o.id)}
                                        onAssign={(driverId) => assign(o.id, driverId)}
                                        onCancel={(reason) => transition(o.id, 'CANCELADA', reason)}
                                    />
                                ))
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

const PROOF_LABEL: Record<string, string> = {
    billetes: 'billetes',
    pago_movil: 'pago móvil',
    transferencia: 'transferencia',
};

function OrderCard({
    order,
    pending,
    drivers,
    onAdvance,
    onValidate,
    onAssign,
    onCancel,
}: {
    order: DeliveryOrderRow;
    pending: boolean;
    drivers: DeliveryDriverRow[];
    onAdvance: (to: DeliveryState) => void;
    onValidate: () => void;
    onAssign: (driverId: string) => void;
    onCancel: (reason: string) => void;
}) {
    const succ = nextStates(order.status as DeliveryState);
    const terminal = succ.length === 0;
    const advance = succ.find(s => s !== 'CANCELADA') as DeliveryState | undefined;
    const isValidation = order.status === 'PAGO_POR_VALIDAR';
    const isAssignment = order.status === 'LISTA';
    const [pickedDriver, setPickedDriver] = useState('');

    function handleCancel() {
        const reason = window.prompt('Motivo de la cancelación:');
        if (reason && reason.trim()) onCancel(reason.trim());
    }

    return (
        <div className="pos-card p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
                <span className="font-semibold tabular-nums text-capsula-ink tracking-[-0.01em]">
                    {order.correlative}
                </span>
                <span
                    className={`text-[10px] font-semibold uppercase tracking-[0.1em] rounded-full px-2 py-0.5 ${STATE_TONE[order.status] ?? ''}`}
                >
                    {STATE_LABEL[order.status] ?? order.status}
                </span>
            </div>

            {order.customerName && (
                <p className="text-sm font-medium text-capsula-ink truncate">{order.customerName}</p>
            )}
            {order.customerPhone && (
                <p className="text-xs text-capsula-ink-muted inline-flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {order.customerPhone}
                </p>
            )}
            {order.deliveryAddress && (
                <p className="text-xs text-capsula-ink-muted inline-flex items-start gap-1">
                    <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                    <span className="line-clamp-2">{order.deliveryAddress}</span>
                </p>
            )}

            <div className="flex items-center justify-between text-[11px] text-capsula-ink-faint">
                <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {timeAgo(order.createdAt)}
                </span>
                {order.branchName && <span className="truncate">{order.branchName}</span>}
            </div>

            {order.totalUsd != null && (
                <p className="text-sm font-semibold tabular-nums text-capsula-ink">
                    ${order.totalUsd.toFixed(2)}
                    {order.totalBs != null && (
                        <span className="text-xs font-normal text-capsula-ink-muted">
                            {' '}· Bs {order.totalBs.toFixed(2)}
                        </span>
                    )}
                </p>
            )}

            {order.paymentProofPath && (
                <a
                    href={order.paymentProofPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-capsula-coral inline-flex items-center gap-1 hover:underline"
                >
                    <Receipt className="h-3 w-3" />
                    Ver comprobante
                    {order.paymentProofType
                        ? ` · ${PROOF_LABEL[order.paymentProofType] ?? order.paymentProofType}`
                        : ''}
                </a>
            )}

            {order.driverName && (
                <p className="text-xs text-capsula-ink-muted inline-flex items-center gap-1">
                    <Bike className="h-3 w-3" /> {order.driverName}
                </p>
            )}

            {isAssignment && !terminal && (
                <div className="flex gap-2 pt-1">
                    <select
                        value={pickedDriver}
                        onChange={e => setPickedDriver(e.target.value)}
                        disabled={pending}
                        className="pos-input flex-1 text-xs py-1.5"
                    >
                        <option value="">
                            {drivers.length ? 'Motorizado…' : 'Sin motorizados'}
                        </option>
                        {drivers.map(d => (
                            <option key={d.id} value={d.id}>
                                {d.name}
                                {d.status === 'ON_ROUTE' ? ' (en ruta)' : ''}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={() => pickedDriver && onAssign(pickedDriver)}
                        disabled={pending || !pickedDriver}
                        className="pos-btn py-1.5 px-3 text-xs inline-flex items-center justify-center gap-1 disabled:opacity-50"
                        title="Asignar motorizado y enviar en camino"
                    >
                        <Bike className="h-3.5 w-3.5" /> Asignar
                    </button>
                </div>
            )}

            {!terminal && !isAssignment && (
                <div className="flex gap-2 pt-1">
                    {isValidation ? (
                        <button
                            onClick={onValidate}
                            disabled={pending}
                            className="pos-btn flex-1 py-2 text-sm inline-flex items-center justify-center gap-1 disabled:opacity-50"
                            title="Validar pago y enviar a cocina"
                        >
                            <Check className="h-4 w-4" /> Validar pago
                        </button>
                    ) : advance ? (
                        <button
                            onClick={() => onAdvance(advance)}
                            disabled={pending}
                            className="pos-btn flex-1 py-2 text-sm inline-flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                            {STATE_LABEL[advance]} <ChevronRight className="h-4 w-4" />
                        </button>
                    ) : null}
                    <button
                        onClick={handleCancel}
                        disabled={pending}
                        className="pos-btn-danger py-2 px-3 text-sm inline-flex items-center justify-center disabled:opacity-50"
                        title="Anular orden"
                    >
                        <Ban className="h-4 w-4" />
                    </button>
                </div>
            )}

            {isAssignment && (
                <button
                    onClick={handleCancel}
                    disabled={pending}
                    className="pos-btn-danger w-full py-1.5 text-xs inline-flex items-center justify-center gap-1 disabled:opacity-50"
                    title="Anular orden"
                >
                    <Ban className="h-3.5 w-3.5" /> Anular
                </button>
            )}
        </div>
    );
}
