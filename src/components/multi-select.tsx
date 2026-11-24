"use client"

import * as React from "react"
import { Check, ChevronDown, Search, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

/**
 * Choix multiple dans une longue liste : même liste déroulante que les autres champs,
 * avec une ligne de recherche en tête. Les choix retenus s'affichent en puces sous le champ.
 * Composé uniquement d'éléments du design system (Popover, Input, Badge).
 */
export function MultiSelect({
  options,
  value,
  onChange,
  id,
  emptyLabel = "Aucun choix",
  filterPlaceholder = "Rechercher dans la liste…",
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
    <div className="flex flex-col gap-2">
      <Popover onOpenChange={(o) => !o && setQ("")}>
        <PopoverTrigger
          id={id}
          className="flex h-10 w-full items-center justify-between gap-1.5 rounded-[6px] border border-input bg-card py-2 pr-2.5 pl-3 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50"
        >
          <span className={cn("truncate", value.length === 0 && "text-muted-foreground")}>
            {value.length === 0 ? emptyLabel : `${value.length} objet${value.length > 1 ? "s" : ""} sélectionné${value.length > 1 ? "s" : ""}`}
          </span>
          <ChevronDown className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--anchor-width) min-w-64 gap-1 p-1">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input autoFocus className="pl-8" placeholder={filterPlaceholder} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div role="listbox" aria-multiselectable className="flex max-h-60 flex-col overflow-y-auto">
            {shown.map((o) => {
              const on = value.includes(o)
              return (
                <button
                  key={o}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => toggle(o)}
                  className="relative flex w-full cursor-default items-center rounded-md py-1.5 pr-8 pl-1.5 text-left text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent"
                >
                  {o}
                  {on && <Check className="pointer-events-none absolute right-2 size-4" />}
                </button>
              )
            })}
            {shown.length === 0 && <span className="px-2 py-2 text-sm text-muted-foreground">Aucun résultat</span>}
          </div>
        </PopoverContent>
      </Popover>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((o) => (
            <Badge key={o} variant="secondary" className="h-6 gap-1 pr-1">
              {o}
              <button type="button" aria-label={`Retirer ${o}`} className="rounded-full p-0.5 hover:bg-foreground/10" onClick={() => toggle(o)}>
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
