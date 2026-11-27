"use client"

import { useRole } from "@/components/app-shell/role-context"
import { RoleEmptyState } from "@/components/role-empty-state"
import { CabinetPage as Cabinet } from "@/features/admin/cabinet-page"

/** Fiche du cabinet : réservée à l'administrateur du cabinet */
export default function CabinetRoute() {
  const { role } = useRole()
  if (role.id !== "admin_cabinet") return <RoleEmptyState page="dossiers" />
  return <Cabinet />
}
