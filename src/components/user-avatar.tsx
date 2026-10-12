import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { initials } from "@/lib/format"

export function UserAvatar({
  user,
  className,
}: {
  user?: { firstName: string; lastName: string }
  className?: string
}) {
  return (
    <Avatar className={cn("size-7", className)}>
      <AvatarFallback className="bg-brand/10 text-[0.7rem] font-medium text-brand-ink">
        {user ? initials(user.firstName, user.lastName) : "?"}
      </AvatarFallback>
    </Avatar>
  )
}
