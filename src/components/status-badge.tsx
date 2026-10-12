import { CalendarDays, Clock } from "lucide-react"

import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { STATUSES, VALIDATION_ITEMS, convocationSent, type ClientValidation, type Dossier, type StatusId, type StatusTone, type ValidationState } from "@/lib/data"

const TONE_CLASSES: Record<StatusTone, string> = {
  new: "bg-tone-new-bg text-tone-new",
  progress: "bg-tone-progress-bg text-tone-progress",
  waiting: "bg-tone-waiting-bg text-tone-waiting",
  alert: "bg-tone-alert-bg text-tone-alert",
  final: "bg-tone-final-bg text-tone-final",
  done: "bg-tone-done-bg text-tone-done",
  muted: "bg-tone-muted-bg text-tone-muted",
}

const DOT_CLASSES: Record<StatusTone, string> = {
  new: "bg-tone-new",
  progress: "bg-tone-progress",
  waiting: "bg-tone-waiting",
  alert: "bg-tone-alert",
  final: "bg-tone-final",
  done: "bg-tone-done",
  muted: "bg-tone-muted",
}

export function StatusBadge({ status, className }: { status: StatusId; className?: string }) {
  const s = STATUSES[status]
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap",
        TONE_CLASSES[s.tone],
        className,
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", DOT_CLASSES[s.tone])} />
      {s.label}
    </span>
  )
}

export function LateBadge({ days, className }: { days: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full bg-destructive/10 px-2 text-xs font-semibold whitespace-nowrap text-destructive",
        className,
      )}
    >
      <Clock className="size-3.5" />
      Retard {days > 0 ? `${days} j` : ""}
    </span>
  )
}

// Orange plus vif que celui des statuts « En attente » : sur une simple pastille, il tirait sur le marron
const VALIDATION_DOT: Record<ValidationState, string> = { ok: "bg-tone-done", en_attente: "bg-orange-500", a_faire: "bg-tone-alert" }

/** Voyants M / D / R : mission signée, devis signé, règlement reçu */
export function ValidationPills({ validation, className }: { validation: ClientValidation; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {VALIDATION_ITEMS.map((it) => {
        const state = validation[it.key]
        const text = `${it.label} ${state === "ok" ? it.done : state === "en_attente" ? it.pending : it.todo}`
        return (
          <Tooltip key={it.key}>
            <TooltipTrigger
              render={
                <span
                  aria-label={text}
                  className={cn(
                    "inline-flex h-6 cursor-default items-center gap-1.5 rounded-full border bg-card px-2 text-xs font-semibold",
                  )}
                />
              }
            >
              <span className={cn("size-1.5 rounded-full", VALIDATION_DOT[state])} />
              {it.letter}
            </TooltipTrigger>
            <TooltipContent>{text}</TooltipContent>
          </Tooltip>
        )
      })}
    </span>
  )
}

/** Rendez-vous d'expertise dans l'en-tête : point vert = convocation faite, gris = pas encore */
export function ExpertiseBadge({ dossier: d, className }: { dossier: Dossier; className?: string }) {
  const { date, lieu } = d.expertise
  const sent = convocationSent(d)
  const day = date ? new Date(date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) : null
  const time = date ? new Date(date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : null
  const state = !date ? "Expertise non programmée" : sent ? "Convocation envoyée" : "Convocation pas encore envoyée"
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            aria-label={`Expertise — ${state}`}
            className={cn("inline-flex h-6 max-w-full min-w-0 cursor-default items-center gap-1.5 rounded-md border bg-card px-2 text-xs", className)}
          />
        }
      >
        <span className={cn("size-1.5 shrink-0 rounded-full", sent && date ? "bg-tone-done" : "bg-muted-foreground/40")} />
        <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
        {date ? (
          <>
            <span className="shrink-0 font-semibold first-letter:uppercase">
              {day} · {time}
            </span>
            {lieu && <span className="truncate text-muted-foreground">{lieu}</span>}
          </>
        ) : (
          <span className="text-muted-foreground">Expertise non programmée</span>
        )}
      </TooltipTrigger>
      <TooltipContent>
        {lieu && <p>{lieu}</p>}
        <p>{state}</p>
      </TooltipContent>
    </Tooltip>
  )
}
