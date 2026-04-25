'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { useUIStore } from '@/stores/ui.store';
import { ROLE_INFO } from '@/lib/constants/roles';
import { UserRole } from '@/types';
import { logoutAction } from '@/app/actions/auth.actions';
import { ChangePasswordDialog } from '@/components/users/ChangePasswordDialog';
import { getVisibleModules, type ModuleDefinition } from '@/lib/constants/modules-registry';
import { MODULE_ICONS, SUBGROUP_ICONS } from '@/lib/module-icons';
import { CapsulaNavbarLogo } from '@/components/ui/CapsulaLogo';
import { X, User, LogOut, Search } from 'lucide-react';

// ── Props ──────────────────────────────────────────────────────────────────────

interface SidebarProps {
    initialUser?: any; // SessionPayload
    enabledModuleIds?: string[]; // Viene de la BD vía DashboardLayout
    userAllowedModules?: string[] | null; // Permisos individuales del usuario (null = sin restricción)
}

// ── Tree types ─────────────────────────────────────────────────────────────────

type TreeLink     = { kind: 'link';     moduleId: string };
type TreeSubGroup = { kind: 'subgroup'; id: string; label: string; icon: string; items: string[] };
type TreeItem     = TreeLink | TreeSubGroup;
type ColorScheme  = 'coral' | 'green' | 'purple' | 'navy' | 'blue';

interface SectionDef {
    id:     string;
    label:  string;
    scheme: ColorScheme;
    items:  TreeItem[];
}

// ── SIDEBAR_TREE ───────────────────────────────────────────────────────────────
// Árbol visual. El campo `section` del registry es informativo: la ubicación
// real del módulo en el sidebar la manda este tree (ver D4).

const SIDEBAR_TREE: SectionDef[] = [
    {
        id: 'operations', label: 'Operaciones', scheme: 'coral',
        items: [
            { kind: 'link', moduleId: 'dashboard' },
            { kind: 'link', moduleId: 'estadisticas' },
            {
                kind: 'subgroup', id: 'sg-inventario', label: 'Inventario', icon: '📦',
                items: ['inventory', 'inventory_daily', 'inventory_count', 'audits', 'transfers', 'inventory_history'],
            },
            {
                kind: 'subgroup', id: 'sg-produccion', label: 'Producción', icon: '🏭',
                items: ['recipes', 'production', 'proteins', 'loans'],
            },
            {
                kind: 'subgroup', id: 'sg-costos', label: 'Costos', icon: '💰',
                items: ['costs', 'margen'],
            },
            {
                kind: 'subgroup', id: 'sg-catalogo', label: 'Catálogo', icon: '🗂️',
                items: ['menu', 'modifiers', 'sku_studio'],
            },
        ],
    },
    {
        id: 'sales', label: 'Ventas & POS', scheme: 'green',
        items: [
            {
                kind: 'subgroup', id: 'sg-pos', label: 'POS', icon: '🖥️',
                items: ['pos_restaurant', 'pos_waiter', 'pos_delivery', 'pedidosya'],
            },
            {
                kind: 'subgroup', id: 'sg-ventas', label: 'Ventas', icon: '📊',
                items: ['sales_entry', 'sales_history'],
            },
            {
                kind: 'subgroup', id: 'sg-pantallas', label: 'Pantallas', icon: '🖥️',
                items: ['kitchen_display', 'barra_display'],
            },
            { kind: 'link', moduleId: 'pos_config' },
        ],
    },
    {
        id: 'entertainment', label: 'Entretenimiento', scheme: 'purple',
        items: [
            { kind: 'link', moduleId: 'games' },
            { kind: 'link', moduleId: 'reservations' },
            { kind: 'link', moduleId: 'wristbands' },
            { kind: 'link', moduleId: 'queue' },
        ],
    },
    // D4: Finanzas es sección propia, no anidada bajo admin
    {
        id: 'finanzas', label: 'Finanzas', scheme: 'navy',
        items: [
            { kind: 'link', moduleId: 'finanzas' },
            { kind: 'link', moduleId: 'gastos' },
            { kind: 'link', moduleId: 'caja' },
            { kind: 'link', moduleId: 'cuentas_pagar' },
            { kind: 'link', moduleId: 'purchases' },
            { kind: 'link', moduleId: 'tasa_cambio' },
            { kind: 'link', moduleId: 'intercompany' },
        ],
    },
    {
        id: 'admin', label: 'Administración', scheme: 'blue',
        items: [
            {
                kind: 'subgroup', id: 'sg-equipo', label: 'Equipo', icon: '👥',
                items: ['users', 'mesoneros'],
            },
            {
                // D3: 'modulos' (typo legacy) corregido a 'module_config'; 'modulos_usuario' explícito
                kind: 'subgroup', id: 'sg-config-admin', label: 'Configuración', icon: '⚙️',
                items: ['roles_config', 'module_config', 'modulos_usuario'],
            },
            {
                kind: 'subgroup', id: 'sg-gestion', label: 'Gestión', icon: '🏢',
                items: ['almacenes', 'metas', 'anuncios'],
            },
            { kind: 'link', moduleId: 'asistente' },
        ],
    },
];

const ORPHAN_SECTION_ID = 'otros';

// ── Color scheme classes ───────────────────────────────────────────────────────

// Minimal Navy: todos los schemes se unifican a tokens de marca.
// Los 5 nombres se conservan para compatibilidad con SIDEBAR_TREE.
const BASE_SCHEME = {
    sectionText:  'text-capsula-ink',
    sectionHover: 'hover:bg-capsula-ivory-alt',
    activeLink:   'bg-capsula-navy-soft text-capsula-ink font-medium',
    dot:          'bg-capsula-coral',
    sgHover:      'hover:bg-capsula-ivory-alt',
    linkHover:    'hover:bg-capsula-ivory-alt hover:text-capsula-ink',
    chevron:      'text-capsula-ink-muted',
} as const;

const CORAL_SCHEME = {
    ...BASE_SCHEME,
    activeLink: 'bg-capsula-coral-subtle text-capsula-coral font-medium',
    dot:        'bg-capsula-coral',
    linkHover:  'hover:bg-capsula-coral-subtle hover:text-capsula-coral',
} as const;

type Scheme = { sectionText: string; sectionHover: string; activeLink: string; dot: string; sgHover: string; linkHover: string; chevron: string };
const SCHEMES: Record<ColorScheme, Scheme> = {
    coral:  CORAL_SCHEME,
    green:  BASE_SCHEME,
    purple: BASE_SCHEME,
    navy:   BASE_SCHEME,
    blue:   BASE_SCHEME,
};

// ── Helpers ────────────────────────────────────────────────────────────────────

// Devuelve el id del único módulo activo usando longest-prefix-match.
// Tie-break: href canónico gana sobre subRoute a igual longitud.
function findActiveModuleId(pathname: string, visibleMap: Map<string, ModuleDefinition>): string | null {
    let bestId: string | null = null;
    let bestLen = -1;
    let bestIsHref = false;

    for (const mod of Array.from(visibleMap.values())) {
        const candidates: { path: string; isHref: boolean }[] = [
            { path: mod.href, isHref: true },
            ...(mod.subRoutes ?? []).map(s => ({ path: s, isHref: false })),
        ];
        for (const { path, isHref } of candidates) {
            if (pathname !== path && !pathname.startsWith(path + '/')) continue;
            const len = path.length;
            if (len > bestLen || (len === bestLen && isHref && !bestIsHref)) {
                bestLen = len;
                bestId = mod.id;
                bestIsHref = isHref;
            }
        }
    }

    return bestId;
}

// Conjunto de moduleIds presentes en SIDEBAR_TREE (incluyendo dentro de subgrupos).
// Se usa como filtro inverso para detectar huérfanos (red de seguridad D2).
const TREE_MODULE_IDS: Set<string> = (() => {
    const s = new Set<string>();
    for (const section of SIDEBAR_TREE) {
        for (const item of section.items) {
            if (item.kind === 'link') s.add(item.moduleId);
            else item.items.forEach(id => s.add(id));
        }
    }
    return s;
})();

function defaultSectionsState(): Record<string, boolean> {
    const base: Record<string, boolean> = Object.fromEntries(
        SIDEBAR_TREE.map(s => [s.id, false]),
    );
    base[ORPHAN_SECTION_ID] = false;
    return base;
}

function defaultSubGroupsState(): Record<string, boolean> {
    const acc: Record<string, boolean> = {};
    SIDEBAR_TREE.forEach(s =>
        s.items.forEach(item => { if (item.kind === 'subgroup') acc[item.id] = false; })
    );
    return acc;
}

// ── localStorage ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'capsula-sidebar-v1';

function loadState(): { sections: Record<string, boolean>; subgroups: Record<string, boolean> } | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

function persistState(
    sections: Record<string, boolean>,
    subgroups: Record<string, boolean>,
) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ sections, subgroups })); } catch {}
}

// ── Chevron icon ───────────────────────────────────────────────────────────────

function Chevron({ open, className }: { open: boolean; className?: string }) {
    return (
        <svg
            aria-hidden="true"
            className={cn(
                'h-3.5 w-3.5 shrink-0 transition-transform duration-200',
                open && 'rotate-90',
                className,
            )}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M6 3l5 5-5 5" />
        </svg>
    );
}

// ── Collapsible wrapper ────────────────────────────────────────────────────────

function Collapsible({ open, children }: { open: boolean; children: React.ReactNode }) {
    return (
        <div
            className="grid transition-[grid-template-rows] duration-200 ease-in-out"
            style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
        >
            <div className="overflow-hidden">
                {children}
            </div>
        </div>
    );
}

// ── Individual module link ─────────────────────────────────────────────────────

function ModuleLink({
    mod,
    activeModuleId,
    scheme,
    indent,
    closeSidebar,
}: {
    mod: ModuleDefinition;
    activeModuleId: string | null;
    scheme: ColorScheme;
    indent: boolean;
    closeSidebar: () => void;
}) {
    const c = SCHEMES[scheme];
    const active = activeModuleId === mod.id;

    return (
        <Link
            href={mod.href}
            onClick={closeSidebar}
            className={cn(
                'flex items-center gap-2.5 rounded-lg py-2 text-sm transition-colors duration-150',
                indent ? 'pl-9 pr-3' : 'px-3',
                active
                    ? c.activeLink
                    : cn('text-capsula-ink-soft', c.linkHover),
            )}
        >
            {(() => {
                const LucideIcon = MODULE_ICONS[mod.id];
                return LucideIcon
                    ? <LucideIcon className="h-4 w-4 shrink-0" />
                    : <span className="text-base leading-none">{mod.icon}</span>;
            })()}
            <span className="flex-1 leading-snug">{mod.label}</span>
            {active && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', c.dot)} />}
        </Link>
    );
}

// ── Sub-group (collapsible group inside a section) ─────────────────────────────

function SubGroup({
    def,
    visibleMap,
    activeModuleId,
    scheme,
    isOpen,
    onToggle,
    closeSidebar,
}: {
    def: TreeSubGroup;
    visibleMap: Map<string, ModuleDefinition>;
    activeModuleId: string | null;
    scheme: ColorScheme;
    isOpen: boolean;
    onToggle: () => void;
    closeSidebar: () => void;
}) {
    const c = SCHEMES[scheme];
    const visibleItems = def.items
        .map(id => visibleMap.get(id))
        .filter((m): m is ModuleDefinition => !!m);

    if (visibleItems.length === 0) return null;

    const hasActive = visibleItems.some(m => activeModuleId === m.id);

    return (
        <div>
            <button
                onClick={onToggle}
                className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-150',
                    hasActive && !isOpen
                        ? c.activeLink
                        : cn('text-capsula-ink-soft', c.sgHover),
                )}
            >
                {(() => {
                    const LucideIcon = SUBGROUP_ICONS[def.id];
                    return LucideIcon
                        ? <LucideIcon className="h-4 w-4 shrink-0" />
                        : <span className="text-base leading-none">{def.icon}</span>;
                })()}
                <span className="flex-1 text-left font-medium leading-snug">{def.label}</span>
                <Chevron open={isOpen} className={cn(c.chevron, 'opacity-70')} />
            </button>

            <Collapsible open={isOpen}>
                <div className="pb-1 pt-0.5">
                    {visibleItems.map(mod => (
                        <ModuleLink
                            key={mod.id}
                            mod={mod}
                            activeModuleId={activeModuleId}
                            scheme={scheme}
                            indent
                            closeSidebar={closeSidebar}
                        />
                    ))}
                </div>
            </Collapsible>
        </div>
    );
}

// ── Top-level section (collapsible) ────────────────────────────────────────────

function Section({
    def,
    visibleMap,
    activeModuleId,
    isOpen,
    openSubGroups,
    onToggle,
    onToggleSubGroup,
    closeSidebar,
}: {
    def: SectionDef;
    visibleMap: Map<string, ModuleDefinition>;
    activeModuleId: string | null;
    isOpen: boolean;
    openSubGroups: Set<string>;
    onToggle: () => void;
    onToggleSubGroup: (id: string) => void;
    closeSidebar: () => void;
}) {
    const c = SCHEMES[def.scheme];

    // Oculta toda la sección si no tiene nada visible para este usuario
    const hasVisible = def.items.some(item =>
        item.kind === 'link'
            ? visibleMap.has(item.moduleId)
            : item.items.some(id => visibleMap.has(id))
    );
    if (!hasVisible) return null;

    return (
        <div className="mb-1 mt-4 first:mt-0">
            <button
                onClick={onToggle}
                className={cn(
                    'flex w-full items-center gap-2 rounded-lg border-b border-capsula-line/60 px-3 py-2.5 transition-colors duration-150',
                    c.sectionHover,
                )}
            >
                <span className={cn('flex-1 text-left text-xs font-semibold uppercase tracking-[0.14em]', c.sectionText)}>
                    {def.label}
                </span>
                <Chevron open={isOpen} className={c.chevron} />
            </button>

            <Collapsible open={isOpen}>
                <div className="space-y-0.5 pb-1">
                    {def.items.map((item, idx) => {
                        if (item.kind === 'link') {
                            const mod = visibleMap.get(item.moduleId);
                            if (!mod) return null;
                            return (
                                <ModuleLink
                                    key={`${def.id}-${item.moduleId}-${idx}`}
                                    mod={mod}
                                    activeModuleId={activeModuleId}
                                    scheme={def.scheme}
                                    indent={false}
                                    closeSidebar={closeSidebar}
                                />
                            );
                        }
                        return (
                            <SubGroup
                                key={item.id}
                                def={item}
                                visibleMap={visibleMap}
                                activeModuleId={activeModuleId}
                                scheme={def.scheme}
                                isOpen={openSubGroups.has(item.id)}
                                onToggle={() => onToggleSubGroup(item.id)}
                                closeSidebar={closeSidebar}
                            />
                        );
                    })}
                </div>
            </Collapsible>
        </div>
    );
}

// ── Search results (flat filtered list) ───────────────────────────────────────

function SearchResults({
    query,
    visibleMap,
    activeModuleId,
    closeSidebar,
}: {
    query: string;
    visibleMap: Map<string, ModuleDefinition>;
    activeModuleId: string | null;
    closeSidebar: () => void;
}) {
    const q = query.toLowerCase().trim();
    const results = Array.from(visibleMap.values()).filter(mod =>
        mod.label.toLowerCase().includes(q) ||
        mod.description.toLowerCase().includes(q) ||
        (mod.tags?.some(t => t.toLowerCase().includes(q)) ?? false),
    );

    if (results.length === 0) {
        return (
            <div className="px-3 py-8 text-center text-[13px] text-capsula-ink-muted">
                Sin resultados para &ldquo;<span className="font-medium text-capsula-ink">{query}</span>&rdquo;
            </div>
        );
    }

    return (
        <div className="space-y-0.5">
            <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                {results.length} resultado{results.length !== 1 ? 's' : ''}
            </div>
            {results.map(mod => (
                <ModuleLink
                    key={mod.id}
                    mod={mod}
                    activeModuleId={activeModuleId}
                    scheme="coral"
                    indent={false}
                    closeSidebar={closeSidebar}
                />
            ))}
        </div>
    );
}

// ── Main Sidebar ───────────────────────────────────────────────────────────────

export function Sidebar({ initialUser, enabledModuleIds, userAllowedModules }: SidebarProps) {
    const pathname = usePathname();
    const { user, login } = useAuthStore();
    const setPermissions = useAuthStore(s => s.setPermissions);
    const { sidebarOpen, closeSidebar } = useUIStore();

    // D1 — Sincroniza sesión + permisos 4-capa en el store.
    // setPermissions es INTOCABLE: alimenta a usePermission() (Capas 2/3/4 client-side).
    useEffect(() => {
        if (initialUser && (!user || initialUser.id !== user.id)) {
            login({
                id: initialUser.id,
                email: initialUser.email,
                firstName: initialUser.firstName,
                lastName: initialUser.lastName,
                role: initialUser.role as UserRole,
            });
        }
        if (initialUser) {
            setPermissions({
                allowedModules: initialUser.allowedModules ?? null,
                grantedPerms: initialUser.grantedPerms ?? null,
                revokedPerms: initialUser.revokedPerms ?? null,
            });
        }
    }, [initialUser, login, user, setPermissions]);

    // Cerrar sidebar al cambiar de ruta (mobile)
    useEffect(() => {
        closeSidebar();
    }, [pathname, closeSidebar]);

    const activeUser = user || (initialUser as any);
    const userRole = (activeUser?.role as string) || 'CHEF';

    // Mapa de módulos visibles (filtrados por rol + módulos habilitados + allowedModules)
    const visibleMap = useMemo(() => {
        const mods = getVisibleModules(userRole, enabledModuleIds, userAllowedModules);
        return new Map(mods.map(m => [m.id, m]));
    }, [userRole, enabledModuleIds, userAllowedModules]);

    // Único módulo activo — longest-prefix-match sobre la ruta actual
    const activeModuleId = useMemo(
        () => findActiveModuleId(pathname, visibleMap),
        [pathname, visibleMap],
    );

    // D2 — Red de seguridad: cualquier módulo visible que NO esté en SIDEBAR_TREE
    // cae en una sección "Otros" al final.
    const orphanSection = useMemo<SectionDef | null>(() => {
        const orphans: TreeItem[] = [];
        for (const id of Array.from(visibleMap.keys())) {
            if (!TREE_MODULE_IDS.has(id)) orphans.push({ kind: 'link', moduleId: id });
        }
        if (orphans.length === 0) return null;
        return { id: ORPHAN_SECTION_ID, label: 'Otros', scheme: 'blue', items: orphans };
    }, [visibleMap]);

    // Estado de búsqueda
    const [searchQuery, setSearchQuery] = useState('');

    // Limpiar búsqueda al cerrar sidebar (mobile)
    useEffect(() => {
        if (!sidebarOpen) setSearchQuery('');
    }, [sidebarOpen]);

    // Estado de colapso — cerrado por default, el auto-expand abre la sección activa
    const [sectionsState, setSectionsState]   = useState<Record<string, boolean>>(defaultSectionsState);
    const [subGroupsState, setSubGroupsState] = useState<Record<string, boolean>>(defaultSubGroupsState);

    // Guard: no persistir a localStorage antes de haberlo leído
    const storedLoaded = useRef(false);

    useEffect(() => {
        const stored = loadState();
        if (stored) {
            setSectionsState(prev => ({ ...prev, ...stored.sections }));
            setSubGroupsState(prev => ({ ...prev, ...stored.subgroups }));
        }
        storedLoaded.current = true;
    }, []);

    useEffect(() => {
        if (!storedLoaded.current) return;
        persistState(sectionsState, subGroupsState);
    }, [sectionsState, subGroupsState]);

    // Auto-expandir únicamente la sección (y subgrupo) que contiene el módulo activo.
    // Usa activeModuleId — ya es el único match, no puede abrir secciones extra por falso positivo.
    useEffect(() => {
        if (!activeModuleId) return;

        let foundSection: string | null = null;
        let foundSubGroup: string | null = null;

        const allSections = orphanSection ? [...SIDEBAR_TREE, orphanSection] : SIDEBAR_TREE;
        outer: for (const section of allSections) {
            for (const item of section.items) {
                if (item.kind === 'link' && item.moduleId === activeModuleId) {
                    foundSection = section.id;
                    break outer;
                }
                if (item.kind === 'subgroup' && item.items.includes(activeModuleId)) {
                    foundSection = section.id;
                    foundSubGroup = item.id;
                    break outer;
                }
            }
        }

        if (foundSection) {
            setSectionsState(prev =>
                prev[foundSection!] ? prev : { ...prev, [foundSection!]: true },
            );
        }
        if (foundSubGroup) {
            setSubGroupsState(prev =>
                prev[foundSubGroup!] ? prev : { ...prev, [foundSubGroup!]: true },
            );
        }
    }, [activeModuleId, orphanSection]);

    const toggleSection  = (id: string) =>
        setSectionsState(prev => ({ ...prev, [id]: !prev[id] }));

    const toggleSubGroup = (id: string) =>
        setSubGroupsState(prev => ({ ...prev, [id]: !prev[id] }));

    const openSubGroupsSet = useMemo(
        () => new Set(Object.entries(subGroupsState).filter(([, v]) => v).map(([k]) => k)),
        [subGroupsState],
    );

    const roleInfo = userRole ? ROLE_INFO[userRole as UserRole] : null;

    const sectionsToRender: SectionDef[] = orphanSection
        ? [...SIDEBAR_TREE, orphanSection]
        : SIDEBAR_TREE;

    return (
        <>
            {/* Overlay mobile */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 md:hidden"
                    onClick={closeSidebar}
                />
            )}

            {/* Sidebar panel */}
            <aside
                className={cn(
                    'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-capsula-line bg-capsula-ivory-surface transition-transform duration-300',
                    sidebarOpen ? 'translate-x-0' : '-translate-x-full',
                    'md:translate-x-0',
                )}
            >
                {/* D5 — Header con CapsulaNavbarLogo */}
                <div className="flex h-16 shrink-0 items-center border-b border-capsula-line px-4">
                    <div className="flex min-w-0 flex-1 flex-col justify-center">
                        <CapsulaNavbarLogo />
                        {process.env.NEXT_PUBLIC_BUSINESS_NAME && (
                            <p className="ml-0.5 mt-0.5 truncate text-[10px] font-medium uppercase leading-none tracking-[0.08em] text-capsula-ink-faint">
                                {process.env.NEXT_PUBLIC_BUSINESS_NAME}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={closeSidebar}
                        className="ml-2 shrink-0 rounded-lg p-1 text-capsula-ink-muted transition-colors hover:bg-capsula-ivory-alt hover:text-capsula-ink md:hidden"
                        aria-label="Cerrar menú"
                    >
                        <X className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                </div>

                {/* Search */}
                <div className="shrink-0 border-b border-capsula-line px-2 py-2">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-capsula-ink-muted" />
                        <input
                            type="search"
                            placeholder="Buscar módulo…"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="pos-input w-full py-1.5 pl-8 pr-3 text-[13px]"
                        />
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto px-2 py-3">
                    {searchQuery.trim() ? (
                        <SearchResults
                            query={searchQuery}
                            visibleMap={visibleMap}
                            activeModuleId={activeModuleId}
                            closeSidebar={() => { setSearchQuery(''); closeSidebar(); }}
                        />
                    ) : (
                        sectionsToRender.map(section => (
                            <Section
                                key={section.id}
                                def={section}
                                visibleMap={visibleMap}
                                activeModuleId={activeModuleId}
                                isOpen={sectionsState[section.id] ?? false}
                                openSubGroups={openSubGroupsSet}
                                onToggle={() => toggleSection(section.id)}
                                onToggleSubGroup={toggleSubGroup}
                                closeSidebar={closeSidebar}
                            />
                        ))
                    )}
                </nav>

                {/* User footer — preservado de shanklish (ChangePasswordDialog + logout) */}
                <div className="shrink-0 border-t border-capsula-line p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-capsula-ivory-alt text-capsula-ink-muted">
                            <User className="h-5 w-5" strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-capsula-ink">
                                {activeUser?.firstName} {activeUser?.lastName}
                            </p>
                            {roleInfo && (
                                <span
                                    className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                                    style={{
                                        backgroundColor: `${roleInfo.color}20`,
                                        color: roleInfo.color,
                                    }}
                                >
                                    {roleInfo.labelEs}
                                </span>
                            )}
                        </div>

                        <ChangePasswordDialog />

                        <form action={logoutAction}>
                            <button
                                type="submit"
                                title="Cerrar Sesión"
                                className="rounded-lg p-1.5 text-capsula-ink-muted transition-colors hover:bg-capsula-ivory-alt hover:text-capsula-coral"
                            >
                                <LogOut className="h-4 w-4" strokeWidth={1.75} />
                            </button>
                        </form>
                    </div>
                </div>
            </aside>
        </>
    );
}
