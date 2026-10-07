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
} from "@/components/ui/sidebar"
import { fullName } from "@/lib/data"
import { useRole } from "./role-context"

export function AppSidebar() {
  const { role, user, href } = useRole()
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3 p-3">
        <Link href={href()} className="px-1 py-1 group-data-[collapsible=icon]:px-0">
          <Logo className="group-data-[collapsible=icon]:[&>span]:hidden" />
        </Link>
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
                <DropdownMenuItem render={<Link href="/" />}>
                  <LogOut />
                  Se déconnecter
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
