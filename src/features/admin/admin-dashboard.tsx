"use client"

import Link from "next/link"
import { AlertTriangle, ArrowRight, CalendarClock, FolderOpen, UserPlus } from "lucide-react"

import { useRole } from "@/components/app-shell/role-context"
import { PageHeader } from "@/components/page-header"
import { LateBadge, StatusBadge } from "@/components/status-badge"
import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ACTOR_LABELS,
  DOSSIER_TYPES,
  USERS,
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
  const toClose = dossiers.filter((d) => d.status === "cloture")

  // Priorités : à assigner d'abord, puis retards
  const priorities: { d: Dossier; reason: "assign" | "late" }[] = [
    ...toAssign.map((d) => ({ d, reason: "assign" as const })),
    ...late.filter((d) => !needsAssignment(d)).map((d) => ({ d, reason: "late" as const })),
  ]

  const gestionnaires = USERS.filter((u) => u.role === "gestionnaire").map((g) => {
    const mine = active.filter((d) => d.intervenants.gestionnaire === g.id)
    return { g, total: mine.length, late: mine.filter(isLate).length }
  })

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
        <Kpi label="Dossiers en cours" value={active.length} icon={FolderOpen} href={href("dossiers")} />
        <Kpi label="À assigner" value={toAssign.length} icon={UserPlus} href={href("dossiers?vue=a-assigner")} tone={toAssign.length ? "primary" : undefined} />
        <Kpi label="En retard" value={late.length} icon={AlertTriangle} href={href("dossiers?vue=en-retard")} tone={late.length ? "danger" : undefined} />
        <Kpi label="Expertises sous 7 jours" value={upcoming.length} icon={CalendarClock} href={href("dossiers?vue=expertises")} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
        {/* À traiter */}
        <Card>
          <CardHeader>
            <CardTitle>À traiter en priorité</CardTitle>
            <CardDescription>Dossiers à assigner et dossiers en retard, avec l&apos;action attendue.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {priorities.length === 0 ? (
              <p className="px-6 text-sm text-muted-foreground">Rien d&apos;urgent, tout est à jour. 🎉</p>
            ) : (
              <ul className="divide-y">
                {priorities.map(({ d, reason }) => (
                  <li key={d.id}>
                    <Link
                      href={href(`dossiers/${d.id}`)}
                      className="flex flex-col gap-2 px-6 py-3 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">
                            {d.client.firstName} {d.client.lastName}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {d.vehicule.immat} · {DOSSIER_TYPES[d.type].short}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm">
                          <span className="text-muted-foreground">Prochaine action : </span>
                          {d.pilotage.prochaineAction}{" "}
                          <span className="text-muted-foreground">({ACTOR_LABELS[d.pilotage.quiDoitAgir]})</span>
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {reason === "assign" ? (
                          <span className="inline-flex h-6 items-center rounded-full bg-primary/10 px-2.5 text-xs font-medium text-primary">
                            À assigner
                          </span>
                        ) : null}
                        {isLate(d) && <LateBadge days={lateDays(d)} />}
                        <StatusBadge status={d.status} />
                        <ArrowRight className="hidden size-4 text-muted-foreground sm:block" />
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
              <CardTitle>Expertises à venir</CardTitle>
              <CardDescription>7 prochains jours</CardDescription>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune expertise programmée.</p>
              ) : (
                <ul className="space-y-3">
                  {upcoming.map((d) => (
                    <li key={d.id}>
                      <Link href={href(`dossiers/${d.id}`)} className="group flex gap-3">
                        <div className="grid w-12 shrink-0 place-items-center rounded-lg bg-muted py-1.5 text-center leading-tight">
                          <span className="text-[0.65rem] text-muted-foreground uppercase">
                            {new Date(d.expertise.date!).toLocaleDateString("fr-FR", { month: "short" })}
                          </span>
                          <span className="text-lg font-semibold">{new Date(d.expertise.date!).getDate()}</span>
                        </div>
                        <div className="min-w-0 text-sm">
                          <p className="font-medium group-hover:underline">
                            {d.client.firstName} {d.client.lastName} · {d.vehicule.immat}
                          </p>
                          <p className="text-muted-foreground first-letter:uppercase">{formatLongDate(d.expertise.date)}</p>
                          <p className="truncate text-muted-foreground">Expert : {fullName(getUser(d.intervenants.expert))}</p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Charge par gestionnaire */}
          <Card>
            <CardHeader>
              <CardTitle>Charge par gestionnaire</CardTitle>
              <CardDescription>Dossiers actifs</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {gestionnaires.map(({ g, total, late }) => (
                  <li key={g.id} className="flex items-center gap-3 text-sm">
                    <UserAvatar user={g} />
                    <span className="flex-1 truncate">{fullName(g)}</span>
                    {late > 0 && <span className="text-xs text-destructive">{late} en retard</span>}
                    <span className="w-6 text-right font-medium tabular-nums">{total}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {toClose.length > 0 && (
            <Card size="sm">
              <CardHeader>
                <CardTitle>{toClose.length} dossier(s) clôturé(s) à archiver</CardTitle>
                <CardAction>
                  <Button size="sm" variant="outline" render={<Link href={href("dossiers?vue=clotures")} />} nativeButton={false}>
                    Voir
                  </Button>
                </CardAction>
              </CardHeader>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}

function Kpi({
  label,
  value,
  icon: Icon,
  href,
  tone,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  href: string
  tone?: "danger" | "primary"
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20",
        tone === "danger" && "border-destructive/30 bg-destructive/[0.04]",
        tone === "primary" && "border-primary/30 bg-primary/[0.04]",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon
          className={cn(
            "size-4 text-muted-foreground",
            tone === "danger" && "text-destructive",
            tone === "primary" && "text-primary",
          )}
        />
      </div>
      <span
        className={cn(
          "text-3xl font-semibold tabular-nums",
          tone === "danger" && "text-destructive",
          tone === "primary" && "text-primary",
        )}
      >
        {value}
      </span>
    </Link>
  )
}
