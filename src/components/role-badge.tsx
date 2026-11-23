import { cn } from "@/lib/utils"
import { ROLE_COLORS } from "@/components/user-avatar"
import { ACTOR_LABELS } from "@/lib/data"
import type { RoleId } from "@/lib/roles"

/** Pastille du rôle, dans la couleur du rôle (tokens --role-*) : repérer d'un coup d'œil qui est qui */
export function RoleBadge({ role, label, className }: { role: RoleId; label?: string; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 items-center rounded-full px-2 text-[0.7rem] font-medium whitespace-nowrap", ROLE_COLORS[role], className)}>
      {label ?? ACTOR_LABELS[role]}
    </span>
  )
}
