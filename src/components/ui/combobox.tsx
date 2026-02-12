"use client"

import * as React from "react"
import * as ReactDOM from "react-dom"
import { Check, ChevronsUpDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ComboboxItem {
    value: string
    label: string
}

interface ComboboxProps {
    items: ComboboxItem[]
    value?: string
    onChange: (value: string) => void
    placeholder?: string
    searchPlaceholder?: string
    emptyMessage?: string
    className?: string
    modal?: boolean
}

export function Combobox({
    items,
    value,
    onChange,
    placeholder = "Seleccionar...",
    searchPlaceholder = "Buscar...",
    emptyMessage = "No se encontraron resultados.",
    className,
}: ComboboxProps) {
    const [open, setOpen] = React.useState(false)
    const [search, setSearch] = React.useState("")
    const triggerRef = React.useRef<HTMLButtonElement>(null)
    const dropdownRef = React.useRef<HTMLDivElement>(null)
    const inputRef = React.useRef<HTMLInputElement>(null)
    const [dropdownStyle, setDropdownStyle] = React.useState<React.CSSProperties>({})

    const selectedItem = items.find((item) => item.value === value)

    const filteredItems = React.useMemo(() => {
        if (!search) return items
        const lower = search.toLowerCase()
        return items.filter((item) => item.label.toLowerCase().includes(lower))
    }, [items, search])

    // Calculate dropdown position when opening
    const updatePosition = React.useCallback(() => {
        if (!triggerRef.current) return
        const rect = triggerRef.current.getBoundingClientRect()
        const spaceBelow = window.innerHeight - rect.bottom
        const dropdownHeight = 320

        // If not enough space below, show above
        const showAbove = spaceBelow < dropdownHeight && rect.top > spaceBelow

        setDropdownStyle({
            position: "fixed",
            left: rect.left,
            width: Math.max(rect.width, 280),
            ...(showAbove
                ? { bottom: window.innerHeight - rect.top + 4 }
                : { top: rect.bottom + 4 }),
            zIndex: 99999,
        })
    }, [])

    // Update position when open
    React.useEffect(() => {
        if (open) {
            updatePosition()
            // Also update on scroll/resize
            window.addEventListener("scroll", updatePosition, true)
            window.addEventListener("resize", updatePosition)
            return () => {
                window.removeEventListener("scroll", updatePosition, true)
                window.removeEventListener("resize", updatePosition)
            }
        }
    }, [open, updatePosition])

    // Close dropdown when clicking outside
    React.useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as Node
            if (
                triggerRef.current && !triggerRef.current.contains(target) &&
                dropdownRef.current && !dropdownRef.current.contains(target)
            ) {
                setOpen(false)
                setSearch("")
            }
        }
        if (open) {
            document.addEventListener("mousedown", handleClickOutside)
            return () => document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [open])

    // Focus input when dropdown opens
    React.useEffect(() => {
        if (open && inputRef.current) {
            // Small delay to ensure portal is rendered
            requestAnimationFrame(() => {
                inputRef.current?.focus()
            })
        }
    }, [open])

    const handleSelect = (itemValue: string) => {
        onChange(itemValue)
        setOpen(false)
        setSearch("")
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            setOpen(false)
            setSearch("")
        }
    }

    // Render dropdown via portal to escape table/overflow containers
    const dropdown = open
        ? ReactDOM.createPortal(
            <div
                ref={dropdownRef}
                style={dropdownStyle}
                className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
                onKeyDown={handleKeyDown}
            >
                {/* Search Input */}
                <div className="flex items-center border-b border-gray-200 px-3 dark:border-gray-700">
                    <Search className="mr-2 h-4 w-4 shrink-0 text-gray-400" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={searchPlaceholder}
                        className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-gray-400 dark:text-white dark:placeholder:text-gray-500"
                    />
                </div>

                {/* Items List */}
                <div className="overflow-y-auto" style={{ maxHeight: "260px" }}>
                    {filteredItems.length === 0 ? (
                        <div className="py-6 text-center text-sm text-gray-500">
                            {emptyMessage}
                        </div>
                    ) : (
                        <div className="p-1">
                            {filteredItems.map((item) => (
                                <button
                                    key={item.value}
                                    type="button"
                                    onClick={() => handleSelect(item.value)}
                                    className={cn(
                                        "relative flex w-full cursor-pointer select-none items-center rounded-md px-2 py-2 text-sm outline-none transition-colors",
                                        "hover:bg-amber-50 hover:text-amber-900 dark:hover:bg-amber-900/20 dark:hover:text-amber-300",
                                        value === item.value && "bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-300"
                                    )}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4 shrink-0",
                                            value === item.value ? "opacity-100 text-amber-600" : "opacity-0"
                                        )}
                                    />
                                    <span className="truncate">{item.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>,
            document.body
        )
        : null

    return (
        <div className="relative">
            {/* Trigger Button */}
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setOpen(!open)}
                className={cn(
                    "flex h-10 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-white",
                    "hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500",
                    "dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700",
                    !value && "text-gray-500",
                    className
                )}
            >
                <span className="truncate">
                    {selectedItem ? selectedItem.label : placeholder}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </button>

            {/* Dropdown rendered via portal */}
            {dropdown}
        </div>
    )
}
