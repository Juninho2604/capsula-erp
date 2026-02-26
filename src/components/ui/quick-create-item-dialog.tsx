"use client"

import { useState } from "react"
import { X, Package, Loader2 } from "lucide-react"
import * as ReactDOM from "react-dom"
import { createQuickItem } from "@/app/actions/inventory.actions"

interface QuickCreateItemDialogProps {
    open: boolean
    onClose: () => void
    onItemCreated: (item: { id: string; name: string; baseUnit: string }) => void
    initialName: string
    userId: string
}

const UNIT_OPTIONS = [
    { value: "KG", label: "Kilogramos (KG)" },
    { value: "G", label: "Gramos (G)" },
    { value: "L", label: "Litros (L)" },
    { value: "ML", label: "Mililitros (ML)" },
    { value: "UNIT", label: "Unidades (UND)" },
    { value: "PORTION", label: "Porciones" },
]

const TYPE_OPTIONS = [
    { value: "RAW_MATERIAL", label: "Materia Prima" },
    { value: "SUB_RECIPE", label: "Sub-receta / Preparación" },
    { value: "FINISHED_GOOD", label: "Producto Terminado" },
]

export function QuickCreateItemDialog({
    open,
    onClose,
    onItemCreated,
    initialName,
    userId
}: QuickCreateItemDialogProps) {
    const [name, setName] = useState(initialName)
    const [unit, setUnit] = useState("KG")
    const [type, setType] = useState("RAW_MATERIAL")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    // Reset form when dialog opens with new name
    useState(() => {
        setName(initialName)
        setError("")
    })

    if (!open) return null

    const handleCreate = async () => {
        if (!name.trim()) {
            setError("El nombre es obligatorio")
            return
        }
        setError("")
        setLoading(true)
        try {
            const result = await createQuickItem({
                name: name.trim(),
                unit,
                type,
                userId
            })
            if (result.success && result.item) {
                onItemCreated({
                    id: result.item.id,
                    name: result.item.name,
                    baseUnit: result.item.baseUnit
                })
                onClose()
            } else {
                setError(result.message || 'Error al crear el producto')
            }
        } catch (err) {
            console.error('Error creando item:', err)
            setError('Error inesperado al crear el producto')
        } finally {
            setLoading(false)
        }
    }

    return ReactDOM.createPortal(
        <div
            className="fixed inset-0 z-[100001] flex items-center justify-center bg-black/60 animate-fade-in p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md animate-scale-in
                            border border-gray-200 dark:border-gray-700">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/30">
                            <Package className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">Crear Producto Rápido</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Se agregará al inventario</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <X className="h-5 w-5 text-gray-400" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-5 py-5 space-y-4">
                    {/* Nombre */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            Nombre del Producto *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ej: Carne Macerada Shawarma"
                            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 bg-white
                                       dark:bg-gray-800 dark:border-gray-700 dark:text-white
                                       focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none
                                       placeholder:text-gray-400"
                            autoFocus
                        />
                    </div>

                    {/* Unidad */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            Unidad de Medida
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {UNIT_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setUnit(opt.value)}
                                    className={`px-3 py-2 text-sm rounded-lg border transition-all duration-150 min-h-[44px]
                                        ${unit === opt.value
                                            ? 'border-amber-500 bg-amber-50 text-amber-800 font-medium dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-600 ring-2 ring-amber-500/20'
                                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Tipo */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            Tipo
                        </label>
                        <div className="space-y-2">
                            {TYPE_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setType(opt.value)}
                                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm rounded-xl border transition-all duration-150 min-h-[44px]
                                        ${type === opt.value
                                            ? 'border-amber-500 bg-amber-50 text-amber-800 font-medium dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-600 ring-2 ring-amber-500/20'
                                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                                        }`}
                                >
                                    <div className={`w-3 h-3 rounded-full ${type === opt.value ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                            {error}
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-3 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl
                                   hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700
                                   transition-colors min-h-[44px] disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleCreate}
                        disabled={loading || !name.trim()}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium 
                                   text-white bg-amber-600 rounded-xl hover:bg-amber-700 
                                   transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed
                                   shadow-sm shadow-amber-600/20"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Creando...
                            </>
                        ) : (
                            <>
                                <Package className="h-4 w-4" />
                                Crear y Seleccionar
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}
