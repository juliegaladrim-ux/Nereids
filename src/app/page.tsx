import Link from "next/link"
import { ArrowRight, Mail } from "lucide-react"

import { Logo } from "@/components/logo"
import { Badge } from "@/components/ui/badge"
import { CLIENT_ACTIVATION_DOSSIER } from "@/lib/data"
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

      <h2 className="mt-12 text-sm font-semibold tracking-wide text-muted-foreground uppercase">Parcours</h2>
      <Link
        href={`/activation/${CLIENT_ACTIVATION_DOSSIER}`}
        className="group mt-3 flex items-center gap-4 rounded-xl border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
          <Mail className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">Activation du compte client</p>
          <p className="text-sm text-muted-foreground">De l&apos;e-mail d&apos;invitation à l&apos;envoi du dossier · pensé mobile</p>
        </div>
        <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </Link>
    </main>
  )
}
