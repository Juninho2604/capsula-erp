'use client';

import { useMemo, useState, useTransition } from 'react';
import { updateUserPerms } from '@/app/actions/user.actions';
import { ROLE_INFO } from '@/lib/constants/roles';
import { UserRole } from '@/types';
import {
  PERM_GROUPS,
  PERM_LABELS,
  ROLE_BASE_PERMS,
  type PermKey,
} from '@/lib/constants/permissions-registry';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
  grantedPerms: string | null;
  revokedPerms: string | null;
}

interface Props {
  users: User[];
  currentUserId: string;
}

type PermState = 'default' | 'granted' | 'revoked';

function parsePerms(raw: string | null): PermKey[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function PermisosUsuarioView({ users, currentUserId }: Props) {
  const [selected, setSelected] = useState<User | null>(null);
  const [granted, setGranted] = useState<Set<PermKey>>(new Set());
  const [revoked, setRevoked] = useState<Set<PermKey>>(new Set());
  const [feedback, setFeedback] = useState('');
  const [isPending, startTransition] = useTransition();

  const activeUsers = users.filter(u => u.isActive);

  const selectUser = (u: User) => {
    setSelected(u);
    setGranted(new Set(parsePerms(u.grantedPerms)));
    setRevoked(new Set(parsePerms(u.revokedPerms)));
    setFeedback('');
  };

  const baseRolePerms = useMemo<Set<PermKey>>(
    () => new Set(selected ? ROLE_BASE_PERMS[selected.role] ?? [] : []),
    [selected]
  );

  const getState = (perm: PermKey): PermState => {
    if (revoked.has(perm)) return 'revoked';
    if (granted.has(perm)) return 'granted';
    return 'default';
  };

  const setState = (perm: PermKey, state: PermState) => {
    const newGranted = new Set(granted);
    const newRevoked = new Set(revoked);
    newGranted.delete(perm);
    newRevoked.delete(perm);
    if (state === 'granted') newGranted.add(perm);
    if (state === 'revoked') newRevoked.add(perm);
    setGranted(newGranted);
    setRevoked(newRevoked);
  };

  const resetAll = () => {
    setGranted(new Set());
    setRevoked(new Set());
  };

  const handleSave = () => {
    if (!selected) return;
    startTransition(async () => {
      const r = await updateUserPerms(
        selected.id,
        granted.size > 0 ? Array.from(granted) : null,
        revoked.size > 0 ? Array.from(revoked) : null,
      );
      setFeedback(r.success ? '✅ Permisos guardados (el usuario debe re-iniciar sesión para verlos)' : `❌ ${r.message}`);
    });
  };

  const roleInfo = (role: string) => ROLE_INFO[role as UserRole] || { labelEs: role, color: '#6b7280' };

  const isSelf = selected?.id === currentUserId;
  const totalCustom = granted.size + revoked.size;

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="glass-panel rounded-3xl p-6">
        <h1 className="text-2xl font-black text-foreground">Permisos por Usuario</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Concedé permisos extra (✅ Granted) o revocá permisos del rol base (❌ Revoked) para un usuario específico.
          Las revocaciones siempre ganan; las concesiones bypassean la restricción de módulos.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        {/* Columna izquierda — lista de usuarios */}
        <div className="glass-panel rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-secondary/30">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Usuarios Activos ({activeUsers.length})
            </span>
          </div>
          <div className="divide-y divide-border max-h-[70vh] overflow-y-auto">
            {activeUsers.map(u => {
              const g = parsePerms(u.grantedPerms).length;
              const r = parsePerms(u.revokedPerms).length;
              const total = g + r;
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
                    {total > 0 && (
                      <span className="text-[9px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded shrink-0">
                        {total} custom
                      </span>
                    )}
                  </div>
                  <div className="mt-1">
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: `${ri.color}20`, color: ri.color }}
                    >
                      {ri.labelEs}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Columna derecha — panel de edición */}
        {!selected ? (
          <div className="glass-panel rounded-2xl border-2 border-dashed border-border flex items-center justify-center min-h-[300px]">
            <p className="text-muted-foreground text-sm">Selecciona un usuario de la lista</p>
          </div>
        ) : (
          <div className="glass-panel rounded-2xl border border-border overflow-hidden">
            {/* User header */}
            <div className="px-5 py-4 border-b border-border bg-secondary/30 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-black text-foreground">
                  {selected.firstName} {selected.lastName}
                  {isSelf && <span className="ml-2 text-[10px] text-amber-400">(vos mismo — cuidado)</span>}
                </p>
                <p className="text-xs text-muted-foreground">{selected.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {totalCustom > 0 && (
                  <button onClick={resetAll} className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5">
                    Restablecer todo
                  </button>
                )}
                <span className={`text-xs px-2 py-0.5 rounded font-bold ${totalCustom === 0 ? 'bg-secondary text-muted-foreground' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'}`}>
                  {totalCustom === 0 ? 'Solo rol' : `${granted.size} granted · ${revoked.size} revoked`}
                </span>
              </div>
            </div>

            {/* Permission groups */}
            <div className="p-5 space-y-5 max-h-[65vh] overflow-y-auto">
              {PERM_GROUPS.map(group => (
                <div key={group.key}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                    {group.icon} {group.label}
                  </p>
                  <div className="space-y-1.5">
                    {group.perms.map(perm => {
                      const state = getState(perm);
                      const inBase = baseRolePerms.has(perm);
                      const meta = PERM_LABELS[perm];
                      return (
                        <div
                          key={perm}
                          className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-border hover:bg-secondary/20 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm text-foreground font-medium truncate">{meta.label}</p>
                              {inBase && (
                                <span className="text-[9px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded shrink-0">
                                  rol incluye
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground truncate">{meta.description}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => setState(perm, 'default')}
                              className={`text-[10px] font-bold px-2 py-1 rounded ${state === 'default' ? 'bg-secondary text-foreground border border-border' : 'text-muted-foreground hover:text-foreground'}`}
                              title="Usar configuración del rol"
                            >
                              Default
                            </button>
                            <button
                              onClick={() => setState(perm, 'granted')}
                              className={`text-[10px] font-bold px-2 py-1 rounded ${state === 'granted' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'text-muted-foreground hover:text-emerald-400'}`}
                              title="Conceder este permiso (bypassea allowedModules)"
                            >
                              ✅ Granted
                            </button>
                            <button
                              onClick={() => setState(perm, 'revoked')}
                              className={`text-[10px] font-bold px-2 py-1 rounded ${state === 'revoked' ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'text-muted-foreground hover:text-red-400'}`}
                              title="Revocar este permiso (gana sobre todo)"
                            >
                              ❌ Revoked
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-border bg-secondary/10 flex items-center justify-between gap-3">
              {feedback ? (
                <p className={`text-xs ${feedback.startsWith('✅') ? 'text-emerald-400' : 'text-red-400'}`}>{feedback}</p>
              ) : <span />}
              <button
                onClick={handleSave}
                disabled={isPending}
                className="capsula-btn capsula-btn-primary text-sm px-6 py-2 min-h-0 disabled:opacity-50"
              >
                {isPending ? 'Guardando...' : 'Guardar permisos'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
