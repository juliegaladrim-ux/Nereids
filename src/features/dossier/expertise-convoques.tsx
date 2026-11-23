"use client"

import * as React from "react"
import { toast } from "sonner"
import { Building2, Copy, Hash, Mail, MapPin, Phone, Plus, UserRound, X } from "lucide-react"

import { RoleBadge } from "@/components/role-badge"
import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useRole } from "@/components/app-shell/role-context"
import { allExpertises, clientConvoqueId, expertisePeople, fullName, getUser, setExpertise, type Dossier, type User } from "@/lib/data"
import { useStore } from "@/lib/store"

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

/** Fiches des personnes convoquées à une expertise (n° index + 1) : identité, rôle, coordonnées complètes */
export function ConvoquesCard({ dossier: d, index = 0, canAdd }: { dossier: Dossier; index?: number; canAdd?: boolean }) {
  const { user } = useRole()
  const { updateDossier, addEvent } = useStore()
  const e = allExpertises(d)[index]
  const sent = e.convoques.length > 0
  const ids = expertisePeople(d, index)
  const clientId = clientConvoqueId(d)
  // Le client n'a pas toujours de compte : ses coordonnées viennent du dossier
  const clientUser = getUser(d.client.userId)
  const client: User = {
    id: clientId,
    role: "client",
    ...d.client,
    address: d.client.address ?? clientUser?.address,
    structure: "Particulier",
    fonction: "",
  }
  // Le client n'est convoqué que s'il a été ajouté (convocations n°1 déjà envoyées : il l'a toujours été)
  const withClient = ids.includes(clientId) || (index === 0 && sent)
  const others = ids
    .map((id) => getUser(id))
    .filter((u): u is User => !!u && u.role !== "client")
    .sort((a, b) => ORDER[a.role] - ORDER[b.role])
  const people = [...(withClient ? [client] : []), ...others]

  // Personnes du dossier pas encore dans la liste
  const candidates = [
    ...(withClient ? [] : [client]),
    ...[d.intervenants.gestionnaire, d.intervenants.expert, d.intervenants.reparateur, ...d.intervenants.suiveurs]
      .map((id) => getUser(id))
      .filter((u): u is User => !!u && !ids.includes(u.id)),
  ]

  function addPerson(u: User, undo = false) {
    updateDossier(d.id, (x) =>
      setExpertise(x, index, (cur) =>
        cur.convoques.length ? { ...cur, convoques: [...cur.convoques, u.id] } : { ...cur, aConvoquer: [...expertisePeople(x, index), u.id] },
      ),
    )
    const n = allExpertises(d).length > 1 ? ` n°${index + 1}` : ""
    if (!undo) addEvent(d.id, { kind: "expertise", author: user.id, title: `${fullName(u)} ajouté(e) aux convoqués de l'expertise${n}` })
  }

  function removePerson(u: User) {
    updateDossier(d.id, (x) =>
      setExpertise(x, index, (cur) =>
        cur.convoques.length
          ? { ...cur, convoques: cur.convoques.filter((id) => id !== u.id) }
          : { ...cur, aConvoquer: expertisePeople(x, index).filter((id) => id !== u.id) },
      ),
    )
    const n = allExpertises(d).length > 1 ? ` n°${index + 1}` : ""
    addEvent(d.id, { kind: "expertise", author: user.id, title: `${fullName(u)} retiré(e) des convoqués de l'expertise${n}` })
    toast.success(`${fullName(u)} retiré(e)`, { action: { label: "Annuler", onClick: () => addPerson(u, true) } })
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          {sent ? "Personnes convoquées" : "Personnes à convoquer"} <span className="font-normal text-muted-foreground">· {people.length}</span>
        </CardTitle>
        {canAdd && candidates.length > 0 && (
          <CardAction>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button size="xs" variant="outline" />}>
                <Plus /> Ajouter
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {candidates.map((u) => (
                  <DropdownMenuItem key={u.id} onClick={() => addPerson(u)}>
                    <UserAvatar user={u} className="size-6" />
                    <span className="min-w-0 flex-1 truncate">{fullName(u)}</span>
                    <span className="text-xs text-muted-foreground">{roleLabel(u)}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {people.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Aucune personne à convoquer pour l&apos;instant.{canAdd && " Ajoutez-les avec le bouton « Ajouter »."}
          </p>
        )}
        <ul className="flex flex-col divide-y">
          {people.map((u) => {
            const hosts = !!e.lieu && u.role !== "client" && e.lieu.includes(u.structure)
            const represents = u.role === "expert" || u.role === "suiveur" ? fullName(client) : undefined
            const ref = u.role === "suiveur" ? d.suiveurRefs?.[u.id] : undefined
            const company = u.structure && u.structure !== "Particulier" ? u.structure : undefined
            return (
              <li key={u.id} className="grid gap-x-6 gap-y-3 py-4 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                {/* Identité */}
                <div className="flex min-w-0 gap-3">
                  <UserAvatar user={u} className="size-10" />
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="flex min-w-0 items-center gap-1">
                      <span className="truncate font-medium">{fullName(u)}</span>
                      {/* Le client reste toujours convoqué à la 1re expertise */}
                      {canAdd && !(index === 0 && u.role === "client") && (
                        <Button variant="ghost" size="icon-xs" className="text-muted-foreground" aria-label={`Retirer ${fullName(u)}`} onClick={() => removePerson(u)}>
                          <X />
                        </Button>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <RoleBadge role={u.role} label={roleLabel(u)} className="h-6 px-2.5 text-xs" />
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
