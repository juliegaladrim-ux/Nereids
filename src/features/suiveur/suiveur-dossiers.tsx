"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronRight, Search } from "lucide-react"

import { useRole } from "@/components/app-shell/role-context"
import { Immat } from "@/components/immat"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DOSSIER_TYPES, fullName, getUser, type Dossier } from "@/lib/data"
import { dossierRights, visibleDossiers } from "@/lib/access"
import { formatDate } from "@/lib/format"
import { useStore } from "@/lib/store"

type View = "en_cours" | "termines"
const isClosed = (d: Dossier) => d.status === "cloture" || d.status === "archive"

/**
 * « Dossiers suivis » de l'intervenant suiveur (avocat, protection juridique) :
 * il retrouve ses dossiers par sa propre référence ou le nom du client.
 */
export function SuiveurDossiers() {
  const { role, user, href } = useRole()
  const { dossiers } = useStore()
  const router = useRouter()
  const rights = dossierRights(role.id, user.id)
  const [view, setView] = React.useState<View>("en_cours")
  const [q, setQ] = React.useState("")

  const all = visibleDossiers(dossiers, role.id, user.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const counts = { en_cours: all.filter((d) => !isClosed(d)).length, termines: all.filter(isClosed).length }
  const s = q.trim().toLowerCase()
  const rows = all
    .filter((d) => (view === "termines" ? isClosed(d) : !isClosed(d)))
    .filter(
      (d) =>
        !s ||
        [d.ref, d.suiveurRefs?.[user.id], d.refs.sinistre, d.vehicule.immat, d.vehicule.immat.replace(/-/g, ""), d.client.firstName, d.client.lastName]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(s),
    )

  /** Dernier élément du suivi visible par le suiveur (ses actions techniques, comme l'activation du compte, n'en sont pas) */
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
      <PageHeader title="Dossiers suivis" description={`${user.structure} · ${all.length} dossier${all.length > 1 ? "s" : ""}`} />

      <Tabs value={view} onValueChange={(v) => setView(v as View)} className="mb-3">
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

      {/* Recherche dans une barre blanche */}
      <div className="mb-3 rounded-xl border bg-card p-2.5">
        <div className="relative sm:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ma réf., réf. dossier, client, immat.…" className="h-8 rounded-full pl-9" />
        </div>
      </div>

      {rows.length === 0 && (
        <p className="rounded-xl border bg-card py-10 text-center text-muted-foreground">
          {s ? "Aucun dossier ne correspond à cette recherche." : view === "termines" ? "Aucun dossier terminé." : "Aucun dossier en cours."}
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
                <TableHead>Ma référence</TableHead>
                <TableHead>Dossier Nereids</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="pr-4">Dernière activité</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((d) => {
                const last = lastActivity(d)
                return (
                  <TableRow key={d.id} className="cursor-pointer" onClick={() => router.push(href(`dossiers/${d.id}`))}>
                    <TableCell className="pl-4">
                      <Link href={href(`dossiers/${d.id}`)} className="font-semibold text-brand-ink hover:underline" onClick={(e) => e.stopPropagation()}>
                        {d.client.firstName} {d.client.lastName}
                      </Link>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <Immat value={d.vehicule.immat} />
                        {d.vehicule.marque} {d.vehicule.modele}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{d.suiveurRefs?.[user.id] ?? <span className="font-normal text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      <div>{d.ref}</div>
                      <div className="text-xs text-muted-foreground">{DOSSIER_TYPES[d.type].label}</div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={d.status} />
                    </TableCell>
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
          return (
            <li key={d.id}>
              <Link href={href(`dossiers/${d.id}`)} className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-brand/50">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="font-semibold">
                      {d.client.firstName} {d.client.lastName}
                    </p>
                    <Immat value={d.vehicule.immat} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {d.suiveurRefs?.[user.id] ? `Ma réf. ${d.suiveurRefs[user.id]} · ` : ""}
                    {d.ref}
                  </p>
                  <div className="mt-2">
                    <StatusBadge status={d.status} />
                  </div>
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
