"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChefHat, Lock, LogOut, RefreshCw, Phone, AlertTriangle, Search, X as XIcon, ArrowLeft, Plus as PlusIcon, ShoppingCart, Flame, Check, Armchair, ClipboardList, UtensilsCrossed, Receipt, Divide, ArrowLeftRight } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import {
  addItemsToOpenTabAction,
  getMenuForPOSAction,
  getRestaurantLayoutAction,
  openTabAction,
  modifyTabItemAction,
  type CartItem,
  type ModifyTabItemModification,
} from "@/app/actions/pos.actions";
import { getExchangeRateValue } from "@/app/actions/exchange.actions";
import { moveTabBetweenTablesAction } from "@/app/actions/waiter.actions";
import { printKitchenCommand, printVoidKitchenCommand, type VoidKitchenCommandData } from "@/lib/print-command";
import { getPOSConfig } from "@/lib/pos-settings";
import toast from "react-hot-toast";
import { PriceDisplay } from "@/components/pos/PriceDisplay";
import { SubAccountPanel } from "@/components/pos/SubAccountPanel";
import {
  WaiterIdentification,
  type ActiveWaiter,
} from "@/components/pos/WaiterIdentification";

const ACTIVE_WAITER_KEY = "pos-mesero-active-waiter";

// ============================================================================
// TIPOS (igual que restaurante)
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
  posGroup?: string | null;
  posSubcategory?: string | null;
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
interface UserSummary {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}
interface OpenTabSummary {
  id: string;
  tabCode: string;
  customerLabel?: string;
  customerPhone?: string;
  guestCount: number;
  status: string;
  runningTotal: number;
  balanceDue: number;
  openedAt: string;
  openedBy: UserSummary;
  assignedWaiter?: UserSummary | null;
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
interface SportBarLayout {
  id: string;
  name: string;
  serviceZones: ZoneSummary[];
}

function formatTime(d: string | Date) {
  return new Date(d).toLocaleTimeString("es-VE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Caracas",
  });
}

// ============================================================================
// COMPONENTE PRINCIPAL — POS MESERO (sin cobro)
// ============================================================================

export default function POSMeseroPage() {
  // ── Data ──────────────────────────────────────────────────────────────────
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [layout, setLayout] = useState<SportBarLayout | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [selectedSubcategory, setSelectedSubcategory] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");

  // ── Zone / Table selection ─────────────────────────────────────────────────
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [selectedTableId, setSelectedTableId] = useState("");

  // ── Open tab form ──────────────────────────────────────────────────────────
  const [showOpenTabModal, setShowOpenTabModal] = useState(false);
  const [openTabName, setOpenTabName] = useState("");
  const [openTabPhone, setOpenTabPhone] = useState("");
  const [openTabGuests, setOpenTabGuests] = useState(2);

  // ── Cart ──────────────────────────────────────────────────────────────────
  const [cart, setCart] = useState<CartItem[]>([]);

  // ── Modifier modal ─────────────────────────────────────────────────────────
  const [showModifierModal, setShowModifierModal] = useState(false);
  const [selectedItemForModifier, setSelectedItemForModifier] = useState<MenuItem | null>(null);
  const [currentModifiers, setCurrentModifiers] = useState<SelectedModifier[]>([]);
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemNotes, setItemNotes] = useState("");

  // ── Modificar ítem enviado (void / ajuste cantidad / reemplazo) ──────────
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{
    orderId: string;
    itemId: string;
    itemName: string;
    quantity: number;
    lineTotal: number;
    modifiers: string[];
  } | null>(null);
  const [removeModType, setRemoveModType] = useState<"VOID" | "ADJUST_QTY" | "REPLACE">("VOID");
  const [removeNewQty, setRemoveNewQty] = useState(1);
  const [removeReplaceItemId, setRemoveReplaceItemId] = useState("");
  const [removeReplaceSearch, setRemoveReplaceSearch] = useState("");
  const [removePin, setRemovePin] = useState("");
  const [removeJustification, setRemoveJustification] = useState("");
  const [removeError, setRemoveError] = useState("");

  // ── State flags ───────────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [layoutError, setLayoutError] = useState("");
  const [sendSuccess, setSendSuccess] = useState(false);

  // ── Subcuentas ────────────────────────────────────────────────────────────
  const [subAccountMode, setSubAccountMode] = useState(false);

  // ── Mostrar cuenta al cliente ─────────────────────────────────────────────
  const [showBillModal, setShowBillModal] = useState(false);

  // ── Mover tab entre mesas físicas (solo capitanes) ────────────────────────
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferToTableId, setTransferToTableId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferCaptainPin, setTransferCaptainPin] = useState("");
  const [transferError, setTransferError] = useState("");

  // ── Navegación móvil ──────────────────────────────────────────────────────
  const [mobileTab, setMobileTab] = useState<"tables" | "menu" | "account">("tables");

  const { user: currentUser } = useAuthStore();
  const MANAGER_ROLES = ["OWNER", "ADMIN_MANAGER", "OPS_MANAGER"];

  // ── Identificación del mesonero ───────────────────────────────────────────
  const [activeWaiter, setActiveWaiter] = useState<ActiveWaiter | null>(null);
  const [waiterHydrated, setWaiterHydrated] = useState(false);
  const canUseCaptainFeatures =
    activeWaiter?.isCaptain || MANAGER_ROLES.includes(currentUser?.role ?? "");

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(ACTIVE_WAITER_KEY);
      if (raw) setActiveWaiter(JSON.parse(raw) as ActiveWaiter);
    } catch {
      // ignore
    }
    setWaiterHydrated(true);
  }, []);

  const handleWaiterIdentified = (w: ActiveWaiter) => {
    sessionStorage.setItem(ACTIVE_WAITER_KEY, JSON.stringify(w));
    setActiveWaiter(w);
  };

  const handleWaiterLogout = () => {
    sessionStorage.removeItem(ACTIVE_WAITER_KEY);
    setActiveWaiter(null);
    setCart([]);
    setSelectedTableId("");
  };

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  const loadData = async (showSpinner = true) => {
    if (showSpinner) setIsLoading(true);
    setLayoutError("");
    try {
      const [menuResult, layoutResult, rate] = await Promise.all([
        getMenuForPOSAction(),
        getRestaurantLayoutAction(),
        getExchangeRateValue(),
      ]);
      if (menuResult.success && menuResult.data) {
        setCategories(menuResult.data);
        setSelectedCategory((prev) => prev || menuResult.data[0]?.id || "");
      }
      if (layoutResult.success && layoutResult.data) {
        const nextLayout = layoutResult.data as SportBarLayout;
        setLayout(nextLayout);
        setSelectedZoneId((prev) => prev || nextLayout.serviceZones[0]?.id || "");
      } else if (!layoutResult.success) {
        setLayoutError(layoutResult.message || "Error cargando mesas");
      }
      setExchangeRate(rate);
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // ── Auto-polling: sincronización silenciosa del layout cada 15 s ─────────────
  const isProcessingRef = useRef(isProcessing);
  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);

  const pollLayout = useCallback(async () => {
    const [layoutResult, rate] = await Promise.all([
      getRestaurantLayoutAction(),
      getExchangeRateValue(),
    ]);
    if (layoutResult.success && layoutResult.data) {
      setLayout(layoutResult.data as SportBarLayout);
    }
    if (rate) setExchangeRate(rate);
  }, []);

  useEffect(() => {
    const POLL_MS = 5_000;
    const id = setInterval(() => {
      if (!document.hidden && !isProcessingRef.current) pollLayout();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [pollLayout]);
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedCategory || !categories.length) return;
    const cat = categories.find((c) => c.id === selectedCategory);
    setMenuItems(cat?.items || []);
    setSelectedSubcategory("");
    setSelectedGroup("");
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

  const allMenuItems = useMemo(() => categories.flatMap((c) => c.items || []), [categories]);
  const filteredMenuItems = useMemo(() => {
    if (!productSearch.trim()) return menuItems;
    const q = productSearch.toLowerCase();
    return allMenuItems.filter((i) => i.name.toLowerCase().includes(q) || i.sku?.toLowerCase().includes(q));
  }, [menuItems, productSearch, allMenuItems]);

  // ── POS Hierarchical Navigation (subcategoría → grupo → tamaños / singles) ──
  const subcatFilteredItems = useMemo(() => {
    if (!selectedSubcategory) return menuItems;
    return menuItems.filter((i) => i.posSubcategory === selectedSubcategory);
  }, [menuItems, selectedSubcategory]);

  const subcategories = useMemo(() => {
    const subcats = menuItems.map((i) => i.posSubcategory).filter(Boolean) as string[];
    return Array.from(new Set(subcats));
  }, [menuItems]);

  const groupsInView = useMemo(() => {
    const groups = subcatFilteredItems.map((i) => i.posGroup).filter(Boolean) as string[];
    return Array.from(new Set(groups));
  }, [subcatFilteredItems]);

  const cartTotal = cart.reduce((s, i) => s + i.lineTotal, 0);
  const cartBadgeCount = cart.length;

  // ============================================================================
  // OPEN TAB
  // ============================================================================

  const handleOpenTab = async () => {
    if (!selectedTable) return;
    if (!activeWaiter) { toast.error("Identifícate con tu PIN antes de abrir una cuenta"); return; }
    if (!openTabName.trim()) { toast.error("El nombre del cliente es obligatorio"); return; }
    if (!openTabPhone.trim()) { toast.error("El teléfono del cliente es obligatorio"); return; }
    setIsProcessing(true);
    try {
      const result = await openTabAction({
        tableOrStationId: selectedTable.id,
        customerLabel: openTabName.trim(),
        customerPhone: openTabPhone.trim(),
        guestCount: openTabGuests,
        waiterLabel: `${activeWaiter.firstName} ${activeWaiter.lastName}`,
        waiterProfileId: activeWaiter.id,
      });
      if (!result.success) { toast.error(result.message); return; }
      setShowOpenTabModal(false);
      setOpenTabName(""); setOpenTabPhone(""); setOpenTabGuests(2);
      await loadData();
    } finally {
      setIsProcessing(false);
    }
  };

  // ============================================================================
  // CART & MODIFIERS
  // ============================================================================

  const handleAddToCart = (item: MenuItem) => {
    if (!activeTab) return;
    setSelectedItemForModifier(item);
    setCurrentModifiers([]);
    setItemQuantity(1);
    setItemNotes("");
    setShowModifierModal(true);
  };

  const updateModifierQuantity = (group: ModifierGroup, modifier: ModifierOption, change: number) => {
    const currentInGroup = currentModifiers.filter((m) => m.groupId === group.id);
    const totalSelected = currentInGroup.reduce((s, m) => s + m.quantity, 0);
    const existing = currentModifiers.find((m) => m.id === modifier.id && m.groupId === group.id);
    const currentQty = existing?.quantity || 0;
    if (change > 0) {
      if (group.maxSelections > 1 && totalSelected >= group.maxSelections) return;
      if (group.maxSelections === 1) {
        if (totalSelected >= 1 && existing) return;
        if (totalSelected >= 1 && !existing) {
          setCurrentModifiers([
            ...currentModifiers.filter((m) => m.groupId !== group.id),
            { groupId: group.id, groupName: group.name, id: modifier.id, name: modifier.name, priceAdjustment: modifier.priceAdjustment, quantity: 1 },
          ]);
          return;
        }
      }
    }
    const newQty = currentQty + change;
    if (newQty < 0) return;
    let mods = [...currentModifiers];
    if (existing) {
      mods = newQty === 0
        ? mods.filter((m) => !(m.id === modifier.id && m.groupId === group.id))
        : mods.map((m) => (m.id === modifier.id && m.groupId === group.id ? { ...m, quantity: newQty } : m));
    } else if (newQty > 0) {
      mods.push({ groupId: group.id, groupName: group.name, id: modifier.id, name: modifier.name, priceAdjustment: modifier.priceAdjustment, quantity: newQty });
    }
    setCurrentModifiers(mods);
  };

  const isGroupValid = (group: ModifierGroup) =>
    !group.isRequired || currentModifiers.filter((m) => m.groupId === group.id).reduce((s, m) => s + m.quantity, 0) >= group.minSelections;

  const confirmAddToCart = () => {
    if (!selectedItemForModifier) return;
    if (!selectedItemForModifier.modifierGroups.every((g) => isGroupValid(g.modifierGroup))) return;
    const modTotal = currentModifiers.reduce((s, m) => s + m.priceAdjustment * m.quantity, 0);
    const lineTotal = (selectedItemForModifier.price + modTotal) * itemQuantity;
    const exploded = currentModifiers.flatMap((m) =>
      Array(m.quantity).fill({ modifierId: m.id, name: m.name, priceAdjustment: m.priceAdjustment }),
    );
    setCart((prev) => [...prev, {
      menuItemId: selectedItemForModifier.id,
      name: selectedItemForModifier.name,
      quantity: itemQuantity,
      unitPrice: selectedItemForModifier.price,
      modifiers: exploded,
      notes: itemNotes || undefined,
      lineTotal,
    }]);
    setShowModifierModal(false);
  };

  // ============================================================================
  // ENVIAR PEDIDO A COCINA (sin cobro)
  // ============================================================================

  const handleSendToTab = async () => {
    if (!activeTab || cart.length === 0) return;
    if (!activeWaiter) { toast.error("Identifícate con tu PIN antes de enviar a cocina"); return; }
    setIsProcessing(true);
    try {
      const result = await addItemsToOpenTabAction({
        openTabId: activeTab.id,
        items: cart,
        waiterProfileId: activeWaiter.id,
      });
      if (!result.success) { toast.error(result.message); return; }
      if (result.data?.kitchenStatus === "SENT" && getPOSConfig().printComandaOnRestaurant) {
        printKitchenCommand({
          orderNumber: result.data.orderNumber,
          orderType: "RESTAURANT",
          tableName: selectedTable?.name ?? null,
          customerName: activeTab.customerLabel || null,
          items: cart.map((i) => ({ name: i.name, quantity: i.quantity, modifiers: i.modifiers.map((m) => m.name), notes: i.notes })),
          createdAt: new Date(),
        });
      }
      setCart([]);
      setSendSuccess(true);
      setTimeout(() => setSendSuccess(false), 2500);
      await loadData();
    } finally {
      setIsProcessing(false);
    }
  };

  // ============================================================================
  // REMOVE ITEM (requiere PIN de supervisor)
  // ============================================================================

  const openRemoveModal = (orderId: string, item: OrderItemSummary) => {
    setRemoveTarget({
      orderId,
      itemId: item.id,
      itemName: item.itemName,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
      modifiers: (item.modifiers ?? []).map((m) => m.name),
    });
    setRemoveModType("VOID");
    setRemoveNewQty(Math.max(1, item.quantity - 1));
    setRemoveReplaceItemId("");
    setRemoveReplaceSearch("");
    setRemovePin("");
    setRemoveJustification("");
    setRemoveError("");
    setShowRemoveModal(true);
  };

  const handleRemoveItem = async () => {
    if (!removeTarget || !activeTab) return;
    if (!removeJustification.trim()) { setRemoveError("El motivo es obligatorio"); return; }
    if (!removePin.trim()) { setRemoveError("Ingresa el PIN de capitán o gerente"); return; }
    if (removeModType === "ADJUST_QTY" && (removeNewQty < 1 || removeNewQty >= removeTarget.quantity)) {
      setRemoveError(`La cantidad debe ser entre 1 y ${removeTarget.quantity - 1}`); return;
    }
    if (removeModType === "REPLACE" && !removeReplaceItemId) {
      setRemoveError("Selecciona el producto de reemplazo"); return;
    }

    const modification: ModifyTabItemModification =
      removeModType === "VOID"       ? { type: "VOID" } :
      removeModType === "ADJUST_QTY" ? { type: "ADJUST_QTY", newQuantity: removeNewQty } :
                                       { type: "REPLACE", newMenuItemId: removeReplaceItemId };

    setIsProcessing(true); setRemoveError("");
    try {
      const result = await modifyTabItemAction({
        openTabId: activeTab.id,
        orderId: removeTarget.orderId,
        itemId: removeTarget.itemId,
        captainPin: removePin,
        reason: removeJustification,
        modification,
      });
      if (!result.success) { setRemoveError(result.message); return; }
      setShowRemoveModal(false);
      if (result.data?.kitchenPrintData) {
        printVoidKitchenCommand(result.data.kitchenPrintData as VoidKitchenCommandData);
      }
      await loadData(false);
    } finally {
      setIsProcessing(false);
    }
  };

  // ============================================================================
  // TRANSFERIR MESA (solo capitanes)
  // ============================================================================

  const openTransferModal = () => {
    if (!activeWaiter || !activeTab) return;
    setTransferToTableId("");
    setTransferReason("");
    setTransferCaptainPin("");
    setTransferError("");
    setShowTransferModal(true);
  };

  const handleTableTransfer = async () => {
    if (!activeTab) return;
    if (!transferToTableId) { setTransferError("Selecciona la mesa destino"); return; }
    if (!transferCaptainPin.trim()) { setTransferError("Ingresa el PIN de capitán o gerente"); return; }
    setIsProcessing(true); setTransferError("");
    try {
      const result = await moveTabBetweenTablesAction({
        openTabId: activeTab.id,
        toTableId: transferToTableId,
        captainPin: transferCaptainPin,
        reason: transferReason.trim() || undefined,
      });
      if (!result.success) { setTransferError(result.message); return; }
      toast.success(result.message);
      setShowTransferModal(false);
      setSelectedTableId(transferToTableId);
      await loadData(false);
    } finally {
      setIsProcessing(false);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (isLoading || !waiterHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-capsula-ivory">
        <div className="flex flex-col items-center gap-3 text-center">
          <ChefHat className="h-10 w-10 text-capsula-ink-muted" />
          <div className="text-xl font-semibold text-capsula-ink">Cargando POS Mesero…</div>
        </div>
      </div>
    );
  }

  if (!activeWaiter) {
    return <WaiterIdentification onIdentified={handleWaiterIdentified} />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-capsula-ivory pb-16 text-capsula-ink lg:pb-0">

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between border-b border-capsula-line bg-capsula-ivory-surface px-3 py-3 shadow-cap-soft md:px-6 md:py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-capsula-navy-soft text-capsula-ink md:h-12 md:w-12">
            <ChefHat className="h-5 w-5 md:h-6 md:w-6" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-[-0.02em] text-capsula-ink md:text-2xl">
              POS <span className="text-capsula-coral">Mesero</span>
            </h1>
            <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.1em] text-capsula-ink-muted">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-capsula-coral" />
              Solo toma de pedidos · Sin acceso a cobro
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Mesonero identificado */}
          <div className="hidden items-center gap-2 rounded-xl border border-capsula-line bg-capsula-navy-soft px-3 py-1.5 sm:flex">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-capsula-ivory text-xs font-semibold text-capsula-ink">
              {activeWaiter.firstName.charAt(0)}{activeWaiter.lastName.charAt(0)}
            </span>
            <div className="text-[11px] leading-tight">
              <div className="font-semibold uppercase tracking-[0.06em] text-capsula-ink">{activeWaiter.firstName}</div>
              <div className="text-[10px] text-capsula-ink-muted">Mesonero activo</div>
            </div>
          </div>
          <button
            onClick={handleWaiterLogout}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-capsula-line bg-capsula-ivory-surface px-3 text-[11px] font-medium uppercase tracking-[0.1em] text-capsula-ink-soft transition-colors hover:border-capsula-coral hover:text-capsula-coral"
            title="Cambiar mesonero"
          >
            <LogOut className="h-3.5 w-3.5" />
            Salir
          </button>
          <button
            onClick={() => loadData()}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-capsula-line bg-capsula-ivory-surface text-capsula-ink-muted transition-colors hover:border-capsula-navy-deep hover:text-capsula-ink"
            title="Actualizar"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <div className="hidden rounded-xl border border-capsula-line bg-capsula-ivory-alt px-3 py-2 text-xs font-medium tabular-nums text-capsula-ink-soft md:block">
            {new Date().toLocaleDateString("es-VE", { timeZone: "America/Caracas" })}
          </div>
        </div>
      </div>

      {/* ── BADGE MÓDULO RESTRINGIDO ─────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-[#E8D9B8] bg-[#F3EAD6]/40 px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[#946A1C]">
        <Lock className="h-3 w-3" />
        Modo Mesero — No se permite cobro ni descuentos en esta sesión
      </div>

      {/* ── MAIN GRID ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* ══ LEFT: TABLE GRID ═══════════════════════════════════════════ */}
        <aside className={`absolute inset-0 z-10 flex w-full shrink-0 flex-col overflow-hidden border-r border-capsula-line bg-capsula-ivory-alt/40 lg:relative lg:z-auto lg:w-72 xl:w-80 ${mobileTab === "tables" ? "flex" : "hidden"} lg:flex`}>
          {/* Zone selector */}
          <div className="space-y-3 border-b border-capsula-line p-4">
            <p className="pl-1 text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Secciones</p>
            <div className="flex flex-wrap gap-2">
              {layout?.serviceZones.map((z) => (
                <button
                  key={z.id}
                  onClick={() => { setSelectedZoneId(z.id); setSelectedTableId(""); }}
                  className={`min-w-0 flex-1 rounded-xl border py-3 text-xs font-semibold transition-colors active:scale-95 ${
                    selectedZoneId === z.id
                      ? "border-capsula-navy-deep bg-capsula-navy-deep text-capsula-ivory"
                      : "border-capsula-line bg-capsula-ivory-surface text-capsula-ink-soft hover:border-capsula-navy-deep"
                  }`}
                >
                  {z.name}
                </button>
              ))}
            </div>
            {layoutError && (
              <button
                onClick={() => loadData()}
                className="inline-flex w-full items-center justify-center gap-1.5 py-1 text-xs font-medium text-capsula-coral transition-colors hover:text-capsula-coral-hover"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Error · Reintentar
              </button>
            )}
          </div>

          {/* Table grid */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 lg:grid-cols-3">
              {selectedZone?.tablesOrStations.map((table) => {
                const tab = table.openTabs[0];
                const isSelected = table.id === selectedTableId;
                return (
                  <button
                    key={table.id}
                    onClick={() => {
                      setSelectedTableId(table.id);
                      if (!tab) {
                        setOpenTabName(""); setOpenTabPhone(""); setOpenTabGuests(2);
                        setShowOpenTabModal(true);
                      } else if (window.innerWidth < 1024) {
                        setMobileTab("account");
                      }
                    }}
                    className={`relative flex aspect-square flex-col items-center justify-center rounded-2xl border-2 transition-colors active:scale-90 ${
                      isSelected
                        ? "border-capsula-navy-deep bg-capsula-navy-soft shadow-cap-soft"
                        : tab
                          ? "border-capsula-coral/40 bg-capsula-coral-subtle"
                          : "border-capsula-line bg-capsula-ivory-surface hover:border-capsula-navy-deep"
                    }`}
                  >
                    <div className={`text-sm font-semibold md:text-base ${
                      isSelected ? "text-capsula-ink" : tab ? "text-capsula-coral" : "text-capsula-ink-muted"
                    }`}>
                      {table.code}
                    </div>
                    {tab && (
                      <div className="absolute right-1 top-1 h-2.5 w-2.5 animate-pulse rounded-full border-2 border-capsula-ivory-surface bg-capsula-coral" />
                    )}
                    {tab && (
                      <div className="mt-0.5 w-full truncate px-1 text-center text-[10px] font-medium tabular-nums text-capsula-ink-soft">
                        ${tab.balanceDue.toFixed(0)}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Info de mesa ocupada seleccionada */}
          {selectedTable && activeTab && (
            <div className="shrink-0 space-y-1 border-t border-capsula-line bg-capsula-ivory-surface p-3 text-xs">
              <div className="truncate font-semibold text-capsula-ink">{activeTab.customerLabel}</div>
              {activeTab.customerPhone && (
                <div className="inline-flex items-center gap-1.5 text-capsula-ink-muted">
                  <Phone className="h-3 w-3" />
                  {activeTab.customerPhone}
                </div>
              )}
              <div className="text-capsula-ink-muted">
                Abrió: <span className="text-capsula-ink">{activeTab.openedBy.firstName}</span>
                <span className="text-capsula-ink-muted"> · {formatTime(activeTab.openedAt)}</span>
              </div>
            </div>
          )}
        </aside>

        {/* ══ CENTER: MENU ════════════════════════════════════════════════ */}
        <main className={`absolute inset-0 z-10 flex flex-1 flex-col overflow-hidden border-r border-capsula-line bg-capsula-ivory lg:relative lg:z-auto ${mobileTab === "menu" ? "flex" : "hidden"} lg:flex`}>
          {/* Search + Categories */}
          <div className="shrink-0 space-y-2 border-b border-capsula-line p-3">
            {/* Active tab banner */}
            {activeTab ? (
              <div className="flex items-center justify-between rounded-xl border border-[#D3E2D8] bg-[#E5EDE7]/60 px-3 py-2 text-xs">
                <span className="text-[#2F6B4E]">
                  <b>{selectedTable?.name}</b> · {activeTab.customerLabel}
                </span>
                <span className="text-xs font-semibold tabular-nums text-[#2F6B4E]">
                  ${activeTab.balanceDue.toFixed(2)}
                </span>
              </div>
            ) : selectedTable ? (
              <div className="rounded-xl border border-capsula-line bg-capsula-ivory-alt px-3 py-2 text-xs text-capsula-ink-soft">
                {selectedTable.name} · Sin cuenta abierta — presiona &quot;Abrir cuenta&quot; para empezar
              </div>
            ) : (
              <div className="rounded-xl border border-capsula-line bg-capsula-ivory-alt px-3 py-2 text-xs text-capsula-ink-soft">
                Selecciona una mesa para comenzar
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-capsula-ink-muted" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Buscar producto…"
                className="w-full rounded-xl border border-capsula-line bg-capsula-ivory-surface py-2 pl-9 pr-9 text-sm text-capsula-ink placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none"
              />
              {productSearch && (
                <button
                  onClick={() => setProductSearch("")}
                  className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-capsula-ink-muted transition-colors hover:bg-capsula-ivory-alt hover:text-capsula-ink"
                  aria-label="Limpiar búsqueda"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Categories */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setSelectedSubcategory("");
                    setSelectedGroup("");
                    setProductSearch("");
                  }}
                  className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${
                    selectedCategory === cat.id
                      ? "border-capsula-navy-deep bg-capsula-navy-deep text-capsula-ivory"
                      : "border-capsula-line bg-capsula-ivory-surface text-capsula-ink-soft hover:border-capsula-navy-deep"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Subcategories */}
            {!productSearch && subcategories.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => { setSelectedSubcategory(""); setSelectedGroup(""); }}
                  className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
                    !selectedSubcategory
                      ? "border-capsula-navy-deep bg-capsula-navy-soft text-capsula-ink"
                      : "border-capsula-line bg-capsula-ivory-surface text-capsula-ink-muted hover:border-capsula-navy-deep"
                  }`}
                >
                  Todos
                </button>
                {subcategories.map((subcat) => (
                  <button
                    key={subcat}
                    onClick={() => { setSelectedSubcategory(subcat); setSelectedGroup(""); }}
                    className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
                      selectedSubcategory === subcat
                        ? "border-capsula-navy-deep bg-capsula-navy-soft text-capsula-ink"
                        : "border-capsula-line bg-capsula-ivory-surface text-capsula-ink-muted hover:border-capsula-navy-deep"
                    }`}
                  >
                    {subcat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Menu items */}
          <div className="scroll-smooth flex-1 overflow-y-auto p-4">
            {/* Back button cuando estás dentro de un grupo */}
            {selectedGroup && !productSearch && (
              <button
                onClick={() => setSelectedGroup("")}
                className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-capsula-navy-deep transition-colors hover:text-capsula-ink active:scale-95"
              >
                <ArrowLeft className="h-4 w-4" />
                {selectedGroup}
              </button>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 tablet-land:grid-cols-4 xl:grid-cols-4 md:gap-4">

              {/* ── Grupos (uno por cada posGroup único) ── */}
              {!selectedGroup && !productSearch && groupsInView.map((group) => {
                const gItems = subcatFilteredItems.filter((i) => i.posGroup === group);
                const prices = gItems.map((i) => i.price);
                const minP = Math.min(...prices);
                const maxP = Math.max(...prices);
                return (
                  <button
                    key={group}
                    onClick={() => setSelectedGroup(group)}
                    disabled={!activeTab}
                    className="pos-tile group flex h-28 flex-col justify-between !p-3 text-left disabled:opacity-30 disabled:grayscale md:h-32 md:!p-4"
                  >
                    <div className="line-clamp-2 text-sm font-semibold uppercase leading-tight tracking-[-0.01em] text-capsula-ink transition-colors group-hover:text-capsula-navy-deep">{group}</div>
                    <div className="mt-2 flex items-end justify-between">
                      <div className="text-base font-semibold tabular-nums text-capsula-navy-deep">
                        {minP === maxP ? `$${minP.toFixed(2)}` : `$${minP.toFixed(0)} – $${maxP.toFixed(0)}`}
                      </div>
                      <div className="rounded-full border border-capsula-line bg-capsula-ivory-alt px-2 py-0.5 text-[11px] font-medium text-capsula-ink-muted">
                        {gItems.length} op
                      </div>
                    </div>
                  </button>
                );
              })}

              {/* ── Variantes de tamaño dentro del grupo seleccionado ── */}
              {selectedGroup && !productSearch && subcatFilteredItems.filter((i) => i.posGroup === selectedGroup).map((item) => {
                const sizeLabel = item.name.replace(new RegExp(selectedGroup.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "").trim() || item.name;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleAddToCart(item)}
                    disabled={!activeTab}
                    className="pos-tile group flex h-28 flex-col justify-between !p-3 text-left disabled:opacity-30 disabled:grayscale md:h-32 md:!p-4"
                  >
                    <div className="text-lg font-semibold uppercase tracking-[-0.01em] text-capsula-ink">{sizeLabel}</div>
                    <div className="mt-auto text-xl font-semibold tabular-nums text-capsula-navy-deep">
                      <PriceDisplay usd={item.price} rate={exchangeRate} size="sm" showBs={false} />
                    </div>
                  </button>
                );
              })}

              {/* ── Items sueltos (sin posGroup) o resultados de búsqueda ── */}
              {(productSearch || !selectedGroup) && (productSearch ? filteredMenuItems : subcatFilteredItems.filter((i) => !i.posGroup)).map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleAddToCart(item)}
                  disabled={!activeTab}
                  className="pos-tile group flex h-28 flex-col justify-between !p-3 text-left disabled:opacity-30 disabled:grayscale md:h-32 md:!p-4"
                >
                  <div className="line-clamp-2 text-sm font-semibold uppercase leading-tight tracking-[-0.01em] text-capsula-ink transition-colors group-hover:text-capsula-navy-deep">{item.name}</div>
                  <div className="mt-2 flex items-end justify-between">
                    <div className="text-xl font-semibold tabular-nums text-capsula-navy-deep">
                      <PriceDisplay usd={item.price} rate={exchangeRate} size="sm" showBs={false} />
                    </div>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-capsula-navy-deep text-capsula-ivory opacity-100 transition-all lg:opacity-0 lg:group-hover:translate-y-[-4px] lg:group-hover:opacity-100">
                      <PlusIcon className="h-4 w-4" />
                    </div>
                  </div>
                </button>
              ))}

              {/* Empty state */}
              {!productSearch && groupsInView.length === 0 && subcatFilteredItems.filter((i) => !i.posGroup).length === 0 && !selectedGroup && (
                <div className="col-span-full py-12 text-center text-sm text-capsula-ink-muted">Sin productos en esta categoría</div>
              )}
              {productSearch && filteredMenuItems.length === 0 && (
                <div className="col-span-full py-12 text-center text-sm text-capsula-ink-muted">Sin resultados para &quot;{productSearch}&quot;</div>
              )}
            </div>
          </div>
        </main>

        {/* ══ RIGHT: PEDIDO PANEL (sin cobro) ═════════════════════════════ */}
        <aside className={`w-full lg:w-80 xl:w-96 shrink-0 bg-capsula-ivory-surface flex flex-col overflow-hidden border-l border-capsula-line ${mobileTab === "account" ? "flex" : "hidden"} lg:flex absolute lg:relative inset-0 z-10 lg:z-auto`}>

          {/* Carrito pendiente */}
          {cart.length > 0 && (
            <div className="border-b border-capsula-line bg-capsula-navy-soft p-4 shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-xs text-capsula-ink uppercase tracking-[0.14em] flex items-center gap-2">
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Nuevo pedido
                  <span className="bg-capsula-navy-deep text-capsula-ivory text-[10px] font-semibold rounded-full w-5 h-5 flex items-center justify-center">
                    {cart.length}
                  </span>
                </h2>
                <button
                  onClick={() => setCart([])}
                  className="text-[10px] text-capsula-coral hover:opacity-80 font-semibold uppercase tracking-wider"
                >
                  Limpiar
                </button>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {cart.map((item, i) => (
                  <div key={i} className="flex justify-between items-center text-xs bg-capsula-ivory rounded-lg px-3 py-2 border border-capsula-line">
                    <span className="font-semibold text-capsula-ink-soft truncate flex-1">
                      <span className="text-capsula-navy-deep font-semibold">x{item.quantity}</span> {item.name}
                    </span>
                    <span className="text-capsula-ink font-semibold ml-2 tabular-nums">${item.lineTotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between items-center border-t border-capsula-line pt-2">
                <span className="text-xs font-semibold text-capsula-ink-muted uppercase tracking-wider">Subtotal</span>
                <span className="text-sm font-semibold text-capsula-ink tabular-nums">${cartTotal.toFixed(2)}</span>
              </div>
              <button
                onClick={() => { handleSendToTab(); if (window.innerWidth < 1024) setMobileTab("tables"); }}
                disabled={!activeTab || isProcessing}
                className={`w-full mt-3 py-3.5 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                  sendSuccess
                    ? "bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]"
                    : "bg-capsula-navy-deep hover:bg-capsula-navy-deep/90 text-capsula-ivory disabled:opacity-40 disabled:cursor-not-allowed"
                }`}
              >
                {sendSuccess ? (
                  <><Check className="h-4 w-4" /> ¡Enviado a cocina!</>
                ) : isProcessing ? (
                  "Enviando..."
                ) : (
                  <><ChefHat className="h-4 w-4" /> Enviar a cocina · ${cartTotal.toFixed(2)}</>
                )}
              </button>
            </div>
          )}

          {/* Cuenta activa — items enviados */}
          {subAccountMode && activeTab ? (
            <SubAccountPanel
              openTabId={activeTab.id}
              exchangeRate={exchangeRate}
              onClose={() => setSubAccountMode(false)}
              onTabUpdated={() => loadData(false)}
            />
          ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {!activeTab ? (
              <div className="h-full flex flex-col items-center justify-center text-capsula-ink-muted py-10">
                <Armchair className="h-12 w-12 mb-3 opacity-60" />
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-center">
                  Selecciona una mesa<br />para ver la cuenta
                </p>
              </div>
            ) : activeTab.orders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-capsula-ink-muted py-10">
                <ClipboardList className="h-12 w-12 mb-3 opacity-60" />
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-center">
                  Cuenta abierta<br />Agrega productos del menú
                </p>
              </div>
            ) : (
              <>
                <p className="text-[10px] font-semibold uppercase text-capsula-ink-muted tracking-[0.14em]">
                  Pedidos enviados
                </p>
                {activeTab.orders.map((order) => (
                  <div key={order.id} className="bg-capsula-ivory rounded-2xl overflow-hidden border border-capsula-line">
                    <div className="flex items-center justify-between px-3 py-2 bg-capsula-ivory-alt border-b border-capsula-line">
                      <span className="text-[10px] font-semibold text-capsula-ink uppercase tracking-wider">#{order.orderNumber}</span>
                      <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                        order.kitchenStatus === "SENT" ? "bg-[#F3EAD6] text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8]" :
                        order.kitchenStatus === "READY" ? "bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]" :
                        "bg-capsula-ivory-alt text-capsula-ink-muted"
                      }`}>
                        {order.kitchenStatus === "SENT" ? (
                          <><Flame className="h-2.5 w-2.5" /> En cocina</>
                        ) : order.kitchenStatus === "READY" ? (
                          <><Check className="h-2.5 w-2.5" /> Listo</>
                        ) : (
                          order.kitchenStatus
                        )}
                      </span>
                    </div>
                    <div className="p-3 space-y-1.5">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex justify-between items-center text-xs group">
                          <div className="flex-1 min-w-0">
                            <span className="font-semibold text-capsula-ink-soft">
                              <span className="text-capsula-navy-deep font-semibold">x{item.quantity}</span> {item.itemName}
                            </span>
                            {item.modifiers && item.modifiers.length > 0 && (
                              <div className="text-[9px] text-capsula-ink-muted truncate pl-4">
                                {item.modifiers.map((m) => m.name).join(" · ")}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-2 shrink-0">
                            <span className="text-capsula-ink-soft tabular-nums">${item.lineTotal.toFixed(2)}</span>
                            <button
                              onClick={() => openRemoveModal(order.id, item)}
                              className="h-5 w-5 rounded-md hover:bg-capsula-coral/10 text-capsula-ink-faint hover:text-capsula-coral flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                              title="Anular (requiere PIN supervisor)"
                            >
                              <XIcon className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="px-3 pb-3 flex justify-between items-center border-t border-capsula-line pt-2">
                      <span className="text-[10px] text-capsula-ink-muted font-semibold uppercase tracking-wider">Orden</span>
                      <span className="text-sm font-semibold text-capsula-ink tabular-nums">${order.total.toFixed(2)}</span>
                    </div>
                  </div>
                ))}

                {/* Total cuenta — solo informativo, sin botón de cobro */}
                <div className="rounded-2xl border border-capsula-line-strong bg-capsula-ivory p-4 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-capsula-ink-muted uppercase tracking-[0.14em]">Total cuenta</span>
                    <span className="text-xl font-semibold text-capsula-ink tabular-nums">${activeTab.balanceDue.toFixed(2)}</span>
                  </div>
                  <p className="text-[9px] text-capsula-ink-faint mt-1 font-semibold uppercase tracking-wider">
                    El cobro lo gestiona el cajero
                  </p>
                  {/* Mostrar cuenta al cliente */}
                  <button
                    onClick={() => setShowBillModal(true)}
                    className="mt-3 w-full py-2.5 rounded-xl text-xs font-semibold bg-capsula-navy-deep hover:bg-capsula-navy-deep/90 text-capsula-ivory transition inline-flex items-center justify-center gap-2"
                  >
                    <Receipt className="h-3.5 w-3.5" />
                    Mostrar cuenta al cliente
                  </button>
                  {canUseCaptainFeatures && (
                    <>
                      <button
                        onClick={() => setSubAccountMode(true)}
                        className="mt-2 w-full py-2 rounded-xl text-xs font-semibold bg-capsula-ivory-alt hover:bg-capsula-navy-soft text-capsula-ink-soft hover:text-capsula-ink border border-capsula-line transition inline-flex items-center justify-center gap-2"
                      >
                        <Divide className="h-3.5 w-3.5" />
                        Dividir cuenta (subcuentas)
                      </button>
                      <button
                        onClick={openTransferModal}
                        className="mt-2 w-full py-2 rounded-xl text-xs font-semibold bg-capsula-ivory-alt hover:bg-capsula-navy-soft text-capsula-ink-soft hover:text-capsula-ink border border-capsula-line transition inline-flex items-center justify-center gap-2"
                      >
                        <ArrowLeftRight className="h-3.5 w-3.5" />
                        Transferir mesa
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
          )}
        </aside>
      </div>

      {/* ── NAVEGACIÓN MÓVIL ─────────────────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-capsula-ivory-surface border-t border-capsula-line flex z-50 shadow-xl">
        {(["tables", "menu", "account"] as const).map((tab) => {
          const Icon = tab === "tables" ? Armchair : tab === "menu" ? UtensilsCrossed : ClipboardList;
          const labels = { tables: "Mesas", menu: "Menú", account: "Pedido" };
          const active = mobileTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              className={`flex-1 py-3 flex flex-col items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] relative transition-colors
                ${active ? "text-capsula-ink bg-capsula-navy-soft" : "text-capsula-ink-muted hover:text-capsula-ink-soft"}`}
            >
              {active && <div className="absolute top-0 left-0 right-0 h-0.5 bg-capsula-navy-deep rounded-b" />}
              <Icon className="h-5 w-5" />
              {labels[tab]}
              {tab === "account" && cartBadgeCount > 0 && (
                <span className="absolute top-1 right-6 bg-capsula-coral text-capsula-ivory text-[9px] rounded-full min-w-[16px] h-4 flex items-center justify-center font-semibold px-1">
                  {cartBadgeCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ══ MODAL: CUENTA AL CLIENTE z-[70] ══════════════════════════════ */}
      {showBillModal && activeTab && (
        <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-sm rounded-3xl shadow-2xl border border-border flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div>
                <h3 className="font-black text-base text-foreground">Cuenta</h3>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                  {selectedTable?.name} · {activeTab.customerLabel}
                </p>
              </div>
              <button
                onClick={() => setShowBillModal(false)}
                className="h-9 w-9 rounded-full hover:bg-red-500/10 hover:text-red-400 transition text-2xl flex items-center justify-center text-muted-foreground"
              >
                ×
              </button>
            </div>
            {/* Items */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1">
              {activeTab.orders.flatMap(o => o.items).map((item, i) => (
                <div key={i} className="flex justify-between items-baseline text-sm">
                  <span className="text-foreground/80 font-semibold flex-1 mr-2">
                    <span className="text-foreground/50 text-xs">×{item.quantity}</span> {item.itemName}
                  </span>
                  <span className="font-black tabular-nums">${item.lineTotal.toFixed(2)}</span>
                </div>
              ))}
            </div>
            {/* Totals */}
            {(() => {
              const subtotal = activeTab.orders.reduce((s, o) => s + o.total, 0);
              const serviceCharge = subtotal * 0.10;
              const totalUsd = subtotal + serviceCharge;
              const divisas33 = totalUsd * (1 - 0.33);
              const totalBs = exchangeRate ? totalUsd * exchangeRate : null;
              return (
                <div className="px-5 py-4 border-t border-border space-y-2 shrink-0">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="font-bold uppercase tracking-wider">Subtotal</span>
                    <span className="font-black tabular-nums">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="font-bold uppercase tracking-wider">Servicio (10%)</span>
                    <span className="font-black tabular-nums">${serviceCharge.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-baseline border-t border-border pt-2 mt-1">
                    <span className="text-sm font-black text-foreground uppercase tracking-widest">Total USD</span>
                    <span className="text-2xl font-black text-emerald-400 tabular-nums">${totalUsd.toFixed(2)}</span>
                  </div>
                  <div className="rounded-xl bg-secondary/50 border border-border p-3 space-y-1.5 mt-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground font-bold uppercase tracking-wider">Divisas (33% desc.)</span>
                      <span className="font-black tabular-nums text-amber-400">${divisas33.toFixed(2)}</span>
                    </div>
                    {totalBs !== null && (
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground font-bold uppercase tracking-wider">
                          Bs. (Tasa {exchangeRate?.toFixed(2)})
                        </span>
                        <span className="font-black tabular-nums text-sky-400">
                          Bs. {totalBs.toLocaleString("es-VE", { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ══ MODAL: ABRIR CUENTA ═══════════════════════════════════════════ */}
      {showOpenTabModal && selectedTable && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card glass-panel w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl border border-border">
            <h3 className="font-black text-lg">Abrir cuenta — {selectedTable.name}</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Nombre del cliente *"
                value={openTabName}
                onChange={(e) => setOpenTabName(e.target.value)}
                className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm font-bold focus:border-emerald-500 focus:outline-none"
              />
              <input
                type="tel"
                placeholder="Teléfono *"
                value={openTabPhone}
                onChange={(e) => setOpenTabPhone(e.target.value)}
                className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm font-bold focus:border-emerald-500 focus:outline-none"
              />
              <div className="flex items-center gap-3">
                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest w-24">Personas</label>
                <div className="flex items-center gap-3 bg-secondary rounded-xl p-1 border border-border">
                  <button onClick={() => setOpenTabGuests(Math.max(1, openTabGuests - 1))} className="h-9 w-9 rounded-lg bg-card font-black transition hover:bg-red-500/10 hover:text-red-400">-</button>
                  <span className="w-8 text-center font-black text-lg">{openTabGuests}</span>
                  <button onClick={() => setOpenTabGuests(openTabGuests + 1)} className="h-9 w-9 rounded-lg bg-primary text-primary-foreground font-black transition hover:opacity-90">+</button>
                </div>
              </div>
              {activeWaiter && (
                <div className="flex items-center gap-2 px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs">
                  <span className="h-7 w-7 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-black">
                    {activeWaiter.firstName.charAt(0)}{activeWaiter.lastName.charAt(0)}
                  </span>
                  <div>
                    <div className="font-black text-emerald-300">{activeWaiter.firstName} {activeWaiter.lastName}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Mesonero de la mesa</div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowOpenTabModal(false)} className="capsula-btn capsula-btn-secondary flex-1 py-3">
                Cancelar
              </button>
              <button
                onClick={handleOpenTab}
                disabled={isProcessing || !openTabName.trim() || !openTabPhone.trim()}
                className="capsula-btn capsula-btn-primary flex-[2] py-3 disabled:opacity-40"
              >
                {isProcessing ? "Abriendo..." : "✓ Abrir cuenta"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: MODIFICADORES ══════════════════════════════════════════ */}
      {showModifierModal && selectedItemForModifier && (
        <div className="fixed inset-0 z-50 bg-background/90 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-card glass-panel w-full max-w-lg rounded-t-3xl sm:rounded-3xl flex flex-col max-h-[92vh] sm:max-h-[90vh] shadow-2xl border border-border">
            <div className="p-5 border-b border-border flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight">{selectedItemForModifier.name}</h3>
                <p className="text-emerald-400 font-black text-lg">${selectedItemForModifier.price.toFixed(2)}</p>
              </div>
              <button onClick={() => setShowModifierModal(false)} className="h-10 w-10 rounded-full hover:bg-red-500/10 hover:text-red-400 transition text-2xl flex items-center justify-center">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {selectedItemForModifier.modifierGroups?.map((groupRel) => {
                const group = groupRel.modifierGroup;
                const totalSelected = currentModifiers.filter((m) => m.groupId === group.id).reduce((s, m) => s + m.quantity, 0);
                const isValid = !group.isRequired || totalSelected >= group.minSelections;
                return (
                  <div key={group.id} className={`p-4 rounded-2xl border-2 transition-colors ${isValid ? "border-border bg-secondary/20" : "border-red-500 bg-red-500/5"}`}>
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-black text-sm uppercase tracking-widest text-foreground/70">{group.name}</h4>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${isValid ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500 text-white animate-bounce"}`}>
                        {totalSelected}/{group.maxSelections}{group.isRequired ? " · Req." : ""}
                      </span>
                    </div>
                    <div className="grid gap-2">
                      {group.modifiers.map((mod) => {
                        const existing = currentModifiers.find((m) => m.id === mod.id && m.groupId === group.id);
                        const qty = existing?.quantity || 0;
                        const isMax = group.maxSelections > 1 && totalSelected >= group.maxSelections;
                        const isRadio = group.maxSelections === 1;
                        return (
                          <div key={mod.id} className={`flex justify-between items-center p-3 rounded-xl border-2 transition-all ${qty > 0 ? "bg-emerald-500/10 border-emerald-500" : "bg-background border-border hover:border-emerald-500/30"}`}>
                            <span className="font-bold text-sm">{mod.name}</span>
                            {isRadio ? (
                              <button
                                onClick={() => updateModifierQuantity(group, mod, 1)}
                                className={`h-8 w-8 rounded-full border-2 flex justify-center items-center transition-all ${qty > 0 ? "bg-emerald-500 border-emerald-500 text-white scale-110" : "border-border hover:border-emerald-500"}`}
                              >
                                {qty > 0 && "✓"}
                              </button>
                            ) : (
                              <div className="flex items-center gap-2 bg-card p-1 rounded-xl border border-border">
                                <button onClick={() => updateModifierQuantity(group, mod, -1)} disabled={qty === 0} className={`h-7 w-7 rounded-lg font-black transition ${qty === 0 ? "text-muted-foreground opacity-20" : "bg-secondary hover:bg-red-500/20 hover:text-red-400"}`}>-</button>
                                <span className="font-black text-base w-5 text-center text-emerald-400">{qty}</span>
                                <button onClick={() => updateModifierQuantity(group, mod, 1)} disabled={isMax} className={`h-7 w-7 rounded-lg font-black transition ${isMax ? "text-muted-foreground opacity-20" : "bg-emerald-600 text-white hover:bg-emerald-500"}`}>+</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <div className="bg-secondary/20 p-4 rounded-2xl border border-border">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 block">Instrucciones especiales</label>
                <textarea
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  className="w-full bg-background rounded-xl p-3 h-20 text-sm font-bold border border-border focus:border-emerald-500 focus:outline-none resize-none"
                  placeholder="Petición del cliente..."
                />
              </div>
              <div className="flex items-center justify-between glass-panel p-4 rounded-2xl border-emerald-900/20">
                <span className="font-black uppercase tracking-tighter text-base">Cantidad</span>
                <div className="flex items-center gap-2 bg-background p-1 rounded-xl border border-border">
                  <button onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))} className="h-12 w-12 rounded-lg font-black text-xl hover:bg-secondary transition active:scale-90">-</button>
                  <span className="w-12 text-center font-black text-2xl text-emerald-400">{itemQuantity}</span>
                  <button onClick={() => setItemQuantity(itemQuantity + 1)} className="h-12 w-12 rounded-lg bg-emerald-600 text-white font-black text-xl hover:bg-emerald-500 active:scale-95">+</button>
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-border flex gap-3">
              <button onClick={() => setShowModifierModal(false)} className="capsula-btn capsula-btn-secondary flex-1 py-4 text-sm">Cancelar</button>
              <button
                onClick={confirmAddToCart}
                disabled={selectedItemForModifier.modifierGroups.some((g) => !isGroupValid(g.modifierGroup))}
                className="capsula-btn capsula-btn-primary flex-[2] py-4 text-sm bg-emerald-600 border-emerald-700 disabled:opacity-40"
              >
                Agregar al pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: MOVER TAB A OTRA MESA (solo capitanes) ═══════════════════ */}
      {showTransferModal && activeTab && canUseCaptainFeatures && (() => {
        const availableTables = layout?.serviceZones.flatMap((z) =>
          z.tablesOrStations.filter(
            (t) => t.currentStatus === "AVAILABLE" && t.id !== selectedTableId,
          ).map((t) => ({ ...t, zoneName: z.name }))
        ) ?? [];
        return (
          <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card glass-panel w-full max-w-lg rounded-3xl p-6 space-y-4 shadow-2xl border border-sky-900/30 max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-sky-500/10 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">↔</div>
                <div>
                  <h3 className="font-black text-base text-sky-400">Mover mesa</h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedTable?.name}
                    {activeTab.customerLabel ? ` · ${activeTab.customerLabel}` : ""}
                    {" → "}
                    <span className={transferToTableId ? "text-sky-400 font-bold" : "text-muted-foreground"}>
                      {transferToTableId
                        ? (availableTables.find((t) => t.id === transferToTableId)?.name ?? "...")
                        : "selecciona destino"}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => setShowTransferModal(false)}
                  className="ml-auto h-9 w-9 rounded-full hover:bg-red-500/10 hover:text-red-400 transition text-2xl flex items-center justify-center text-muted-foreground flex-shrink-0"
                >
                  ×
                </button>
              </div>

              {/* Grid de mesas disponibles */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 block">
                  Mesa destino (disponibles)
                </label>
                {availableTables.length === 0 ? (
                  <p className="text-xs text-muted-foreground bg-secondary rounded-xl px-4 py-3">
                    No hay mesas disponibles en este momento.
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-2 max-h-52 overflow-y-auto pr-1">
                    {availableTables.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTransferToTableId(t.id)}
                        className={`rounded-xl py-3 px-2 text-xs font-black transition border flex flex-col items-center gap-0.5 ${
                          transferToTableId === t.id
                            ? "bg-sky-600 border-sky-500 text-white"
                            : "bg-secondary border-border hover:border-sky-500/50 hover:text-sky-400"
                        }`}
                      >
                        <span className="text-sm">{t.name}</span>
                        <span className={`text-[9px] font-normal ${transferToTableId === t.id ? "text-sky-200" : "text-muted-foreground"}`}>
                          {t.zoneName}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Motivo */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">
                  Motivo (opcional)
                </label>
                <textarea
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="Ej: Petición del cliente, cambio de zona..."
                  className="w-full bg-secondary border border-border rounded-xl p-3 text-sm font-bold focus:border-sky-500 focus:outline-none resize-none h-14"
                />
              </div>

              {/* PIN */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">
                  PIN de capitán o gerente
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  placeholder="••••"
                  value={transferCaptainPin}
                  onChange={(e) => setTransferCaptainPin(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm font-bold focus:border-sky-500 focus:outline-none"
                />
              </div>

              {transferError && (
                <p className="text-red-400 text-xs font-bold bg-red-950/30 border border-red-900/30 rounded-xl px-3 py-2">
                  {transferError}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowTransferModal(false)}
                  className="capsula-btn capsula-btn-secondary flex-1 py-3"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleTableTransfer}
                  disabled={isProcessing || !transferToTableId || !transferCaptainPin.trim()}
                  className="flex-[2] py-3 bg-sky-600 hover:bg-sky-500 rounded-xl font-black text-sm transition disabled:opacity-40"
                >
                  {isProcessing ? "Moviendo..." : "↔ Confirmar movimiento"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══ MODAL: ANULAR ÍTEM (requiere PIN supervisor) ══════════════════ */}
      {showRemoveModal && removeTarget && (() => {
        const replaceItems = allMenuItems.filter((m) =>
          m.id !== removeTarget.itemId &&
          (!removeReplaceSearch.trim() || m.name.toLowerCase().includes(removeReplaceSearch.toLowerCase()))
        ).slice(0, 30);
        return (
          <div className="fixed inset-0 z-50 bg-background/90 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-card glass-panel w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl border border-red-900/30 max-h-[92vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 bg-red-500/10 rounded-2xl flex items-center justify-center text-xl flex-shrink-0">✏️</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-sm text-red-400">Modificar ítem enviado</h3>
                  <p className="text-xs text-muted-foreground truncate">
                    <span className="font-bold text-foreground">{removeTarget.quantity}×</span> {removeTarget.itemName}
                    <span className="ml-2 text-muted-foreground">${removeTarget.lineTotal.toFixed(2)}</span>
                  </p>
                </div>
                <button onClick={() => setShowRemoveModal(false)} className="h-8 w-8 rounded-full hover:bg-red-500/10 text-muted-foreground hover:text-red-400 text-xl flex items-center justify-center flex-shrink-0">×</button>
              </div>

              {/* Opciones de modificación */}
              <div className="grid grid-cols-3 gap-2">
                {(["VOID", "ADJUST_QTY", "REPLACE"] as const).map((t) => {
                  const labels = { VOID: "❌ Cancelar", ADJUST_QTY: "✏️ Ajustar", REPLACE: "🔄 Cambiar" };
                  return (
                    <button
                      key={t}
                      onClick={() => setRemoveModType(t)}
                      className={`py-2.5 rounded-xl text-xs font-black border transition ${
                        removeModType === t
                          ? "bg-red-600 border-red-500 text-white"
                          : "bg-secondary border-border hover:border-red-500/40 hover:text-red-400"
                      }`}
                    >
                      {labels[t]}
                    </button>
                  );
                })}
              </div>

              {/* Ajustar cantidad */}
              {removeModType === "ADJUST_QTY" && (
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">
                    Nueva cantidad (actual: {removeTarget.quantity})
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setRemoveNewQty((q) => Math.max(1, q - 1))}
                      className="h-10 w-10 rounded-xl bg-secondary border border-border text-lg font-black hover:border-red-500/40"
                    >−</button>
                    <span className="flex-1 text-center text-2xl font-black">{removeNewQty}</span>
                    <button
                      onClick={() => setRemoveNewQty((q) => Math.min(removeTarget.quantity - 1, q + 1))}
                      className="h-10 w-10 rounded-xl bg-secondary border border-border text-lg font-black hover:border-sky-500/40"
                    >+</button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 text-center">
                    Se anularán {removeTarget.quantity - removeNewQty} unidad(es) y se reimprimirá la comanda
                  </p>
                </div>
              )}

              {/* Cambiar por otro ítem */}
              {removeModType === "REPLACE" && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                    Producto de reemplazo
                  </label>
                  <input
                    value={removeReplaceSearch}
                    onChange={(e) => setRemoveReplaceSearch(e.target.value)}
                    placeholder="Buscar producto..."
                    className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm font-bold focus:border-sky-500 focus:outline-none"
                  />
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                    {replaceItems.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setRemoveReplaceItemId(m.id)}
                        className={`w-full flex justify-between items-center px-3 py-2 rounded-lg text-xs font-bold transition border ${
                          removeReplaceItemId === m.id
                            ? "bg-sky-600 border-sky-500 text-white"
                            : "bg-secondary border-border hover:border-sky-500/40"
                        }`}
                      >
                        <span className="truncate">{m.name}</span>
                        <span className="ml-2 shrink-0 opacity-70">${m.price?.toFixed(2)}</span>
                      </button>
                    ))}
                    {replaceItems.length === 0 && (
                      <p className="text-xs text-muted-foreground px-2 py-1">Sin resultados</p>
                    )}
                  </div>
                </div>
              )}

              {/* Motivo */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">
                  Motivo (obligatorio)
                </label>
                <textarea
                  value={removeJustification}
                  onChange={(e) => setRemoveJustification(e.target.value)}
                  placeholder="Ej: error del cliente, cambio de pedido..."
                  className="w-full bg-secondary border border-border rounded-xl p-3 text-sm font-bold focus:border-red-500 focus:outline-none resize-none h-14"
                />
              </div>

              {/* PIN */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">
                  PIN de capitán o gerente
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  placeholder="••••"
                  value={removePin}
                  onChange={(e) => setRemovePin(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm font-bold focus:border-red-500 focus:outline-none"
                />
              </div>

              {removeError && (
                <p className="text-red-400 text-xs font-bold bg-red-950/30 border border-red-900/30 rounded-xl px-3 py-2">
                  {removeError}
                </p>
              )}

              <div className="flex gap-3">
                <button onClick={() => setShowRemoveModal(false)} className="capsula-btn capsula-btn-secondary flex-1 py-3">
                  Cancelar
                </button>
                <button
                  onClick={handleRemoveItem}
                  disabled={isProcessing || !removeJustification.trim() || !removePin.trim()}
                  className="flex-[2] py-3 bg-red-600 hover:bg-red-500 rounded-xl font-black text-sm transition disabled:opacity-40"
                >
                  {isProcessing ? "Procesando..." : (
                    removeModType === "VOID"       ? "❌ Confirmar anulación" :
                    removeModType === "ADJUST_QTY" ? "✏️ Ajustar cantidad" :
                                                     "🔄 Confirmar cambio"
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
