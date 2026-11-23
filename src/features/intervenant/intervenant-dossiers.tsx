"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CalendarDays, ChevronRight, Search } from "lucide-react"

import { useRole } from "@/components/app-shell/role-context"
import { Immat } from "@/components/immat"
import { PageHeader } from "@/components/page-header"
import { LateBadge, StatusBadge } from "@/components/status-badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FilterPill } from "@/features/admin/dossiers-list"
import { DOSSIER_TYPES, STATUS_ORDER, STATUSES, expertisePhase, fullName, getUser, isClosedStatus, isLate, lateDays, personneName, type Dossier } from "@/lib/data"
import { dossierRights, visibleDossiers } from "@/lib/access"
import { formatDate, relativeDays } from "@/lib/format"
import { useStore } from "@/lib/store"

type View = "en_cours" | "termines"
const isClosed = (d: Dossier) => isClosedStatus(d.status)

/** Expertise à afficher : la prochaine non réalisée, sinon la dernière programmée */
const shownExpertise = (d: Dossier) => {
  const dated = [d.expertise, ...(d.autresExpertises ?? [])].filter((x) => x.date)
  return dated.find((x) => !x.realisee) ?? dated.at(-1)
}
const expertiseDay = (iso: string) => {
  const t = new Date(iso)
  return `${t.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} · ${t.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
}

/**
 * Liste en tableau des intervenants extérieurs :
 * - suiveur (avocat, protection juridique) : « Dossiers suivis », retrouvés par sa propre référence ou le nom du client ;
 * - réparateur : « Mes dossiers », avec l'action qu'il doit réaliser et un filtre par statut (parcours réparateur) ;
 * - expert : idem, dates d'expertise en évidence et filtre par statut (CDC §12.3, parcours FigJam).
 */
export function IntervenantDossiers() {
  const { role, user, href } = useRole()
  const { dossiers } = useStore()
  const router = useRouter()
  const rights = dossierRights(role.id, user.id)
  // Réparateur et expert : date d'expertise, action attendue et filtre par statut
  const isRep = role.id === "reparateur" || role.id === "expert"
  const title = role.nav.find((n) => n.path === "dossiers")?.label ?? "Dossiers"
  const [view, setView] = React.useState<View>("en_cours")
  const [q, setQ] = React.useState("")
  const [status, setStatus] = React.useState<string[]>([])

  const all = visibleDossiers(dossiers, role.id, user.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const counts = { en_cours: all.filter((d) => !isClosed(d)).length, termines: all.filter(isClosed).length }
  const inView = all.filter((d) => (view === "termines" ? isClosed(d) : !isClosed(d)))
  // Statuts proposés : ceux présents dans l'onglet affiché
  const statusOptions = STATUS_ORDER.filter((s) => inView.some((d) => d.status === s)).map((s) => ({ value: s, label: STATUSES[s].label }))
  const s = q.trim().toLowerCase()
  const rows = inView
    .filter((d) => !status.length || status.includes(d.status))
    .filter(
      (d) =>
        !s ||
        [d.ref, d.suiveurRefs?.[user.id], d.refs.sinistre, d.vehicule.immat, d.vehicule.immat.replace(/-/g, ""), d.client.firstName, d.client.lastName, d.client.societe]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(s),
    )

  /** Action attendue de l'intervenant connecté (sinon rien : les délais des autres ne le concernent pas) */
  const todo = (d: Dossier) => {
    if (isClosed(d)) return null
    // Parcours expertise : l'expert n'agit qu'une fois la mission signée (pré-étude), puis attend la convocation
    const phase = role.id === "expert" ? expertisePhase(d) : null
    if (phase) return phase === "pre_etude" ? "Réaliser la pré-étude" : null
    return d.pilotage.quiDoitAgir === role.id ? d.pilotage.prochaineAction : null
  }

  /** Dernier élément du suivi visible par l'intervenant (ses actions techniques, comme l'activation du compte, n'en sont pas) */
  const lastActivity = (d: Dossier) => {
    const e = [...d.timeline]
      .filter((x) => rights.canSeeEvent(x) && !(x.author === user.id && x.kind === "system"))
      .sort((a, b) => b.at.localeCompare(a.at))[0]
    if (!e) return null
    const author = e.author === "system" ? undefined : getUser(e.author)
    const title = e.kind === "message" ? `Message de ${author?.role === "admin" ? "Nereids" : fullName(author)}` : e.title
    return { title, at: e.at, mine: e.author === user.id }
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader title={title} description={`${user.structure} · ${all.length} dossier${all.length > 1 ? "s" : ""}`} />

      <Tabs
        value={view}
        onValueChange={(v) => {
          setView(v as View)
          setStatus([])
        }}
        className="mb-3"
      >
        <TabsList variant="line">
          {(
            [
              ["en_cours", "En cours"],
              ["termines", "Terminés"],
            ] as const
          ).map(([id, label]) => (
            <TabsTrigger key={id} value={id} className="px-3">
              {label}
              <span className="ml-1 rounded-full bg-muted px-1.5 text-xs text-muted-foreground tabular-nums group-data-[variant=default]/tabs-list:in-data-active:bg-card group-data-[variant=default]/tabs-list:in-data-active:text-brand-ink">
                {counts[id]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Recherche (et filtre statut pour le réparateur) dans une barre blanche */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2.5">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={rights.ownRef ? "Ma réf., réf. dossier, client, immat.…" : "Client, réf. dossier, immat.…"}
            className="h-8 rounded-full pl-9"
          />
        </div>
        {isRep && statusOptions.length > 1 && <FilterPill label="Statut" value={status} onChange={setStatus} options={statusOptions} />}
      </div>

      {rows.length === 0 && (
        <p className="rounded-xl border bg-card py-10 text-center text-muted-foreground">
          {s || status.length ? "Aucun dossier ne correspond à cette recherche." : view === "termines" ? "Aucun dossier terminé." : "Aucun dossier en cours."}
        </p>
      )}

      {/* Ordinateur : tableau */}
      {rows.length > 0 && (
        <div className="hidden overflow-hidden rounded-xl border bg-card lg:block">
          <p className="px-4 py-3 text-xs text-muted-foreground">
            {rows.length} dossier{rows.length > 1 ? "s" : ""}
          </p>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Client</TableHead>
                {rights.ownRef && <TableHead>Ma référence</TableHead>}
                <TableHead>Dossier Nereids</TableHead>
                <TableHead>Statut</TableHead>
                {isRep && <TableHead>Expertise</TableHead>}
                {isRep && <TableHead>Action attendue</TableHead>}
                <TableHead className="pr-4">Dernière activité</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((d) => {
                const last = lastActivity(d)
                const action = todo(d)
                const exp = shownExpertise(d)
                return (
                  <TableRow key={d.id} className="cursor-pointer" onClick={() => router.push(href(`dossiers/${d.id}`))}>
                    <TableCell className="pl-4">
                      <Link href={href(`dossiers/${d.id}`)} className="font-semibold text-brand-ink hover:underline" onClick={(e) => e.stopPropagation()}>
                        {personneName(d.client)}
                      </Link>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <Immat value={d.vehicule.immat} />
                        {d.vehicule.marque} {d.vehicule.modele}
                      </div>
                    </TableCell>
                    {rights.ownRef && (
                      <TableCell className="font-medium">{d.suiveurRefs?.[user.id] ?? <span className="font-normal text-muted-foreground">—</span>}</TableCell>
                    )}
                    <TableCell>
                      <div>{d.ref}</div>
                      <div className="text-xs text-muted-foreground">{DOSSIER_TYPES[d.type].label}</div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={d.status} />
                    </TableCell>
                    {isRep && (
                      <TableCell>
                        {exp?.date ? (
                          <>
                            <div className="font-medium whitespace-nowrap first-letter:uppercase">{expertiseDay(exp.date)}</div>
                            <div className="text-xs text-muted-foreground">{exp.realisee ? "Réalisée" : relativeDays(exp.date)}</div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">Non programmée</span>
                        )}
                      </TableCell>
                    )}
                    {isRep && (
                      <TableCell>
                        {action ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center gap-2 rounded-md bg-brand-soft px-2.5 py-1 text-sm font-semibold text-brand-ink">
                              <span className="size-1.5 rounded-full bg-brand" />
                              {action}
                            </span>
                            {isLate(d) && <LateBadge days={lateDays(d)} />}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="pr-4">
                      {last ? (
                        <>
                          <div className="max-w-64 truncate">{last.mine ? `${last.title} (vous)` : last.title}</div>
                          <div className="text-xs text-muted-foreground">{formatDate(last.at)}</div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Mobile : une carte par dossier */}
      <ul className="flex flex-col gap-3 lg:hidden">
        {rows.map((d) => {
          const last = lastActivity(d)
          const action = isRep ? todo(d) : null
          const exp = isRep ? shownExpertise(d) : undefined
          return (
            <li key={d.id}>
              <Link href={href(`dossiers/${d.id}`)} className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-brand/50">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="font-semibold">
                      {personneName(d.client)}
                    </p>
                    <Immat value={d.vehicule.immat} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {d.suiveurRefs?.[user.id] ? `Ma réf. ${d.suiveurRefs[user.id]} · ` : ""}
                    {d.ref}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={d.status} />
                    {action && isLate(d) && <LateBadge days={lateDays(d)} />}
                  </div>
                  {isRep && (
                    <p className="mt-2 flex items-center gap-1.5 text-sm">
                      <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
                      {exp?.date ? (
                        <>
                          <span className="font-medium first-letter:uppercase">Expertise {expertiseDay(exp.date)}</span>
                          <span className="text-muted-foreground">· {exp.realisee ? "réalisée" : relativeDays(exp.date)}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Expertise non programmée</span>
                      )}
                    </p>
                  )}
                  {action && (
                    <p className="mt-3 inline-flex items-center gap-2 rounded-md bg-brand-soft px-2.5 py-1 text-sm font-semibold text-brand-ink">
                      <span className="size-1.5 rounded-full bg-brand" />À faire : {action}
                    </p>
                  )}
                  {last && (
                    <p className="mt-2 truncate text-sm text-muted-foreground">
                      {last.mine ? `${last.title} (vous)` : last.title} · {formatDate(last.at)}
                    </p>
                  )}
                </div>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
