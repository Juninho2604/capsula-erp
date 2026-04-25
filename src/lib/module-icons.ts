import type { LucideIcon } from 'lucide-react';
import {
    BarChart3, TrendingUp, CalendarDays, Package, ClipboardCheck, Shield, ArrowLeftRight,
    History, Coins, ChefHat, Factory, DollarSign, Target, ShoppingCart, Beef, UserCheck,
    Palette, Wand2, UtensilsCrossed, Settings2, Salad, Smartphone, Bike, Monitor,
    PlusSquare, FileClock, Flame, GlassWater, Wrench, Gamepad2, Calendar, Hand, ListChecks,
    Building2, Users, UserCog, KeyRound, SlidersHorizontal, Warehouse, RefreshCw, Megaphone,
    Flag, Wallet, Receipt, Banknote, FileText, ClipboardList,
} from 'lucide-react';

/**
 * Mapa de lucide icons por módulo id.
 * El Sidebar (y otros consumidores que quieran) pueden usar
 * MODULE_ICONS[mod.id] para obtener un icono vector consistente
 * con el design system Minimal Navy, en vez del emoji legacy de
 * MODULE_REGISTRY.icon.
 *
 * Si un id no está aquí, el consumidor puede hacer fallback al emoji.
 */
export const MODULE_ICONS: Record<string, LucideIcon> = {
    // OPERACIONES
    dashboard:         BarChart3,
    estadisticas:      TrendingUp,
    inventory_daily:   CalendarDays,
    inventory:         Package,
    inventory_count:   ClipboardCheck,
    audits:            Shield,
    transfers:         ArrowLeftRight,
    inventory_history: History,
    loans:             Coins,
    recipes:           ChefHat,
    production:        Factory,
    costs:             DollarSign,
    margen:            Target,
    purchases:         ShoppingCart,
    proteins:          Beef,
    mesoneros:         UserCheck,
    sku_studio:        Palette,
    asistente:         Wand2,
    menu:              UtensilsCrossed,
    modifiers:         Settings2,

    // VENTAS & POS
    pos_restaurant:    Salad,
    pos_waiter:        Smartphone,
    pos_delivery:      Bike,
    pedidosya:         Bike,
    sales_entry:       PlusSquare,
    sales_history:     FileClock,
    kitchen_display:   Flame,
    barra_display:     GlassWater,
    pos_config:        Wrench,

    // ENTRETENIMIENTO
    games:             Gamepad2,
    reservations:      Calendar,
    wristbands:        Hand,
    queue:             ListChecks,
    intercompany:      Building2,

    // ADMINISTRACIÓN
    users:             Users,
    modulos_usuario:   UserCog,
    roles_config:      KeyRound,
    module_config:     SlidersHorizontal,
    almacenes:         Warehouse,
    tasa_cambio:       RefreshCw,
    anuncios:          Megaphone,
    metas:             Flag,

    // FINANZAS
    finanzas:          Wallet,
    gastos:            Receipt,
    caja:              Banknote,
    cuentas_pagar:     FileText,
};

/**
 * Iconos para sub-grupos de Sidebar (no tienen id en MODULE_REGISTRY).
 */
export const SUBGROUP_ICONS: Record<string, LucideIcon> = {
    'sg-inventario':   Package,
    'sg-produccion':   Factory,
    'sg-costos':       DollarSign,
    'sg-catalogo':     ClipboardList,
    'sg-pos':          ShoppingCart,
    'sg-ventas':       TrendingUp,
    'sg-pantallas':    Monitor,
    'sg-equipo':       Users,
    'sg-config-admin': Settings2,
    'sg-gestion':      Building2,
};
