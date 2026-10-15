"use client"

import { Plus } from "lucide-react"

import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

export type Option = { value: string; label: string; hint?: string }

const ACTION = "__action"

/** Raccourci autour du Select shadcn (Base UI) pour une liste simple d'options */
export function SimpleSelect({
  options,
  value,
  onChange,
  placeholder = "Sélectionner",
  className,
  id,
  size,
  action,
}: {
  options: Option[]
  value: string | null
  onChange: (v: string | null) => void
  placeholder?: string
  className?: string
  id?: string
  size?: "sm" | "default"
  /** Dernière entrée de la liste qui déclenche une action au lieu de sélectionner (ex. « Ajouter un expert ») */
  action?: { label: string; onSelect: () => void }
}) {
  return (
    <Select
      items={options.map((o) => ({ value: o.value, label: o.label }))}
      value={value}
      onValueChange={(v) => (v === ACTION ? action?.onSelect() : onChange((v as string | null) ?? null))}
    >
      <SelectTrigger id={id} size={size} className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.hint ? (
              <span className="flex w-full items-center justify-between gap-3">
                <span>{o.label}</span>
                <span className="text-xs text-muted-foreground">{o.hint}</span>
              </span>
            ) : (
              o.label
            )}
          </SelectItem>
        ))}
        {action && (
          <>
            {options.length > 0 && <SelectSeparator />}
            <SelectItem value={ACTION} className="font-medium text-brand-ink">
              <Plus /> {action.label}
            </SelectItem>
          </>
        )}
      </SelectContent>
    </Select>
  )
}
