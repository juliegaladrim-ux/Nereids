"use client"

import * as React from "react"
import { Building2, Hash, Mail, MapPin, Phone, Plus, Trash2, UserRound } from "lucide-react"
import { toast } from "sonner"

import { useRole } from "@/components/app-shell/role-context"
import { useDocPreview } from "@/components/doc-preview"
import { RoleBadge } from "@/components/role-badge"
import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ACTOR_LABELS,
  CIVILITES,
  QUALITES_INTERVENANT,
  allExpertises,
  compagnieLabel,
  fullName,
  getUser,
  personneName,
  type DocumentItem,
  type Dossier,
  type Partie,
  type Personne,
  clientConvoqueId,
} from "@/lib/data"
import type { RoleId } from "@/lib/roles"
import { cn } from "@/lib/utils"
import { useStore } from "@/lib/store"
import { EditDialog, opt, type EditSection, type Values } from "./dossier-edit"

/** Une carte d'intervenant : construite à partir du dossier (client, intervenants assignés, compagnie, tiers, lieu d'expertise…) ou d'une partie ajoutée */
type Card = {
  key: string
  name: string
  /** Rôle Nereids, pour la couleur de l'avatar */
  role?: RoleId
  user?: { firstName: string; lastName: string; role?: RoleId; structure?: string }
  qualites: string[]
  /** Pastilles violettes : expertise à laquelle l'intervenant est lié (lieu d'expertise) */
  tags?: string[]
  societe?: string
  siret?: string
  address?: string
  phone?: string
  phone2?: string
  email?: string
  email2?: string
  representant?: string
  partieRepresentee?: string
  refInterne?: string
  refMandant?: string
  mandant?: string
  lieeA?: string
  convocation?: DocumentItem
  /** Modifier : ouvre le bloc d'édition d'origine, ou la fiche d'une partie ajoutée */
  onEdit?: () => void
  onRemove?: () => void
}

function personneCard(key: string, p: Personne, qualites: string[]): Card {
  const morale = p.kind === "morale"
  return {
    key,
    name: [!morale && p.civilite, personneName(p)].filter(Boolean).join(" "),
    user: { firstName: p.firstName, lastName: p.lastName, structure: p.societe },
    qualites,
    siret: morale ? p.siret : undefined,
    address: p.address,
    phone: p.phone,
    phone2: p.phone2,
    email: p.email,
    email2: p.email2,
  }
}

/** Dernière convocation envoyée à une personne du dossier (lettre d'expertise) */
function convocationFor(d: Dossier, userId?: string): DocumentItem | undefined {
  if (!userId) return undefined
  // Convocation générée pour cette personne (la plus récente si plusieurs expertises)
  const own = allExpertises(d)
    .map((e) => e.convocationDocs?.[userId])
    .filter(Boolean)
    .map((id) => d.documents.find((doc) => doc.id === id))
    .filter((doc): doc is DocumentItem => !!doc)
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt))[0]
  if (own) return own
  const convoque = allExpertises(d).some((e) => e.convoques.includes(userId))
  if (!convoque) return undefined
  return d.documents
    .filter((doc) => doc.category === "courrier" && /convocation/i.test(doc.name))
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt))[0]
}

function userCard(d: Dossier, key: string, userId: string, qualite: string, lieeA?: string): Card | null {
  const u = getUser(userId)
  if (!u) return null
  const client = d.client
  const represents = u.role === "expert" || u.role === "suiveur"
  return {
    key,
    name: fullName(u),
    role: u.role,
    user: u,
    qualites: [qualite],
    societe: u.structure && u.structure !== "Particulier" ? u.structure : undefined,
    address: u.address,
    phone: u.phone,
    phone2: u.phone2,
    email: u.email,
    email2: u.autresEmails?.[0]?.email,
    representant: fullName(u),
    partieRepresentee: represents ? personneName(client) : undefined,
    refInterne: u.role === "suiveur" ? d.suiveurRefs?.[u.id] : undefined,
    lieeA,
    convocation: convocationFor(d, u.id),
  }
}

/** Date lisible : « 29 octobre 2026 » */
const longDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })

function buildCards(d: Dossier, onEditSection: (id: "client" | "vehicule" | "compagnie" | "cabinet" | "tiers") => (() => void) | undefined, editParty: (p: Partie) => (() => void) | undefined, removeParty: (p: Partie) => (() => void) | undefined): Card[] {
  const cards: Card[] = []

  // Client : mandant et lésé à la fois
  cards.push({ ...personneCard("client", d.client, ["Mandant", "Lésé"]), role: "client", convocation: convocationFor(d, clientConvoqueId(d)), onEdit: onEditSection("client") })
  if (d.proprietaire) cards.push({ ...personneCard("proprietaire", d.proprietaire, ["Propriétaire du véhicule"]), onEdit: onEditSection("vehicule") })

  // Intervenants assignés
  const expert = d.intervenants.expert && userCard(d, "expert", d.intervenants.expert, "Expert automobile", "client")
  if (expert) cards.push(expert)
  const rep = d.intervenants.reparateur && userCard(d, "reparateur", d.intervenants.reparateur, "Réparateur")
  if (rep) cards.push(rep)
  for (const id of d.intervenants.suiveurs) {
    const c = userCard(d, `suiveur-${id}`, id, getUser(id)?.fonction || "Intervenant suiveur", "client")
    if (c) cards.push(c)
  }

  // Compagnie / cabinet visé : le cabinet est lié à la compagnie
  if (d.compagnie?.nom)
    cards.push({
      key: "compagnie",
      name: d.compagnie.nom,
      qualites: [compagnieLabel(d.type)],
      address: d.compagnie.address,
      phone: d.compagnie.phone,
      phone2: d.compagnie.phone2,
      email: d.compagnie.email,
      email2: d.compagnie.email2,
      refInterne: d.compagnie.reference,
      onEdit: onEditSection("compagnie"),
    })
  if (d.type === "litige_assurantiel" && d.cabinetVise?.nom)
    cards.push({
      key: "cabinet",
      name: d.cabinetVise.nom,
      qualites: ["Cabinet d'expertise"],
      address: d.cabinetVise.address,
      phone: d.cabinetVise.phone,
      phone2: d.cabinetVise.phone2,
      email: d.cabinetVise.email,
      email2: d.cabinetVise.email2,
      refInterne: d.cabinetVise.reference,
      lieeA: d.compagnie?.nom ? "compagnie" : undefined,
      onEdit: onEditSection("cabinet"),
    })
  ;(d.tiers ?? []).forEach((t, i) =>
    cards.push({ key: `tiers-${i}`, name: t.nom, qualites: ["Tiers"], phone: t.phone, phone2: t.phone2, email: t.email, email2: t.email2, onEdit: onEditSection("tiers") }),
  )

  // Intervenants ajoutés à la main
  for (const p of d.parties ?? []) {
    const morale = p.kind === "morale"
    cards.push({
      key: p.id,
      name: morale ? (p.societe ?? "Société") : [p.civilite, p.firstName, p.lastName].filter(Boolean).join(" ") || "Intervenant",
      qualites: [p.qualite === "Autre" && p.qualiteAutre ? p.qualiteAutre : p.qualite],
      tags: allExpertises(d).some((e) => (e.convoques.length ? e.convoques : (e.aConvoquer ?? [])).includes(p.id)) ? ["Convoqué à l'expertise"] : undefined,
      siret: morale ? p.siret : undefined,
      societe: !morale ? p.societe : undefined,
      address: p.address,
      phone: p.phone,
      phone2: p.phone2,
      email: p.email,
      email2: p.email2,
      representant: p.representant,
      refInterne: p.refInterne,
      refMandant: p.refMandant,
      mandant: p.mandant,
      lieeA: p.lieeA,
      convocation: convocationFor(d, p.id),
      onEdit: editParty(p),
      onRemove: removeParty(p),
    })
  }

  // Lieu de chaque expertise (expertise 1, 2…)
  allExpertises(d).forEach((e, i) => {
    if (!e.lieu) return
    const [nom, ...rest] = e.lieu.split(",")
    cards.push({
      key: `lieu-${i}`,
      name: nom.trim(),
      qualites: ["Lieu d'expertise"],
      tags: [e.date ? `Expertise ${i + 1} du ${longDate(e.date)}` : `Expertise ${i + 1}`],
      address: rest.join(",").trim() || undefined,
      phone: e.lieuPhone,
      phone2: e.lieuPhone2,
      email: e.lieuEmail,
      email2: e.lieuEmail2,
    })
  })
  return cards
}

function Line({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm text-muted-foreground">
      <Icon className="mt-0.5 size-3.5 shrink-0" />
      <span className="min-w-0 break-words">{children}</span>
    </p>
  )
}

function PartyCard({ c, onOpenConvocation }: { c: Card; onOpenConvocation: (doc: DocumentItem) => void }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card p-3">
      {c.user ? (
        <UserAvatar user={c.user} role={c.role} className="size-10" />
      ) : (
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted">
          <Building2 className="size-4 text-muted-foreground" />
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium">{c.name}</span>
          {c.role && <RoleBadge role={c.role} />}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {c.qualites.filter((q) => !c.role || q.toLowerCase() !== ACTOR_LABELS[c.role].toLowerCase()).map((q) => (
            <span key={q} className="inline-flex h-5 items-center rounded-full border border-brand/40 px-2 text-[0.7rem] font-medium text-brand-ink">
              {q}
            </span>
          ))}
          {c.tags?.map((t) => (
            <span key={t} className="inline-flex h-5 items-center rounded-full border border-tone-final/40 bg-tone-final-bg px-2 text-[0.7rem] font-medium text-tone-final">
              {t}
            </span>
          ))}
        </div>
        <div className="mt-1 flex flex-col gap-1">
          {c.societe && <Line icon={Building2}>{c.societe}</Line>}
          {c.siret && <Line icon={Hash}>SIRET {c.siret}</Line>}
          {c.address && <Line icon={MapPin}>{c.address}</Line>}
          {c.phone && <Line icon={Phone}>{c.phone}</Line>}
          {c.phone2 && <Line icon={Phone}>{c.phone2}</Line>}
          {c.email && <Line icon={Mail}>{c.email}</Line>}
          {c.email2 && <Line icon={Mail}>{c.email2}</Line>}
          {c.representant && c.representant !== c.name && <Line icon={UserRound}>Représentant : {c.representant}</Line>}
          {c.partieRepresentee && <Line icon={UserRound}>Partie représentée : {c.partieRepresentee}</Line>}
          {c.mandant && <Line icon={UserRound}>Mandant : {c.mandant}</Line>}
          {c.refInterne && <Line icon={Hash}>Réf. interne : {c.refInterne}</Line>}
          {c.refMandant && <Line icon={Hash}>Réf. du mandant : {c.refMandant}</Line>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {c.convocation && (
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={`Voir la convocation envoyée à ${c.name}`}
            title="Voir la convocation envoyée"
            onClick={() => onOpenConvocation(c.convocation!)}
          >
            <Mail className="text-brand-ink" />
          </Button>
        )}
        {c.onEdit && (
          <Button size="xs" variant="secondary" onClick={c.onEdit}>
            Modifier
          </Button>
        )}
        {c.onRemove && (
          <Button size="icon-xs" variant="ghost" className="text-muted-foreground" aria-label={`Retirer ${c.name}`} onClick={c.onRemove}>
            <Trash2 />
          </Button>
        )}
      </div>
    </div>
  )
}

/** Fiche d'ajout / de modification d'un intervenant */
function partieSection(d: Dossier, p: Partie | null, cards: Card[], onSave: (v: Values) => void): EditSection {
  const morale = (v: Values) => v.kind === "morale"
  return {
    title: p ? "Modifier l'intervenant" : "Ajouter un intervenant",
    description: "Renseignez sa qualité et ses coordonnées. Le lier à un autre intervenant évite de mélanger les parties.",
    size: "sm",
    required: ["qualite"],
    fields: [
      { key: "qualite", label: "Qualité", type: "select", full: true, options: QUALITES_INTERVENANT.map((q) => ({ value: q, label: q })) },
      { key: "qualiteAutre", label: "Précisez la qualité", full: true, hidden: (v) => v.qualite !== "Autre" },
      {
        key: "kind",
        label: "Type de personne",
        type: "select",
        full: true,
        options: [
          { value: "physique", label: "Personne physique" },
          { value: "morale", label: "Personne morale (société)" },
        ],
      },
      { key: "civilite", label: "Civilité", type: "select", options: CIVILITES.map((c) => ({ value: c, label: c })), hidden: morale },
      { key: "firstName", label: "Prénom", hidden: morale },
      { key: "lastName", label: "Nom", hidden: morale },
      { key: "societe", label: "Nom de la société", full: true, hidden: (v) => !morale(v) },
      { key: "siret", label: "N° de SIRET", hidden: (v) => !morale(v) },
      { key: "representant", label: "Représentant", hidden: (v) => !morale(v) },
      { key: "address", label: "Adresse postale complète", full: true },
      { key: "phone", label: "Téléphone", type: "tel" },
      { key: "phone2", label: "Deuxième téléphone", type: "tel" },
      { key: "email", label: "E-mail", type: "email" },
      { key: "email2", label: "Deuxième e-mail", type: "email" },
      { key: "refInterne", label: "Référence interne" },
      { key: "mandant", label: "Nom de son mandant" },
      { key: "refMandant", label: "Référence de son mandant" },
      {
        key: "lieeA",
        label: "Lié à",
        type: "select",
        full: true,
        hint: "Ex. : l'expert d'un assureur est lié à cet assureur.",
        options: cards.filter((c) => c.key !== p?.id).map((c) => ({ value: c.key, label: `${c.name} · ${c.qualites[0]}` })),
      },
    ],
    initial: {
      qualite: p?.qualite ?? "",
      qualiteAutre: p?.qualiteAutre ?? "",
      kind: p?.kind ?? "physique",
      civilite: p?.civilite ?? "",
      firstName: p?.firstName ?? "",
      lastName: p?.lastName ?? "",
      societe: p?.societe ?? "",
      siret: p?.siret ?? "",
      representant: p?.representant ?? "",
      address: p?.address ?? "",
      phone: p?.phone ?? "",
      phone2: p?.phone2 ?? "",
      email: p?.email ?? "",
      email2: p?.email2 ?? "",
      refInterne: p?.refInterne ?? "",
      mandant: p?.mandant ?? "",
      refMandant: p?.refMandant ?? "",
      lieeA: p?.lieeA ?? "",
    },
    onSave,
  }
}

/** Onglet Général : toutes les parties du dossier, avec leur qualité, leurs coordonnées et leurs liens */
export function PartiesCard({
  dossier: d,
  onEditSection,
  canEdit,
}: {
  dossier: Dossier
  onEditSection: (id: "client" | "vehicule" | "compagnie" | "cabinet" | "tiers") => (() => void) | undefined
  canEdit: boolean
}) {
  const { user } = useRole()
  const { updateDossier, addEvent } = useStore()
  const preview = useDocPreview()
  const [section, setSection] = React.useState<EditSection | null>(null)

  function saveParty(existing: Partie | null, v: Values) {
    const morale = v.kind === "morale"
    const next: Partie = {
      id: existing?.id ?? "",
      qualite: v.qualite,
      qualiteAutre: v.qualite === "Autre" ? opt(v.qualiteAutre) : undefined,
      kind: morale ? "morale" : undefined,
      civilite: morale ? undefined : opt(v.civilite),
      firstName: morale ? undefined : opt(v.firstName),
      lastName: morale ? undefined : opt(v.lastName),
      societe: morale ? opt(v.societe) : undefined,
      siret: morale ? opt(v.siret) : undefined,
      representant: morale ? opt(v.representant) : undefined,
      address: opt(v.address),
      phone: opt(v.phone),
      phone2: opt(v.phone2),
      email: opt(v.email),
      email2: opt(v.email2),
      refInterne: opt(v.refInterne),
      mandant: opt(v.mandant),
      refMandant: opt(v.refMandant),
      lieeA: opt(v.lieeA),
    }
    updateDossier(d.id, (x) => ({
      ...x,
      parties: existing
        ? (x.parties ?? []).map((p) => (p.id === existing.id ? next : p))
        : [...(x.parties ?? []), { ...next, id: `p${Math.max(0, ...(x.parties ?? []).map((p) => Number(p.id.slice(1)) || 0)) + 1}` }],
    }))
    addEvent(d.id, { kind: "system", author: user.id, title: existing ? "Intervenant modifié" : "Intervenant ajouté", body: `${next.qualite === "Autre" && next.qualiteAutre ? next.qualiteAutre : next.qualite} — ${next.societe ?? [next.firstName, next.lastName].filter(Boolean).join(" ")}` })
    toast.success(existing ? "Intervenant modifié" : "Intervenant ajouté")
  }

  function removeParty(p: Partie) {
    updateDossier(d.id, (x) => ({ ...x, parties: (x.parties ?? []).filter((q) => q.id !== p.id).map((q) => (q.lieeA === p.id ? { ...q, lieeA: undefined } : q)) }))
    addEvent(d.id, { kind: "system", author: user.id, title: "Intervenant retiré" })
    toast.success("Intervenant retiré")
  }

  const cards = buildCards(
    d,
    (id) => (canEdit ? onEditSection(id) : undefined),
    (p) => (canEdit ? () => setSection(partieSection(d, p, buildCards(d, () => undefined, () => undefined, () => undefined), (v) => saveParty(p, v))) : undefined),
    (p) => (canEdit ? () => removeParty(p) : undefined),
  )

  // Hiérarchie : une carte liée à une autre s'affiche en retrait sous elle
  const keys = new Set(cards.map((c) => c.key))
  const roots = cards.filter((c) => !c.lieeA || !keys.has(c.lieeA))
  const childrenOf = (key: string) => cards.filter((c) => c.lieeA === key)
  const renderNode = (c: Card, depth = 0): React.ReactNode => (
    <div key={c.key} className="flex flex-col gap-2">
      <PartyCard c={c} onOpenConvocation={preview.open} />
      {childrenOf(c.key).length > 0 && depth < 4 && (
        <div className="ml-5 flex flex-col gap-2 border-l-2 border-brand/25 pl-4">{childrenOf(c.key).map((k) => renderNode(k, depth + 1))}</div>
      )}
    </div>
  )

  return (
    <Card size="sm" className={cn("md:col-span-2")}>
      <CardHeader>
        <CardTitle>Parties et intervenants</CardTitle>
        {canEdit && (
          <CardAction>
            <Button
              size="xs"
              variant="outline"
              onClick={() => setSection(partieSection(d, null, cards, (v) => saveParty(null, v)))}
            >
              <Plus /> Ajouter
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {roots.map((c) => renderNode(c))}
        <p className="text-xs text-muted-foreground">Les intervenants liés à une partie s&apos;affichent en retrait sous elle (ex. l&apos;expert de l&apos;assureur).</p>
      </CardContent>
      <EditDialog key={section ? section.title + (section.initial.firstName ?? "") + (section.initial.societe ?? "") : "none"} section={section} onOpenChange={(o) => !o && setSection(null)} />
      {preview.dialog}
    </Card>
  )
}
