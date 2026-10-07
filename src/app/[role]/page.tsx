import { redirect } from "next/navigation"

export default async function RoleIndex({ params }: PageProps<"/[role]">) {
  const { role } = await params
  redirect(`/${role}/tableau-de-bord`)
}
