"use client"

import { Suspense } from "react"

import { useRole } from "@/components/app-shell/role-context"
import { RoleEmptyState } from "@/components/role-empty-state"
import { DossiersList } from "@/features/admin/dossiers-list"

export default function ArchivesPage() {
  const { role } = useRole()
  if (role.id !== "admin") return <RoleEmptyState page="archives" />
  return (
    <Suspense>
      <DossiersList mode="archives" />
    </Suspense>
  )
}
