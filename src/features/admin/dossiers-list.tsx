"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { AlertTriangle, CalendarClock, ChevronDown, CircleCheck, CircleDashed, FolderOpen, Plus, Search, UserPlus, X, type LucideIcon } from "lucide-react"

import { useRole } from "@/components/app-shell/role-context"
import { Immat } from "@/components/immat"
import { PageHeader } from "@/components/page-header"
import { AbonnementBadge, LateBadge, StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DOSSIER_TYPES,
  STATUSES,
  USERS,
  dossierCategory,
  dossierDepartement,
  fullName,
  getUser,
  hasUpcomingExpertise,
  isLate,
  lateDays,
  needsAssignment,
  personneName,
  type Dossier,
  type StatusId,
  isClosedStatus,
} from "@/lib/data"
import { matchesSearch, visibleDossiers } from "@/lib/access"
import { dossierCabinet, useAnnuaire } from "@/lib/annuaire"
import { formatDate, formatDateTime } from "@/lib/format"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"

type View = "tous" | "a-assigner" | "en-retard" | "expertises" | "clotures"

const VIEWS: { id: View; label: string; icon: LucideIcon; tone?: "primary" | "danger"; filter: (d: Dossier) => boolean }[] = [
  { id: "tous", label: "En cours", icon: FolderOpen, filter: (d) => !isClosedStatus(d.status) },
  { id: "a-assigner", label: "À assigner", icon: UserPlus, tone: "primary", filter: needsAssignment },
  { id: "en-retard", label: "En retard", icon: AlertTriangle, tone: "danger", filter: isLate },
  {
    id: "expertises",
    label: "Expertises à venir",
    icon: CalendarClock,
    filter: (d) => hasUpcomingExpertise(d, 365),
  },
  { id: "clotures", label: "Clôturés", icon: CircleCheck, filter: (d) => d.status === "cloture" || d.status === "annule" || d.status === "refuse" },
]

const EXPERTS = USERS.filter((u) => u.role === "expert")
/** Un cabinet = un groupe d'experts (structure de l'expert) */
const CABINETS = [...new Set(EXPERTS.map((u) => u.structure))].sort()

export function DossiersList({ mode = "actifs" }: { mode?: "actifs" | "archives" }) {
  const { href, role, user } = useRole()
  const { dossiers: all } = useStore()
  const { orgs } = useAnnuaire()
  // Gestionnaire Help You : uniquement ses dossiers (CDC §12.2), sans colonne ni filtre gestionnaire
  const dossiers = visibleDossiers(all, role.id, user.id)
  const isGest = role.id === "gestionnaire"
  const views = VIEWS
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const view = (params.get("vue") as View) || "tous"
  const [q, setQ] = React.useState("")
  const [type, setType] = React.useState<string[]>([])
  const [status, setStatus] = React.useState<string[]>([])
  const [gest, setGest] = React.useState<string[]>([])
  const [expert, setExpert] = React.useState<string[]>([])
  const [cabinet, setCabinet] = React.useState<string[]>([])
  const [rep, setRep] = React.useState<string[]>([])

  // Le cabinet restreint la liste des experts proposés
  const cabinetExperts = EXPERTS.filter((u) => cabinet.length === 0 || cabinet.includes(u.structure))

  const base = mode === "archives" ? dossiers.filter((d) => d.status === "archive") : dossiers.filter(VIEWS.find((v) => v.id === view)!.filter)

  const rows = base
    .filter((d) => matchesSearch(d, q, (id) => fullName(getUser(id))))
    .filter((d) => type.length === 0 || type.includes(d.type))
    .filter((d) => status.length === 0 || status.includes(d.status))
    .filter((d) => gest.length === 0 || gest.includes(d.intervenants.gestionnaire ?? ""))
    .filter((d) => cabinet.length === 0 || cabinetExperts.some((u) => u.id === d.intervenants.expert))
    .filter((d) => expert.length === 0 || expert.includes(d.intervenants.expert ?? ""))
    .filter((d) => rep.length === 0 || rep.includes(d.intervenants.reparateur ?? ""))
    .sort((a, b) => (view === "expertises" ? (a.expertise.date ?? "").localeCompare(b.expertise.date ?? "") : b.createdAt.localeCompare(a.createdAt)))

  const counts = Object.fromEntries(views.map((v) => [v.id, dossiers.filter(v.filter).length]))
  const hasFilters = q || [type, status, gest, cabinet, expert, rep].some((f) => f.length > 0)

  function setView(v: View) {
    const p = new URLSearchParams(params)
    if (v === "tous") p.delete("vue")
    else p.set("vue", v)
    router.replace(`${pathname}${p.size ? `?${p}` : ""}`)
  }

  return (
    <>
      <PageHeader
        title={mode === "archives" ? "Archives" : isGest ? "Mes dossiers" : "Dossiers"}
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
        <div className={cn("mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3", "xl:grid-cols-5")}>
          {views.map((v) => (
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

      {/* Recherche + filtres : pastilles dans une barre blanche */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2.5">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Immat., réf., client, expert…"
            className="h-8 rounded-full pl-9"
          />
        </div>
        <FilterPill
          value={type}
          onChange={setType}
          label="Type"
          options={[...Object.entries(DOSSIER_TYPES).map(([value, t]) => ({ value, label: t.label }))]}
        />
        <FilterPill
          value={status}
          onChange={setStatus}
          label="Statut"
          options={[...Object.entries(STATUSES).map(([value, s]) => ({ value, label: s.label }))]}
        />
        {!isGest && (
          <FilterPill
            value={gest}
            onChange={setGest}
            label="Gestionnaire"
            options={[...USERS.filter((u) => u.role === "gestionnaire").map((u) => ({ value: u.id, label: fullName(u) }))]}
          />
        )}
        <FilterPill
          value={cabinet}
          onChange={(c) => {
            setCabinet(c)
            // L'expert choisi n'appartient plus au cabinet : on le retire
            if (c.length > 0) setExpert((ex) => ex.filter((id) => c.includes(getUser(id)?.structure ?? "")))
          }}
          label="Cabinet"
          options={[...CABINETS.map((c) => ({ value: c, label: c }))]}
        />
        <FilterPill
          value={expert}
          onChange={setExpert}
          label="Expert"
          options={[...cabinetExperts.map((u) => ({ value: u.id, label: fullName(u) }))]}
        />
        <FilterPill
          value={rep}
          onChange={setRep}
          label="Réparateur"
          options={[...USERS.filter((u) => u.role === "reparateur").map((u) => ({ value: u.id, label: u.structure }))]}
        />
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => {
              setQ("")
              setType([])
              setStatus([])
              setGest([])
              setCabinet([])
              setExpert([])
              setRep([])
            }}
          >
            <X /> Effacer
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Dossier</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Véhicule</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Département</TableHead>
              <TableHead>Statut</TableHead>
              {!isGest && <TableHead>Gestionnaire</TableHead>}
              <TableHead>Cabinet</TableHead>
              <TableHead>Expert</TableHead>
              <TableHead className="pr-4">Expertise prévue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={isGest ? 9 : 10} className="py-10 text-center text-muted-foreground">
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
                  <Link href={href(`dossiers/${d.id}`)} className="font-semibold text-brand-ink hover:underline" onClick={(e) => e.stopPropagation()}>
                    {d.ref}
                  </Link>
                  <div className="text-xs text-muted-foreground">créé le {formatDate(d.createdAt)}</div>
                  {d.refs.sinistre && <div className="text-xs text-muted-foreground">Sin. {d.refs.sinistre}</div>}
                </TableCell>
                <TableCell>{personneName(d.client)}</TableCell>
                <TableCell>
                  <Immat value={d.vehicule.immat} />
                  <div className="mt-1 text-xs text-muted-foreground">
                    {d.vehicule.marque} {d.vehicule.modele}
                  </div>
                </TableCell>
                <TableCell className="max-w-48 whitespace-normal">
                  {dossierCategory(d).type}
                  {dossierCategory(d).detail && <div className="text-xs text-muted-foreground">{dossierCategory(d).detail}</div>}
                </TableCell>
                <TableCell className="max-w-40 whitespace-normal">{dossierDepartement(d) ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    <StatusBadge status={d.status as StatusId} />
                    {isLate(d) && <LateBadge days={lateDays(d)} />}
                    {needsAssignment(d) && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-ink"><UserPlus className="size-3.5" />À assigner</span>
                    )}
                  </div>
                </TableCell>
                {!isGest && <TableCell>{d.intervenants.gestionnaire ? fullName(getUser(d.intervenants.gestionnaire)) : <Missing />}</TableCell>}
                <TableCell className="max-w-48 whitespace-normal">
                  {(() => {
                    // Cabinet de l'expert et abonnement souscrit, repris de sa fiche annuaire
                    const cab = dossierCabinet(d, orgs)
                    if (!cab) return <span className="text-muted-foreground">—</span>
                    return (
                      <span className="flex items-center gap-2">
                        {cab.nom}
                        <AbonnementBadge abonnement={cab.abonnement} />
                      </span>
                    )
                  })()}
                </TableCell>
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
        "flex cursor-pointer flex-col gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:border-foreground/30",
        selected && "border-foreground ring-1 ring-foreground hover:border-foreground",
      )}
    >
      <span
        className={cn(
          "flex items-center gap-1.5 text-sm font-medium text-muted-foreground",
          tone === "danger" && "text-destructive",
          tone === "primary" && "text-brand-ink",
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      <span className="text-[28px] leading-none font-bold tabular-nums">{value}</span>
    </button>
  )
}

/** Filtre en pastille multi-sélection : le libellé reste affiché, une bulle indique le nombre de valeurs cochées */
export function FilterPill({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string[]
  onChange: (v: string[]) => void
  options: { value: string; label: string }[]
}) {
  const toggle = (v: string, checked: boolean) => onChange(checked ? [...value, v] : value.filter((x) => x !== v))
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-full border border-input bg-card pr-2.5 pl-3 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
          value.length > 0 && "border-foreground font-medium"
        )}
      >
        {label}
        {value.length > 0 && (
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-foreground text-[0.7rem] font-semibold text-background tabular-nums">
            {value.length}
          </span>
        )}
        <ChevronDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-auto min-w-48">
        {options.map((o) => (
          <DropdownMenuCheckboxItem key={o.value} checked={value.includes(o.value)} onCheckedChange={(c) => toggle(o.value, c)}>
            {o.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
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

