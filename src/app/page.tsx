import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Logo } from "@/components/logo"
import { Badge } from "@/components/ui/badge"
import { ROLES } from "@/lib/roles"
import { getUser, fullName } from "@/lib/data"

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-12 sm:py-20">
      <Logo />
      <h1 className="mt-10 text-2xl font-semibold tracking-tight sm:text-3xl">Prototype de la plateforme</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Choisissez un profil pour découvrir son espace. Vous pourrez changer de profil à tout moment
        grâce au bandeau « Prototype » en bas de l&apos;écran. Toutes les données sont fictives.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {ROLES.map((role) => {
          const user = getUser(role.userId)
          return (
            <Link
              key={role.id}
              href={`/${role.id}/tableau-de-bord`}
              className="group flex flex-col gap-2 rounded-xl border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{role.label}</span>
                {role.ready ? (
                  <Badge>Parcours disponibles</Badge>
                ) : (
                  <Badge variant="secondary">Espace vide</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{role.description}</p>
              <div className="mt-auto flex items-center justify-between pt-2 text-sm">
                <span className="text-muted-foreground">
                  Connecté en tant que <span className="text-foreground">{fullName(user)}</span>
                </span>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
            </Link>
          )
        })}
      </div>
    </main>
  )
}
