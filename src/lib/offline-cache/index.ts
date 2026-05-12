/**
 * Barrel export del módulo offline-cache. Importar desde
 * '@/lib/offline-cache' en lugar de paths internos.
 */
export {
    getOfflineDB,
    readCache,
    writeCache,
    clearAllCaches,
    type CachedRecord,
    type CartRecord,
} from './db';

export {
    type NetworkState,
    checkNetworkNow,
    subscribeNetworkStatus,
    startNetworkMonitor,
    stopNetworkMonitor,
    getNetworkState,
} from './network-status';

export { saveMenuCache, loadMenuCache } from './menu-cache';
export { saveLayoutCache, loadLayoutCache } from './layout-cache';
export { saveTabsCache, loadTabsCache } from './tabs-cache';
export { saveCart, loadCart, deleteCart, listCarts } from './cart-cache';
