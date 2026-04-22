'use client';

import { useState, useTransition } from 'react';
import { MODULE_REGISTRY, type ModuleDefinition } from '@/lib/constants/modules-registry';
import { saveEnabledModules } from '@/app/actions/system-config.actions';
import { Settings, CreditCard, Gamepad2, ShieldCheck, CheckCircle2, AlertTriangle, Lock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/Badge';

const SECTIONS: { key: 'operations' | 'sales' | 'games' | 'admin'; label: string; icon: LucideIcon }[] = [
    { key: 'operations', label: 'Operaciones',              icon: Settings     },
    { key: 'sales',      label: 'Ventas',                   icon: CreditCard   },
    { key: 'games',      label: 'Entretenimiento / juegos', icon: Gamepad2     },
    { key: 'admin',      label: 'Administración',           icon: ShieldCheck  },
];

interface Props {
    /** IDs actualmente habilitados — viene de la BD vía el Server Component padre */
    initialEnabledIds: string[];
}

export function ModulesConfigView({ initialEnabledIds }: Props) {
    const [enabled, setEnabled] = useState<Set<string>>(new Set(initialEnabledIds));
    const [isPending, startTransition] = useTransition();
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

    function toggle(id: string) {
        // module_config no se puede desactivar (protección)
        if (id === 'module_config') return;

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

    const hasChanges = !setsEqual(enabled, new Set(initialEnabledIds));

    const barStyles =
        saveStatus === 'saved'
            ? 'border-[#2F6B4E]/40 bg-[#E5EDE7]/40'
            : saveStatus === 'error'
            ? 'border-capsula-coral/40 bg-capsula-coral/5'
            : hasChanges
            ? 'border-[#946A1C]/30 bg-[#F3EAD6]/40'
            : 'border-capsula-line bg-capsula-ivory-alt/50';

    return (
        <div className="space-y-6">
            <div className={`flex flex-wrap items-center gap-3 rounded-[var(--radius)] border p-4 transition-colors ${barStyles}`}>
                <div className="min-w-0 flex-1">
                    {saveStatus === 'saved' && (
                        <p className="flex items-center gap-2 font-medium text-[#2F6B4E]">
                            <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
                            Guardado — el sidebar se actualizará en el próximo acceso al dashboard
                        </p>
                    )}
                    {saveStatus === 'error' && (
                        <p className="flex items-center gap-2 font-medium text-capsula-coral">
                            <AlertTriangle className="h-4 w-4" strokeWidth={1.5} />
                            Error al guardar. Intenta de nuevo.
                        </p>
                    )}
                    {saveStatus === 'idle' && hasChanges && (
                        <p className="flex items-center gap-2 font-medium text-[#946A1C]">
                            <AlertTriangle className="h-4 w-4" strokeWidth={1.5} />
                            Tienes cambios sin guardar — <span className="font-mono">{enabled.size}</span> módulos seleccionados
                        </p>
                    )}
                    {saveStatus === 'idle' && !hasChanges && (
                        <p className="text-[13px] text-capsula-ink-soft">
                            <span className="font-mono">{enabled.size}</span> módulo{enabled.size !== 1 ? 's' : ''} activo{enabled.size !== 1 ? 's' : ''} — los cambios se aplican al instante sin reiniciar
                        </p>
                    )}
                </div>

                <Button
                    variant="primary"
                    onClick={handleSave}
                    disabled={isPending || (!hasChanges && saveStatus !== 'error')}
                    isLoading={isPending}
                >
                    {isPending ? 'Guardando…' : 'Guardar cambios'}
                </Button>
            </div>

            {SECTIONS.map(section => {
                const modules = MODULE_REGISTRY
                    .filter(m => m.section === section.key)
                    .sort((a, b) => a.sortOrder - b.sortOrder);

                const activeCount = modules.filter(m => enabled.has(m.id)).length;
                const SecIcon = section.icon;

                return (
                    <div
                        key={section.key}
                        className="overflow-hidden rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface shadow-cap-soft"
                    >
                        <div className="flex items-center gap-3 border-b border-capsula-line bg-capsula-ivory-alt px-5 py-3">
                            <SecIcon className="h-4 w-4 text-capsula-ink-soft" strokeWidth={1.5} />
                            <h2 className="font-heading text-[14px] uppercase tracking-[0.06em] text-capsula-navy-deep">{section.label}</h2>
                            <span className="ml-auto font-mono text-[11px] text-capsula-ink-muted">
                                {activeCount}/{modules.length}
                            </span>
                        </div>

                        <div className="divide-y divide-capsula-line">
                            {modules.map(mod => (
                                <ModuleRow
                                    key={mod.id}
                                    mod={mod}
                                    isEnabled={enabled.has(mod.id)}
                                    isLocked={mod.id === 'module_config'}
                                    onToggle={() => toggle(mod.id)}
                                    isPending={isPending}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setsEqual(a: Set<string>, b: Set<string>): boolean {
    if (a.size !== b.size) return false;
    for (const v of Array.from(a)) if (!b.has(v)) return false;
    return true;
}

// ─── Module Row ──────────────────────────────────────────────────────────────

interface ModuleRowProps {
    mod: ModuleDefinition;
    isEnabled: boolean;
    isLocked: boolean;
    onToggle: () => void;
    isPending: boolean;
}

function ModuleRow({ mod, isEnabled, isLocked, onToggle, isPending }: ModuleRowProps) {
    return (
        <div className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-capsula-ivory-alt/40">
            <span className="text-2xl" aria-hidden="true">{mod.icon}</span>

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <p className="text-[13px] font-medium text-capsula-ink">{mod.label}</p>
                    {isLocked && (
                        <Badge variant="neutral">
                            <Lock className="h-3 w-3" strokeWidth={1.5} /> Fijo
                        </Badge>
                    )}
                </div>
                <p className="truncate text-[12px] text-capsula-ink-soft">{mod.description}</p>
                <p className="mt-0.5 font-mono text-[10px] text-capsula-ink-muted/60">{mod.id}</p>
            </div>

            <span className="hidden sm:block">
                <Badge variant={isEnabled ? 'ok' : 'neutral'}>
                    {isEnabled ? 'Activo' : 'Inactivo'}
                </Badge>
            </span>

            <button
                type="button"
                role="switch"
                aria-checked={isEnabled}
                aria-label={`${isEnabled ? 'Desactivar' : 'Activar'} ${mod.label}`}
                onClick={onToggle}
                disabled={isLocked || isPending}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-capsula-navy-deep focus-visible:ring-offset-2 ${
                    isLocked || isPending ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                } ${isEnabled ? 'bg-capsula-navy-deep' : 'bg-capsula-line'}`}
            >
                <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-capsula-ivory-surface shadow-md ring-0 transition duration-200 ease-in-out ${
                        isEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                />
            </button>
        </div>
    );
}
