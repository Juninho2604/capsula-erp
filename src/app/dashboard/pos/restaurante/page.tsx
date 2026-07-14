"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addItemsToOpenTabAction,
  closeOpenTabAction,
  getMenuForPOSAction,
  getRestaurantLayoutAction,
  getUsersForTabAction,
  openTabAction,
  registerOpenTabPaymentAction,
  createSalesOrderAction,
  recordCollectiveTipAction,
  getClosedTabsTodayAction,
  modifyTabItemAction,
  voidEntireTabOrderAction,
  validateManagerPinAction,
  getDailyPickupCountAction,
  getOpenTabWithSubAccountsAction,
  type CartItem,
  type PaymentLine,
  type ModifyTabItemModification,
} from "@/app/actions/pos.actions";
import MixedPaymentSelector from "@/components/pos/MixedPaymentSelector";
import { PaymentConfirmationModal, type PaymentConfirmationLine } from "@/components/pos/PaymentConfirmationModal";
import { getExchangeRateValue } from "@/app/actions/exchange.actions";
import { useDivisasPercent } from "@/lib/hooks/use-divisas-percent";
import { printReceipt, emitReceipt, type VoidKitchenCommandData } from "@/lib/print-command";
import { useTenantBranding } from "@/lib/hooks/use-tenant-branding";
import { useTenantFeatureFlags } from "@/lib/hooks/use-feature-flags";
import { enqueueKitchenCommand, enqueueVoidKitchenCommand, buildMenuItemCategoryMap, buildKitchenItems } from "@/lib/print-via-agent";
import { getPOSConfig } from "@/lib/pos-settings";
import toast from "react-hot-toast";
import { PriceDisplay } from "@/components/pos/PriceDisplay";
import { CurrencyCalculator } from "@/components/pos/CurrencyCalculator";
import ComandasDelDiaModal from "@/components/pos/ComandasDelDiaModal";
import { CashierShiftModal } from "@/components/pos/CashierShiftModal";
import { SubAccountPanel } from "@/components/pos/SubAccountPanel";
import { SinConToggle } from "@/components/pos/SinConToggle";
import { SinIngredientsSection, buildSinCartModifiers } from "@/components/pos/SinIngredientsSection";
import ChildGroupSelector from "@/components/pos/ChildGroupSelector";
import { SatisfactionSurveyCard } from "@/components/pos/SatisfactionSurveyCard";
import { hasChildGroup, purgeChildSelections, childGroupsValid, collectParentModifierIds } from "@/lib/pos-child-group";
import { groupModifiersForSinCon, toggleStateFor, type IngredientToggle } from "@/lib/pos-modifier-grouping";
import { cappedTipForPayment, keptAmountForSplit, roundingTipForCharge, netItemsPortionForPayment } from "@/lib/sales/tip-calculation";
import { scheduledInputToISO, printJobScheduledFor } from "@/lib/pos-scheduled-order";
import { computeDivisasSettlement, type DivisasSettlement } from "@/lib/sales/divisas-settlement";
import { Wine, UserCog, Calendar, Plus as PlusIcon, X as XIcon, DollarSign, Euro, Zap, CreditCard, Smartphone, Banknote, ShoppingBag, Beer, Leaf, Phone as PhoneIcon, AlertTriangle, Search, ArrowLeft, Gift, Printer, Unlock, UserCircle2, Tag, Divide, Wallet, Lock, Armchair, UtensilsCrossed, Receipt as ReceiptIcon, Pencil, Ban, RefreshCw, Check, Copy, Star } from "lucide-react";

// ============================================================================
// TIPOS
// ============================================================================

interface ModifierOption {
  id: string;
  name: string;
  priceAdjustment: number;
  isAvailable: boolean;
  /** Sub-grupo anidado (§82): se despliega al seleccionar esta opción. */
  childGroup?: ModifierGroup | null;
}
interface ModifierGroup {
  id: string;
  name: string;
  isActive?: boolean;
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
  /** SIN estilo Xetux (§94): insumos de la receta con allowSin activo. */
  sinIngredients?: { id: string; name: string }[];
}
interface SelectedModifier {
  groupId: string;
  groupName: string;
  id: string;
  name: string;
  priceAdjustment: number;
  quantity: number;
}
interface PaymentSplit {
  id: string;
  splitLabel: string;
  paymentMethod?: string;
  total: number;
  paidAmount: number;
  paidAt?: string;
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
  createdBy?: { firstName: string; lastName: string };
  items: OrderItemSummary[];
}
interface UserSummary {
  id: string;
  firstName: string;
  lastName: string;
  role?: string;
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
  tipPercent: number | null;
  tipAmount: number | null;
  openedAt: string;
  waiterLabel?: string | null;
  openedBy: UserSummary;
  assignedWaiter?: UserSummary | null;
  closedBy?: UserSummary | null;
  orders: SalesOrderSummary[];
  paymentSplits: PaymentSplit[];
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
interface PickupTabLocal {
  id: string;
  pickupNumber: string;
  customerName: string;
  customerPhone: string;
  // Hora de entrega solicitada por el cliente. Formato 'HH:MM' (24h).
  // Se imprime grande en la comanda de cocina/barra para priorizar.
  scheduledTime: string;
  cart: CartItem[];
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

const PAYMENT_LABELS: Record<string, string> = {
  CASH:          "💵 Cash $",
  CASH_USD:      "💵 Cash $",
  CASH_EUR:      "€ Cash €",
  CASH_BS:       "💴 Efectivo Bs",
  CARD:          "💳 PDV",
  PDV_SHANKLISH: "💳 PDV Shan.",
  PDV_SUPERFERRO:"💳 PDV Super.",
  MOBILE_PAY:    "📱 Pago Móvil",
  MOVIL_NG:      "📱 Pago Móvil NG",
  TRANSFER:      "🏦 Transf.",
  ZELLE:         "⚡ Zelle",
};

/** Métodos donde el cliente paga en Bs — el input acepta Bs y se convierte a USD */
const BS_SINGLE_METHODS = new Set(["PDV_SHANKLISH", "PDV_SUPERFERRO", "MOVIL_NG", "CASH_BS"]);

const SINGLE_PAY_METHODS = ["CASH_USD", "CASH_EUR", "ZELLE", "PDV_SHANKLISH", "PDV_SUPERFERRO", "MOVIL_NG", "CASH_BS"] as const;

/** Métodos donde la cajera debe ingresar el monto manualmente (efectivo, divisas, Bs efectivo).
 *  PDV y MOVIL_NG no necesitan monto — el terminal procesa el monto exacto. */
const METHODS_REQUIRING_AMOUNT = new Set(["CASH_USD", "CASH_EUR", "ZELLE", "CASH_BS"]);
type SinglePayMethod = typeof SINGLE_PAY_METHODS[number];
const CASHIER_ROLES = ["OWNER", "ADMIN_MANAGER", "OPS_MANAGER", "AREA_LEAD"];

function getRoleLabel(role: string) {
  const map: Record<string, string> = {
    OWNER: "Dueño",
    ADMIN_MANAGER: "Gerente Adm.",
    OPS_MANAGER: "Gerente Ops.",
    AREA_LEAD: "Cajera/Líder",
    CHEF: "Cocina",
    WAITER: "Mesonero",
    KITCHEN_CHEF: "Chef Cocina",
  };
  return map[role] || role;
}

function formatTime(d: string | Date) {
  return new Date(d).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit", timeZone: "America/Caracas" });
}
function formatDateTime(d: string | Date) {
  return new Date(d).toLocaleString("es-VE", {
    timeZone: "America/Caracas",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convierte 'HH:MM' (input nativo type=time) a un ISO string anclado a HOY
 * en la zona local. Si la hora ya pasó (ej. son las 15:00 y se marca 14:30)
 * asumimos que es para MAÑANA para que cocina priorice correctamente.
 */
function scheduledTimeToISO(value: string): string | undefined {
  // §104: delega en el helper compartido — acepta datetime-local (hora Y día)
  // y el legacy HH:MM de pickups guardados antes del cambio.
  return scheduledInputToISO(value);
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function POSSportBarPage() {
  // ── Branding del tenant para recibos (logo + RIF) ────────────────────────
  const branding = useTenantBranding();
  // ── Feature flags del tenant (kill switch sin redeploy). El modal de
  //    confirmación pre-cobro se activa con `requirePaymentConfirmation`.
  const featureFlags = useTenantFeatureFlags();
  // ── Modal de confirmación pre-cobro: cuando flag activo, antes de
  //    invocar la action (table/pickup) se abre este modal con resumen.
  const [paymentConfirmationPending, setPaymentConfirmationPending] = useState<{
    lines: PaymentConfirmationLine[];
    totalUSD: number;
    onConfirm: () => void;
  } | null>(null);
  const requestPaymentConfirmation = (
    lines: PaymentConfirmationLine[],
    totalUSD: number,
    onConfirm: () => void,
  ) => {
    if (!featureFlags.requirePaymentConfirmation) {
      onConfirm();
      return;
    }
    setPaymentConfirmationPending({ lines, totalUSD, onConfirm });
  };
  // ── Data ──────────────────────────────────────────────────────────────────
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [layout, setLayout] = useState<SportBarLayout | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [selectedSubcategory, setSelectedSubcategory] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");

  // ── Zone / Table / Tab selection ──────────────────────────────────────────
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [selectedTableId, setSelectedTableId] = useState("");

  // ── Mesa selection modal ──────────────────────────────────────────────────
  const [showTableModal, setShowTableModal] = useState(false);

  // ── Open tab form (modal) ─────────────────────────────────────────────────
  const [showOpenTabModal, setShowOpenTabModal] = useState(false);
  const [openTabName, setOpenTabName] = useState("");
  const [openTabGuests, setOpenTabGuests] = useState(2);
  const [openTabWaiter, setOpenTabWaiter] = useState("");

  // ── Cart ──────────────────────────────────────────────────────────────────
  const [cart, setCart] = useState<CartItem[]>([]);

  // ── Payment (table mode) ─────────────────────────────────────────────────
  // El método arranca en CASH_USD como sentinel pero NO se considera elegido
  // hasta que la cajera presione un botón (paymentMethodTouched=true). Hasta
  // entonces no se resalta visualmente, no se auto-aplica DIVISAS_33 y el
  // botón "Registrar pago" queda deshabilitado.
  const [paymentMethod, setPaymentMethod] = useState<SinglePayMethod>("CASH_USD");
  const [paymentMethodTouched, setPaymentMethodTouched] = useState(false);
  const [amountReceived, setAmountReceived] = useState("");
  const [showPaymentPinModal, setShowPaymentPinModal] = useState(false);
  const [paymentPin, setPaymentPin] = useState("");
  const [paymentPinError, setPaymentPinError] = useState("");

  // ── Payment (pickup mode) ────────────────────────────────────────────────
  const [isPickupMixedMode, setIsPickupMixedMode] = useState(false);
  const [mixedPaymentsPickup, setMixedPaymentsPickup] = useState<PaymentLine[]>([]);

  // ── Payment (table / salón mode) ─────────────────────────────────────────
  const [isTableMixedMode, setIsTableMixedMode] = useState(false);
  const [mixedPaymentsTable, setMixedPaymentsTable] = useState<PaymentLine[]>([]);

  // ── Descuento ─────────────────────────────────────────────────────────────
  const [discountType, setDiscountType] = useState<"NONE" | "DIVISAS_33" | "CORTESIA_100" | "CORTESIA_PERCENT">("NONE");
  const [authorizedManager, setAuthorizedManager] = useState<{ id: string; name: string } | null>(null);
  const [showCortesiaModal, setShowCortesiaModal] = useState(false);
  const [cortesiaPin, setCortesiaPin] = useState("");
  const [cortesiaPercent, setCortesiaPercent] = useState("100");
  const [cortesiaPinError, setCortesiaPinError] = useState("");

  // ── 10% Servicio — default ON; eximir requiere PIN de capitán o gerente ──
  const [serviceFeeIncluded, setServiceFeeIncluded] = useState(true);
  // % de servicio editable al cobro (§85). Default 10; string mientras se
  // tipea para permitir borrar/decimales sin resetear el input.
  const [serviceFeePercentStr, setServiceFeePercentStr] = useState("10");
  const serviceFeePercent = (() => {
    const n = parseFloat(serviceFeePercentStr);
    return Number.isFinite(n) && n >= 0 && n <= 100 ? n : 10;
  })();
  const serviceRate = serviceFeeIncluded ? serviceFeePercent / 100 : 0;
  const [skipServiceFeePin, setSkipServiceFeePin] = useState('');
  const [showSkipServiceFeeModal, setShowSkipServiceFeeModal] = useState(false);
  // Descuento por divisas configurable (§87). Cargado del server; default 1/3.
  const divisasPercent = useDivisasPercent();
  const divisasRate = divisasPercent / 100;
  const divisasPctLabel = (Math.round(divisasPercent * 100) / 100).toString();

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

  // ── Anular comanda completa (todos los ítems de una orden, un solo PIN) ──
  const [voidOrderTarget, setVoidOrderTarget] = useState<{
    orderId: string;
    itemCount: number;
    total: number;
  } | null>(null);
  const [voidOrderPin, setVoidOrderPin] = useState("");
  const [voidOrderReason, setVoidOrderReason] = useState("");
  const [voidOrderError, setVoidOrderError] = useState("");

  // ── Modifier modal ────────────────────────────────────────────────────────
  const [showModifierModal, setShowModifierModal] = useState(false);
  const [selectedItemForModifier, setSelectedItemForModifier] = useState<MenuItem | null>(null);
  const [currentModifiers, setCurrentModifiers] = useState<SelectedModifier[]>([]);
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemNotes, setItemNotes] = useState("");
  // §94: ids de InventoryItem marcados "SIN" en el modal actual.
  const [sinSelected, setSinSelected] = useState<string[]>([]);
  const [itemTakeaway, setItemTakeaway] = useState(false);

  // ── State flags ───────────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  // §113: encuesta de satisfacción tras cerrar la cuenta (omitible).
  const [surveyFor, setSurveyFor] = useState<{ openTabId: string; tabCode: string; tableName?: string; waiterName?: string } | null>(null);
  const [layoutError, setLayoutError] = useState("");

  const [mobileTab, setMobileTab] = useState<"tables" | "menu" | "account">("tables");
  const cartBadgeCount = cart.length;

  // ── Nueva Funcionalidad: Cajero y Pickup ──────────────────────────────────
  const [cashierName, setCashierName] = useState("");
  const [showChangeCashierModal, setShowChangeCashierModal] = useState(false);
  const [isPickupMode, setIsPickupMode] = useState(false);

  // ── Pickup Tabs (múltiples pickups simultáneos como mesas virtuales) ───────
  const [pickupTabs, setPickupTabs] = useState<PickupTabLocal[]>([]);
  const [activePickupTabId, setActivePickupTabId] = useState<string | null>(null);
  const [showPickupOpenModal, setShowPickupOpenModal] = useState(false);
  const [newPickupNumber, setNewPickupNumber] = useState("");
  const [newPickupName, setNewPickupName] = useState("");
  const [newPickupPhone, setNewPickupPhone] = useState("");
  const [newPickupTime, setNewPickupTime] = useState("");

  // ── Copia de consumos a portapapeles (envío por WhatsApp) ────────────────
  // Para que la cajera/mesonero pueda compartir los consumos en el grupo de
  // WhatsApp sin tener que reescribirlos. Persistimos por tab los IDs ya
  // copiados, así pulsar "Copiar" varias veces solo añade los ítems nuevos
  // (delta), evitando duplicar todo el pedido cada vez.
  const [copiedConsumoIds, setCopiedConsumoIds] = useState<Set<string>>(new Set());

  // En pickup el cart es local (CartItem[] sin ID estable), así que la dedupe
  // se hace por "cuántos ítems del carrito ya se copiaron". Si la cajera
  // borra un ítem y el carrito se encoge por debajo del contador, se
  // reinicia automáticamente.
  const [copiedPickupCount, setCopiedPickupCount] = useState(0);

  // ── Subcuentas ────────────────────────────────────────────────────────────
  const [subAccountMode, setSubAccountMode] = useState(false);
  const [subAccountsCount, setSubAccountsCount] = useState(0);
  const [pickupCustomerName, setPickupCustomerName] = useState("");
  // Teléfono opcional del cliente de pickup. Si se ingresa, el server enlaza
  // (o crea) la ficha en /dashboard/clientes (mismo upsert que delivery).
  const [pickupCustomerPhone, setPickupCustomerPhone] = useState("");
  const [checkoutTip, setCheckoutTip] = useState(''); // propina en el momento del cobro

  // ── Modal de comandas del día (reimpresión) ──────────────────────────────
  const [showComandasModal, setShowComandasModal] = useState(false);

  // ── Propina colectiva ─────────────────────────────────────────────────────
  const [showTipModal, setShowTipModal] = useState(false);
  const [tipAmount, setTipAmount] = useState('');
  const [tipMethod, setTipMethod] = useState<string>('CASH_USD');
  const [tipTableRef, setTipTableRef] = useState('');
  // Mesas cerradas de hoy (para vincular la propina colectiva a su correlativo).
  type ClosedTab = { id: string; tabCode: string; label: string; tableName: string | null; total: number; closedAt: string };
  const [closedTabs, setClosedTabs] = useState<ClosedTab[]>([]);
  const [tipSelectedTabCode, setTipSelectedTabCode] = useState<string>(''); // '' = otra/manual
  const [isTipProcessing, setIsTipProcessing] = useState(false);

  const [lastPickupOrder, setLastPickupOrder] = useState<{
    orderNumber: string;
    pickupNumber?: string;
    total: number;
    subtotal: number;
    discount: number;
    hideDiscount: boolean;
    items: { name: string; quantity: number; unitPrice: number; total: number; modifiers: string[] }[];
    customerName: string;
  } | null>(null);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  const loadData = async (showSpinner = true) => {
    if (showSpinner) setIsLoading(true);
    setLayoutError("");
    try {
      const [menuResult, layoutResult, usersResult, rate] = await Promise.all([
        getMenuForPOSAction({ channel: 'RESTAURANT' }),
        getRestaurantLayoutAction(),
        getUsersForTabAction(),
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
      if (usersResult.success && usersResult.data) {
        setUsers(usersResult.data);
      }
      setExchangeRate(rate);
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // ── Auto-polling: sincronización silenciosa del layout cada 15 s ─────────────
  // Solo refresca mesas/tabs y tasa — el menú se carga una sola vez en loadData().
  // Se omite si el tab está oculto (usuario cambió ventana) o hay una operación activa.
  const isProcessingRef = useRef(isProcessing);
  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);

  const pollLayout = useCallback(async () => {
    try {
      const [layoutResult, rate] = await Promise.all([
        getRestaurantLayoutAction(),
        getExchangeRateValue(),
      ]);
      if (layoutResult.success && layoutResult.data) {
        setLayout(layoutResult.data as SportBarLayout);
      }
      if (rate) setExchangeRate(rate);
    } catch {
      // Sin red durante poll: silencioso. El banner global cubre la UX.
      // No propagar — rompe la pantalla con "Application error".
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
    // Auto-aplicar / quitar el descuento del 33% según el método de pago.
    // - Sólo aplica cuando la cajera HA ELEGIDO un método (touched). De lo
    //   contrario el sentinel CASH_USD activaría DIVISAS_33 fantasma y la
    //   pre-cuenta saldría descontada antes de que la cajera escogiera nada.
    // - Si el método pasa a ser efectivo o Zelle (divisas) → aplica DIVISAS_33
    //   automáticamente (regla de negocio: cash siempre tiene 33% off).
    // - Si el método pasa a no-divisas → quita DIVISAS_33 (no aplica).
    // Sólo cambiamos cuando el discountType actual es NONE o DIVISAS_33;
    // si el cajero eligió CORTESIA, lo respetamos.
    if (!paymentMethodTouched) {
      if (discountType === 'DIVISAS_33') setDiscountType('NONE');
      return;
    }
    if (discountType !== 'NONE' && discountType !== 'DIVISAS_33') return;
    if (isDivisasMethod(paymentMethod)) {
      if (discountType !== 'DIVISAS_33') setDiscountType('DIVISAS_33');
    } else {
      if (discountType === 'DIVISAS_33') setDiscountType('NONE');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMethod, paymentMethodTouched, discountType]);

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

  // ── Auto-detección de subcuentas existentes ──────────────────────────────
  // Cuando el cajero abre una mesa con subcuentas creadas (típicamente por el
  // mesonero desde POS Mesero), entramos automáticamente al modo subcuentas
  // para que las vea sin tener que hacer click en "Dividir cuenta".
  // Si no hay subcuentas, permanece en cobro normal.
  useEffect(() => {
    if (!activeTab?.id) {
      setSubAccountsCount(0);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await getOpenTabWithSubAccountsAction(activeTab.id);
      if (cancelled) return;
      const subs = (res.data as any)?.subAccounts ?? [];
      setSubAccountsCount(subs.length);
      if (subs.length > 0) setSubAccountMode(true);
    })();
    return () => { cancelled = true; };
  }, [activeTab?.id]);

  // ── Sincronización de IDs ya copiados con localStorage por tab ────────────
  // Cargar el set persistido cada vez que cambia la cuenta activa: así la
  // dedupe sobrevive a recargas de página y a rebote entre mesas.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!activeTab?.id) {
      setCopiedConsumoIds(new Set());
      return;
    }
    try {
      const raw = window.localStorage.getItem(`posResto:copiedConsumos:${activeTab.id}`);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      setCopiedConsumoIds(new Set(ids));
    } catch {
      setCopiedConsumoIds(new Set());
    }
  }, [activeTab?.id]);

  const activePickupTab = useMemo(
    () => pickupTabs.find((t) => t.id === activePickupTabId) ?? null,
    [pickupTabs, activePickupTabId],
  );

  // ── Dedupe de copia para pickup tabs ──────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!activePickupTabId) {
      setCopiedPickupCount(0);
      return;
    }
    try {
      const raw = window.localStorage.getItem(`posResto:copiedPickupCount:${activePickupTabId}`);
      const n = raw ? parseInt(raw, 10) : 0;
      setCopiedPickupCount(Number.isFinite(n) && n >= 0 ? n : 0);
    } catch {
      setCopiedPickupCount(0);
    }
  }, [activePickupTabId]);

  const allMenuItems = useMemo(
    () => categories.flatMap((c) => (c.items || [])),
    [categories],
  );

  const filteredMenuItems = useMemo(() => {
    if (!productSearch.trim()) return menuItems;
    const q = productSearch.toLowerCase();
    return allMenuItems.filter((i) => i.name.toLowerCase().includes(q) || i.sku?.toLowerCase().includes(q));
  }, [menuItems, productSearch, allMenuItems]);

  // ── POS Hierarchical Navigation ───────────────────────────────────────────
  // Items after subcategory filter (used to compute groups + singles)
  const subcatFilteredItems = useMemo(() => {
    if (!selectedSubcategory) return menuItems;
    return menuItems.filter((i) => i.posSubcategory === selectedSubcategory);
  }, [menuItems, selectedSubcategory]);

  // Unique subcategory labels in current category
  const subcategories = useMemo(() => {
    const subcats = menuItems.map((i) => i.posSubcategory).filter(Boolean) as string[];
    return Array.from(new Set(subcats));
  }, [menuItems]);

  // Unique group labels after subcategory filter
  const groupsInView = useMemo(() => {
    const groups = subcatFilteredItems.map((i) => i.posGroup).filter(Boolean) as string[];
    return Array.from(new Set(groups));
  }, [subcatFilteredItems]);

  const cartTotal = cart.reduce((s, i) => s + i.lineTotal, 0);
  const rawAmount = parseFloat(amountReceived) || 0;
  /** Si el método es Bs (PDV, Móvil, Efectivo Bs) el input está en Bs → convertir a USD */
  const isBsPayMethod = BS_SINGLE_METHODS.has(paymentMethod);
  const paidAmount = isBsPayMethod && exchangeRate && rawAmount > 0
    ? rawAmount / exchangeRate
    : rawAmount;
  // Regla de negocio — redondeo por método:
  //   Divisas efectivo (CASH_USD, CASH_EUR, ZELLE): se redondea el monto a cobrar.
  //   Bolívares (CASH_BS, PDV_*, MOVIL_NG): sin redondeo — el monto Bs debe ser exacto.
  //   NUNCA redondear el precio base ni antes del descuento.
  // Con el flag `exactCashSaleTip`: redondea hacia ARRIBA (Math.ceil) — la venta
  // real queda exacta en el servidor y la diferencia se registra como propina.
  // Sin el flag (histórico): Math.round (puede subir o bajar, e infla la venta).
  const roundToWhole = (amount: number, method: string): number =>
    (method === 'CASH_USD' || method === 'CASH_EUR' || method === 'ZELLE')
      ? (featureFlags.exactCashSaleTip ? Math.ceil(amount) : Math.round(amount))
      : amount;
  // MESA — redondeo del cobro en divisas efectivo/zelle: SIEMPRE hacia arriba
  // al dólar entero (decisión del dueño 16/06). La diferencia (roundedCharge −
  // factura) se registra como PROPINA en handlePaymentPinConfirm, y el recibo
  // imprime ese mismo monto redondeado. Determinista (no depende de flags) para
  // que pantalla, recibo y registro muestren EXACTAMENTE el mismo número y el
  // arqueo cuadre. Antes usaba roundToWhole (Math.round con flag off) → podía
  // redondear hacia abajo y el recibo/registro quedaban por debajo de lo
  // cobrado (desfase reportado por la cajera).
  const roundDivisasChargeUp = (amount: number, method: string): number =>
    (method === 'CASH_USD' || method === 'CASH_EUR' || method === 'ZELLE')
      ? Math.ceil(amount)
      : amount;
  const isDivisasMethod = (m: string) => m === "CASH" || m === "CASH_USD" || m === "CASH_EUR" || m === "ZELLE";
  // isPagoDivisas: used by TABLE mode (registerOpenTabPaymentAction)
  const isPagoDivisas = isDivisasMethod(paymentMethod);
  // isPagoDivisasPickup: single mode → method CASH/ZELLE; mixed mode → at least one USD line
  const isPagoDivisasPickup = isPickupMixedMode
    ? mixedPaymentsPickup.some(p => isDivisasMethod(p.method))
    : isDivisasMethod(paymentMethod);
  const divisasUsdAmountPickup = isPickupMixedMode
    ? mixedPaymentsPickup.filter(p => isDivisasMethod(p.method)).reduce((s, p) => s + p.amountUSD, 0)
    : undefined;
  const totalMixedPickupPaid = mixedPaymentsPickup.reduce((s, p) => s + p.amountUSD, 0);

  // In TABLE mixed mode, only the divisas (CASH/CASH_USD/CASH_EUR/ZELLE) lines get the -33% discount
  const divisasUsdAmountTable = isTableMixedMode
    ? mixedPaymentsTable.filter(p => isDivisasMethod(p.method)).reduce((s, p) => s + p.amountUSD, 0)
    : 0;
  /** Suma total ingresada en el MixedPaymentSelector de mesa */
  const totalMixedTablePaid = mixedPaymentsTable.reduce((s, p) => s + p.amountUSD, 0);

  const cortesiaPercentNum = Math.min(100, Math.max(0, parseFloat(cortesiaPercent) || 0));

  // Descuento divisas en modo MIXTO: proporcional a las divisas tecleadas (no
  // circular sobre lo entregado). Misma función pura que el cobro de método
  // único; topa a balanceDue/3. Para mixto todo-divisas converge al precio
  // correcto; en divisas+Bs solo descuenta la porción en divisas. (fix TAB-3048)
  const mixedDivisasDiscount = activeTab && isTableMixedMode
    ? computeDivisasSettlement({ balanceDue: activeTab.balanceDue, receivedUSD: divisasUsdAmountTable, serviceFeeIncluded, serviceRate, discountRate: divisasRate }).discountAmount
    : 0;

  // §101: residuos de punto flotante (< 1¢) del descuento divisas se tratan
  // como saldo CERO — sin esto, roundDivisasChargeUp los inflaba a
  // "A cobrar $1.00" sobre una mesa ya saldada (caso TAB-3587).
  const effectiveBalanceDue = activeTab && activeTab.balanceDue >= 0.01 ? activeTab.balanceDue : 0;
  const paymentBaseAmount = activeTab
    ? discountType === "DIVISAS_33"
      ? isTableMixedMode
        ? effectiveBalanceDue - mixedDivisasDiscount        // partial: only USD lines get divisas discount
        : effectiveBalanceDue * (1 - divisasRate)           // full: entire balance con descuento divisas
      : discountType === "CORTESIA_100"
      ? 0
      : discountType === "CORTESIA_PERCENT"
      ? effectiveBalanceDue * (1 - cortesiaPercentNum / 100)
      : effectiveBalanceDue
    : 0;
  // En modo mixto NO se redondea: el target del MixedPaymentSelector debe ser el monto exacto
  // (PDV/Bs methods no se redondean; aplicar roundToWhole del single-method causaría underpay/overpay)
  const paymentAmountToCharge = isTableMixedMode
    ? paymentBaseAmount * (1 + serviceRate)
    : roundDivisasChargeUp(paymentBaseAmount * (1 + serviceRate), paymentMethod);

  // ============================================================================
  // OPEN TAB
  // ============================================================================

  const handleOpenTab = async () => {
    if (!selectedTable) return;
    setIsProcessing(true);
    try {
      const selectedWaiter = users.find((u) => u.id === openTabWaiter);
      const result = await openTabAction({
        tableOrStationId: selectedTable.id,
        customerLabel: openTabName.trim() || "Cliente",
        guestCount: openTabGuests,
        waiterLabel: selectedWaiter
          ? `${selectedWaiter.firstName} ${selectedWaiter.lastName}`
          : undefined,
      });
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      setShowOpenTabModal(false);
      setOpenTabName("");
      setOpenTabGuests(2);
      setOpenTabWaiter("");
      await loadData();
    } finally {
      setIsProcessing(false);
    }
  };

  // ============================================================================
  // CART & MODIFIERS
  // ============================================================================

  const handleAddToCart = (item: MenuItem) => {
    if (!activeTab && !isPickupMode) return;
    setSelectedItemForModifier(item);
    setCurrentModifiers([]);
    setItemQuantity(1);
    setItemNotes("");
    setItemTakeaway(false);
    setSinSelected([]);
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
        const others = currentModifiers.filter((m) => m.groupId !== group.id);
        // purge: al reemplazar la opción (radio) se limpian las selecciones
        // del sub-grupo de la opción anterior (§82).
        setCurrentModifiers(purgeChildSelections([
          ...others,
          {
            groupId: group.id,
            groupName: group.name,
            id: modifier.id,
            name: modifier.name,
            priceAdjustment: modifier.priceAdjustment,
            quantity: 1,
          },
        ], group));
        return;
      }
    }
    const newQty = currentQty + change;
    if (newQty < 0) return;
    let mods = [...currentModifiers];
    if (existing) {
      mods =
        newQty === 0
          ? mods.filter((m) => !(m.id === modifier.id && m.groupId === group.id))
          : mods.map((m) => (m.id === modifier.id && m.groupId === group.id ? { ...m, quantity: newQty } : m));
    } else if (newQty > 0) {
      mods.push({
        groupId: group.id,
        groupName: group.name,
        id: modifier.id,
        name: modifier.name,
        priceAdjustment: modifier.priceAdjustment,
        quantity: newQty,
      });
    }
    setCurrentModifiers(purgeChildSelections(mods, group));
  };

  /**
   * Maneja el toggle SIN/CON/NEUTRAL para un ingrediente agrupado.
   * Aplica mutua exclusión: si se elige SIN, des-selecciona el CON del mismo
   * ingrediente, y viceversa. NEUTRAL des-selecciona ambos.
   */
  const setIngredientToggleState = (
    group: ModifierGroup,
    toggle: IngredientToggle,
    target: 'SIN' | 'CON' | 'NEUTRAL',
  ) => {
    const sinId = toggle.sin?.id;
    const conId = toggle.con?.id;
    let mods = currentModifiers.filter((m) => {
      // Sacar SIEMPRE las entradas del par sin/con de este ingrediente.
      // Después agregamos solo la que corresponde al target.
      const isThisIngredient =
        m.groupId === group.id && ((sinId && m.id === sinId) || (conId && m.id === conId));
      return !isThisIngredient;
    });
    if (target === 'SIN' && toggle.sin) {
      mods.push({
        groupId: group.id,
        groupName: group.name,
        id: toggle.sin.id,
        name: toggle.sin.name,
        priceAdjustment: toggle.sin.priceAdjustment,
        quantity: 1,
      });
    } else if (target === 'CON' && toggle.con) {
      mods.push({
        groupId: group.id,
        groupName: group.name,
        id: toggle.con.id,
        name: toggle.con.name,
        priceAdjustment: toggle.con.priceAdjustment,
        quantity: 1,
      });
    }
    setCurrentModifiers(mods);
  };

  const isGroupValid = (group: ModifierGroup) => {
    if (!group.isRequired) return true;
    return (
      currentModifiers.filter((m) => m.groupId === group.id).reduce((s, m) => s + m.quantity, 0) >= group.minSelections
    );
  };

  const confirmAddToCart = () => {
    if (!selectedItemForModifier) return;
    if (!selectedItemForModifier.modifierGroups.every((g) => isGroupValid(g.modifierGroup))) return;
    if (!childGroupsValid(currentModifiers, selectedItemForModifier.modifierGroups.map((g) => g.modifierGroup))) return;
    const modTotal = currentModifiers.reduce((s, m) => s + m.priceAdjustment * m.quantity, 0);
    const lineTotal = (selectedItemForModifier.price + modTotal) * itemQuantity;
    const parentModIds = collectParentModifierIds(selectedItemForModifier.modifierGroups);
    const exploded = currentModifiers.flatMap((m) =>
      Array(m.quantity).fill({ modifierId: m.id, name: m.name, priceAdjustment: m.priceAdjustment, hideFromKitchen: parentModIds.has(m.id) }),
    );
    setCart((prev) => [
      ...prev,
      {
        menuItemId: selectedItemForModifier.id,
        name: selectedItemForModifier.name,
        quantity: itemQuantity,
        unitPrice: selectedItemForModifier.price,
        modifiers: [...exploded, ...buildSinCartModifiers(selectedItemForModifier.sinIngredients, sinSelected)],
        notes: itemNotes || undefined,
        lineTotal,
        takeaway: itemTakeaway || undefined,
      },
    ]);
    setShowModifierModal(false);
  };

  // ============================================================================
  // SEND TO TAB
  // ============================================================================

  const handleSendToTab = async () => {
    if (!activeTab || cart.length === 0) return;
    setIsProcessing(true);
    try {
      const result = await addItemsToOpenTabAction({ openTabId: activeTab.id, items: cart });
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      if (result.data?.kitchenStatus === "SENT") {
        const menuItemCategoryMap = buildMenuItemCategoryMap(categories);
        void enqueueKitchenCommand({
          type: "KITCHEN",
          orderNumber: result.data.orderNumber,
          dailyLabel: (result.data as { dailyLabel?: string | null }).dailyLabel ?? undefined,
          orderType: "RESTAURANT",
          orderTypeLabel: "MESA",
          tabCode: activeTab.tabCode,
          tableName: selectedTable?.name ?? null,
          waiterName: activeTab.waiterLabel || null,
          customerName: activeTab.customerLabel || null,
          items: buildKitchenItems(cart, menuItemCategoryMap),
          createdAt: new Date().toISOString(),
        });
      }
      setCart([]);
      await loadData();
    } finally {
      setIsProcessing(false);
    }
  };

  // ============================================================================
  // RESET TABLE STATE — limpia estado dependiente de la mesa activa
  // Llamar al cambiar de mesa, zona o modo pickup para evitar contaminación
  // ============================================================================

  const resetTableState = () => {
    setCart([]);
    setDiscountType("NONE");
    setAuthorizedManager(null);
    setMixedPaymentsTable([]);
    setIsTableMixedMode(false);
    setCortesiaPercent("100");
    setAmountReceived("");
    setSubAccountMode(false);
    setCheckoutTip("");
    setPaymentMethodTouched(false);
    // §100.1: el estado del servicio era PEGAJOSO entre mesas — si se eximía
    // (o se editaba el %) en una mesa, las pre-cuentas de TODAS las mesas
    // siguientes salían sin servicio (caso TAB-3567/3583). La exención es
    // por mesa: cada mesa arranca con servicio ON al 10%.
    setServiceFeeIncluded(true);
    setServiceFeePercentStr("10");
    setSkipServiceFeePin('');
  };

  // ============================================================================
  // PICKUP TABS — Gestión de múltiples pickups simultáneos
  // ============================================================================

  /** Guarda el carrito actual en el pickup tab activo antes de cambiar de contexto */
  const saveActivePickupCart = (currentCart: CartItem[]) => {
    if (!activePickupTabId) return;
    setPickupTabs((prev) =>
      prev.map((t) => (t.id === activePickupTabId ? { ...t, cart: currentCart } : t)),
    );
  };

  /** Abre el modal para crear un nuevo pickup tab.
   *  Consulta el backend para obtener el número de pickup secuencial del día. */
  const openPickupModal = async () => {
    setNewPickupNumber("PK-…");   // placeholder mientras carga
    setNewPickupName("");
    setNewPickupPhone("");
    setNewPickupTime("");
    setShowPickupOpenModal(true);
    // Pasar los números de los tabs abiertos en memoria para que la action
    // pueda buscar el primer hueco combinando BD + estado local.
    const openNumbers = pickupTabs.map((t) => t.pickupNumber);
    const res = await getDailyPickupCountAction(openNumbers);
    setNewPickupNumber(res.nextNumber);
  };

  /** Confirma creación de un nuevo pickup tab */
  const handleCreatePickupTab = () => {
    // Guardar carrito del tab activo antes de cambiar
    if (isPickupMode && activePickupTabId) {
      saveActivePickupCart(cart);
    }
    const newTab: PickupTabLocal = {
      id: crypto.randomUUID(),
      pickupNumber: newPickupNumber.trim() || `PK-${(pickupTabs.length + 1).toString().padStart(2, "0")}`,
      customerName: newPickupName.trim(),
      customerPhone: newPickupPhone.trim(),
      scheduledTime: newPickupTime.trim(),
      cart: [],
    };
    setPickupTabs((prev) => [...prev, newTab]);
    setActivePickupTabId(newTab.id);
    setPickupCustomerName(newTab.customerName);
    setPickupCustomerPhone(newTab.customerPhone);
    setCart([]);
    setDiscountType("NONE");
    setAuthorizedManager(null);
    // Limpiar monto y propina al abrir nuevo tab — evita arrastre entre tabs
    setAmountReceived("");
    setCheckoutTip("");
    setIsPickupMixedMode(false);
    setMixedPaymentsPickup([]);
    setIsPickupMode(true);
    setPaymentMethodTouched(false);
    setSelectedTableId("");
    setSelectedZoneId("");
    setShowPickupOpenModal(false);
  };

  /** Cambia al pickup tab seleccionado, guardando el carrito del activo */
  const handleSelectPickupTab = (tabId: string) => {
    if (activePickupTabId === tabId) return;
    // Guardar carrito actual
    if (isPickupMode && activePickupTabId) {
      saveActivePickupCart(cart);
    }
    const tab = pickupTabs.find((t) => t.id === tabId);
    if (!tab) return;
    setCart(tab.cart);
    setActivePickupTabId(tabId);
    setPickupCustomerName(tab.customerName);
    setPickupCustomerPhone(tab.customerPhone);
    setDiscountType("NONE");
    setAuthorizedManager(null);
    // Limpiar monto y propina al cambiar de tab — evita arrastre entre tabs
    setAmountReceived("");
    setCheckoutTip("");
    setIsPickupMixedMode(false);
    setMixedPaymentsPickup([]);
    setIsPickupMode(true);
    setPaymentMethodTouched(false);
    setSelectedTableId("");
    setSelectedZoneId("");
  };

  /** Elimina un pickup tab (sin cobrar — descartado) */
  const handleDiscardPickupTab = (tabId: string) => {
    try { window.localStorage.removeItem(`posResto:copiedPickupCount:${tabId}`); } catch {}
    const remaining = pickupTabs.filter((t) => t.id !== tabId);
    setPickupTabs(remaining);
    if (activePickupTabId === tabId) {
      if (remaining.length > 0) {
        const next = remaining[remaining.length - 1];
        setCart(next.cart);
        setActivePickupTabId(next.id);
        setPickupCustomerName(next.customerName);
        setPickupCustomerPhone(next.customerPhone);
      } else {
        setActivePickupTabId(null);
        setIsPickupMode(false);
        resetTableState();
      }
    }
  };

  // ============================================================================
  // CORTESIA AUTH
  // ============================================================================

  const openCortesiaModal = () => {
    setCortesiaPin("");
    setCortesiaPinError("");
    setCortesiaPercent("100");
    setShowCortesiaModal(true);
  };

  const handleCortesiaPinKey = (k: string) => {
    if (k === "clear") setCortesiaPin("");
    else if (k === "back") setCortesiaPin((p) => p.slice(0, -1));
    else setCortesiaPin((p) => p + k);
  };

  const handleCortesiaPinConfirm = async () => {
    setCortesiaPinError("");
    const r = await validateManagerPinAction(cortesiaPin);
    if (r.success && r.data) {
      setAuthorizedManager({ id: r.data.managerId, name: r.data.managerName });
      const pct = parseFloat(cortesiaPercent);
      if (pct >= 100) {
        setDiscountType("CORTESIA_100");
      } else {
        setDiscountType("CORTESIA_PERCENT");
      }
      setShowCortesiaModal(false);
    } else {
      setCortesiaPinError("PIN inválido");
    }
  };

  const clearDiscount = () => {
    setDiscountType("NONE");
    setAuthorizedManager(null);
    setCortesiaPercent("100");
  };

  // ============================================================================
  // PAYMENT (requiere PIN de cajera)
  // ============================================================================

  const handlePaymentPinConfirm = async () => {
    // Monto BRUTO recibido del cliente (mixto = suma de líneas).
    const rawReceived = isTableMixedMode
      ? mixedPaymentsTable.reduce((s, p) => s + p.amountUSD, 0)
      : paidAmount; // paidAmount already in USD (Bs methods auto-converted above)
    if (!activeTab || rawReceived <= 0) return;
    setPaymentPinError("");
    setIsProcessing(true);
    try {
      const pinResult = await validateManagerPinAction(paymentPin);
      if (!pinResult.success) {
        setPaymentPinError("PIN incorrecto o sin permisos de cajera");
        return;
      }
      let discountAmount = 0;
      let discountLabel = "";
      // Cobro divisas de método único: liquidación PROPORCIONAL a lo cobrado
      // (no al saldo total). null salvo en ese caso. Ver divisas-settlement.ts.
      let divisasSettlement: DivisasSettlement | null = null;
      // SAFEGUARD: DIVISAS_33 SOLO aplica si el método realmente es divisas
      // (cash USD/EUR/Zelle). Sin esto, un cambio rápido de método de pago
      // (USD → Bs) puede dejar el discountType en DIVISAS_33 antes que el
      // useEffect lo resetee, y el cobro aplicaría el 33% a un pago en Bs.
      // Bug reportado por cajera: cuenta en Bs cobrada con -33%.
      const divisasQualifies =
        isTableMixedMode
          ? mixedPaymentsTable.some(p => isDivisasMethod(p.method))
          : isDivisasMethod(paymentMethod);
      if (discountType === "DIVISAS_33" && divisasQualifies) {
        if (isTableMixedMode) {
          discountAmount = mixedDivisasDiscount;
          discountLabel = ` · Divisas sobre $${divisasUsdAmountTable.toFixed(2)}`;
        } else {
          // −33,33% PROPORCIONAL a lo cobrado en este pago. En pago completo da
          // idéntico a balanceDue/3; en parcial evita el sobre-descuento (TAB-3048).
          divisasSettlement = computeDivisasSettlement({
            balanceDue: activeTab.balanceDue,
            receivedUSD: rawReceived,
            serviceFeeIncluded,
            serviceRate,
            discountRate: divisasRate,
          });
          discountAmount = divisasSettlement.discountAmount;
          discountLabel = ` · -${divisasPctLabel}% Divisas`;
        }
      } else if (discountType === "CORTESIA_100") {
        discountAmount = activeTab.balanceDue;
        discountLabel = " · Cortesía 100%";
      } else if (discountType === "CORTESIA_PERCENT") {
        discountAmount = activeTab.balanceDue * (cortesiaPercentNum / 100);
        discountLabel = ` · Cortesía ${cortesiaPercentNum}%`;
      }
      const effectiveMethod = isTableMixedMode
        ? (mixedPaymentsTable.length === 1 ? mixedPaymentsTable[0].method as typeof paymentMethod : "CASH_USD")
        : paymentMethod;
      const effectiveLabel = isTableMixedMode
        ? `Pago Mixto${discountLabel} – ${pinResult.data?.managerName || ""}`
        : `${PAYMENT_LABELS[paymentMethod] || paymentMethod}${discountLabel} – ${pinResult.data?.managerName || ""}`;
      // Razón del descuento — sólo se setea cuando discountAmount > 0 (es
      // decir, cuando el descuento realmente aplica tras el safeguard
      // divisasQualifies). Esto evita que un DIVISAS_33 "fantasma" llegue al
      // backend cuando el método es Bs.
      const discountReasonText = discountAmount > 0
        ? (discountType === "DIVISAS_33"
            ? (isTableMixedMode && divisasUsdAmountTable > 0 && divisasUsdAmountTable < activeTab.balanceDue - 0.01
                ? `Pago Mixto Divisas (${divisasPctLabel}% sobre $${divisasUsdAmountTable.toFixed(2)})`
                : `Pago en Divisas (${divisasPctLabel}%)`)
            : discountType === "CORTESIA_100"
              ? "Cortesía Autorizada (100%)"
              : discountType === "CORTESIA_PERCENT"
                ? `Cortesía Autorizada (${cortesiaPercentNum}%)`
                : undefined)
        : undefined;
      const effectiveDiscountType = discountAmount > 0 && discountType !== "NONE"
        ? discountType
        : undefined;

      // ── PROPINA Y MONTO RETENIDO (§46 — fix definitivo TAB-2433) ──────────
      // Factura real (post-descuento) = total antes de servicio + 10% servicio.
      // En divisas proporcional, el neto y el servicio salen de la liquidación
      // (sobre la porción pagada), NO del saldo total menos el descuento.
      const totalAntesServicio = divisasSettlement
        ? divisasSettlement.netItemsApplied
        : Math.max(0, activeTab.balanceDue - discountAmount);
      const serviceFee = divisasSettlement
        ? divisasSettlement.serviceFee
        : totalAntesServicio * serviceRate;
      // ── REDONDEO → PROPINA (divisas efectivo/zelle) ──────────────────────
      // El POS le dice a la cajera cobrar el dólar entero hacia arriba
      // (roundDivisasChargeUp == paymentAmountToCharge). Esa diferencia debe
      // quedar registrada como propina para que el RECIBO, el SISTEMA y lo
      // COBRADO coincidan (decisión del dueño 16/06). En mixto el target es
      // exacto → sin redondeo. El cap por excedente real lo respeta todo: si el
      // cliente pagó justo (ej. Zelle por el monto exacto sin redondear), no se
      // inventa propina de redondeo.
      const facturaReal = totalAntesServicio + serviceFee;
      const roundingTip = roundingTipForCharge({
        facturaReal,
        paymentMethod: effectiveMethod,
        isMixed: isTableMixedMode,
      });
      // Propina = max(propina del mesero/cajera, delta de redondeo), capada al
      // excedente realmente recibido (no se inventa propina sobre lo no pagado).
      const tipVal = cappedTipForPayment({
        intendedTip: Math.max(parseFloat(checkoutTip) || 0, roundingTip),
        amountPaid: rawReceived,
        totalAntesServicio,
        serviceFee,
      });
      // El split registra el monto RETENIDO (factura + propina), no el bruto:
      // así el excedente del split == propina real (que historial y Z report ya
      // cuentan UNA vez) y el vuelto en efectivo no se cuenta como propina. NO
      // se crea propina colectiva aparte → se elimina el doble-conteo/fantasma.
      // En mixto aplicamos el mismo cap: si la suma de líneas supera factura+tip
      // (típicamente por error de tecleo: cliente paga $25, cajera teclea $30),
      // NO inflamos el cobro. Sin esto, el bug raíz de TAB-2433 reaparece en mixto.
      const effectiveAmount = keptAmountForSplit({
        amountPaid: rawReceived,
        totalAntesServicio,
        serviceFee,
        tip: tipVal,
      });

      // §100.2 — Confirmación explícita de PROPINA MANUAL (caso TAB-3587: $1
      // tipeado en el campo → la cajera entregó el vuelto completo y la caja
      // quedó descuadrada). Solo aplica a propina tipeada por encima del
      // redondeo automático de divisas (ese es política del 16/06, rutina, y
      // no debe generar fricción en cada cobro).
      const manualTipTyped = parseFloat(checkoutTip) || 0;
      if (tipVal > 0.009 && manualTipTyped > roundingTip + 0.009) {
        const vueltoConPropina = Math.max(0, rawReceived - facturaReal - tipVal);
        const vueltoSinPropina = Math.max(0, rawReceived - facturaReal);
        const okTip = window.confirm(
          `Estás registrando $${tipVal.toFixed(2)} de PROPINA.\n\n` +
          `El vuelto a entregar es $${vueltoConPropina.toFixed(2)} (NO $${vueltoSinPropina.toFixed(2)}).\n\n` +
          `Si el cliente pide su vuelto completo, cancelá y borrá la propina antes de cobrar.`
        );
        if (!okTip) return;
      }

      // §103 — Sobrante en pago MIXTO: las líneas superan la factura+propina.
      // En single-cash el exceso es el vuelto físico; en mixto cada línea se
      // cobró de verdad (PDV/Zelle) → un exceso quedaría cobrado y SIN
      // registrar. Confirmación explícita antes de descartar.
      if (isTableMixedMode && rawReceived > facturaReal + tipVal + 0.05) {
        const sobrante = rawReceived - facturaReal - tipVal;
        const okExceso = window.confirm(
          `Las líneas de pago suman $${rawReceived.toFixed(2)} pero la factura es $${(facturaReal + tipVal).toFixed(2)}.\n\n` +
          `El sobrante de $${sobrante.toFixed(2)} NO quedará registrado en el sistema.\n\n` +
          `Si es un error de tecleo, cancelá y corregí las líneas.`
        );
        if (!okExceso) return;
      }

      // §103 — `amount` SIEMPRE lleva el NETO de ítems (el server le suma el
      // servicio encima). Antes, en cobros no-divisas se mandaba el BRUTO
      // (effectiveAmount, con servicio) y en PARCIALES el server lo restaba
      // del balance de ítems y re-sumaba el 10% → la casa perdía ~el servicio
      // de cada porción (mesa $110 en dos mitades cobraba $104.50). El dinero
      // retenido real (factura + propina) viaja en paidAmountOverride.
      const netItemsForServer = divisasSettlement
        ? divisasSettlement.netItemsApplied
        : netItemsPortionForPayment({
            amountPaid: rawReceived,
            totalAntesServicio,
            serviceFee,
            serviceRate: serviceFeeIncluded ? serviceRate : 0,
          });
      const result = await registerOpenTabPaymentAction({
        openTabId: activeTab.id,
        amount: netItemsForServer,
        paidAmountOverride: effectiveAmount,
        paymentMethod: effectiveMethod,
        splitLabel: effectiveLabel,
        discountAmount: discountAmount > 0 ? discountAmount : undefined,
        discountType: effectiveDiscountType,
        discountReason: discountReasonText,
        serviceFeeIncluded,
        serviceFeePercent,
        skipServiceFeeAuthPin: !serviceFeeIncluded ? skipServiceFeePin : undefined,
      });
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      // Imprimir factura: correlativo fijo por mesa (tabCode), 10% servicio solo si el cliente lo pagó.
      // La propina (tipVal) YA quedó registrada en el split como excedente del
      // monto retenido — NO se crea propina colectiva aparte (eso doble-contaba
      // y generaba fantasmas, §46). El recibo solo la muestra para el cliente.
      const subtotal = activeTab.runningTotal;
      const discount = discountAmount > 0 ? discountAmount : ((activeTab as any).runningDiscount ?? 0);
      const allItems = activeTab.orders.flatMap((o) =>
        (o.items || []).map((i: any) => ({
          name: i.itemName,
          quantity: i.quantity,
          unitPrice: (i.lineTotal || 0) / (i.quantity || 1),
          total: i.lineTotal || 0,
          modifiers: (i.modifiers || []).filter((m: any) => !m?.hideFromKitchen).map((m: any) => m.name),
        }))
      );
      if (getPOSConfig().printReceiptOnRestaurant) {
      emitReceipt({
        orderNumber: activeTab.tabCode,
        orderType: "RESTAURANT",
        date: new Date(),
        cashierName: cashierName || pinResult.data?.managerName || "Cajera",
        customerName: activeTab.customerLabel,
        tableLabel: selectedTable?.name,
        items: allItems,
        subtotal,
        discount,
        hideDiscount: discountType === "DIVISAS_33",
        discountReason: discountType === "CORTESIA_100" ? 'Cortesía Autorizada (100%)'
            : discountType === "CORTESIA_PERCENT" ? `Cortesía Autorizada (${cortesiaPercentNum}%)`
            : undefined,
        total: totalAntesServicio,
        serviceFee,
        serviceFeePercent: serviceFeeIncluded ? serviceFeePercent : undefined,
        tipAmount: tipVal > 0 ? tipVal : undefined,
        branding,
      });
      }
      setAmountReceived("");
      setPaymentPin("");
      setCheckoutTip('');
      clearDiscount();
      setShowPaymentPinModal(false);
      setIsTableMixedMode(false);
      setMixedPaymentsTable([]);
      setPaymentMethodTouched(false);
      await loadData();
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Imprime la pre-cuenta (documento informativo previo al cobro).
   *
   * @param withDivisasDiscount Si true, aplica el descuento del 33% por
   *   pago en divisas. Default false — la pre-cuenta normal muestra el
   *   monto pleno (sin descuento de divisas) para que el cliente vea el
   *   costo real del consumo. La cajera invoca con `true` cuando el
   *   cliente pide explícitamente ver el monto con el beneficio de divisas
   *   aplicado (botón separado "Pre-cuenta c/ desc divisas").
   *
   * Nota: las cortesías autorizadas (CORTESIA_100, CORTESIA_PERCENT)
   * siempre se reflejan independientemente de este flag — son información
   * que el cliente debe ver en ambos casos.
   */
  const handlePrintPrecuenta = (withDivisasDiscount: boolean = false) => {
    if (!activeTab) return;
    const allItems = activeTab.orders.flatMap((order) =>
      (order.items || []).map((item) => ({
        name: item.itemName,
        quantity: item.quantity,
        unitPrice: item.lineTotal / Math.max(1, item.quantity),
        total: item.lineTotal,
        modifiers: ((item as any).modifiers || [])
          .filter((m: any) => typeof m === "string" || !m?.hideFromKitchen)
          .map((m: any) => (typeof m === "string" ? m : m?.name))
          .filter(Boolean) as string[],
      }))
    );
    // Use runningTotal as base — balanceDue decrements with partial payments, causing
    // a false "discount" line when items sum doesn't match the printed subtotal.
    const base = activeTab.runningTotal;
    const divisasDiscountAmt = withDivisasDiscount ? base * divisasRate : 0;
    const discountAmt =
      withDivisasDiscount ? divisasDiscountAmt
      : discountType === "CORTESIA_100" ? base
      : discountType === "CORTESIA_PERCENT" ? base * (cortesiaPercentNum / 100)
      : 0;
    const afterDiscount = base - discountAmt;
    const svcFee = afterDiscount * serviceRate;
    const discountReason = discountAmt > 0
      ? (withDivisasDiscount ? `Pago en Divisas (${divisasPctLabel}%)`
          : discountType === "CORTESIA_100" ? "Cortesía Autorizada (100%)"
          : discountType === "CORTESIA_PERCENT" ? `Cortesía Autorizada (${cortesiaPercentNum}%)`
          : undefined)
      : undefined;
    emitReceipt({
      orderNumber: activeTab.tabCode,
      orderType: "RESTAURANT",
      date: new Date(),
      cashierName: cashierName || "Cajera",
      customerName: activeTab.customerLabel || undefined,
      customerPhone: activeTab.customerPhone || undefined,
      tableLabel: selectedTable?.name,
      items: allItems,
      subtotal: base,
      discount: discountAmt > 0 ? discountAmt : undefined,
      discountReason,
      serviceFee: svcFee > 0 ? svcFee : undefined,
      serviceFeePercent: serviceFeeIncluded ? serviceFeePercent : undefined,
      // §100.1: nunca omitir el servicio en silencio — si está eximido, el
      // papel lo dice explícito (evita "la pre-cuenta no traía el servicio").
      serviceFeeExempt: !serviceFeeIncluded,
      total: afterDiscount,  // printReceipt suma serviceFee internamente para el total final
      isPrecuenta: true,
      branding,
    });
  };

  const handleCloseTab = async () => {
    if (!activeTab) return;
    const balance = Number(activeTab.balanceDue ?? 0);
    if (balance > 0.01) {
      toast.error("La cuenta aún tiene saldo pendiente");
      return;
    }
    if (!confirm("¿Cerrar esta cuenta?")) return;
    setIsProcessing(true);
    try {
      // §113: capturar datos de la mesa ANTES de limpiar el estado, para la
      // encuesta de satisfacción (se muestra tras el cierre, es omitible).
      const surveyContext = {
        openTabId: activeTab.id,
        tabCode: activeTab.tabCode,
        tableName: selectedTable?.name,
        waiterName: (activeTab as any).waiterLabel || undefined,
      };
      const result = await closeOpenTabAction(activeTab.id);
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      // Limpiar dedupe local: la cuenta ya no existe.
      try { window.localStorage.removeItem(`posResto:copiedConsumos:${activeTab.id}`); } catch {}
      await loadData();
      setSelectedTableId("");
      // Mostrar la encuesta al final — el cobro y el cierre ya ocurrieron, no
      // los interfiere. Solo para servicio de mesa (no bar tabs de paso).
      setSurveyFor(surveyContext);
    } finally {
      setIsProcessing(false);
    }
  };

  // ============================================================================
  // COPIAR CONSUMOS AL PORTAPAPELES (envío por WhatsApp)
  // ============================================================================

  const formatConsumosForClipboard = (
    items: { quantity: number; itemName: string; modifiers?: { name: string }[] | null }[],
  ): string => {
    const header = `Mesa ${selectedTable?.name ?? activeTab?.tabCode ?? ""}${activeTab?.waiterLabel ? ` — ${activeTab.waiterLabel}` : ""}`;
    const lines = [header.trim()];
    for (const it of items) {
      lines.push(`${it.quantity}× ${it.itemName}`);
      const mods = (it.modifiers ?? []).map((m) => m.name).filter(Boolean);
      if (mods.length > 0) lines.push(`   ${mods.join(" · ")}`);
    }
    return lines.join("\n");
  };

  const persistCopiedIds = (tabId: string, ids: Set<string>) => {
    try {
      window.localStorage.setItem(`posResto:copiedConsumos:${tabId}`, JSON.stringify(Array.from(ids)));
    } catch {
      // Silencioso: si falla localStorage la dedupe igual funciona en memoria.
    }
  };

  /** Copia solo los ítems agregados desde la última vez que se copió esta cuenta. */
  const handleCopyNewConsumos = async () => {
    if (!activeTab) return;
    const allItems = activeTab.orders.flatMap((o) => o.items);
    const nuevos = allItems.filter((it) => !copiedConsumoIds.has(it.id));
    if (nuevos.length === 0) {
      toast("No hay consumos nuevos para copiar");
      return;
    }
    const text = formatConsumosForClipboard(nuevos);
    try {
      await navigator.clipboard.writeText(text);
      const next = new Set(copiedConsumoIds);
      for (const it of nuevos) next.add(it.id);
      setCopiedConsumoIds(next);
      persistCopiedIds(activeTab.id, next);
      toast.success(`${nuevos.length} consumo${nuevos.length === 1 ? "" : "s"} copiado${nuevos.length === 1 ? "" : "s"}`);
    } catch {
      toast.error("No se pudo copiar al portapapeles");
    }
  };

  /** Copia todos los consumos cargados de la cuenta y reinicia la dedupe. */
  const handleCopyAllConsumos = async () => {
    if (!activeTab) return;
    const allItems = activeTab.orders.flatMap((o) => o.items);
    if (allItems.length === 0) {
      toast("La cuenta no tiene consumos cargados");
      return;
    }
    const text = formatConsumosForClipboard(allItems);
    try {
      await navigator.clipboard.writeText(text);
      const next = new Set(allItems.map((it) => it.id));
      setCopiedConsumoIds(next);
      persistCopiedIds(activeTab.id, next);
      toast.success(`${allItems.length} consumo${allItems.length === 1 ? "" : "s"} copiado${allItems.length === 1 ? "" : "s"}`);
    } catch {
      toast.error("No se pudo copiar al portapapeles");
    }
  };

  // ── Copia en pickup mode ──────────────────────────────────────────────────
  const formatPickupCartForClipboard = (items: CartItem[]): string => {
    const headerParts: string[] = [];
    if (activePickupTab?.pickupNumber) headerParts.push(activePickupTab.pickupNumber);
    const customer = (pickupCustomerName || activePickupTab?.customerName || "").trim();
    if (customer) headerParts.push(customer);
    const header = headerParts.length > 0 ? `Pickup ${headerParts.join(" — ")}` : "Pickup";
    const lines = [header];
    for (const it of items) {
      const takeaway = it.takeaway ? " (Para llevar)" : "";
      lines.push(`${it.quantity}× ${it.name}${takeaway}`);
      const mods = (it.modifiers ?? []).map((m) => m.name).filter(Boolean);
      if (mods.length > 0) lines.push(`   ${mods.join(" · ")}`);
      if (it.notes && it.notes.trim()) lines.push(`   Nota: ${it.notes.trim()}`);
    }
    return lines.join("\n");
  };

  const persistPickupCopiedCount = (tabId: string, count: number) => {
    try {
      window.localStorage.setItem(`posResto:copiedPickupCount:${tabId}`, String(count));
    } catch {
      // Silencioso.
    }
  };

  const handleCopyNewPickup = async () => {
    if (!activePickupTabId) return;
    // Si el cart encogió por debajo del contador (la cajera borró ítems),
    // reiniciamos: lo que quede en cart pasa a considerarse "nuevo".
    const safeCount = cart.length < copiedPickupCount ? 0 : copiedPickupCount;
    const nuevos = cart.slice(safeCount);
    if (nuevos.length === 0) {
      toast("No hay consumos nuevos para copiar");
      return;
    }
    const text = formatPickupCartForClipboard(nuevos);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPickupCount(cart.length);
      persistPickupCopiedCount(activePickupTabId, cart.length);
      toast.success(`${nuevos.length} consumo${nuevos.length === 1 ? "" : "s"} copiado${nuevos.length === 1 ? "" : "s"}`);
    } catch {
      toast.error("No se pudo copiar al portapapeles");
    }
  };

  const handleCopyAllPickup = async () => {
    if (!activePickupTabId) return;
    if (cart.length === 0) {
      toast("El carrito está vacío");
      return;
    }
    const text = formatPickupCartForClipboard(cart);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPickupCount(cart.length);
      persistPickupCopiedCount(activePickupTabId, cart.length);
      toast.success(`${cart.length} consumo${cart.length === 1 ? "" : "s"} copiado${cart.length === 1 ? "" : "s"}`);
    } catch {
      toast.error("No se pudo copiar al portapapeles");
    }
  };

  // ============================================================================
  // CHECKOUT PICKUP
  // ============================================================================

  // Abre el modal de propina colectiva y carga las mesas cerradas de hoy
  // para poder vincular la propina a su correlativo.
  const openCollectiveTipModal = async () => {
    setShowTipModal(true);
    setTipSelectedTabCode('');
    setTipTableRef('');
    try {
      const res = await getClosedTabsTodayAction();
      if (res.success && Array.isArray(res.data)) setClosedTabs(res.data as ClosedTab[]);
    } catch { /* el modal sigue usable con referencia manual */ }
  };

  const handleRecordTip = async () => {
    const amount = parseFloat(tipAmount);
    if (!amount || amount <= 0) return;
    // Debe indicarse de qué mesa fue: una mesa cerrada o una referencia manual.
    const selectedTab = closedTabs.find(t => t.tabCode === tipSelectedTabCode);
    const manualRef = tipTableRef.trim();
    if (!selectedTab && !manualRef) {
      toast.error('Indica de qué mesa es la propina (elige una mesa cerrada o escribe la referencia).');
      return;
    }
    setIsTipProcessing(true);
    try {
      // Etiqueta legible + correlativo vinculado (si se eligió una mesa).
      const refLabel = selectedTab
        ? `${selectedTab.label} · ${selectedTab.tabCode}`
        : manualRef;
      const note = `Propina colectiva — Mesa/Ref: ${refLabel}`;
      const relatedTabCode = selectedTab?.tabCode;
      const isBsMethod = ['CASH_BS', 'PDV_SHANKLISH', 'PDV_SUPERFERRO', 'MOVIL_NG'].includes(tipMethod);
      // Si el monto está en Bs, convertir a USD antes de guardar en BD
      const tipAmountUSD = isBsMethod && exchangeRate ? Math.round(amount / exchangeRate * 100) / 100 : amount;
      const result = await recordCollectiveTipAction({ tipAmount: tipAmountUSD, paymentMethod: tipMethod, note, relatedTabCode });
      if (result.success) {
        const displayStr = isBsMethod
          ? `Bs ${amount.toFixed(2)} ($${tipAmountUSD.toFixed(2)}) registrada`
          : `$${amount.toFixed(2)} registrada`;
        toast.success(`Propina de ${displayStr}`);
        setShowTipModal(false);
        setTipAmount('');
        setTipMethod('CASH_USD');
        setTipTableRef('');
        setTipSelectedTabCode('');
      } else {
        toast.error(result.message || 'Error al registrar propina');
      }
    } finally {
      setIsTipProcessing(false);
    }
  };

  const handleCheckoutPickup = async () => {
    if (cart.length === 0) return;
    setIsProcessing(true);
    try {
      // Snapshot del tab activo tomado antes de cualquier await — el estado puede
      // cambiar durante la operación asíncrona (p.ej. otro tab se cierra).
      const activeTabSnap = pickupTabs.find((t) => t.id === activePickupTabId);

      const rc = (n: number) => Math.round(n * 100) / 100;
      // SAFEGUARD: igual que el handlePayment de table — DIVISAS_33 sólo
      // aplica si el método ACTUAL al click es divisas. Bloquea race
      // condition al cambiar rápido USD → Bs antes que useEffect resetee
      // discountType. Bug reportado: pickup en Bs cobrado con -33%.
      const pickupDivisasQualifies = isPickupMixedMode
        ? mixedPaymentsPickup.some(p => isDivisasMethod(p.method))
        : isDivisasMethod(paymentMethod);
      const pickupDiscount = (discountType === "DIVISAS_33" && pickupDivisasQualifies)
        ? rc(isPickupMixedMode && divisasUsdAmountPickup != null
            ? divisasUsdAmountPickup * divisasRate  // partial: solo la porción divisas
            : cartTotal * divisasRate)              // full: toda la orden en divisas
        : discountType === "CORTESIA_100" ? rc(cartTotal)
        : discountType === "CORTESIA_PERCENT" ? rc(cartTotal * (cortesiaPercentNum / 100))
        : 0;
      const finalTotal = roundToWhole(Math.max(0, cartTotal - pickupDiscount), paymentMethod);

      const pickupScheduledISO = scheduledTimeToISO(activeTabSnap?.scheduledTime ?? "");
      const result = await createSalesOrderAction({
        orderType: "RESTAURANT",
        customerName: pickupCustomerName || "Cliente en Caja",
        customerPhone: pickupCustomerPhone.trim() || undefined,
        scheduledDeliveryTime: pickupScheduledISO,
        items: cart,
        ...(isPickupMixedMode
          ? { payments: mixedPaymentsPickup.length > 0 ? mixedPaymentsPickup : [{ method: "CASH", amountUSD: finalTotal }],
              amountPaid: totalMixedPickupPaid || finalTotal,
              divisasUsdAmount: discountType === "DIVISAS_33" ? divisasUsdAmountPickup : undefined }
          : isBsPayMethod && exchangeRate && rawAmount > 0
            ? { payments: [{ method: paymentMethod, amountUSD: paidAmount || finalTotal, amountBS: rawAmount, exchangeRate }],
                amountPaid: paidAmount || finalTotal }
            : { paymentMethod, amountPaid: paidAmount || finalTotal,
                tipAtCheckout: parseFloat(checkoutTip) > 0 ? parseFloat(checkoutTip) : undefined }),
        // El PK number se incrusta en notes para que getDailyPickupCountAction
        // pueda recuperarlo y detectar huecos en la numeración del día.
        notes: activeTabSnap?.pickupNumber
          ? `Venta Directa Pickup | ${activeTabSnap.pickupNumber}`
          : "Venta Directa Pickup",
        discountType,
        discountPercent: discountType === "CORTESIA_PERCENT" ? cortesiaPercentNum : undefined,
        authorizedById: authorizedManager?.id,
      });

      if (result.success && result.data) {
        // Pickup desde la caja: encolar al agent para que imprima en
        // cocina/barra (impresoras Ethernet del local), no en la USB
        // de la caja. La caja imprime el RECIBO por separado.
        const menuItemCategoryMap = buildMenuItemCategoryMap(categories);
        void enqueueKitchenCommand({
          type: "KITCHEN",
          orderNumber: result.data.orderNumber,
          orderType: "RESTAURANT",
          orderTypeLabel: "PICKUP",
          tableName: null,
          customerName: pickupCustomerName || "Cliente Caja",
          scheduledDeliveryTime: pickupScheduledISO ?? null,
          items: buildKitchenItems(cart, menuItemCategoryMap),
          createdAt: new Date().toISOString(),
        }, undefined, { scheduledFor: printJobScheduledFor(pickupScheduledISO) });
        const subtotal = cart.reduce((s, i) => s + i.lineTotal, 0);
        const discount = pickupDiscount;
        const discountReason = discountType === "CORTESIA_100" ? 'Cortesía Autorizada (100%)'
            : discountType === "CORTESIA_PERCENT" ? `Cortesía Autorizada (${cortesiaPercentNum}%)`
            : undefined;
        const pickupReceiptItems = cart.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          total: i.lineTotal,
          // §95: el padre del sub-grupo no sale en el recibo
          modifiers: i.modifiers.filter((m) => !m.hideFromKitchen).map((m) => m.name),
        }));
        const pickupTipVal = parseFloat(checkoutTip) || 0;
        const pickupReceiptData = {
          orderNumber: result.data.orderNumber,
          orderType: "RESTAURANT" as const,
          date: new Date(),
          cashierName: cashierName || "Cajera",
          customerName: activeTabSnap?.customerName || pickupCustomerName || "Cliente en Caja",
          // tableLabel reutiliza la infraestructura de impresión para mostrar PK-02
          // en el recibo bajo el correlativo REST-XXXXX; tableLabelTitle lo etiqueta correctamente.
          tableLabel: activeTabSnap?.pickupNumber,
          tableLabelTitle: activeTabSnap?.pickupNumber ? "Pickup" : undefined,
          items: pickupReceiptItems,
          subtotal,
          discount,
          discountReason,
          hideDiscount: discountType === "DIVISAS_33",
          total: finalTotal,
          serviceFee: 0,
          tipAmount: pickupTipVal > 0 ? pickupTipVal : undefined,
        };
        if (getPOSConfig().printReceiptOnRestaurant) {
          emitReceipt({ ...pickupReceiptData, branding });
        }
        setLastPickupOrder({
          orderNumber: result.data.orderNumber,
          pickupNumber: activeTabSnap?.pickupNumber,
          total: finalTotal,
          subtotal,
          discount,
          hideDiscount: discountType === "DIVISAS_33",
          items: pickupReceiptItems,
          customerName: activeTabSnap?.customerName || pickupCustomerName || "Cliente en Caja",
        });

        // Eliminar el pickup tab completado y cambiar al siguiente (si existe)
        const completedTabId = activePickupTabId;
        if (completedTabId) {
          try { window.localStorage.removeItem(`posResto:copiedPickupCount:${completedTabId}`); } catch {}
        }
        const remaining = pickupTabs.filter((t) => t.id !== completedTabId);
        setPickupTabs(remaining);
        if (remaining.length > 0) {
          const next = remaining[remaining.length - 1];
          setCart(next.cart);
          setActivePickupTabId(next.id);
          setPickupCustomerName(next.customerName);
          setPickupCustomerPhone(next.customerPhone);
        } else {
          setCart([]);
          setActivePickupTabId(null);
          // Keep isPickupMode=true so the reprint button remains visible in the panel.
          // The user exits pickup mode by clicking a zone button in the left column.
          setPickupCustomerName("");
          setPickupCustomerPhone("");
        }
        setMixedPaymentsPickup([]); setIsPickupMixedMode(false);
        setCheckoutTip('');
        setPaymentMethodTouched(false);
        clearDiscount();
      } else {
        toast.error(result.message);
      }
    } catch (e) {
      console.error(e);
      toast.error("Error en Venta Directa");
    } finally {
      setIsProcessing(false);
    }
  };

  // ============================================================================
  // REMOVE ITEM
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

    setIsProcessing(true);
    setRemoveError("");
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
          authorizerName: k.authorizerName ?? 'Supervisor',
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
  // ANULAR COMANDA COMPLETA (requiere PIN de capitán o gerente)
  // ============================================================================

  const openVoidOrderModal = (order: { id: string; items: OrderItemSummary[]; total: number }) => {
    setVoidOrderTarget({
      orderId: order.id,
      itemCount: order.items.length,
      total: order.total,
    });
    setVoidOrderPin("");
    setVoidOrderReason("");
    setVoidOrderError("");
  };

  const handleVoidEntireOrder = async () => {
    if (!voidOrderTarget || !activeTab) return;
    if (!voidOrderReason.trim()) { setVoidOrderError("El motivo es obligatorio"); return; }
    if (!voidOrderPin.trim()) { setVoidOrderError("Ingresa el PIN de capitán o gerente"); return; }

    setIsProcessing(true); setVoidOrderError("");
    try {
      const result = await voidEntireTabOrderAction({
        openTabId: activeTab.id,
        orderId: voidOrderTarget.orderId,
        captainPin: voidOrderPin,
        reason: voidOrderReason,
      });
      if (!result.success) { setVoidOrderError(result.message); return; }
      toast.success(result.message);
      setVoidOrderTarget(null);
      // Un VOID_KITCHEN por ítem — cada uno se enruta a su estación
      // (barra vs cocina) según la categoría del producto.
      const printItems = (result.data?.kitchenPrintItems ?? []) as VoidKitchenCommandData[];
      for (const k of printItems) {
        void enqueueVoidKitchenCommand({
          orderNumber: k.orderNumber,
          tableName: k.tableName,
          waiterLabel: k.waiterLabel,
          authorizerName: k.authorizerName ?? 'Supervisor',
          modificationType: k.modificationType,
          categoryName: k.categoryName,
          voidedItem: k.voidedItem,
        });
      }
      await loadData(false);
    } finally {
      setIsProcessing(false);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (isLoading) {
    return (
      <div className="min-h-screen bg-capsula-ivory-surface text-capsula-ink flex items-center justify-center">
        <div className="text-center">
          <Wine className="h-10 w-10 mx-auto mb-3 text-capsula-ink animate-pulse" />
          <div className="text-xl font-semibold tracking-[-0.02em] text-capsula-ink">Cargando Restaurante…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-capsula-ivory-surface text-capsula-ink flex flex-col pb-16 lg:pb-0">
      <CashierShiftModal
        forceOpen={showChangeCashierModal}
        onShiftOpen={(name) => {
          setCashierName(name);
          setShowChangeCashierModal(false);
        }}
      />

      {/* ── MODAL: COMANDAS DEL DÍA (reimpresión) ────────────────────────── */}
      <ComandasDelDiaModal
        isOpen={showComandasModal}
        onClose={() => setShowComandasModal(false)}
      />

      {/* ── MODAL: PROPINA COLECTIVA ─────────────────────────────────────── */}
      {showTipModal && (
        <div className="fixed inset-0 bg-capsula-ink/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-capsula-ivory w-full max-w-sm rounded-3xl shadow-2xl border border-capsula-line p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold tracking-[-0.02em] text-capsula-ink">Propina colectiva</h3>
              <button type="button" onClick={() => setShowTipModal(false)} className="h-8 w-8 rounded-full hover:bg-capsula-coral/10 hover:text-capsula-coral text-capsula-ink-muted flex items-center justify-center">
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-capsula-ink-muted">Propina dejada <span className="font-semibold">después</span> de cerrar la mesa. Indica de qué mesa fue para vincular el correlativo.</p>
            {/* Mesa cerrada (vincula el correlativo) */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Mesa cerrada de hoy</label>
              <select
                value={tipSelectedTabCode}
                onChange={e => { setTipSelectedTabCode(e.target.value); if (e.target.value) setTipTableRef(''); }}
                className="w-full bg-capsula-ivory-surface border border-capsula-line text-capsula-ink rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-capsula-navy-deep transition"
              >
                <option value="">— Elegir mesa cerrada —</option>
                {closedTabs.map(t => (
                  <option key={t.id} value={t.tabCode}>
                    {t.tabCode} · {t.label}{t.total > 0 ? ` · $${t.total.toFixed(2)}` : ''}
                  </option>
                ))}
              </select>
              {/* Fallback: referencia manual si la mesa no está en la lista */}
              {!tipSelectedTabCode && (
                <input
                  type="text"
                  value={tipTableRef}
                  onChange={e => setTipTableRef(e.target.value)}
                  placeholder="…o escribe la referencia (ej: Mesa 5, Juan Pérez)"
                  className="w-full bg-capsula-ivory-surface border border-capsula-line text-capsula-ink rounded-2xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-capsula-navy-deep placeholder:text-capsula-ink-muted transition"
                />
              )}
            </div>
            {/* Method */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'CASH_USD',       label: 'Cash $',    Icon: DollarSign },
                { id: 'CASH_EUR',       label: 'Cash €',    Icon: Euro },
                { id: 'ZELLE',          label: 'Zelle',     Icon: Zap },
                { id: 'PDV_SHANKLISH',  label: 'PDV Shan.', Icon: CreditCard },
                { id: 'PDV_SUPERFERRO', label: 'PDV Super.',Icon: CreditCard },
                { id: 'MOVIL_NG',       label: 'Móvil NG',  Icon: Smartphone },
                { id: 'CASH_BS',        label: 'Efectivo Bs',Icon: Banknote },
              ].map(({ id, label, Icon }) => (
                <button key={id} type="button" onClick={() => setTipMethod(id)}
                  className={`py-2 rounded-xl text-[11px] font-semibold uppercase tracking-wider transition inline-flex flex-col items-center gap-1 ${tipMethod === id ? 'bg-capsula-navy-deep text-capsula-cream' : 'bg-capsula-ivory-surface border border-capsula-line text-capsula-ink hover:border-capsula-navy-deep/40'}`}>
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
            {/* Amount */}
            <div className="flex items-center bg-capsula-ivory-surface border border-capsula-line rounded-2xl p-1">
              <span className="pl-4 text-capsula-ink-muted text-sm font-semibold">
                {['CASH_BS','PDV_SHANKLISH','PDV_SUPERFERRO','MOVIL_NG'].includes(tipMethod) ? 'Bs' : '$'}
              </span>
              <input
                type="number" min="0" step="0.01"
                value={tipAmount}
                onChange={e => setTipAmount(e.target.value)}
                placeholder="0.00"
                className="flex-1 bg-transparent border-none px-3 py-3 text-2xl font-semibold text-capsula-ink focus:outline-none placeholder:text-capsula-ink-faint tabular-nums"
              />
            </div>
            {['CASH_BS','PDV_SHANKLISH','PDV_SUPERFERRO','MOVIL_NG'].includes(tipMethod) && exchangeRate && (parseFloat(tipAmount) || 0) > 0 && (
              <div className="flex justify-between text-xs px-1">
                <span className="text-capsula-ink-muted">Equivalente USD</span>
                <span className="font-semibold text-capsula-ink tabular-nums">${((parseFloat(tipAmount) || 0) / exchangeRate).toFixed(2)}</span>
              </div>
            )}
            <button
              type="button"
              onClick={handleRecordTip}
              disabled={isTipProcessing || !(parseFloat(tipAmount) > 0)}
              className="pos-btn w-full py-4 text-base disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isTipProcessing ? 'Registrando…' : 'Registrar propina'}
            </button>
          </div>
        </div>
      )}

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="bg-capsula-ivory px-3 md:px-6 py-3 md:py-4 flex items-center justify-between shrink-0 border-b border-capsula-line">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-capsula-navy-soft rounded-2xl flex items-center justify-center text-capsula-ink">
            <Wine className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg md:text-2xl font-semibold tracking-[-0.02em] text-capsula-ink">POS <span className="text-capsula-coral">Restaurante</span></h1>
            <p className="text-[10px] font-semibold text-capsula-ink-muted uppercase tracking-[0.14em] flex items-center gap-2 mt-0.5">
              Gestión táctil CAPSULA · Operaciones en vivo
              {cashierName ? (
                <span className="flex items-center gap-2 bg-capsula-ivory-surface px-2 py-0.5 rounded-full border border-capsula-line text-capsula-ink">
                  <UserCog className="h-3 w-3" />
                  {cashierName}
                  <button
                    onClick={() => setShowChangeCashierModal(true)}
                    className="text-capsula-coral hover:opacity-80 font-semibold underline underline-offset-2"
                  >
                    Cambiar
                  </button>
                </span>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {activeTab && (
            <div className="hidden md:block">
               <CurrencyCalculator totalUsd={Number(activeTab.balanceDue.toFixed(2))} onRateUpdated={setExchangeRate} />
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowComandasModal(true)}
            title="Reimprimir comandas de cocina o recibos del día"
            className="px-3 py-2 rounded-xl bg-capsula-ivory-surface border border-capsula-line text-capsula-ink text-xs font-semibold uppercase tracking-wider hover:bg-capsula-navy-soft transition inline-flex items-center gap-1.5"
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimir
          </button>
          {/* §113 — Encuesta de satisfacción, acceso directo junto a Imprimir.
              Requiere una mesa activa (para atribuir mesa/mesonero). */}
          {activeTab && (
            <button
              type="button"
              onClick={() => setSurveyFor({
                openTabId: activeTab.id,
                tabCode: activeTab.tabCode,
                tableName: selectedTable?.name,
                waiterName: (activeTab as any).waiterLabel || undefined,
              })}
              title="Registrar encuesta de satisfacción de la mesa"
              className="px-3 py-2 rounded-xl bg-capsula-ivory-surface border border-capsula-line text-capsula-ink text-xs font-semibold uppercase tracking-wider hover:bg-capsula-navy-soft transition inline-flex items-center gap-1.5"
            >
              <Star className="h-3.5 w-3.5" />
              Encuesta
            </button>
          )}
          <button
            type="button"
            onClick={openCollectiveTipModal}
            className="px-3 py-2 rounded-xl bg-capsula-ivory-surface border border-capsula-line text-capsula-ink text-xs font-semibold uppercase tracking-wider hover:bg-capsula-navy-soft transition inline-flex items-center gap-1.5"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Propina
          </button>
          <div className="px-4 py-2 bg-capsula-ivory-surface rounded-xl border border-capsula-line font-semibold text-sm tabular-nums text-capsula-ink-soft hidden sm:flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5" />
            {new Date().toLocaleDateString("es-VE", { timeZone: "America/Caracas" })}
          </div>
        </div>
      </div>

      {/* ── MAIN GRID ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* ══ LEFT: TABLE GRID ═══════════════════════════════════════════ */}
        <aside className={`w-full lg:w-64 tablet-land:w-64 xl:w-72 shrink-0 border-r border-capsula-line bg-capsula-ivory flex flex-col overflow-hidden ${mobileTab === "tables" ? "flex" : "hidden"} lg:flex absolute lg:relative inset-0 z-10 lg:z-auto`}>
          {/* Zone selector */}
          <div className="p-4 border-b border-capsula-line space-y-4">
            {/* ── PICKUP / PARA LLEVAR — panel propio, separado de mesas (§96) ── */}
            <div className={`rounded-2xl border p-3 space-y-2 transition-colors ${isPickupMode ? "border-capsula-navy-deep bg-capsula-navy-soft" : "border-capsula-line bg-capsula-ivory-alt"}`}>
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-capsula-ink-muted tracking-[0.14em] pl-1">
                <ShoppingBag className="h-3.5 w-3.5" />
                Pickup / Para llevar
                {pickupTabs.length > 0 && (
                  <span className="ml-auto rounded-full bg-capsula-coral/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-capsula-coral">
                    {pickupTabs.length} abierto{pickupTabs.length > 1 ? "s" : ""}
                  </span>
                )}
              </p>
              <button
                onClick={openPickupModal}
                className={`${isPickupMode ? "pos-btn" : "pos-btn-secondary"} w-full py-3 text-sm inline-flex items-center justify-center gap-2`}
              >
                <PlusIcon className="h-4 w-4" />
                Nuevo Pickup
              </button>

              {/* Lista de pickup tabs abiertos */}
              {pickupTabs.length > 0 && (
                <div className="flex flex-col gap-1">
                  {pickupTabs.map((pt) => (
                    <div key={pt.id} className={`flex items-center gap-1 rounded-xl border text-xs font-semibold transition-all ${activePickupTabId === pt.id ? "border-capsula-navy-deep bg-capsula-navy-soft text-capsula-ink" : "border-capsula-line bg-capsula-ivory-surface text-capsula-ink-soft hover:border-capsula-navy-deep/40"}`}>
                      <button
                        className="flex-1 py-2 pl-3 text-left truncate"
                        onClick={() => handleSelectPickupTab(pt.id)}
                      >
                        {pt.pickupNumber}{pt.customerName ? ` · ${pt.customerName}` : ""}
                        <span className="ml-1 font-normal text-capsula-ink-muted">
                          ${pt.cart.reduce((s, i) => s + i.lineTotal, 0).toFixed(2)}
                          {activePickupTabId === pt.id && cart.length > 0 &&
                            ` · ${cart.reduce((s, i) => s + i.lineTotal, 0).toFixed(2)} (activo)`}
                        </span>
                      </button>
                      <button
                        onClick={() => handleDiscardPickupTab(pt.id)}
                        className="px-2 py-2 text-capsula-ink-muted hover:text-capsula-coral leading-none"
                        title="Descartar pickup"
                      ><XIcon className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              )}

            </div>

            {/* ── MESAS — zonas + grid (§96) ── */}
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-capsula-ink-muted tracking-[0.14em] pl-1">
                <Armchair className="h-3.5 w-3.5" />
                Mesas
              </p>
              <div className="flex gap-2">
                {layout?.serviceZones.map((z) => {
                  const ZoneIcon = z.zoneType === "BAR" ? Beer : Leaf;
                  const active = selectedZoneId === z.id && !isPickupMode;
                  return (
                    <button
                      key={z.id}
                      onClick={() => {
                        if (isPickupMode && activePickupTabId) saveActivePickupCart(cart);
                        resetTableState();
                        setIsPickupMode(false);
                        setActivePickupTabId(null);
                        setSelectedZoneId(z.id);
                        setSelectedTableId("");
                      }}
                      className={`flex-1 py-3 rounded-xl text-xs font-semibold transition-all active:scale-95 inline-flex items-center justify-center gap-1.5 ${active ? "bg-capsula-navy-deep text-capsula-cream" : "bg-capsula-ivory-surface border border-capsula-line text-capsula-ink-soft hover:border-capsula-navy-deep/50 hover:text-capsula-ink"}`}
                    >
                      <ZoneIcon className="h-3.5 w-3.5" />
                      {z.name}
                    </button>
                  );
                })}
              </div>
            </div>
            {!layout && !layoutError && (
              <div className="flex-1 text-center text-xs text-capsula-ink-muted py-2">Cargando…</div>
            )}
            {layoutError && (
              <button onClick={() => loadData()} className="flex-1 text-xs text-capsula-coral hover:opacity-80 py-2 text-center inline-flex items-center justify-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Error · Reintentar
              </button>
            )}
          </div>

          {/* Error detail */}
          {layoutError && (
            <div className="px-3 py-2 text-[10px] text-capsula-coral bg-capsula-coral/10 border-b border-capsula-coral/30">
              {layoutError}
            </div>
          )}

          {/* Table grid */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 gap-3">
              {selectedZone?.tablesOrStations.map((table) => {
                const tab = table.openTabs[0];
                const isSelected = table.id === selectedTableId;
                return (
                  <button
                    key={table.id}
                    onClick={() => {
                      if (isPickupMode && activePickupTabId) saveActivePickupCart(cart);
                      resetTableState();
                      setIsPickupMode(false);
                      setActivePickupTabId(null);
                      setSelectedTableId(table.id);
                      setShowTableModal(true);
                    }}
                    className={`relative aspect-square rounded-2xl flex flex-col items-center justify-center transition-all duration-200 active:scale-95 border-2 ${
                      isSelected
                        ? "border-capsula-navy-deep bg-capsula-navy-soft z-10"
                        : tab
                          ? "border-capsula-coral/50 bg-capsula-coral/5"
                          : "border-capsula-line bg-capsula-ivory-surface hover:border-capsula-navy-deep/40"
                    }`}
                  >
                    <div className={`text-sm md:text-base font-semibold ${isSelected ? 'text-capsula-ink' : tab ? 'text-capsula-coral' : 'text-capsula-ink-muted'}`}>{table.code}</div>
                    {tab ? (
                      <div className="absolute top-1 right-1 h-2.5 w-2.5 bg-capsula-coral rounded-full ring-2 ring-capsula-ivory"></div>
                    ) : null}
                    {tab && (
                      <div className="mt-1 text-[9px] font-semibold text-capsula-ink truncate w-full px-1 text-center tabular-nums">
                         ${tab.balanceDue.toFixed(0)}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected table info & open tab CTA */}
          {selectedTable && (
            <div className="border-t border-capsula-line p-3 bg-capsula-ivory-surface">
              {!activeTab ? (
                <button
                  onClick={() => setShowOpenTabModal(true)}
                  className="pos-btn w-full py-3 text-sm inline-flex items-center justify-center gap-2"
                >
                  <PlusIcon className="h-4 w-4" />
                  Abrir cuenta en {selectedTable.name}
                </button>
              ) : (
                <div className="space-y-1 text-xs">
                  <div className="font-semibold text-capsula-ink truncate">{activeTab.customerLabel}</div>
                  {activeTab.customerPhone && (
                    <div className="text-capsula-ink-muted inline-flex items-center gap-1">
                      <PhoneIcon className="h-3 w-3" />
                      {activeTab.customerPhone}
                    </div>
                  )}
                  <div className="text-capsula-ink-muted">
                    Abrió:{" "}
                    <span className="text-capsula-ink-soft font-semibold">
                      {activeTab.openedBy.firstName} {activeTab.openedBy.lastName}
                    </span>
                    <span className="text-capsula-ink-muted"> · {formatTime(activeTab.openedAt)}</span>
                  </div>
                  {activeTab.assignedWaiter && (
                    <div className="text-capsula-ink-muted">
                      Mesonero: <span className="text-capsula-ink-soft font-semibold">{(activeTab as any).waiterLabel || "—"}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </aside>

        {/* ══ CENTER: MENU ════════════════════════════════════════════════ */}
        <main className={`flex-1 flex flex-col border-r border-capsula-line bg-capsula-ivory-surface overflow-hidden ${mobileTab === "menu" ? "flex" : "hidden"} lg:flex absolute lg:relative inset-0 z-10 lg:z-auto`}>
          {/* Search + Categories */}
          <div className="p-3 border-b border-capsula-line space-y-2 shrink-0 bg-capsula-ivory">
            {/* Active tab banner */}
            {activeTab ? (
              <div className="bg-capsula-navy-soft border border-capsula-line-strong rounded-xl px-3 py-2 text-xs flex items-center justify-between">
                <span className="text-capsula-ink">
                  <b>{selectedTable?.name}</b> · {activeTab.customerLabel}
                  {activeTab.customerPhone && <> · {activeTab.customerPhone}</>}
                </span>
                <span className="text-capsula-ink font-semibold tabular-nums">
                  <PriceDisplay usd={activeTab.balanceDue} rate={exchangeRate} size="sm" />
                </span>
              </div>
            ) : selectedTable ? (
              <div className="bg-capsula-ivory-surface border border-capsula-line rounded-xl px-3 py-2 text-xs text-capsula-ink-muted">
                {selectedTable.name} · Sin cuenta abierta — presiona &quot;Abrir cuenta&quot; para empezar
              </div>
            ) : (
              <div className="bg-capsula-ivory-surface border border-capsula-line rounded-xl px-3 py-2 text-xs text-capsula-ink-muted">
                Selecciona una mesa para empezar
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-capsula-ink-muted h-4 w-4" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder={`Buscar producto… ${isPickupMode ? "(Modo Pickup)" : ""}`}
                className={`w-full bg-capsula-ivory-surface border ${isPickupMode ? "border-capsula-navy-deep/50" : "border-capsula-line"} rounded-xl py-2 pl-9 pr-9 text-sm text-capsula-ink placeholder:text-capsula-ink-muted focus:outline-none focus:border-capsula-navy-deep transition`}
              />
              {productSearch && (
                <button
                  onClick={() => setProductSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-capsula-ink-muted hover:text-capsula-ink"
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
                  className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${selectedCategory === cat.id ? "bg-capsula-navy-deep text-capsula-cream" : "bg-capsula-ivory-surface border border-capsula-line text-capsula-ink-soft hover:border-capsula-navy-deep/40"}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Subcategories (Bebidas, etc.) */}
            {!productSearch && subcategories.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => { setSelectedSubcategory(""); setSelectedGroup(""); }}
                  className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${!selectedSubcategory ? "bg-capsula-navy-soft text-capsula-ink border border-capsula-line-strong" : "bg-capsula-ivory-surface border border-capsula-line text-capsula-ink-muted hover:border-capsula-navy-deep/40"}`}
                >
                  Todos
                </button>
                {subcategories.map((subcat) => (
                  <button
                    key={subcat}
                    onClick={() => { setSelectedSubcategory(subcat); setSelectedGroup(""); }}
                    className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${selectedSubcategory === subcat ? "bg-capsula-navy-soft text-capsula-ink border border-capsula-line-strong" : "bg-capsula-ivory-surface border border-capsula-line text-capsula-ink-muted hover:border-capsula-navy-deep/40"}`}
                  >
                    {subcat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Menu items */}
          <div className="flex-1 overflow-y-auto p-4 scroll-smooth">
            {/* Back button when inside a group */}
            {selectedGroup && !productSearch && (
              <button
                onClick={() => setSelectedGroup("")}
                className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-capsula-ink hover:opacity-80 active:scale-95 transition"
              >
                <ArrowLeft className="h-4 w-4" />
                {selectedGroup}
              </button>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 tablet-land:grid-cols-4 xl:grid-cols-4 gap-3 md:gap-4">

              {/* ── Group buttons (one per unique posGroup, when no group is selected and not searching) ── */}
              {!selectedGroup && !productSearch && groupsInView.map((group) => {
                const gItems = subcatFilteredItems.filter((i) => i.posGroup === group);
                const prices = gItems.map((i) => i.price);
                const minP = Math.min(...prices);
                const maxP = Math.max(...prices);
                return (
                  <button
                    key={group}
                    onClick={() => setSelectedGroup(group)}
                    disabled={!activeTab && !isPickupMode}
                    className="pos-tile group flex flex-col justify-between p-3 md:p-4 text-left disabled:opacity-30 disabled:grayscale h-28 md:h-32 active:scale-[0.98] transition-transform"
                  >
                    <div className="text-sm font-semibold text-capsula-ink group-hover:text-capsula-ink transition-colors leading-tight line-clamp-2 uppercase tracking-[-0.01em]">{group}</div>
                    <div className="flex items-end justify-between mt-2">
                      <div className="text-base font-semibold text-capsula-ink tabular-nums">
                        {minP === maxP ? `$${minP.toFixed(2)}` : `$${minP.toFixed(0)} – $${maxP.toFixed(0)}`}
                      </div>
                      <div className="text-[10px] font-semibold text-capsula-ink-muted bg-capsula-ivory-surface border border-capsula-line px-2 py-0.5 rounded-full">
                        {gItems.length} op →
                      </div>
                    </div>
                  </button>
                );
              })}

              {/* ── Size variant buttons (when inside a group) ── */}
              {selectedGroup && !productSearch && subcatFilteredItems.filter((i) => i.posGroup === selectedGroup).map((item) => {
                const sizeLabel = item.name.replace(new RegExp(selectedGroup.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "").trim() || item.name;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleAddToCart(item)}
                    disabled={!activeTab && !isPickupMode}
                    className="pos-tile group flex flex-col justify-between p-3 md:p-4 text-left disabled:opacity-30 disabled:grayscale h-28 md:h-32 active:scale-[0.98] transition-transform"
                  >
                    <div className="text-lg font-semibold text-capsula-ink uppercase tracking-[-0.01em]">{sizeLabel}</div>
                    <div className="text-xl font-semibold text-capsula-ink mt-auto tabular-nums">
                      <PriceDisplay usd={item.price} rate={exchangeRate} size="sm" showBs={false} />
                    </div>
                  </button>
                );
              })}

              {/* ── Single items (no posGroup) or search results ── */}
              {(productSearch || !selectedGroup) && (productSearch ? filteredMenuItems : subcatFilteredItems.filter((i) => !i.posGroup)).map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleAddToCart(item)}
                  disabled={!activeTab && !isPickupMode}
                  className="pos-tile group flex flex-col justify-between p-3 md:p-4 text-left disabled:opacity-30 disabled:grayscale h-28 md:h-32 active:scale-[0.98] transition-transform"
                >
                  <div className="text-sm font-semibold text-capsula-ink group-hover:text-capsula-ink transition-colors leading-tight line-clamp-2 uppercase tracking-[-0.01em]">{item.name}</div>
                  {(item as any).appliedPromotion && (
                    <span className="mt-1 inline-flex items-center gap-1 self-start text-[9px] font-semibold uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full bg-capsula-coral/10 text-capsula-coral">
                      <Tag className="h-2.5 w-2.5" /> Promo
                    </span>
                  )}
                  <div className="flex items-end justify-between mt-2">
                    <div className="text-xl font-semibold text-capsula-ink tabular-nums">
                      {(item as any).listPrice != null && (
                        <span className="mr-1 text-xs text-capsula-ink-faint line-through tabular-nums">${(item as any).listPrice.toFixed(2)}</span>
                      )}
                      <PriceDisplay usd={item.price} rate={exchangeRate} size="sm" showBs={false} />
                    </div>
                    <div className="h-8 w-8 rounded-full bg-capsula-navy-deep text-capsula-cream flex items-center justify-center opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all lg:group-hover:translate-y-[-4px]">
                      <PlusIcon className="h-4 w-4" />
                    </div>
                  </div>
                </button>
              ))}

              {/* Empty state */}
              {!productSearch && groupsInView.length === 0 && subcatFilteredItems.filter((i) => !i.posGroup).length === 0 && !selectedGroup && (
                <div className="col-span-full text-center text-capsula-ink-muted py-12 text-sm">Sin productos en esta categoría</div>
              )}
              {productSearch && filteredMenuItems.length === 0 && (
                <div className="col-span-full text-center text-capsula-ink-muted py-12 text-sm">Sin resultados para &quot;{productSearch}&quot;</div>
              )}
            </div>
          </div>
        </main>

        {/* ══ RIGHT: ACCOUNT PANEL ════════════════════════════════════════ */}
        <aside className={`w-full lg:w-[380px] tablet-land:w-[380px] xl:w-[440px] shrink-0 bg-capsula-ivory flex flex-col overflow-hidden border-l border-capsula-line ${mobileTab === "account" ? "flex" : "hidden"} lg:flex absolute lg:relative inset-0 z-10 lg:z-auto`}>
          {isPickupMode ? (
            <div className="flex-1 flex flex-col overflow-hidden bg-capsula-ivory-surface">
              <div className="p-4 border-b border-capsula-line bg-capsula-navy-soft space-y-2 shrink-0">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-lg text-capsula-ink flex items-center gap-2 tracking-[-0.02em]">
                    <ShoppingBag className="h-5 w-5 text-capsula-ink" />
                    {activePickupTab?.pickupNumber || "Pickup"}
                  </h2>
                  {activePickupTab?.customerPhone && (
                    <span className="text-xs text-capsula-ink-muted inline-flex items-center gap-1">
                      <PhoneIcon className="h-3 w-3" />
                      {activePickupTab.customerPhone}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-[1fr_110px] gap-2">
                  <input
                    type="text"
                    value={pickupCustomerName}
                    onChange={(e) => {
                      setPickupCustomerName(e.target.value);
                      if (activePickupTabId) {
                        setPickupTabs((prev) =>
                          prev.map((t) =>
                            t.id === activePickupTabId ? { ...t, customerName: e.target.value } : t,
                          ),
                        );
                      }
                    }}
                    placeholder="Nombre del cliente…"
                    className="w-full bg-capsula-ivory border border-capsula-line text-capsula-ink rounded-lg py-2 px-3 text-sm font-medium placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none transition"
                  />
                  <input
                    type="datetime-local"
                    value={activePickupTab?.scheduledTime ?? ""}
                    onChange={(e) => {
                      if (!activePickupTabId) return;
                      const v = e.target.value;
                      setPickupTabs((prev) =>
                        prev.map((t) =>
                          t.id === activePickupTabId ? { ...t, scheduledTime: v } : t,
                        ),
                      );
                    }}
                    title="Hora de entrega solicitada — se imprime grande en la comanda."
                    className="w-full bg-capsula-ivory border border-capsula-line text-capsula-ink rounded-lg py-2 px-2 text-sm font-semibold tabular-nums focus:border-capsula-navy-deep focus:outline-none transition"
                  />
                </div>
                {/* Teléfono opcional — si se ingresa, el cliente queda guardado en la cartera. */}
                <div className="relative">
                  <PhoneIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-capsula-ink-muted" />
                  <input
                    type="tel"
                    value={pickupCustomerPhone}
                    onChange={(e) => {
                      setPickupCustomerPhone(e.target.value);
                      if (activePickupTabId) {
                        setPickupTabs((prev) =>
                          prev.map((t) =>
                            t.id === activePickupTabId ? { ...t, customerPhone: e.target.value } : t,
                          ),
                        );
                      }
                    }}
                    placeholder="Teléfono (opcional — guarda al cliente)"
                    className="w-full bg-capsula-ivory border border-capsula-line text-capsula-ink rounded-lg py-2 pl-8 pr-3 text-sm font-medium placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none transition"
                  />
                </div>
                {/* Copia a portapapeles (envío por WhatsApp) — dedupe por
                    cantidad de ítems ya copiados de este pickup tab. */}
                {(() => {
                  const safeCount = cart.length < copiedPickupCount ? 0 : copiedPickupCount;
                  const nuevosCount = Math.max(0, cart.length - safeCount);
                  const hasCart = cart.length > 0;
                  return (
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[10px] font-semibold text-capsula-ink-muted uppercase tracking-[0.14em]">
                        Consumos
                        {nuevosCount > 0 && safeCount > 0 && (
                          <span className="ml-1.5 normal-case tracking-normal text-capsula-coral">· {nuevosCount} nuevo{nuevosCount === 1 ? "" : "s"}</span>
                        )}
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={handleCopyNewPickup}
                          disabled={nuevosCount === 0 || !hasCart}
                          title={!hasCart ? "Carrito vacío" : nuevosCount === 0 ? "No hay consumos nuevos desde la última copia" : "Copiar solo los consumos agregados desde la última vez"}
                          className="text-[10px] font-semibold uppercase tracking-[0.1em] text-capsula-ink bg-capsula-ivory hover:bg-capsula-navy-soft border border-capsula-line rounded-lg px-2.5 py-1 transition inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Copy className="h-3 w-3" />
                          Copiar nuevos
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyAllPickup}
                          disabled={!hasCart}
                          title={!hasCart ? "Carrito vacío" : "Copiar todos los consumos (reinicia el conteo de nuevos)"}
                          className="text-[10px] font-semibold uppercase tracking-[0.1em] text-capsula-ink-soft bg-capsula-ivory hover:bg-capsula-navy-soft border border-capsula-line rounded-lg px-2.5 py-1 transition inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Todo
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 relative">
                {cart.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-capsula-ink-muted">
                    Carrito vacío
                  </div>
                )}
                {cart.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-capsula-ivory p-4 rounded-2xl border border-capsula-line flex justify-between"
                  >
                    <div>
                      <div className="font-semibold text-sm flex items-center gap-1.5 flex-wrap text-capsula-ink">
                        <span className="text-capsula-ink">x{item.quantity}</span>
                        {item.name}
                        {item.takeaway && (
                          <span className="inline-flex items-center rounded bg-capsula-navy-soft border border-capsula-line-strong px-1.5 py-0.5 text-[10px] font-semibold text-capsula-ink uppercase tracking-wide">
                            Llevar
                          </span>
                        )}
                      </div>
                      {item.modifiers.length > 0 && (
                        <div className="text-xs text-capsula-ink-muted pl-4">
                          {item.modifiers.map((m) => m.name).join(", ")}
                        </div>
                      )}
                      {item.notes && <div className="text-xs text-capsula-ink-soft pl-4 italic">&quot;{item.notes}&quot;</div>}
                    </div>
                    <div className="text-right flex flex-col justify-between items-end">
                      <div className="font-semibold text-sm leading-none text-capsula-ink tabular-nums">${item.lineTotal.toFixed(2)}</div>
                      <button
                        onClick={() => setCart((p) => p.filter((_, i) => i !== idx))}
                        className="text-capsula-coral text-xs hover:opacity-80 leading-none font-semibold"
                      >
                        Borrar
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="overflow-y-auto p-4 bg-capsula-ivory border-t border-capsula-line space-y-3 shrink-0 max-h-[calc(100vh-200px)]">
                {/* Descuento */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={clearDiscount}
                    className={`py-3 text-sm font-semibold rounded-xl transition ${discountType === "NONE" ? "bg-capsula-navy-deep text-capsula-cream" : "bg-capsula-ivory-surface border border-capsula-line text-capsula-ink-soft hover:border-capsula-navy-deep/40"}`}
                  >
                    Normal
                  </button>
                  <button
                    onClick={() => isPagoDivisasPickup ? setDiscountType("DIVISAS_33") : undefined}
                    disabled={!isPagoDivisasPickup}
                    title={!isPagoDivisasPickup ? "Solo con Efectivo o Zelle" : ""}
                    className={`py-3 text-sm font-semibold rounded-xl transition ${discountType === "DIVISAS_33" ? "bg-capsula-navy-deep text-capsula-cream" : isPagoDivisasPickup ? "bg-capsula-ivory-surface border border-capsula-line text-capsula-ink-soft hover:border-capsula-navy-deep/40" : "bg-capsula-ivory-surface border border-capsula-line text-capsula-ink-faint cursor-not-allowed opacity-50"}`}
                  >
                    Divisas −33%
                  </button>
                  <button
                    onClick={openCortesiaModal}
                    className={`col-span-2 py-3 text-sm font-semibold rounded-xl transition inline-flex items-center justify-center gap-2 ${(discountType === "CORTESIA_100" || discountType === "CORTESIA_PERCENT") ? "bg-capsula-coral text-capsula-cream" : "bg-capsula-ivory-surface border border-capsula-line text-capsula-ink-soft hover:border-capsula-coral/40"}`}
                  >
                    <Gift className="h-4 w-4" />
                    {(discountType === "CORTESIA_100" || discountType === "CORTESIA_PERCENT")
                      ? `Cortesía ${discountType === "CORTESIA_PERCENT" ? cortesiaPercentNum + "%" : "100%"}`
                      : "Cortesía (PIN)"}
                  </button>
                </div>
                {/* Modo de pago + total calculado */}
                {(() => {
                  const baseDiscount = discountType === "DIVISAS_33"
                    ? (isPickupMixedMode ? Math.round((divisasUsdAmountPickup ?? 0) * divisasRate * 100) / 100 : Math.round(cartTotal * divisasRate * 100) / 100)
                    : discountType === "CORTESIA_100" ? cartTotal
                    : discountType === "CORTESIA_PERCENT" ? cartTotal * (cortesiaPercentNum / 100)
                    : 0;
                  const pickupTotal = roundToWhole(Math.max(0, cartTotal - baseDiscount), paymentMethod);
                  // Vuelto sólo aplica a efectivo USD (único método con cambio físico en pickup).
                  // Para métodos en Bs (pagomóvil, PDV, efectivo Bs) el "Recibido" se teclea en
                  // Bs: restar ese monto contra un total en USD daba un vuelto erróneo (Bs − USD).
                  // Usamos paidAmount (ya normalizado a USD) y sólo mostramos vuelto en no-Bs,
                  // igual que el flujo de mesa (línea ~3331).
                  const pickupChange = isPickupMixedMode
                    ? Math.max(0, totalMixedPickupPaid - pickupTotal)
                    : (!isBsPayMethod ? Math.max(0, paidAmount - pickupTotal) : 0);
                  return (
                    <div className="space-y-3 pt-2">
                      {/* Toggle Pago Único / Pago Mixto */}
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button"
                          onClick={() => { setIsPickupMixedMode(false); setMixedPaymentsPickup([]); }}
                          className={`py-3 rounded-xl text-sm font-semibold uppercase tracking-wider transition-all ${!isPickupMixedMode ? "bg-capsula-navy-deep text-capsula-cream" : "bg-capsula-ivory-surface border border-capsula-line text-capsula-ink-muted hover:border-capsula-navy-deep/40"}`}
                        >Pago único</button>
                        <button type="button"
                          onClick={() => { setIsPickupMixedMode(true); setAmountReceived(""); }}
                          className={`py-3 rounded-xl text-sm font-semibold uppercase tracking-wider transition-all inline-flex items-center justify-center gap-2 ${isPickupMixedMode ? "bg-capsula-navy-deep text-capsula-cream" : "bg-capsula-ivory-surface border border-capsula-line text-capsula-ink-muted hover:border-capsula-navy-deep/40"}`}
                        >
                          <Wallet className="h-4 w-4" />
                          Pago mixto
                        </button>
                      </div>

                      {!isPickupMixedMode ? (
                        /* ── Pago Único ── */
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            {SINGLE_PAY_METHODS.map((m) => (
                              <button key={m} type="button" onClick={() => { setPaymentMethod(m); setPaymentMethodTouched(true); }}
                                className={`py-3 rounded-xl text-sm font-semibold uppercase tracking-wider transition-all active:scale-95 ${paymentMethodTouched && paymentMethod === m ? "bg-capsula-navy-deep text-capsula-cream" : "bg-capsula-ivory-surface border border-capsula-line text-capsula-ink-muted hover:border-capsula-navy-deep/40"}`}>
                                {PAYMENT_LABELS[m]}
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center gap-2 bg-capsula-ivory-surface border border-capsula-line p-1 rounded-2xl">
                            <input type="number" value={amountReceived}
                              onChange={(e) => { setAmountReceived(e.target.value); setCheckoutTip(''); }}
                              placeholder="Recibido…"
                              className="flex-1 bg-transparent border-none rounded-xl px-4 py-3 text-lg font-semibold focus:ring-0 placeholder:text-capsula-ink-muted text-capsula-ink tabular-nums" />
                            <div className="pr-4 text-xs font-semibold text-capsula-ink-muted uppercase tracking-wider">
                              {isBsPayMethod ? 'Bs' : 'USD'}
                            </div>
                          </div>
                          {/* Equivalente USD para métodos Bs */}
                          {isBsPayMethod && exchangeRate && rawAmount > 0 && (
                            <div className="flex justify-between text-xs px-1">
                              <span className="text-capsula-ink-muted">Equivalente USD</span>
                              <span className="font-semibold text-capsula-ink tabular-nums">${(rawAmount / exchangeRate).toFixed(2)}</span>
                            </div>
                          )}
                          {/* Vuelto para efectivo USD */}
                          {!isBsPayMethod && paymentMethod === 'CASH_USD' && paidAmount > 0 && paidAmount > (cartTotal - (discountType === 'DIVISAS_33' ? Math.round(cartTotal * divisasRate * 100) / 100 : 0)) && (
                            <div className="flex justify-between text-sm font-semibold px-1">
                              <span className="text-capsula-ink">Vuelto</span>
                              <span className="text-capsula-ink tabular-nums">${Math.max(0, paidAmount - Math.max(0, cartTotal - (discountType === 'DIVISAS_33' ? Math.round(cartTotal * divisasRate * 100) / 100 : 0))).toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* ── Pago Mixto ── */
                        <div className="space-y-2">
                          <MixedPaymentSelector
                            key={`pickup-mixed-${pickupTotal.toFixed(2)}-${isPickupMixedMode}`}
                            totalAmount={pickupTotal}
                            exchangeRate={exchangeRate}
                            onChange={(lines, _paid, _complete) => setMixedPaymentsPickup(lines)}
                            disabled={isProcessing}
                          />
                          {discountType === "DIVISAS_33" && (divisasUsdAmountPickup ?? 0) > 0 && (
                            <div className="rounded-xl bg-capsula-navy-soft border border-capsula-line-strong px-3 py-2 text-xs text-capsula-ink space-y-0.5">
                              <div className="flex justify-between">
                                <span>Divisas sobre ${(divisasUsdAmountPickup ?? 0).toFixed(2)} USD</span>
                                <span className="font-semibold tabular-nums">−${((divisasUsdAmountPickup ?? 0) * divisasRate).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between font-semibold text-capsula-ink">
                                <span>Total a cobrar</span>
                                <span className="tabular-nums">${pickupTotal.toFixed(2)}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Vuelto + Propina voluntaria */}
                      {pickupChange > 0.001 && (() => {
                        const tipVal = Math.min(parseFloat(checkoutTip) || 0, pickupChange);
                        const changeBack = pickupChange - tipVal;
                        return (
                          <div className="rounded-2xl border border-capsula-line-strong bg-capsula-ivory-surface p-3 space-y-2">
                            {/* Fila principal: vuelto a devolver (lo más importante) */}
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-semibold text-capsula-ink inline-flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-capsula-ink" />
                                Vuelto a devolver:
                              </span>
                              <span className="text-lg font-semibold text-capsula-ink tabular-nums">${Math.max(0, changeBack).toFixed(2)}</span>
                            </div>
                            {/* Separador antes de la propina opcional */}
                            <div className="border-t border-capsula-line pt-2">
                              <div className="text-[10px] text-capsula-ink-muted uppercase tracking-[0.14em] mb-1.5">
                                Propina voluntaria (opcional — solo si el cliente la deja)
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 flex items-center bg-capsula-ivory border border-capsula-line rounded-lg px-2">
                                  <span className="text-xs text-capsula-ink-muted mr-1">$</span>
                                  <input
                                    type="number" min="0" step="0.01"
                                    max={pickupChange}
                                    value={checkoutTip}
                                    onChange={e => setCheckoutTip(e.target.value)}
                                    placeholder="0.00"
                                    className="flex-1 bg-transparent text-sm font-semibold text-capsula-ink focus:outline-none py-1.5 w-0 tabular-nums"
                                  />
                                </div>
                                {tipVal > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setCheckoutTip("")}
                                    className="text-capsula-ink-muted hover:text-capsula-coral h-6 w-6 rounded-full flex items-center justify-center"
                                    title="Limpiar propina"
                                  ><XIcon className="h-3.5 w-3.5" /></button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      <CurrencyCalculator totalUsd={pickupTotal} hasServiceFee={false} onRateUpdated={setExchangeRate} inline startCollapsed />

                      {(() => {
                        const needsAmount = !isPickupMixedMode && METHODS_REQUIRING_AMOUNT.has(paymentMethod) && paidAmount <= 0;
                        const needsMethod = !isPickupMixedMode && !paymentMethodTouched;
                        return (
                          <>
                            {needsMethod && (
                              <div className="text-center text-xs text-capsula-coral font-semibold py-1 inline-flex items-center justify-center gap-1.5 w-full">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                Selecciona un método de pago
                              </div>
                            )}
                            {!needsMethod && needsAmount && (
                              <div className="text-center text-xs text-capsula-coral font-semibold py-1 inline-flex items-center justify-center gap-1.5 w-full">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                Ingresa el monto recibido
                              </div>
                            )}
                            <button
                              onClick={() => {
                                const linesForConfirmation: PaymentConfirmationLine[] = isPickupMixedMode
                                  ? mixedPaymentsPickup.map(p => ({ method: p.method, amountUSD: p.amountUSD, amountBS: p.amountBS }))
                                  : [{ method: paymentMethod, amountUSD: paidAmount > 0 ? paidAmount : pickupTotal }];
                                requestPaymentConfirmation(linesForConfirmation, pickupTotal, handleCheckoutPickup);
                              }}
                              disabled={cart.length === 0 || isProcessing || needsAmount || needsMethod}
                              className="pos-btn w-full py-5 text-lg disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {isProcessing ? "Procesando…" : `Cobrar $${pickupTotal.toFixed(2)}`}
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  );
                })()}
                {lastPickupOrder && (
                  <button
                    onClick={() => {
                      emitReceipt({
                        orderNumber: lastPickupOrder.orderNumber,
                        orderType: "RESTAURANT",
                        date: new Date(),
                        cashierName: cashierName || "Cajera",
                        customerName: lastPickupOrder.customerName,
                        tableLabel: lastPickupOrder.pickupNumber,
                        tableLabelTitle: lastPickupOrder.pickupNumber ? "Pickup" : undefined,
                        items: lastPickupOrder.items,
                        subtotal: lastPickupOrder.subtotal,
                        discount: lastPickupOrder.discount,
                        hideDiscount: lastPickupOrder.hideDiscount,
                        discountReason: lastPickupOrder.discount > 0 && !lastPickupOrder.hideDiscount ? "Descuento aplicado" : undefined,
                        total: lastPickupOrder.total,
                        serviceFee: 0,
                        branding,
                      });
                    }}
                    className="pos-btn-secondary w-full py-3 text-sm inline-flex items-center justify-center gap-2"
                  >
                    <Printer className="h-4 w-4" />
                    Reimprimir {lastPickupOrder.pickupNumber || lastPickupOrder.orderNumber}
                  </button>
                )}
              </div>
            </div>
          ) : !activeTab ? (
            <div className="flex-1 flex items-center justify-center p-6 text-center text-capsula-ink-muted text-sm">
              {selectedTable
                ? "Abre una cuenta para gestionar consumos"
                : "Selecciona una mesa o usa Venta directa (Pickup)"}
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Tab header */}
              <div className="p-3 border-b border-capsula-line bg-capsula-ivory space-y-1.5 shrink-0">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-base text-capsula-ink tracking-[-0.02em]">{activeTab.customerLabel}</div>
                    {activeTab.customerPhone && (
                      <div className="text-xs text-capsula-ink-muted inline-flex items-center gap-1">
                        <PhoneIcon className="h-3 w-3" />
                        {activeTab.customerPhone}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-capsula-ink-muted uppercase tracking-[0.14em] font-semibold">Saldo</div>
                    <div className="text-xl font-semibold text-capsula-ink tabular-nums">
                      <PriceDisplay usd={activeTab.balanceDue} rate={exchangeRate} size="md" showBs={false} />
                    </div>
                  </div>
                </div>
                <div className="text-xs text-capsula-ink-muted space-y-0.5">
                  <div className="inline-flex items-center gap-1.5">
                    <Unlock className="h-3 w-3" />
                    Abrió:{" "}
                    <span className="text-capsula-ink-soft font-semibold">
                      {activeTab.openedBy.firstName} {activeTab.openedBy.lastName}
                    </span>{" "}
                    · {formatDateTime(activeTab.openedAt)}
                  </div>
                  {(activeTab as any).waiterLabel && (
                    <div className="inline-flex items-center gap-1.5">
                      <UserCircle2 className="h-3 w-3" />
                      Mesonero: <span className="text-capsula-ink-soft font-semibold">{(activeTab as any).waiterLabel}</span>
                    </div>
                  )}
                  <div className="inline-flex items-center gap-1.5">
                    <Tag className="h-3 w-3" />
                    {activeTab.tabCode} · {activeTab.guestCount} pax ·{" "}
                    <span className={`font-semibold ${activeTab.status === "OPEN" ? "text-capsula-ink" : "text-capsula-coral"}`}>
                      {activeTab.status}
                    </span>
                  </div>
                </div>
                {/* Subcuentas toggle. Si la cuenta ya tiene subcuentas
                    creadas (típicamente por el mesonero), entramos
                    automáticamente al modo subcuentas — ver useEffect arriba. */}
                <button
                  onClick={() => setSubAccountMode((p) => !p)}
                  className={`w-full py-2 rounded-xl text-xs font-semibold transition inline-flex items-center justify-center gap-2 ${
                    subAccountMode
                      ? "bg-capsula-navy-deep text-capsula-cream"
                      : "bg-capsula-ivory-surface hover:bg-capsula-navy-soft border border-capsula-line text-capsula-ink-soft hover:text-capsula-ink"
                  }`}
                >
                  <Divide className="h-3.5 w-3.5" />
                  {subAccountMode ? (
                    <>Viendo subcuentas{subAccountsCount > 0 ? ` (${subAccountsCount})` : ''} — volver a cobro normal</>
                  ) : subAccountsCount > 0 ? (
                    <>Ver subcuentas existentes ({subAccountsCount})</>
                  ) : (
                    <>Dividir cuenta (subcuentas)</>
                  )}
                </button>
              </div>

              {subAccountMode ? (
                <SubAccountPanel
                  openTabId={activeTab.id}
                  exchangeRate={exchangeRate}
                  onClose={() => setSubAccountMode(false)}
                  onTabUpdated={() => loadData(false)}
                  tabCode={activeTab.tabCode}
                  customerLabel={activeTab.customerLabel ?? undefined}
                  tableLabel={selectedTable?.name}
                  cashierName={cashierName || undefined}
                />
              ) : (
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {/* Temporary cart */}
                <div className="rounded-xl border border-capsula-line bg-capsula-ivory-surface p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold text-capsula-ink-muted uppercase tracking-[0.14em]">Carrito (nueva tanda)</span>
                    <span className="text-xs font-semibold text-capsula-ink tabular-nums">
                      <PriceDisplay usd={cartTotal} rate={exchangeRate} size="sm" showBs={false} />
                    </span>
                  </div>
                  {cart.length === 0 ? (
                    <div className="text-xs text-capsula-ink-muted text-center py-2">Agrega items del menú</div>
                  ) : (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {cart.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs bg-capsula-ivory rounded-lg px-2 py-1.5 border border-capsula-line"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold truncate text-capsula-ink">
                              {item.quantity}× {item.name}
                            </div>
                            {item.modifiers.length > 0 && (
                              <div className="text-capsula-ink-muted truncate">
                                {item.modifiers.map((m) => m.name).join(", ")}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 ml-2 shrink-0">
                            <span className="text-capsula-ink font-semibold tabular-nums">${item.lineTotal.toFixed(2)}</span>
                            <button
                              onClick={() => setCart((p) => p.filter((_, i) => i !== idx))}
                              className="text-capsula-ink-muted hover:text-capsula-coral h-4 w-4 flex items-center justify-center"
                            >
                              <XIcon className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={handleSendToTab}
                    disabled={cart.length === 0 || isProcessing}
                    className="pos-btn-secondary mt-2 w-full py-2 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Agregar consumo a la cuenta →
                  </button>
                </div>

                {/* Consumed orders */}
                {activeTab.orders.length > 0 && (() => {
                  const allConsumoItems = activeTab.orders.flatMap((o) => o.items);
                  const nuevosCount = allConsumoItems.filter((it) => !copiedConsumoIds.has(it.id)).length;
                  return (
                  <div className="rounded-xl border border-capsula-line bg-capsula-ivory-surface p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="text-[10px] font-semibold text-capsula-ink-muted uppercase tracking-[0.14em]">
                        Consumos cargados
                        {nuevosCount > 0 && copiedConsumoIds.size > 0 && (
                          <span className="ml-1.5 normal-case tracking-normal text-capsula-coral">· {nuevosCount} nuevo{nuevosCount === 1 ? "" : "s"}</span>
                        )}
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={handleCopyNewConsumos}
                          disabled={nuevosCount === 0}
                          title={nuevosCount === 0 ? "No hay consumos nuevos desde la última copia" : "Copiar solo los consumos agregados desde la última vez"}
                          className="text-[10px] font-semibold uppercase tracking-[0.1em] text-capsula-ink bg-capsula-ivory hover:bg-capsula-navy-soft border border-capsula-line rounded-lg px-2.5 py-1 transition inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Copy className="h-3 w-3" />
                          Copiar nuevos
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyAllConsumos}
                          title="Copiar todos los consumos (reinicia el conteo de nuevos)"
                          className="text-[10px] font-semibold uppercase tracking-[0.1em] text-capsula-ink-soft bg-capsula-ivory hover:bg-capsula-navy-soft border border-capsula-line rounded-lg px-2.5 py-1 transition inline-flex items-center gap-1"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Todo
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {activeTab.orders.map((order) => (
                        <div key={order.id} className="bg-capsula-ivory rounded-lg p-2 border border-capsula-line">
                          <div className="flex items-center justify-between text-[10px] text-capsula-ink-muted mb-1">
                            <span className="font-semibold">{order.orderNumber}</span>
                            <span className="flex items-center gap-1">
                              {order.createdBy && <span>{order.createdBy.firstName}</span>}·{" "}
                              {formatTime(order.createdAt)}
                            </span>
                          </div>
                          {order.items.map((item) => (
                            <div key={item.id} className="flex items-start justify-between text-xs py-0.5">
                              <div className="flex-1 min-w-0">
                                <div className="text-capsula-ink-soft truncate">
                                  {item.quantity}× {item.itemName}
                                </div>
                                {item.modifiers && item.modifiers.length > 0 && (
                                  <div className="text-[10px] text-capsula-ink-muted truncate pl-3">
                                    {item.modifiers.map((m) => m.name).join(" · ")}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 ml-2 shrink-0">
                                <span className="text-capsula-ink-muted tabular-nums">${item.lineTotal.toFixed(2)}</span>
                                <button
                                  onClick={() => openRemoveModal(order.id, item)}
                                  className="text-capsula-ink-muted hover:text-capsula-coral h-5 w-5 rounded flex items-center justify-center border border-capsula-line hover:border-capsula-coral/40 transition"
                                  title="Eliminar (requiere PIN cajera)"
                                >
                                  <XIcon className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                          <div className="flex items-center justify-between mt-1">
                            <button
                              onClick={() => openVoidOrderModal(order)}
                              className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-capsula-ink-faint hover:text-capsula-coral transition-colors"
                              title="Anular comanda completa (requiere PIN supervisor)"
                            >
                              <Ban className="h-3 w-3" />
                              Anular comanda
                            </button>
                            <span className="text-right text-[10px] text-capsula-ink font-semibold tabular-nums">
                              ${order.total.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  );
                })()}

                {/* Payment section */}
                <div className="rounded-xl border border-capsula-line bg-capsula-ivory-surface p-4">
                  <div className="flex items-center justify-between mb-3 gap-2">
                    <div className="text-xs font-semibold text-capsula-ink-muted uppercase tracking-[0.14em]">Cobrar cuenta</div>
                    {activeTab.orders.length > 0 && (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handlePrintPrecuenta(false)}
                          title="Pre-cuenta sin descuento (monto pleno)"
                          className="text-xs font-semibold text-capsula-ink bg-capsula-ivory hover:bg-capsula-navy-soft border border-capsula-line rounded-lg px-3 py-1.5 transition inline-flex items-center gap-1.5"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          Pre-cuenta
                        </button>
                        <button
                          onClick={() => handlePrintPrecuenta(true)}
                          title="Pre-cuenta aplicando 33% off por pago en divisas"
                          className="text-xs font-semibold text-capsula-ink bg-capsula-ivory hover:bg-capsula-navy-soft border border-capsula-line rounded-lg px-3 py-1.5 transition inline-flex items-center gap-1.5"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          Pre-cuenta c/ desc divisas
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 1. Descuento */}
                  <div className="mb-3">
                    <p className="text-[10px] font-semibold text-capsula-ink-muted uppercase tracking-[0.14em] mb-1.5">1. Descuento</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={clearDiscount}
                        className={`py-3 text-sm font-semibold rounded-xl transition ${discountType === "NONE" ? "bg-capsula-navy-deep text-capsula-cream" : "bg-capsula-ivory border border-capsula-line text-capsula-ink-soft hover:border-capsula-navy-deep/40"}`}
                      >
                        Normal
                      </button>
                      <button
                        onClick={() => (isPagoDivisas || isTableMixedMode) && setDiscountType("DIVISAS_33")}
                        disabled={!isPagoDivisas && !isTableMixedMode}
                        title={(!isPagoDivisas && !isTableMixedMode) ? "Solo con Efectivo o Zelle" : "Descuento por pago en divisas"}
                        className={`py-3 text-sm font-semibold rounded-xl transition ${discountType === "DIVISAS_33" ? "bg-capsula-navy-deep text-capsula-cream" : (isPagoDivisas || isTableMixedMode) ? "bg-capsula-ivory border border-capsula-line text-capsula-ink-soft hover:border-capsula-navy-deep/40" : "bg-capsula-ivory border border-capsula-line text-capsula-ink-faint cursor-not-allowed opacity-50"}`}
                      >
                        Divisas −33%
                      </button>
                      <button
                        onClick={openCortesiaModal}
                        className={`col-span-2 py-3 text-sm font-semibold rounded-xl transition inline-flex items-center justify-center gap-2 ${(discountType === "CORTESIA_100" || discountType === "CORTESIA_PERCENT") ? "bg-capsula-coral text-capsula-cream" : "bg-capsula-ivory border border-capsula-line text-capsula-ink-soft hover:border-capsula-coral/40"}`}
                      >
                        <Gift className="h-4 w-4" />
                        {(discountType === "CORTESIA_100" || discountType === "CORTESIA_PERCENT")
                          ? `Cortesía ${discountType === "CORTESIA_PERCENT" ? cortesiaPercentNum + "%" : "100%"} — ${authorizedManager?.name || ""}`
                          : "Cortesía (PIN)"}
                      </button>
                    </div>
                    {discountType === "DIVISAS_33" && (
                      <p className="text-xs text-capsula-ink-soft mt-1.5 tabular-nums">
                        Descuento: −${(activeTab.balanceDue * divisasRate).toFixed(2)} → Total: $
                        {(activeTab.balanceDue * (1 - divisasRate)).toFixed(2)}
                      </p>
                    )}
                    {(discountType === "CORTESIA_100" || discountType === "CORTESIA_PERCENT") && (
                      <p className="text-xs text-capsula-coral mt-1.5 tabular-nums">
                        Descuento: −${(activeTab.balanceDue * (cortesiaPercentNum / 100)).toFixed(2)} → Total: ${(activeTab.balanceDue * (1 - cortesiaPercentNum / 100)).toFixed(2)}
                      </p>
                    )}
                  </div>

                  {/* 1.b Servicio — % editable al cobro (§85), default 10%. Eximir con PIN capitán/gerente */}
                  <div className="mb-3 rounded-xl border border-capsula-line bg-capsula-ivory p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-capsula-ink">Servicio</p>
                        <p className="text-[10px] text-capsula-ink-muted">
                          {serviceFeeIncluded ? 'Editable — aplica al cobro' : 'Eximido — autorizado por PIN'}
                        </p>
                      </div>
                      {serviceFeeIncluded ? (
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center rounded-lg border border-capsula-line bg-capsula-ivory-surface px-2 py-1">
                            <input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              max={100}
                              step="any"
                              value={serviceFeePercentStr}
                              onChange={(e) => setServiceFeePercentStr(e.target.value)}
                              className="w-12 bg-transparent text-right text-sm font-semibold text-capsula-ink tabular-nums focus:outline-none"
                              aria-label="Porcentaje de servicio"
                            />
                            <span className="text-sm font-semibold text-capsula-ink-muted">%</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowSkipServiceFeeModal(true)}
                            className="text-xs font-semibold rounded-lg border border-capsula-line bg-capsula-ivory-surface px-3 py-1.5 hover:border-capsula-coral hover:text-capsula-coral"
                          >
                            Quitar
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setServiceFeeIncluded(true); setSkipServiceFeePin(''); }}
                          className="text-xs font-semibold rounded-lg border border-capsula-line bg-capsula-ivory-surface px-3 py-1.5 hover:border-capsula-navy-deep shrink-0"
                        >
                          Restaurar servicio
                        </button>
                      )}
                    </div>
                    {serviceFeeIncluded && (
                      <div className="mt-1.5 flex gap-1.5">
                        {[10, 12, 15, 20].map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setServiceFeePercentStr(String(p))}
                            className={`flex-1 rounded-lg border px-2 py-1 text-[11px] font-semibold tabular-nums transition ${
                              serviceFeePercent === p
                                ? 'border-capsula-navy-deep bg-capsula-navy-soft text-capsula-ink'
                                : 'border-capsula-line bg-capsula-ivory-surface text-capsula-ink-muted hover:border-capsula-navy-deep/40'
                            }`}
                          >
                            {p}%
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {showSkipServiceFeeModal && (
                    <div className="fixed inset-0 z-[60] bg-capsula-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                      <div className="bg-capsula-ivory border border-capsula-line w-full max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl">
                        <div className="border-b border-capsula-line p-5">
                          <h3 className="font-semibold text-lg tracking-[-0.02em] text-capsula-ink">Eximir 10% servicio</h3>
                          <p className="text-xs text-capsula-ink-muted mt-1">El cliente NO va a pagar el 10% — se requiere PIN de capitán o gerente.</p>
                        </div>
                        <div className="p-5 space-y-3">
                          <input
                            type="password"
                            inputMode="numeric"
                            autoFocus
                            value={skipServiceFeePin}
                            onChange={e => setSkipServiceFeePin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                            placeholder="PIN (4-8 dígitos)"
                            className="pos-input w-full text-center text-2xl tracking-[0.4em] font-mono"
                          />
                          <p className="text-[10px] text-capsula-ink-muted">El PIN se validará al cobrar. Si es inválido, el cobro se rechaza y volvés a esta pantalla.</p>
                        </div>
                        <div className="border-t border-capsula-line p-4 flex gap-3">
                          <button
                            type="button"
                            onClick={() => { setShowSkipServiceFeeModal(false); setSkipServiceFeePin(''); }}
                            className="pos-btn-secondary flex-1 py-3"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            disabled={skipServiceFeePin.length < 4}
                            onClick={() => { setServiceFeeIncluded(false); setShowSkipServiceFeeModal(false); }}
                            className="pos-btn flex-[2] py-3 disabled:opacity-50"
                          >
                            Confirmar eximir
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 2. Forma de pago */}
                  <div className="mb-3">
                    <p className="text-[10px] font-semibold text-capsula-ink-muted uppercase tracking-[0.14em] mb-1.5">2. Forma de pago</p>
                    {/* Toggle Pago Único / Pago Mixto */}
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <button type="button"
                        onClick={() => { setIsTableMixedMode(false); setMixedPaymentsTable([]); }}
                        className={`py-3 rounded-xl text-sm font-semibold transition ${!isTableMixedMode ? "bg-capsula-navy-deep text-capsula-cream" : "bg-capsula-ivory border border-capsula-line text-capsula-ink-muted hover:border-capsula-navy-deep/40"}`}
                      >Pago único</button>
                      <button type="button"
                        onClick={() => { setIsTableMixedMode(true); setAmountReceived(""); }}
                        className={`py-3 rounded-xl text-sm font-semibold transition inline-flex items-center justify-center gap-2 ${isTableMixedMode ? "bg-capsula-navy-deep text-capsula-cream" : "bg-capsula-ivory border border-capsula-line text-capsula-ink-muted hover:border-capsula-navy-deep/40"}`}
                      >
                        <Wallet className="h-4 w-4" />
                        Pago mixto
                      </button>
                    </div>
                    {!isTableMixedMode ? (
                      <div className="grid grid-cols-2 gap-2">
                        {SINGLE_PAY_METHODS.map((m) => (
                          <button key={m} onClick={() => { setPaymentMethod(m); setPaymentMethodTouched(true); }}
                            className={`py-3 rounded-xl text-sm font-semibold transition ${paymentMethodTouched && paymentMethod === m ? "bg-capsula-navy-deep text-capsula-cream" : "bg-capsula-ivory border border-capsula-line text-capsula-ink-soft hover:border-capsula-navy-deep/40"}`}>
                            {PAYMENT_LABELS[m]}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <MixedPaymentSelector
                          key={`table-mixed-${activeTab?.id}`}
                          totalAmount={paymentAmountToCharge}
                          exchangeRate={exchangeRate}
                          onChange={(lines, _paid, _complete) => setMixedPaymentsTable(lines)}
                          disabled={isProcessing}
                        />
                        {discountType === "DIVISAS_33" && divisasUsdAmountTable > 0 && (() => {
                          return (
                            <div className="rounded-xl bg-capsula-navy-soft border border-capsula-line-strong px-2 py-1.5 text-[10px] text-capsula-ink space-y-0.5 tabular-nums">
                              <div className="flex justify-between"><span>Divisas ${divisasUsdAmountTable.toFixed(2)}</span><span>−${(divisasUsdAmountTable * divisasRate).toFixed(2)}</span></div>
                              <div className="flex justify-between font-semibold text-capsula-ink"><span>Total a cobrar</span><span>${paymentAmountToCharge.toFixed(2)}</span></div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Resumen */}
                  {(() => {
                    return (
                      <div className="bg-capsula-ivory border border-capsula-line rounded-lg px-3 py-2 mb-2 text-xs space-y-1 tabular-nums">
                        <div className="flex justify-between text-capsula-ink-muted">
                          <span>Saldo</span>
                          <span>${activeTab.balanceDue.toFixed(2)}</span>
                        </div>
                        {discountType === "DIVISAS_33" && (
                          <div className="flex justify-between text-capsula-ink-soft">
                            <span>Descuento divisas</span>
                            <span>−${(activeTab.balanceDue * divisasRate).toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between mt-2 rounded-lg bg-[#E5EDE7] dark:bg-[#1E3B2C] px-3 py-1.5">
                          <span className="text-[11px] font-semibold text-[#2F6B4E] dark:text-[#6FB88F] uppercase tracking-[0.10em]">10% Servicio incluido</span>
                          <Check className="h-3.5 w-3.5 text-[#2F6B4E] dark:text-[#6FB88F]" />
                        </div>
                        {/* La "propina" del selector del mesero ES el mismo servicio del local
                            (UN solo 10%, no se duplica — §49). La propina extra al equipo se
                            registra después por "Propina colectiva" vinculada a la mesa. */}
                        <div className="flex justify-between font-semibold text-capsula-ink border-t border-capsula-line pt-1">
                          <span>A cobrar</span>
                          <span>${paymentAmountToCharge.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="relative mb-2">
                    <input
                      type="number"
                      value={amountReceived}
                      onChange={(e) => setAmountReceived(e.target.value)}
                      placeholder={isBsPayMethod && exchangeRate
                        ? `Bs ${(paymentAmountToCharge * exchangeRate).toFixed(2)}`
                        : `$${paymentAmountToCharge.toFixed(2)}`}
                      className="w-full bg-capsula-ivory border border-capsula-line rounded-lg px-3 py-2.5 text-capsula-ink text-sm placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none pr-14 tabular-nums transition"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-capsula-ink-muted">
                      {isBsPayMethod ? 'Bs' : 'USD'}
                    </span>
                  </div>
                  {/* Equivalente USD para Bs methods */}
                  {isBsPayMethod && exchangeRate && rawAmount > 0 && (
                    <div className="flex justify-between text-xs px-1 mb-2">
                      <span className="text-capsula-ink-muted">Equivalente USD</span>
                      <span className="font-semibold text-capsula-ink tabular-nums">${(rawAmount / exchangeRate).toFixed(2)}</span>
                    </div>
                  )}

                  {/* Vuelto + Propina inline (mesa, pago único en efectivo) */}
                  {!isTableMixedMode && !isBsPayMethod && paidAmount > paymentAmountToCharge + 0.001 && (() => {
                    const tableChange = paidAmount - paymentAmountToCharge;
                    const tipVal = Math.min(parseFloat(checkoutTip) || 0, tableChange);
                    const changeBack = tableChange - tipVal;
                    return (
                      <div className="rounded-xl border border-capsula-line-strong bg-capsula-ivory p-3 space-y-2 mb-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-capsula-ink-muted">Vuelto total:</span>
                          <span className="font-semibold text-capsula-ink tabular-nums">${tableChange.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-capsula-ink-muted shrink-0">Propina extra:</span>
                          <div className="flex-1 flex items-center bg-capsula-ivory-surface border border-capsula-line rounded-lg px-2">
                            <span className="text-xs text-capsula-ink-muted mr-1">$</span>
                            <input
                              type="number" min="0" step="0.01"
                              max={tableChange}
                              value={checkoutTip}
                              onChange={e => setCheckoutTip(e.target.value)}
                              placeholder="0.00"
                              className="flex-1 bg-transparent text-sm font-semibold text-capsula-ink focus:outline-none py-1 w-0 tabular-nums"
                            />
                          </div>
                        </div>
                        <div className="flex justify-between text-xs font-semibold pt-1 border-t border-capsula-line">
                          <span className="text-capsula-ink-muted">Vuelto a devolver:</span>
                          <span className="text-capsula-ink tabular-nums">${Math.max(0, changeBack).toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* CurrencyCalculator */}
                  <CurrencyCalculator
                    totalUsd={paidAmount > 0 ? paidAmount : paymentAmountToCharge}
                    hasServiceFee={false}
                    onRateUpdated={setExchangeRate}
                    inline
                    startCollapsed
                  />

                  {/* Register payment (requiere PIN) */}
                  <button
                    onClick={() => {
                      const linesForConfirmation: PaymentConfirmationLine[] = isTableMixedMode
                        ? mixedPaymentsTable.map(p => ({ method: p.method, amountUSD: p.amountUSD, amountBS: p.amountBS }))
                        : [{ method: paymentMethod, amountUSD: paidAmount }];
                      const totalForConfirmation = isTableMixedMode ? totalMixedTablePaid : paidAmount;
                      requestPaymentConfirmation(linesForConfirmation, totalForConfirmation, () => {
                        setPaymentPin("");
                        setPaymentPinError("");
                        // Pre-fill tip from mesero selection if cashier hasn't entered one yet
                        if (!checkoutTip && activeTab.tipAmount != null && activeTab.tipAmount > 0) {
                          setCheckoutTip(activeTab.tipAmount.toFixed(2));
                        }
                        setShowPaymentPinModal(true);
                      });
                    }}
                    disabled={isTableMixedMode ? (totalMixedTablePaid <= 0 || isProcessing) : (paidAmount <= 0 || isProcessing || !paymentMethodTouched)}
                    className="pos-btn w-full py-5 text-base disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                  >
                    <Lock className="h-4 w-4" />
                    Registrar pago ${isTableMixedMode
                      ? (totalMixedTablePaid > 0 ? totalMixedTablePaid.toFixed(2) : "0.00")
                      : (paidAmount > 0 ? paidAmount.toFixed(2) : "0.00")}
                  </button>

                  {/* Paid splits */}
                  {activeTab.paymentSplits.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {activeTab.paymentSplits.map((p) => {
                        // El label del server trae "| +N% serv" (N editable §85).
                        const svcMatch = (p.splitLabel || "").match(/\s*\|\s*\+(\d+)% serv/);
                        const hasService = Boolean(svcMatch);
                        const label = (p.splitLabel || "").replace(/\s*\|\s*\+\d+% serv/, "");
                        return (
                          <div
                            key={p.id}
                            className="flex justify-between items-center text-xs text-capsula-ink-soft bg-capsula-ivory border border-capsula-line rounded px-2 py-1"
                          >
                            <span>
                              {label}
                              {hasService && (
                                <span className="ml-1 text-capsula-ink font-semibold">+{svcMatch![1]}%</span>
                              )}
                            </span>
                            <span className="text-capsula-ink font-semibold tabular-nums">${p.paidAmount.toFixed(2)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <p className="mt-2 text-xs text-capsula-ink-muted text-center">La factura se imprime al registrar el pago. Reimprimir desde Historial de Ventas.</p>
                  {/* Close tab - permitir cerrar cuando no hay consumo (saldo 0) o ya se cobró */}
                  <button
                    onClick={handleCloseTab}
                    disabled={(Number(activeTab.balanceDue ?? 0) > 0.01) || isProcessing}
                    className="pos-btn-secondary mt-2 w-full py-2 text-xs disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Cerrar cuenta (saldo ${(Number(activeTab.balanceDue ?? 0)).toFixed(2)})
                  </button>
                </div>
              </div>
              )}
            </div>
          )}
        </aside>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: SELECCIÓN DE MESA                                         */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {showTableModal && selectedTable && (
        <div
          className="fixed inset-0 z-[60] bg-capsula-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={() => { setShowTableModal(false); resetTableState(); setSelectedTableId(""); }}
        >
          <div
            className="bg-capsula-ivory border border-capsula-line w-full max-w-sm mx-auto rounded-t-3xl sm:rounded-3xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-capsula-line p-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold tracking-[-0.02em] text-capsula-ink">{selectedTable.name}</h3>
                <p className="text-xs text-capsula-ink-muted mt-0.5">
                  {selectedTable.currentStatus === "AVAILABLE" ? "Mesa disponible" :
                   selectedTable.currentStatus === "OCCUPIED" ? "Mesa ocupada" :
                   selectedTable.currentStatus === "RESERVED" ? "Mesa reservada" : selectedTable.currentStatus}
                </p>
              </div>
              <button
                onClick={() => setShowTableModal(false)}
                className="h-8 w-8 rounded-full hover:bg-capsula-coral/10 hover:text-capsula-coral text-capsula-ink-muted flex items-center justify-center"
              ><XIcon className="h-4 w-4" /></button>
            </div>

            <div className="p-5 space-y-3">
              {!activeTab ? (
                /* Mesa libre */
                <>
                  <p className="text-sm text-capsula-ink-muted">¿Qué deseas hacer con esta mesa?</p>
                  <button
                    onClick={() => { setShowTableModal(false); setShowOpenTabModal(true); }}
                    className="pos-btn w-full min-h-[52px] text-lg inline-flex items-center justify-center gap-2"
                  >
                    <PlusIcon className="h-5 w-5" />
                    Abrir cuenta
                  </button>
                </>
              ) : (
                /* Mesa ocupada */
                <div className="space-y-3">
                  <div className="rounded-xl bg-capsula-ivory-surface border border-capsula-line p-3 text-sm space-y-1">
                    <div className="font-semibold text-capsula-ink truncate">{activeTab.customerLabel}</div>
                    {activeTab.customerPhone && (
                      <div className="text-capsula-ink-muted text-xs inline-flex items-center gap-1">
                        <PhoneIcon className="h-3 w-3" />
                        {activeTab.customerPhone}
                      </div>
                    )}
                    {(activeTab as any).waiterLabel && (
                      <div className="text-capsula-ink-muted text-xs inline-flex items-center gap-1">
                        <UserCircle2 className="h-3 w-3" />
                        {(activeTab as any).waiterLabel}
                      </div>
                    )}
                    <div className="flex justify-between pt-1 border-t border-capsula-line">
                      <span className="text-capsula-ink-muted">Balance:</span>
                      <span className="font-semibold text-capsula-ink tabular-nums">${activeTab.balanceDue.toFixed(2)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => { setShowTableModal(false); setMobileTab("menu"); }}
                    className="pos-btn w-full min-h-[52px] inline-flex items-center justify-center gap-2"
                  >
                    <UtensilsCrossed className="h-5 w-5" />
                    Agregar pedido
                  </button>
                  <button
                    onClick={() => { setShowTableModal(false); setMobileTab("account"); }}
                    className="pos-btn-secondary w-full min-h-[48px] text-sm inline-flex items-center justify-center gap-2"
                  >
                    <ReceiptIcon className="h-4 w-4" />
                    Ver cuenta
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: ABRIR CUENTA                                              */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: NUEVA VENTA PICKUP                                         */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {showPickupOpenModal && (
        <div className="fixed inset-0 z-[60] bg-capsula-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-capsula-ivory border border-capsula-line w-full max-w-md mx-auto rounded-t-3xl sm:rounded-3xl shadow-2xl">
            <div className="border-b border-capsula-line p-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold tracking-[-0.02em] text-capsula-ink inline-flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-capsula-ink" />
                Nueva venta Pickup
              </h3>
              <button
                onClick={() => setShowPickupOpenModal(false)}
                className="h-8 w-8 rounded-full hover:bg-capsula-coral/10 hover:text-capsula-coral text-capsula-ink-muted flex items-center justify-center"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">
                  Número de pickup del día
                </label>
                <div className="w-full bg-capsula-ivory-surface border border-capsula-line rounded-xl px-3 py-2.5 text-capsula-ink text-sm font-semibold tracking-wide flex items-center gap-2">
                  <span className="flex-1 tabular-nums">{newPickupNumber}</span>
                  {newPickupNumber === "PK-…" && (
                    <span className="text-xs text-capsula-ink-muted animate-pulse">calculando…</span>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">
                  Nombre del cliente <span className="text-capsula-ink-faint font-normal normal-case">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={newPickupName}
                  onChange={(e) => setNewPickupName(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  className="w-full bg-capsula-ivory-surface border border-capsula-line rounded-xl px-3 py-2.5 text-capsula-ink text-sm font-medium placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none transition"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">
                  Teléfono <span className="text-capsula-ink-faint font-normal normal-case">(opcional)</span>
                </label>
                <input
                  type="tel"
                  value={newPickupPhone}
                  onChange={(e) => setNewPickupPhone(e.target.value)}
                  placeholder="Ej: 0414-1234567"
                  className="w-full bg-capsula-ivory-surface border border-capsula-line rounded-xl px-3 py-2.5 text-capsula-ink text-sm font-medium placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none transition"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">
                  Hora de entrega <span className="text-capsula-ink-faint font-normal normal-case">(opcional)</span>
                </label>
                <input
                  type="datetime-local"
                  value={newPickupTime}
                  onChange={(e) => setNewPickupTime(e.target.value)}
                  className="w-full bg-capsula-ivory-surface border border-capsula-line rounded-xl px-3 py-2.5 text-capsula-ink text-sm font-semibold tabular-nums placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none transition"
                />
                <p className="mt-1 text-[10px] font-medium text-capsula-ink-muted">
                  Si la captura, se imprime grande en la comanda de cocina/barra.
                </p>
              </div>
            </div>
            <div className="border-t border-capsula-line p-4 flex gap-3">
              <button
                onClick={() => setShowPickupOpenModal(false)}
                className="pos-btn-secondary flex-1 py-3 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreatePickupTab}
                disabled={isProcessing}
                className="pos-btn flex-[2] py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                <Check className="h-4 w-4" />
                Abrir Pickup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: ABRIR CUENTA                                              */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {showOpenTabModal && selectedTable && (
        <div className="fixed inset-0 z-[60] bg-capsula-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-capsula-ivory border border-capsula-line w-full max-w-md mx-auto rounded-t-3xl sm:rounded-3xl shadow-2xl">
            <div className="border-b border-capsula-line p-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold tracking-[-0.02em] text-capsula-ink">Abrir cuenta</h3>
                <p className="text-xs text-capsula-ink-muted mt-0.5">{selectedTable.name}</p>
              </div>
              <button
                onClick={() => setShowOpenTabModal(false)}
                className="h-8 w-8 rounded-full hover:bg-capsula-coral/10 hover:text-capsula-coral text-capsula-ink-muted flex items-center justify-center"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">
                  Nombre del cliente <span className="text-capsula-ink-faint font-normal normal-case">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={openTabName}
                  onChange={(e) => setOpenTabName(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  className="w-full bg-capsula-ivory-surface border border-capsula-line rounded-xl px-3 py-2.5 text-capsula-ink text-sm font-medium placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none transition"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">Número de personas</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setOpenTabGuests(Math.max(1, openTabGuests - 1))}
                      className="w-9 h-9 bg-capsula-ivory-surface border border-capsula-line rounded-lg font-semibold text-lg text-capsula-ink hover:border-capsula-coral/40 hover:text-capsula-coral transition"
                    >
                      −
                    </button>
                    <span className="flex-1 text-center font-semibold text-lg text-capsula-ink tabular-nums">{openTabGuests}</span>
                    <button
                      onClick={() => setOpenTabGuests(openTabGuests + 1)}
                      className="w-9 h-9 bg-capsula-navy-deep text-capsula-cream rounded-lg font-semibold text-lg hover:bg-capsula-navy-deep/90 transition"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">Mesonero asignado</label>
                  <select
                    value={openTabWaiter}
                    onChange={(e) => setOpenTabWaiter(e.target.value)}
                    className="w-full bg-capsula-ivory-surface border border-capsula-line rounded-xl px-3 py-2 text-capsula-ink text-sm font-medium focus:border-capsula-navy-deep focus:outline-none transition"
                  >
                    <option value="">— Ninguno —</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="border-t border-capsula-line p-4 flex gap-3">
              <button
                onClick={() => setShowOpenTabModal(false)}
                className="pos-btn-secondary flex-1 py-3 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleOpenTab}
                disabled={isProcessing}
                className="pos-btn flex-[2] py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {isProcessing ? "Abriendo…" : (<><Check className="h-4 w-4" />Abrir cuenta</>)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: PIN CAJERA — REGISTRAR PAGO                               */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {showPaymentPinModal && activeTab && (
        <div className="fixed inset-0 z-[60] bg-capsula-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-capsula-ivory border border-capsula-line w-full max-w-sm mx-auto rounded-t-3xl sm:rounded-3xl shadow-2xl">
            <div className="border-b border-capsula-line p-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold tracking-[-0.02em] text-capsula-ink inline-flex items-center gap-2">
                <Lock className="h-5 w-5 text-capsula-ink" />
                Autorizar cobro
              </h3>
              <button
                onClick={() => setShowPaymentPinModal(false)}
                className="h-8 w-8 rounded-full hover:bg-capsula-coral/10 hover:text-capsula-coral text-capsula-ink-muted flex items-center justify-center"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-capsula-ivory-surface border border-capsula-line rounded-xl p-3 text-sm space-y-1 tabular-nums">
                <div className="flex justify-between">
                  <span className="text-capsula-ink-muted">Método:</span>
                  <span className="font-semibold text-capsula-ink">{PAYMENT_LABELS[paymentMethod]}</span>
                </div>
                {discountType === "DIVISAS_33" && activeTab && (
                  <div className="flex justify-between text-capsula-ink-soft text-xs">
                    <span>Descuento −{divisasPctLabel}%:</span>
                    <span>−${(activeTab.balanceDue * divisasRate).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-capsula-ink-muted">Monto:</span>
                  <span className="font-semibold text-capsula-ink text-base">${paidAmount.toFixed(2)}</span>
                </div>
                {exchangeRate && (
                  <div className="flex justify-between text-capsula-ink-muted text-xs">
                    <span>Equivalente Bs:</span>
                    <span>Bs. {(paidAmount * exchangeRate).toFixed(2)}</span>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">PIN de cajera / gerente</label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={paymentPin}
                  onChange={(e) => {
                    setPaymentPin(e.target.value);
                    setPaymentPinError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handlePaymentPinConfirm()}
                  placeholder="••••••"
                  className="w-full bg-capsula-ivory-surface border border-capsula-line rounded-xl px-3 py-3 text-capsula-ink text-center text-xl tracking-[0.3em] placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none transition"
                />
                {paymentPinError && <p className="text-capsula-coral text-xs mt-1 font-semibold">{paymentPinError}</p>}
              </div>
            </div>
            <div className="border-t border-capsula-line p-4 flex gap-3">
              <button
                onClick={() => setShowPaymentPinModal(false)}
                className="pos-btn-secondary flex-1 py-3 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handlePaymentPinConfirm}
                disabled={!paymentPin || isProcessing}
                className="pos-btn flex-[2] py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {isProcessing ? "Procesando…" : (<><Check className="h-4 w-4" />Confirmar pago</>)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: CORTESÍA (PIN + PORCENTAJE)                               */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {showCortesiaModal && (
        <div className="fixed inset-0 z-[60] bg-capsula-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-capsula-ivory border border-capsula-line w-full max-w-sm mx-auto rounded-t-3xl sm:rounded-3xl shadow-2xl">
            <div className="border-b border-capsula-line p-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold tracking-[-0.02em] text-capsula-ink inline-flex items-center gap-2">
                <Gift className="h-5 w-5 text-capsula-coral" />
                Cortesía
              </h3>
              <button onClick={() => setShowCortesiaModal(false)} className="h-8 w-8 rounded-full hover:bg-capsula-coral/10 hover:text-capsula-coral text-capsula-ink-muted flex items-center justify-center">
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">% de cortesía</label>
                <div className="flex gap-2 mb-2">
                  {["25", "50", "75", "100"].map(v => (
                    <button key={v} onClick={() => setCortesiaPercent(v)}
                      className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${cortesiaPercent === v ? "bg-capsula-coral text-capsula-cream" : "bg-capsula-ivory-surface border border-capsula-line text-capsula-ink-soft hover:border-capsula-coral/40"}`}>
                      {v}%
                    </button>
                  ))}
                </div>
                <input
                  type="number" min="1" max="100"
                  value={cortesiaPercent}
                  onChange={e => setCortesiaPercent(e.target.value)}
                  className="w-full bg-capsula-ivory-surface border border-capsula-line rounded-xl px-3 py-2 text-capsula-ink text-center text-lg font-semibold placeholder:text-capsula-ink-muted focus:border-capsula-coral focus:outline-none transition tabular-nums"
                  placeholder="% personalizado"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">PIN de gerente / dueño</label>
                <div className="bg-capsula-ivory-surface border border-capsula-line p-3 rounded-xl text-2xl tracking-[0.3em] text-center font-mono text-capsula-ink mb-3 min-h-[3rem]">
                  {cortesiaPin.replace(/./g, "•")}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[1,2,3,4,5,6,7,8,9,0].map(n => (
                    <button key={n} onClick={() => handleCortesiaPinKey(n.toString())}
                      className="bg-capsula-ivory-surface border border-capsula-line hover:border-capsula-navy-deep/40 text-capsula-ink rounded-lg py-3 font-semibold text-xl transition">{n}</button>
                  ))}
                  <button onClick={() => handleCortesiaPinKey("clear")} className="bg-capsula-coral/10 hover:bg-capsula-coral/20 border border-capsula-coral/30 text-capsula-coral rounded-lg py-3 font-semibold text-sm transition">C</button>
                  <button onClick={() => handleCortesiaPinKey("back")} className="bg-capsula-ivory-surface border border-capsula-line hover:border-capsula-navy-deep/40 text-capsula-ink rounded-lg py-3 font-semibold transition">⌫</button>
                </div>
                {cortesiaPinError && <p className="text-capsula-coral text-xs mt-2 text-center font-semibold">{cortesiaPinError}</p>}
              </div>
            </div>
            <div className="border-t border-capsula-line p-4 flex gap-3">
              <button onClick={() => setShowCortesiaModal(false)} className="pos-btn-secondary flex-1 py-3 text-sm">Cancelar</button>
              <button onClick={handleCortesiaPinConfirm} disabled={!cortesiaPin} className="flex-[2] py-3 rounded-xl font-semibold text-sm bg-capsula-coral text-capsula-cream hover:bg-capsula-coral-hover transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2">
                <Gift className="h-4 w-4" />
                Aplicar cortesía
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: MODIFICAR ÍTEM ENVIADO                                    */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {showRemoveModal && removeTarget && (() => {
        const replaceItems = allMenuItems.filter((m: MenuItem) =>
          m.id !== removeTarget.itemId &&
          (!removeReplaceSearch.trim() || m.name.toLowerCase().includes(removeReplaceSearch.toLowerCase()))
        ).slice(0, 30);
        return (
          <div className="fixed inset-0 z-[60] bg-capsula-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-capsula-ivory border border-capsula-line w-full max-w-md mx-auto rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto">
              {/* Header */}
              <div className="border-b border-capsula-line p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="h-10 w-10 bg-capsula-coral/10 rounded-xl flex items-center justify-center text-capsula-coral flex-shrink-0">
                    <Pencil className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold tracking-[-0.02em] text-capsula-ink">Modificar ítem</h3>
                    <p className="text-xs text-capsula-ink-muted mt-0.5 truncate">
                      <span className="font-semibold text-capsula-ink">{removeTarget.quantity}×</span> {removeTarget.itemName}
                      <span className="ml-2 text-capsula-coral font-semibold tabular-nums">−${removeTarget.lineTotal.toFixed(2)}</span>
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowRemoveModal(false)} className="h-8 w-8 rounded-full hover:bg-capsula-coral/10 hover:text-capsula-coral text-capsula-ink-muted flex items-center justify-center ml-2 shrink-0">
                  <XIcon className="h-4 w-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Opciones */}
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
                    <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-2">
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
                    <p className="text-[10px] text-capsula-ink-muted mt-1.5 text-center">
                      Se anularán {removeTarget.quantity - removeNewQty} unidad(es)
                    </p>
                  </div>
                )}

                {/* Cambiar por otro ítem */}
                {removeModType === "REPLACE" && (
                  <div className="space-y-2">
                    <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Producto de reemplazo</label>
                    <input
                      value={removeReplaceSearch}
                      onChange={(e) => setRemoveReplaceSearch(e.target.value)}
                      placeholder="Buscar producto…"
                      className="w-full bg-capsula-ivory-surface border border-capsula-line rounded-xl px-3 py-2 text-sm font-medium text-capsula-ink placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none transition"
                    />
                    <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                      {replaceItems.map((m: MenuItem) => (
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
                  <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">
                    Motivo <span className="text-capsula-coral normal-case tracking-normal">*</span>
                  </label>
                  <textarea
                    value={removeJustification}
                    onChange={(e) => { setRemoveJustification(e.target.value); setRemoveError(""); }}
                    placeholder="Ej: Error de pedido, cliente cambió de opinión…"
                    rows={2}
                    className="w-full bg-capsula-ivory-surface border border-capsula-line rounded-xl px-3 py-2 text-sm text-capsula-ink placeholder:text-capsula-ink-muted resize-none focus:border-capsula-coral focus:outline-none transition"
                  />
                </div>

                {/* PIN */}
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">
                    PIN de capitán / gerente <span className="text-capsula-coral normal-case tracking-normal">*</span>
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    value={removePin}
                    onChange={(e) => { setRemovePin(e.target.value); setRemoveError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && handleRemoveItem()}
                    placeholder="••••••"
                    className="w-full bg-capsula-ivory-surface border border-capsula-line rounded-xl px-3 py-3 text-capsula-ink text-center text-xl tracking-[0.3em] placeholder:text-capsula-ink-muted focus:border-capsula-coral focus:outline-none transition"
                  />
                  {removeError && <p className="text-capsula-coral text-xs mt-1 font-semibold">{removeError}</p>}
                </div>
              </div>

              <div className="border-t border-capsula-line p-4 flex gap-3">
                <button onClick={() => setShowRemoveModal(false)} className="pos-btn-secondary flex-1 py-3 text-sm">
                  Cancelar
                </button>
                <button
                  onClick={handleRemoveItem}
                  disabled={!removePin.trim() || !removeJustification.trim() || isProcessing}
                  className="flex-[2] py-3 rounded-xl font-semibold text-sm bg-capsula-coral text-capsula-cream hover:bg-capsula-coral-hover transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  {isProcessing ? "Procesando…" : (
                    removeModType === "VOID"       ? (<><Ban className="h-4 w-4" />Anular ítem</>) :
                    removeModType === "ADJUST_QTY" ? (<><Pencil className="h-4 w-4" />Ajustar cantidad</>) :
                                                     (<><RefreshCw className="h-4 w-4" />Confirmar cambio</>)
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: ANULAR COMANDA COMPLETA                                    */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {voidOrderTarget && (
        <div className="fixed inset-0 z-[60] bg-capsula-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-capsula-ivory w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-capsula-line shadow-2xl">
            <div className="border-b border-capsula-line p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 bg-capsula-coral/10 rounded-2xl flex items-center justify-center text-capsula-coral flex-shrink-0">
                  <Ban className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg tracking-[-0.02em] text-capsula-ink">Anular comanda completa</h3>
                  <p className="text-xs text-capsula-ink-muted">
                    <span className="font-semibold text-capsula-ink">{voidOrderTarget.itemCount}</span> ítem(s)
                    <span className="ml-2 tabular-nums">${voidOrderTarget.total.toFixed(2)}</span>
                  </p>
                </div>
              </div>
              <button onClick={() => setVoidOrderTarget(null)} className="h-8 w-8 rounded-full hover:bg-capsula-coral/10 hover:text-capsula-coral text-capsula-ink-muted flex items-center justify-center">
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-start gap-2 bg-[#F7E3DB] dark:bg-[#3B1F14] text-[#B04A2E] dark:text-[#EFD2C8] rounded-xl px-3 py-2.5">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p className="text-xs font-semibold">
                  Se anularán TODOS los ítems de esta comanda de una vez. El inventario se reintegra automáticamente y la anulación se imprime en cocina/barra.
                </p>
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1.5 block">
                  Motivo (obligatorio)
                </label>
                <textarea
                  value={voidOrderReason}
                  onChange={(e) => { setVoidOrderReason(e.target.value); setVoidOrderError(""); }}
                  placeholder="Ej: comanda marchada a mesa equivocada..."
                  className="w-full bg-capsula-ivory-surface border border-capsula-line text-capsula-ink rounded-xl p-3 text-sm font-medium placeholder:text-capsula-ink-muted focus:border-capsula-coral focus:outline-none resize-none h-14 transition"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1.5 block">
                  PIN de capitán o gerente
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={voidOrderPin}
                  onChange={(e) => { setVoidOrderPin(e.target.value); setVoidOrderError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleVoidEntireOrder()}
                  placeholder="••••••"
                  className="w-full bg-capsula-ivory-surface border border-capsula-line rounded-xl px-3 py-3 text-capsula-ink text-center text-xl tracking-[0.3em] placeholder:text-capsula-ink-muted focus:border-capsula-coral focus:outline-none transition"
                />
                {voidOrderError && <p className="text-capsula-coral text-xs mt-1 font-semibold">{voidOrderError}</p>}
              </div>
            </div>

            <div className="border-t border-capsula-line p-4 flex gap-3">
              <button onClick={() => setVoidOrderTarget(null)} className="pos-btn-secondary flex-1 py-3 text-sm">
                Cancelar
              </button>
              <button
                onClick={handleVoidEntireOrder}
                disabled={!voidOrderPin.trim() || !voidOrderReason.trim() || isProcessing}
                className="flex-[2] py-3 rounded-xl font-semibold text-sm bg-capsula-coral text-capsula-cream hover:bg-capsula-coral-hover transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {isProcessing ? "Anulando…" : (<><Ban className="h-4 w-4" />Anular comanda completa</>)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: MODIFICADORES                                              */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {showModifierModal && selectedItemForModifier && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-capsula-ink/60 backdrop-blur-sm p-4">
          <div className="max-h-[92vh] sm:max-h-[90vh] w-full max-w-lg mx-auto overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-capsula-line bg-capsula-ivory shadow-2xl">
            <div className="border-b border-capsula-line p-5 flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold tracking-[-0.02em] text-capsula-ink">{selectedItemForModifier.name}</h3>
                <p className="mt-1 text-lg font-semibold text-capsula-ink tabular-nums">${selectedItemForModifier.price.toFixed(2)}</p>
              </div>
              <button onClick={() => setShowModifierModal(false)} className="h-8 w-8 rounded-full hover:bg-capsula-coral/10 hover:text-capsula-coral text-capsula-ink-muted flex items-center justify-center">
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              {selectedItemForModifier.modifierGroups.map((gr) => {
                const group = gr.modifierGroup;
                const totalSel = currentModifiers
                  .filter((m) => m.groupId === group.id)
                  .reduce((s, m) => s + m.quantity, 0);
                const isValid = !group.isRequired || totalSel >= group.minSelections;
                return (
                  <div key={group.id} className={`rounded-xl border p-4 transition-colors ${isValid ? "border-capsula-line bg-capsula-ivory-surface" : "border-capsula-coral bg-capsula-coral/5"}`}>
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-semibold text-sm uppercase tracking-[0.14em] text-capsula-ink-soft">
                        {group.name}
                        {group.isRequired && <span className="text-capsula-coral ml-1">*</span>}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${isValid ? "bg-capsula-navy-soft text-capsula-ink" : "bg-capsula-coral text-capsula-cream"}`}>
                        {totalSel}/{group.maxSelections}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {(() => {
                        // Agrupar modifiers en toggles SIN/CON cuando los
                        // nombres siguen la convención (ver pos-modifier-grouping).
                        // El resto se renderiza como antes (passThrough).
                        const { toggles, passThrough } = groupModifiersForSinCon(
                          group.modifiers as any,
                        );
                        const selectedIdSet = new Set(
                          currentModifiers
                            .filter((m) => m.groupId === group.id)
                            .map((m) => m.id),
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
                            {passThrough.map((modifier) => {
                              const sel = currentModifiers.find((m) => m.id === modifier.id && m.groupId === group.id);
                              const qty = sel?.quantity || 0;
                              const isRadio = group.maxSelections === 1;
                              const modOption = modifier as unknown as ModifierOption;
                              return (
                                <div key={modifier.id}>
                                <div
                                  className={`flex items-center justify-between rounded-lg px-3 py-2 border transition ${qty > 0 ? "bg-capsula-navy-soft border-capsula-navy-deep" : "bg-capsula-ivory border-capsula-line"}`}
                                >
                                  <div>
                                    <div className="text-sm font-semibold text-capsula-ink">{modifier.name}</div>
                                    {modifier.priceAdjustment !== 0 && (
                                      <div className="text-xs text-capsula-ink-muted tabular-nums">+${modifier.priceAdjustment.toFixed(2)}</div>
                                    )}
                                  </div>
                                  {isRadio ? (
                                    <button
                                      onClick={() => updateModifierQuantity(group, modifier as any, 1)}
                                      className={`h-7 w-7 rounded-full border flex items-center justify-center transition ${qty > 0 ? "border-capsula-navy-deep bg-capsula-navy-deep text-capsula-cream" : "border-capsula-line hover:border-capsula-navy-deep"}`}
                                    >
                                      {qty > 0 && <Check className="h-3.5 w-3.5" />}
                                    </button>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => updateModifierQuantity(group, modifier as any, -1)}
                                        className="h-8 w-8 rounded-lg bg-capsula-ivory border border-capsula-line font-semibold text-capsula-ink hover:border-capsula-coral/40 hover:text-capsula-coral transition"
                                      >
                                        −
                                      </button>
                                      <span className="w-5 text-center font-semibold text-capsula-ink tabular-nums">{qty}</span>
                                      <button
                                        onClick={() => updateModifierQuantity(group, modifier as any, 1)}
                                        className="h-8 w-8 rounded-lg bg-capsula-navy-deep font-semibold text-capsula-cream hover:bg-capsula-navy-deep/90 transition"
                                      >
                                        +
                                      </button>
                                    </div>
                                  )}
                                </div>
                                {/* Sub-grupo anidado (§82) */}
                                {qty > 0 && hasChildGroup(modOption) && (
                                  <ChildGroupSelector
                                    childGroup={modOption.childGroup}
                                    selections={currentModifiers}
                                    onSelect={(cg, child, change) => updateModifierQuantity(cg as ModifierGroup, child as ModifierOption, change)}
                                  />
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

              <SinIngredientsSection
                ingredients={selectedItemForModifier.sinIngredients ?? []}
                selected={sinSelected}
                onToggle={(id) => setSinSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])}
              />

              <div className="rounded-xl border border-capsula-line bg-capsula-ivory-surface p-4">
                <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-2">Notas</label>
                <textarea
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  className="h-16 w-full resize-none rounded-lg border border-capsula-line bg-capsula-ivory px-3 py-2 text-sm text-capsula-ink placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none transition"
                  placeholder="Sin hielo, extra limón…"
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-capsula-line bg-capsula-ivory-surface p-4">
                <span className="font-semibold uppercase tracking-[0.14em] text-capsula-ink">Cantidad</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))}
                    className="h-10 w-10 rounded-full bg-capsula-ivory border border-capsula-line font-semibold text-xl text-capsula-ink hover:border-capsula-coral/40 hover:text-capsula-coral transition"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-xl font-semibold text-capsula-ink tabular-nums">{itemQuantity}</span>
                  <button
                    onClick={() => setItemQuantity(itemQuantity + 1)}
                    className="h-10 w-10 rounded-full bg-capsula-navy-deep font-semibold text-xl text-capsula-cream hover:bg-capsula-navy-deep/90 transition"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Para llevar — solo disponible en mesas (no pickup) */}
              {activeTab && (
                <button
                  type="button"
                  onClick={() => setItemTakeaway(!itemTakeaway)}
                  className={`w-full rounded-xl border p-4 flex items-center justify-between transition-all ${
                    itemTakeaway
                      ? "border-capsula-navy-deep bg-capsula-navy-soft text-capsula-ink"
                      : "border-capsula-line bg-capsula-ivory-surface text-capsula-ink-muted"
                  }`}
                >
                  <span className="font-semibold">Para llevar</span>
                  <span className={`text-xs font-semibold uppercase tracking-wider ${itemTakeaway ? "text-capsula-ink" : "text-capsula-ink-muted"}`}>
                    {itemTakeaway ? "Sí — aparecerá en comanda" : "No"}
                  </span>
                </button>
              )}
            </div>

            <div className="flex gap-3 border-t border-capsula-line p-5">
              <button
                onClick={() => setShowModifierModal(false)}
                className="pos-btn-secondary flex-1 py-3 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={confirmAddToCart}
                disabled={
                  selectedItemForModifier.modifierGroups.some((g) => !isGroupValid(g.modifierGroup)) ||
                  !childGroupsValid(currentModifiers, selectedItemForModifier.modifierGroups.map((g) => g.modifierGroup))
                }
                className="pos-btn flex-[2] py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                <PlusIcon className="h-4 w-4" />
                Agregar al carrito
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Navegación móvil — solo visible en móvil/tablet */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-capsula-ivory border-t border-capsula-line flex z-50 shadow-xl safe-area-inset-bottom">
        {(["tables", "menu", "account"] as const).map((tab) => {
          const Icon = tab === "tables" ? Armchair : tab === "menu" ? UtensilsCrossed : ReceiptIcon;
          const labels = { tables: "Mesas", menu: "Menú", account: "Cuenta" };
          const active = mobileTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              className={`flex-1 min-h-[56px] py-2 flex flex-col items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] relative transition-colors
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
            </button>
          );
        })}
      </nav>

      {/* Modal de confirmación pre-cobro (flag requirePaymentConfirmation) */}
      <PaymentConfirmationModal
        open={paymentConfirmationPending !== null}
        totalUSD={paymentConfirmationPending?.totalUSD ?? 0}
        lines={paymentConfirmationPending?.lines ?? []}
        onCancel={() => setPaymentConfirmationPending(null)}
        onConfirm={() => {
          const pending = paymentConfirmationPending;
          setPaymentConfirmationPending(null);
          pending?.onConfirm();
        }}
      />

      {/* §113 — Encuesta de satisfacción tras cerrar la cuenta (omitible). */}
      {surveyFor && (
        <SatisfactionSurveyCard
          openTabId={surveyFor.openTabId}
          tabCode={surveyFor.tabCode}
          tableName={surveyFor.tableName}
          waiterName={surveyFor.waiterName}
          onDone={() => setSurveyFor(null)}
        />
      )}
    </div>
  );
}
