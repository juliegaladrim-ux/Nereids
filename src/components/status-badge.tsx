import { CalendarDays, ChevronDown, Clock, FolderOpen, Phone } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ABONNEMENTS, type Abonnement } from "@/lib/annuaire"
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

/** Voyants M / D / R : mission signée, devis signé, règlement reçu — une ligne par voyant ; avec onChange, chaque voyant se passe à la main */
export function ValidationPills({
  validation,
  onChange,
  className,
}: {
  validation: ClientValidation
  onChange?: (key: keyof ClientValidation, state: ValidationState) => void
  className?: string
}) {
  // Sous-grille : libellés et états alignés en colonnes, un état long passe à la ligne sous lui-même
  // Modifiable : chaque ligne a l'allure d'un sélecteur (fond, chevron) pour qu'on comprenne qu'elle se change au clic
  const row = cn(
    "-mx-1.5 grid grid-cols-subgrid items-baseline gap-x-2 rounded-md px-1.5 py-0.5 text-left text-sm",
    onChange ? "col-span-4 my-px" : "col-span-3",
  )
  return (
    <span className={cn("grid w-fit", onChange ? "grid-cols-[auto_auto_1fr_auto]" : "grid-cols-[auto_auto_1fr]", className)}>
      {VALIDATION_ITEMS.map((it) => {
        const state = validation[it.key]
        const status = state === "ok" ? it.done : state === "en_attente" ? it.pending : it.todo
        const content = (
          <>
            <span className={cn("size-2 shrink-0 -translate-y-px rounded-full", VALIDATION_DOT[state])} />
            <span className="font-medium">{it.label}</span>
            <span className="text-muted-foreground">{status}</span>
          </>
        )
        if (onChange)
          return (
            <DropdownMenu key={it.key}>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    title="Modifier"
                    aria-label={`${it.label} ${status} — modifier`}
                    className={cn(row, "group cursor-pointer bg-muted/60 transition-colors hover:bg-muted data-[popup-open]:bg-muted")}
                  />
                }
              >
                {content}
                <ChevronDown className="size-3.5 translate-y-0.5 self-start text-muted-foreground transition-colors group-hover:text-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>{it.label}</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={state} onValueChange={(v) => v !== state && onChange(it.key, v as ValidationState)}>
                    {(["a_faire", "en_attente", "ok"] as const).map((s) => (
                      <DropdownMenuRadioItem key={s} value={s}>
                        <span className={cn("size-1.5 rounded-full", VALIDATION_DOT[s])} />
                        <span className="first-letter:uppercase">{s === "ok" ? it.done : s === "en_attente" ? it.pending : it.todo}</span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        return (
          <span key={it.key} className={row}>
            {content}
          </span>
        )
      })}
    </span>
  )
}

/** Abonnement souscrit par le cabinet du dossier : une icône par service, le libellé et le détail des droits au survol */
export function AbonnementBadge({ abonnement, showLabel, className }: { abonnement?: Abonnement; showLabel?: boolean; className?: string }) {
  if (!abonnement) return <span className={cn("text-xs text-muted-foreground", className)}>Abonnement non renseigné</span>
  const a = ABONNEMENTS[abonnement]
  const pastille = "flex size-6 items-center justify-center rounded-full ring-2 ring-card"
  return (
    <Tooltip>
      <TooltipTrigger render={<span aria-label={a.label} className={cn("inline-flex shrink-0 cursor-default items-center gap-2", className)} />}>
        <span className="flex -space-x-1.5">
          {abonnement !== "telephonie" && (
            <span className={cn(pastille, "bg-brand text-white")}>
              <FolderOpen className="size-3.5" />
            </span>
          )}
          {abonnement !== "gestion" && (
            <span className={cn(pastille, "bg-brand-soft text-brand-ink")}>
              <Phone className="size-3.5" />
            </span>
          )}
        </span>
        {showLabel && <span className="text-sm whitespace-nowrap">{a.label}</span>}
      </TooltipTrigger>
      <TooltipContent>
        <span className="font-semibold">{a.label}</span> · {a.detail}
      </TooltipContent>
    </Tooltip>
  )
}

/** Rendez-vous d'expertise dans l'en-tête : date, lieu et état de la convocation, en clair */
export function ExpertiseBadge({ dossier: d, className, wrapLieu }: { dossier: Dossier; className?: string; /** Rend le lieu cliquable (coordonnées) */ wrapLieu?: (lieu: React.ReactNode) => React.ReactNode }) {
  const { date, lieu } = d.expertise
  const sent = convocationSent(d)
  const day = date ? new Date(date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : null
  const time = date ? new Date(date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : null
  if (!date)
    return (
      <span className={cn("inline-flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <CalendarDays className="size-3.5 shrink-0" /> Non programmée
      </span>
    )
  return (
    <span className={cn("flex flex-col gap-0.5 text-sm", className)}>
      <span className="inline-flex items-center gap-2 font-medium">
        <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="first-letter:uppercase">
          {day} à {time}
        </span>
      </span>
      {lieu && <span className="pl-5.5 text-muted-foreground">{wrapLieu ? wrapLieu(lieu) : lieu}</span>}
      <span className="inline-flex items-center gap-2 pl-0.5 text-sm text-muted-foreground">
        <span className={cn("mx-[3px] size-2 shrink-0 rounded-full", sent ? "bg-tone-done" : "bg-muted-foreground/40")} />
        {sent ? "Convocation envoyée" : "Convocation pas encore envoyée"}
      </span>
    </span>
  )
}
