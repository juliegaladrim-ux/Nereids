"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { AlertTriangle, CalendarClock, CircleCheck, CircleDashed, FolderOpen, Plus, Search, UserPlus, X, type LucideIcon } from "lucide-react"

import { useRole } from "@/components/app-shell/role-context"
import { Immat } from "@/components/immat"
import { PageHeader } from "@/components/page-header"
import { SimpleSelect } from "@/components/simple-select"
import { LateBadge, StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DOSSIER_TYPES,
  STATUSES,
  USERS,
  fullName,
  getUser,
  hasUpcomingExpertise,
  isLate,
  lateDays,
  needsAssignment,
  type Dossier,
  type StatusId,
} from "@/lib/data"
import { matchesSearch } from "@/lib/access"
import { formatDate, formatDateTime } from "@/lib/format"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"

type View = "tous" | "a-assigner" | "en-retard" | "expertises" | "clotures"

const VIEWS: { id: View; label: string; icon: LucideIcon; tone?: "primary" | "danger"; filter: (d: Dossier) => boolean }[] = [
  { id: "tous", label: "En cours", icon: FolderOpen, filter: (d) => d.status !== "cloture" && d.status !== "archive" },
  { id: "a-assigner", label: "À assigner", icon: UserPlus, tone: "primary", filter: needsAssignment },
  { id: "en-retard", label: "En retard", icon: AlertTriangle, tone: "danger", filter: isLate },
  {
    id: "expertises",
    label: "Expertises à venir",
    icon: CalendarClock,
    filter: (d) => hasUpcomingExpertise(d, 365),
  },
  { id: "clotures", label: "Clôturés", icon: CircleCheck, filter: (d) => d.status === "cloture" },
]

const ALL = "__all"

const EXPERTS = USERS.filter((u) => u.role === "expert")
/** Un cabinet = un groupe d'experts (structure de l'expert) */
const CABINETS = [...new Set(EXPERTS.map((u) => u.structure))].sort()

export function DossiersList({ mode = "actifs" }: { mode?: "actifs" | "archives" }) {
  const { href } = useRole()
  const { dossiers } = useStore()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const view = (params.get("vue") as View) || "tous"
  const [q, setQ] = React.useState("")
  const [type, setType] = React.useState<string>(ALL)
  const [status, setStatus] = React.useState<string>(ALL)
  const [gest, setGest] = React.useState<string>(ALL)
  const [expert, setExpert] = React.useState<string>(ALL)
  const [cabinet, setCabinet] = React.useState<string>(ALL)
  const [rep, setRep] = React.useState<string>(ALL)

  // Le cabinet restreint la liste des experts proposés
  const cabinetExperts = EXPERTS.filter((u) => cabinet === ALL || u.structure === cabinet)

  const base = mode === "archives" ? dossiers.filter((d) => d.status === "archive") : dossiers.filter(VIEWS.find((v) => v.id === view)!.filter)

  const rows = base
    .filter((d) => matchesSearch(d, q, (id) => fullName(getUser(id))))
    .filter((d) => type === ALL || d.type === type)
    .filter((d) => status === ALL || d.status === status)
    .filter((d) => gest === ALL || d.intervenants.gestionnaire === gest)
    .filter((d) => cabinet === ALL || cabinetExperts.some((u) => u.id === d.intervenants.expert))
    .filter((d) => expert === ALL || d.intervenants.expert === expert)
    .filter((d) => rep === ALL || d.intervenants.reparateur === rep)
    .sort((a, b) => (view === "expertises" ? (a.expertise.date ?? "").localeCompare(b.expertise.date ?? "") : b.createdAt.localeCompare(a.createdAt)))

  const counts = Object.fromEntries(VIEWS.map((v) => [v.id, dossiers.filter(v.filter).length]))
  const hasFilters = q || type !== ALL || status !== ALL || gest !== ALL || cabinet !== ALL || expert !== ALL || rep !== ALL

  function setView(v: View) {
    const p = new URLSearchParams(params)
    if (v === "tous") p.delete("vue")
    else p.set("vue", v)
    router.replace(`${pathname}${p.size ? `?${p}` : ""}`)
  }

  return (
    <>
      <PageHeader
        title={mode === "archives" ? "Archives" : "Dossiers"}
        description={
          mode === "archives"
            ? "Toujours consultables et téléchargeables."
            : undefined
        }
        actions={
          mode === "actifs" && (
            <Button render={<Link href={href("dossiers/nouveau")} />} nativeButton={false}>
              <Plus /> Nouveau dossier
            </Button>
          )
        }
      />

      {mode === "actifs" && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {VIEWS.map((v) => (
            <ViewCard
              key={v.id}
              label={v.label}
              value={counts[v.id]}
              icon={v.icon}
              tone={counts[v.id] ? v.tone : undefined}
              selected={view === v.id}
              // Re-clic sur une vue active = retour à « En cours »
              onClick={() => setView(view === v.id ? "tous" : v.id)}
            />
          ))}
        </div>
      )}

      {/* Recherche + filtres */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <div className="col-span-full flex items-center gap-2">
          <div className="relative flex-1 lg:w-80 lg:flex-none">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Immat., réf., client, expert…"
              className="pl-9"
            />
          </div>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ("")
                setType(ALL)
                setStatus(ALL)
                setGest(ALL)
                setCabinet(ALL)
                setExpert(ALL)
                setRep(ALL)
              }}
            >
              <X /> Effacer
            </Button>
          )}
        </div>
        <SimpleSelect
          value={type}
          onChange={(v) => setType(v ?? ALL)}
          options={[{ value: ALL, label: "Tous les types" }, ...Object.entries(DOSSIER_TYPES).map(([value, t]) => ({ value, label: t.label }))]}
        />
        <SimpleSelect
          value={status}
          onChange={(v) => setStatus(v ?? ALL)}
          options={[{ value: ALL, label: "Tous les statuts" }, ...Object.entries(STATUSES).map(([value, s]) => ({ value, label: s.label }))]}
        />
        <SimpleSelect
          value={gest}
          onChange={(v) => setGest(v ?? ALL)}
          options={[{ value: ALL, label: "Tous gestionnaires" }, ...USERS.filter((u) => u.role === "gestionnaire").map((u) => ({ value: u.id, label: fullName(u) }))]}
        />
        <SimpleSelect
          value={cabinet}
          onChange={(v) => {
            const c = v ?? ALL
            setCabinet(c)
            // L'expert choisi n'appartient plus au cabinet : on le retire
            if (c !== ALL && expert !== ALL && getUser(expert)?.structure !== c) setExpert(ALL)
          }}
          options={[{ value: ALL, label: "Tous cabinets" }, ...CABINETS.map((c) => ({ value: c, label: c }))]}
        />
        <SimpleSelect
          value={expert}
          onChange={(v) => setExpert(v ?? ALL)}
          options={[{ value: ALL, label: "Tous experts" }, ...cabinetExperts.map((u) => ({ value: u.id, label: fullName(u) }))]}
        />
        <SimpleSelect
          value={rep}
          onChange={(v) => setRep(v ?? ALL)}
          options={[{ value: ALL, label: "Tous réparateurs" }, ...USERS.filter((u) => u.role === "reparateur").map((u) => ({ value: u.id, label: u.structure }))]}
        />
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Dossier</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Véhicule</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Compagnie visée</TableHead>
              <TableHead>Gestionnaire</TableHead>
              <TableHead>Expert</TableHead>
              <TableHead className="pr-4">Expertise prévue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  Aucun dossier ne correspond.
                </TableCell>
              </TableRow>
            )}
            {rows.map((d) => (
              <TableRow
                key={d.id}
                className="cursor-pointer"
                onClick={() => router.push(href(`dossiers/${d.id}`))}
              >
                <TableCell className="pl-4">
                  <Link href={href(`dossiers/${d.id}`)} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                    {d.ref}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {DOSSIER_TYPES[d.type].short} · créé le {formatDate(d.createdAt)}
                  </div>
                  {d.refs.sinistre && <div className="text-xs text-muted-foreground">Sin. {d.refs.sinistre}</div>}
                </TableCell>
                <TableCell>
                  {d.client.firstName} {d.client.lastName}
                </TableCell>
                <TableCell>
                  <Immat value={d.vehicule.immat} />
                  <div className="mt-1 text-xs text-muted-foreground">
                    {d.vehicule.marque} {d.vehicule.modele}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    <StatusBadge status={d.status as StatusId} />
                    {isLate(d) && <LateBadge days={lateDays(d)} />}
                    {needsAssignment(d) && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-ink"><UserPlus className="size-3.5" />À assigner</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{d.compagnie?.nom ?? "—"}</TableCell>
                <TableCell>{d.intervenants.gestionnaire ? fullName(getUser(d.intervenants.gestionnaire)) : <Missing />}</TableCell>
                <TableCell>{d.intervenants.expert ? fullName(getUser(d.intervenants.expert)) : <Missing />}</TableCell>
                <TableCell className="pr-4">
                  {d.expertise.date ? (
                    <span className={d.expertise.realisee ? "text-muted-foreground" : ""}>
                      {formatDateTime(d.expertise.date)}
                      {d.expertise.realisee && <span className="block text-xs">réalisée</span>}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{rows.length} dossier(s)</p>
    </>
  )
}

function ViewCard({
  label,
  value,
  icon: Icon,
  selected,
  onClick,
  tone,
}: {
  label: string
  value: number
  icon: LucideIcon
  selected: boolean
  onClick: () => void
  tone?: "danger" | "primary"
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "group flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:border-foreground/30",
        tone === "danger" && "border-destructive/40",
        tone === "primary" && "border-brand/40",
        selected && "border-foreground ring-1 ring-foreground hover:border-foreground",
      )}
    >
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full bg-muted text-foreground",
          tone === "danger" && "bg-destructive/10 text-destructive",
          tone === "primary" && "bg-brand-soft text-brand-ink",
        )}
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block text-2xl leading-none font-bold tabular-nums",
            tone === "danger" && "text-destructive",
            tone === "primary" && "text-brand-ink",
          )}
        >
          {value}
        </span>
        <span className="mt-1 block truncate text-sm font-medium text-muted-foreground">{label}</span>
      </span>
    </button>
  )
}

function Missing() {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <CircleDashed className="size-4" />
      Non assigné
    </span>
  )
}

