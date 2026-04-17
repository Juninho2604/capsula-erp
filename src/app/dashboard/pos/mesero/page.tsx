"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  addItemsToOpenTabAction,
  getMenuForPOSAction,
  getRestaurantLayoutAction,
  openTabAction,
  removeItemFromOpenTabAction,
  type CartItem,
} from "@/app/actions/pos.actions";
import { getActiveWaitersForBranchAction } from "@/app/actions/waiter.actions";
import { WaiterIdentification } from "@/components/pos/WaiterIdentification";
import { TableTransferModal } from "@/components/pos/TableTransferModal";
import { ShowBillModal } from "@/components/pos/ShowBillModal";
import toast from "react-hot-toast";

// ============================================================================
// TIPOS
// ============================================================================

interface ModifierOption {
  id: string;
  name: string;
  priceAdjustment: number;
  isAvailable: boolean;
}
interface ModifierGroup {
  id: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  modifiers: ModifierOption[];
}
interface MenuItem {
  id: string;
  categoryId: string;
  sku: string;
  name: string;
  price: number;
  modifierGroups: { modifierGroup: ModifierGroup }[];
}
interface SelectedModifier {
  groupId: string;
  groupName: string;
  id: string;
  name: string;
  priceAdjustment: number;
  quantity: number;
}
interface OrderItemSummary {
  id: string;
  itemName: string;
  quantity: number;
  lineTotal: number;
  unitPrice: number;
  modifiers?: { name: string }[];
}
interface SalesOrderSummary {
  id: string;
  orderNumber: string;
  total: number;
  kitchenStatus: string;
  createdAt: string;
  items: OrderItemSummary[];
}
interface WaiterProfileSummary {
  id: string;
  firstName: string;
  lastName: string;
  isCaptain: boolean;
}
interface OpenTabSummary {
  id: string;
  tabCode: string;
  customerLabel?: string;
  status: string;
  runningTotal: number;
  waiterProfileId?: string | null;
  waiterProfile?: WaiterProfileSummary | null;
  waiterLabel?: string | null;
  orders: SalesOrderSummary[];
}
interface TableSummary {
  id: string;
  name: string;
  code: string;
  stationType: string;
  capacity: number;
  currentStatus: string;
  openTabs: OpenTabSummary[];
}
interface ZoneSummary {
  id: string;
  name: string;
  zoneType: string;
  tablesOrStations: TableSummary[];
}
interface BranchLayout {
  id: string;
  name: string;
  serviceZones: ZoneSummary[];
}
interface ActiveWaiter {
  id: string;
  firstName: string;
  lastName: string;
  isCaptain: boolean;
}
interface WaiterOption {
  id: string;
  firstName: string;
  lastName: string;
  hasPin: boolean;
  isCaptain: boolean;
}

// ============================================================================
// COMPONENTE PRINCIPAL — POS MESONERO CON PIN
// ============================================================================

export default function POSMeseroPage() {
  // ── Waiter identification ──────────────────────────────────────────────────
  const [activeWaiter, setActiveWaiter] = useState<ActiveWaiter | null>(null);
  const [waiterChecked, setWaiterChecked] = useState(false);
  const [allWaiters, setAllWaiters] = useState<WaiterOption[]>([]);

  // ── Data ──────────────────────────────────────────────────────────────────
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [layout, setLayout] = useState<BranchLayout | null>(null);
  const [productSearch, setProductSearch] = useState("");

  // ── Zone / Table selection ─────────────────────────────────────────────────
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [selectedTableId, setSelectedTableId] = useState("");

  // ── Open tab dialog ────────────────────────────────────────────────────────
  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const [pendingTableId, setPendingTableId] = useState("");

  // ── Modifier modal ─────────────────────────────────────────────────────────
  const [showModifierModal, setShowModifierModal] = useState(false);
  const [selectedItemForModifier, setSelectedItemForModifier] = useState<MenuItem | null>(null);
  const [currentModifiers, setCurrentModifiers] = useState<SelectedModifier[]>([]);
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemNotes, setItemNotes] = useState("");

  // ── Remove item ────────────────────────────────────────────────────────────
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ orderId: string; itemId: string; itemName: string } | null>(null);
  const [removePin, setRemovePin] = useState("");
  const [removeJustification, setRemoveJustification] = useState("");
  const [removeError, setRemoveError] = useState("");

  // ── Transfer & Bill modals ─────────────────────────────────────────────────
  const [showTransfer, setShowTransfer] = useState(false);
  const [showBill, setShowBill] = useState(false);

  // ── State flags ───────────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // ============================================================================
  // CHECK SESSION STORAGE
  // ============================================================================

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("activeWaiter");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.id) setActiveWaiter(parsed);
      }
    } catch { /* ignore */ }
    setWaiterChecked(true);
  }, []);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [menuResult, layoutResult, waitersResult] = await Promise.all([
        getMenuForPOSAction(),
        getRestaurantLayoutAction(),
        getActiveWaitersForBranchAction(),
      ]);
      if (menuResult.success && menuResult.data) {
        setCategories(menuResult.data);
        setSelectedCategory((prev) => prev || menuResult.data[0]?.id || "");
      }
      if (layoutResult.success && layoutResult.data) {
        const l = layoutResult.data as BranchLayout;
        setLayout(l);
        setSelectedZoneId((prev) => prev || l.serviceZones[0]?.id || "");
      }
      if (waitersResult.success && waitersResult.data) {
        setAllWaiters(waitersResult.data);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeWaiter) loadData();
  }, [activeWaiter, loadData]);

  useEffect(() => {
    if (!selectedCategory || !categories.length) return;
    const cat = categories.find((c: any) => c.id === selectedCategory);
    setMenuItems(cat?.items || []);
  }, [selectedCategory, categories]);

  // ============================================================================
  // DERIVED STATE
  // ============================================================================

  const selectedZone = useMemo(
    () => layout?.serviceZones.find((z) => z.id === selectedZoneId) || null,
    [layout, selectedZoneId],
  );
  const selectedTable = useMemo(
    () => selectedZone?.tablesOrStations.find((t) => t.id === selectedTableId) || null,
    [selectedZone, selectedTableId],
  );
  const activeTab = useMemo(() => selectedTable?.openTabs[0] || null, [selectedTable]);

  const allMenuItems = useMemo(() => categories.flatMap((c: any) => c.items || []), [categories]);
  const filteredMenuItems = useMemo(() => {
    if (!productSearch.trim()) return menuItems;
    const q = productSearch.toLowerCase();
    return allMenuItems.filter(
      (i: MenuItem) => i.name.toLowerCase().includes(q) || i.sku?.toLowerCase().includes(q),
    );
  }, [menuItems, productSearch, allMenuItems]);

  // All items across all orders in the active tab
  const tabItems = useMemo(() => {
    if (!activeTab) return [];
    return activeTab.orders.flatMap((o) =>
      o.items.map((it) => ({ ...it, orderId: o.id })),
    );
  }, [activeTab]);

  const subtotal = useMemo(() => tabItems.reduce((s, it) => s + it.lineTotal, 0), [tabItems]);
  const service = subtotal * 0.10;
  const totalUsd = subtotal + service;

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleLogout = () => {
    sessionStorage.removeItem("activeWaiter");
    setActiveWaiter(null);
    setSelectedTableId("");
    setSelectedZoneId("");
  };

  const handleTableClick = (table: TableSummary) => {
    const tab = table.openTabs[0];
    if (!tab) {
      // Free table → open dialog
      setPendingTableId(table.id);
      setShowOpenDialog(true);
    } else {
      // Occupied → select it
      setSelectedTableId(table.id);
    }
  };

  const handleOpenTab = async () => {
    if (!activeWaiter || !pendingTableId) return;
    setIsProcessing(true);
    try {
      const res = await openTabAction({
        tableOrStationId: pendingTableId,
        waiterProfileId: activeWaiter.id,
        waiterLabel: `${activeWaiter.firstName} ${activeWaiter.lastName}`,
      });
      if (res.success) {
        toast.success("Mesa abierta");
        setShowOpenDialog(false);
        setSelectedTableId(pendingTableId);
        await loadData();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Error al abrir mesa");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddItem = (item: MenuItem) => {
    if (item.modifierGroups?.length > 0) {
      setSelectedItemForModifier(item);
      setCurrentModifiers([]);
      setItemQuantity(1);
      setItemNotes("");
      setShowModifierModal(true);
      return;
    }
    sendItemsToTab([
      {
        menuItemId: item.id,
        name: item.name,
        quantity: 1,
        unitPrice: item.price,
        modifiers: [],
        lineTotal: item.price,
      },
    ]);
  };

  const handleConfirmModifiers = () => {
    if (!selectedItemForModifier) return;
    const modTotal = currentModifiers.reduce((s, m) => s + m.priceAdjustment * m.quantity, 0);
    const unitPrice = selectedItemForModifier.price + modTotal;
    sendItemsToTab([
      {
        menuItemId: selectedItemForModifier.id,
        name: selectedItemForModifier.name,
        quantity: itemQuantity,
        unitPrice,
        modifiers: currentModifiers.map((m) => ({
          modifierId: m.id,
          name: m.name,
          priceAdjustment: m.priceAdjustment,
        })),
        notes: itemNotes || undefined,
        lineTotal: unitPrice * itemQuantity,
      },
    ]);
    setShowModifierModal(false);
  };

  const sendItemsToTab = async (items: CartItem[]) => {
    if (!activeTab) return;
    setIsProcessing(true);
    try {
      const res = await addItemsToOpenTabAction({ openTabId: activeTab.id, items });
      if (res.success) {
        toast.success("Pedido enviado a cocina");
        await loadData();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Error al agregar items");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRequestRemove = (orderId: string, itemId: string, itemName: string) => {
    setRemoveTarget({ orderId, itemId, itemName });
    setRemovePin("");
    setRemoveJustification("");
    setRemoveError("");
    setShowRemoveModal(true);
  };

  const handleRemoveItem = async () => {
    if (!removeTarget || !activeTab) return;
    if (!removeJustification.trim()) {
      setRemoveError("La justificación es obligatoria");
      return;
    }
    setIsProcessing(true);
    setRemoveError("");
    try {
      const res = await removeItemFromOpenTabAction({
        openTabId: activeTab.id,
        orderId: removeTarget.orderId,
        itemId: removeTarget.itemId,
        cashierPin: removePin,
        justification: removeJustification,
      });
      if (!res.success) {
        setRemoveError(res.message);
        return;
      }
      setShowRemoveModal(false);
      toast.success("Item eliminado");
      await loadData();
    } catch {
      setRemoveError("Error al eliminar");
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleModifier = (mod: ModifierOption, group: ModifierGroup) => {
    setCurrentModifiers((prev) => {
      const exists = prev.find((m) => m.id === mod.id);
      if (exists) return prev.filter((m) => m.id !== mod.id);
      const groupCount = prev.filter((m) => m.groupId === group.id).length;
      if (group.maxSelections > 0 && groupCount >= group.maxSelections) return prev;
      return [
        ...prev,
        {
          groupId: group.id,
          groupName: group.name,
          id: mod.id,
          name: mod.name,
          priceAdjustment: mod.priceAdjustment,
          quantity: 1,
        },
      ];
    });
  };

  // ============================================================================
  // TABLE COLOR HELPER
  // ============================================================================

  const getTableColor = (table: TableSummary) => {
    const tab = table.openTabs[0];
    if (!tab) return "border-slate-700 bg-slate-800 hover:bg-slate-700"; // free = gray
    if (tab.waiterProfileId === activeWaiter?.id) {
      return "border-emerald-500 bg-emerald-900/40 hover:bg-emerald-900/60 ring-1 ring-emerald-500/30"; // mine = green
    }
    return "border-blue-500 bg-blue-900/40 hover:bg-blue-900/60"; // other waiter = blue
  };

  const getTableDot = (table: TableSummary) => {
    const tab = table.openTabs[0];
    if (!tab) return "bg-slate-600";
    if (tab.waiterProfileId === activeWaiter?.id) return "bg-emerald-400";
    return "bg-blue-400";
  };

  // ============================================================================
  // RENDER — IDENTIFICATION GATE
  // ============================================================================

  if (!waiterChecked) return null;

  if (!activeWaiter) {
    return (
      <WaiterIdentification
        onIdentified={(w) => setActiveWaiter(w)}
      />
    );
  }

  // ============================================================================
  // RENDER — MAIN POS
  // ============================================================================

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-white overflow-hidden">
      {/* ── TOPBAR ────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-coral-500 to-coral-600 text-sm font-bold">
            {activeWaiter.firstName[0]}{activeWaiter.lastName[0]}
          </div>
          <div>
            <span className="font-semibold text-sm">
              {activeWaiter.firstName} {activeWaiter.lastName}
            </span>
            {activeWaiter.isCaptain && (
              <span className="ml-2 inline-flex items-center gap-1 rounded bg-amber-900/50 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                ⭐ Capitán
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-red-900/30 px-2 py-1 text-[10px] font-medium text-red-400">
            Sin cobro
          </span>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            Salir
          </button>
        </div>
      </header>

      {/* ── BODY ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── LEFT: ZONE TABS + TABLE GRID ────────────────────────────────── */}
        <div className={`flex flex-col ${selectedTableId && activeTab ? "w-1/2 lg:w-7/12" : "w-full"} border-r border-slate-800`}>
          {/* Zone tabs */}
          {layout && (
            <div className="flex gap-1 overflow-x-auto border-b border-slate-800 px-3 py-2">
              {layout.serviceZones.map((z) => (
                <button
                  key={z.id}
                  onClick={() => { setSelectedZoneId(z.id); setSelectedTableId(""); }}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    z.id === selectedZoneId
                      ? "bg-coral-500 text-white"
                      : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                  }`}
                >
                  {z.name}
                </button>
              ))}
            </div>
          )}

          {/* Table grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="animate-pulse text-slate-500">Cargando mesas...</div>
              </div>
            ) : selectedZone ? (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {selectedZone.tablesOrStations.map((table) => {
                  const tab = table.openTabs[0];
                  const isSelected = table.id === selectedTableId;
                  return (
                    <button
                      key={table.id}
                      onClick={() => handleTableClick(table)}
                      className={`
                        relative flex flex-col items-center justify-center rounded-xl border-2 p-3 transition-all min-h-[80px]
                        ${getTableColor(table)}
                        ${isSelected ? "ring-2 ring-coral-500 scale-105" : ""}
                      `}
                    >
                      <div className={`absolute top-1.5 right-1.5 h-2 w-2 rounded-full ${getTableDot(table)}`} />
                      <span className="text-sm font-bold">{table.code}</span>
                      {tab && (
                        <span className="mt-1 text-[10px] text-slate-300 truncate max-w-full">
                          {tab.waiterProfile
                            ? `${tab.waiterProfile.firstName} ${tab.waiterProfile.lastName[0]}.`
                            : tab.waiterLabel || "—"}
                        </span>
                      )}
                      {tab && (
                        <span className="mt-0.5 text-[10px] font-semibold text-emerald-400">
                          ${tab.runningTotal.toFixed(2)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-slate-500">Sin zonas configuradas</p>
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 border-t border-slate-800 px-4 py-2 text-[10px] text-slate-500">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-600" /> Libre</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Mía</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-400" /> Otro</span>
          </div>
        </div>

        {/* ── RIGHT: ORDER PANEL (only when a tab is selected) ────────────── */}
        {selectedTableId && activeTab && (
          <div className="flex w-1/2 lg:w-5/12 flex-col overflow-hidden">
            {/* Tab header */}
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5">
              <div>
                <h3 className="text-sm font-bold">{selectedTable?.code} — {activeTab.tabCode}</h3>
                {activeTab.waiterProfile && (
                  <p className="text-[10px] text-slate-400">
                    Mesonero: {activeTab.waiterProfile.firstName} {activeTab.waiterProfile.lastName}
                  </p>
                )}
              </div>
              <button
                onClick={() => setSelectedTableId("")}
                className="text-xs text-slate-500 hover:text-slate-300"
              >
                ✕
              </button>
            </div>

            {/* Items list */}
            <div className="flex-1 overflow-y-auto">
              <div className="divide-y divide-slate-800">
                {tabItems.length === 0 && (
                  <p className="p-4 text-center text-sm text-slate-500">Sin items — agrega del menú</p>
                )}
                {tabItems.map((it, i) => (
                  <div key={`${it.orderId}-${it.id}-${i}`} className="flex items-center justify-between px-4 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{it.quantity}× {it.itemName}</p>
                      {it.modifiers && it.modifiers.length > 0 && (
                        <p className="text-[10px] text-slate-500 truncate">
                          {it.modifiers.map((m: any) => m.name).join(", ")}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">${it.lineTotal.toFixed(2)}</span>
                      <button
                        onClick={() => handleRequestRemove(it.orderId, it.id, it.itemName)}
                        className="rounded p-1 text-slate-500 hover:bg-red-900/30 hover:text-red-400 transition-colors"
                        title="Eliminar item"
                      >
                        −
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick menu */}
              <div className="border-t border-slate-800 p-3">
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Buscar producto..."
                  className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-coral-500 focus:outline-none"
                />
                {/* Category tabs */}
                <div className="mb-2 flex gap-1 overflow-x-auto">
                  {categories.map((c: any) => (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedCategory(c.id); setProductSearch(""); }}
                      className={`whitespace-nowrap rounded px-2 py-1 text-[10px] font-medium transition-colors ${
                        c.id === selectedCategory
                          ? "bg-coral-500 text-white"
                          : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
                {/* Items grid */}
                <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                  {filteredMenuItems.map((item: MenuItem) => (
                    <button
                      key={item.id}
                      onClick={() => handleAddItem(item)}
                      disabled={isProcessing}
                      className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-left hover:bg-slate-700 disabled:opacity-50 transition-colors"
                    >
                      <span className="text-[11px] truncate flex-1">{item.name}</span>
                      <span className="ml-1 text-[10px] font-semibold text-coral-400">${item.price.toFixed(2)}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom: totals + actions */}
            <div className="border-t border-slate-800 bg-slate-900 px-4 py-3 space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>Servicio 10%</span>
                <span>${service.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold">
                <span>Total USD</span>
                <span>${totalUsd.toFixed(2)}</span>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowBill(true)}
                  className="flex-1 rounded-lg bg-slate-700 py-2 text-xs font-semibold hover:bg-slate-600 transition-colors"
                >
                  Mostrar cuenta
                </button>
                {activeWaiter.isCaptain && (
                  <button
                    onClick={() => setShowTransfer(true)}
                    className="flex-1 rounded-lg border border-amber-600 py-2 text-xs font-semibold text-amber-400 hover:bg-amber-900/30 transition-colors"
                  >
                    Transferir mesa
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── OPEN TABLE DIALOG ─────────────────────────────────────────────── */}
      {showOpenDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
          <div className="w-full max-w-xs rounded-2xl bg-slate-900 border border-slate-700 p-6 text-center shadow-2xl">
            <h3 className="mb-2 text-lg font-bold">¿Abrir esta mesa?</h3>
            <p className="mb-5 text-sm text-slate-400">
              Se asignará a {activeWaiter.firstName} {activeWaiter.lastName}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowOpenDialog(false)}
                className="flex-1 rounded-lg border border-slate-600 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleOpenTab}
                disabled={isProcessing}
                className="flex-1 rounded-lg bg-coral-500 py-2 text-sm font-semibold hover:bg-coral-600 disabled:opacity-50 transition-colors"
              >
                {isProcessing ? "Abriendo..." : "Abrir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODIFIER MODAL ────────────────────────────────────────────────── */}
      {showModifierModal && selectedItemForModifier && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md max-h-[80vh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl">
            <h3 className="mb-1 text-lg font-bold">{selectedItemForModifier.name}</h3>
            <p className="mb-4 text-sm text-slate-400">${selectedItemForModifier.price.toFixed(2)}</p>

            {/* Quantity */}
            <div className="mb-4 flex items-center gap-3">
              <span className="text-sm text-slate-400">Cantidad:</span>
              <button
                onClick={() => setItemQuantity((q) => Math.max(1, q - 1))}
                className="rounded bg-slate-800 px-3 py-1 text-lg hover:bg-slate-700"
              >
                −
              </button>
              <span className="text-lg font-bold w-8 text-center">{itemQuantity}</span>
              <button
                onClick={() => setItemQuantity((q) => q + 1)}
                className="rounded bg-slate-800 px-3 py-1 text-lg hover:bg-slate-700"
              >
                +
              </button>
            </div>

            {/* Modifier groups */}
            {selectedItemForModifier.modifierGroups.map(({ modifierGroup: g }) => (
              <div key={g.id} className="mb-3">
                <p className="mb-1 text-xs font-semibold text-slate-300">
                  {g.name}
                  {g.isRequired && <span className="text-red-400"> *</span>}
                  {g.maxSelections > 0 && (
                    <span className="text-slate-500"> (máx {g.maxSelections})</span>
                  )}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {g.modifiers.filter((m) => m.isAvailable).map((m) => {
                    const sel = currentModifiers.some((cm) => cm.id === m.id);
                    return (
                      <button
                        key={m.id}
                        onClick={() => toggleModifier(m, g)}
                        className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
                          sel
                            ? "bg-coral-500 text-white"
                            : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        }`}
                      >
                        {m.name}
                        {m.priceAdjustment > 0 && (
                          <span className="ml-1 text-[10px] opacity-70">+${m.priceAdjustment.toFixed(2)}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Notes */}
            <input
              type="text"
              value={itemNotes}
              onChange={(e) => setItemNotes(e.target.value)}
              placeholder="Notas (opcional)"
              className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-coral-500 focus:outline-none"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowModifierModal(false)}
                className="flex-1 rounded-lg border border-slate-600 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmModifiers}
                disabled={isProcessing}
                className="flex-1 rounded-lg bg-coral-500 py-2 text-sm font-semibold hover:bg-coral-600 disabled:opacity-50 transition-colors"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REMOVE ITEM MODAL ─────────────────────────────────────────────── */}
      {showRemoveModal && removeTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl">
            <h3 className="mb-1 text-lg font-bold">Eliminar item</h3>
            <p className="mb-4 text-sm text-slate-400">
              {removeTarget.itemName}
            </p>

            <label className="mb-1 block text-xs text-slate-400">PIN de supervisor</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={removePin}
              onChange={(e) => setRemovePin(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              className="mb-3 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white text-center tracking-[0.5em] placeholder-slate-500 focus:border-coral-500 focus:outline-none"
            />

            <label className="mb-1 block text-xs text-slate-400">Justificación *</label>
            <input
              type="text"
              value={removeJustification}
              onChange={(e) => setRemoveJustification(e.target.value)}
              placeholder="Motivo de eliminación"
              className="mb-3 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-coral-500 focus:outline-none"
            />

            {removeError && <p className="mb-3 text-xs text-red-400">{removeError}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => setShowRemoveModal(false)}
                className="flex-1 rounded-lg border border-slate-600 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleRemoveItem}
                disabled={isProcessing}
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {isProcessing ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SHOW BILL MODAL ───────────────────────────────────────────────── */}
      <ShowBillModal
        open={showBill}
        onClose={() => setShowBill(false)}
        items={tabItems.map((it) => ({
          itemName: it.itemName,
          quantity: it.quantity,
          lineTotal: it.lineTotal,
        }))}
        tableName={selectedTable?.code}
      />

      {/* ── TABLE TRANSFER MODAL ──────────────────────────────────────────── */}
      {activeTab && (
        <TableTransferModal
          open={showTransfer}
          onClose={() => setShowTransfer(false)}
          openTabId={activeTab.id}
          currentWaiterId={activeWaiter.id}
          waiters={allWaiters.map((w) => ({ id: w.id, firstName: w.firstName, lastName: w.lastName }))}
          onTransferred={async () => {
            toast.success("Mesa transferida");
            await loadData();
            setSelectedTableId("");
          }}
        />
      )}
    </div>
  );
}
