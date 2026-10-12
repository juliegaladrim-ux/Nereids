import { cn } from "@/lib/utils"

/** Plaque d'immatriculation façon plaque française : repère visuel immédiat */
export function Immat({ value, className }: { value: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-stretch overflow-hidden rounded-[4px] border border-foreground/25 bg-card text-xs font-semibold tracking-wide whitespace-nowrap",
        className,
      )}
    >
      <span className="grid w-3 place-items-center bg-brand text-[0.5rem] leading-none font-bold text-primary-foreground">F</span>
      <span className="flex items-center px-1.5 uppercase tabular-nums">{value}</span>
    </span>
  )
}
