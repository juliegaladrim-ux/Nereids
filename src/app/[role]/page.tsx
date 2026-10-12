import { notFound, redirect } from "next/navigation"

import { getRole } from "@/lib/roles"

export default async function RoleIndex({ params }: PageProps<"/[role]">) {
  const { role: roleId } = await params
  const role = getRole(roleId)
  if (!role) notFound()
  redirect(`/${role.id}/${role.home}`)
}
