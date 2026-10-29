import { notFound } from "next/navigation"

import { AppHeader } from "@/components/app-shell/app-header"
import { AppSidebar } from "@/components/app-shell/app-sidebar"
import { ProtoBar } from "@/components/app-shell/proto-bar"
import { RoleProvider } from "@/components/app-shell/role-context"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getRole, ROLE_IDS } from "@/lib/roles"

export function generateStaticParams() {
  return ROLE_IDS.map((role) => ({ role }))
}

export default async function RoleLayout({ children, params }: LayoutProps<"/[role]">) {
  const { role: roleId } = await params
  const role = getRole(roleId)
  if (!role) notFound()

  return (
    <RoleProvider roleId={role.id}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="relative min-w-0">
          <AppHeader />
          <div className="relative flex min-w-0 flex-1 flex-col px-4 pt-6 pb-24 sm:px-6 lg:px-8">{children}</div>
        </SidebarInset>
      </SidebarProvider>
      <ProtoBar />
    </RoleProvider>
  )
}
