"use client"

import { useRole } from "@/components/app-shell/role-context"
import { RoleEmptyState } from "@/components/role-empty-state"
import { CreateDossier } from "@/features/admin/create-dossier"

export default function NewDossierPage() {
  const { role } = useRole()
  if (role.id === "admin" || role.id === "gestionnaire") return <CreateDossier />
  return <RoleEmptyState page="nouveau" />
}
