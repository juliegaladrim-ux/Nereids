import { cn } from "@/lib/utils"

/** Logo provisoire — à remplacer par le logo Nereids de la charte */
export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="grid size-8 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
        N
      </div>
      <span className="text-base font-semibold tracking-tight">Nereids</span>
    </div>
  )
}
