"use client"

import { redirect } from "next/navigation"

import { useRole } from "@/components/app-shell/role-context"
import { RoleEmptyState } from "@/components/role-empty-state"

export default function DashboardPage() {
  const { role } = useRole()
  if (role.home !== "tableau-de-bord") redirect(`/${role.id}/${role.home}`)
  return <RoleEmptyState page="tableau-de-bord" />
}
