"use client"

import { useRole } from "@/components/app-shell/role-context"
import { RoleEmptyState } from "@/components/role-empty-state"
import { UsersPage as AdminUsers } from "@/features/admin/users-page"

export default function UsersPage() {
  const { role } = useRole()
  if (role.id !== "admin") return <RoleEmptyState page="utilisateurs" />
  return <AdminUsers />
}
