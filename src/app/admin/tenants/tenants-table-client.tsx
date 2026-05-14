'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { suspendTenantAction, reactivateTenantAction } from './actions';
import { Ban, RefreshCw, ExternalLink, Check, AlertTriangle, ChevronRight } from 'lucide-react';

export interface TenantRow {
    id: string;
    slug: string;
    name: string;
    createdAt: string;
    userCount: number;
    activeUserCount: number;
    branchCount: number;
    sales30d: number;
}

const TENANT_ROOT_DOMAIN = 'kpsula.app';

export default function TenantsTable({ rows }: { rows: TenantRow[] }) {
    const [pending, startTransition] = useTransition();
    const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

    const runAction = (label: string, fn: () => Promise<{ success: boolean; message: string }>) => {
        if (!confirm(label)) return;
        startTransition(async () => {
            const res = await fn();
            setToast({ kind: res.success ? 'ok' : 'err', msg: res.message });
            window.setTimeout(() => setToast(null), 4000);
        });
    };

    return (
        <div className="space-y-3">
            {toast && (
                <div
                    className={
                        toast.kind === 'ok'
                            ? 'rounded-2xl border border-capsula-line bg-[#E5EDE7] px-4 py-3 text-sm text-[#2F6B4E] inline-flex items-center gap-2'
                            : 'rounded-2xl border border-capsula-line bg-[#F7E3DB] px-4 py-3 text-sm text-[#B04A2E] inline-flex items-center gap-2'
                    }
                >
                    {toast.kind === 'ok' ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    {toast.msg}
                </div>
            )}
            <div className="overflow-x-auto rounded-3xl border border-capsula-line bg-capsula-ivory-surface">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-capsula-line">
                            <Th>Tenant</Th>
                            <Th>Slug</Th>
                            <Th className="text-right">Users</Th>
                            <Th className="text-right">Branches</Th>
                            <Th className="text-right">Ventas 30d</Th>
                            <Th>Estado</Th>
                            <Th>Creado</Th>
                            <Th className="text-right">Acciones</Th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-4 py-12 text-center text-capsula-ink-muted">
                                    Sin tenants registrados.
                                </td>
                            </tr>
                        ) : (
                            rows.map((r) => {
                                const suspended = r.userCount > 0 && r.activeUserCount === 0;
                                return (
                                    <tr key={r.id} className="border-b border-capsula-line last:border-b-0">
                                        <Td className="font-semibold text-capsula-ink">
                                            <Link
                                                href={`/admin/tenants/${r.id}`}
                                                className="inline-flex items-center gap-1 hover:text-capsula-coral"
                                            >
                                                {r.name}
                                                <ChevronRight className="h-3 w-3 opacity-50" />
                                            </Link>
                                        </Td>
                                        <Td>
                                            <a
                                                href={`https://${r.slug}.${TENANT_ROOT_DOMAIN}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 font-mono text-capsula-navy-deep hover:text-capsula-coral"
                                            >
                                                {r.slug}
                                                <ExternalLink className="h-3 w-3" />
                                            </a>
                                        </Td>
                                        <Td className="text-right tabular-nums">
                                            {r.activeUserCount}/{r.userCount}
                                        </Td>
                                        <Td className="text-right tabular-nums">{r.branchCount}</Td>
                                        <Td className="text-right tabular-nums">{r.sales30d}</Td>
                                        <Td>
                                            {suspended ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-[#F7E3DB] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8]">
                                                    Suspendido
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-[#E5EDE7] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]">
                                                    Activo
                                                </span>
                                            )}
                                        </Td>
                                        <Td className="text-capsula-ink-soft">
                                            {new Date(r.createdAt).toLocaleDateString('es-VE', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                            })}
                                        </Td>
                                        <Td className="text-right">
                                            {suspended ? (
                                                <button
                                                    type="button"
                                                    disabled={pending}
                                                    onClick={() =>
                                                        runAction(
                                                            `Reactivar tenant "${r.name}" (${r.slug})?`,
                                                            () => reactivateTenantAction(r.id),
                                                        )
                                                    }
                                                    className="pos-btn-secondary inline-flex items-center gap-2 px-3 py-1.5 text-xs disabled:opacity-50"
                                                >
                                                    <RefreshCw className="h-3 w-3" />
                                                    Reactivar
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    disabled={pending}
                                                    onClick={() =>
                                                        runAction(
                                                            `Suspender tenant "${r.name}" (${r.slug})? Todos los usuarios serán desactivados y sus sesiones invalidadas.`,
                                                            () => suspendTenantAction(r.id),
                                                        )
                                                    }
                                                    className="pos-btn-danger inline-flex items-center gap-2 px-3 py-1.5 text-xs disabled:opacity-50"
                                                >
                                                    <Ban className="h-3 w-3" />
                                                    Suspender
                                                </button>
                                            )}
                                        </Td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <th
            className={
                'px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted ' +
                (className ?? '')
            }
        >
            {children}
        </th>
    );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
    return <td className={'px-4 py-3 ' + (className ?? '')}>{children}</td>;
}
