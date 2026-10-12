"use client"

import Link from "next/link"
import { useState } from "react"
import { AlertTriangle, ArrowRight, CalendarClock, ChevronRight, FolderOpen, Zap, UserPlus, X } from "lucide-react"

import { useRole } from "@/components/app-shell/role-context"
import { Immat } from "@/components/immat"
import { PageHeader } from "@/components/page-header"
import { LateBadge, StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ACTOR_LABELS,
  DOSSIER_TYPES,
  fullName,
  getUser,
  hasUpcomingExpertise,
  isLate,
  lateDays,
  needsAssignment,
  type Dossier,
} from "@/lib/data"
import { formatLongDate } from "@/lib/format"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"

export function AdminDashboard() {
  const { user, href } = useRole()
  const { dossiers } = useStore()

  const active = dossiers.filter((d) => d.status !== "cloture" && d.status !== "archive")
  const toAssign = active.filter(needsAssignment)
  const late = active.filter(isLate).sort((a, b) => lateDays(b) - lateDays(a))
  const upcoming = active
    .filter((d) => hasUpcomingExpertise(d, 7))
    .sort((a, b) => a.expertise.date!.localeCompare(b.expertise.date!))

  // Priorités : à assigner d'abord, puis retards
  const priorities: Dossier[] = [...toAssign, ...late.filter((d) => !needsAssignment(d))]

  // Les KPI filtrent la liste principale (re-clic = retour aux priorités)
  const [filter, setFilter] = useState<Filter | null>(null)
  const toggle = (f: Filter) => setFilter((cur) => (cur === f ? null : f))
  const views: Record<Filter, { title: string; list: Dossier[]; vue: string; empty: string }> = {
    active: { title: "Dossiers en cours", list: active, vue: "", empty: "Aucun dossier en cours." },
    assign: { title: "À assigner", list: toAssign, vue: "a-assigner", empty: "Tous les dossiers sont assignés." },
    late: { title: "En retard", list: late, vue: "en-retard", empty: "Aucun dossier en retard." },
    upcoming: { title: "Expertises à 7 jours", list: upcoming, vue: "expertises", empty: "Aucune expertise programmée." },
  }
  const view = filter ? views[filter] : null
  const list = view ? view.list : priorities

  return (
    <>
      <PageHeader
        title={`Bonjour ${user.firstName}`}
        description={new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        actions={
          <Button variant="outline" render={<Link href={href("dossiers")} />} nativeButton={false}>
            Tous les dossiers
          </Button>
        }
      />

      {/* Indicateurs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Dossiers en cours" value={active.length} icon={FolderOpen} selected={filter === "active"} onClick={() => toggle("active")} />
        <Kpi label="À assigner" value={toAssign.length} icon={UserPlus} selected={filter === "assign"} onClick={() => toggle("assign")} tone={toAssign.length ? "primary" : undefined} />
        <Kpi label="En retard" value={late.length} icon={AlertTriangle} selected={filter === "late"} onClick={() => toggle("late")} tone={late.length ? "danger" : undefined} />
        <Kpi label="Expertises à 7 j" value={upcoming.length} icon={CalendarClock} selected={filter === "upcoming"} onClick={() => toggle("upcoming")} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
        {/* À traiter */}
        <Card>
          <CardHeader>
            <CardTitle>
              <Zap />
              {view ? view.title : "À traiter en priorité"}
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums">{list.length}</span>
            </CardTitle>
            {view && (
              <CardAction className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => setFilter(null)}>
                  <X /> Retirer le filtre
                </Button>
                <Button size="sm" variant="outline" render={<Link href={href(view.vue ? `dossiers?vue=${view.vue}` : "dossiers")} />} nativeButton={false}>
                  Ouvrir dans Dossiers
                </Button>
              </CardAction>
            )}
          </CardHeader>
          <CardContent className="px-0">
            {list.length === 0 ? (
              <p className="px-5 text-sm text-muted-foreground">{view ? view.empty : "Rien d'urgent, tout est à jour. 🎉"}</p>
            ) : (
              <ul className="divide-y">
                {list.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={href(`dossiers/${d.id}`)}
                      className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-muted/60 sm:flex-row sm:items-center sm:gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">
                            {d.client.firstName} {d.client.lastName}
                          </span>
                          <Immat value={d.vehicule.immat} />
                          <span className="text-sm text-muted-foreground">{DOSSIER_TYPES[d.type].short}</span>
                        </div>
                        <p className="mt-1.5 flex items-center gap-1.5 text-sm">
                          <ArrowRight className="size-3.5 shrink-0 text-brand-ink" />
                          <span className="font-medium">{d.pilotage.prochaineAction}</span>
                          <span className="text-muted-foreground">· {ACTOR_LABELS[d.pilotage.quiDoitAgir]}</span>
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {filter === "upcoming" && d.expertise.date && (
                          <span className="inline-flex h-6 items-center gap-1 rounded-full bg-muted px-2.5 text-xs font-semibold first-letter:uppercase">
                            <CalendarClock className="size-3.5" />
                            {formatLongDate(d.expertise.date)}
                          </span>
                        )}
                        {needsAssignment(d) ? (
                          <span className="inline-flex h-6 items-center gap-1 rounded-full bg-brand-soft px-2.5 text-xs font-semibold text-brand-ink">
                            <UserPlus className="size-3.5" />
                            À assigner
                          </span>
                        ) : null}
                        {isLate(d) && <LateBadge days={lateDays(d)} />}
                        <StatusBadge status={d.status} />
                        <ChevronRight className="hidden size-4 text-muted-foreground sm:block" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          {/* Expertises à venir */}
          <Card>
            <CardHeader>
              <CardTitle>
                <CalendarClock />
                Expertises · 7 jours
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune expertise programmée.</p>
              ) : (
                <ul className="space-y-3">
                  {upcoming.map((d) => (
                    <li key={d.id}>
                      <Link href={href(`dossiers/${d.id}`)} className="group flex gap-3">
                        <div className="grid w-12 shrink-0 place-items-center rounded-lg bg-brand-soft py-1.5 text-brand-ink text-center leading-tight">
                          <span className="text-[0.65rem] font-semibold uppercase">
                            {new Date(d.expertise.date!).toLocaleDateString("fr-FR", { month: "short" })}
                          </span>
                          <span className="text-lg font-bold">{new Date(d.expertise.date!).getDate()}</span>
                        </div>
                        <div className="min-w-0 text-sm">
                          <p className="font-semibold group-hover:text-brand-ink">
                            {d.client.firstName} {d.client.lastName}
                          </p>
                          <p className="text-muted-foreground first-letter:uppercase">{formatLongDate(d.expertise.date)}</p>
                          <p className="truncate text-muted-foreground">{fullName(getUser(d.intervenants.expert))}</p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

type Filter = "active" | "assign" | "late" | "upcoming"

function Kpi({
  label,
  value,
  icon: Icon,
  selected,
  onClick,
  tone,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
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
        "group flex cursor-pointer items-center gap-4 rounded-xl border bg-card p-5 text-left transition-colors hover:border-foreground/30",
        tone === "danger" && "border-destructive/40",
        tone === "primary" && "border-brand/40",
        selected && "border-foreground ring-1 ring-foreground hover:border-foreground",
      )}
    >
      <span
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-full bg-muted text-foreground",
          tone === "danger" && "bg-destructive/10 text-destructive",
          tone === "primary" && "bg-brand-soft text-brand-ink",
        )}
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block text-3xl leading-none font-bold tabular-nums",
            tone === "danger" && "text-destructive",
            tone === "primary" && "text-brand-ink",
          )}
        >
          {value}
        </span>
        <span className="mt-1.5 block truncate text-sm font-medium text-muted-foreground">{label}</span>
      </span>
    </button>
  )
}
