"use client"

import { useRole } from "@/components/app-shell/role-context"
import { RoleEmptyState } from "@/components/role-empty-state"
import { AnnuairePage as AdminAnnuaire } from "@/features/annuaire/annuaire-page"

/** Annuaire : visible par les admins Nereids uniquement (la recherche dans l'annuaire reste ouverte aux gestionnaires à la création de dossier) */
export default function AnnuairePage() {
  const { role } = useRole()
  if (role.id !== "admin") return <RoleEmptyState page="annuaire" />
  return <AdminAnnuaire />
}
