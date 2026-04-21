'use client';

import React, { useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { createRequisition, dispatchRequisition, approveRequisition, rejectRequisition, receiveRequisition, completeRequisition } from '@/app/actions/requisition.actions';
import { formatNumber, cn } from '@/lib/utils';
import { UserRole } from '@/types';
import {
    Trash2, FileEdit, Clock, History, Inbox, Plus, Send, Package,
    CheckCircle2, XCircle, ClipboardCheck, ChevronRight, FileDown,
    User, Calendar, Truck,
} from 'lucide-react';
import { Combobox } from '@/components/ui/combobox';
import { QuickCreateItemDialog } from '@/components/ui/quick-create-item-dialog';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/Badge';

// Tipos locales para props
interface Item {
    id: string;
    name: string;
    baseUnit: string;
    currentStock?: number;
}

interface Area {
    id: string;
    name: string;
}

interface Requisition {
    id: string;
    code: string;
    status: string;
    requestedBy: { firstName: string; lastName: string };
    processedBy: { firstName: string; lastName: string } | null;
    dispatchedBy?: { firstName: string; lastName: string } | null;
    receivedBy?: { firstName: string; lastName: string } | null;
    dispatchedAt?: Date | null;
    receivedAt?: Date | null;
    targetArea: { name: string };
    sourceArea: { name: string } | null;
    createdAt: Date;
    notes?: string | null;
    items: {
        inventoryItemId: string;
        inventoryItem: { name: string; sku: string; baseUnit: string };
        quantity: number;
        sentQuantity?: number | null;
        receivedQuantity?: number | null;
        dispatchedQuantity: number | null;
    }[];
}

interface Props {
    itemsList: Item[];
    areasList: Area[];
    initialRequisitions: Requisition[];
}

interface TransferItemRowProps {
    index: number;
    item: { id: string, name: string, quantity: number, unit: string };
    itemsList: Item[];
    onUpdate: (index: number, updates: Partial<{ id: string, name: string, quantity: number, unit: string }>) => void;
    onRemove: (index: number) => void;
    onRequestCreate: (searchTerm: string, rowIndex: number) => void;
}

function TransferItemRow({ index, item, itemsList, onUpdate, onRemove, onRequestCreate }: TransferItemRowProps) {
    // Map items for Combobox
    const comboboxItems = itemsList.map(i => ({ value: i.id, label: i.name }));

    return (
        <tr className="border-b border-capsula-line last:border-b-0">
            <td className="p-2">
                <Combobox
                    items={comboboxItems}
                    value={item.id}
                    onChange={(val) => {
                        const selected = itemsList.find(i => i.id === val);
                        if (selected) {
                            onUpdate(index, {
                                id: selected.id,
                                name: selected.name,
                                unit: selected.baseUnit
                            });
                        }
                    }}
                    placeholder="Seleccionar ítem…"
                    searchPlaceholder="Buscar ítem…"
                    className="w-full justify-between"
                    allowCreate={true}
                    onCreateNew={(term) => onRequestCreate(term, index)}
                />
            </td>
            <td className="p-2">
                <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={item.quantity === 0 ? '' : item.quantity}
                    onChange={e => {
                        const val = parseFloat(e.target.value);
                        onUpdate(index, { quantity: isNaN(val) ? 0 : val });
                    }}
                    placeholder="0"
                    className="min-h-[40px] w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2 text-center font-mono text-[13px] text-capsula-ink outline-none transition-colors focus:border-capsula-navy-deep"
                />
            </td>
            <td className="p-2 text-center font-mono text-[11px] text-capsula-ink-muted">
                {item.unit}
            </td>
            <td className="p-2 text-center">
                <button
                    onClick={() => onRemove(index)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-capsula-ink-muted transition-colors hover:bg-capsula-coral-subtle hover:text-capsula-coral"
                    title="Eliminar fila"
                >
                    <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                </button>
            </td>
        </tr>
    );
}

export default function TransferenciasView({ itemsList: initialItemsList, areasList, initialRequisitions }: Props) {
    const { user } = useAuthStore();
    const [activeTab, setActiveTab] = useState<'NEW' | 'PENDING' | 'HISTORY'>('NEW');
    const [requisitions, setRequisitions] = useState<Requisition[]>(initialRequisitions);
    const [itemsList, setItemsList] = useState<Item[]>(initialItemsList);

    // --- ESTADOS DE NUEVA SOLICITUD ---
    const [targetAreaId, setTargetAreaId] = useState('');
    const [sourceAreaId, setSourceAreaId] = useState(''); // Opcional, backend usa default

    // Lista dinámica de items { id, name, quantity, unit }
    const [requestItems, setRequestItems] = useState<{ id: string, name: string, quantity: number, unit: string }[]>([
        { id: '', name: '', quantity: 0, unit: '-' }
    ]);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Estado para expandir/colapsar historial
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // --- ESTADOS DE DESPACHO ESCALONADO ---
    const [dispatchQuantities, setDispatchQuantities] = useState<Record<string, number>>({});

    // --- ESTADOS DE RECEPCIÓN (Jefe de Cocina) ---
    const [receiveQuantities, setReceiveQuantities] = useState<Record<string, number>>({});
    const [receiveNotes, setReceiveNotes] = useState('');

    // --- ESTADOS DE CREACIÓN RÁPIDA ---
    const [showQuickCreate, setShowQuickCreate] = useState(false);
    const [quickCreateName, setQuickCreateName] = useState('');
    const [quickCreateRowIndex, setQuickCreateRowIndex] = useState<number>(0);

    // --- MANEJADORES ---

    const handleCreateRequisition = async () => {
        const validItems = requestItems.filter(i => i.id && i.quantity > 0);

        if (!targetAreaId || validItems.length === 0) {
            setMsg({ type: 'error', text: 'Selecciona un área y agrega al menos un item válido.' });
            return;
        }

        if (sourceAreaId === targetAreaId) {
            setMsg({ type: 'error', text: 'El origen y destino no pueden ser iguales.' });
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await createRequisition({
                requestedById: user?.id || 'cmkvq94uo0000ua0ns6g844yr',
                targetAreaId,
                sourceAreaId: sourceAreaId || undefined, // Si está vacío, undefined (backend usa default)
                items: validItems.map(i => ({
                    inventoryItemId: i.id,
                    quantity: i.quantity,
                    unit: i.unit
                }))
            });

            if (res.success) {
                setMsg({ type: 'success', text: res.message });
                setRequestItems([{ id: '', name: '', quantity: 0, unit: '-' }]);
                setTargetAreaId('');
                setTimeout(() => window.location.reload(), 1000);
            } else {
                setMsg({ type: 'error', text: res.message });
            }
        } catch (e) {
            setMsg({ type: 'error', text: 'Error de conexión' });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Despachar (Jefe de Producción) — paso intermedio
    const handleDispatch = async (req: Requisition) => {
        if (!confirm(`¿Confirmas el despacho de ${req.code}?`)) return;
        setIsSubmitting(true);

        const items = req.items.map(i => ({
            inventoryItemId: i.inventoryItemId,
            sentQuantity: dispatchQuantities[i.inventoryItemId] ?? i.quantity
        }));

        const res = await dispatchRequisition({
            requisitionId: req.id,
            dispatchedById: user?.id || '',
            items
        });

        if (res.success) {
            alert('📦 Despacho registrado. Pendiente de aprobación.');
            window.location.reload();
        } else {
            alert('❌ Error: ' + res.message);
        }
        setIsSubmitting(false);
    };

    // Aprobar (Gerente) — paso final, mueve inventario
    const handleApprove = async (req: Requisition) => {
        if (!confirm(`¿Confirmas la recepción de ${req.code}? Esto moverá el inventario.`)) return;
        setIsSubmitting(true);

        const itemsToDispatch = req.items.map(i => ({
            inventoryItemId: i.inventoryItemId,
            dispatchedQuantity: i.sentQuantity || i.dispatchedQuantity || i.quantity
        }));

        const res = await approveRequisition({
            requisitionId: req.id,
            processedById: user?.id || '',
            items: itemsToDispatch
        });

        if (res.success) {
            alert('✅ Transferencia aprobada y stock movido.');
            window.location.reload();
        } else {
            alert('❌ Error: ' + res.message);
        }
        setIsSubmitting(false);
    };

    const handleReject = async (req: Requisition) => {
        if (!confirm(`¿Estás seguro de rechazar la solicitud ${req.code}?`)) return;
        setIsSubmitting(true);

        const res = await rejectRequisition(
            req.id,
            user?.id || ''
        );

        if (res.success) {
            alert('❌ Solicitud rechazada.');
            window.location.reload();
        } else {
            alert('Error: ' + res.message);
        }
        setIsSubmitting(false);
    };

    // Recibir (Jefe de Cocina) — verifica cantidades recibidas
    const handleReceive = async (req: Requisition) => {
        if (!confirm(`¿Confirmas la recepción de ${req.code}?`)) return;
        setIsSubmitting(true);

        const items = req.items.map(i => ({
            inventoryItemId: i.inventoryItemId,
            receivedQuantity: receiveQuantities[i.inventoryItemId] ?? (i.sentQuantity ?? i.dispatchedQuantity ?? i.quantity)
        }));

        const res = await receiveRequisition({
            requisitionId: req.id,
            receivedById: user?.id || '',
            items,
            notes: receiveNotes || undefined
        });

        if (res.success) {
            alert('✅ Recepción confirmada.');
            setReceiveNotes('');
            window.location.reload();
        } else {
            alert('❌ Error: ' + res.message);
        }
        setIsSubmitting(false);
    };

    // Completar (marcar transferencia recibida como cerrada)
    const handleComplete = async (req: Requisition) => {
        if (!confirm(`¿Marcar la transferencia ${req.code} como completada?`)) return;
        setIsSubmitting(true);

        const res = await completeRequisition(req.id, user?.id || '');

        if (res.success) {
            alert('✅ Transferencia marcada como completada.');
            window.location.reload();
        } else {
            alert('❌ Error: ' + res.message);
        }
        setIsSubmitting(false);
    };

    // --- FILTROS DE LISTA ---
    const pendingReqs = requisitions.filter(r => r.status === 'PENDING');
    const dispatchedReqs = requisitions.filter(r => r.status === 'DISPATCHED');
    const activeReqs = [...pendingReqs, ...dispatchedReqs];
    const historyReqs = requisitions.filter(r => !['PENDING', 'DISPATCHED'].includes(r.status)).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Permisos simples (Mejora futura: usar hook de permisos)
    // Asumimos que cualquiera puede pedir, pero aprobar/rechazar requiere rol > CHEF
    // Por ahora mostramos botones a todos, el backend valida si acaso.

    const tabConfig: { id: 'NEW' | 'PENDING' | 'HISTORY'; label: string; icon: typeof FileEdit; count?: number }[] = [
        { id: 'NEW', label: 'Nueva solicitud', icon: FileEdit },
        { id: 'PENDING', label: 'En proceso', icon: Clock, count: activeReqs.length },
        { id: 'HISTORY', label: 'Historial', icon: History },
    ];

    return (
        <div className="mx-auto max-w-[1400px] animate-in">
            <PageHeader
                kicker="Inventario"
                title="Transferencias"
                description="Mueve stock entre áreas con trazabilidad de requisición, despacho y recepción."
            />

            {/* TABS */}
            <div className="mb-6 inline-flex rounded-full border border-capsula-line bg-capsula-ivory-surface p-1">
                {tabConfig.map(tab => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                'inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-medium transition-colors',
                                active
                                    ? 'bg-capsula-navy-deep text-capsula-ivory'
                                    : 'text-capsula-ink-muted hover:text-capsula-ink'
                            )}
                        >
                            <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                            {tab.label}
                            {tab.count !== undefined && tab.count > 0 && (
                                <span className={cn(
                                    'ml-1 inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold',
                                    active
                                        ? 'bg-capsula-ivory/20 text-capsula-ivory'
                                        : 'bg-capsula-coral-subtle text-capsula-coral'
                                )}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* CONTENIDO */}
            <div className="min-h-[500px]">
                {/* 1. NUEVA SOLICITUD */}
                {activeTab === 'NEW' && (
                    <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-6 shadow-cap-soft sm:p-8">
                        <div className="mb-8 flex items-start justify-between gap-4">
                            <div>
                                <div className="mb-2 text-[11px] uppercase tracking-[0.12em] text-capsula-ink-muted">Gestión</div>
                                <h3 className="font-heading text-[24px] leading-tight tracking-[-0.01em] text-capsula-navy-deep">
                                    Nueva requisición
                                </h3>
                                <p className="mt-1 text-[13px] text-capsula-ink-soft">
                                    Solicita insumos desde un área origen hacia un área destino.
                                </p>
                            </div>
                            <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory">
                                <Inbox className="h-5 w-5 text-capsula-navy" strokeWidth={1.5} />
                            </div>
                        </div>

                        <div className="mb-8 grid gap-5 sm:grid-cols-2">
                            <div>
                                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">
                                    Punto de origen
                                </label>
                                <Combobox
                                    items={areasList.map(a => ({ value: a.id, label: a.name }))}
                                    value={sourceAreaId}
                                    onChange={setSourceAreaId}
                                    placeholder="Seleccionar origen…"
                                    searchPlaceholder="Buscar área…"
                                    className="w-full justify-between"
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">
                                    Punto de destino
                                </label>
                                <Combobox
                                    items={areasList.map(a => ({ value: a.id, label: a.name }))}
                                    value={targetAreaId}
                                    onChange={setTargetAreaId}
                                    placeholder="Seleccionar destino…"
                                    searchPlaceholder="Buscar área…"
                                    className="w-full justify-between"
                                />
                            </div>
                        </div>

                        {/* Tabla de Items */}
                        <div className="mb-6 overflow-hidden rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface">
                            <table className="w-full border-collapse text-[13px]">
                                <thead>
                                    <tr className="border-b border-capsula-line bg-capsula-ivory">
                                        <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Insumo</th>
                                        <th className="w-32 px-5 py-3 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Cantidad</th>
                                        <th className="w-24 px-5 py-3 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Unidad</th>
                                        <th className="w-12 px-5 py-3"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {requestItems.map((item, index) => (
                                        <TransferItemRow
                                            key={index}
                                            index={index}
                                            item={item}
                                            itemsList={itemsList}
                                            onUpdate={(idx, updates) => {
                                                const newItems = [...requestItems];
                                                newItems[idx] = { ...newItems[idx], ...updates };
                                                setRequestItems(newItems);
                                            }}
                                            onRemove={(idx) => {
                                                if (requestItems.length > 1) {
                                                    const newItems = requestItems.filter((_, i) => i !== idx);
                                                    setRequestItems(newItems);
                                                } else {
                                                    setRequestItems([{ id: '', name: '', quantity: 0, unit: '-' }]);
                                                }
                                            }}
                                            onRequestCreate={(term, rowIdx) => {
                                                setQuickCreateName(term);
                                                setQuickCreateRowIndex(rowIdx);
                                                setShowQuickCreate(true);
                                            }}
                                        />
                                    ))}
                                </tbody>
                            </table>

                            <button
                                onClick={() => setRequestItems([...requestItems, { id: '', name: '', quantity: 0, unit: '-' }])}
                                className="flex w-full items-center justify-center gap-2 border-t border-capsula-line bg-capsula-ivory py-3 text-[12px] font-medium text-capsula-navy transition-colors hover:bg-capsula-ivory-alt"
                            >
                                <Plus className="h-3.5 w-3.5" strokeWidth={2} /> Agregar otra fila
                            </button>
                        </div>

                        {/* Acciones */}
                        <div className="flex flex-col items-end gap-4 border-t border-capsula-line pt-6">
                            {msg && (
                                <div className={cn(
                                    'inline-flex items-center gap-2 rounded-[var(--radius)] border px-4 py-2 text-[13px] font-medium',
                                    msg.type === 'success'
                                        ? 'border-[#D3E2D8] bg-[#E5EDE7] text-[#2F6B4E]'
                                        : 'border-[#EFD2C8] bg-[#F7E3DB] text-[#B04A2E]',
                                )}>
                                    {msg.type === 'success'
                                        ? <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
                                        : <XCircle className="h-4 w-4" strokeWidth={1.5} />}
                                    {msg.text}
                                </div>
                            )}

                            <Button
                                onClick={handleCreateRequisition}
                                disabled={isSubmitting || requestItems.filter(i => i.id && i.quantity > 0).length === 0 || !targetAreaId}
                                isLoading={isSubmitting}
                                variant="primary"
                                size="lg"
                            >
                                <Send className="h-4 w-4" strokeWidth={1.5} />
                                {isSubmitting ? 'Procesando…' : 'Enviar requisición'}
                            </Button>
                        </div>
                    </div>
                )}

                {/* 2. EN PROCESO (PENDIENTES + DESPACHADAS) */}
                {activeTab === 'PENDING' && (
                    <div className="space-y-8">
                        {activeReqs.length === 0 ? (
                            <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface py-20 text-center">
                                <Inbox className="mx-auto mb-4 h-10 w-10 text-capsula-ink-faint" strokeWidth={1.5} />
                                <p className="text-[14px] font-medium text-capsula-ink">Bandeja vacía</p>
                                <p className="mt-1 text-[12px] text-capsula-ink-muted">No hay solicitudes en curso actualmente</p>
                            </div>
                        ) : (
                            <>
                                {/* Sección PENDING — Esperando despacho */}
                                {pendingReqs.length > 0 && (
                                    <div className="space-y-3">
                                        <h3 className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">
                                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-capsula-line bg-capsula-ivory font-mono text-[11px] text-capsula-navy">1</span>
                                            Esperando despacho ({pendingReqs.length})
                                        </h3>
                                        <div className="grid gap-4">
                                            {pendingReqs.map(req => (
                                                <div key={req.id} className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-5 shadow-cap-soft transition-colors hover:border-capsula-line-strong">
                                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                                        <div>
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className="font-mono text-[15px] font-semibold text-capsula-navy-deep">{req.code}</span>
                                                                <Badge variant="warn">Pendiente</Badge>
                                                            </div>
                                                            <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
                                                                <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory px-3 py-1.5">
                                                                    <span className="block text-[10px] uppercase tracking-[0.08em] text-capsula-ink-muted">Origen</span>
                                                                    <span className="font-medium text-capsula-ink">{req.sourceArea?.name || 'Almacén central'}</span>
                                                                </div>
                                                                <ChevronRight className="h-4 w-4 text-capsula-ink-faint" strokeWidth={1.5} />
                                                                <div className="rounded-[var(--radius)] border border-capsula-navy/10 bg-capsula-navy-soft px-3 py-1.5">
                                                                    <span className="block text-[10px] uppercase tracking-[0.08em] text-capsula-navy">Destino</span>
                                                                    <span className="font-medium text-capsula-navy-deep">{req.targetArea.name}</span>
                                                                </div>
                                                            </div>
                                                            <p className="mt-3 flex items-center gap-2 text-[11px] text-capsula-ink-muted">
                                                                <User className="h-3 w-3" strokeWidth={1.5} /> {req.requestedBy.firstName} {req.requestedBy.lastName}
                                                                <span className="text-capsula-ink-faint">·</span>
                                                                <Calendar className="h-3 w-3" strokeWidth={1.5} /> {new Date(req.createdAt).toLocaleString('es-VE')}
                                                            </p>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            <Button variant="outline" size="sm" onClick={() => handleReject(req)} disabled={isSubmitting}>
                                                                <XCircle className="h-3.5 w-3.5" strokeWidth={1.5} /> Rechazar
                                                            </Button>
                                                            <Button variant="primary" size="sm" onClick={() => handleDispatch(req)} disabled={isSubmitting}>
                                                                <Package className="h-3.5 w-3.5" strokeWidth={1.5} /> Despachar
                                                            </Button>
                                                            <Button variant="secondary" size="sm" onClick={() => handleApprove(req)} disabled={isSubmitting}>
                                                                <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.5} /> Aprobar directo
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    <div className="mt-5 border-t border-capsula-line pt-4">
                                                        <label className="mb-3 block text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">
                                                            Detalle de solicitud (ajusta si despachas menos)
                                                        </label>
                                                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                                            {req.items.map(item => (
                                                                <div key={item.inventoryItemId} className="flex items-center justify-between rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory px-3 py-2">
                                                                    <div className="mr-3 min-w-0 flex-1">
                                                                        <span className="block truncate text-[12px] font-medium text-capsula-ink">{item.inventoryItem.name}</span>
                                                                        <span className="text-[11px] text-capsula-ink-muted">Pedido: {formatNumber(item.quantity)} {item.inventoryItem.baseUnit}</span>
                                                                    </div>
                                                                    <input
                                                                        type="number"
                                                                        inputMode="decimal"
                                                                        min={0}
                                                                        defaultValue={item.quantity}
                                                                        onChange={e => setDispatchQuantities(prev => ({ ...prev, [item.inventoryItemId]: parseFloat(e.target.value) || 0 }))}
                                                                        className="w-20 rounded border border-capsula-line bg-capsula-ivory-surface px-2 py-1 text-center font-mono text-[12.5px] font-semibold text-capsula-ink outline-none focus:border-capsula-navy-deep"
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Sección DISPATCHED — Pendiente de recepción */}
                                {dispatchedReqs.length > 0 && (
                                    <div className="space-y-3">
                                        <h3 className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">
                                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-capsula-line bg-capsula-ivory font-mono text-[11px] text-capsula-navy">2</span>
                                            En tránsito — pendiente de recepción ({dispatchedReqs.length})
                                        </h3>
                                        <div className="grid gap-4">
                                            {dispatchedReqs.map(req => (
                                                <div key={req.id} className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-5 shadow-cap-soft transition-colors hover:border-capsula-line-strong">
                                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                                        <div>
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className="font-mono text-[15px] font-semibold text-capsula-navy-deep">{req.code}</span>
                                                                <Badge variant="info">
                                                                    <Truck className="h-3 w-3" strokeWidth={1.5} /> Despachado
                                                                </Badge>
                                                            </div>
                                                            <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
                                                                <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory px-3 py-1.5">
                                                                    <span className="block text-[10px] uppercase tracking-[0.08em] text-capsula-ink-muted">Desde</span>
                                                                    <span className="font-medium text-capsula-ink">{req.sourceArea?.name || 'Almacén central'}</span>
                                                                </div>
                                                                <ChevronRight className="h-4 w-4 text-capsula-ink-faint" strokeWidth={1.5} />
                                                                <div className="rounded-[var(--radius)] border border-capsula-navy/10 bg-capsula-navy-soft px-3 py-1.5">
                                                                    <span className="block text-[10px] uppercase tracking-[0.08em] text-capsula-navy">Hacia</span>
                                                                    <span className="font-medium text-capsula-navy-deep">{req.targetArea.name}</span>
                                                                </div>
                                                            </div>
                                                            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-capsula-ink-muted">
                                                                <User className="h-3 w-3" strokeWidth={1.5} /> {req.requestedBy.firstName}
                                                                <span className="text-capsula-ink-faint">·</span>
                                                                <Send className="h-3 w-3" strokeWidth={1.5} /> {req.dispatchedBy?.firstName || '—'}
                                                                <span className="text-capsula-ink-faint">·</span>
                                                                <Calendar className="h-3 w-3" strokeWidth={1.5} /> {req.dispatchedAt && new Date(req.dispatchedAt).toLocaleString('es-VE')}
                                                            </p>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            <Button variant="outline" size="sm" onClick={() => handleReject(req)} disabled={isSubmitting}>
                                                                <XCircle className="h-3.5 w-3.5" strokeWidth={1.5} /> Rechazar
                                                            </Button>
                                                            <Button variant="primary" size="sm" onClick={() => handleReceive(req)} disabled={isSubmitting}>
                                                                <ClipboardCheck className="h-3.5 w-3.5" strokeWidth={1.5} /> Confirmar recepción
                                                            </Button>
                                                            <Button variant="secondary" size="sm" onClick={() => handleApprove(req)} disabled={isSubmitting}>
                                                                <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.5} /> Aprobar directo
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    <div className="mt-5 border-t border-capsula-line pt-4">
                                                        <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">
                                                            Ítems despachados (verificar cantidades recibidas):
                                                        </p>
                                                        <div className="grid gap-2 sm:grid-cols-2">
                                                            {req.items.map(item => {
                                                                const dispatchedQty = item.sentQuantity ?? item.dispatchedQuantity ?? item.quantity;
                                                                return (
                                                                    <div key={item.inventoryItemId} className="flex items-center justify-between rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory px-3 py-2">
                                                                        <span className="truncate text-[12px] text-capsula-ink">{item.inventoryItem.name}</span>
                                                                        <div className="ml-2 flex items-center gap-2">
                                                                            <span className="text-[11px] text-capsula-ink-muted">Enviado: {formatNumber(dispatchedQty)}</span>
                                                                            <input
                                                                                type="number"
                                                                                inputMode="decimal"
                                                                                min={0}
                                                                                defaultValue={dispatchedQty}
                                                                                onChange={e => setReceiveQuantities(prev => ({ ...prev, [item.inventoryItemId]: parseFloat(e.target.value) || 0 }))}
                                                                                className="w-20 rounded border border-capsula-line bg-capsula-ivory-surface px-2 py-1 text-center font-mono text-[12px] text-capsula-ink outline-none focus:border-capsula-navy-deep"
                                                                            />
                                                                            <span className="text-[11px] text-capsula-ink-muted">{item.inventoryItem.baseUnit}</span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                        <div className="mt-3">
                                                            <input
                                                                type="text"
                                                                placeholder="Notas de recepción (opcional)…"
                                                                value={receiveNotes}
                                                                onChange={e => setReceiveNotes(e.target.value)}
                                                                className="w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2 text-[13px] text-capsula-ink outline-none focus:border-capsula-navy-deep"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* 3. HISTORIAL COMPLETO */}
                {activeTab === 'HISTORY' && (
                    <div className="space-y-4">
                        <div className="flex justify-end">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    const headers = ['Código', 'Fecha', 'Origen', 'Destino', 'Solicitado Por', 'Aprobado Por', 'Estado', 'Items'];
                                    const rows = historyReqs.map(req => [
                                        req.code,
                                        new Date(req.createdAt).toLocaleDateString(),
                                        req.sourceArea?.name || '-',
                                        req.targetArea.name,
                                        `${req.requestedBy.firstName} ${req.requestedBy.lastName}`,
                                        req.processedBy ? `${req.processedBy.firstName} ${req.processedBy.lastName}` : '-',
                                        req.status,
                                        req.items.map(i => `${i.quantity} ${i.inventoryItem.name}`).join('; ')
                                    ]);

                                    const csvContent = [
                                        headers.join(','),
                                        ...rows.map(r => r.map(c => `"${c}"`).join(','))
                                    ].join('\n');

                                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                                    const url = URL.createObjectURL(blob);
                                    const link = document.createElement('a');
                                    link.href = url;
                                    link.setAttribute('download', `transferencias_${new Date().toISOString().split('T')[0]}.csv`);
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                }}
                            >
                                <FileDown className="h-4 w-4" strokeWidth={1.5} /> Exportar CSV
                            </Button>
                        </div>

                        <div className="overflow-hidden rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface">
                            <table className="w-full border-collapse text-[13px]">
                                <thead>
                                    <tr className="border-b border-capsula-line bg-capsula-ivory">
                                        <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Código</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Fecha</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Origen → Destino</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Solicitante</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Aprobador</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {historyReqs.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-10 text-center text-[13px] text-capsula-ink-muted">
                                                No hay historial.
                                            </td>
                                        </tr>
                                    ) : (
                                        historyReqs.map(req => {
                                            const statusVariant: 'ok' | 'coral' | 'danger' | 'info' | 'neutral' =
                                                req.status === 'COMPLETED' ? 'ok' :
                                                req.status === 'RECEIVED' ? 'coral' :
                                                req.status === 'REJECTED' ? 'danger' :
                                                req.status === 'DISPATCHED' ? 'info' : 'neutral';
                                            const statusLabel =
                                                req.status === 'COMPLETED' ? 'Completado' :
                                                req.status === 'RECEIVED' ? 'Recibido' :
                                                req.status === 'REJECTED' ? 'Rechazado' :
                                                req.status === 'DISPATCHED' ? 'Despachado' : req.status;
                                            return (
                                                <React.Fragment key={req.id}>
                                                    <tr
                                                        onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
                                                        className="cursor-pointer border-b border-capsula-line transition-colors last:border-b-0 hover:bg-capsula-ivory"
                                                    >
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <ChevronRight
                                                                    className={cn(
                                                                        'h-3.5 w-3.5 text-capsula-ink-muted transition-transform duration-200',
                                                                        expandedId === req.id && 'rotate-90',
                                                                    )}
                                                                    strokeWidth={1.5}
                                                                />
                                                                <span className="font-mono text-[12.5px] text-capsula-ink">{req.code}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-capsula-ink-soft">
                                                            {new Date(req.createdAt).toLocaleDateString()}
                                                        </td>
                                                        <td className="px-4 py-3 text-capsula-ink">
                                                            <span className="text-capsula-ink-muted">{req.sourceArea?.name || 'ALM'}</span>
                                                            <ChevronRight className="mx-1 inline h-3 w-3 text-capsula-ink-faint" strokeWidth={1.5} />
                                                            {req.targetArea.name}
                                                        </td>
                                                        <td className="px-4 py-3 text-capsula-ink-soft">
                                                            {req.requestedBy.firstName}
                                                        </td>
                                                        <td className="px-4 py-3 text-capsula-ink-soft">
                                                            {req.processedBy?.firstName || '—'}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <Badge variant={statusVariant}>{statusLabel}</Badge>
                                                                <span className="text-[11px] text-capsula-ink-muted">
                                                                    {req.items.length} ítems
                                                                </span>
                                                                {req.status === 'RECEIVED' && (
                                                                    <Button
                                                                        variant="primary"
                                                                        size="sm"
                                                                        onClick={(e) => { e.stopPropagation(); handleComplete(req); }}
                                                                        disabled={isSubmitting}
                                                                    >
                                                                        <CheckCircle2 className="h-3 w-3" strokeWidth={1.5} /> Completar
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    {expandedId === req.id && (
                                                        <tr>
                                                            <td colSpan={6} className="border-b border-capsula-line bg-capsula-ivory p-0">
                                                                <div className="animate-in slide-in-from-top-2 p-4 duration-200">
                                                                    <div className="mb-3 flex items-center gap-2 text-[12px] font-medium text-capsula-ink-soft">
                                                                        <Package className="h-3.5 w-3.5" strokeWidth={1.5} />
                                                                        Ítems transferidos ({req.items.length})
                                                                    </div>
                                                                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                                                        {req.items.map((item, idx) => (
                                                                            <div
                                                                                key={idx}
                                                                                className="flex items-center justify-between rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2"
                                                                            >
                                                                                <span className="truncate text-[12px] text-capsula-ink">
                                                                                    {item.inventoryItem.name}
                                                                                </span>
                                                                                <span className="ml-2 whitespace-nowrap font-mono text-[12px] font-semibold text-capsula-navy">
                                                                                    {formatNumber(item.dispatchedQuantity || item.quantity)} <span className="text-capsula-ink-muted">{item.inventoryItem.baseUnit}</span>
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                    {req.items.length > 6 && (
                                                                        <div className="mt-2 text-center text-[11px] text-capsula-ink-muted">
                                                                            … y más ítems
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal de Creación Rápida de Producto */}
            <QuickCreateItemDialog
                open={showQuickCreate}
                onClose={() => setShowQuickCreate(false)}
                initialName={quickCreateName}
                initialTransferQuantity={requestItems[quickCreateRowIndex]?.quantity || undefined}
                userId={user?.id || ''}
                areasList={areasList}
                sourceAreaId={sourceAreaId || undefined}
                onItemCreated={(newItem, transferQuantity) => {
                    // Agregar al listado local para que aparezca en futuros combos
                    setItemsList(prev => [...prev, { id: newItem.id, name: newItem.name, baseUnit: newItem.baseUnit }]);
                    // Auto-seleccionar en la fila que gatilló la creación
                    // Si el usuario indicó cantidad a transferir, usarla; si no, mantener la que había
                    const newItems = [...requestItems];
                    newItems[quickCreateRowIndex] = {
                        ...newItems[quickCreateRowIndex],
                        id: newItem.id,
                        name: newItem.name,
                        unit: newItem.baseUnit,
                        ...(transferQuantity !== undefined && { quantity: transferQuantity }),
                    };
                    setRequestItems(newItems);
                    setMsg({ type: 'success', text: `Producto "${newItem.name}" creado y agregado a la solicitud` });
                }}
            />
        </div>
    );
}
