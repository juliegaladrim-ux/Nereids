"use client"

import { redirect } from "next/navigation"

import { useRole } from "@/components/app-shell/role-context"
import { RoleEmptyState } from "@/components/role-empty-state"
import { AdminDashboard } from "@/features/admin/admin-dashboard"

export default function DashboardPage() {
  const { role } = useRole()
  if (role.id === "admin") return <AdminDashboard />
  if (role.home !== "tableau-de-bord") redirect(`/${role.id}/${role.home}`)
  return <RoleEmptyState page="tableau-de-bord" />
}
