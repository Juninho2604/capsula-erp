'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { getNotificationsAction, dismissBroadcastAction, createBroadcastAction } from '@/app/actions/notifications.actions';
import type { SystemNotification, StockAlert } from '@/app/actions/notifications.actions';
import { useAuthStore } from '@/stores/auth.store';
import {
  Bell,
  BellRing,
  RefreshCw,
  Loader2,
  X,
  Package,
  Megaphone,
  Gem,
  Inbox,
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCircle2,
  Ban,
  Plus,
} from 'lucide-react';

// ============================================================================
// TIPOS
// ============================================================================

type TabType = 'stock' | 'system';
type IconComp = typeof AlertOctagon;

type TypeStyle = {
  bg: string;
  border: string;
  text: string;
  Icon: IconComp;
};

const TYPE_STYLES: Record<string, TypeStyle> = {
  ALERT:   { bg: 'bg-capsula-coral-subtle',   border: 'border-capsula-coral/30',   text: 'text-capsula-coral',   Icon: AlertOctagon },
  WARNING: { bg: 'bg-amber-500/10',           border: 'border-amber-500/30',       text: 'text-amber-600',       Icon: AlertTriangle },
  INFO:    { bg: 'bg-capsula-navy-soft',      border: 'border-capsula-navy/20',    text: 'text-capsula-ink',    Icon: Info },
  SUCCESS: { bg: 'bg-emerald-500/10',         border: 'border-emerald-500/30',     text: 'text-emerald-600',     Icon: CheckCircle2 },
};

const SEVERITY_STYLES: Record<'critical' | 'warning', TypeStyle & { badge: string }> = {
  critical: { bg: 'bg-capsula-coral-subtle', border: 'border-capsula-coral/30', text: 'text-capsula-coral', badge: 'bg-capsula-coral', Icon: AlertOctagon },
  warning:  { bg: 'bg-amber-500/10',         border: 'border-amber-500/30',     text: 'text-amber-600',     badge: 'bg-amber-500',      Icon: AlertTriangle },
};

const DISMISS_KEY = 'capsula_dismissed_stock_alerts';

function getDismissedAlerts(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return new Set();
    const data = JSON.parse(raw) as { id: string; date: string }[];
    const today = new Date().toDateString();
    const valid = data.filter((d) => d.date === today);
    localStorage.setItem(DISMISS_KEY, JSON.stringify(valid));
    return new Set(valid.map((d) => d.id));
  } catch {
    return new Set();
  }
}

function dismissStockAlert(id: string) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    const data: { id: string; date: string }[] = raw ? JSON.parse(raw) : [];
    data.push({ id, date: new Date().toDateString() });
    localStorage.setItem(DISMISS_KEY, JSON.stringify(data));
  } catch {}
}

// ============================================================================
// COMPONENTE
// ============================================================================

const ADMIN_ROLES = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'];

const MSG_TYPE_OPTIONS = [
  { value: 'INFO', label: 'Info' },
  { value: 'WARNING', label: 'Aviso' },
  { value: 'ALERT', label: 'Alerta' },
  { value: 'SUCCESS', label: 'Éxito' },
] as const;

export function NotificationBell() {
  const { user } = useAuthStore();
  const isAdmin = user ? ADMIN_ROLES.includes(user.role) : false;

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('stock');
  const [systemMessages, setSystemMessages] = useState<SystemNotification[]>([]);
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [showForm, setShowForm] = useState(false);
  const [newMsg, setNewMsg] = useState({ title: '', body: '', type: 'INFO' as 'INFO' | 'WARNING' | 'ALERT' | 'SUCCESS', expiresInHours: '' });
  const [isSaving, setIsSaving] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    const result = await getNotificationsAction();
    if (result.success) {
      setSystemMessages(result.systemMessages);
      setStockAlerts(result.stockAlerts);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    setDismissedIds(getDismissedAlerts());
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 90_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    if (isOpen) {
      setDismissedIds(getDismissedAlerts());
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  const visibleStockAlerts = stockAlerts.filter((a) => !dismissedIds.has(a.id));
  const unreadCount = visibleStockAlerts.length + systemMessages.length;

  const handleDismissStock = (id: string) => {
    dismissStockAlert(id);
    setDismissedIds((prev) => {
      const next = new Set(Array.from(prev));
      next.add(id);
      return next;
    });
  };

  const handleDismissAllStock = () => {
    visibleStockAlerts.forEach((a) => dismissStockAlert(a.id));
    setDismissedIds(new Set(stockAlerts.map((a) => a.id)));
  };

  const handleDismissBroadcast = (id: string) => {
    startTransition(async () => {
      await dismissBroadcastAction(id);
      setSystemMessages((prev) => prev.filter((m) => m.id !== id));
    });
  };

  const criticalCount = visibleStockAlerts.filter((a) => a.severity === 'critical').length;

  const handleCreateBroadcast = async () => {
    if (!newMsg.title.trim() || !newMsg.body.trim()) return;
    setIsSaving(true);
    const result = await createBroadcastAction({
      title: newMsg.title,
      body: newMsg.body,
      type: newMsg.type,
      expiresInHours: newMsg.expiresInHours ? Number(newMsg.expiresInHours) : undefined,
    });
    if (result.success) {
      setNewMsg({ title: '', body: '', type: 'INFO', expiresInHours: '' });
      setShowForm(false);
      await fetchNotifications();
    }
    setIsSaving(false);
  };

  const BellIcon = unreadCount > 0 && criticalCount > 0 ? BellRing : Bell;

  return (
    <>
      {/* ── Botón campana ──────────────────────────────────────────────────── */}
      <button
        onClick={() => setIsOpen(true)}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-capsula-ivory-alt text-capsula-ink-muted transition-colors hover:bg-capsula-navy-soft hover:text-capsula-ink"
        title="Notificaciones del sistema"
        aria-label="Abrir notificaciones"
      >
        <BellIcon className="h-5 w-5" strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span
            className={`absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-semibold text-capsula-ivory ${
              criticalCount > 0 ? 'bg-capsula-coral animate-pulse' : 'bg-amber-500'
            }`}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Modal centrado con backdrop oscuro ────────────────────────────── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-capsula-navy-deep/55 p-4 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-capsula-line bg-capsula-ivory-surface shadow-cap-raised animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-capsula-line bg-capsula-ivory-alt px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-capsula-navy-soft text-capsula-ink">
                  <Bell className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div>
                  <h2 className="font-semibold text-base tracking-[-0.01em] text-capsula-ink">Notificaciones</h2>
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-capsula-ink-muted">
                    {unreadCount > 0 ? `${unreadCount} sin atender` : 'Todo en orden'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={fetchNotifications}
                  disabled={isLoading}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-capsula-ink-muted transition-colors hover:bg-capsula-ivory hover:text-capsula-ink disabled:opacity-60"
                  title="Actualizar"
                >
                  {isLoading
                    ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                    : <RefreshCw className="h-4 w-4" strokeWidth={1.75} />}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-capsula-ink-muted transition-colors hover:bg-capsula-ivory hover:text-capsula-ink"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-capsula-line">
              <button
                onClick={() => setActiveTab('stock')}
                className={`flex flex-1 items-center justify-center gap-2 py-2.5 text-xs font-medium uppercase tracking-[0.14em] transition-colors ${
                  activeTab === 'stock'
                    ? 'border-b-2 border-capsula-coral bg-capsula-coral-subtle text-capsula-coral'
                    : 'text-capsula-ink-muted hover:text-capsula-ink'
                }`}
              >
                <Package className="h-3.5 w-3.5" strokeWidth={1.75} />
                Stock
                {visibleStockAlerts.length > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-capsula-ivory ${criticalCount > 0 ? 'bg-capsula-coral' : 'bg-amber-500'}`}>
                    {visibleStockAlerts.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('system')}
                className={`flex flex-1 items-center justify-center gap-2 py-2.5 text-xs font-medium uppercase tracking-[0.14em] transition-colors ${
                  activeTab === 'system'
                    ? 'border-b-2 border-capsula-navy bg-capsula-navy-soft text-capsula-ink'
                    : 'text-capsula-ink-muted hover:text-capsula-ink'
                }`}
              >
                <Megaphone className="h-3.5 w-3.5" strokeWidth={1.75} />
                Sistema
                {systemMessages.length > 0 && (
                  <span className="rounded-full bg-capsula-navy px-1.5 py-0.5 text-[9px] font-semibold text-capsula-ivory">
                    {systemMessages.length}
                  </span>
                )}
              </button>
            </div>

            {/* Contenido */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === 'stock' ? (
                <div className="space-y-3 p-4">
                  {isLoading && visibleStockAlerts.length === 0 && (
                    <div className="py-12 text-center text-sm text-capsula-ink-muted">Actualizando...</div>
                  )}

                  {!isLoading && visibleStockAlerts.length === 0 && (
                    <div className="flex flex-col items-center gap-3 py-12 text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                        <Gem className="h-7 w-7" strokeWidth={1.75} />
                      </div>
                      <p className="font-semibold text-capsula-ink">¡Inventario OK!</p>
                      <p className="max-w-[200px] text-xs text-capsula-ink-muted">
                        No hay insumos por debajo del stock mínimo en este momento.
                      </p>
                    </div>
                  )}

                  {visibleStockAlerts.length > 0 && (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                          {criticalCount > 0 && `${criticalCount} crítico${criticalCount > 1 ? 's' : ''} · `}
                          {visibleStockAlerts.length} alerta{visibleStockAlerts.length > 1 ? 's' : ''}
                        </p>
                        <button
                          onClick={handleDismissAllStock}
                          className="text-[10px] font-medium text-capsula-ink-muted transition-colors hover:text-capsula-ink"
                        >
                          Descartar todas
                        </button>
                      </div>

                      {visibleStockAlerts.map((alert) => {
                        const s = SEVERITY_STYLES[alert.severity];
                        const Icon = s.Icon;
                        return (
                          <div
                            key={alert.id}
                            className={`flex items-start gap-3 rounded-2xl border p-4 ${s.bg} ${s.border}`}
                          >
                            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${s.text}`} strokeWidth={1.75} />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className={`font-semibold text-sm ${s.text}`}>{alert.name}</p>
                                <span className="rounded bg-capsula-ivory px-1.5 py-0.5 text-[9px] font-semibold uppercase text-capsula-ink-muted">
                                  {alert.sku}
                                </span>
                              </div>
                              <div className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-capsula-ink-soft">
                                {alert.currentStock <= 0 ? (
                                  <>
                                    <Ban className="h-3.5 w-3.5" strokeWidth={1.75} />
                                    <span>Sin stock</span>
                                  </>
                                ) : (
                                  <span>
                                    {alert.currentStock.toFixed(2)} {alert.unit} — mín. {alert.minimumStock} {alert.unit}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => handleDismissStock(alert.id)}
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-capsula-ink-muted transition-colors hover:bg-capsula-ivory hover:text-capsula-ink"
                              title="Descartar hoy"
                            >
                              <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                            </button>
                          </div>
                        );
                      })}

                      <a
                        href="/dashboard/inventario"
                        className="mt-2 block w-full rounded-xl border border-capsula-coral/30 py-2.5 text-center text-xs font-semibold uppercase tracking-[0.14em] text-capsula-coral transition-colors hover:bg-capsula-coral-subtle"
                      >
                        Ver Inventario completo →
                      </a>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-3 p-4">
                  {systemMessages.length === 0 && (
                    <div className="flex flex-col items-center gap-3 py-12 text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-capsula-navy-soft text-capsula-ink">
                        <Inbox className="h-7 w-7" strokeWidth={1.75} />
                      </div>
                      <p className="font-semibold text-capsula-ink">Sin mensajes</p>
                      <p className="max-w-[200px] text-xs text-capsula-ink-muted">
                        No hay anuncios activos del sistema en este momento.
                      </p>
                    </div>
                  )}

                  {systemMessages.map((msg) => {
                    const s = TYPE_STYLES[msg.type] ?? TYPE_STYLES.INFO;
                    const Icon = s.Icon;
                    const ts = new Date(msg.createdAt).toLocaleDateString('es-VE', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      timeZone: 'America/Caracas',
                    });
                    return (
                      <div
                        key={msg.id}
                        className={`rounded-2xl border p-4 ${s.bg} ${s.border}`}
                      >
                        <div className="flex items-start gap-2">
                          <Icon className={`h-5 w-5 shrink-0 ${s.text}`} strokeWidth={1.75} />
                          <div className="min-w-0 flex-1">
                            <p className={`font-semibold text-sm ${s.text}`}>{msg.title}</p>
                            <p className="mt-1 text-xs font-medium leading-snug text-capsula-ink-soft">{msg.body}</p>
                            <p className="mt-2 text-[9px] font-medium text-capsula-ink-muted">{ts}</p>
                          </div>
                          <button
                            onClick={() => handleDismissBroadcast(msg.id)}
                            disabled={isPending}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-capsula-ink-muted transition-colors hover:bg-capsula-ivory hover:text-capsula-ink disabled:opacity-50"
                            title="Desactivar mensaje"
                          >
                            <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer — formulario crear notificación (solo admin) */}
            {isAdmin && activeTab === 'system' && (
              <div className="border-t border-capsula-line p-4">
                {!showForm ? (
                  <button
                    onClick={() => setShowForm(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-capsula-line py-2 text-xs font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted transition-colors hover:border-capsula-navy hover:text-capsula-ink"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Crear anuncio al equipo
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Nuevo anuncio</p>
                    <input
                      type="text"
                      placeholder="Título"
                      value={newMsg.title}
                      onChange={(e) => setNewMsg({ ...newMsg, title: e.target.value })}
                      className="w-full rounded-lg border border-capsula-line bg-capsula-ivory px-3 py-2 text-xs text-capsula-ink focus:border-capsula-navy focus:outline-none"
                    />
                    <textarea
                      placeholder="Mensaje..."
                      value={newMsg.body}
                      onChange={(e) => setNewMsg({ ...newMsg, body: e.target.value })}
                      rows={2}
                      className="w-full resize-none rounded-lg border border-capsula-line bg-capsula-ivory px-3 py-2 text-xs text-capsula-ink focus:border-capsula-navy focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <select
                        value={newMsg.type}
                        onChange={(e) => setNewMsg({ ...newMsg, type: e.target.value as typeof newMsg.type })}
                        className="flex-1 rounded-lg border border-capsula-line bg-capsula-ivory px-2 py-1.5 text-xs text-capsula-ink focus:outline-none"
                      >
                        {MSG_TYPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        placeholder="Expira en h"
                        value={newMsg.expiresInHours}
                        onChange={(e) => setNewMsg({ ...newMsg, expiresInHours: e.target.value })}
                        className="w-24 rounded-lg border border-capsula-line bg-capsula-ivory px-2 py-1.5 text-xs text-capsula-ink focus:outline-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowForm(false)}
                        className="flex-1 rounded-lg border border-capsula-line py-1.5 text-xs font-medium text-capsula-ink-muted transition-colors hover:bg-capsula-ivory-alt"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleCreateBroadcast}
                        disabled={isSaving || !newMsg.title.trim() || !newMsg.body.trim()}
                        className="flex-1 rounded-lg bg-capsula-navy-deep py-1.5 text-xs font-semibold text-capsula-ivory transition-colors hover:bg-capsula-navy disabled:opacity-50"
                      >
                        {isSaving ? '...' : 'Publicar'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="border-t border-capsula-line bg-capsula-ivory-alt px-4 py-3">
              <p className="text-center text-[9px] font-medium uppercase tracking-[0.18em] text-capsula-ink-muted">
                CÁPSULA · Alertas en tiempo real · Actualiza cada 90 seg
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
