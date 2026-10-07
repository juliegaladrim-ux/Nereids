"use client"

import Link from "next/link"
import { ArrowRight, Camera, Check, Mail, Plus } from "lucide-react"

import { useRole } from "@/components/app-shell/role-context"
import { Immat } from "@/components/immat"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { DOC_CATEGORIES, type Dossier, type StatusId } from "@/lib/data"
import { visibleDossiers } from "@/lib/access"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { CLIENT_DOC_COPY, clientDocsStatus, clientTypeLabel } from "./client-docs"

/**
 * Étapes vues par le client : 5 grandes étapes compréhensibles,
 * au lieu des statuts internes (CDC §17) trop détaillés pour un particulier.
 */
const CLIENT_STEPS: { label: string; statuses: StatusId[]; title: string; next: string }[] = [
  {
    label: "Ouverture",
    statuses: ["nouveau"],
    title: "Nereids vérifie votre dossier",
    next: "Il sera confié à un expert automobile sous 48 h.",
  },
  {
    label: "Étude",
    statuses: ["en_etude", "attente_client", "complement", "recours_valide", "attente_tiers", "attente_compagnie"],
    title: "Un expert étudie votre dossier",
    next: "Il vérifie que le recours est possible, puis organise l'expertise.",
  },
  {
    label: "Expertise",
    statuses: ["attente_expertise", "attente_pv", "attente_rapport", "attente_reparation"],
    title: "L'expertise de votre véhicule est en cours",
    next: "L'expert chiffre les dommages et rédige son rapport.",
  },
  {
    label: "Indemnisation",
    statuses: ["reclamation_envoyee", "attente_retour", "attente_paiement"],
    title: "Nereids réclame votre indemnisation",
    next: "Vous serez prévenu dès que l'assurance aura répondu.",
  },
  {
    label: "Terminé",
    statuses: ["cloture", "archive"],
    title: "Votre dossier est terminé",
    next: "Merci de votre confiance.",
  },
]

export function ClientHome() {
  const { role, user } = useRole()
  const { dossiers } = useStore()
  const list = visibleDossiers(dossiers, role.id, user.id)

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader title={`Bonjour ${user.firstName}`} description={list.length > 1 ? "Vos dossiers" : "Votre dossier"} />
      <div className="flex flex-col gap-8">
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
  const current = Math.max(0, CLIENT_STEPS.findIndex((s) => s.statuses.includes(d.status)))
  const step = CLIENT_STEPS[current]

  // Une seule action mise en avant, uniquement s'il y a quelque chose à faire
  const action = !submitted
    ? {
        icon: <Mail />,
        title: "Complétez votre dossier",
        text: "Vérifiez vos informations et envoyez vos documents.",
        cta: "Compléter",
        href: `/activation/${d.id}${activated ? "?etape=infos" : ""}`,
      }
    : missing.length > 0
      ? {
          icon: <Camera />,
          title: `${missing.length} document${missing.length > 1 ? "s" : ""} à ajouter`,
          text: missing.map((c) => CLIENT_DOC_COPY[c]?.label ?? DOC_CATEGORIES[c]).join(", "),
          cta: "Ajouter",
          href: `/activation/${d.id}?etape=pieces`,
        }
      : null

  return (
    <article className="flex flex-col gap-4">
      {/* Véhicule + étapes */}
      <section className="rounded-xl border bg-card">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 pt-5">
          <h2 className="mr-auto text-lg font-semibold">
            {d.vehicule.marque} {d.vehicule.modele}
          </h2>
          <Immat value={d.vehicule.immat} />
        </div>
        <p className="px-5 pt-1 text-sm text-muted-foreground">
          {clientTypeLabel(d)} · <span className="whitespace-nowrap">{d.ref}</span>
        </p>

        <Stepper current={current} />

        {/* Où on en est / ce qui se passe ensuite */}
        <div className="border-t px-5 py-4">
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">
            Étape {current + 1} sur {CLIENT_STEPS.length} · {step.label}
          </p>
          <p className="mt-1 text-lg font-semibold">{submitted || d.status !== "nouveau" ? step.title : "Votre dossier attend vos documents"}</p>
          <p className="text-[15px] text-muted-foreground">
            {submitted || d.status !== "nouveau" ? step.next : "Dès réception, Nereids vérifie votre dossier et le confie à un expert."}
          </p>
        </div>
      </section>

      {/* Action attendue */}
      {action && (
        <Link
          href={action.href}
          className="group flex items-center gap-4 rounded-xl border border-primary/30 bg-primary-soft p-4 transition-colors hover:border-primary"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground [&_svg]:size-5">{action.icon}</span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{action.title}</p>
            <p className="truncate text-[15px] text-muted-foreground">{action.text}</p>
          </div>
          <span className="hidden items-center gap-1.5 text-sm font-semibold text-primary sm:flex">
            {action.cta} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
          <ArrowRight className="size-5 text-primary sm:hidden" />
        </Link>
      )}

      {/* Documents */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Mes documents</h3>
          {submitted && (
            <Button variant="ghost" size="sm" render={<Link href={`/activation/${d.id}?etape=pieces`} />} nativeButton={false}>
              <Plus /> Ajouter
            </Button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {expected.map((c) => {
            const ok = !missing.includes(c)
            const n = d.documents.filter((doc) => doc.category === c).length
            const copy = CLIENT_DOC_COPY[c]
            const Icon = copy?.icon ?? Camera
            return (
              <div
                key={c}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border bg-card px-2 py-4 text-center",
                  !ok && "border-dashed border-tone-waiting/50",
                )}
              >
                <span className="relative">
                  <Icon className={cn("size-6", ok ? "text-foreground" : "text-muted-foreground")} />
                  <span
                    className={cn(
                      "absolute -right-2 -bottom-1 grid size-4 place-items-center rounded-full ring-2 ring-card",
                      ok ? "bg-tone-done text-white" : "bg-tone-waiting-bg text-tone-waiting",
                    )}
                  >
                    {ok ? <Check className="size-2.5" strokeWidth={3.5} /> : <span className="text-[10px] leading-none font-bold">!</span>}
                  </span>
                </span>
                <span className="text-sm leading-tight font-medium">{copy?.label ?? DOC_CATEGORIES[c]}</span>
                <span className={cn("text-xs", ok ? "text-muted-foreground" : "font-medium text-tone-waiting")}>
                  {ok ? (c === "photos" ? `${n} photo${n > 1 ? "s" : ""}` : "Reçu") : "À ajouter"}
                </span>
              </div>
            )
          })}
        </div>
      </section>
    </article>
  )
}

/** Frise horizontale : pastilles reliées, libellé sous chaque étape */
function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex px-3 pt-6 pb-5">
      {CLIENT_STEPS.map((s, i) => {
        const done = i < current
        const now = i === current
        return (
          <li key={s.label} className="relative flex flex-1 flex-col items-center gap-2">
            {/* Trait vers l'étape suivante */}
            {i < CLIENT_STEPS.length - 1 && (
              <span className={cn("absolute top-3 left-1/2 h-0.5 w-full", done ? "bg-primary" : "bg-border")} />
            )}
            <span
              className={cn(
                "relative grid size-6 place-items-center rounded-full border-2",
                done && "border-primary bg-primary text-primary-foreground",
                now && "border-primary bg-card ring-4 ring-primary/15",
                !done && !now && "border-border bg-card",
              )}
            >
              {done && <Check className="size-3.5" strokeWidth={3} />}
              {now && <span className="size-2.5 rounded-full bg-primary" />}
            </span>
            <span
              className={cn(
                "text-center text-xs leading-tight sm:text-sm",
                now ? "font-semibold text-foreground" : done ? "text-foreground" : "text-muted-foreground",
                // Sur mobile, seul le libellé de l'étape en cours est affiché
                !now && "max-sm:invisible",
              )}
            >
              {s.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
