"use client"

import * as React from "react"
import { Search, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

/**
 * Choix multiple dans une longue liste : les choix en puces, un filtre, puis la liste à cocher.
 * Composé uniquement d'éléments du design system (Badge, Input).
 */
export function MultiSelect({
  options,
  value,
  onChange,
  id,
  emptyLabel = "Aucun choix",
  filterPlaceholder = "Filtrer la liste…",
}: {
  options: string[]
  value: string[]
  onChange: (v: string[]) => void
  id?: string
  emptyLabel?: string
  filterPlaceholder?: string
}) {
  const [q, setQ] = React.useState("")
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o])
  const shown = q.trim() ? options.filter((o) => norm(o).includes(norm(q))) : options

  return (
    <div className="flex flex-col rounded-lg border bg-background">
      <div className="flex min-h-11 flex-wrap items-center gap-1.5 p-2">
        {value.length === 0 && <span className="px-1 text-sm text-muted-foreground">{emptyLabel}</span>}
        {value.map((o) => (
          <Badge key={o} variant="secondary" className="h-6 gap-1 pr-1">
            {o}
            <button type="button" aria-label={`Retirer ${o}`} className="rounded-full p-0.5 hover:bg-foreground/10" onClick={() => toggle(o)}>
              <X />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex flex-col gap-2 border-t p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id={id} className="pl-8" placeholder={filterPlaceholder} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
          {shown.map((o) => {
            const on = value.includes(o)
            return (
              <button
                key={o}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(o)}
                className={cn(
                  "rounded-full border bg-background px-3 py-1 text-xs transition-colors hover:border-foreground/30",
                  on && "border-brand bg-brand text-primary-foreground hover:border-brand",
                )}
              >
                {o}
              </button>
            )
          })}
          {shown.length === 0 && <span className="px-1 py-1 text-sm text-muted-foreground">Aucun résultat</span>}
        </div>
      </div>
    </div>
  )
}
