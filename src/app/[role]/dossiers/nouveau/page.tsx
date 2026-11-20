"use client"

import { useRole } from "@/components/app-shell/role-context"
import { RoleEmptyState } from "@/components/role-empty-state"
import { CreateDossier } from "@/features/admin/create-dossier"
import { CreateDemande } from "@/features/reparateur/create-demande"

export default function NewDossierPage() {
  const { role } = useRole()
  // Admin, gestionnaire et expert : formulaire complet ; réparateur : demande simplifiée
  if (role.id === "admin" || role.id === "gestionnaire" || role.id === "expert") return <CreateDossier />
  if (role.id === "reparateur") return <CreateDemande />
  return <RoleEmptyState page="nouveau" />
}
