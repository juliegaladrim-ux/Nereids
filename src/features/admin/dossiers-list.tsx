"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Plus, Search, X } from "lucide-react"

import { useRole } from "@/components/app-shell/role-context"
import { PageHeader } from "@/components/page-header"
import { SimpleSelect } from "@/components/simple-select"
import { LateBadge, StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

type View = "tous" | "a-assigner" | "en-retard" | "expertises" | "clotures"

const VIEWS: { id: View; label: string; filter: (d: Dossier) => boolean }[] = [
  { id: "tous", label: "En cours", filter: (d) => d.status !== "cloture" && d.status !== "archive" },
  { id: "a-assigner", label: "À assigner", filter: needsAssignment },
  { id: "en-retard", label: "En retard", filter: isLate },
  {
    id: "expertises",
    label: "Expertises à venir",
    filter: (d) => hasUpcomingExpertise(d, 365),
  },
  { id: "clotures", label: "Clôturés", filter: (d) => d.status === "cloture" },
]

const ALL = "__all"

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

  const base = mode === "archives" ? dossiers.filter((d) => d.status === "archive") : dossiers.filter(VIEWS.find((v) => v.id === view)!.filter)

  const rows = base
    .filter((d) => matchesSearch(d, q, (id) => fullName(getUser(id))))
    .filter((d) => type === ALL || d.type === type)
    .filter((d) => status === ALL || d.status === status)
    .filter((d) => gest === ALL || d.intervenants.gestionnaire === gest)
    .filter((d) => expert === ALL || d.intervenants.expert === expert)
    .sort((a, b) => (view === "expertises" ? (a.expertise.date ?? "").localeCompare(b.expertise.date ?? "") : b.createdAt.localeCompare(a.createdAt)))

  const counts = Object.fromEntries(VIEWS.map((v) => [v.id, dossiers.filter(v.filter).length]))
  const hasFilters = q || type !== ALL || status !== ALL || gest !== ALL || expert !== ALL

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
            ? "Dossiers archivés : hors du tableau actif, toujours consultables et téléchargeables."
            : "Tous les dossiers de la plateforme."
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
        <Tabs value={view} onValueChange={(v) => setView(v as View)} className="mb-4">
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <TabsList>
              {VIEWS.map((v) => (
                <TabsTrigger key={v.id} value={v.id} className="px-3">
                  {v.label}
                  <span className="ml-1 rounded-full bg-background/70 px-1.5 text-xs text-muted-foreground tabular-nums">
                    {counts[v.id]}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>
      )}

      {/* Recherche + filtres */}
      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative lg:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Immat., réf., client, expert…"
            className="pl-8"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex">
          <SimpleSelect
            className="lg:w-40"
            value={type}
            onChange={(v) => setType(v ?? ALL)}
            options={[{ value: ALL, label: "Tous les types" }, ...Object.entries(DOSSIER_TYPES).map(([value, t]) => ({ value, label: t.label }))]}
          />
          <SimpleSelect
            className="lg:w-44"
            value={status}
            onChange={(v) => setStatus(v ?? ALL)}
            options={[{ value: ALL, label: "Tous les statuts" }, ...Object.entries(STATUSES).map(([value, s]) => ({ value, label: s.label }))]}
          />
          <SimpleSelect
            className="lg:w-44"
            value={gest}
            onChange={(v) => setGest(v ?? ALL)}
            options={[{ value: ALL, label: "Tous gestionnaires" }, ...USERS.filter((u) => u.role === "gestionnaire").map((u) => ({ value: u.id, label: fullName(u) }))]}
          />
          <SimpleSelect
            className="lg:w-44"
            value={expert}
            onChange={(v) => setExpert(v ?? ALL)}
            options={[{ value: ALL, label: "Tous experts" }, ...USERS.filter((u) => u.role === "expert").map((u) => ({ value: u.id, label: fullName(u) }))]}
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
              setExpert(ALL)
            }}
          >
            <X /> Effacer
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
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
                  <div className="font-mono text-xs font-medium">{d.vehicule.immat}</div>
                  <div className="text-xs text-muted-foreground">
                    {d.vehicule.marque} {d.vehicule.modele}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    <StatusBadge status={d.status as StatusId} />
                    {isLate(d) && <LateBadge days={lateDays(d)} />}
                    {needsAssignment(d) && (
                      <span className="text-xs font-medium text-primary">À assigner</span>
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

function Missing() {
  return <span className="text-muted-foreground italic">Non assigné</span>
}

