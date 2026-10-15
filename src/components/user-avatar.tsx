import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { initials } from "@/lib/format"
import type { RoleId } from "@/lib/roles"

/** Couleur d'identification par rôle (tokens --role-* de globals.css) : même code partout dans le dossier */
const ROLE_COLORS: Record<RoleId, string> = {
  admin: "bg-role-admin-bg text-role-admin",
  gestionnaire: "bg-role-gestionnaire-bg text-role-gestionnaire",
  expert: "bg-role-expert-bg text-role-expert",
  reparateur: "bg-role-reparateur-bg text-role-reparateur",
  suiveur: "bg-role-suiveur-bg text-role-suiveur",
  client: "bg-role-client-bg text-role-client",
}

/** Avatar coloré selon le rôle : chaque intervenant se reconnaît d'un coup d'œil */
export function UserAvatar({
  user,
  role = user?.role,
  className,
}: {
  user?: { firstName: string; lastName: string; role?: RoleId }
  role?: RoleId
  className?: string
}) {
  return (
    <Avatar className={cn("size-7", className)}>
      <AvatarFallback className={cn("bg-brand/10 text-[0.7rem] font-medium text-brand-ink", role && ROLE_COLORS[role])}>
        {user ? initials(user.firstName, user.lastName) : "?"}
      </AvatarFallback>
    </Avatar>
  )
}
