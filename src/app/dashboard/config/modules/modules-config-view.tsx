'use client';

import { useState } from 'react';
import { MODULE_REGISTRY, type ModuleDefinition } from '@/lib/constants/modules-registry';

const SECTIONS = [
    { key: 'operations' as const, label: 'Operaciones',              icon: '⚙️',  accent: 'border-amber-400  bg-amber-50  dark:bg-amber-900/20  text-amber-700  dark:text-amber-400'  },
    { key: 'sales'      as const, label: 'Ventas',                   icon: '💳',  accent: 'border-green-400  bg-green-50  dark:bg-green-900/20  text-green-700  dark:text-green-400'  },
    { key: 'games'      as const, label: 'Entretenimiento / Juegos', icon: '🎮',  accent: 'border-purple-400 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400' },
    { key: 'admin'      as const, label: 'Administración',           icon: '🔐',  accent: 'border-blue-400   bg-blue-50   dark:bg-blue-900/20   text-blue-700   dark:text-blue-400'   },
];

export function ModulesConfigView() {
    const [enabled, setEnabled] = useState<Set<string>>(
        () => new Set(MODULE_REGISTRY.filter(m => m.enabledByDefault).map(m => m.id))
    );

    function toggle(id: string) {
        setEnabled(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    const envValue = `NEXT_PUBLIC_ENABLED_MODULES="${Array.from(enabled).join(',')}"`;

    async function copyToClipboard() {
        try {
            await navigator.clipboard.writeText(envValue);
        } catch {
            // fallback: show an alert for environments without clipboard API
            alert('Copia manualmente:\n\n' + envValue);
        }
    }

    return (
        <div className="space-y-6">
            {/* ── ENV preview ── */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-700 dark:bg-amber-900/20">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    Variable generada — copia esto en tu{' '}
                    <code className="rounded bg-amber-100 px-1 font-mono dark:bg-amber-800/40">.env</code>
                </p>

                <div className="flex items-start gap-2">
                    <code className="flex-1 break-all rounded-lg bg-gray-900 p-3 text-sm leading-relaxed text-green-400">
                        {envValue}
                    </code>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                        onClick={copyToClipboard}
                        className="rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-semibold text-white transition-all hover:bg-amber-600 active:scale-95"
                    >
                        Copiar al portapapeles
                    </button>
                    <p className="text-xs text-amber-700/70 dark:text-amber-400/70">
                        {enabled.size} módulo{enabled.size !== 1 ? 's' : ''} seleccionado{enabled.size !== 1 ? 's' : ''} ·
                        Reinicia con <code className="font-mono">npm run dev</code> para aplicar.
                    </p>
                </div>
            </div>

            {/* ── Sections ── */}
            {SECTIONS.map(section => {
                const modules = MODULE_REGISTRY
                    .filter(m => m.section === section.key)
                    .sort((a, b) => a.sortOrder - b.sortOrder);

                const activeCount = modules.filter(m => enabled.has(m.id)).length;

                return (
                    <div
                        key={section.key}
                        className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
                    >
                        {/* Section header */}
                        <div className="flex items-center gap-3 border-b border-gray-200 bg-gray-50 px-5 py-3 dark:border-gray-700 dark:bg-gray-800/50">
                            <span className="text-xl">{section.icon}</span>
                            <h2 className="font-semibold text-gray-800 dark:text-gray-100">
                                {section.label}
                            </h2>
                            <span className="ml-auto rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                {activeCount}/{modules.length}
                            </span>
                        </div>

                        {/* Module rows */}
                        <div className="divide-y divide-gray-100 dark:divide-gray-800">
                            {modules.map(mod => (
                                <ModuleRow
                                    key={mod.id}
                                    mod={mod}
                                    isEnabled={enabled.has(mod.id)}
                                    onToggle={() => toggle(mod.id)}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ── iOS-style toggle row ──────────────────────────────────────────────────────

interface ModuleRowProps {
    mod: ModuleDefinition;
    isEnabled: boolean;
    onToggle: () => void;
}

function ModuleRow({ mod, isEnabled, onToggle }: ModuleRowProps) {
    return (
        <div className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
            {/* Icon */}
            <span className="text-2xl" aria-hidden="true">{mod.icon}</span>

            {/* Info */}
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{mod.label}</p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">{mod.description}</p>
                <p className="mt-0.5 font-mono text-[10px] text-gray-400 dark:text-gray-600">
                    id: {mod.id}
                </p>
            </div>

            {/* Status pill */}
            <span
                className={`hidden shrink-0 rounded-full px-2 py-0.5 text-xs font-medium sm:block ${
                    isEnabled
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500'
                }`}
            >
                {isEnabled ? 'Activo' : 'Inactivo'}
            </span>

            {/* iOS Switch */}
            <button
                type="button"
                role="switch"
                aria-checked={isEnabled}
                aria-label={`${isEnabled ? 'Desactivar' : 'Activar'} ${mod.label}`}
                onClick={onToggle}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 ${
                    isEnabled
                        ? 'bg-amber-500'
                        : 'bg-gray-300 dark:bg-gray-600'
                }`}
            >
                <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        isEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                />
            </button>
        </div>
    );
}
