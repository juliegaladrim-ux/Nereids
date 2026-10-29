"use client"

import * as React from "react"
import { CalendarDays, Clock } from "lucide-react"
import { fr } from "react-day-picker/locale"

import { SimpleSelect } from "@/components/simple-select"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const pad = (n: number) => String(n).padStart(2, "0")

const HOURS = Array.from({ length: 24 }, (_, i) => ({ value: pad(i), label: pad(i) }))
/** Minutes de 5 en 5 (10 h 15, 14 h 40…) */
const MINUTES = Array.from({ length: 12 }, (_, i) => ({ value: pad(i * 5), label: pad(i * 5) }))

/** « 2026-11-24 » → Date locale (sans décalage de fuseau) */
const parseDay = (s: string) => {
  const [y, m, d] = s.split("-").map(Number)
  return y && m && d ? new Date(y, m - 1, d) : undefined
}
const dayValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/**
 * Champ date (ou date + heure) aux couleurs de l'app, à la place des sélecteurs natifs du navigateur.
 * Même format de valeur que les champs natifs : « 2026-11-24 » ou « 2026-11-24T09:00 ».
 */
export function DateInput({
  value,
  onChange,
  withTime = false,
  min,
  id,
  className,
  placeholder,
  "aria-label": ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  /** Ajoute le choix de l'heure (heures + minutes de 5 en 5) */
  withTime?: boolean
  /** Première date sélectionnable (« 2026-11-24 » ou avec l'heure) */
  min?: string
  id?: string
  className?: string
  placeholder?: string
  "aria-label"?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [day, time = ""] = value.split("T")
  const [hh = "", mm = ""] = time ? time.split(":") : []
  const selected = day ? parseDay(day) : undefined
  const minDay = min ? parseDay(min.split("T")[0]) : undefined

  const label = selected
    ? selected.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long", year: "numeric" })
    : null

  function pickDay(d?: Date) {
    if (!d) return
    if (!withTime) {
      onChange(dayValue(d))
      setOpen(false)
    } else onChange(`${dayValue(d)}T${time}`)
  }

  function pickTime(h: string, m: string) {
    // Heure choisie avant le jour : on part d'aujourd'hui (ou de la première date possible)
    const base = selected ?? minDay ?? new Date()
    onChange(`${dayValue(base)}T${h}:${m}`)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        aria-label={ariaLabel}
        className={cn(
          "flex h-10 w-full min-w-0 items-center gap-2 rounded-[6px] border border-input bg-card px-3 text-left text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:border-ring md:text-sm",
          className,
        )}
      >
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
        {label ? (
          <span className="truncate first-letter:uppercase">
            {label}
            {withTime && (time ? ` · ${time.replace(":", " h ")}` : <span className="text-muted-foreground"> · heure ?</span>)}
          </span>
        ) : (
          <span className="truncate text-muted-foreground">{placeholder ?? (withTime ? "Choisir une date et une heure" : "Choisir une date")}</span>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto gap-0 p-0">
        <Calendar
          mode="single"
          locale={fr}
          selected={selected}
          defaultMonth={selected ?? minDay}
          onSelect={pickDay}
          disabled={minDay ? { before: minDay } : undefined}
          className="p-3 [--cell-size:--spacing(9)]"
        />
        {withTime && (
          <div className="flex flex-col gap-3 border-t p-3">
            <div className="flex items-center gap-2">
              <Clock className="size-4 shrink-0 text-muted-foreground" />
              <span className="text-sm font-medium">Heure</span>
              <SimpleSelect size="sm" className="ml-auto w-18" placeholder="--" value={hh || null} options={HOURS} onChange={(h) => h && pickTime(h, mm || "00")} />
              <span className="text-sm text-muted-foreground">h</span>
              <SimpleSelect size="sm" className="w-18" placeholder="--" value={mm || null} options={MINUTES} onChange={(m) => m && pickTime(hh || "09", m)} />
            </div>
            <Button className="w-full" disabled={!selected || !time} onClick={() => setOpen(false)}>
              Valider
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
