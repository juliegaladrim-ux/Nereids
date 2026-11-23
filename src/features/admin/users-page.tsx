"use client"

import * as React from "react"
import Link from "next/link"
import { Plus, Search, Send, X } from "lucide-react"
import { toast } from "sonner"

import { useRole } from "@/components/app-shell/role-context"
import { PageHeader } from "@/components/page-header"
import { SimpleSelect } from "@/components/simple-select"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { UserAvatar } from "@/components/user-avatar"
import { FilterPill } from "@/features/admin/dossiers-list"
import { SimilarAlert, SuggestInput, personSuggestion } from "@/features/annuaire/annuaire-fields"
import { DEFAULT_STRUCTURE, UserFields, cleanValues, missingFields, newUser, toForm, type FormValues } from "@/features/admin/user-form"
import { SEED_LAST_LOGIN, USERS, allUsers, isClosedStatus, daysFromNow, fullName, personneName, type Account, type Dossier, type StatusId, type User } from "@/lib/data"
import { searchPeople, similarPeople, toContact, useAnnuaire } from "@/lib/annuaire"
import { formatDate } from "@/lib/format"
import { PROFILES, ROLES, getProfile, userProfile, type ProfileId, type RoleId } from "@/lib/roles"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"

// ─── Statut du compte (CDC §16) ─────────────────────────────────────────────────

export type AccountStatus = "actif" | "inactif" | "invitation"

const STATUS: Record<AccountStatus, { label: string; className: string; dot: string }> = {
  actif: { label: "Actif", className: "bg-tone-done-bg text-tone-done", dot: "bg-tone-done" },
  inactif: { label: "Inactif", className: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/50" },
  invitation: { label: "Invitation envoyée", className: "bg-tone-waiting-bg text-tone-waiting", dot: "bg-tone-waiting" },
}

const profileShort = (u: User) => PROFILES.find((p) => p.id === userProfile(u))?.short ?? u.role
const ROLE_ORDER = ROLES.map((r) => r.id)
/**
 * Deux groupes : l'équipe qui pilote les dossiers (Nereids + Help You) et les intervenants externes.
 * Les clients particuliers ne sont pas listés : ils sont invités et suivis depuis leur dossier.
 */
type Group = "equipe" | "intervenants"
const GROUPS: Record<Group, { label: string; roles: RoleId[]; add: string }> = {
  equipe: {
    label: "Équipe",
    roles: ["admin", "gestionnaire"],
    add: "Ajouter un membre",
  },
  intervenants: {
    label: "Intervenants",
    roles: ["expert", "reparateur", "suiveur"],
    add: "Ajouter un intervenant",
  },
}
/** Profils proposés dans un groupe (l'équipe compte admins, gestionnaires Nereids et gestionnaires Help You) */
const groupProfiles = (g: Group) => PROFILES.filter((p) => GROUPS[g].roles.includes(p.role))

/** Utilisateurs de démo : comptes déjà actifs (sauf compte invité explicite, ex. le suiveur à activer) */
const SEED_IDS = new Set(USERS.map((u) => u.id))

type Row = {
  key: string
  user: User
  status: AccountStatus
  lastLoginAt?: string
  /** Invitation envoyée, compte pas encore activé */
  pending: boolean
  dossiers: Dossier[]
}

const involves = (d: Dossier, id: string) =>
  d.intervenants.gestionnaire === id || d.intervenants.expert === id || d.intervenants.reparateur === id || d.intervenants.suiveurs.includes(id)

const isActive = (d: Dossier) => !isClosedStatus(d.status)

/** Sans connexion depuis 6 mois, un compte activé passe « Inactif » */
const INACTIVE_MONTHS = 6

export function isDormant(lastLoginAt?: string): boolean {
  if (!lastLoginAt) return false
  const limit = new Date(lastLoginAt)
  limit.setMonth(limit.getMonth() + INACTIVE_MONTHS)
  return limit < new Date()
}

/** Dernière connexion : celle tracée sur le compte, sinon son activation (comptes de démo : récente, sauf exceptions) */
export function lastLogin(id: string, a?: Account): string | undefined {
  if (a?.lastLoginAt) return a.lastLoginAt
  if (SEED_IDS.has(id) && (!a || a.activatedAt)) return daysFromNow(SEED_LAST_LOGIN[id] ?? -1)
  return a?.activatedAt
}

export const isPending = (id: string, a?: Account) => (a ? !a.activatedAt : !SEED_IDS.has(id))

export function intervenantStatus(id: string, a?: Account): AccountStatus {
  if (isPending(id, a)) return "invitation"
  return isDormant(lastLogin(id, a)) ? "inactif" : "actif"
}

function buildRows(dossiers: Dossier[], accounts: Record<string, Account>): Row[] {
  const rows: Row[] = allUsers()
    .filter((u) => u.role !== "client")
    .map((u) => ({
      key: u.id,
      user: u,
      status: intervenantStatus(u.id, accounts[u.id]),
      lastLoginAt: lastLogin(u.id, accounts[u.id]),
      pending: isPending(u.id, accounts[u.id]),
      dossiers: dossiers.filter((d) => involves(d, u.id)),
    }))

  return rows.sort(
    (a, b) =>
      ROLE_ORDER.indexOf(a.user.role) - ROLE_ORDER.indexOf(b.user.role) ||
      `${a.user.lastName}${a.user.structure}`.localeCompare(`${b.user.lastName}${b.user.structure}`),
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function UsersPage() {
  const { dossiers, accounts } = useStore()
  const rows = buildRows(dossiers, accounts)

  const [group, setGroup] = React.useState<Group>("equipe")
  const [q, setQ] = React.useState("")
  const [roles, setRoles] = React.useState<string[]>([])
  const [statuses, setStatuses] = React.useState<string[]>([])
  const [adding, setAdding] = React.useState(false)
  const [openKey, setOpenKey] = React.useState<string | null>(null)
  const open = rows.find((r) => r.key === openKey)

  const query = q.trim().toLowerCase()
  const inGroup = (g: Group) => rows.filter((r) => GROUPS[g].roles.includes(r.user.role))
  const visible = inGroup(group)
    .filter((r) => !query || [fullName(r.user), r.user.email, r.user.structure, r.user.phone].some((v) => v?.toLowerCase().includes(query)))
    .filter((r) => roles.length === 0 || roles.includes(userProfile(r.user) ?? ""))
    .filter((r) => statuses.length === 0 || statuses.includes(r.status))
  const hasFilters = q || roles.length > 0 || statuses.length > 0

  return (
    <>
      <PageHeader
        title="Utilisateurs"
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus /> {GROUPS[group].add}
          </Button>
        }
      />

      <Tabs
        value={group}
        onValueChange={(g) => {
          setGroup(g as Group)
          // Les rôles filtrés n'existent pas dans l'autre groupe
          setRoles([])
        }}
        className="mb-4"
      >
        <TabsList variant="line">
          {(Object.keys(GROUPS) as Group[]).map((g) => (
            <TabsTrigger key={g} value={g}>
              {GROUPS[g].label}
              <span className="text-xs font-medium text-muted-foreground tabular-nums">{inGroup(g).length}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2.5">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, e-mail, structure…" className="h-8 rounded-full pl-9" />
        </div>
        <FilterPill value={roles} onChange={setRoles} label="Rôle" options={groupProfiles(group).map((p) => ({ value: p.id, label: p.short }))} />
        <FilterPill
          value={statuses}
          onChange={setStatuses}
          label="Statut du compte"
          options={(Object.keys(STATUS) as AccountStatus[]).map((s) => ({ value: s, label: STATUS[s].label }))}
        />
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => {
              setQ("")
              setRoles([])
              setStatuses([])
            }}
          >
            <X /> Effacer
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <p className="px-4 py-3 text-xs text-muted-foreground">
          {visible.length} utilisateur{visible.length > 1 ? "s" : ""}
        </p>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Utilisateur</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Structure</TableHead>
              <TableHead>Téléphone</TableHead>
              {group === "intervenants" && <TableHead>Zone d&apos;intervention</TableHead>}
              <TableHead>Dossiers en cours</TableHead>
              <TableHead className="pr-4">Statut du compte</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={group === "intervenants" ? 7 : 6} className="py-10 text-center text-muted-foreground">
                  Aucun utilisateur ne correspond.
                </TableCell>
              </TableRow>
            )}
            {visible.map((r) => (
              <TableRow key={r.key} className="cursor-pointer" onClick={() => setOpenKey(r.key)}>
                <TableCell className="pl-4">
                  <div className="flex items-center gap-3">
                    <UserAvatar user={r.user} className="size-8" />
                    <div className="min-w-0">
                      <div className="font-semibold text-brand-ink">{fullName(r.user)}</div>
                      <div className="text-xs text-muted-foreground">{r.user.email || "—"}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{profileShort(r.user)}</TableCell>
                <TableCell>
                  {r.user.structure || "—"}
                  {r.user.fonction && <div className="text-xs text-muted-foreground">{r.user.fonction}</div>}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{r.user.phone || "—"}</TableCell>
                {group === "intervenants" && (
                  <TableCell>
                    {r.user.region ?? <span className="text-muted-foreground">—</span>}
                    {r.user.region && (
                      <div className="text-xs text-muted-foreground">
                        {r.user.departements?.length ? r.user.departements.map((d) => d.split(" ")[0]).join(", ") : "Toute la région"}
                      </div>
                    )}
                  </TableCell>
                )}
                <TableCell className="tabular-nums">
                  {r.user.role === "admin" ? <span className="text-muted-foreground">Tous</span> : r.dossiers.filter(isActive).length}
                </TableCell>
                <TableCell className="pr-4">
                  <AccountBadge status={r.status} lastLoginAt={r.lastLoginAt} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Modales centrées, comme partout dans le proto (ajout d'un intervenant depuis un dossier, etc.) */}
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>{adding && <AddUser group={group} onDone={() => setAdding(false)} />}</DialogContent>
      </Dialog>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpenKey(null)}>
        <DialogContent>{open && <EditUser key={open.key} row={open} onDone={() => setOpenKey(null)} />}</DialogContent>
      </Dialog>
    </>
  )
}

export function AccountBadge({ status, lastLoginAt }: { status: AccountStatus; lastLoginAt?: string }) {
  const s = STATUS[status]
  const badge = (
    <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap", s.className)}>
      <span className={cn("size-1.5 shrink-0 rounded-full", s.dot)} />
      {s.label}
    </span>
  )
  if (status !== "inactif") return badge
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>{badge}</TooltipTrigger>
      <TooltipContent>
        Aucune connexion depuis plus de {INACTIVE_MONTHS} mois{lastLoginAt ? ` (dernière le ${formatDate(lastLoginAt)})` : ""}
      </TooltipContent>
    </Tooltip>
  )
}

function AddUser({ group, onDone }: { group: Group; onDone: () => void }) {
  const { inviteUser, saveContact } = useStore()
  const { people } = useAnnuaire()
  const [profile, setProfile] = React.useState<ProfileId | null>(null)
  const role: RoleId | null = profile ? getProfile(profile).role : null
  const [v, setV] = React.useState<FormValues>(toForm())
  const [tried, setTried] = React.useState(false)
  /** Fiche de l'annuaire (personne sans compte) à partir de laquelle on ouvre le compte */
  const [fromContact, setFromContact] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const missing = missingFields(role, v)
  const invalidRole = tried && !role

  // Anti-doublon : la personne a peut-être déjà une fiche (avec ou sans compte)
  const similar = similarPeople(people, v, fromContact ?? undefined)
  const withAccount = similar.filter((s) => s.entry.user && s.entry.user.role !== "client")
  const withoutAccount = similar.filter((s) => !s.entry.user)
  const sameEmailUser = withAccount.some((s) => s.reason === "même e-mail")

  function pickContact(id: string) {
    const c = people.find((p) => p.id === id)
    if (!c) return
    setFromContact(id)
    setSearch("")
    setV((p) => ({
      ...toForm({ ...c, structure: c.org?.nom ?? p.structure, phone: c.phone ?? "", email: c.email ?? "", fonction: c.fonction ?? "" }),
      region: p.region,
      departements: p.departements,
    }))
  }

  function chooseProfile(id: ProfileId) {
    setProfile(id)
    const structure = getProfile(id).structure ?? ""
    // Pré-remplit la structure tant qu'elle n'a pas été saisie à la main
    setV((p) => (!p.structure || ["Nereids", "Help You", ...Object.values(DEFAULT_STRUCTURE)].includes(p.structure) ? { ...p, structure } : p))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setTried(true)
    if (!role || Object.values(missing).some(Boolean) || sameEmailUser) return
    const user = newUser(role, v)
    inviteUser(user)
    // La fiche sans compte devient celle de l'utilisateur : une seule personne dans l'annuaire
    const c = people.find((p) => p.id === fromContact)
    if (c) {
      saveContact({ ...toContact(c), userId: user.id })
    }
    toast.success("Invitation envoyée", { description: `${fullName(user)} recevra un e-mail pour activer son compte.` })
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <DialogHeader>
        <DialogTitle>{GROUPS[group].add}</DialogTitle>
        <DialogDescription>Il recevra une invitation par e-mail pour activer son compte.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
          <Field>
            <FieldLabel htmlFor="user-search">Rechercher dans l&apos;annuaire</FieldLabel>
            <SuggestInput
              id="user-search"
              placeholder="Nom, e-mail, téléphone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              suggestions={searchPeople(
                people.filter((p) => !p.user),
                search,
              ).map(personSuggestion)}
              onPick={pickContact}
            />
            <FieldDescription>
              {fromContact
                ? "Infos reprises de la fiche de l'annuaire : le compte sera rattaché à cette fiche."
                : "Si la personne est déjà dans l'annuaire (client, contact d'un dossier…), reprenez sa fiche pour éviter un doublon."}
            </FieldDescription>
          </Field>
          <Field data-invalid={invalidRole || undefined}>
            <FieldLabel htmlFor="user-role">Rôle</FieldLabel>
            <SimpleSelect
              id="user-role"
              placeholder="Choisir"
              value={profile}
              onChange={(r) => r && chooseProfile(r as ProfileId)}
              options={groupProfiles(group).map((p) => ({ value: p.id, label: p.label }))}
            />
            {group === "intervenants" && <FieldDescription>Les clients sont invités depuis leur dossier.</FieldDescription>}
          </Field>
        <UserFields v={v} setV={setV} missing={missing} tried={tried} role={role} />
        <SimilarAlert
          title={sameEmailUser ? "Cette personne a déjà un compte" : "Un compte proche existe déjà"}
          items={withAccount.map((s) => ({ ...s, entry: personSuggestion(s.entry) }))}
        />
        <SimilarAlert items={withoutAccount.map((s) => ({ ...s, entry: personSuggestion(s.entry) }))} onUse={pickContact} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" disabled={sameEmailUser}>
          <Send /> Envoyer l&apos;invitation
        </Button>
      </DialogFooter>
    </form>
  )
}

function EditUser({ row, onDone }: { row: Row; onDone: () => void }) {
  const { href } = useRole()
  const { accounts, updateAccount } = useStore()
  const { user } = row
  const [v, setV] = React.useState<FormValues>(toForm(user))
  const [tried, setTried] = React.useState(false)
  const missing = missingFields(user.role, v)
  const sorted = [...row.dossiers].sort((a, b) => Number(isActive(b)) - Number(isActive(a)) || b.createdAt.localeCompare(a.createdAt))

  function save(e: React.FormEvent) {
    e.preventDefault()
    setTried(true)
    if (Object.values(missing).some(Boolean)) return
    const patch = cleanValues(v)
    const now = new Date().toISOString()
    updateAccount(user.id, (a) => ({
      // Compte de démo déjà actif : la modification ne le repasse pas en invitation en attente
      ...(a ?? (SEED_IDS.has(user.id) ? { invitedAt: now, activatedAt: now } : { invitedAt: now })),
      profile: { ...a?.profile, ...patch },
    }))
    toast.success("Utilisateur modifié")
    onDone()
  }

  function resend() {
    updateAccount(user.id, (a) => ({ ...a, invitedAt: new Date().toISOString() }))
    toast.success("Invitation renvoyée", { description: user.email })
  }

  const invitedAt = accounts[user.id]?.invitedAt

  return (
    <form onSubmit={save} noValidate className="grid gap-5">
      <DialogHeader>
        <UserAvatar user={user} className="mb-1 size-11 text-sm" />
        <DialogTitle>{fullName(user)}</DialogTitle>
        <DialogDescription>{PROFILES.find((p) => p.id === userProfile(user))?.label}</DialogDescription>
      </DialogHeader>

      <div>
        <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-muted/60 px-3 py-2.5">
          <span className="text-sm text-muted-foreground">Statut du compte</span>
          <AccountBadge status={row.status} lastLoginAt={row.lastLoginAt} />
          {row.pending && (
            <>
              {invitedAt && <span className="text-xs text-muted-foreground">le {formatDate(invitedAt)}</span>}
              <Button type="button" variant="secondary" size="xs" className="ml-auto" onClick={resend}>
                <Send /> Renvoyer l&apos;invitation
              </Button>
            </>
          )}
        </div>

        <UserFields v={v} setV={setV} missing={missing} tried={tried} role={user.role} />

        {user.role !== "admin" && (
          <div className="mt-6 border-t pt-5">
            <h3 className="mb-2 text-sm font-semibold">Dossiers ({row.dossiers.length})</h3>
            {sorted.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun dossier.</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {sorted.map((d) => (
                  <li key={d.id}>
                    <Link href={href(`dossiers/${d.id}`)} className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-muted/50">
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-brand-ink">{d.ref}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {personneName(d.client)} · {d.vehicule.marque} {d.vehicule.modele}
                        </span>
                      </span>
                      <StatusBadge status={d.status as StatusId} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit">Enregistrer</Button>
      </DialogFooter>
    </form>
  )
}
