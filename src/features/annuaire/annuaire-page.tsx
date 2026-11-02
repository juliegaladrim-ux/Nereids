"use client"

import * as React from "react"
import Link from "next/link"
import { Building2, Download, Plus, Search, UserPlus, X } from "lucide-react"
import { toast } from "sonner"

import { useRole } from "@/components/app-shell/role-context"
import { PageHeader } from "@/components/page-header"
import { SimpleSelect } from "@/components/simple-select"
import { AbonnementBadge, StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UserAvatar } from "@/components/user-avatar"
import { FilterPill } from "@/features/admin/dossiers-list"
import { AccountBadge, intervenantStatus, isDormant, lastLogin, type AccountStatus } from "@/features/admin/users-page"
import { EmailsField, SimilarAlert, SuggestInput, cleanEmails, orgSuggestion, personKind, personSuggestion } from "@/features/annuaire/annuaire-fields"
import {
  ABONNEMENTS,
  ORG_TYPES,
  PERSON_TYPES,
  ROLE_ORG,
  contactName,
  orgByName,
  orgDossiers,
  orgIdFor,
  personDossiers,
  searchOrgs,
  similarOrgs,
  similarPeople,
  useAnnuaire,
  type Abonnement,
  type Contact,
  type Organisation,
  type OrgType,
  type PersonEntry,
  type PersonType,
} from "@/lib/annuaire"
import {
  USERS,
  departementFromAddress,
  departementRegion,
  personneName,
  type Account,
  type Dossier,
  type EmailSecondaire,
  type StatusId,
} from "@/lib/data"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"

/**
 * Annuaire global (admin Nereids) : toutes les personnes et organisations connues de l'outil, avec ou sans compte.
 * Les fiches alimentent la saisie des dossiers (suggestions) et évitent les doublons.
 */

type Tab = "personnes" | "organisations"

const isActive = (d: Dossier) => d.status !== "cloture" && d.status !== "archive"

/** Compte de la personne : intervenant (statut d'invitation) ou client (accès ouvert depuis son dossier) */
function accountStatus(p: PersonEntry, dossiers: Dossier[], accounts: Record<string, Account>): { status: AccountStatus; lastLoginAt?: string } | null {
  if (!p.user) return null
  const id = p.user.id
  if (p.user.role !== "client") return { status: intervenantStatus(id, accounts[id]), lastLoginAt: lastLogin(id, accounts[id]) }
  const access = dossiers.find((d) => d.client.userId === id && d.clientAccess)?.clientAccess
  if (!access) return null
  // Client de démo (Mehdi Saïdi) : toujours connecté récemment
  if (id === "u-client") return { status: "actif" }
  if (!access.activatedAt) return { status: "invitation" }
  return { status: isDormant(access.activatedAt) ? "inactif" : "actif", lastLoginAt: access.activatedAt }
}

const STATUS_LABEL: Record<AccountStatus, string> = { actif: "Actif", inactif: "Inactif", invitation: "Invitation envoyée" }

// ─── Département ─────────────────────────────────────────────────────────────

/** Zone d'intervention d'un utilisateur : ses départements, ou toute sa région */
function zone(p: PersonEntry): string | undefined {
  const u = p.user
  if (!u?.region || u.role === "client") return undefined
  return u.departements?.length ? u.departements.map((d) => d.split(" ")[0]).join(", ") : `toute la région (${u.region})`
}

/**
 * Filtre département : le département de l'adresse, et pour un intervenant sa zone d'intervention
 * (un expert de la Loire qui intervient en Haute-Loire ressort sur « 43 »).
 */
function personInDeps(p: PersonEntry, deps: string[]): boolean {
  const addr = departementFromAddress(p.address)
  if (addr && deps.includes(addr)) return true
  const u = p.user
  if (!u?.region || u.role === "client") return false
  return u.departements?.length ? u.departements.some((d) => deps.includes(d)) : deps.some((d) => departementRegion(d) === u.region)
}

// ─── Export CSV (s'ouvre dans Excel) ────────────────────────────────────────

function downloadCsv(name: string, header: string[], rows: (string | number | undefined)[][]) {
  const cell = (v: string | number | undefined) => {
    const t = String(v ?? "")
    return /[";\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }
  // BOM + point-virgule : accents et colonnes reconnus par Excel en français
  const csv = "\uFEFF" + [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n")
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
  const a = document.createElement("a")
  a.href = url
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const otherEmails = (xs?: EmailSecondaire[]) => (xs ?? []).map((e) => (e.label ? `${e.label} : ${e.email}` : e.email)).join(", ")

export function AnnuairePage() {
  const { dossiers, accounts } = useStore()
  const { people, orgs } = useAnnuaire()
  const [tab, setTab] = React.useState<Tab>("personnes")
  const [q, setQ] = React.useState("")
  const [kinds, setKinds] = React.useState<string[]>([])
  const [comptes, setComptes] = React.useState<string[]>([])
  const [orgTypes, setOrgTypes] = React.useState<string[]>([])
  const [deps, setDeps] = React.useState<string[]>([])
  /** Lignes cochées (par onglet) pour l'export */
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  /** Fiche ouverte : id, ou « new » pour un ajout */
  const [openPerson, setOpenPerson] = React.useState<string | null>(null)
  const [openOrg, setOpenOrg] = React.useState<string | null>(null)
  /** Cabinet saisi à l'ajout d'un expert : sa fiche s'ouvre en création, à compléter */
  const [creatingOrg, setCreatingOrg] = React.useState(false)
  /** Cabinet pour lequel on crée une fiche expert */
  const [newExpertFor, setNewExpertFor] = React.useState<Organisation | null>(null)

  const query = q.trim().toLowerCase()
  const matches = (...xs: (string | undefined)[]) => !query || xs.some((x) => x?.toLowerCase().includes(query))

  const kindOptions = [...new Set(people.map(personKind))].map((k) => ({ value: k, label: k }))
  // Départements présents dans l'annuaire (adresses + zones d'intervention)
  const depOptions = [
    ...new Set([
      ...[...people, ...orgs].map((x) => departementFromAddress(x.address)),
      ...people.flatMap((p) => (p.user?.role !== "client" ? (p.user?.departements ?? []) : [])),
    ]),
  ]
    .filter((d): d is string => !!d)
    .sort()
    .map((d) => ({ value: d, label: d }))
  const visiblePeople = people
    .filter((p) => matches(contactName(p), `${p.lastName} ${p.firstName}`, p.email, p.phone, p.org?.nom, ...(p.autresEmails ?? []).map((e) => e.email)))
    .filter((p) => kinds.length === 0 || kinds.includes(personKind(p)))
    .filter((p) => comptes.length === 0 || comptes.includes(accountStatus(p, dossiers, accounts) ? "oui" : "non"))
    .filter((p) => deps.length === 0 || personInDeps(p, deps))
  const visibleOrgs = orgs
    .filter((o) => matches(o.nom, o.email, o.phone, o.siret, ...(o.autresEmails ?? []).map((e) => e.email)))
    .filter((o) => orgTypes.length === 0 || orgTypes.includes(o.type))
    .filter((o) => deps.length === 0 || deps.includes(departementFromAddress(o.address) ?? ""))
  const hasFilters = q || kinds.length > 0 || comptes.length > 0 || orgTypes.length > 0 || deps.length > 0

  const visibleIds = (tab === "personnes" ? visiblePeople : visibleOrgs).map((x) => x.id)
  const allChecked = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
  const someChecked = !allChecked && visibleIds.some((id) => selected.has(id))
  const toggle = (id: string, on: boolean) =>
    setSelected((cur) => {
      const next = new Set(cur)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  /** Exporte la sélection, ou toute la liste affichée (filtres appliqués) */
  function exportRows() {
    const pick = <T extends { id: string }>(all: T[], visible: T[]) => (selected.size ? all.filter((x) => selected.has(x.id)) : visible)
    if (tab === "personnes") {
      const rows = pick(people, visiblePeople)
      downloadCsv(
        "annuaire-personnes",
        ["Prénom", "Nom", "Type", "Organisation", "Fonction", "E-mail principal", "Autres e-mails", "Téléphone", "Adresse", "Département", "Zone d'intervention", "Compte", "Dossiers en cours"],
        rows.map((p) => {
          const account = accountStatus(p, dossiers, accounts)
          return [
            p.firstName,
            p.lastName,
            personKind(p),
            p.org?.nom ?? (p.user && p.user.role !== "client" ? p.user.structure : ""),
            p.fonction,
            p.email,
            otherEmails(p.autresEmails),
            p.phone,
            p.address,
            departementFromAddress(p.address),
            zone(p),
            account ? STATUS_LABEL[account.status] : "Sans compte",
            p.user?.role === "admin" ? "Tous" : personDossiers(p, dossiers).filter(isActive).length,
          ]
        }),
      )
      toast.success(`${rows.length} personne${rows.length > 1 ? "s" : ""} exportée${rows.length > 1 ? "s" : ""}`)
    } else {
      const rows = pick(orgs, visibleOrgs)
      downloadCsv(
        "annuaire-organisations",
        ["Nom", "Type", "SIRET", "E-mail principal", "Autres e-mails", "Téléphone", "Adresse", "Département", "Personnes", "Dossiers en cours"],
        rows.map((o) => [
          o.nom,
          ORG_TYPES[o.type].label,
          o.siret,
          o.email,
          otherEmails(o.autresEmails),
          o.phone,
          o.address,
          departementFromAddress(o.address),
          people.filter((p) => p.orgId === o.id).length,
          orgDossiers(o, dossiers, people).filter(isActive).length,
        ]),
      )
      toast.success(`${rows.length} organisation${rows.length > 1 ? "s" : ""} exportée${rows.length > 1 ? "s" : ""}`)
    }
  }

  const listBar = (count: number, noun: string) => (
    <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 px-4 py-2">
      <p className="text-xs text-muted-foreground">
        {selected.size > 0
          ? `${selected.size} sélectionné${selected.size > 1 ? "s" : ""} sur ${count}`
          : `${count} ${noun}${count > 1 ? "s" : ""}`}
      </p>
      <div className="flex items-center gap-2">
        {selected.size > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            Désélectionner
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={exportRows} disabled={selected.size === 0 && count === 0}>
          <Download /> {selected.size > 0 ? `Exporter la sélection (${selected.size})` : hasFilters ? "Exporter la liste" : "Tout exporter"}
        </Button>
      </div>
    </div>
  )

  const headCheckbox = (
    <TableHead className="w-10 pl-4">
      <Checkbox
        aria-label="Tout sélectionner"
        checked={allChecked}
        indeterminate={someChecked}
        onCheckedChange={(c) => setSelected(c ? new Set([...selected, ...visibleIds]) : new Set([...selected].filter((id) => !visibleIds.includes(id))))}
      />
    </TableHead>
  )
  const rowCheckbox = (id: string, label: string) => (
    // La case ne doit pas ouvrir la fiche
    <TableCell className="w-10 pl-4" onClick={(e) => e.stopPropagation()}>
      <Checkbox aria-label={`Sélectionner ${label}`} checked={selected.has(id)} onCheckedChange={(c) => toggle(id, !!c)} />
    </TableCell>
  )

  return (
    <>
      <PageHeader
        title="Annuaire"
        description="Toutes les personnes et organisations de l'outil, avec ou sans compte."
        actions={
          <Button onClick={() => (tab === "personnes" ? setOpenPerson("new") : setOpenOrg("new"))}>
            <Plus /> {tab === "personnes" ? "Ajouter une personne" : "Ajouter une organisation"}
          </Button>
        }
      />

      <Tabs
        value={tab}
        onValueChange={(t) => {
          setTab(t as Tab)
          setSelected(new Set())
        }}
        className="mb-4"
      >
        <TabsList variant="line">
          <TabsTrigger value="personnes">
            Personnes <span className="text-xs font-medium text-muted-foreground tabular-nums">{people.length}</span>
          </TabsTrigger>
          <TabsTrigger value="organisations">
            Organisations <span className="text-xs font-medium text-muted-foreground tabular-nums">{orgs.length}</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2.5">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tab === "personnes" ? "Nom, e-mail, téléphone…" : "Nom, e-mail, SIRET…"}
            className="h-8 rounded-full pl-9"
          />
        </div>
        {tab === "personnes" ? (
          <>
            <FilterPill value={kinds} onChange={setKinds} label="Type" options={kindOptions} />
            <FilterPill
              value={comptes}
              onChange={setComptes}
              label="Compte"
              options={[
                { value: "oui", label: "Avec compte" },
                { value: "non", label: "Sans compte" },
              ]}
            />
          </>
        ) : (
          <FilterPill value={orgTypes} onChange={setOrgTypes} label="Type" options={(Object.keys(ORG_TYPES) as OrgType[]).map((t) => ({ value: t, label: ORG_TYPES[t].label }))} />
        )}
        <FilterPill value={deps} onChange={setDeps} label="Département" options={depOptions} />
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => {
              setQ("")
              setKinds([])
              setComptes([])
              setOrgTypes([])
              setDeps([])
            }}
          >
            <X /> Effacer
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        {tab === "personnes" ? (
          <>
            {listBar(visiblePeople.length, "personne")}
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {headCheckbox}
                  <TableHead>Personne</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Organisation</TableHead>
                  <TableHead>Département</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Dossiers en cours</TableHead>
                  <TableHead className="pr-4">Compte</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiblePeople.length === 0 && <EmptyRow cols={8} />}
                {visiblePeople.map((p) => {
                  const account = accountStatus(p, dossiers, accounts)
                  return (
                    <TableRow key={p.id} className="cursor-pointer" data-state={selected.has(p.id) ? "selected" : undefined} onClick={() => setOpenPerson(p.id)}>
                      {rowCheckbox(p.id, contactName(p))}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <UserAvatar user={p} role={p.user?.role ?? (p.isClient ? "client" : undefined)} className="size-8" />
                          <div className="min-w-0">
                            <div className="font-semibold text-brand-ink">{contactName(p)}</div>
                            <EmailLine email={p.email} others={p.autresEmails} />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{personKind(p)}</TableCell>
                      <TableCell>
                        {p.org?.nom ?? (p.user && p.user.role !== "client" ? p.user.structure : <span className="text-muted-foreground">—</span>)}
                        {p.fonction && <div className="text-xs text-muted-foreground">{p.fonction}</div>}
                      </TableCell>
                      <TableCell>
                        <DepCell address={p.address} zone={zone(p)} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{p.phone || "—"}</TableCell>
                      <TableCell className="tabular-nums">
                        {p.user?.role === "admin" ? <span className="text-muted-foreground">Tous</span> : personDossiers(p, dossiers).filter(isActive).length}
                      </TableCell>
                      <TableCell className="pr-4">{account ? <AccountBadge {...account} /> : <span className="text-sm text-muted-foreground">Sans compte</span>}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </>
        ) : (
          <>
            {listBar(visibleOrgs.length, "organisation")}
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {headCheckbox}
                  <TableHead>Organisation</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Département</TableHead>
                  <TableHead>Personnes</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead className="pr-4">Dossiers en cours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleOrgs.length === 0 && <EmptyRow cols={7} />}
                {visibleOrgs.map((o) => (
                  <TableRow key={o.id} className="cursor-pointer" data-state={selected.has(o.id) ? "selected" : undefined} onClick={() => setOpenOrg(o.id)}>
                    {rowCheckbox(o.id, o.nom)}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                          <Building2 className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-brand-ink">{o.nom}</div>
                          <EmailLine email={o.email} others={o.autresEmails} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        {ORG_TYPES[o.type].label}
                        {o.type === "cabinet" && <AbonnementBadge abonnement={o.abonnement} />}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DepCell address={o.address} />
                    </TableCell>
                    <TableCell className="tabular-nums">{people.filter((p) => p.orgId === o.id).length || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{o.phone || "—"}</TableCell>
                    <TableCell className="pr-4 tabular-nums">{orgDossiers(o, dossiers, people).filter(isActive).length}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </div>

      <Dialog open={!!openPerson} onOpenChange={(o) => !o && setOpenPerson(null)}>
        <DialogContent>
          {openPerson && (
            <PersonDialog
              key={openPerson}
              entry={people.find((p) => p.id === openPerson)}
              onOpen={setOpenPerson}
              onOpenOrg={(id, creating) => {
                setOpenPerson(null)
                setOpenOrg(id)
                setCreatingOrg(!!creating)
              }}
              onDone={() => setOpenPerson(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!openOrg}
        onOpenChange={(o) => {
          if (o) return
          setOpenOrg(null)
          setCreatingOrg(false)
        }}
      >
        <DialogContent>
          {openOrg && (
            <OrgDialog
              key={openOrg}
              org={orgs.find((o) => o.id === openOrg)}
              creating={creatingOrg}
              onOpen={(id) => {
                setOpenOrg(id)
                setCreatingOrg(false)
              }}
              onOpenPerson={(id) => {
                setOpenOrg(null)
                setOpenPerson(id)
              }}
              onAddExpert={(o) => {
                setOpenOrg(null)
                setNewExpertFor(o)
              }}
              onDone={() => {
                setOpenOrg(null)
                setCreatingOrg(false)
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Expert créé depuis la fiche de son cabinet : même fiche que « Ajouter une personne », type et cabinet pré-remplis */}
      <Dialog open={!!newExpertFor} onOpenChange={(o) => !o && setNewExpertFor(null)}>
        <DialogContent>
          {newExpertFor && (
            <PersonDialog
              preset={{ type: "expert", org: newExpertFor.nom }}
              onOpen={(id) => {
                setNewExpertFor(null)
                setOpenPerson(id)
              }}
              onOpenOrg={(id) => {
                setNewExpertFor(null)
                setOpenOrg(id)
              }}
              onDone={(added) => {
                // Retour sur la fiche du cabinet, où le nouvel expert apparaît
                if (added) setOpenOrg(newExpertFor.id)
                setNewExpertFor(null)
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function DepCell({ address, zone }: { address?: string; zone?: string }) {
  const dep = departementFromAddress(address)
  return (
    <>
      {dep ?? <span className="text-muted-foreground">—</span>}
      {zone && <div className="text-xs text-muted-foreground">Intervient : {zone}</div>}
    </>
  )
}

function EmptyRow({ cols }: { cols: number }) {
  return (
    <TableRow>
      <TableCell colSpan={cols} className="py-10 text-center text-muted-foreground">
        Aucune fiche ne correspond.
      </TableCell>
    </TableRow>
  )
}

function EmailLine({ email, others = [] }: { email?: string; others?: EmailSecondaire[] }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="truncate">{email || "—"}</span>
      {others.length > 0 && (
        <span className="shrink-0 rounded-full bg-muted px-1.5 font-medium" title={others.map((e) => `${e.label ? `${e.label} : ` : ""}${e.email}`).join("\n")}>
          +{others.length}
        </span>
      )}
    </div>
  )
}

// ─── Fiche personne ─────────────────────────────────────────────────────────

type PersonForm = {
  /** Personne sans compte uniquement (le rôle d'un utilisateur se gère dans Utilisateurs) */
  type: PersonType | null
  firstName: string
  lastName: string
  org: string
  /** Type de l'organisation si elle n'existe pas encore dans l'annuaire */
  orgType: OrgType
  email: string
  autresEmails: EmailSecondaire[]
  phone: string
  address: string
}

function PersonDialog({
  entry,
  preset,
  onOpen,
  onOpenOrg,
  onDone,
}: {
  entry?: PersonEntry
  /** Nouvelle fiche pré-remplie (expert créé depuis la fiche de son cabinet) */
  preset?: { type: PersonType; org: string }
  onOpen: (id: string) => void
  /** creating : cabinet tout juste saisi, sa fiche s'ouvre en création */
  onOpenOrg: (id: string, creating?: boolean) => void
  /** added : une fiche a été enregistrée */
  onDone: (added?: boolean) => void
}) {
  const { dossiers, accounts, updateAccount, saveContact, saveOrg } = useStore()
  const { people, orgs } = useAnnuaire()
  const user = entry?.user
  const [v, setV] = React.useState<PersonForm>({
    type: entry ? (entry.type ?? (entry.isClient ? "client" : "autre")) : (preset?.type ?? null),
    firstName: entry?.firstName ?? "",
    lastName: entry?.lastName ?? "",
    org: entry?.org?.nom ?? (user && ROLE_ORG[user.role] ? (user.structure ?? "") : (preset?.org ?? "")),
    orgType: (user && ROLE_ORG[user.role]) ?? "societe",
    email: entry?.email ?? "",
    autresEmails: entry?.autresEmails ?? [],
    phone: entry?.phone ?? "",
    address: entry?.address ?? "",
  })
  const [tried, setTried] = React.useState(false)
  const set = <K extends keyof PersonForm>(k: K, val: PersonForm[K]) => setV((p) => ({ ...p, [k]: val }))
  // Organisation imposée par le rôle (utilisateur) ou par le type choisi (expert → cabinet…).
  // Les admins Nereids et gestionnaires Help You n'ont pas d'organisation dans l'annuaire (structure interne)
  const orgType = user ? ROLE_ORG[user.role] : v.type ? PERSON_TYPES[v.type].org : undefined
  const hasOrg = user ? !!orgType : !!v.type
  const missingType = !user && !v.type
  // Un expert est toujours rattaché à un cabinet
  const orgRequired = !user && v.type === "expert"
  const missingOrg = orgRequired && !v.org.trim()
  const missingName = !v.lastName.trim() && !v.firstName.trim()
  const missingEmail = !!user && !/^\S+@\S+\.\S+$/.test(v.email.trim())

  const orgChoices = orgType ? orgs.filter((o) => o.type === orgType) : orgs
  const existingOrg = orgByName(v.org, orgChoices)
  // Nouvel expert dont le cabinet n'est pas dans l'annuaire : on enchaîne sur la fiche du cabinet à compléter
  const newCabinet = !entry && orgRequired && !!v.org.trim() && !existingOrg
  const similar = similarPeople(people, { ...v, autresEmails: cleanEmails(v.autresEmails) }, entry?.id)
  const account = entry ? accountStatus(entry, dossiers, accounts) : null
  const linked = entry ? personDossiers(entry, dossiers).sort((a, b) => Number(isActive(b)) - Number(isActive(a)) || b.createdAt.localeCompare(a.createdAt)) : []

  function save(e: React.FormEvent) {
    e.preventDefault()
    setTried(true)
    if (missingType || missingOrg || missingName || missingEmail) return
    const autresEmails = cleanEmails(v.autresEmails)
    const base = {
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim(),
      email: v.email.trim() || undefined,
      autresEmails: autresEmails.length ? autresEmails : undefined,
      phone: v.phone.trim() || undefined,
      address: v.address.trim() || undefined,
    }
    // Nouvelle organisation saisie : on crée sa fiche
    let orgId = existingOrg?.id
    if (hasOrg && v.org.trim() && !existingOrg) {
      const o: Organisation = { id: orgIdFor(v.org), type: orgType ?? v.orgType, nom: v.org.trim() }
      saveOrg(o)
      orgId = o.id
    }
    if (user) {
      const now = new Date().toISOString()
      const structure = orgType ? (existingOrg?.nom ?? v.org.trim()) : undefined
      updateAccount(user.id, (a) => ({
        // Compte de démo déjà actif : la modification ne le repasse pas en invitation en attente
        ...(a ?? (USERS.some((u) => u.id === user.id) ? { invitedAt: now, activatedAt: now } : { invitedAt: now })),
        profile: { ...a?.profile, ...base, email: base.email ?? user.email, phone: base.phone ?? "", ...(structure && { structure }) },
      }))
    } else {
      const c: Contact = {
        id: entry?.id ?? `c-n-${Date.now().toString(36)}`,
        type: v.type ?? undefined,
        ...base,
        fonction: entry?.fonction,
        orgId: hasOrg && v.org.trim() ? orgId : undefined,
      }
      saveContact(c)
    }
    toast.success(entry ? "Fiche modifiée" : "Personne ajoutée à l'annuaire")
    if (newCabinet && orgId) onOpenOrg(orgId, true)
    else onDone(true)
  }

  return (
    <form onSubmit={save} noValidate className="grid gap-5">
      <DialogHeader>
        {entry && <UserAvatar user={entry} role={user?.role ?? (entry.isClient ? "client" : undefined)} className="mb-1 size-11 text-sm" />}
        <DialogTitle>{entry ? contactName(entry) : "Ajouter une personne"}</DialogTitle>
        <DialogDescription>
          {entry ? personKind(entry) : "Client, contact d'une compagnie, d'un garage… sans compte dans l'outil."}
          {user && user.role !== "client" && " · les accès se gèrent dans Utilisateurs"}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4">
        {entry && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-muted/60 px-3 py-2.5">
            <span className="text-sm text-muted-foreground">Compte</span>
            {account ? <AccountBadge {...account} /> : <span className="text-sm font-medium">Sans compte</span>}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {!user && (
            <Field data-invalid={(tried && missingType) || undefined} className="sm:col-span-2">
              <FieldLabel htmlFor="p-type">Type</FieldLabel>
              <SimpleSelect
                id="p-type"
                placeholder="Choisir"
                value={v.type}
                // L'organisation dépend du type : on la vide si elle n'est plus du bon type
                onChange={(t) =>
                  t &&
                  setV((p) => {
                    const org = PERSON_TYPES[t as PersonType].org
                    const keep = !org || orgByName(p.org, orgs)?.type === org
                    return { ...p, type: t as PersonType, org: keep ? p.org : "" }
                  })
                }
                options={(Object.keys(PERSON_TYPES) as PersonType[]).map((t) => ({ value: t, label: PERSON_TYPES[t].label }))}
              />
            </Field>
          )}
          <Field data-invalid={(tried && missingName) || undefined}>
            <FieldLabel htmlFor="p-first">Prénom</FieldLabel>
            <Input id="p-first" value={v.firstName} onChange={(e) => set("firstName", e.target.value)} />
          </Field>
          <Field data-invalid={(tried && missingName) || undefined}>
            <FieldLabel htmlFor="p-last">Nom</FieldLabel>
            <Input id="p-last" value={v.lastName} onChange={(e) => set("lastName", e.target.value)} />
          </Field>
          {hasOrg && (
            <Field data-invalid={(tried && missingOrg) || undefined} className="sm:col-span-2">
              <FieldLabel htmlFor="p-org">
                {orgType === "cabinet" ? "Cabinet" : orgType ? ORG_TYPES[orgType].label : "Organisation"}
                {!user && !orgRequired && " (optionnel)"}
              </FieldLabel>
              <SuggestInput
                id="p-org"
                value={v.org}
                aria-invalid={(tried && missingOrg) || undefined}
                placeholder="Rechercher dans l'annuaire"
                onChange={(e) => set("org", e.target.value)}
                suggestions={existingOrg ? [] : searchOrgs(orgChoices, v.org).map(orgSuggestion)}
                onPick={(id) => set("org", orgs.find((o) => o.id === id)?.nom ?? v.org)}
              />
              {v.org.trim() && !existingOrg && (
                <FieldDescription>
                  {newCabinet
                    ? "Ce cabinet n'est pas dans l'annuaire : après l'ajout de l'expert, vous compléterez sa fiche cabinet."
                    : "Nouvelle organisation : sa fiche sera créée dans l'annuaire."}
                </FieldDescription>
              )}
            </Field>
          )}
          {hasOrg && !orgType && v.org.trim() && !existingOrg && (
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="p-orgtype">Type de l&apos;organisation</FieldLabel>
              <SimpleSelect
                id="p-orgtype"
                value={v.orgType}
                onChange={(t) => t && set("orgType", t as OrgType)}
                options={(Object.keys(ORG_TYPES) as OrgType[]).map((t) => ({ value: t, label: ORG_TYPES[t].label }))}
              />
            </Field>
          )}
          <div className="sm:col-span-2">
            <EmailsField
              id="p"
              value={{ email: v.email, autresEmails: v.autresEmails }}
              onChange={(e) => setV((p) => ({ ...p, ...e }))}
              invalid={tried && missingEmail}
              description={user ? "Utilisé pour la connexion et les notifications." : "Repris par défaut dans les dossiers."}
            />
          </div>
          <Field>
            <FieldLabel htmlFor="p-phone">Téléphone</FieldLabel>
            <Input id="p-phone" type="tel" value={v.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="p-address">Adresse postale</FieldLabel>
            <Input id="p-address" placeholder="N°, rue, code postal, ville" value={v.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
        </div>

        <SimilarAlert
          title={entry ? "Doublon possible" : "Déjà dans l'annuaire ?"}
          action="Ouvrir cette fiche"
          items={similar.map((s) => ({ ...s, entry: personSuggestion(s.entry) }))}
          onUse={onOpen}
        />

        {entry && (
          <p className="text-xs text-muted-foreground">Les dossiers existants gardent les infos saisies à leur création : seuls les nouveaux dossiers reprendront cette fiche.</p>
        )}

        {entry?.org && (
          <LinkedSection title="Organisation">
            <button type="button" onClick={() => onOpenOrg(entry.org!.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50">
              <Building2 className="size-4 text-muted-foreground" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-brand-ink">{entry.org.nom}</span>
                <span className="block text-xs text-muted-foreground">{ORG_TYPES[entry.org.type].label}</span>
              </span>
            </button>
          </LinkedSection>
        )}

        {entry && user?.role !== "admin" && <DossierLinks dossiers={linked} />}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onDone()}>
          Annuler
        </Button>
        <Button type="submit">{entry ? "Enregistrer" : newCabinet ? "Ajouter et créer la fiche cabinet" : "Ajouter"}</Button>
      </DialogFooter>
    </form>
  )
}

// ─── Fiche organisation ───────────────────────────────────────────────────────

function OrgDialog({
  org,
  creating,
  onOpen,
  onOpenPerson,
  onAddExpert,
  onDone,
}: {
  org?: Organisation
  /** Fiche créée à l'ajout d'un expert (nom déjà saisi) : présentée comme une création */
  creating?: boolean
  onOpen: (id: string) => void
  onOpenPerson: (id: string) => void
  onAddExpert: (cabinet: Organisation) => void
  onDone: () => void
}) {
  const { dossiers, saveOrg } = useStore()
  const { people, orgs } = useAnnuaire()
  const [v, setV] = React.useState({
    type: org?.type ?? ("assurance" as OrgType),
    nom: org?.nom ?? "",
    abonnement: (org?.abonnement ?? null) as Abonnement | null,
    siret: org?.siret ?? "",
    email: org?.email ?? "",
    autresEmails: org?.autresEmails ?? [],
    phone: org?.phone ?? "",
    address: org?.address ?? "",
  })
  const [tried, setTried] = React.useState(false)
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((p) => ({ ...p, [k]: val }))
  const missingNom = !v.nom.trim()
  // Cabinet d'expertise : l'abonnement souscrit est obligatoire (il fixe les droits des gestionnaires sur ses dossiers)
  const missingAbonnement = v.type === "cabinet" && !v.abonnement
  const similar = similarOrgs(orgs, v, org?.id)
  const members = org ? people.filter((p) => p.orgId === org.id) : []
  const linked = org ? orgDossiers(org, dossiers, people).sort((a, b) => Number(isActive(b)) - Number(isActive(a)) || b.createdAt.localeCompare(a.createdAt)) : []

  function save(e: React.FormEvent) {
    e.preventDefault()
    setTried(true)
    if (missingNom || missingAbonnement) return
    const autresEmails = cleanEmails(v.autresEmails)
    saveOrg({
      id: org?.id ?? orgIdFor(v.nom),
      type: v.type,
      nom: v.nom.trim(),
      abonnement: v.type === "cabinet" ? v.abonnement! : undefined,
      siret: v.siret.trim() || undefined,
      email: v.email.trim() || undefined,
      autresEmails: autresEmails.length ? autresEmails : undefined,
      phone: v.phone.trim() || undefined,
      address: v.address.trim() || undefined,
    })
    toast.success(creating ? "Fiche cabinet créée" : org ? "Fiche modifiée" : "Organisation ajoutée à l'annuaire")
    onDone()
  }

  return (
    <form onSubmit={save} noValidate className="grid gap-5">
      <DialogHeader>
        {org && !creating && (
          <span className="mb-1 grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
            <Building2 className="size-5" />
          </span>
        )}
        <DialogTitle>{creating ? "Créer la fiche cabinet" : org ? org.nom : "Ajouter une organisation"}</DialogTitle>
        <DialogDescription>
          {creating ? "L'expert est ajouté. Complétez la fiche de son cabinet." : org ? ORG_TYPES[org.type].label : "Cabinet d'expertise, garage, compagnie d'assurance…"}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="o-type">Type</FieldLabel>
            <SimpleSelect
              id="o-type"
              value={v.type}
              onChange={(t) => t && set("type", t as OrgType)}
              options={(Object.keys(ORG_TYPES) as OrgType[]).map((t) => ({ value: t, label: ORG_TYPES[t].label }))}
            />
          </Field>
          {v.type === "cabinet" && (
            <Field data-invalid={(tried && missingAbonnement) || undefined} className="sm:col-span-2">
              <FieldLabel htmlFor="o-abonnement">Abonnement souscrit</FieldLabel>
              <SimpleSelect
                id="o-abonnement"
                placeholder="Choisir"
                value={v.abonnement}
                onChange={(a) => set("abonnement", a as Abonnement | null)}
                options={(Object.keys(ABONNEMENTS) as Abonnement[]).map((a) => ({ value: a, label: ABONNEMENTS[a].label }))}
              />
              <FieldDescription>
                {v.abonnement ? ABONNEMENTS[v.abonnement].detail : "Fixe les droits des gestionnaires Help You sur les dossiers de ce cabinet."}
              </FieldDescription>
            </Field>
          )}
          <Field data-invalid={(tried && missingNom) || undefined}>
            <FieldLabel htmlFor="o-nom">Nom</FieldLabel>
            <Input id="o-nom" value={v.nom} onChange={(e) => set("nom", e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="o-siret">N° de SIRET</FieldLabel>
            <Input id="o-siret" inputMode="numeric" placeholder="14 chiffres" value={v.siret} onChange={(e) => set("siret", e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <EmailsField
              id="o"
              value={{ email: v.email, autresEmails: v.autresEmails }}
              onChange={(e) => setV((p) => ({ ...p, ...e }))}
              description="Repris par défaut dans les dossiers."
            />
          </div>
          <Field>
            <FieldLabel htmlFor="o-phone">Téléphone</FieldLabel>
            <Input id="o-phone" type="tel" value={v.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="o-address">Adresse postale</FieldLabel>
            <Input id="o-address" placeholder="N°, rue, code postal, ville" value={v.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
        </div>

        <SimilarAlert
          title={org ? "Doublon possible" : "Déjà dans l'annuaire ?"}
          action="Ouvrir cette fiche"
          items={similar.map((s) => ({ ...s, entry: orgSuggestion(s.entry) }))}
          onUse={onOpen}
        />

        {org && (
          <p className="text-xs text-muted-foreground">Les dossiers existants gardent les infos saisies à leur création : seuls les nouveaux dossiers reprendront cette fiche.</p>
        )}

        {org && (
          <LinkedSection title={`${org.type === "cabinet" ? "Experts" : "Personnes"} (${members.length})`}>
            {members.length === 0 ? (
              <p className="px-3 py-2.5 text-sm text-muted-foreground">Aucune personne rattachée.</p>
            ) : (
              members.map((p) => (
                <button key={p.id} type="button" onClick={() => onOpenPerson(p.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50">
                  <UserAvatar user={p} role={p.user?.role} className="size-7" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-brand-ink">{contactName(p)}</span>
                    <span className="block truncate text-xs text-muted-foreground">{[personKind(p), p.email].filter(Boolean).join(" · ")}</span>
                  </span>
                </button>
              ))
            )}
            {org.type === "cabinet" && (
              <button type="button" onClick={() => onAddExpert(org)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-medium text-brand-ink hover:bg-muted/50">
                <UserPlus className="size-4" /> Créer une fiche expert
              </button>
            )}
          </LinkedSection>
        )}

        {org && <DossierLinks dossiers={linked} />}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit">{creating ? "Créer la fiche cabinet" : org ? "Enregistrer" : "Ajouter"}</Button>
      </DialogFooter>
    </form>
  )
}

// ─── Éléments communs ─────────────────────────────────────────────────────────

function LinkedSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t pt-5">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <div className="divide-y rounded-lg border">{children}</div>
    </div>
  )
}

function DossierLinks({ dossiers }: { dossiers: Dossier[] }) {
  const { href } = useRole()
  return (
    <LinkedSection title={`Dossiers (${dossiers.length})`}>
      {dossiers.length === 0 ? (
        <p className="px-3 py-2.5 text-sm text-muted-foreground">Aucun dossier.</p>
      ) : (
        dossiers.map((d) => (
          <Link key={d.id} href={href(`dossiers/${d.id}`)} className={cn("flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-muted/50")}>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-brand-ink">{d.ref}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {personneName(d.client)} · {d.vehicule.marque} {d.vehicule.modele}
              </span>
            </span>
            <StatusBadge status={d.status as StatusId} />
          </Link>
        ))
      )}
    </LinkedSection>
  )
}
