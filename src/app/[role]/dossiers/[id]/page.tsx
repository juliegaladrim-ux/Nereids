"use client"

import { use } from "react"

import { useRole } from "@/components/app-shell/role-context"
import { RoleEmptyState } from "@/components/role-empty-state"
import { DossierDetail } from "@/features/dossier/dossier-detail"

export default function DossierPage({ params }: PageProps<"/[role]/dossiers/[id]">) {
  const { id } = use(params)
  const { role } = useRole()
  if (role.id === "admin") return <DossierDetail id={decodeURIComponent(id)} />
  return <RoleEmptyState page="dossier" />
}
