"use client"

import { Suspense } from "react"

import { useRole } from "@/components/app-shell/role-context"
import { RoleEmptyState } from "@/components/role-empty-state"
import { DossiersList } from "@/features/admin/dossiers-list"
import { ClientHome } from "@/features/client/client-home"

export default function DossiersPage() {
  const { role } = useRole()
  if (role.id === "client") return <ClientHome />
  if (role.id !== "admin") return <RoleEmptyState page="dossiers" />
  return (
    <Suspense>
      <DossiersList />
    </Suspense>
  )
}
