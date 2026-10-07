import { Clock } from "lucide-react"

import { cn } from "@/lib/utils"
import { STATUSES, type StatusId, type StatusTone } from "@/lib/data"

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
      <span className={cn("size-1.5 rounded-full", DOT_CLASSES[s.tone])} />
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
