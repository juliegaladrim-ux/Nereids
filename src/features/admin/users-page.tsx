"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronDown, Plus, Search, Send, X } from "lucide-react"
import { toast } from "sonner"

import { useRole } from "@/components/app-shell/role-context"
import { PageHeader } from "@/components/page-header"
import { SimpleSelect } from "@/components/simple-select"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { UserAvatar } from "@/components/user-avatar"
import { FilterPill } from "@/features/admin/dossiers-list"
import { REGION_DEPARTEMENTS, USERS, allUsers, fullName, type Account, type Dossier, type StatusId, type User } from "@/lib/data"
import { formatDate } from "@/lib/format"
import { ROLES, type RoleId } from "@/lib/roles"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"

// ─── Statut du compte (CDC §16) ─────────────────────────────────────────────────

type AccountStatus = "actif" | "invite"

const STATUS: Record<AccountStatus, { label: string; className: string; dot: string }> = {
  actif: { label: "Actif", className: "bg-tone-done-bg text-tone-done", dot: "bg-tone-done" },
  invite: { label: "Invité", className: "bg-tone-waiting-bg text-tone-waiting", dot: "bg-tone-waiting" },
}

const ROLE_LABEL = Object.fromEntries(ROLES.map((r) => [r.id, r.id === "admin" ? "Admin Nereids" : r.short])) as Record<RoleId, string>
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
const groupRoles = (g: Group) => ROLES.filter((r) => GROUPS[g].roles.includes(r.id))

/** Utilisateurs de démo : comptes déjà actifs (sauf compte invité explicite, ex. le suiveur à activer) */
const SEED_IDS = new Set(USERS.map((u) => u.id))

type Row = {
  key: string
  user: User
  status: AccountStatus
  dossiers: Dossier[]
}

const involves = (d: Dossier, id: string) =>
  d.intervenants.gestionnaire === id || d.intervenants.expert === id || d.intervenants.reparateur === id || d.intervenants.suiveurs.includes(id)

const isActive = (d: Dossier) => d.status !== "cloture" && d.status !== "archive"

function intervenantStatus(id: string, a?: Account): AccountStatus {
  if (a) return a.activatedAt ? "actif" : "invite"
  return SEED_IDS.has(id) ? "actif" : "invite"
}

function buildRows(dossiers: Dossier[], accounts: Record<string, Account>): Row[] {
  const rows: Row[] = allUsers()
    .filter((u) => u.role !== "client")
    .map((u) => ({
      key: u.id,
      user: u,
      status: intervenantStatus(u.id, accounts[u.id]),
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
    .filter((r) => roles.length === 0 || roles.includes(r.user.role))
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
        <FilterPill value={roles} onChange={setRoles} label="Rôle" options={groupRoles(group).map((r) => ({ value: r.id, label: ROLE_LABEL[r.id] }))} />
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
                <TableCell>{ROLE_LABEL[r.user.role]}</TableCell>
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
                  <AccountBadge status={r.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={adding} onOpenChange={setAdding}>
        <SheetContent className="w-full gap-0 sm:max-w-md">{adding && <AddUser group={group} onDone={() => setAdding(false)} />}</SheetContent>
      </Sheet>

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpenKey(null)}>
        <SheetContent className="w-full gap-0 sm:max-w-md">{open && <EditUser key={open.key} row={open} onDone={() => setOpenKey(null)} />}</SheetContent>
      </Sheet>
    </>
  )
}

function AccountBadge({ status }: { status: AccountStatus }) {
  const s = STATUS[status]
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap", s.className)}>
      <span className={cn("size-1.5 shrink-0 rounded-full", s.dot)} />
      {s.label}
    </span>
  )
}

// ─── Formulaire (CDC §16 : nom, prénom, fonction, structure, téléphone, e-mail) ───

type FormValues = {
  firstName: string
  lastName: string
  fonction: string
  structure: string
  phone: string
  email: string
  region: string
  departements: string[]
}

type TextKey = Exclude<keyof FormValues, "region" | "departements">

const toForm = (u?: Partial<User>): FormValues => ({
  firstName: u?.firstName ?? "",
  lastName: u?.lastName ?? "",
  fonction: u?.fonction ?? "",
  structure: u?.structure ?? "",
  phone: u?.phone ?? "",
  email: u?.email ?? "",
  region: u?.region ?? "",
  departements: u?.departements ?? [],
})

/** Zone d'intervention demandée à tous, sauf aux admins Nereids qui pilotent toute la France */
const hasZone = (role: RoleId | null) => role !== "admin"

function cleanValues(v: FormValues): Partial<User> {
  const text = Object.fromEntries((["firstName", "lastName", "fonction", "structure", "phone", "email"] as TextKey[]).map((k) => [k, v[k].trim()]))
  return { ...text, region: v.region || undefined, departements: v.region ? v.departements : undefined }
}

/** Réparateur : le garage suffit (comme à l'ajout d'un intervenant dans un dossier) ; sinon prénom + nom */
function missingFields(role: RoleId | null, v: FormValues): Partial<Record<keyof FormValues, boolean>> {
  const garage = role === "reparateur"
  return {
    structure: garage && !v.structure.trim(),
    firstName: !garage && !v.firstName.trim(),
    lastName: !garage && !v.lastName.trim(),
    email: !/^\S+@\S+\.\S+$/.test(v.email.trim()),
    region: hasZone(role) && !v.region,
  }
}

function UserFields({
  v,
  setV,
  missing,
  tried,
  role,
}: {
  v: FormValues
  setV: React.Dispatch<React.SetStateAction<FormValues>>
  missing: Partial<Record<keyof FormValues, boolean>>
  tried: boolean
  role: RoleId | null
}) {
  const field = (k: TextKey, label: string, type = "text") => {
    const invalid = tried && missing[k] ? true : undefined
    return (
      <Field data-invalid={invalid}>
        <FieldLabel htmlFor={`user-${k}`}>{label}</FieldLabel>
        <Input id={`user-${k}`} type={type} value={v[k]} aria-invalid={invalid} onChange={(e) => setV((p) => ({ ...p, [k]: e.target.value }))} />
      </Field>
    )
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {field("firstName", role === "reparateur" ? "Prénom (optionnel)" : "Prénom")}
      {field("lastName", role === "reparateur" ? "Nom (optionnel)" : "Nom")}
      <div className="sm:col-span-2">{field("structure", role === "reparateur" ? "Garage" : "Structure")}</div>
      <div className="sm:col-span-2">{field("fonction", "Fonction (optionnel)")}</div>
      <div className="sm:col-span-2">{field("email", "E-mail", "email")}</div>
      <div className="sm:col-span-2">{field("phone", "Téléphone (optionnel)", "tel")}</div>
      {hasZone(role) && (
        <>
          <Field data-invalid={tried && missing.region ? true : undefined} className="sm:col-span-2">
            <FieldLabel htmlFor="user-region">Région d&apos;intervention</FieldLabel>
            <SimpleSelect
              id="user-region"
              placeholder="Choisir"
              value={v.region || null}
              // Les départements dépendent de la région : on les vide au changement
              onChange={(r) => setV((p) => ({ ...p, region: r ?? "", departements: r === p.region ? p.departements : [] }))}
              options={Object.keys(REGION_DEPARTEMENTS).map((r) => ({ value: r, label: r }))}
            />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="user-dep">Départements d&apos;intervention</FieldLabel>
            <DepartementsSelect region={v.region} value={v.departements} onChange={(departements) => setV((p) => ({ ...p, departements }))} />
            <FieldDescription>Toute la région si aucun département n&apos;est choisi.</FieldDescription>
          </Field>
        </>
      )}
    </div>
  )
}

function DepartementsSelect({ region, value, onChange }: { region: string; value: string[]; onChange: (v: string[]) => void }) {
  const options = REGION_DEPARTEMENTS[region] ?? []
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        id="user-dep"
        disabled={!region}
        className="flex h-10 w-full items-center justify-between gap-1.5 rounded-[6px] border border-input bg-card pr-2.5 pl-3 text-left text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={cn("truncate", value.length === 0 && "text-muted-foreground")}>
          {!region ? "Choisir d'abord la région" : value.length === 0 ? "Toute la région" : value.map((d) => d.split(" ")[0]).join(", ")}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-72 w-(--anchor-width)">
        {options.map((d) => (
          <DropdownMenuCheckboxItem
            key={d}
            checked={value.includes(d)}
            onCheckedChange={(c) => onChange(c ? options.filter((o) => o === d || value.includes(o)) : value.filter((x) => x !== d))}
          >
            {d}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Structure pré-remplie selon le rôle (les autres structures sont propres à chaque intervenant) */
const DEFAULT_STRUCTURE: Partial<Record<RoleId, string>> = { admin: "Nereids", gestionnaire: "Help You" }

function AddUser({ group, onDone }: { group: Group; onDone: () => void }) {
  const { updateAccount } = useStore()
  const [role, setRole] = React.useState<RoleId | null>(null)
  const [v, setV] = React.useState<FormValues>(toForm())
  const [tried, setTried] = React.useState(false)
  const missing = missingFields(role, v)
  const invalidRole = tried && !role

  function chooseRole(r: RoleId) {
    setRole(r)
    // Pré-remplit la structure tant qu'elle n'a pas été saisie à la main
    setV((p) => (!p.structure || Object.values(DEFAULT_STRUCTURE).includes(p.structure) ? { ...p, structure: DEFAULT_STRUCTURE[r] ?? "" } : p))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setTried(true)
    if (!role || Object.values(missing).some(Boolean)) return
    const user: User = {
      id: `u-n-${Date.now().toString(36)}`,
      role,
      ...(cleanValues(v) as Omit<User, "id" | "role">),
      ...(!hasZone(role) && { region: undefined, departements: undefined }),
    }
    updateAccount(user.id, () => ({ invitedAt: new Date().toISOString(), user }))
    toast.success("Invitation envoyée", { description: `${fullName(user)} recevra un e-mail pour activer son compte.` })
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate className="flex h-full flex-col">
      <SheetHeader className="border-b p-5">
        <SheetTitle className="text-lg font-semibold">{GROUPS[group].add}</SheetTitle>
        <SheetDescription>Il recevra une invitation par e-mail pour activer son compte.</SheetDescription>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto p-5">
        <div className="grid gap-4">
          <Field data-invalid={invalidRole || undefined}>
            <FieldLabel htmlFor="user-role">Rôle</FieldLabel>
            <SimpleSelect
              id="user-role"
              placeholder="Choisir"
              value={role}
              onChange={(r) => r && chooseRole(r as RoleId)}
              options={groupRoles(group).map((r) => ({ value: r.id, label: r.label }))}
            />
            {group === "intervenants" && <FieldDescription>Les clients sont invités depuis leur dossier.</FieldDescription>}
          </Field>
          <UserFields v={v} setV={setV} missing={missing} tried={tried} role={role} />
        </div>
      </div>
      <SheetFooter className="flex-row justify-end border-t p-4">
        <Button type="button" variant="outline" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit">
          <Send /> Envoyer l&apos;invitation
        </Button>
      </SheetFooter>
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
      // Compte de démo déjà actif : la modification ne le repasse pas en « Invité »
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
    <form onSubmit={save} noValidate className="flex h-full flex-col">
      <SheetHeader className="flex-row items-center gap-3 border-b p-5 pr-12">
        <UserAvatar user={user} className="size-11 text-sm" />
        <div className="min-w-0">
          <SheetTitle className="truncate text-lg font-semibold">{fullName(user)}</SheetTitle>
          <SheetDescription>{ROLES.find((r) => r.id === user.role)?.label}</SheetDescription>
        </div>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-muted/60 px-3 py-2.5">
          <span className="text-sm text-muted-foreground">Statut du compte</span>
          <AccountBadge status={row.status} />
          {row.status === "invite" && (
            <>
              {invitedAt && <span className="text-xs text-muted-foreground">Invité le {formatDate(invitedAt)}</span>}
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
                          {d.client.firstName} {d.client.lastName} · {d.vehicule.marque} {d.vehicule.modele}
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

      <SheetFooter className="flex-row justify-end border-t p-4">
        <Button type="button" variant="outline" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit">Enregistrer</Button>
      </SheetFooter>
    </form>
  )
}
