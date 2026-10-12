import Link from "next/link"
import { ArrowRight, Mail, type LucideIcon } from "lucide-react"

import { Logo } from "@/components/logo"
import { Badge } from "@/components/ui/badge"
import { CLIENT_ACTIVATION_DOSSIER, SUIVEUR_ACTIVATION_USER } from "@/lib/data"
import { ROLES, type RoleId } from "@/lib/roles"

/** Parcours hors espace connecté (lien de l'e-mail d'invitation…), rangés par profil */
const PARCOURS: Partial<Record<RoleId, { title: string; description: string; href: string; icon: LucideIcon }[]>> = {
  client: [
    {
      title: "Activation du compte",
      description: "Mot de passe, infos, pièces, récapitulatif · pensé mobile",
      href: `/activation/${CLIENT_ACTIVATION_DOSSIER}`,
      icon: Mail,
    },
  ],
  suiveur: [
    {
      title: "Activation du compte",
      description: "Mot de passe, vérification des coordonnées",
      href: `/activation/suiveur/${SUIVEUR_ACTIVATION_USER}`,
      icon: Mail,
    },
  ],
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-12 sm:py-20">
      <Logo />
      <h1 className="mt-10 text-2xl font-semibold tracking-tight sm:text-3xl">Prototype de la plateforme</h1>
      <p className="mt-2 text-muted-foreground">Choisissez un profil.</p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {ROLES.map((role) => {
          const parcours = PARCOURS[role.id] ?? []
          return (
            <div key={role.id} className="flex flex-col overflow-hidden rounded-xl border bg-card">
              <Link
                href={`/${role.id}/${role.home}`}
                className="group flex items-center justify-between gap-3 p-5 transition-colors hover:bg-brand/[0.03]"
              >
                <span className="font-medium">{role.label}</span>
                <div className="flex items-center gap-3">
                  {role.ready ? <Badge>Espace disponible</Badge> : <Badge variant="secondary">Espace vide</Badge>}
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand-ink" />
                </div>
              </Link>
              {/* Parcours propres à ce profil, rangés avec lui */}
              {parcours.length > 0 && (
                <ul className="border-t px-2 py-2">
                  {parcours.map((p) => (
                    <li key={p.href}>
                      <Link href={p.href} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-brand/[0.04]">
                        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-brand-soft text-brand-ink">
                          <p.icon className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{p.title}</p>
                          <p className="text-xs text-muted-foreground">{p.description}</p>
                        </div>
                        <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand-ink" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </main>
  )
}
