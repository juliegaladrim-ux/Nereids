"use client"

import { useRole } from "@/components/app-shell/role-context"
import { RoleEmptyState } from "@/components/role-empty-state"
import { AdminDashboard } from "@/features/admin/admin-dashboard"
import { ClientHome } from "@/features/client/client-home"

export default function DashboardPage() {
  const { role } = useRole()
  if (role.id === "admin") return <AdminDashboard />
  if (role.id === "client") return <ClientHome />
  return <RoleEmptyState page="tableau-de-bord" />
}
