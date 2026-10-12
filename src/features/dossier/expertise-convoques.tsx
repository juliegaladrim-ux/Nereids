"use client"

import * as React from "react"
import { toast } from "sonner"
import { Building2, Copy, Hash, Mail, MapPin, Phone, UserRound } from "lucide-react"

import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { fullName, getUser, type Dossier, type User } from "@/lib/data"

/** Ordre d'affichage : le client d'abord, puis ceux qui représentent ou accueillent */
const ORDER: Record<string, number> = { client: 0, expert: 1, reparateur: 2, suiveur: 3, gestionnaire: 4, admin: 5 }

function roleLabel(u: User): string {
  if (u.role === "client") return "Client"
  if (u.role === "expert") return "Expert"
  if (u.role === "reparateur") return "Réparateur"
  if (u.role === "gestionnaire") return "Gestionnaire"
  if (u.role === "suiveur") return u.fonction || "Intervenant suiveur"
  return "Nereids"
}

/** Fiches des personnes convoquées à l'expertise : identité, rôle, coordonnées complètes */
export function ConvoquesCard({ dossier: d }: { dossier: Dossier }) {
  // Le client est toujours convoqué, qu'il ait un compte ou non : ses coordonnées viennent du dossier
  const clientUser = getUser(d.client.userId)
  const client: User = {
    id: d.client.userId ?? "client",
    role: "client",
    ...d.client,
    address: d.client.address ?? clientUser?.address,
    structure: "Particulier",
    fonction: "",
  }
  const people = [
    client,
    ...d.expertise.convoques
      .map((id) => getUser(id))
      .filter((u): u is User => !!u && u.role !== "client")
      .sort((a, b) => ORDER[a.role] - ORDER[b.role]),
  ]

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          Personnes convoquées <span className="font-normal text-muted-foreground">· {people.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y">
          {people.map((u) => {
            const hosts = !!d.expertise.lieu && u.role !== "client" && d.expertise.lieu.includes(u.structure)
            const represents = u.role === "expert" || u.role === "suiveur" ? fullName(client) : undefined
            const ref = u.role === "expert" ? d.refs.expert : u.role === "suiveur" ? d.suiveurRefs?.[u.id] : undefined
            const company = u.structure && u.structure !== "Particulier" ? u.structure : undefined
            return (
              <li key={u.id} className="grid gap-x-6 gap-y-3 py-4 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                {/* Identité */}
                <div className="flex min-w-0 gap-3">
                  <UserAvatar user={u} className="size-10" />
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="truncate font-medium">{fullName(u)}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <Tag>{roleLabel(u)}</Tag>
                      {hosts && (
                        <Tag muted>
                          <MapPin className="size-3" /> Lieu de l&apos;expertise
                        </Tag>
                      )}
                    </div>
                    <dl className="mt-1 flex flex-col gap-1 text-sm">
                      {company && <Line icon={Building2}>{company}</Line>}
                      {represents && <Line icon={UserRound}>Représente {represents}</Line>}
                      {ref && <Line icon={Hash}>Réf. {ref}</Line>}
                    </dl>
                  </div>
                </div>

                {/* Coordonnées */}
                <dl className="flex min-w-0 flex-col gap-1 pl-13 text-sm md:pl-0">
                  <Line icon={MapPin}>{u.address ?? <span className="text-muted-foreground">Adresse non renseignée</span>}</Line>
                  <Line icon={Mail} copy={u.email}>
                    <a href={`mailto:${u.email}`} className="truncate text-brand-ink underline-offset-2 hover:underline">
                      {u.email}
                    </a>
                  </Line>
                  <Line icon={Phone} copy={u.phone}>
                    <a href={`tel:${u.phone.replace(/\s/g, "")}`} className="tabular-nums underline-offset-2 hover:underline">
                      {u.phone}
                    </a>
                  </Line>
                </dl>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

function Tag({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span
      className={
        muted
          ? "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs text-muted-foreground"
          : "inline-flex items-center gap-1 rounded-md bg-brand-soft px-1.5 py-0.5 text-xs font-medium text-brand-ink"
      }
    >
      {children}
    </span>
  )
}

function Line({ icon: Icon, children, copy }: { icon: React.ElementType; children: React.ReactNode; copy?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="flex min-w-0 items-center">{children}</span>
      {copy && (
        <Button
          variant="ghost"
          size="icon-xs"
          className="-my-1 text-muted-foreground"
          aria-label={`Copier ${copy}`}
          onClick={() => {
            navigator.clipboard?.writeText(copy)
            toast.success("Copié")
          }}
        >
          <Copy />
        </Button>
      )}
    </div>
  )
}
