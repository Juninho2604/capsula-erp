"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChefHat, Lock, LogOut, RefreshCw, Phone, AlertTriangle, Search, X as XIcon, ArrowLeft, Plus as PlusIcon, ShoppingCart, Flame, Check, Armchair, ClipboardList, UtensilsCrossed, Receipt, Divide, ArrowLeftRight, Pencil, Ban, DollarSign, Zap, CreditCard, Smartphone, Banknote, Euro, Printer } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import {
  addItemsToOpenTabAction,
  getMenuForPOSAction,
  getOpenTabWithSubAccountsAction,
  getRestaurantLayoutAction,
  openTabAction,
  modifyTabItemAction,
  setOpenTabTipAction,
  type CartItem,
  type ModifyTabItemModification,
} from "@/app/actions/pos.actions";
import { getExchangeRateValue } from "@/app/actions/exchange.actions";
import { moveTabBetweenTablesAction } from "@/app/actions/waiter.actions";
import { printReceipt, type VoidKitchenCommandData } from "@/lib/print-command";
import { enqueueKitchenCommand, enqueueVoidKitchenCommand, buildMenuItemCategoryMap, buildKitchenItems } from "@/lib/print-via-agent";
import { getPOSConfig } from "@/lib/pos-settings";
import { SinConToggle } from "@/components/pos/SinConToggle";
import { groupModifiersForSinCon, toggleStateFor, type IngredientToggle } from "@/lib/pos-modifier-grouping";
import toast from "react-hot-toast";
import { PriceDisplay } from "@/components/pos/PriceDisplay";
import { SubAccountPanel } from "@/components/pos/SubAccountPanel";
import {
  WaiterIdentification,
  type ActiveWaiter,
} from "@/components/pos/WaiterIdentification";
import {
  saveMenuCache,
  loadMenuCache,
  saveLayoutCache,
  loadLayoutCache,
  saveCart,
  loadCart,
  deleteCart,
} from "@/lib/offline-cache";
import { useOfflineGuard } from "@/hooks/use-offline-guard";

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
interface PaymentSplitSummary {
  id: string;
  splitLabel: string | null;
  paymentMethod: string | null;
  status: string;
  paidAmount: number;
}
interface OpenTabSummary {
  id: string;
  tabCode: string;
  customerLabel?: string;
  customerPhone?: string;
  guestCount: number;
  status: string;
  runningSubtotal: number;
  runningDiscount: number;
  runningTotal: number;
  totalServiceCharge: number;
  balanceDue: number;
  tipPercent: number | null;
  tipAmount: number | null;
  openedAt: string;
  openedBy: UserSummary;
  assignedWaiter?: UserSummary | null;
  orders: SalesOrderSummary[];
  paymentSplits: PaymentSplitSummary[];
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

/**
 * "hace X min" desde un timestamp ISO. Se usa en cada pedido cargado del
 * POS Mesero para que el mesonero sepa cuánto lleva en cocina y pueda
 * presionar el ritmo. Se recalcula en cada render; el auto-polling cada
 * 15 s mantiene el valor fresco sin necesidad de un ticker dedicado.
 */
function formatElapsed(iso: string | Date): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "recién";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  return `hace ${hrs} h ${mins % 60} min`;
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
  // Si la cuenta tiene subcuentas abiertas, el mesero puede dirigir el pedido
  // a una subcuenta concreta. null = "Cuenta general" (sin asignar).
  const [cartTargetSubAccountId, setCartTargetSubAccountId] = useState<string | null>(null);

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
  type SubAccountSummary = { id: string; label: string; sortOrder: number; status: string };
  const [openSubAccounts, setOpenSubAccounts] = useState<SubAccountSummary[]>([]);
  const subAccountsCount = openSubAccounts.length;

  // ── Mostrar cuenta al cliente ─────────────────────────────────────────────
  const [showBillModal, setShowBillModal] = useState(false);
  const [isTipSetting, setIsTipSetting] = useState(false);
  // Preview "Divisas -33,33%": muestra al cliente cuánto pagaría si pagara
  // en efectivo USD/EUR (descuento de 1/3 por divisa). Solo afecta la
  // visualización del modal, no se persiste; el cobro real se hace en la
  // pantalla de pago donde la cajera selecciona método.
  const [divisasPreview, setDivisasPreview] = useState(false);
  // Sub-cuenta seleccionada en el modal. 'general' = vista total de la
  // mesa; un id de sub-cuenta = solo items asignados a esa sub. Permite
  // al mesero mostrar al cliente UNA sub-cuenta a la vez cuando dividen.
  const [billSubAccountView, setBillSubAccountView] = useState<string>('general');
  // Detalle completo del tab incluyendo items por sub-cuenta. Se carga
  // fresh al abrir el modal para no depender de un estado obsoleto.
  type SubAccountDetail = {
      id: string;
      label: string;
      status: string;
      subtotal: number;
      serviceCharge: number;
      total: number;
      paidAmount: number;
      items: Array<{
          id: string;
          quantity: number;
          lineTotal: number;
          salesOrderItem: {
              itemName: string;
              modifiers: Array<{ name: string }>;
          };
      }>;
  };
  const [tabSubAccountsDetail, setTabSubAccountsDetail] = useState<SubAccountDetail[]>([]);

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

  // `cacheStaleAt` es el timestamp del cache cuando se cargó desde IndexedDB.
  // Si está set y > 0 → estamos viendo datos cacheados (offline o slow network).
  // Cuando hay refetch online exitoso lo limpiamos a null para ocultar el banner.
  const [cacheStaleAt, setCacheStaleAt] = useState<number | null>(null);

  /**
   * Carga el menú + layout. Estrategia offline-first:
   *   1. Hidrata desde IndexedDB inmediatamente (UI usable en <100ms).
   *   2. Dispara fetch al server en paralelo.
   *   3. Si el fetch llega ok → reemplaza el estado y persiste el nuevo cache.
   *   4. Si el fetch falla (sin red) → silencioso, el cache sigue mostrándose
   *      con su timestamp. El banner global ya señala "sin conexión".
   */
  const loadData = async (showSpinner = true) => {
    if (showSpinner) setIsLoading(true);
    setLayoutError("");

    // 1. Pintar desde cache primero (no espera al server)
    let cachedMenuApplied = false;
    let cachedLayoutApplied = false;
    let oldestCacheAt: number | null = null;
    try {
      const [cachedMenu, cachedLayout] = await Promise.all([
        loadMenuCache<any[]>(),
        loadLayoutCache<SportBarLayout>(),
      ]);
      if (cachedMenu?.data?.length) {
        setCategories(cachedMenu.data);
        setSelectedCategory((prev) => prev || cachedMenu.data[0]?.id || "");
        cachedMenuApplied = true;
        oldestCacheAt = cachedMenu.cachedAt;
      }
      if (cachedLayout?.data) {
        setLayout(cachedLayout.data);
        setSelectedZoneId((prev) => prev || cachedLayout.data.serviceZones[0]?.id || "");
        cachedLayoutApplied = true;
        oldestCacheAt = oldestCacheAt
          ? Math.min(oldestCacheAt, cachedLayout.cachedAt)
          : cachedLayout.cachedAt;
      }
      if (cachedMenuApplied && cachedLayoutApplied) {
        setIsLoading(false); // ya hay UI usable
        setCacheStaleAt(oldestCacheAt);
      }
    } catch {
      // IndexedDB no disponible (private mode, etc.) — caemos al fetch directo.
    }

    // 2. Refetch fresh — si llega lo reemplaza
    try {
      const [menuResult, layoutResult, rate] = await Promise.all([
        getMenuForPOSAction(),
        getRestaurantLayoutAction(),
        getExchangeRateValue(),
      ]);
      if (menuResult.success && menuResult.data) {
        setCategories(menuResult.data);
        setSelectedCategory((prev) => prev || menuResult.data[0]?.id || "");
        await saveMenuCache(menuResult.data);
      }
      if (layoutResult.success && layoutResult.data) {
        const nextLayout = layoutResult.data as SportBarLayout;
        setLayout(nextLayout);
        setSelectedZoneId((prev) => prev || nextLayout.serviceZones[0]?.id || "");
        await saveLayoutCache(nextLayout);
      } else if (!layoutResult.success && !cachedLayoutApplied) {
        // Solo mostramos el error si NO había nada cacheado (UI sin datos).
        setLayoutError(layoutResult.message || "Error cargando mesas");
      }
      setExchangeRate(rate);
      setCacheStaleAt(null); // ya estamos viendo datos frescos
    } catch (err) {
      // Sin red y sin cache → mostramos el error de layout para que el usuario
      // sepa por qué no hay mesas. Si había cache → silencioso.
      if (!cachedLayoutApplied && !cachedMenuApplied) {
        setLayoutError("Sin conexión y sin datos en caché");
      }
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // ── Auto-polling: sincronización silenciosa del layout cada 15 s ─────────────
  const isProcessingRef = useRef(isProcessing);
  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);

  const pollLayout = useCallback(async () => {
    try {
      const [layoutResult, rate] = await Promise.all([
        getRestaurantLayoutAction(),
        getExchangeRateValue(),
      ]);
      if (layoutResult.success && layoutResult.data) {
        const nextLayout = layoutResult.data as SportBarLayout;
        setLayout(nextLayout);
        // El poll exitoso refresca el cache offline — así el snapshot
        // local siempre tiene los datos más recientes sin reload manual.
        await saveLayoutCache(nextLayout);
        setCacheStaleAt(null);
      }
      if (rate) setExchangeRate(rate);
    } catch {
      // Sin red durante poll: silencioso. El banner global ya señala
      // "sin conexión". NUNCA propagar — rompe la pantalla con
      // "Application error: client-side exception".
    }
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

  // Auto-detección de subcuentas existentes — si el cajero ya creó subcuentas
  // (o el mesero las creó en una sesión previa), entramos automáticamente al
  // modo subcuentas para que el mesonero las vea sin clicks extra.
  // También cacheamos la lista para alimentar el selector de destino del carrito.
  const refreshSubAccounts = useCallback(async (tabId: string): Promise<SubAccountSummary[]> => {
    try {
      const res = await getOpenTabWithSubAccountsAction(tabId);
      const subs = ((res.data as any)?.subAccounts ?? []) as SubAccountSummary[];
      const open = subs
        .filter((s) => s.status === 'OPEN')
        .sort((a, b) => a.sortOrder - b.sortOrder);
      setOpenSubAccounts(open);
      return open;
    } catch {
      // Sin red: no propagar (rompe la pantalla). Devolver lista vacía.
      return [];
    }
  }, []);

  useEffect(() => {
    if (!activeTab?.id) {
      setOpenSubAccounts([]);
      setCartTargetSubAccountId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const open = await refreshSubAccounts(activeTab.id);
      if (cancelled) return;
      if (open.length > 0) setSubAccountMode(true);
    })();
    return () => { cancelled = true; };
  }, [activeTab?.id, refreshSubAccounts]);

  // Si la subcuenta destino seleccionada deja de existir o se cierra, limpiar.
  useEffect(() => {
    if (!cartTargetSubAccountId) return;
    const stillOpen = openSubAccounts.some((s) => s.id === cartTargetSubAccountId);
    if (!stillOpen) setCartTargetSubAccountId(null);
  }, [openSubAccounts, cartTargetSubAccountId]);

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

  // Elimina UN solo item del carrito por índice (antes de enviar a cocina).
  // El cliente puede cambiar de opinión a última hora o el mesero puede
  // haber tocado un producto por error — borrar solo ese ítem evita tener
  // que limpiar todo el carrito y re-tomar la orden completa.
  const removeCartItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Persistencia offline del carrito por mesa ────────────────────────────────
  // Cada `activeTab.id` tiene su propio carrito persistido en IndexedDB. Caso
  // crítico: mesero en mesa 25 sin WiFi anota 5 ítems → si la app se recarga
  // o cierra (batería se va, tablet hiberna), al volver y entrar a la mesa
  // el carrito sigue ahí. Cuando "Enviar a cocina" se complete con éxito,
  // borramos el carrito persistido (lo limpia ya `setCart([])` + delete).
  const lastLoadedCartTabIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeTab?.id) {
      lastLoadedCartTabIdRef.current = null;
      return;
    }
    // Solo rehidratar cuando cambia la mesa, no en cada render.
    if (lastLoadedCartTabIdRef.current === activeTab.id) return;
    lastLoadedCartTabIdRef.current = activeTab.id;
    let cancelled = false;
    loadCart(activeTab.id).then((record) => {
      if (cancelled || !record) return;
      // Solo rehidratamos si el carrito local está vacío. Si el mesero ya
      // empezó a agregar ítems en esta sesión, NO machacar lo que tiene en
      // pantalla con lo cacheado (sería peor UX que perderlo).
      setCart((current) => (current.length > 0 ? current : (record.items as CartItem[])));
    });
    return () => { cancelled = true; };
  }, [activeTab?.id]);

  // Al abrir "Mostrar cuenta al cliente": setear propina 10% por defecto
  // si la tab aún no tiene propina configurada O está en 0. La opción
  // "Sin propina" fue removida del modal a pedido del operador, así que
  // al mostrarle la cuenta al cliente siempre hay una propina sugerida
  // (10% por default; el mesero puede subir a 15% o 20%). Incluimos el
  // caso `=== 0` para cubrir tabs viejas creadas antes de este cambio.
  // También resetear el preview Divisas y la vista de sub-cuenta al
  // cerrar para no llevar el flag a otra mesa.
  useEffect(() => {
    if (!showBillModal) {
      setDivisasPreview(false);
      setBillSubAccountView('general');
      setTabSubAccountsDetail([]);
      return;
    }
    if (activeTab && (activeTab.tipPercent == null || activeTab.tipPercent === 0) && !isTipSetting) {
      void handleSetTip(10);
    }
    // Cargar detalle fresco de sub-cuentas (con items por sub) al abrir
    // el modal — solo si hay sub-cuentas abiertas en la tab.
    if (activeTab && subAccountsCount > 0) {
      void getOpenTabWithSubAccountsAction(activeTab.id).then((res) => {
        const subs = ((res.data as { subAccounts?: SubAccountDetail[] } | null)?.subAccounts ?? []) as SubAccountDetail[];
        setTabSubAccountsDetail(subs);
      });
    }
    // handleSetTip y subAccountsCount cambian con re-renders pero su
    // lógica interna no depende de nada que necesitemos sincronizar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showBillModal, activeTab?.id, activeTab?.tipPercent]);

  // Guardar el carrito en cada cambio. Debounce no es necesario: IndexedDB
  // es asíncrono y rápido, y los cambios al carrito ocurren por acción del
  // usuario (no en cadenas de render rápidas).
  useEffect(() => {
    if (!activeTab?.id) return;
    if (cart.length === 0) {
      // Carrito vacío → borrar registro para no acumular basura.
      deleteCart(activeTab.id);
      return;
    }
    saveCart(activeTab.id, cart);
  }, [cart, activeTab?.id]);

  // Guard global para mutaciones (Enviar a cocina, modificar, etc.).
  const { guardMutation, isOffline } = useOfflineGuard();

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

  // Toggle SIN/CON/NEUTRAL por ingrediente — agrupa modifiers con convención
  // "Sin X" / "Con X" / "+ X" en un solo control con mutua exclusión.
  const setIngredientToggleState = (
    group: ModifierGroup,
    toggle: IngredientToggle,
    target: 'SIN' | 'CON' | 'NEUTRAL',
  ) => {
    const sinId = toggle.sin?.id;
    const conId = toggle.con?.id;
    let mods = currentModifiers.filter((m) => {
      const isThisIngredient =
        m.groupId === group.id && ((sinId && m.id === sinId) || (conId && m.id === conId));
      return !isThisIngredient;
    });
    if (target === 'SIN' && toggle.sin) {
      mods.push({ groupId: group.id, groupName: group.name, id: toggle.sin.id, name: toggle.sin.name, priceAdjustment: toggle.sin.priceAdjustment, quantity: 1 });
    } else if (target === 'CON' && toggle.con) {
      mods.push({ groupId: group.id, groupName: group.name, id: toggle.con.id, name: toggle.con.name, priceAdjustment: toggle.con.priceAdjustment, quantity: 1 });
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

  /**
   * Categorías del menú que se consideran ENTRADAS (cocina las prepara
   * primero, el mesero las marcha al principio). Las demás categorías
   * caen automáticamente en "principales". Mantener alineado con
   * seed-menu-real.ts. Las bebidas van a barra y conceptualmente
   * acompañan la entrada, así que las incluimos aquí.
   */
  const COURSE_ENTRADAS = useMemo(
    () => new Set(['Quesos Shanklish', 'Cremas', 'Ensaladas', 'Bebidas']),
    []
  );

  // Mapa menuItemId → 'entrada' | 'principal' para clasificar items
  // del cart sin requerir lookup por nombre cada vez.
  const itemCourseMap = useMemo(() => {
    const map = new Map<string, 'entrada' | 'principal'>();
    for (const cat of categories as Array<{ name?: string; items?: Array<{ id: string }> }>) {
      const course: 'entrada' | 'principal' = COURSE_ENTRADAS.has(cat.name ?? '')
        ? 'entrada' : 'principal';
      for (const it of cat.items ?? []) {
        map.set(it.id, course);
      }
    }
    return map;
  }, [categories, COURSE_ENTRADAS]);

  // Conteos por curso para decidir qué botones mostrar.
  const cartCourseCounts = useMemo(() => {
    let entradas = 0;
    let principales = 0;
    for (const c of cart) {
      if (itemCourseMap.get(c.menuItemId) === 'entrada') entradas++;
      else principales++;
    }
    return { entradas, principales };
  }, [cart, itemCourseMap]);

  /**
   * Envía a cocina. Si `courseFilter` es 'entradas' o 'principales',
   * envía solo esos items y deja los demás en el cart local. Si es
   * 'all' (default), envía todo y limpia el cart.
   */
  const handleSendToTab = async (courseFilter: 'entradas' | 'principales' | 'all' = 'all') => {
    if (!activeTab || cart.length === 0) return;
    if (!activeWaiter) { toast.error("Identifícate con tu PIN antes de enviar a cocina"); return; }

    // Filtrar el cart según el curso elegido. Los items que quedan
    // afuera del filtro permanecen en el cart para marcharse después.
    const itemsToSend = courseFilter === 'all'
      ? cart
      : cart.filter((c) => itemCourseMap.get(c.menuItemId) === (
          courseFilter === 'entradas' ? 'entrada' : 'principal'
        ));
    const itemsToKeep = courseFilter === 'all'
      ? []
      : cart.filter((c) => !itemsToSend.includes(c));

    if (itemsToSend.length === 0) {
      toast.error(`No hay items de ${courseFilter} en el carrito`);
      return;
    }

    const guarded = await guardMutation(async () => {
      setIsProcessing(true);
      try {
        const result = await addItemsToOpenTabAction({
          openTabId: activeTab.id,
          items: itemsToSend,
          waiterProfileId: activeWaiter.id,
          targetSubAccountId: cartTargetSubAccountId ?? undefined,
        });
        if (!result.success) { toast.error(result.message); return null; }
        if (result.data?.kitchenStatus === "SENT") {
          // Encolar comanda en el Print Agent → split automático por
          // categoría (Bebidas → barra, resto → cocina). Las impresoras
          // térmicas de cocina/barra están en la LAN del local, el agent
          // las maneja por IP. Reemplaza al antiguo printKitchenCommand
          // (window.print) que dependía de la USB local de la caja.
          const menuItemCategoryMap = buildMenuItemCategoryMap(categories);
          void enqueueKitchenCommand({
            type: "KITCHEN",
            orderNumber: result.data.orderNumber,
            orderType: "RESTAURANT",
            orderTypeLabel: "MESA",
            tabCode: activeTab.tabCode,
            tableName: selectedTable?.name ?? null,
            customerName: activeTab.customerLabel || null,
            items: buildKitchenItems(itemsToSend, menuItemCategoryMap),
            createdAt: new Date().toISOString(),
          });
        }
        // Si fue parcial, dejar en el cart los items pendientes.
        setCart(itemsToKeep);
        if (itemsToKeep.length === 0 && activeTab?.id) {
          // Cocina aceptó todo el cart → borrar el cache offline.
          await deleteCart(activeTab.id);
        }
        setSendSuccess(true);
        setTimeout(() => setSendSuccess(false), 2500);
        await loadData();
        if (activeTab?.id) await refreshSubAccounts(activeTab.id);
        return true;
      } finally {
        setIsProcessing(false);
      }
    }, {
      blockedMessage: "Sin conexión. La orden quedó en el carrito local; se enviará cuando vuelva la señal.",
    });
    // guardMutation devuelve undefined si estaba offline; el carrito ya está
    // persistido por el useEffect de auto-guardado, así que nada que hacer aquí.
    void guarded;
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
        const k = result.data.kitchenPrintData as VoidKitchenCommandData;
        void enqueueVoidKitchenCommand({
          orderNumber: k.orderNumber,
          tableName: k.tableName,
          waiterLabel: k.waiterLabel,
          authorizerName: k.authorizerName ?? activeWaiter?.firstName ?? 'Supervisor',
          modificationType: k.modificationType,
          categoryName: k.categoryName,
          voidedItem: k.voidedItem,
          newItem: k.newItem,
        });
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
  const handleSetTip = async (tipPercent: number) => {
    if (!activeTab || isTipSetting) return;
    setIsTipSetting(true);
    try {
      const result = await setOpenTabTipAction({ openTabId: activeTab.id, tipPercent });
      if (!result.success) { toast.error(result.message); return; }
      await loadData();
    } finally {
      setIsTipSetting(false);
    }
  };

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

  // ── Helper: formatea "hace X min" para el banner de cache stale ──────────
  const formatStaleAge = (ts: number): string => {
    const diffMs = Date.now() - ts;
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 1) return 'hace menos de 1 min';
    if (mins < 60) return `hace ${mins} min`;
    const hrs = Math.floor(mins / 60);
    return `hace ${hrs} h ${mins % 60} min`;
  };

  return (
    <div className="flex min-h-screen flex-col bg-capsula-ivory pb-16 text-capsula-ink lg:pb-0">

      {/* ── Banner inline: datos cacheados (no es el banner global de red) ──
          Se muestra solo cuando estamos viendo menú/layout desde IndexedDB
          porque el server no respondió. Diferente del banner global amarillo
          (red caída) — este informa la antigüedad del dato concreto. */}
      {cacheStaleAt && (
        <div className="shrink-0 bg-[#E6ECF4] dark:bg-[#1A2636] text-[#2A4060] dark:text-[#D1DCE9] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-center">
          Mostrando datos en caché · actualizados {formatStaleAge(cacheStaleAt)}
        </div>
      )}

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
                      ? "border-capsula-navy-deep bg-capsula-navy-deep text-capsula-cream"
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
              <button
                onClick={() => setShowBillModal(true)}
                className="flex w-full items-center justify-between rounded-xl border border-[#D3E2D8] bg-[#E5EDE7]/60 px-3 py-2 text-xs hover:bg-[#D3E2D8]/60 transition active:scale-[0.98]"
              >
                <span className="text-[#2F6B4E] truncate">
                  <b>{selectedTable?.name}</b> · {activeTab.customerLabel}
                </span>
                <span className="flex items-center gap-1 font-semibold tabular-nums text-[#2F6B4E] shrink-0 ml-2">
                  ${activeTab.balanceDue.toFixed(2)}
                  <Receipt className="h-3 w-3 opacity-60" />
                </span>
              </button>
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
                      ? "border-capsula-navy-deep bg-capsula-navy-deep text-capsula-cream"
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
                className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-capsula-ink transition-colors hover:text-capsula-ink active:scale-95"
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
                    <div className="line-clamp-2 text-sm font-semibold uppercase leading-tight tracking-[-0.01em] text-capsula-ink transition-colors group-hover:text-capsula-ink">{group}</div>
                    <div className="mt-2 flex items-end justify-between">
                      <div className="text-base font-semibold tabular-nums text-capsula-ink">
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
                    <div className="mt-auto text-xl font-semibold tabular-nums text-capsula-ink">
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
                  <div className="line-clamp-2 text-sm font-semibold uppercase leading-tight tracking-[-0.01em] text-capsula-ink transition-colors group-hover:text-capsula-ink">{item.name}</div>
                  <div className="mt-2 flex items-end justify-between">
                    <div className="text-xl font-semibold tabular-nums text-capsula-ink">
                      <PriceDisplay usd={item.price} rate={exchangeRate} size="sm" showBs={false} />
                    </div>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-capsula-navy-deep text-capsula-cream opacity-100 transition-all lg:opacity-0 lg:group-hover:translate-y-[-4px] lg:group-hover:opacity-100">
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
                  <span className="bg-capsula-navy-deep text-capsula-cream text-[10px] font-semibold rounded-full w-5 h-5 flex items-center justify-center">
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
              {/* Selector de destino — solo si hay subcuentas abiertas. Default
                  "Cuenta general"; si el mesero elige una subcuenta, los items
                  del carrito se asignan a esa subcuenta al enviar a cocina. */}
              {openSubAccounts.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1.5">
                    Destino del pedido
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setCartTargetSubAccountId(null)}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition ${
                        cartTargetSubAccountId === null
                          ? 'bg-capsula-navy-deep text-capsula-cream border-capsula-navy-deep'
                          : 'bg-capsula-ivory text-capsula-ink-soft border-capsula-line hover:bg-capsula-ivory-alt'
                      }`}
                    >
                      Cuenta general
                    </button>
                    {openSubAccounts.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setCartTargetSubAccountId(s.id)}
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition ${
                          cartTargetSubAccountId === s.id
                            ? 'bg-capsula-navy-deep text-capsula-cream border-capsula-navy-deep'
                            : 'bg-capsula-ivory text-capsula-ink-soft border-capsula-line hover:bg-capsula-ivory-alt'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {cart.map((item, i) => (
                  <div key={i} className="flex justify-between items-center text-xs bg-capsula-ivory rounded-lg px-3 py-2 border border-capsula-line">
                    <span className="font-semibold text-capsula-ink-soft truncate flex-1">
                      <span className="text-capsula-ink font-semibold">x{item.quantity}</span> {item.name}
                    </span>
                    <span className="text-capsula-ink font-semibold ml-2 tabular-nums">${item.lineTotal.toFixed(2)}</span>
                    {/* Borrar este item sin limpiar todo el carrito */}
                    <button
                      type="button"
                      onClick={() => removeCartItem(i)}
                      title="Quitar este artículo del pedido"
                      aria-label={`Quitar ${item.name}`}
                      className="ml-2 h-6 w-6 shrink-0 rounded-md text-capsula-ink-faint hover:bg-capsula-coral/10 hover:text-capsula-coral flex items-center justify-center transition-colors active:scale-90"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between items-center border-t border-capsula-line pt-2">
                <span className="text-xs font-semibold text-capsula-ink-muted uppercase tracking-wider">Subtotal</span>
                <span className="text-sm font-semibold text-capsula-ink tabular-nums">${cartTotal.toFixed(2)}</span>
              </div>
              {/* Botones de marchar — si el cart tiene items de ambos cursos,
                  mostrar 3 botones (entradas / principales / todo). Si solo
                  tiene uno de los dos, mostrar el botón único "Enviar a cocina". */}
              {(() => {
                const hasEntradas = cartCourseCounts.entradas > 0;
                const hasPrincipales = cartCourseCounts.principales > 0;
                const showSplit = hasEntradas && hasPrincipales && !sendSuccess && !isProcessing;
                const baseBtn = "py-3 rounded-xl font-semibold text-xs uppercase tracking-wider transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed";

                if (showSplit) {
                  return (
                    <div className="mt-3 space-y-1.5">
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          onClick={() => { void handleSendToTab('entradas'); }}
                          disabled={!activeTab || isProcessing || isOffline}
                          className={`${baseBtn} bg-capsula-ivory-surface border border-capsula-line text-capsula-ink-soft hover:border-capsula-navy-deep/40`}
                        >
                          <ChefHat className="h-3.5 w-3.5" /> Entradas ({cartCourseCounts.entradas})
                        </button>
                        <button
                          onClick={() => { void handleSendToTab('principales'); }}
                          disabled={!activeTab || isProcessing || isOffline}
                          className={`${baseBtn} bg-capsula-ivory-surface border border-capsula-line text-capsula-ink-soft hover:border-capsula-navy-deep/40`}
                        >
                          <Flame className="h-3.5 w-3.5" /> Principales ({cartCourseCounts.principales})
                        </button>
                      </div>
                      <button
                        onClick={() => { void handleSendToTab('all'); if (window.innerWidth < 1024) setMobileTab("tables"); }}
                        disabled={!activeTab || isProcessing || isOffline}
                        className={`w-full ${baseBtn} bg-capsula-navy-deep hover:bg-capsula-navy-deep/90 text-capsula-cream`}
                      >
                        <ChefHat className="h-4 w-4" /> Marchar todo · ${cartTotal.toFixed(2)}
                      </button>
                    </div>
                  );
                }

                // Caso simple: un solo curso en el cart → botón único.
                return (
                  <button
                    onClick={() => { void handleSendToTab('all'); if (window.innerWidth < 1024) setMobileTab("tables"); }}
                    disabled={!activeTab || isProcessing || isOffline}
                    title={isOffline ? "Sin conexión — el carrito queda guardado local hasta que vuelva la señal" : undefined}
                    className={`w-full mt-3 py-3.5 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                      sendSuccess
                        ? "bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]"
                        : "bg-capsula-navy-deep hover:bg-capsula-navy-deep/90 text-capsula-cream disabled:opacity-40 disabled:cursor-not-allowed"
                    }`}
                  >
                    {sendSuccess ? (
                      <><Check className="h-4 w-4" /> ¡Enviado a cocina!</>
                    ) : isProcessing ? (
                      "Enviando..."
                    ) : isOffline ? (
                      <><ChefHat className="h-4 w-4" /> Sin conexión · ${cartTotal.toFixed(2)}</>
                    ) : (
                      <><ChefHat className="h-4 w-4" /> Enviar a cocina · ${cartTotal.toFixed(2)}</>
                    )}
                  </button>
                );
              })()}
            </div>
          )}

          {/* Cuenta activa — items enviados */}
          {subAccountMode && activeTab ? (
            <SubAccountPanel
              openTabId={activeTab.id}
              exchangeRate={exchangeRate}
              onClose={() => setSubAccountMode(false)}
              onTabUpdated={() => {
                loadData(false);
                if (activeTab?.id) refreshSubAccounts(activeTab.id);
              }}
              tabCode={activeTab.tabCode}
              customerLabel={activeTab.customerLabel ?? undefined}
              tableLabel={selectedTable?.name}
              cashierName={activeTab.openedBy?.firstName}
              canCharge={false}
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
                      <div className="flex flex-col">
                        <span className="text-[10px] font-semibold text-capsula-ink uppercase tracking-wider">#{order.orderNumber}</span>
                        {/* Hora de carga + tiempo transcurrido — el mesonero usa
                            esto para llevar el control del tiempo y presionar a
                            cocina si un pedido lleva mucho rato. */}
                        <span className="text-[9px] font-semibold text-capsula-ink-muted tabular-nums">
                          {formatTime(order.createdAt)} · {formatElapsed(order.createdAt)}
                        </span>
                      </div>
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
                              <span className="text-capsula-ink font-semibold">x{item.quantity}</span> {item.itemName}
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
                    className="mt-3 w-full py-2.5 rounded-xl text-xs font-semibold bg-capsula-navy-deep hover:bg-capsula-navy-deep/90 text-capsula-cream transition inline-flex items-center justify-center gap-2"
                  >
                    <Receipt className="h-3.5 w-3.5" />
                    Mostrar cuenta al cliente
                  </button>
                  {/* Subcuentas — disponible para cualquier mesero. El cobro
                      sigue siendo del cajero. */}
                  <button
                    onClick={() => setSubAccountMode(true)}
                    className="mt-2 w-full py-2 rounded-xl text-xs font-semibold bg-capsula-ivory-alt hover:bg-capsula-navy-soft text-capsula-ink-soft hover:text-capsula-ink border border-capsula-line transition inline-flex items-center justify-center gap-2"
                  >
                    <Divide className="h-3.5 w-3.5" />
                    {subAccountsCount > 0
                      ? <>Ver subcuentas existentes ({subAccountsCount})</>
                      : <>Dividir cuenta (subcuentas)</>}
                  </button>
                  {canUseCaptainFeatures && (
                    <button
                      onClick={openTransferModal}
                      className="mt-2 w-full py-2 rounded-xl text-xs font-semibold bg-capsula-ivory-alt hover:bg-capsula-navy-soft text-capsula-ink-soft hover:text-capsula-ink border border-capsula-line transition inline-flex items-center justify-center gap-2"
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                      Transferir mesa
                    </button>
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
                <span className="absolute top-1 right-6 bg-capsula-coral text-capsula-cream text-[9px] rounded-full min-w-[16px] h-4 flex items-center justify-center font-semibold px-1">
                  {cartBadgeCount}
                </span>
              )}
              {tab === "account" && activeTab && activeTab.balanceDue > 0.01 && cartBadgeCount === 0 && (
                <span className="text-[9px] font-semibold tabular-nums text-capsula-coral leading-none">
                  ${activeTab.balanceDue.toFixed(0)}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ══ MODAL: CUENTA AL CLIENTE z-[70] ══════════════════════════════ */}
      {showBillModal && activeTab && (() => {
        // Vista activa: 'general' = toda la mesa; un id de sub = solo
        // los items asignados a esa sub-cuenta.
        const selectedSub = billSubAccountView !== 'general'
            ? tabSubAccountsDetail.find(s => s.id === billSubAccountView) ?? null
            : null;

        // Subtotal/items dependen de la vista. Para vista general usamos
        // los runnings de la tab (que ya consideran toda la mesa). Para
        // una sub específica usamos los datos de esa SubAccount.
        const subtotal      = selectedSub
            ? selectedSub.subtotal
            : activeTab.runningSubtotal;
        const discount      = selectedSub
            ? 0  // descuento global de la tab no se distribuye automático
            : activeTab.runningDiscount;
        const serviceCharge = selectedSub
            ? (selectedSub.serviceCharge ?? 0)
            : (activeTab.totalServiceCharge ?? 0);
        // Propina: el % se mantiene global, pero el monto se recalcula
        // proporcional al subtotal de la sub-cuenta.
        const tipPct = activeTab.tipPercent ?? 0;
        const tipAmount = selectedSub
            ? subtotal * (tipPct / 100)
            : (activeTab.tipAmount ?? 0);
        const paidSplits    = selectedSub
            ? []  // los paidSplits a nivel sub son distintos; simplificamos: no mostramos saldo parcial en vista sub
            : (activeTab.paymentSplits ?? []).filter(s => s.status === 'PAID');
        const paidTotal     = selectedSub
            ? (selectedSub.paidAmount ?? 0)
            : paidSplits.reduce((s, p) => s + p.paidAmount, 0);
        // Preview Divisas −33.33%: descuento de 1/3 sobre el subtotal.
        const divisasDiscount = divisasPreview ? subtotal / 3 : 0;
        const grandTotal    = subtotal - discount + serviceCharge + tipAmount - divisasDiscount;
        const saldoBruto    = Math.max(0, grandTotal - paidTotal);
        const amountToShow  = saldoBruto > 0.01 ? saldoBruto : grandTotal;
        const totalBs       = exchangeRate ? grandTotal * exchangeRate : null;
        const saldoBs       = exchangeRate ? amountToShow * exchangeRate : null;
        const formatBs = (n: number) =>
            `Bs ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        // Items a listar: si vista sub, solo los items asignados a esa
        // sub. Si vista general, todos los items de todas las órdenes.
        type BillItem = { itemName: string; quantity: number; lineTotal: number; modifiers: Array<{ name: string }> };
        const itemsToShow: BillItem[] = selectedSub
            ? selectedSub.items.map(it => ({
                itemName: it.salesOrderItem.itemName,
                quantity: it.quantity,
                lineTotal: it.lineTotal,
                modifiers: it.salesOrderItem.modifiers,
            }))
            : activeTab.orders.flatMap(o => o.items).map(it => ({
                itemName: it.itemName,
                quantity: it.quantity,
                lineTotal: it.lineTotal,
                modifiers: it.modifiers ?? [],
            }));

        // Sub-cuentas OPEN para el selector. Filtramos paid/void para
        // que el mesero no muestre por error una cuenta ya cobrada.
        const openSubs = tabSubAccountsDetail.filter(s => s.status === 'OPEN');

        const methodLabel = (pm: string | null) => {
          const k = (pm ?? '').toUpperCase();
          if (k === 'CASH' || k === 'CASH_USD') return 'Cash USD';
          if (k === 'CASH_EUR') return 'Cash EUR';
          if (k === 'CASH_BS') return 'Efectivo Bs';
          if (k === 'ZELLE') return 'Zelle';
          if (k === 'CARD' || k === 'BS_POS' || k === 'PDV_SHANKLISH' || k === 'PDV_SUPERFERRO') return 'Punto de Venta';
          if (k === 'MOBILE_PAY' || k === 'PAGO_MOVIL' || k === 'MOVIL_NG') return 'Pago Móvil';
          if (k === 'TRANSFER' || k === 'BANK_TRANSFER') return 'Transferencia';
          return pm ?? 'Otro';
        };

        // Tasa BCV + 2 decimales: el cliente espera ver el monto exacto
        // al céntimo cuando paga por transferencia/pago móvil.
        const payMethods: { Icon: React.ElementType; label: string; value: string }[] = [
          { Icon: DollarSign, label: 'Cash USD / Zelle', value: `$${amountToShow.toFixed(2)}` },
          { Icon: Euro,       label: 'Cash EUR',          value: 'consultar tasa' },
          { Icon: CreditCard, label: 'Punto de Venta',    value: `$${amountToShow.toFixed(2)}` },
          ...(saldoBs !== null ? [
            { Icon: Smartphone, label: 'Pago Móvil',      value: formatBs(saldoBs) },
            { Icon: Banknote,   label: 'Transferencia',   value: formatBs(saldoBs) },
          ] : []),
        ];

        return (
          <div className="fixed inset-0 z-[70] bg-capsula-ink/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-capsula-ivory w-full max-w-sm rounded-3xl shadow-2xl border border-capsula-line flex flex-col max-h-[92vh]">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-capsula-line shrink-0">
                <div>
                  <h3 className="font-semibold text-base text-capsula-ink tracking-[-0.02em]">Cuenta</h3>
                  <p className="text-[10px] text-capsula-ink-muted font-semibold uppercase tracking-[0.14em] mt-0.5">
                    {selectedTable?.name} · {activeTab.tabCode} · {activeTab.customerLabel}
                  </p>
                </div>
                <button
                  onClick={() => setShowBillModal(false)}
                  className="h-9 w-9 rounded-full hover:bg-capsula-coral/10 hover:text-capsula-coral transition flex items-center justify-center text-capsula-ink-muted"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>

              {/* Selector de vista: general / sub-cuentas (solo si hay subs abiertas) */}
              {openSubs.length > 0 && (
                <div className="px-5 pt-3 shrink-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1.5">Mostrar al cliente</p>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    <button
                      onClick={() => setBillSubAccountView('general')}
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition ${
                        billSubAccountView === 'general'
                          ? 'bg-capsula-navy-deep text-capsula-cream'
                          : 'bg-capsula-ivory-surface border border-capsula-line text-capsula-ink-soft hover:border-capsula-navy-deep/40'
                      }`}
                    >
                      Cuenta general
                    </button>
                    {openSubs.map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => setBillSubAccountView(sub.id)}
                        className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition ${
                          billSubAccountView === sub.id
                            ? 'bg-capsula-navy-deep text-capsula-cream'
                            : 'bg-capsula-ivory-surface border border-capsula-line text-capsula-ink-soft hover:border-capsula-navy-deep/40'
                        }`}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Items */}
              <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1 min-h-0">
                {itemsToShow.length === 0 ? (
                  <p className="text-center text-xs text-capsula-ink-muted py-6 font-semibold">
                    Esta sub-cuenta no tiene items asignados.
                  </p>
                ) : itemsToShow.map((item, i) => (
                  <div key={i} className="flex justify-between items-baseline text-sm">
                    <div className="flex-1 mr-2 min-w-0">
                      <div className="text-capsula-ink-soft font-semibold">
                        <span className="text-capsula-ink-muted text-xs">×{item.quantity}</span> {item.itemName}
                      </div>
                      {item.modifiers && item.modifiers.length > 0 && (
                        <div className="text-[11px] text-capsula-ink-muted italic pl-5">
                          {item.modifiers.map((m) => m.name).join(", ")}
                        </div>
                      )}
                    </div>
                    <span className="font-semibold text-capsula-ink tabular-nums">${item.lineTotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Totales + pagos + métodos */}
              <div className="px-5 pt-3 pb-4 border-t border-capsula-line space-y-3 shrink-0 overflow-y-auto">
                {/* Toggle Normal / Divisas -33% — recalcula desglose abajo
                    si está activo (sin persistir, solo preview para el cliente). */}
                <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-capsula-ivory-alt p-1 border border-capsula-line">
                  <button
                    onClick={() => setDivisasPreview(false)}
                    className={`py-2 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition ${
                      !divisasPreview
                        ? 'bg-capsula-navy-deep text-capsula-cream shadow-sm'
                        : 'text-capsula-ink-muted hover:text-capsula-ink'
                    }`}
                  >
                    Normal
                  </button>
                  <button
                    onClick={() => setDivisasPreview(true)}
                    className={`py-2 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition ${
                      divisasPreview
                        ? 'bg-capsula-coral text-capsula-cream shadow-sm'
                        : 'text-capsula-ink-muted hover:text-capsula-ink'
                    }`}
                  >
                    Divisas −33,33%
                  </button>
                </div>

                {/* Desglose */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-capsula-ink-muted">
                    <span className="font-semibold uppercase tracking-wider">Subtotal</span>
                    <span className="font-semibold text-capsula-ink tabular-nums">${subtotal.toFixed(2)}</span>
                  </div>
                  {discount > 0.001 && (
                    <div className="flex justify-between text-xs text-[#2F6B4E] dark:text-[#6FB88F]">
                      <span className="font-semibold uppercase tracking-wider">Descuento</span>
                      <span className="font-semibold tabular-nums">−${discount.toFixed(2)}</span>
                    </div>
                  )}
                  {divisasDiscount > 0.001 && (
                    <div className="flex justify-between text-xs text-capsula-coral">
                      <span className="font-semibold uppercase tracking-wider">Descuento Divisas (−33,33%)</span>
                      <span className="font-semibold tabular-nums">−${divisasDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  {serviceCharge > 0.001 && (
                    <div className="flex justify-between text-xs text-capsula-ink-muted">
                      <span className="font-semibold uppercase tracking-wider">Servicio (10%)</span>
                      <span className="font-semibold text-capsula-ink tabular-nums">${serviceCharge.toFixed(2)}</span>
                    </div>
                  )}
                  {tipAmount > 0.001 && (
                    <div className="flex justify-between text-xs text-capsula-ink-muted">
                      <span className="font-semibold uppercase tracking-wider">
                        Propina{activeTab.tipPercent != null && activeTab.tipPercent > 0 ? ` (${activeTab.tipPercent}%)` : ''}
                      </span>
                      <span className="font-semibold text-capsula-ink tabular-nums">${tipAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-baseline border-t border-capsula-line pt-2">
                    <span className="text-sm font-semibold text-capsula-ink uppercase tracking-[0.14em]">Total USD</span>
                    <span className="text-2xl font-semibold text-capsula-ink tabular-nums">${grandTotal.toFixed(2)}</span>
                  </div>
                  {totalBs !== null && (
                    <div className="flex justify-between text-[11px] text-capsula-ink-muted">
                      <span className="font-semibold uppercase tracking-wider">Bs (tasa {exchangeRate?.toFixed(2)})</span>
                      <span className="font-semibold tabular-nums">{formatBs(totalBs)}</span>
                    </div>
                  )}
                </div>

                {/* Propina */}
                {(() => {
                  const currentTipPct = activeTab.tipPercent;
                  const currentTipAmt = activeTab.tipAmount;
                  // "Sin propina" removido a pedido del operador: al mostrar la
                  // cuenta al cliente solo se ofrecen porcentajes. El default
                  // 10% se auto-setea al abrir el modal (ver useEffect arriba).
                  // El ajuste a 0 (si excepcionalmente hace falta) lo gestiona
                  // el cajero al momento del cobro real.
                  const tipOptions = [
                    { label: '10%', pct: 10 },
                    { label: '15%', pct: 15 },
                    { label: '20%', pct: 20 },
                  ];
                  return (
                    <div className="rounded-xl border border-capsula-line bg-capsula-ivory-surface p-3 space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Propina</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {tipOptions.map(({ label, pct }) => {
                          const isActive = currentTipPct !== null && currentTipPct !== undefined && currentTipPct === pct;
                          return (
                            <button
                              key={pct}
                              disabled={isTipSetting}
                              onClick={() => handleSetTip(pct)}
                              className={`py-2 rounded-lg text-[11px] font-semibold transition active:scale-95 ${
                                isActive
                                  ? 'bg-capsula-navy-deep text-capsula-cream'
                                  : 'bg-capsula-ivory border border-capsula-line text-capsula-ink-soft hover:border-capsula-navy-deep/40'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                      {currentTipPct !== null && currentTipPct !== undefined && currentTipPct > 0 && currentTipAmt !== null && currentTipAmt !== undefined && (
                        <div className="flex items-center justify-between pt-0.5">
                          <span className="text-[11px] font-semibold text-[#2F6B4E] dark:text-[#6FB88F] uppercase tracking-wider">Propina {currentTipPct}%</span>
                          <span className="text-sm font-semibold text-[#2F6B4E] dark:text-[#6FB88F] tabular-nums">${currentTipAmt.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Pagos ya registrados */}
                {paidSplits.length > 0 && (
                  <div className="rounded-xl bg-[#E6ECF4] dark:bg-[#1A2636] border border-capsula-line p-3 space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#2A4060] dark:text-[#D1DCE9]">Pagos registrados</p>
                    {paidSplits.map((sp, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-capsula-ink-soft font-semibold">{sp.splitLabel || methodLabel(sp.paymentMethod)}</span>
                        <span className="font-semibold tabular-nums text-capsula-ink">${sp.paidAmount.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center border-t border-capsula-line pt-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-capsula-ink">Saldo pendiente</span>
                      <span className={`text-base font-semibold tabular-nums ${saldoBruto > 0.01 ? 'text-capsula-coral' : 'text-[#2F6B4E] dark:text-[#6FB88F]'}`}>
                        {saldoBruto > 0.01 ? `$${saldoBruto.toFixed(2)}` : 'PAGADO'}
                      </span>
                    </div>
                    {saldoBs !== null && saldoBruto > 0.01 && (
                      <div className="text-right text-[10px] text-capsula-ink-muted font-semibold tabular-nums">
                        {formatBs(saldoBs)}
                      </div>
                    )}
                  </div>
                )}

                {/* Métodos de pago aceptados */}
                <div className="rounded-xl bg-capsula-ivory-alt border border-capsula-line p-3 space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Métodos de pago</p>
                  {payMethods.map(({ Icon, label, value }) => (
                    <div key={label} className="flex justify-between items-center text-[11px]">
                      <div className="flex items-center gap-1.5 text-capsula-ink-soft">
                        <Icon className="h-3 w-3 text-capsula-ink-muted shrink-0" />
                        <span className="font-semibold">{label}</span>
                      </div>
                      <span className="font-semibold tabular-nums text-capsula-ink">{value}</span>
                    </div>
                  ))}
                </div>

                {/* Acciones rápidas — botón "Imprimir precuenta" SOLO para
                    capitanes o gerentes; los mesoneros regulares solo copian. */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => {
                      const subLabel = selectedSub ? ` · ${selectedSub.label}` : '';
                      const lines = [
                        `SHANKLISH — ${selectedTable?.name} (${activeTab.tabCode})${subLabel}`,
                        `Cliente: ${activeTab.customerLabel ?? ''}`,
                        '',
                        ...itemsToShow.flatMap(it => {
                          const head = `× ${it.quantity}  ${it.itemName}  $${it.lineTotal.toFixed(2)}`;
                          const mods = (it.modifiers ?? []).map(m => m.name).join(', ');
                          return mods ? [head, `    + ${mods}`] : [head];
                        }),
                        '',
                        `Subtotal:       $${subtotal.toFixed(2)}`,
                        ...(discount > 0.001 ? [`Descuento:     -$${discount.toFixed(2)}`] : []),
                        ...(serviceCharge > 0.001 ? [`Servicio 10%:  $${serviceCharge.toFixed(2)}`] : []),
                        ...(tipAmount > 0.001 ? [`Propina${activeTab.tipPercent != null && activeTab.tipPercent > 0 ? ` ${activeTab.tipPercent}%` : ''}:  $${tipAmount.toFixed(2)}`] : []),
                        `TOTAL USD:      $${grandTotal.toFixed(2)}`,
                        ...(totalBs !== null ? [`Bs equiv.:      ${formatBs(totalBs)}`] : []),
                        ...(paidSplits.length > 0 ? ['', `Saldo pendiente: $${saldoBruto.toFixed(2)}`] : []),
                      ];
                      navigator.clipboard.writeText(lines.join('\n')).then(() => toast.success('Resumen copiado'));
                    }}
                    className="flex-1 py-2.5 rounded-xl border border-capsula-line bg-capsula-ivory-surface hover:bg-capsula-navy-soft text-capsula-ink text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition"
                  >
                    <Receipt className="h-3.5 w-3.5" />
                    Copiar
                  </button>
                  {canUseCaptainFeatures && (
                  <button
                    onClick={() => {
                      // Si está activa una sub-cuenta, imprime solo esos items.
                      const items = itemsToShow.map(it => ({
                        name: it.itemName,
                        quantity: it.quantity,
                        unitPrice: it.lineTotal / (it.quantity || 1),
                        total: it.lineTotal,
                        modifiers: (it.modifiers ?? []).map((m: { name?: string } | string) =>
                            typeof m === 'string' ? m : (m?.name ?? '')),
                      }));
                      const titleSuffix = selectedSub ? ` (${selectedSub.label})` : '';
                      printReceipt({
                        orderNumber: `${activeTab.tabCode}${titleSuffix}`,
                        orderType: 'RESTAURANT',
                        date: new Date(),
                        cashierName: activeTab.openedBy.firstName,
                        customerName: activeTab.customerLabel,
                        tableLabel: selectedTable?.name,
                        items,
                        subtotal,
                        discount: discount > 0.001 ? discount : 0,
                        // print-command espera `total` como base (post-discount, pre-service,
                        // pre-tip); luego suma serviceFee + tipAmount internamente.
                        total: subtotal - discount - divisasDiscount,
                        serviceFee: serviceCharge > 0.001 ? serviceCharge : undefined,
                        tipAmount: tipAmount > 0.001 ? tipAmount : undefined,
                        isPrecuenta: true,
                      });
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-capsula-navy-deep hover:bg-capsula-navy-deep/90 text-capsula-cream text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Imprimir
                  </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══ MODAL: ABRIR CUENTA ═══════════════════════════════════════════ */}
      {showOpenTabModal && selectedTable && (
        <div className="fixed inset-0 z-[60] bg-capsula-ink/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-capsula-ivory w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl border border-capsula-line">
            <div>
              <h3 className="font-semibold text-lg text-capsula-ink tracking-[-0.02em]">Abrir cuenta</h3>
              <p className="text-xs text-capsula-ink-muted mt-0.5">{selectedTable.name}</p>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Nombre del cliente *"
                value={openTabName}
                onChange={(e) => setOpenTabName(e.target.value)}
                className="w-full bg-capsula-ivory-surface border border-capsula-line rounded-xl px-4 py-3 text-sm font-medium text-capsula-ink placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none transition"
              />
              <input
                type="tel"
                placeholder="Teléfono *"
                value={openTabPhone}
                onChange={(e) => setOpenTabPhone(e.target.value)}
                className="w-full bg-capsula-ivory-surface border border-capsula-line rounded-xl px-4 py-3 text-sm font-medium text-capsula-ink placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none transition"
              />
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-capsula-ink-muted uppercase tracking-[0.14em] w-24">Personas</label>
                <div className="flex items-center gap-3 bg-capsula-ivory-surface rounded-xl p-1 border border-capsula-line">
                  <button onClick={() => setOpenTabGuests(Math.max(1, openTabGuests - 1))} className="h-9 w-9 rounded-lg bg-capsula-ivory border border-capsula-line font-semibold text-capsula-ink transition hover:bg-capsula-coral/10 hover:text-capsula-coral hover:border-capsula-coral/40">−</button>
                  <span className="w-8 text-center font-semibold text-lg text-capsula-ink tabular-nums">{openTabGuests}</span>
                  <button onClick={() => setOpenTabGuests(openTabGuests + 1)} className="h-9 w-9 rounded-lg bg-capsula-navy-deep text-capsula-cream font-semibold transition hover:bg-capsula-navy-deep/90">+</button>
                </div>
              </div>
              {activeWaiter && (
                <div className="flex items-center gap-2 px-4 py-3 bg-capsula-navy-soft border border-capsula-line rounded-xl text-xs">
                  <span className="h-7 w-7 rounded-full bg-capsula-navy-deep text-capsula-cream flex items-center justify-center font-semibold">
                    {activeWaiter.firstName.charAt(0)}{activeWaiter.lastName.charAt(0)}
                  </span>
                  <div>
                    <div className="font-semibold text-capsula-ink">{activeWaiter.firstName} {activeWaiter.lastName}</div>
                    <div className="text-[10px] text-capsula-ink-muted uppercase tracking-[0.14em]">Mesonero de la mesa</div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowOpenTabModal(false)} className="pos-btn-secondary flex-1 py-3">
                Cancelar
              </button>
              <button
                onClick={handleOpenTab}
                disabled={isProcessing || !openTabName.trim() || !openTabPhone.trim()}
                className="pos-btn flex-[2] py-3 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {isProcessing ? "Abriendo..." : (<><Check className="h-4 w-4" />Abrir cuenta</>)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: MODIFICADORES ══════════════════════════════════════════ */}
      {showModifierModal && selectedItemForModifier && (
        <div className="fixed inset-0 z-50 bg-capsula-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-capsula-ivory w-full max-w-lg rounded-t-3xl sm:rounded-3xl flex flex-col max-h-[92vh] sm:max-h-[90vh] shadow-2xl border border-capsula-line">
            <div className="p-5 border-b border-capsula-line flex justify-between items-center">
              <div>
                <h3 className="text-xl font-semibold tracking-[-0.02em] text-capsula-ink">{selectedItemForModifier.name}</h3>
                <p className="text-capsula-ink font-semibold text-lg tabular-nums mt-0.5">${selectedItemForModifier.price.toFixed(2)}</p>
              </div>
              <button onClick={() => setShowModifierModal(false)} className="h-10 w-10 rounded-full hover:bg-capsula-coral/10 hover:text-capsula-coral transition flex items-center justify-center text-capsula-ink-muted">
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {selectedItemForModifier.modifierGroups?.map((groupRel) => {
                const group = groupRel.modifierGroup;
                const totalSelected = currentModifiers.filter((m) => m.groupId === group.id).reduce((s, m) => s + m.quantity, 0);
                const isValid = !group.isRequired || totalSelected >= group.minSelections;
                return (
                  <div key={group.id} className={`p-4 rounded-2xl border transition-colors ${isValid ? "border-capsula-line bg-capsula-ivory-surface" : "border-capsula-coral bg-capsula-coral/5"}`}>
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-semibold text-sm uppercase tracking-[0.14em] text-capsula-ink-soft">{group.name}</h4>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${isValid ? "bg-capsula-navy-soft text-capsula-ink" : "bg-capsula-coral text-capsula-cream"}`}>
                        {totalSelected}/{group.maxSelections}{group.isRequired ? " · Req." : ""}
                      </span>
                    </div>
                    <div className="grid gap-2">
                      {(() => {
                        // Agrupa "Sin X" / "Con X" / "+ X" en toggles SIN/CON
                        // por ingrediente. El resto se renderiza como antes.
                        const { toggles, passThrough } = groupModifiersForSinCon(group.modifiers as any);
                        const selectedIdSet = new Set(
                          currentModifiers.filter((m) => m.groupId === group.id).map((m) => m.id),
                        );
                        return (
                          <>
                            {toggles.map((toggle) => (
                              <SinConToggle
                                key={toggle.key}
                                toggle={toggle}
                                state={toggleStateFor(toggle, selectedIdSet)}
                                onChange={(target) => setIngredientToggleState(group, toggle, target)}
                              />
                            ))}
                            {passThrough.map((mod) => {
                              const existing = currentModifiers.find((m) => m.id === mod.id && m.groupId === group.id);
                              const qty = existing?.quantity || 0;
                              const isMax = group.maxSelections > 1 && totalSelected >= group.maxSelections;
                              const isRadio = group.maxSelections === 1;
                              return (
                                <div key={mod.id} className={`flex justify-between items-center p-3 rounded-xl border transition-all ${qty > 0 ? "bg-capsula-navy-soft border-capsula-navy-deep" : "bg-capsula-ivory border-capsula-line hover:border-capsula-navy-deep/40"}`}>
                                  <div>
                                    <div className="font-semibold text-sm text-capsula-ink">{mod.name}</div>
                                    {mod.priceAdjustment !== 0 && (
                                      <div className="text-xs text-capsula-ink-muted tabular-nums">+${mod.priceAdjustment.toFixed(2)}</div>
                                    )}
                                  </div>
                                  {isRadio ? (
                                    <button
                                      onClick={() => updateModifierQuantity(group, mod as any, 1)}
                                      className={`h-8 w-8 rounded-full border flex justify-center items-center transition-all ${qty > 0 ? "bg-capsula-navy-deep border-capsula-navy-deep text-capsula-cream scale-110" : "border-capsula-line hover:border-capsula-navy-deep"}`}
                                    >
                                      {qty > 0 && <Check className="h-4 w-4" />}
                                    </button>
                                  ) : (
                                    <div className="flex items-center gap-2 bg-capsula-ivory p-1 rounded-xl border border-capsula-line">
                                      <button onClick={() => updateModifierQuantity(group, mod as any, -1)} disabled={qty === 0} className={`h-7 w-7 rounded-lg font-semibold transition ${qty === 0 ? "text-capsula-ink-faint opacity-40" : "bg-capsula-ivory-alt hover:bg-capsula-coral/10 hover:text-capsula-coral text-capsula-ink"}`}>−</button>
                                      <span className="font-semibold text-base w-5 text-center text-capsula-ink tabular-nums">{qty}</span>
                                      <button onClick={() => updateModifierQuantity(group, mod as any, 1)} disabled={isMax} className={`h-7 w-7 rounded-lg font-semibold transition ${isMax ? "text-capsula-ink-faint opacity-40" : "bg-capsula-navy-deep text-capsula-cream hover:bg-capsula-navy-deep/90"}`}>+</button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
              <div className="bg-capsula-ivory-surface p-4 rounded-2xl border border-capsula-line">
                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-2 block">Instrucciones especiales</label>
                <textarea
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  className="w-full bg-capsula-ivory rounded-xl p-3 h-20 text-sm font-medium text-capsula-ink border border-capsula-line placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none resize-none transition"
                  placeholder="Petición del cliente..."
                />
              </div>
              <div className="flex items-center justify-between bg-capsula-ivory-surface p-4 rounded-2xl border border-capsula-line">
                <span className="font-semibold uppercase tracking-[0.14em] text-base text-capsula-ink">Cantidad</span>
                <div className="flex items-center gap-2 bg-capsula-ivory p-1 rounded-xl border border-capsula-line">
                  <button onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))} className="h-12 w-12 rounded-lg font-semibold text-xl text-capsula-ink hover:bg-capsula-ivory-alt transition active:scale-90">−</button>
                  <span className="w-12 text-center font-semibold text-2xl text-capsula-ink tabular-nums">{itemQuantity}</span>
                  <button onClick={() => setItemQuantity(itemQuantity + 1)} className="h-12 w-12 rounded-lg bg-capsula-navy-deep text-capsula-cream font-semibold text-xl hover:bg-capsula-navy-deep/90 active:scale-95">+</button>
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-capsula-line flex gap-3">
              <button onClick={() => setShowModifierModal(false)} className="pos-btn-secondary flex-1 py-4 text-sm">Cancelar</button>
              <button
                onClick={confirmAddToCart}
                disabled={selectedItemForModifier.modifierGroups.some((g) => !isGroupValid(g.modifierGroup))}
                className="pos-btn flex-[2] py-4 text-sm disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                <PlusIcon className="h-4 w-4" />
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
          <div className="fixed inset-0 z-[60] bg-capsula-ink/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-capsula-ivory w-full max-w-lg rounded-3xl p-6 space-y-4 shadow-2xl border border-capsula-line max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-capsula-navy-soft rounded-2xl flex items-center justify-center text-capsula-ink flex-shrink-0">
                  <ArrowLeftRight className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-base text-capsula-ink tracking-[-0.02em]">Mover mesa</h3>
                  <p className="text-xs text-capsula-ink-muted">
                    {selectedTable?.name}
                    {activeTab.customerLabel ? ` · ${activeTab.customerLabel}` : ""}
                    {" → "}
                    <span className={transferToTableId ? "text-capsula-ink font-semibold" : "text-capsula-ink-muted"}>
                      {transferToTableId
                        ? (availableTables.find((t) => t.id === transferToTableId)?.name ?? "...")
                        : "selecciona destino"}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => setShowTransferModal(false)}
                  className="ml-auto h-9 w-9 rounded-full hover:bg-capsula-coral/10 hover:text-capsula-coral transition flex items-center justify-center text-capsula-ink-muted flex-shrink-0"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>

              {/* Grid de mesas disponibles */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-2 block">
                  Mesa destino (disponibles)
                </label>
                {availableTables.length === 0 ? (
                  <p className="text-xs text-capsula-ink-muted bg-capsula-ivory-surface border border-capsula-line rounded-xl px-4 py-3">
                    No hay mesas disponibles en este momento.
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-2 max-h-52 overflow-y-auto pr-1">
                    {availableTables.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTransferToTableId(t.id)}
                        className={`rounded-xl py-3 px-2 text-xs font-semibold transition border flex flex-col items-center gap-0.5 ${
                          transferToTableId === t.id
                            ? "bg-capsula-navy-deep border-capsula-navy-deep text-capsula-cream"
                            : "bg-capsula-ivory-surface border-capsula-line text-capsula-ink hover:border-capsula-navy-deep/50"
                        }`}
                      >
                        <span className="text-sm">{t.name}</span>
                        <span className={`text-[9px] font-normal ${transferToTableId === t.id ? "text-capsula-cream/70" : "text-capsula-ink-muted"}`}>
                          {t.zoneName}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Motivo */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1.5 block">
                  Motivo (opcional)
                </label>
                <textarea
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="Ej: Petición del cliente, cambio de zona..."
                  className="w-full bg-capsula-ivory-surface border border-capsula-line text-capsula-ink rounded-xl p-3 text-sm font-medium placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none resize-none h-14 transition"
                />
              </div>

              {/* PIN */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1.5 block">
                  PIN de capitán o gerente
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  placeholder="••••"
                  value={transferCaptainPin}
                  onChange={(e) => setTransferCaptainPin(e.target.value)}
                  className="w-full bg-capsula-ivory-surface border border-capsula-line text-capsula-ink rounded-xl px-4 py-3 text-sm font-medium placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none tracking-[0.3em] transition"
                />
              </div>

              {transferError && (
                <p className="text-capsula-coral text-xs font-semibold bg-capsula-coral/10 border border-capsula-coral/30 rounded-xl px-3 py-2">
                  {transferError}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowTransferModal(false)}
                  className="pos-btn-secondary flex-1 py-3"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleTableTransfer}
                  disabled={isProcessing || !transferToTableId || !transferCaptainPin.trim()}
                  className="pos-btn flex-[2] py-3 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  {isProcessing ? "Moviendo..." : (<><ArrowLeftRight className="h-4 w-4" />Confirmar movimiento</>)}
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
          <div className="fixed inset-0 z-50 bg-capsula-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-capsula-ivory w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl border border-capsula-line max-h-[92vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 bg-capsula-coral/10 rounded-2xl flex items-center justify-center text-capsula-coral flex-shrink-0">
                  <Pencil className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-capsula-ink tracking-[-0.02em]">Modificar ítem enviado</h3>
                  <p className="text-xs text-capsula-ink-muted truncate">
                    <span className="font-semibold text-capsula-ink">{removeTarget.quantity}×</span> {removeTarget.itemName}
                    <span className="ml-2 tabular-nums">${removeTarget.lineTotal.toFixed(2)}</span>
                  </p>
                </div>
                <button onClick={() => setShowRemoveModal(false)} className="h-8 w-8 rounded-full hover:bg-capsula-coral/10 text-capsula-ink-muted hover:text-capsula-coral flex items-center justify-center flex-shrink-0">
                  <XIcon className="h-4 w-4" />
                </button>
              </div>

              {/* Opciones de modificación */}
              <div className="grid grid-cols-3 gap-2">
                {(["VOID", "ADJUST_QTY", "REPLACE"] as const).map((t) => {
                  const Icon = t === "VOID" ? Ban : t === "ADJUST_QTY" ? Pencil : RefreshCw;
                  const label = t === "VOID" ? "Cancelar" : t === "ADJUST_QTY" ? "Ajustar" : "Cambiar";
                  return (
                    <button
                      key={t}
                      onClick={() => setRemoveModType(t)}
                      className={`py-2.5 rounded-xl text-xs font-semibold border transition inline-flex items-center justify-center gap-1.5 ${
                        removeModType === t
                          ? "bg-capsula-navy-deep border-capsula-navy-deep text-capsula-cream"
                          : "bg-capsula-ivory-surface border-capsula-line text-capsula-ink hover:border-capsula-navy-deep/40"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Ajustar cantidad */}
              {removeModType === "ADJUST_QTY" && (
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1.5 block">
                    Nueva cantidad (actual: {removeTarget.quantity})
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setRemoveNewQty((q) => Math.max(1, q - 1))}
                      className="h-10 w-10 rounded-xl bg-capsula-ivory-surface border border-capsula-line text-lg font-semibold text-capsula-ink hover:border-capsula-coral/40 hover:text-capsula-coral transition"
                    >−</button>
                    <span className="flex-1 text-center text-2xl font-semibold text-capsula-ink tabular-nums">{removeNewQty}</span>
                    <button
                      onClick={() => setRemoveNewQty((q) => Math.min(removeTarget.quantity - 1, q + 1))}
                      className="h-10 w-10 rounded-xl bg-capsula-ivory-surface border border-capsula-line text-lg font-semibold text-capsula-ink hover:border-capsula-navy-deep/40 transition"
                    >+</button>
                  </div>
                  <p className="text-[10px] text-capsula-ink-muted mt-1 text-center">
                    Se anularán {removeTarget.quantity - removeNewQty} unidad(es) y se reimprimirá la comanda
                  </p>
                </div>
              )}

              {/* Cambiar por otro ítem */}
              {removeModType === "REPLACE" && (
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted block">
                    Producto de reemplazo
                  </label>
                  <input
                    value={removeReplaceSearch}
                    onChange={(e) => setRemoveReplaceSearch(e.target.value)}
                    placeholder="Buscar producto..."
                    className="w-full bg-capsula-ivory-surface border border-capsula-line text-capsula-ink rounded-xl px-3 py-2 text-sm font-medium placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none transition"
                  />
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                    {replaceItems.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setRemoveReplaceItemId(m.id)}
                        className={`w-full flex justify-between items-center px-3 py-2 rounded-lg text-xs font-semibold transition border ${
                          removeReplaceItemId === m.id
                            ? "bg-capsula-navy-deep border-capsula-navy-deep text-capsula-cream"
                            : "bg-capsula-ivory-surface border-capsula-line text-capsula-ink hover:border-capsula-navy-deep/40"
                        }`}
                      >
                        <span className="truncate">{m.name}</span>
                        <span className="ml-2 shrink-0 opacity-70 tabular-nums">${m.price?.toFixed(2)}</span>
                      </button>
                    ))}
                    {replaceItems.length === 0 && (
                      <p className="text-xs text-capsula-ink-muted px-2 py-1">Sin resultados</p>
                    )}
                  </div>
                </div>
              )}

              {/* Motivo */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1.5 block">
                  Motivo (obligatorio)
                </label>
                <textarea
                  value={removeJustification}
                  onChange={(e) => setRemoveJustification(e.target.value)}
                  placeholder="Ej: error del cliente, cambio de pedido..."
                  className="w-full bg-capsula-ivory-surface border border-capsula-line text-capsula-ink rounded-xl p-3 text-sm font-medium placeholder:text-capsula-ink-muted focus:border-capsula-coral focus:outline-none resize-none h-14 transition"
                />
              </div>

              {/* PIN */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1.5 block">
                  PIN de capitán o gerente
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  placeholder="••••"
                  value={removePin}
                  onChange={(e) => setRemovePin(e.target.value)}
                  className="w-full bg-capsula-ivory-surface border border-capsula-line text-capsula-ink rounded-xl px-4 py-3 text-sm font-medium placeholder:text-capsula-ink-muted focus:border-capsula-coral focus:outline-none tracking-[0.3em] transition"
                />
              </div>

              {removeError && (
                <p className="text-capsula-coral text-xs font-semibold bg-capsula-coral/10 border border-capsula-coral/30 rounded-xl px-3 py-2">
                  {removeError}
                </p>
              )}

              <div className="flex gap-3">
                <button onClick={() => setShowRemoveModal(false)} className="pos-btn-secondary flex-1 py-3">
                  Cancelar
                </button>
                <button
                  onClick={handleRemoveItem}
                  disabled={isProcessing || !removeJustification.trim() || !removePin.trim()}
                  className="flex-[2] py-3 rounded-xl font-semibold text-sm bg-capsula-coral text-capsula-cream hover:bg-capsula-coral-hover transition disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  {isProcessing ? "Procesando..." : (
                    removeModType === "VOID"       ? (<><Ban className="h-4 w-4" />Confirmar anulación</>) :
                    removeModType === "ADJUST_QTY" ? (<><Pencil className="h-4 w-4" />Ajustar cantidad</>) :
                                                     (<><RefreshCw className="h-4 w-4" />Confirmar cambio</>)
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
