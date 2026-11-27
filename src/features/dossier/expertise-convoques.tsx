"use client"

import * as React from "react"
import { toast } from "sonner"
import { Building2, Copy, FileText, Hash, Mail, MapPin, Phone, Plus, UserRound, X } from "lucide-react"

import { RoleBadge } from "@/components/role-badge"
import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useRole } from "@/components/app-shell/role-context"
import { useDocPreview } from "@/components/doc-preview"
import { allExpertises, clientConvoqueId, expertisePeople, fullName, getUser, personneName, setExpertise, type Dossier, type Partie, type User } from "@/lib/data"
import { useStore } from "@/lib/store"
import { ConvocationDialog, modeleFor, type Convoque } from "./convocation-dialog"

/** Ordre d'affichage : le client d'abord, puis ceux qui représentent ou accueillent, puis les autres intervenants */
const ORDER: Record<string, number> = { client: 0, expert: 1, reparateur: 2, suiveur: 3, gestionnaire: 4, admin: 5, partie: 6 }

function roleLabel(u: User): string {
  if (u.role === "client") return "Client"
  if (u.role === "expert") return "Expert"
  if (u.role === "reparateur") return "Réparateur"
  if (u.role === "gestionnaire") return "Gestionnaire"
  if (u.role === "suiveur") return u.fonction || "Intervenant suiveur"
  return "Nereids"
}

const partieName = (p: Partie) => (p.kind === "morale" ? (p.societe ?? "Société") : [p.firstName, p.lastName].filter(Boolean).join(" ") || p.societe || "Intervenant")
const partieQualite = (p: Partie) => (p.qualite === "Autre" && p.qualiteAutre ? p.qualiteAutre : p.qualite)

/** Personne convoquée, quelle que soit son origine : compte utilisateur, client ou intervenant ajouté à la main */
type Person = {
  id: string
  /** Rôle de la couleur du badge (absent : intervenant ajouté à la main) */
  role?: User["role"]
  name: string
  label: string
  civilite?: string
  company?: string
  represents?: string
  ref?: string
  address?: string
  email?: string
  email2?: string
  phone?: string
  phone2?: string
  order: number
}

/** Fiches des personnes convoquées à une expertise (n° index + 1) : identité, rôle, coordonnées complètes et convocation de chacune */
export function ConvoquesCard({ dossier: d, index = 0, canAdd }: { dossier: Dossier; index?: number; canAdd?: boolean }) {
  const { user } = useRole()
  const { updateDossier, addEvent } = useStore()
  const preview = useDocPreview()
  const [generating, setGenerating] = React.useState<Convoque | null>(null)
  const e = allExpertises(d)[index]
  // L'expert qui mène l'expertise n'est jamais convoqué
  const ids = expertisePeople(d, index).filter((id) => id !== d.intervenants.expert)
  const clientId = clientConvoqueId(d)
  const clientUser = getUser(d.client.userId)
  const clientName = personneName(d.client)

  const clientPerson: Person = {
    id: clientId,
    role: "client",
    name: fullName({ firstName: d.client.firstName, lastName: d.client.lastName, structure: d.client.societe }) || clientName,
    label: "Client",
    civilite: d.client.kind === "morale" ? undefined : d.client.civilite,
    address: d.client.address ?? clientUser?.address,
    email: d.client.email,
    email2: d.client.email2,
    phone: d.client.phone,
    phone2: d.client.phone2,
    order: ORDER.client,
  }
  const userPerson = (u: User): Person => ({
    id: u.id,
    role: u.role,
    name: fullName(u),
    label: roleLabel(u),
    civilite: u.civilite,
    company: u.structure && u.structure !== "Particulier" ? u.structure : undefined,
    represents: u.role === "expert" || u.role === "suiveur" ? clientName : undefined,
    ref: u.role === "suiveur" ? d.suiveurRefs?.[u.id] : undefined,
    address: u.address,
    email: u.email,
    email2: u.autresEmails?.[0]?.email,
    phone: u.phone,
    phone2: u.phone2,
    order: ORDER[u.role] ?? ORDER.partie,
  })
  const partiePerson = (p: Partie): Person => ({
    id: p.id,
    name: partieName(p),
    label: partieQualite(p),
    civilite: p.kind === "morale" ? undefined : p.civilite,
    company: p.kind === "morale" ? undefined : p.societe,
    represents: p.mandant,
    ref: p.refInterne,
    address: p.address,
    email: p.email,
    email2: p.email2,
    phone: p.phone,
    phone2: p.phone2,
    order: ORDER.partie,
  })
  const resolve = (id: string): Person | undefined => {
    if (id === clientId) return clientPerson
    const u = getUser(id)
    if (u) return userPerson(u)
    const p = d.parties?.find((x) => x.id === id)
    return p ? partiePerson(p) : undefined
  }

  // Le client n'est convoqué que s'il a été ajouté (convocations n°1 déjà envoyées : il l'a toujours été)
  const sentAny = e.convoques.length > 0
  const withClient = ids.includes(clientId) || (index === 0 && sentAny && !!d.client)
  const people = [...(withClient && !ids.includes(clientId) ? [clientPerson] : []), ...ids.map(resolve).filter((p): p is Person => !!p)]
    .filter((p, i, all) => all.findIndex((q) => q.id === p.id) === i)
    // Le client peut figurer à la fois comme compte utilisateur et comme fiche client : une seule ligne
    .filter((p, _i, all) => !(p.id === clientId && all.some((q) => q.id !== clientId && q.role === "client")))
    .sort((a, b) => a.order - b.order)
  const inList = new Set(people.map((p) => p.id))

  // Personnes du dossier pas encore dans la liste
  const candidates: Person[] = [
    ...(inList.has(clientId) ? [] : [clientPerson]),
    ...[d.intervenants.gestionnaire, d.intervenants.reparateur, ...d.intervenants.suiveurs]
      .map((id) => getUser(id))
      .filter((u): u is User => !!u && !inList.has(u.id))
      .map(userPerson),
    ...(d.parties ?? []).filter((p) => !inList.has(p.id)).map(partiePerson),
  ]

  const hasDate = !!e.date && !!e.lieu

  function addPerson(p: Person, undo = false) {
    updateDossier(d.id, (x) => setExpertise(x, index, (cur) => ({ ...cur, aConvoquer: [...expertisePeople(x, index).filter((id) => !cur.convoques.includes(id)), p.id] })))
    const n = allExpertises(d).length > 1 ? ` n°${index + 1}` : ""
    if (!undo) addEvent(d.id, { kind: "expertise", author: user.id, title: `${p.name} ajouté(e) aux personnes à convoquer de l'expertise${n}` })
  }

  function removePerson(p: Person) {
    updateDossier(d.id, (x) =>
      setExpertise(x, index, (cur) => ({
        ...cur,
        convoques: cur.convoques.filter((id) => id !== p.id),
        aConvoquer: expertisePeople(x, index).filter((id) => id !== p.id && !cur.convoques.includes(id)),
      })),
    )
    const n = allExpertises(d).length > 1 ? ` n°${index + 1}` : ""
    addEvent(d.id, { kind: "expertise", author: user.id, title: `${p.name} retiré(e) des personnes à convoquer de l'expertise${n}` })
    toast.success(`${p.name} retiré(e)`, { action: { label: "Annuler", onClick: () => addPerson(p, true) } })
  }

  const docOf = (id: string) => {
    const docId = e.convocationDocs?.[id]
    if (docId) return d.documents.find((x) => x.id === docId)
    // Dossiers déjà convoqués avant la convocation par personne : la lettre envoyée à tous
    if (e.convoques.includes(id) || (id === clientId && index === 0 && sentAny))
      return d.documents.filter((x) => x.category === "courrier" && /convocation/i.test(x.name)).sort((p, q) => q.addedAt.localeCompare(p.addedAt))[0]
    return undefined
  }

  const done = people.filter((p) => docOf(p.id)).length

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          Personnes à convoquer <span className="font-normal text-muted-foreground">· {people.length}</span>
          {people.length > 0 && <span className="ml-2 text-xs font-normal text-muted-foreground">{done}/{people.length} convocation{done > 1 ? "s" : ""} générée{done > 1 ? "s" : ""}</span>}
        </CardTitle>
        {canAdd && candidates.length > 0 && (
          <CardAction>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button size="xs" variant="outline" />}>
                <Plus /> Ajouter
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {candidates.map((p) => (
                  <DropdownMenuItem key={p.id} onClick={() => addPerson(p)}>
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <span className="text-xs text-muted-foreground">{p.label}</span>
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
          {people.map((p) => {
            const hosts = !!e.lieu && !!p.company && e.lieu.includes(p.company)
            const doc = docOf(p.id)
            return (
              <li key={p.id} className="grid gap-x-6 gap-y-3 py-4 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                {/* Identité */}
                <div className="flex min-w-0 gap-3">
                  <UserAvatar user={{ firstName: p.name.split(" ")[0] ?? "", lastName: p.name.split(" ").slice(1).join(" "), structure: p.company }} role={p.role} className="size-10" />
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="flex min-w-0 items-center gap-1">
                      <span className="truncate font-medium">{[p.civilite, p.name].filter(Boolean).join(" ")}</span>
                      {/* Le client reste toujours convoqué à la 1re expertise */}
                      {canAdd && !(index === 0 && p.id === clientId) && !doc && (
                        <Button variant="ghost" size="icon-xs" className="text-muted-foreground" aria-label={`Retirer ${p.name}`} onClick={() => removePerson(p)}>
                          <X />
                        </Button>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {p.role ? (
                        <RoleBadge role={p.role} label={p.label} className="h-6 px-2.5 text-xs" />
                      ) : (
                        <Tag>{p.label}</Tag>
                      )}
                      {hosts && (
                        <Tag muted>
                          <MapPin className="size-3" /> Lieu de l&apos;expertise
                        </Tag>
                      )}
                    </div>
                    <dl className="mt-1 flex flex-col gap-1 text-sm">
                      {p.company && <Line icon={Building2}>{p.company}</Line>}
                      {p.represents && <Line icon={UserRound}>{p.role ? `Représente ${p.represents}` : `Mandant : ${p.represents}`}</Line>}
                      {p.ref && <Line icon={Hash}>Réf. {p.ref}</Line>}
                    </dl>
                  </div>
                </div>

                {/* Coordonnées et convocation */}
                <div className="flex min-w-0 flex-col gap-3 pl-13 text-sm md:pl-0">
                  <dl className="flex min-w-0 flex-col gap-1">
                    <Line icon={MapPin}>{p.address ?? <span className="text-muted-foreground">Adresse non renseignée</span>}</Line>
                    {[p.email, p.email2].filter(Boolean).map((m) => (
                      <Line key={m} icon={Mail} copy={m}>
                        <a href={`mailto:${m}`} className="truncate text-brand-ink underline-offset-2 hover:underline">
                          {m}
                        </a>
                      </Line>
                    ))}
                    {[p.phone, p.phone2].filter(Boolean).map((t) => (
                      <Line key={t} icon={Phone} copy={t}>
                        <a href={`tel:${t!.replace(/\s/g, "")}`} className="tabular-nums underline-offset-2 hover:underline">
                          {t}
                        </a>
                      </Line>
                    ))}
                  </dl>
                  {doc ? (
                    <Button size="xs" variant="secondary" className="w-fit" onClick={() => preview.open(doc)}>
                      <Mail /> Voir la convocation
                    </Button>
                  ) : (
                    canAdd && (
                      <Button
                        size="xs"
                        variant="outline"
                        className="w-fit"
                        disabled={!hasDate}
                        title={hasDate ? undefined : "Renseignez d'abord la date et le lieu de l'expertise"}
                        onClick={() => setGenerating({ id: p.id, name: p.name, label: p.label, civilite: p.civilite, address: p.address, modele: modeleFor(p.role, p.label) })}
                      >
                        <FileText /> Générer la convocation
                      </Button>
                    )
                  )}
                </div>
              </li>
            )
          })}
        </ul>
        {!hasDate && people.length > 0 && canAdd && <p className="mt-3 text-xs text-muted-foreground">Les convocations se génèrent une fois la date et le lieu de l&apos;expertise renseignés.</p>}
      </CardContent>
      {generating && <ConvocationDialog dossier={d} index={index} person={generating} onClose={() => setGenerating(null)} />}
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
