"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { useRole } from "@/components/app-shell/role-context"
import { Immat } from "@/components/immat"
import { PageHeader } from "@/components/page-header"
import { isClosedStatus, type Dossier } from "@/lib/data"
import { visibleDossiers } from "@/lib/access"
import { formatDate } from "@/lib/format"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { CLIENT_STEPS, clientDocsStatus, clientTypeLabel } from "./client-docs"

const isClosed = (d: Dossier) => isClosedStatus(d.status)

/** « Mes dossiers » du client : en cours puis terminés, une carte par dossier */
export function ClientDossiers() {
  const { role, user } = useRole()
  const { dossiers } = useStore()
  const list = visibleDossiers(dossiers, role.id, user.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const groups = [
    { title: "En cours", items: list.filter((d) => !isClosed(d)) },
    { title: "Terminés", items: list.filter(isClosed) },
  ].filter((g) => g.items.length)

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader title="Mes dossiers" description={`${list.length} dossier${list.length > 1 ? "s" : ""}`} />
      {list.length === 0 && <p className="py-10 text-center text-muted-foreground">Aucun dossier pour le moment.</p>}
      <div className="flex flex-col gap-8">
        {groups.map((g) => (
          <section key={g.title}>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
              {g.title} <span className="font-normal tabular-nums">· {g.items.length}</span>
            </h2>
            <ul className="flex flex-col gap-3">
              {g.items.map((d) => (
                <li key={d.id}>
                  <DossierCard d={d} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}

function DossierCard({ d }: { d: Dossier }) {
  const { href } = useRole()
  const closed = isClosed(d)
  const stepIndex = Math.max(0, CLIENT_STEPS.findIndex((s) => s.statuses.includes(d.status)))
  const step = CLIENT_STEPS[stepIndex]
  const { missing } = clientDocsStatus(d)
  const submitted = !!d.clientAccess?.submittedAt

  // Ce que le client doit faire, s'il y a quelque chose à faire
  const todo = closed
    ? null
    : !submitted
      ? "Dossier à compléter"
      : d.pilotage.quiDoitAgir === "client"
        ? d.pilotage.prochaineAction
        : missing.length
          ? `${missing.length} document${missing.length > 1 ? "s" : ""} à ajouter`
          : null

  return (
    <Link
      href={href(`dossiers/${d.id}`)}
      className={cn(
        "group flex items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:border-brand/50 sm:p-5",
        todo && "border-brand/30",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <p className="font-semibold">
            {d.vehicule.marque} {d.vehicule.modele}
          </p>
          <Immat value={d.vehicule.immat} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {clientTypeLabel(d)} · <span className="whitespace-nowrap">{d.ref}</span>
        </p>

        {/* Progression en 5 étapes, version compacte */}
        <div className="mt-3 flex items-center gap-3">
          <div className="flex gap-1" aria-hidden>
            {CLIENT_STEPS.map((s, i) => (
              <span key={s.label} className={cn("h-1.5 w-6 rounded-full sm:w-8", i <= stepIndex ? "bg-brand" : "bg-border")} />
            ))}
          </div>
          <span className="text-sm font-medium">
            {closed ? `Terminé le ${formatDate(d.cloture?.at ?? d.updatedAt)}` : `Étape ${stepIndex + 1}/${CLIENT_STEPS.length} · ${step.label}`}
          </span>
        </div>

        {todo ? (
          <p className="mt-3 inline-flex items-center gap-2 rounded-md bg-brand-soft px-2.5 py-1 text-sm font-semibold text-brand-ink">
            <span className="size-1.5 rounded-full bg-brand" />À faire : {todo}
          </p>
        ) : (
          !closed && <p className="mt-3 text-sm text-muted-foreground">Rien à faire de votre côté · mis à jour le {formatDate(d.updatedAt)}</p>
        )}
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand-ink" />
    </Link>
  )
}
