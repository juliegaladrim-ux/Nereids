"use client"

import { use } from "react"

import { useRole } from "@/components/app-shell/role-context"
import { RoleEmptyState } from "@/components/role-empty-state"
import { DossierDetail } from "@/features/dossier/dossier-detail"

export default function DossierPage({ params }: PageProps<"/[role]/dossiers/[id]">) {
  const { id } = use(params)
  const { role } = useRole()
  // Fiche commune : chaque rôle la voit avec ses droits (lib/access.ts)
  if (role.id === "admin" || role.id === "gestionnaire" || role.id === "client" || role.id === "suiveur" || role.id === "reparateur" || role.id === "expert")
    return <DossierDetail id={decodeURIComponent(id)} />
  return <RoleEmptyState page="dossier" />
}
