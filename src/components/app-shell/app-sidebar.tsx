"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronsUpDown, LogOut, Plus, UserRound } from "lucide-react"

import { Logo } from "@/components/logo"
import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { useReplayActivation } from "@/features/client/use-replay-activation"
import { fullName } from "@/lib/data"
import { useRole } from "./role-context"

export function AppSidebar() {
  const { role, user, href } = useRole()
  const pathname = usePathname()
  const replayActivation = useReplayActivation()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3 p-3">
        <div className="flex items-center gap-1">
          <div className="group/logo relative">
            <Link href={href()} className="block px-1 py-1 group-data-[collapsible=icon]:px-0">
              <Logo className="group-data-[collapsible=icon]:[&>span]:hidden" />
            </Link>
            {/* Menu replié : le bouton d'ouverture remplace le logo au survol */}
            <SidebarTrigger
              aria-label="Déplier le menu"
              className="absolute top-1 left-0 hidden size-8 bg-sidebar opacity-0 transition-opacity group-hover/logo:opacity-100 focus-visible:opacity-100 group-data-[collapsible=icon]:inline-flex hover:bg-sidebar-accent"
            />
          </div>
          <SidebarTrigger className="ml-auto text-muted-foreground group-data-[collapsible=icon]:hidden" aria-label="Replier le menu" />
        </div>
        {role.canCreateDossier && (
          <Button
            className="w-full group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0"
            render={<Link href={href("dossiers/nouveau")} />}
            nativeButton={false}
          >
            <Plus />
            <span className="group-data-[collapsible=icon]:hidden">Nouveau dossier</span>
          </Button>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {role.nav.map((item) => {
                if (item.soon)
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton aria-disabled tooltip={`${item.label} (${item.soon})`} className="cursor-default text-muted-foreground hover:bg-transparent hover:text-muted-foreground">
                        <item.icon />
                        <span>{item.label}</span>
                        <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[0.65rem] font-semibold leading-none">{item.soon}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                const url = href(item.path)
                const active =
                  pathname === url ||
                  (pathname.startsWith(url + "/") && !pathname.endsWith("/nouveau"))
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.label}
                      render={<Link href={url} />}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<SidebarMenuButton size="lg" className="data-popup-open:bg-sidebar-accent" />}
              >
                <UserAvatar user={user} className="size-8" />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{fullName(user)}</span>
                  <span className="truncate text-xs text-muted-foreground">{role.label}</span>
                </div>
                <ChevronsUpDown className="ml-auto size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    <div className="font-medium text-foreground">{fullName(user)}</div>
                    <div className="text-xs font-normal">{user.email}</div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<Link href={href("compte")} />}>
                  <UserRound />
                  Mon compte
                </DropdownMenuItem>
                {/* Client : la déconnexion simule sa première connexion, arrivé depuis le lien de l'e-mail */}
                {role.id === "client" ? (
                  <DropdownMenuItem onClick={() => replayActivation("password")}>
                    <LogOut />
                    Se déconnecter
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem render={<Link href="/" />}>
                    <LogOut />
                    Se déconnecter
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
