"use client"

import Link from "next/link"
import { ArrowRight, Camera, Check, CircleAlert, Hourglass, Mail } from "lucide-react"

import { useRole } from "@/components/app-shell/role-context"
import { Immat } from "@/components/immat"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { DOC_CATEGORIES, WORKFLOW_STEPS, type Dossier, type StatusId } from "@/lib/data"
import { visibleDossiers } from "@/lib/access"
import { formatDate } from "@/lib/format"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { CLIENT_DOC_COPY, clientDocsStatus, clientTypeLabel } from "./client-docs"

/** Où en est le dossier, en mots simples pour un particulier */
const CLIENT_STATUS_TEXT: Partial<Record<StatusId, string>> = {
  nouveau: "Nereids vérifie votre dossier et va le confier à un expert.",
  en_etude: "Un expert étudie votre dossier.",
  recours_valide: "Votre recours est validé. Nereids prépare la suite.",
  attente_client: "Nereids attend des informations de votre part.",
  attente_expertise: "L'expertise de votre véhicule est programmée.",
  attente_pv: "L'expertise a eu lieu, l'expert rédige son compte rendu.",
  attente_rapport: "L'expert rédige son rapport.",
  attente_reparation: "Votre véhicule est en réparation.",
  cloture: "Votre dossier est terminé.",
}

export function ClientHome() {
  const { role, user } = useRole()
  const { dossiers } = useStore()
  const list = visibleDossiers(dossiers, role.id, user.id)

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader title={`Bonjour ${user.firstName}`} description={list.length > 1 ? "Vos dossiers" : "Votre dossier"} />
      <div className="flex flex-col gap-6">
        {list.map((d) => (
          <ClientDossier key={d.id} d={d} />
        ))}
      </div>
    </div>
  )
}

function ClientDossier({ d }: { d: Dossier }) {
  const { missing, expected } = clientDocsStatus(d)
  const submitted = !!d.clientAccess?.submittedAt
  const activated = !!d.clientAccess?.activatedAt
  const steps = WORKFLOW_STEPS[d.type]
  const current = steps.findIndex((s) => s.statuses.includes(d.status))

  return (
    <article className="overflow-hidden rounded-xl border bg-card">
      {/* En-tête : véhicule + statut */}
      <div className="flex flex-col gap-2 border-b px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-lg font-semibold">
            {d.vehicule.marque} {d.vehicule.modele}
          </p>
          <StatusBadge status={d.status} className="mt-0.5" />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Immat value={d.vehicule.immat} />
          <span className="text-sm text-muted-foreground">
            {clientTypeLabel(d)} · <span className="whitespace-nowrap">{d.ref}</span>
          </span>
        </div>
      </div>

      <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* À faire */}
          {!submitted ? (
            <TodoCard
              icon={<Mail />}
              title="Complétez votre dossier"
              text="Vérifiez vos informations et envoyez vos documents pour que l'étude puisse commencer."
              cta="Compléter mon dossier"
              href={`/activation/${d.id}${activated ? "?etape=infos" : ""}`}
            />
          ) : missing.length > 0 ? (
            <TodoCard
              icon={<Camera />}
              title={`${missing.length} document${missing.length > 1 ? "s" : ""} à ajouter`}
              text={missing.map((c) => CLIENT_DOC_COPY[c]?.label ?? DOC_CATEGORIES[c]).join(", ")}
              cta="Ajouter mes documents"
              href={`/activation/${d.id}?etape=pieces`}
            />
          ) : (
            <div className="flex gap-3 rounded-lg bg-muted p-4">
              <Check className="mt-0.5 size-5 shrink-0 text-tone-done" />
              <div>
                <p className="font-semibold">Rien à faire pour le moment</p>
                <p className="text-[15px] text-muted-foreground">Vous serez prévenu par e-mail dès que nous aurons besoin de vous.</p>
              </div>
            </div>
          )}

          {/* Où en est mon dossier */}
          <div className="flex gap-3">
            <Hourglass className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="font-semibold">Où en est mon dossier ?</p>
              <p className="text-[15px] text-muted-foreground">
                {submitted || d.status !== "nouveau"
                  ? (CLIENT_STATUS_TEXT[d.status] ?? d.pilotage.ouEnEst)
                  : "Votre dossier est ouvert. Il attend vos documents."}
              </p>
            </div>
          </div>

          {/* Documents */}
          <div>
            <p className="mb-2 font-semibold">Mes documents</p>
            <ul className="flex flex-col divide-y rounded-lg border">
              {expected.map((c) => {
                const ok = !missing.includes(c)
                const n = d.documents.filter((doc) => doc.category === c).length
                return (
                  <li key={c} className="flex items-center gap-3 px-3 py-2.5 text-[15px]">
                    {ok ? <Check className="size-4 text-tone-done" /> : <CircleAlert className="size-4 text-tone-waiting" />}
                    <span className="flex-1">{CLIENT_DOC_COPY[c]?.label ?? DOC_CATEGORIES[c]}</span>
                    <span className={cn("text-sm", ok ? "text-muted-foreground" : "font-medium text-tone-waiting")}>
                      {ok ? (c === "photos" ? `${n} photo${n > 1 ? "s" : ""}` : "Reçu") : "À ajouter"}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        {/* Étapes du dossier */}
        <div>
          <p className="mb-3 font-semibold">Les étapes</p>
          <ol className="relative flex flex-col gap-3">
            {steps.map((s, i) => {
              const done = i < current
              const now = i === current
              return (
                <li key={s.label} className="relative flex items-center gap-3 text-sm">
                  {i < steps.length - 1 && (
                    <span className={cn("absolute top-5 left-[9px] h-3 w-0.5", done ? "bg-primary" : "bg-border")} />
                  )}
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full border-2",
                      done && "border-primary bg-primary text-primary-foreground",
                      now && "border-primary bg-card",
                      !done && !now && "border-border bg-card",
                    )}
                  >
                    {done && <Check className="size-3" strokeWidth={3} />}
                    {now && <span className="size-2 rounded-full bg-primary" />}
                  </span>
                  <span className={cn(now ? "font-semibold" : done ? "text-foreground" : "text-muted-foreground")}>
                    {i === 0 ? "Dossier ouvert" : s.label}
                  </span>
                </li>
              )
            })}
          </ol>
          <p className="mt-4 text-xs text-muted-foreground">Ouvert le {formatDate(d.createdAt)}</p>
        </div>
      </div>
    </article>
  )
}

function TodoCard({ icon, title, text, cta, href }: { icon: React.ReactNode; title: string; text: string; cta: string; href: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-primary/25 bg-primary-soft p-4 sm:flex-row sm:items-center">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground [&_svg]:size-5">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <p className="text-[15px] text-muted-foreground">{text}</p>
      </div>
      <Button render={<Link href={href} />} nativeButton={false} className="w-full sm:w-auto">
        {cta} <ArrowRight />
      </Button>
    </div>
  )
}
