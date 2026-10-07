import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Logo } from "@/components/logo"
import { Badge } from "@/components/ui/badge"
import { ROLES } from "@/lib/roles"

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-12 sm:py-20">
      <Logo />
      <h1 className="mt-10 text-2xl font-semibold tracking-tight sm:text-3xl">Prototype de la plateforme</h1>
      <p className="mt-2 text-muted-foreground">Choisissez un profil.</p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {ROLES.map((role) => (
          <Link
            key={role.id}
            href={`/${role.id}/tableau-de-bord`}
            className="group flex items-center justify-between gap-3 rounded-xl border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
          >
            <span className="font-medium">{role.label}</span>
            <div className="flex items-center gap-3">
              {role.ready ? (
                <Badge>Parcours disponibles</Badge>
              ) : (
                <Badge variant="secondary">Espace vide</Badge>
              )}
              <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}
