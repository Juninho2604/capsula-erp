'use client';

/**
 * Bandeja + chat de Conversaciones WhatsApp (§7 del spec).
 * Optimizada para tablet landscape: dos paneles, targets táctiles ≥44px.
 * Tiempo real por polling: bandeja 15s, chat abierto 5s (sin websockets aún).
 * Las reglas de compliance viven en el SERVER — acá solo se reflejan
 * (input deshabilitado con explicación, selector de plantillas, contador).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Bot, UserCircle2, Search, Check, CheckCheck, AlertTriangle, Clock,
    Send, FileText, MapPin, Image as ImageIcon, Receipt, X as XIcon,
    MessageSquareOff, Hand, Undo2, Loader2, ShieldAlert,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
    listWaConversationsAction,
    getWaConversationMessagesAction,
    takeWaConversationAction,
    releaseWaConversationAction,
    sendWaHumanMessageAction,
    markWaConversationReadAction,
} from '@/app/actions/wa.actions';

// ─── Tipos (espejo de las actions) ──────────────────────────────────────────

interface ConversationRow {
    id: string;
    waId: string;
    customerName: string | null;
    customerPhone: string;
    status: 'BOT' | 'HUMAN' | 'CLOSED';
    assignedToUserId: string | null;
    assignedToName: string | null;
    windowExpiresAt: string | null;
    marketingOptIn: boolean;
    optedOutAt: string | null;
    lastOrderId: string | null;
    unreadCount: number;
    updatedAt: string;
    lastMessage: { snippet: string; direction: string; senderType: string; at: string } | null;
}

interface Message {
    id: string;
    direction: 'INBOUND' | 'OUTBOUND';
    senderType: 'CUSTOMER' | 'BOT' | 'HUMAN';
    senderName: string | null;
    kind: string;
    body: string | null;
    mediaUrl: string | null;
    mediaMimeType: string | null;
    latitude: number | null;
    longitude: number | null;
    templateName: string | null;
    deliveryStatus: 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
    errorDetail: string | null;
    createdAt: string;
}

interface Template {
    id: string;
    name: string;
    language: string;
    category: string;
    bodyPreview: string;
    variablesCount: number;
    approvalStatus: string;
}

interface Props {
    initialConversations: ConversationRow[];
    templates: Template[];
    health: { hasCredential: boolean; credentialActive: boolean; displayPhone: string | null };
}

type Filter = 'ALL' | 'BOT' | 'HUMAN' | 'EXPIRING';

const LIST_POLL_MS = 15_000;
const CHAT_POLL_MS = 5_000;

// ─── Helpers de ventana 24h ──────────────────────────────────────────────────

function windowState(expiresAt: string | null, now: number): { level: 'green' | 'amber' | 'red' | 'gray'; remainingMs: number } {
    if (!expiresAt) return { level: 'gray', remainingMs: 0 };
    const remaining = new Date(expiresAt).getTime() - now;
    if (remaining <= 0) return { level: 'gray', remainingMs: 0 };
    if (remaining < 60 * 60 * 1000) return { level: 'red', remainingMs: remaining };
    if (remaining < 12 * 60 * 60 * 1000) return { level: 'amber', remainingMs: remaining };
    return { level: 'green', remainingMs: remaining };
}

function fmtRemaining(ms: number): string {
    if (ms <= 0) return 'expirada';
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
}

const WINDOW_DOT: Record<string, string> = {
    green: 'bg-[#2F6B4E] dark:bg-[#6FB88F]',
    amber: 'bg-[#946A1C] dark:bg-[#E8D9B8]',
    red: 'bg-[#B04A2E] dark:bg-[#EFD2C8]',
    gray: 'bg-capsula-ink-faint',
};

// ─── Checks de estado (✓ / ✓✓ / ✓✓ azul / ⚠) ────────────────────────────────

function DeliveryTicks({ status, error }: { status: Message['deliveryStatus']; error: string | null }) {
    if (status === 'FAILED') {
        return <AlertTriangle className="h-3.5 w-3.5 text-capsula-coral" aria-label={error ?? 'Falló'} />;
    }
    if (status === 'READ') return <CheckCheck className="h-3.5 w-3.5 text-[#2A4060] dark:text-[#8FB4E8]" />;
    if (status === 'DELIVERED') return <CheckCheck className="h-3.5 w-3.5 opacity-60" />;
    if (status === 'SENT') return <Check className="h-3.5 w-3.5 opacity-60" />;
    return <Clock className="h-3 w-3 opacity-50" />;
}

// ═════════════════════════════════════════════════════════════════════════════

export default function ConversationsView({ initialConversations, templates, health }: Props) {
    const [conversations, setConversations] = useState<ConversationRow[]>(initialConversations);
    const [filter, setFilter] = useState<Filter>('ALL');
    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [chat, setChat] = useState<{ conversation: any; messages: Message[]; consecutiveOutbound: number; rateLimit: number } | null>(null);
    const [now, setNow] = useState(() => Date.now());
    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const [taking, setTaking] = useState(false);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [templateVars, setTemplateVars] = useState<string[]>([]);
    const bottomRef = useRef<HTMLDivElement | null>(null);
    const selectedIdRef = useRef<string | null>(null);
    selectedIdRef.current = selectedId;

    // Reloj para contadores de ventana
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 30_000);
        return () => clearInterval(t);
    }, []);

    // ── Polling bandeja (15s) ────────────────────────────────────────────────
    const refreshList = useCallback(async () => {
        const res = await listWaConversationsAction();
        if (res.success && res.data) setConversations(res.data);
    }, []);

    useEffect(() => {
        const t = setInterval(refreshList, LIST_POLL_MS);
        return () => clearInterval(t);
    }, [refreshList]);

    // ── Polling chat abierto (5s) ────────────────────────────────────────────
    const refreshChat = useCallback(async (id: string, scroll = false) => {
        const res = await getWaConversationMessagesAction(id);
        if (res.success && res.data && selectedIdRef.current === id) {
            setChat(res.data);
            if (scroll) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
    }, []);

    useEffect(() => {
        if (!selectedId) { setChat(null); return; }
        // Reset del chat al cambiar de conversación: evita mostrar la
        // conversación anterior hasta que resuelva el fetch nuevo.
        setChat(null);
        void refreshChat(selectedId, true);
        void markWaConversationReadAction(selectedId).then(() => refreshList());
        const t = setInterval(async () => {
            await refreshChat(selectedId);
            // Mensajes que llegan con el chat abierto re-incrementan unreadCount
            // en el server; re-marcar leído evita el badge fantasma sobre la
            // conversación que el usuario está mirando.
            await markWaConversationReadAction(selectedId);
        }, CHAT_POLL_MS);
        return () => clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedId]);

    // ── Filtros de bandeja ───────────────────────────────────────────────────
    const filtered = useMemo(() => {
        let rows = conversations;
        if (filter === 'BOT' || filter === 'HUMAN') rows = rows.filter(c => c.status === filter);
        if (filter === 'EXPIRING') {
            rows = rows.filter(c => {
                const w = windowState(c.windowExpiresAt, now);
                return w.level === 'red' || w.level === 'amber';
            });
        }
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            rows = rows.filter(c =>
                (c.customerName ?? '').toLowerCase().includes(q) || c.customerPhone.includes(q));
        }
        return rows;
    }, [conversations, filter, search, now]);

    const conv = chat?.conversation;
    const convWindow = conv ? windowState(conv.windowExpiresAt, now) : null;
    const windowOpen = (convWindow?.remainingMs ?? 0) > 0;
    const optedOut = Boolean(conv?.optedOutAt);
    const isHuman = conv?.status === 'HUMAN';
    const approvedTemplates = templates.filter(t => t.approvalStatus === 'APPROVED');
    const inputDisabled = !isHuman || !windowOpen || (optedOut && !windowOpen);

    // ── Acciones ─────────────────────────────────────────────────────────────
    const handleTake = async () => {
        if (!selectedId) return;
        setTaking(true);
        try {
            const res = await takeWaConversationAction(selectedId);
            res.success ? toast.success(res.message ?? 'Tomada') : toast.error(res.message ?? 'Error');
            await refreshChat(selectedId);
            await refreshList();
        } finally { setTaking(false); }
    };

    const handleRelease = async () => {
        if (!selectedId) return;
        setTaking(true);
        try {
            const res = await releaseWaConversationAction(selectedId);
            res.success ? toast.success(res.message ?? 'Devuelta') : toast.error(res.message ?? 'Error');
            await refreshChat(selectedId);
            await refreshList();
        } finally { setTaking(false); }
    };

    const doSend = async (payload: Parameters<typeof sendWaHumanMessageAction>[0]) => {
        setSending(true);
        try {
            let res = await sendWaHumanMessageAction(payload);
            if (!res.success && res.code === 'RATE_LIMITED') {
                // §4.4 — bloqueo suave: gerente confirma
                if (confirm(`${res.message}\n\n¿Confirmar el envío igualmente? (solo gerentes)`)) {
                    res = await sendWaHumanMessageAction({ ...payload, managerOverride: true });
                }
            }
            if (res.success) {
                setDraft('');
                setShowTemplateModal(false);
                setSelectedTemplate(null);
                if (selectedId) await refreshChat(selectedId, true);
            } else if (res.message) {
                toast.error(res.message, { duration: 6000 });
            }
        } finally { setSending(false); }
    };

    const handleSendText = () => {
        if (!selectedId || !draft.trim() || sending) return;
        void doSend({ conversationId: selectedId, kind: 'TEXT', body: draft.trim() });
    };

    const handleSendTemplate = () => {
        if (!selectedId || !selectedTemplate || sending) return;
        void doSend({
            conversationId: selectedId,
            kind: 'TEMPLATE',
            templateName: selectedTemplate.name,
            templateVars,
        });
    };

    const templatePreview = selectedTemplate
        ? selectedTemplate.bodyPreview.replace(/\{\{(\d+)\}\}/g, (_, n) => templateVars[Number(n) - 1] || `{{${n}}}`)
        : '';

    // ═══ RENDER ══════════════════════════════════════════════════════════════
    return (
        <div className="flex h-[calc(100vh-7rem)] flex-col gap-3">
            {/* Banner rojo: credencial caída / ausente */}
            {(!health.hasCredential || !health.credentialActive) && (
                <div className="flex items-center gap-2 rounded-xl bg-[#F7E3DB] px-4 py-2.5 text-sm font-semibold text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8]">
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    {!health.hasCredential
                        ? 'Sin credencial de WhatsApp configurada — los mensajes humanos no se pueden enviar. Configurala con un OWNER/ADMIN.'
                        : 'El token de WhatsApp está inválido o expiró — renovalo en la configuración del módulo.'}
                </div>
            )}

            <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-capsula-line bg-capsula-ivory">
                {/* ══ PANEL IZQUIERDO — BANDEJA ══════════════════════════════ */}
                <aside className={`${selectedId ? 'hidden md:flex' : 'flex'} w-full flex-col border-r border-capsula-line md:w-[340px] md:shrink-0`}>
                    <div className="space-y-2 border-b border-capsula-line p-3">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-capsula-ink-muted" />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Buscar por nombre o teléfono…"
                                className="pos-input w-full pl-9"
                            />
                        </div>
                        <div className="flex gap-1.5">
                            {([['ALL', 'Todas'], ['BOT', 'Bot'], ['HUMAN', 'Humano'], ['EXPIRING', 'Por expirar']] as [Filter, string][]).map(([f, label]) => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`min-h-[36px] flex-1 rounded-xl border px-2 py-1.5 text-xs font-semibold transition ${
                                        filter === f
                                            ? 'border-capsula-navy-deep bg-capsula-navy-deep text-capsula-cream'
                                            : 'border-capsula-line bg-capsula-ivory-surface text-capsula-ink-soft hover:border-capsula-navy-deep/40'
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 divide-y divide-capsula-line overflow-y-auto">
                        {filtered.length === 0 && (
                            <div className="p-8 text-center text-sm text-capsula-ink-muted">
                                <MessageSquareOff className="mx-auto mb-2 h-8 w-8 text-capsula-ink-faint" />
                                Sin conversaciones{search ? ' que coincidan' : ' todavía'}
                            </div>
                        )}
                        {filtered.map(c => {
                            const w = windowState(c.windowExpiresAt, now);
                            const active = c.id === selectedId;
                            return (
                                <button
                                    key={c.id}
                                    onClick={() => setSelectedId(c.id)}
                                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition min-h-[64px] ${
                                        active ? 'bg-capsula-navy-soft' : 'hover:bg-capsula-ivory-surface'
                                    }`}
                                >
                                    <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${WINDOW_DOT[w.level]}`} title={`Ventana: ${fmtRemaining(w.remainingMs)}`} />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="truncate font-semibold text-capsula-ink">
                                                {c.customerName || c.customerPhone}
                                            </span>
                                            <span className="shrink-0 text-[10px] font-semibold tabular-nums text-capsula-ink-muted">
                                                {fmtTime(c.updatedAt)}
                                            </span>
                                        </div>
                                        <div className="mt-0.5 flex items-center justify-between gap-2">
                                            <span className="truncate text-xs text-capsula-ink-muted">
                                                {c.lastMessage?.snippet ?? '—'}
                                            </span>
                                            {c.unreadCount > 0 && (
                                                <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-capsula-coral px-1.5 text-[10px] font-semibold text-capsula-cream tabular-nums">
                                                    {c.unreadCount}
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-1 flex items-center gap-1.5">
                                            {c.status === 'BOT' ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-capsula-ivory-alt px-2 py-0.5 text-[10px] font-semibold text-capsula-ink-soft">
                                                    <Bot className="h-3 w-3" /> Fabiola
                                                </span>
                                            ) : c.status === 'HUMAN' ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-[#E6ECF4] px-2 py-0.5 text-[10px] font-semibold text-[#2A4060] dark:bg-[#1A2636] dark:text-[#D1DCE9]">
                                                    <UserCircle2 className="h-3 w-3" /> {c.assignedToName ?? 'Humano'}
                                                </span>
                                            ) : (
                                                <span className="rounded-full bg-capsula-ivory-alt px-2 py-0.5 text-[10px] font-semibold text-capsula-ink-faint">Cerrada</span>
                                            )}
                                            {c.optedOutAt && (
                                                <span className="rounded-full bg-[#F7E3DB] px-2 py-0.5 text-[10px] font-semibold text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8]">BAJA</span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </aside>

                {/* ══ PANEL DERECHO — CHAT ═══════════════════════════════════ */}
                <section className={`${selectedId ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col`}>
                    {selectedId && !conv ? (
                        <div className="flex flex-1 items-center justify-center text-capsula-ink-muted">
                            <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                    ) : !conv ? (
                        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-capsula-ink-muted">
                            <Bot className="h-10 w-10 text-capsula-ink-faint" />
                            <p className="text-sm">Elegí una conversación de la bandeja</p>
                        </div>
                    ) : (
                        <>
                            {/* Header del chat */}
                            <div className="flex items-center justify-between gap-3 border-b border-capsula-line px-4 py-3">
                                <div className="flex min-w-0 items-center gap-2">
                                    <button onClick={() => setSelectedId(null)} className="md:hidden rounded-lg p-2 text-capsula-ink-muted hover:bg-capsula-ivory-surface">
                                        <XIcon className="h-4 w-4" />
                                    </button>
                                    <div className="min-w-0">
                                        <p className="truncate font-semibold text-capsula-ink">{conv.customerName || conv.customerPhone}</p>
                                        <p className="text-[11px] text-capsula-ink-muted tabular-nums">+{conv.customerPhone}</p>
                                    </div>
                                    {conv.lastOrderId && (
                                        <Link
                                            href="/dashboard/delivery"
                                            className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-full border border-capsula-line bg-capsula-ivory-surface px-2.5 py-1 text-[11px] font-semibold text-capsula-ink-soft hover:border-capsula-navy-deep/40"
                                        >
                                            <Receipt className="h-3 w-3" /> Pedido
                                        </Link>
                                    )}
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    {/* Contador de ventana */}
                                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums ${
                                        convWindow!.level === 'gray'
                                            ? 'bg-capsula-ivory-alt text-capsula-ink-faint'
                                            : convWindow!.level === 'red'
                                                ? 'bg-[#F7E3DB] text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8]'
                                                : convWindow!.level === 'amber'
                                                    ? 'bg-[#F3EAD6] text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8]'
                                                    : 'bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]'
                                    }`}>
                                        <Clock className="h-3 w-3" /> {fmtRemaining(convWindow!.remainingMs)}
                                    </span>
                                    {/* Takeover / devolución */}
                                    {conv.status === 'BOT' ? (
                                        <button
                                            onClick={handleTake}
                                            disabled={taking}
                                            className="pos-btn inline-flex min-h-[44px] items-center gap-2 px-4 py-2 text-sm"
                                        >
                                            {taking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hand className="h-4 w-4" />}
                                            Tomar conversación
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleRelease}
                                            disabled={taking}
                                            className="pos-btn-secondary inline-flex min-h-[44px] items-center gap-2 px-4 py-2 text-sm"
                                        >
                                            {taking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                                            Devolver a Fabiola
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Mensajes */}
                            <div className="flex-1 space-y-2 overflow-y-auto bg-capsula-ivory-surface px-4 py-3">
                                {chat!.messages.map(m => {
                                    const mine = m.direction === 'OUTBOUND';
                                    return (
                                        <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 shadow-sm ${
                                                mine
                                                    ? 'rounded-br-md bg-capsula-navy-deep text-capsula-cream'
                                                    : 'rounded-bl-md border border-capsula-line bg-capsula-ivory text-capsula-ink'
                                            }`}>
                                                {mine && (
                                                    <p className={`mb-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${m.senderType === 'BOT' ? 'text-capsula-cream/60' : 'text-capsula-gold'}`}>
                                                        {m.senderType === 'BOT' ? 'Fabiola' : m.senderName ?? 'Humano'}
                                                    </p>
                                                )}
                                                {m.kind === 'IMAGE' && m.mediaUrl && (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={m.mediaUrl} alt="Imagen recibida" className="mb-1 max-h-64 rounded-xl" />
                                                )}
                                                {m.kind === 'DOCUMENT' && m.mediaUrl && (
                                                    <a href={m.mediaUrl} target="_blank" rel="noreferrer" className="mb-1 inline-flex items-center gap-1.5 text-sm font-semibold underline">
                                                        <FileText className="h-4 w-4" /> Documento
                                                    </a>
                                                )}
                                                {m.kind === 'LOCATION' && m.latitude != null && m.longitude != null && (
                                                    <a
                                                        href={`https://www.google.com/maps?q=${m.latitude},${m.longitude}`}
                                                        target="_blank" rel="noreferrer"
                                                        className="mb-1 inline-flex items-center gap-1.5 text-sm font-semibold underline"
                                                    >
                                                        <MapPin className="h-4 w-4" /> Ubicación ({m.latitude.toFixed(5)}, {m.longitude.toFixed(5)})
                                                    </a>
                                                )}
                                                {m.kind === 'TEMPLATE' && (
                                                    <p className={`mb-0.5 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${mine ? 'text-capsula-cream/60' : 'text-capsula-ink-muted'}`}>
                                                        <FileText className="h-3 w-3" /> Plantilla · {m.templateName}
                                                    </p>
                                                )}
                                                {m.kind === 'AUDIO' && m.mediaUrl && (
                                                    <audio controls src={m.mediaUrl} className="mb-1 max-w-full" />
                                                )}
                                                {m.kind === 'UNSUPPORTED' && (
                                                    <p className="text-xs italic opacity-70">[Contenido no soportado]</p>
                                                )}
                                                {m.body && <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>}
                                                <div className={`mt-1 flex items-center justify-end gap-1 ${mine ? 'text-capsula-cream/70' : 'text-capsula-ink-faint'}`}>
                                                    <span className="text-[10px] tabular-nums">{fmtTime(m.createdAt)}</span>
                                                    {mine && <DeliveryTicks status={m.deliveryStatus} error={m.errorDetail} />}
                                                </div>
                                                {m.deliveryStatus === 'FAILED' && m.errorDetail && (
                                                    <p className="mt-1 text-[10px] text-capsula-coral">{m.errorDetail.slice(0, 140)}</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={bottomRef} />
                            </div>

                            {/* Barra de envío */}
                            <div className="border-t border-capsula-line p-3">
                                {optedOut && (
                                    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#B04A2E] dark:text-[#EFD2C8]">
                                        <AlertTriangle className="h-3.5 w-3.5" />
                                        El cliente pidió la BAJA{windowOpen ? ' — solo respuestas operativas mientras la ventana siga abierta.' : ' y la ventana expiró: solo plantillas UTILITY.'}
                                    </p>
                                )}
                                {!isHuman ? (
                                    <p className="py-2 text-center text-sm text-capsula-ink-muted">
                                        Fabiola está atendiendo. Tocá <span className="font-semibold text-capsula-ink">&quot;Tomar conversación&quot;</span> para responder vos.
                                    </p>
                                ) : (
                                    <div className="flex items-end gap-2">
                                        <button
                                            onClick={() => { setShowTemplateModal(true); setSelectedTemplate(null); setTemplateVars([]); }}
                                            className="pos-btn-secondary inline-flex min-h-[48px] items-center gap-1.5 px-3 py-2.5 text-sm"
                                            title="Enviar plantilla aprobada"
                                        >
                                            <FileText className="h-4 w-4" />
                                            <span className="hidden sm:inline">Plantilla</span>
                                        </button>
                                        <textarea
                                            value={draft}
                                            onChange={e => setDraft(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText(); } }}
                                            disabled={!windowOpen || sending}
                                            placeholder={windowOpen
                                                ? 'Escribí un mensaje… (Enter envía)'
                                                : 'Ventana de 24h expirada — solo se puede enviar una plantilla aprobada'}
                                            rows={2}
                                            className="pos-input min-h-[48px] flex-1 resize-none disabled:opacity-60"
                                        />
                                        <button
                                            onClick={handleSendText}
                                            disabled={!windowOpen || !draft.trim() || sending}
                                            className="pos-btn inline-flex min-h-[48px] items-center gap-1.5 px-4 py-2.5 text-sm disabled:opacity-40"
                                        >
                                            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                            <span className="hidden sm:inline">Enviar</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </section>
            </div>

            {/* ══ MODAL: PLANTILLAS z-[60] ═══════════════════════════════════ */}
            {showTemplateModal && (
                <div className="fixed inset-0 z-[60] flex items-end justify-center bg-capsula-ink/60 p-4 backdrop-blur-sm sm:items-center">
                    <div className="w-full max-w-lg rounded-t-3xl border border-capsula-line bg-capsula-ivory shadow-2xl sm:rounded-3xl">
                        <div className="flex items-center justify-between border-b border-capsula-line p-5">
                            <h3 className="text-lg font-semibold tracking-[-0.02em] text-capsula-ink">Enviar plantilla</h3>
                            <button onClick={() => setShowTemplateModal(false)} className="flex h-8 w-8 items-center justify-center rounded-full text-capsula-ink-muted hover:bg-capsula-coral/10 hover:text-capsula-coral">
                                <XIcon className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="max-h-[60vh] space-y-4 overflow-y-auto p-5">
                            {approvedTemplates.length === 0 ? (
                                <p className="py-4 text-center text-sm text-capsula-ink-muted">
                                    No hay plantillas APROBADAS registradas. Registralas en Meta y reflejá su estado acá.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {approvedTemplates.map(t => {
                                        const marketingBlocked = t.category === 'MARKETING' && (!conv?.marketingOptIn || optedOut);
                                        return (
                                            <button
                                                key={t.id}
                                                onClick={() => { setSelectedTemplate(t); setTemplateVars(Array(t.variablesCount).fill('')); }}
                                                disabled={marketingBlocked}
                                                className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                                                    selectedTemplate?.id === t.id
                                                        ? 'border-capsula-navy-deep bg-capsula-navy-soft'
                                                        : 'border-capsula-line bg-capsula-ivory-surface hover:border-capsula-navy-deep/40'
                                                } disabled:cursor-not-allowed disabled:opacity-40`}
                                                title={marketingBlocked ? 'Bloqueada: el cliente no tiene opt-in de marketing (o pidió la baja)' : undefined}
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="font-mono text-sm font-semibold text-capsula-ink">{t.name}</span>
                                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                                        t.category === 'MARKETING'
                                                            ? 'bg-[#F3EAD6] text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8]'
                                                            : 'bg-capsula-ivory-alt text-capsula-ink-soft'
                                                    }`}>{t.category}</span>
                                                </div>
                                                <p className="mt-1 truncate text-xs text-capsula-ink-muted">{t.bodyPreview}</p>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {selectedTemplate && selectedTemplate.variablesCount > 0 && (
                                <div className="space-y-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Variables</p>
                                    {Array.from({ length: selectedTemplate.variablesCount }).map((_, i) => (
                                        <input
                                            key={i}
                                            value={templateVars[i] ?? ''}
                                            onChange={e => setTemplateVars(prev => { const next = [...prev]; next[i] = e.target.value; return next; })}
                                            placeholder={`{{${i + 1}}}`}
                                            className="pos-input w-full"
                                        />
                                    ))}
                                </div>
                            )}

                            {selectedTemplate && (
                                <div className="rounded-xl border border-capsula-line bg-capsula-ivory-surface p-3">
                                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Preview</p>
                                    <p className="whitespace-pre-wrap text-sm text-capsula-ink">{templatePreview}</p>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-3 border-t border-capsula-line p-4">
                            <button onClick={() => setShowTemplateModal(false)} className="pos-btn-secondary flex-1 py-3">Cancelar</button>
                            <button
                                onClick={handleSendTemplate}
                                disabled={!selectedTemplate || sending || templateVars.some(v => !v.trim()) && (selectedTemplate?.variablesCount ?? 0) > 0}
                                className="pos-btn inline-flex flex-[2] items-center justify-center gap-2 py-3 disabled:opacity-40"
                            >
                                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                Enviar plantilla
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
