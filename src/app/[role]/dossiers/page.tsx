"use client"

import { Suspense } from "react"

import { useRole } from "@/components/app-shell/role-context"
import { RoleEmptyState } from "@/components/role-empty-state"
import { DossiersList } from "@/features/admin/dossiers-list"
import { ClientDossiers } from "@/features/client/client-dossiers"
import { SuiveurDossiers } from "@/features/suiveur/suiveur-dossiers"

export default function DossiersPage() {
  const { role } = useRole()
  if (role.id === "client") return <ClientDossiers />
  if (role.id === "suiveur") return <SuiveurDossiers />
  if (role.id !== "admin" && role.id !== "gestionnaire") return <RoleEmptyState page="dossiers" />
  return (
    <Suspense>
      <DossiersList />
    </Suspense>
  )
}
