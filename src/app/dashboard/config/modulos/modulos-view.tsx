'use client';

import { useState, useTransition } from 'react';
import { MODULE_REGISTRY, MODULE_ROLE_ACCESS, type ModuleDefinition } from '@/lib/constants/modules-registry';
import { saveEnabledModules } from '@/app/actions/system-config.actions';
import { updateUserModules } from '@/app/actions/user.actions';
import { ROLE_INFO } from '@/lib/constants/roles';
import { UserRole } from '@/types';

type Tab = 'sistema' | 'usuario';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
  allowedModules: string | null;
}

interface Props {
  users: User[];
  enabledModuleIds: string[];
  currentUserId: string;
  isOwner: boolean;
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function setsEqual(a: Set<string>, b: Set<string>) {
  if (a.size !== b.size) return false;
  for (const v of Array.from(a)) if (!b.has(v)) return false;
  return true;
}
function parseModules(raw: string | null): string[] | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// ─── Tab Sistema ──────────────────────────────────────────────────────────────
const SECTIONS = [
  { key: 'operations' as const, label: 'Operaciones',               icon: '⚙️' },
  { key: 'sales'      as const, label: 'Ventas / POS',              icon: '💳' },
  { key: 'games'      as const, label: 'Entretenimiento / Juegos',  icon: '🎮' },
  { key: 'admin'      as const, label: 'Administración',            icon: '🔐' },
];

function TabSistema({ initialEnabledIds }: { initialEnabledIds: string[] }) {
  const [enabled, setEnabled] = useState<Set<string>>(new Set(initialEnabledIds));
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const hasChanges = !setsEqual(enabled, new Set(initialEnabledIds));

  function toggle(id: string) {
    if (id === 'module_config' || id === 'modulos') return; // inmutable
    setEnabled(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setSaveStatus('idle');
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveEnabledModules(Array.from(enabled));
      setSaveStatus(result.ok ? 'saved' : 'error');
    });
  }

  return (
    <div className="space-y-6">
      {/* Save bar */}
      <div className={`flex flex-wrap items-center gap-3 rounded-xl border p-4 transition-colors ${
        saveStatus === 'saved'  ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20' :
        saveStatus === 'error'  ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20' :
        hasChanges              ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20' :
                                  'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50'
      }`}>
        <div className="flex-1 min-w-0">
          {saveStatus === 'saved' && <p className="font-medium text-green-700 dark:text-green-400">✅ Guardado — el sidebar se actualizará en el próximo acceso al dashboard</p>}
          {saveStatus === 'error' && <p className="font-medium text-red-700 dark:text-red-400">❌ Error al guardar. Intenta de nuevo.</p>}
          {saveStatus === 'idle' && hasChanges && <p className="font-medium text-amber-700 dark:text-amber-400">⚠️ Cambios sin guardar — {enabled.size} módulos seleccionados</p>}
          {saveStatus === 'idle' && !hasChanges && <p className="text-sm text-gray-500 dark:text-gray-400">{enabled.size} módulo{enabled.size !== 1 ? 's' : ''} activo{enabled.size !== 1 ? 's' : ''} — los cambios se aplican sin reiniciar</p>}
        </div>
        <button
          onClick={handleSave}
          disabled={isPending || (!hasChanges && saveStatus !== 'error')}
          className={`rounded-lg px-5 py-2 text-sm font-semibold text-white transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
            isPending ? 'bg-gray-400' : hasChanges || saveStatus === 'error' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-gray-400'
          }`}
        >
          {isPending ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>

      {/* Sections */}
      {SECTIONS.map(section => {
        const modules = MODULE_REGISTRY
          .filter(m => m.section === section.key)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        const activeCount = modules.filter(m => enabled.has(m.id)).length;

        return (
          <div key={section.key} className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center gap-3 border-b border-gray-200 bg-gray-50 px-5 py-3 dark:border-gray-700 dark:bg-gray-800/50">
              <span className="text-xl">{section.icon}</span>
              <h2 className="font-semibold text-gray-800 dark:text-gray-100">{section.label}</h2>
              <span className="ml-auto rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                {activeCount}/{modules.length}
              </span>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {modules.map(mod => {
                const isLocked = mod.id === 'module_config' || mod.id === 'modulos';
                const isEnabled = enabled.has(mod.id);
                return (
                  <div key={mod.id} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <span className="text-2xl">{mod.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{mod.label}</p>
                        {isLocked && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400 dark:bg-gray-800">fijo</span>}
                      </div>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">{mod.description}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-gray-300 dark:text-gray-600">{mod.id}</p>
                    </div>
                    <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-xs font-medium sm:block ${
                      isEnabled ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500'
                    }`}>{isEnabled ? 'Activo' : 'Inactivo'}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isEnabled}
                      onClick={() => toggle(mod.id)}
                      disabled={isLocked || isPending}
                      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 ${
                        isLocked || isPending ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                      } ${isEnabled ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${isEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab Por Usuario ──────────────────────────────────────────────────────────
function TabUsuario({ users, enabledModuleIds, currentUserId }: { users: User[]; enabledModuleIds: string[]; currentUserId: string }) {
  const [selected, setSelected] = useState<User | null>(null);
  const [moduleState, setModuleState] = useState<string[] | null>(null);
  const [feedback, setFeedback] = useState('');
  const [isPending, startTransition] = useTransition();
  const activeUsers = users.filter(u => u.isActive);

  const selectUser = (u: User) => {
    setSelected(u);
    setModuleState(parseModules(u.allowedModules));
    setFeedback('');
  };

  const roleDefaultModules = selected
    ? MODULE_REGISTRY.filter(m => {
        const roles = MODULE_ROLE_ACCESS[m.id];
        return !roles || roles.includes(selected.role);
      }).map(m => m.id)
    : [];

  // Only show modules enabled in the system (Tab Sistema)
  const availableModules = MODULE_REGISTRY.filter(m =>
    (enabledModuleIds.includes(m.id) || m.id === 'modulos') &&
    roleDefaultModules.includes(m.id)
  );

  const isChecked = (modId: string) => moduleState === null ? true : moduleState.includes(modId);

  const toggleModule = (modId: string) => {
    if (moduleState === null) {
      setModuleState(roleDefaultModules.filter(id => id !== modId));
    } else {
      setModuleState(moduleState.includes(modId) ? moduleState.filter(id => id !== modId) : [...moduleState, modId]);
    }
  };

  const handleSave = () => {
    if (!selected) return;
    startTransition(async () => {
      const r = await updateUserModules(selected.id, moduleState);
      setFeedback(r.success ? '✅ Módulos guardados' : `❌ ${r.message}`);
    });
  };

  const bySection = (section: string) => availableModules.filter(m => m.section === section);
  const roleInfo = (role: string) => ROLE_INFO[role as UserRole] || { labelEs: role, color: '#6b7280' };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Selecciona un usuario para restringir qué módulos puede ver. Solo aparecen los módulos habilitados en la tab <strong>Sistema</strong>.
        Si no se personaliza, el usuario ve todos los módulos que su rol permite.
      </p>

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        {/* User list */}
        <div className="glass-panel rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-secondary/30">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Usuarios Activos ({activeUsers.length})
            </span>
          </div>
          <div className="divide-y divide-border max-h-[70vh] overflow-y-auto">
            {activeUsers.map(u => {
              const mods = parseModules(u.allowedModules);
              const isSelected = selected?.id === u.id;
              const ri = roleInfo(u.role);
              return (
                <button
                  key={u.id}
                  onClick={() => selectUser(u)}
                  className={`w-full text-left px-4 py-3 transition-colors hover:bg-secondary/30 ${isSelected ? 'bg-primary/10 border-l-2 border-primary' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-foreground truncate">{u.firstName} {u.lastName}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                    </div>
                    {mods !== null && (
                      <span className="text-[9px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded shrink-0">personalizado</span>
                    )}
                  </div>
                  <div className="mt-1">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: `${ri.color}20`, color: ri.color }}>{ri.labelEs}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Edit panel */}
        {!selected ? (
          <div className="glass-panel rounded-2xl border-2 border-dashed border-border flex items-center justify-center min-h-[300px]">
            <p className="text-muted-foreground text-sm">Selecciona un usuario de la lista</p>
          </div>
        ) : (
          <div className="glass-panel rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border bg-secondary/30 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-black text-foreground">{selected.firstName} {selected.lastName}</p>
                <p className="text-xs text-muted-foreground">{selected.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {moduleState !== null && (
                  <button onClick={() => setModuleState(null)} className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5">
                    Restablecer a rol
                  </button>
                )}
                <span className={`text-xs px-2 py-0.5 rounded font-bold ${moduleState === null ? 'bg-secondary text-muted-foreground' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'}`}>
                  {moduleState === null ? 'Por rol' : `${moduleState.length} personalizado(s)`}
                </span>
              </div>
            </div>

            <div className="p-5 space-y-5 max-h-[65vh] overflow-y-auto">
              {(['operations', 'sales', 'admin', 'games'] as const).map(section => {
                const mods = bySection(section);
                if (mods.length === 0) return null;
                const sectionLabel: Record<string, string> = { operations: 'Operaciones', sales: 'Ventas / POS', admin: 'Administración', games: 'Juegos' };
                return (
                  <div key={section}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">{sectionLabel[section]}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {mods.map(m => (
                        <label key={m.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-border hover:bg-secondary/30 cursor-pointer transition-colors">
                          <input type="checkbox" checked={isChecked(m.id)} onChange={() => toggleModule(m.id)} className="rounded" />
                          <span className="text-sm">{m.icon}</span>
                          <span className="text-sm text-foreground font-medium">{m.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-5 py-4 border-t border-border bg-secondary/10 flex items-center justify-between gap-3">
              {feedback ? (
                <p className={`text-xs ${feedback.startsWith('✅') ? 'text-emerald-400' : 'text-red-400'}`}>{feedback}</p>
              ) : <span />}
              <button onClick={handleSave} disabled={isPending} className="capsula-btn capsula-btn-primary text-sm px-6 py-2 min-h-0 disabled:opacity-50">
                {isPending ? 'Guardando...' : 'Guardar módulos'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────
export function ModulosView({ users, enabledModuleIds, currentUserId, isOwner }: Props) {
  const [tab, setTab] = useState<Tab>(isOwner ? 'sistema' : 'usuario');

  const tabs: { id: Tab; label: string; icon: string; ownerOnly: boolean }[] = [
    { id: 'sistema',  label: 'Sistema',      icon: '🧩', ownerOnly: true },
    { id: 'usuario',  label: 'Por Usuario',  icon: '👤', ownerOnly: false },
  ];

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="glass-panel rounded-3xl p-6">
        <h1 className="text-2xl font-black text-foreground">🧩 Módulos</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          <strong>Sistema</strong>: activa o desactiva módulos para toda la instalación.&nbsp;
          <strong>Por Usuario</strong>: restringe qué módulos ve cada persona de forma individual.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary/50 rounded-2xl p-1 max-w-xs">
        {tabs.filter(t => !t.ownerOnly || isOwner).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-bold transition-colors ${
              tab === t.id ? 'bg-background text-foreground shadow' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'sistema' && isOwner && <TabSistema initialEnabledIds={enabledModuleIds} />}
      {tab === 'usuario' && <TabUsuario users={users} enabledModuleIds={enabledModuleIds} currentUserId={currentUserId} />}
    </div>
  );
}
