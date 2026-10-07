"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  Archive,
  BellRing,
  CalendarDays,
  Check,
  ChevronLeft,
  CircleDashed,
  Download,
  FileText,
  Flag,
  Hourglass,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  UserPlus,
} from "lucide-react"

import { useRole } from "@/components/app-shell/role-context"
import { Immat } from "@/components/immat"
import { LateBadge, StatusBadge } from "@/components/status-badge"
import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ACTOR_LABELS,
  DOC_CATEGORIES,
  DOSSIER_TYPES,
  LITIGE_ASSUR_TYPES,
  SINISTRE_TYPES,
  WORKFLOW_STEPS,
  compagnieLabel,
  expectedDocs,
  fullName,
  getUser,
  isLate,
  lateDays,
  type DocCategory,
  type Dossier,
} from "@/lib/data"
import { formatDate, formatDateTime, formatLongDate, relativeDays } from "@/lib/format"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { AddDocDialog, AssignDialog, CloseDialog, RelanceDialog, StatusDialog } from "./dossier-dialogs"
import { DossierSuivi } from "./dossier-suivi"

type DialogId = "status" | "close" | "assign" | "relance" | "doc" | null

export function DossierDetail({ id }: { id: string }) {
  const { href, user } = useRole()
  const { getDossier, updateDossier, addEvent } = useStore()
  const d = getDossier(id)
  const [dialog, setDialog] = React.useState<DialogId>(null)
  const [docCategory, setDocCategory] = React.useState<DocCategory | undefined>()
  const [tab, setTab] = React.useState("suivi")

  if (!d) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">Dossier introuvable.</p>
        <Button variant="link" render={<Link href={href("dossiers")} />} nativeButton={false}>
          Retour aux dossiers
        </Button>
      </div>
    )
  }

  const closed = d.status === "cloture" || d.status === "archive"
  const late = isLate(d)

  function archive() {
    updateDossier(d!.id, (x) => ({ ...x, status: "archive", pilotage: { ...x.pilotage, ouEnEst: "Dossier archivé.", prochaineAction: "—" } }))
    addEvent(d!.id, { kind: "status", author: user.id, title: "Statut → Archivé" })
    toast.success("Dossier archivé", { description: "Il reste consultable dans les archives." })
  }

  const openDoc = (c?: DocCategory) => {
    setDocCategory(c)
    setDialog("doc")
  }

  const subtype = d.sinistreType ? SINISTRE_TYPES[d.sinistreType].label : d.litigeType ? LITIGE_ASSUR_TYPES[d.litigeType].label : null

  return (
    <>
      {/* En-tête */}
      <div className="mb-5">
        <Link href={href(d.status === "archive" ? "archives" : "dossiers")} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" /> {d.status === "archive" ? "Archives" : "Dossiers"}
        </Link>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                {d.client.firstName} {d.client.lastName}
              </h1>
              <Immat value={d.vehicule.immat} className="h-7 text-sm" />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {d.ref} · {DOSSIER_TYPES[d.type].label}
              {subtype && ` — ${subtype}`} · {d.vehicule.marque} {d.vehicule.modele} · créé le {formatDate(d.createdAt)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={d.status} />
              {late && <LateBadge days={lateDays(d)} />}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {!closed && (
              <>
                <Button variant="outline" onClick={() => setDialog("relance")}>
                  <BellRing /> Relancer
                </Button>
                <Button variant="outline" onClick={() => setDialog("status")}>
                  <Pencil /> Modifier le statut
                </Button>
              </>
            )}
            {d.status === "cloture" && (
              <Button onClick={archive}>
                <Archive /> Archiver
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Plus d'actions" />}>
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {!closed && (
                  <DropdownMenuItem onClick={() => setDialog("assign")}>
                    <UserPlus /> Assigner les intervenants
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => openDoc()}>
                  <Plus /> Ajouter un document
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast.info("Export du dossier complet (ZIP) — simulation")}>
                  <Download /> Télécharger tout le dossier
                </DropdownMenuItem>
                {!closed && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => setDialog("close")}>
                      <Flag /> Clôturer le dossier
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Pilotage : les 3 questions du CDC */}
      <Card className={cn("mb-6", late && "ring-destructive/30")}>
        <CardContent className="grid gap-5 md:grid-cols-3 md:gap-0 md:divide-x">
          <PilotBlock label="Où en est le dossier ?" icon={MapPin}>
            {d.pilotage.ouEnEst}
          </PilotBlock>
          <PilotBlock label="Qu'est-ce qu'on attend ?" icon={Hourglass} className="md:px-5">
            {d.pilotage.attente}
          </PilotBlock>
          <PilotBlock label="Prochaine action" icon={Flag} className="md:pl-5" highlight>
            <span className="font-medium">{d.pilotage.prochaineAction}</span>
            <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span className="rounded-full bg-muted px-2 py-0.5 font-medium">{ACTOR_LABELS[d.pilotage.quiDoitAgir]}</span>
              {d.pilotage.echeance && !closed && (
                <span className={cn("text-muted-foreground", late && "font-medium text-destructive")}>
                  {late ? `Échéance dépassée ${relativeDays(d.pilotage.echeance)}` : `Échéance ${relativeDays(d.pilotage.echeance)}`}
                </span>
              )}
            </span>
            {d.status === "nouveau" && !closed && (
              <Button size="sm" className="mt-3 w-fit" onClick={() => setDialog("assign")}>
                <UserPlus /> Assigner
              </Button>
            )}
            {late && d.status !== "nouveau" && (
              <Button size="sm" variant="outline" className="mt-3 w-fit" onClick={() => setDialog("relance")}>
                <BellRing /> Relancer
              </Button>
            )}
          </PilotBlock>
        </CardContent>
        <div className="border-t px-4 pt-4">
          <Stepper dossier={d} />
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Tabs value={tab} onValueChange={(v) => setTab(v as string)} className="min-w-0">
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <TabsList variant="line" className="mb-2">
              <TabsTrigger value="suivi">Suivi <Count n={d.timeline.length} /></TabsTrigger>
              <TabsTrigger value="general">Général</TabsTrigger>
              <TabsTrigger value="documents">Documents <Count n={d.documents.length} /></TabsTrigger>
              <TabsTrigger value="expertise">Expertise</TabsTrigger>
              {d.type === "litige_assurantiel" && <TabsTrigger value="tierce">Tierce expertise</TabsTrigger>}
              <TabsTrigger value="resolution">Résolution</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="suivi">
            <DossierSuivi dossier={d} />
          </TabsContent>
          <TabsContent value="general">
            <General dossier={d} />
          </TabsContent>
          <TabsContent value="documents">
            <Documents dossier={d} onAdd={openDoc} />
          </TabsContent>
          <TabsContent value="expertise">
            <ExpertiseTab dossier={d} />
          </TabsContent>
          <TabsContent value="tierce">
            <TierceTab dossier={d} />
          </TabsContent>
          <TabsContent value="resolution">
            <Resolution dossier={d} onClose={() => setDialog("close")} />
          </TabsContent>
        </Tabs>

        <aside className="flex flex-col gap-4">
          <Intervenants dossier={d} onAssign={closed ? undefined : () => setDialog("assign")} />
          <Card size="sm">
            <CardHeader>
              <CardTitle>Références</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-muted-foreground">Nereids</dt>
                <dd className="text-right font-medium">{d.ref}</dd>
                <dt className="text-muted-foreground">Sinistre</dt>
                <dd className="text-right">{d.refs.sinistre ?? "—"}</dd>
                <dt className="text-muted-foreground">Interne</dt>
                <dd className="text-right">{d.refs.interne ?? "—"}</dd>
                <dt className="text-muted-foreground">Expert</dt>
                <dd className="text-right">{d.refs.expert ?? "—"}</dd>
              </dl>
            </CardContent>
          </Card>
        </aside>
      </div>

      <StatusDialog key={`s-${d.status}`} dossier={d} open={dialog === "status"} onOpenChange={(o) => setDialog(o ? "status" : null)} />
      <CloseDialog dossier={d} open={dialog === "close"} onOpenChange={(o) => setDialog(o ? "close" : null)} />
      <AssignDialog key={`a-${JSON.stringify(d.intervenants)}`} dossier={d} open={dialog === "assign"} onOpenChange={(o) => setDialog(o ? "assign" : null)} />
      <RelanceDialog key={`r-${d.pilotage.attente}`} dossier={d} open={dialog === "relance"} onOpenChange={(o) => setDialog(o ? "relance" : null)} />
      <AddDocDialog dossier={d} defaultCategory={docCategory} open={dialog === "doc"} onOpenChange={(o) => setDialog(o ? "doc" : null)} />
    </>
  )
}

function Count({ n }: { n: number }) {
  return <span className="text-xs text-muted-foreground tabular-nums">{n}</span>
}

function PilotBlock({
  label,
  icon: Icon,
  children,
  className,
  highlight,
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  className?: string
  highlight?: boolean
}) {
  return (
    <div className={cn("flex flex-col", className)}>
      <span className={cn("mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground", highlight && "text-primary")}>
        <Icon className="size-3.5" /> {label}
      </span>
      <div className="flex flex-col text-sm">{children}</div>
    </div>
  )
}

function Stepper({ dossier }: { dossier: Dossier }) {
  const steps = WORKFLOW_STEPS[dossier.type]
  const current = Math.max(0, steps.findIndex((s) => s.statuses.includes(dossier.status)))
  const done = dossier.status === "cloture" || dossier.status === "archive"
  return (
    <ol className="-mx-4 flex overflow-x-auto px-4 pb-4">
      {steps.map((s, i) => {
        const state = done || i < current ? "done" : i === current ? "current" : "todo"
        return (
          <li key={s.label} className="flex min-w-[88px] flex-1 flex-col items-center gap-1.5 text-center">
            <div className="flex w-full items-center">
              <span className={cn("h-0.5 flex-1", i === 0 ? "bg-transparent" : state === "todo" ? "bg-border" : "bg-primary")} />
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full border-2 text-[0.65rem] font-semibold",
                  state === "done" && "border-primary bg-primary text-primary-foreground",
                  state === "current" && "border-primary bg-background text-primary ring-4 ring-primary/15",
                  state === "todo" && "border-border bg-background text-muted-foreground",
                )}
              >
                {state === "done" ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span className={cn("h-0.5 flex-1", i === steps.length - 1 ? "bg-transparent" : state === "done" && (done || i + 1 <= current) ? "bg-primary" : "bg-border")} />
            </div>
            <span className={cn("text-xs", state === "current" ? "font-medium text-foreground" : "text-muted-foreground")}>{s.label}</span>
          </li>
        )
      })}
    </ol>
  )
}

function Intervenants({ dossier, onAssign }: { dossier: Dossier; onAssign?: () => void }) {
  const rows: { label: string; id?: string }[] = [
    { label: "Gestionnaire", id: dossier.intervenants.gestionnaire },
    { label: "Expert", id: dossier.intervenants.expert },
    { label: "Réparateur", id: dossier.intervenants.reparateur },
    ...(dossier.intervenants.suiveurs.length
      ? dossier.intervenants.suiveurs.map((id) => ({ label: "Suiveur", id }))
      : [{ label: "Suiveur", id: undefined }]),
  ]
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Intervenants</CardTitle>
        {onAssign && (
          <CardAction>
            <Button size="xs" variant="outline" onClick={onAssign}>
              Assigner
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3">
          <li className="flex items-center gap-3">
            <UserAvatar user={dossier.client} />
            <div className="min-w-0 text-sm">
              <p className="truncate font-medium">
                {dossier.client.firstName} {dossier.client.lastName}
              </p>
              <p className="text-xs text-muted-foreground">Client</p>
            </div>
          </li>
          {rows.map((r, i) => {
            const u = getUser(r.id)
            return (
              <li key={i} className="flex items-center gap-3">
                {u ? <UserAvatar user={u} /> : <span className="grid size-7 place-items-center rounded-full border border-dashed"><CircleDashed className="size-3.5 text-muted-foreground" /></span>}
                <div className="min-w-0 text-sm">
                  <p className={cn("truncate", u ? "font-medium" : "text-muted-foreground italic")}>{u ? fullName(u) : "Non assigné"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.label}
                    {u && ` · ${u.structure}`}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

function InfoCard({ title, rows }: { title: string; rows: [string, React.ReactNode][] }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[minmax(110px,auto)_1fr] gap-x-4 gap-y-2 text-sm">
          {rows.map(([k, v]) => (
            <React.Fragment key={k}>
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="min-w-0 break-words">{v || "—"}</dd>
            </React.Fragment>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}

function General({ dossier: d }: { dossier: Dossier }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <InfoCard
        title="Client"
        rows={[
          ["Nom", `${d.client.firstName} ${d.client.lastName}`],
          ["Téléphone", d.client.phone],
          ["E-mail", d.client.email],
        ]}
      />
      <InfoCard
        title="Véhicule"
        rows={[
          ["Marque / modèle", `${d.vehicule.marque} ${d.vehicule.modele}`],
          ["Immatriculation", <Immat key="i" value={d.vehicule.immat} />],
          ["VIN", d.vehicule.vin && <span key="v" className="font-mono text-xs">{d.vehicule.vin}</span>],
        ]}
      />
      <InfoCard
        title={compagnieLabel(d.type)}
        rows={[
          ["Nom", d.compagnie?.nom],
          ["E-mail", d.compagnie?.email],
          ["Référence", d.compagnie?.reference],
        ]}
      />
      <InfoCard
        title="Dossier"
        rows={[
          ["Type", DOSSIER_TYPES[d.type].label],
          ["Qualification", d.sinistreType ? SINISTRE_TYPES[d.sinistreType].label : d.litigeType ? LITIGE_ASSUR_TYPES[d.litigeType].label : "—"],
          ["Créé le", formatDate(d.createdAt)],
          ["Région", d.region],
        ]}
      />
      {d.tiers && d.tiers.length > 0 && (
        <InfoCard title="Tiers" rows={d.tiers.map((t, i) => [`Tiers ${i + 1}`, `${t.nom}${t.coordonnees ? ` · ${t.coordonnees}` : ""}`])} />
      )}
      {d.description && <InfoCard title="Description" rows={[["Problème", d.description]]} />}
    </div>
  )
}

function Documents({ dossier: d, onAdd }: { dossier: Dossier; onAdd: (c?: DocCategory) => void }) {
  const expected = expectedDocs(d.type, d.litigeType)
  const missing = expected.filter((c) => !d.documents.some((doc) => doc.category === c))
  const byCat = Object.entries(
    d.documents.reduce<Record<string, Dossier["documents"]>>((acc, doc) => {
      ;(acc[doc.category] ??= []).push(doc)
      return acc
    }, {}),
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{d.documents.length} document(s)</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => toast.info("Téléchargement groupé (ZIP) — simulation")}>
            <Download /> Tout télécharger
          </Button>
          <Button size="sm" onClick={() => onAdd()}>
            <Plus /> Ajouter un document
          </Button>
        </div>
      </div>

      {missing.length > 0 && d.status !== "cloture" && d.status !== "archive" && (
        <Card size="sm" className="bg-tone-waiting-bg/50 ring-tone-waiting/20">
          <CardContent>
            <p className="mb-2 text-sm font-medium">Pièces manquantes</p>
            <div className="flex flex-wrap gap-2">
              {missing.map((c) => (
                <Button key={c} size="xs" variant="outline" className="bg-background" onClick={() => onAdd(c)}>
                  <Plus /> {DOC_CATEGORIES[c]}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {byCat.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Aucun document pour le moment.</p>}

      {byCat.map(([cat, docs]) => (
        <div key={cat}>
          <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{DOC_CATEGORIES[cat as DocCategory]}</p>
          <ul className="divide-y rounded-xl border bg-card">
            {docs.map((doc) => {
              const author = getUser(doc.addedBy)
              return (
                <li key={doc.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                    <FileText className="size-4 text-muted-foreground" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{doc.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {fullName(author)} · {formatDateTime(doc.addedAt)} · {doc.size}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon-sm" aria-label="Télécharger" onClick={() => toast.info(`Téléchargement de « ${doc.name} » — simulation`)}>
                    <Download />
                  </Button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

function ExpertiseTab({ dossier: d }: { dossier: Dossier }) {
  const pv = d.documents.find((x) => x.category === "pv")
  const rapport = d.documents.find((x) => x.category === "rapport")
  if (!d.expertise.date) {
    return (
      <Card size="sm">
        <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
          <CalendarDays className="size-6 text-muted-foreground" />
          <p className="font-medium">Expertise non programmée</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            L&apos;expert assigné proposera une date et un lieu. Les participants seront convoqués automatiquement.
          </p>
        </CardContent>
      </Card>
    )
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <InfoCard
        title="Rendez-vous"
        rows={[
          ["Date", <span key="d" className="first-letter:uppercase">{formatLongDate(d.expertise.date)}</span>],
          ["Lieu", d.expertise.lieu],
          ["Statut", d.expertise.realisee ? "Réalisée" : `Prévue ${relativeDays(d.expertise.date)}`],
        ]}
      />
      <InfoCard title="Personnes convoquées" rows={d.expertise.convoques.map((id) => [ACTOR_LABELS[getUser(id)?.role ?? "client"], fullName(getUser(id))])} />
      <InfoCard
        title="Livrables de l'expert"
        rows={[
          ["PV d'expertise", pv ? pv.name : <span key="p" className="text-muted-foreground">En attente</span>],
          ["Rapport", rapport ? rapport.name : <span key="r" className="text-muted-foreground">En attente</span>],
        ]}
      />
    </div>
  )
}

function TierceTab({ dossier: d }: { dossier: Dossier }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Rattaché au dossier principal : suivi de la contre-expertise ou de l&apos;expertise contradictoire.
      </p>
      <InfoCard
        title="Tierce expertise"
        rows={[
          ["Type", d.litigeType === "valeur" ? "Contre-expertise" : d.litigeType === "imputable" ? "Expertise contradictoire" : "À définir par l'expert"],
          ["Expert", fullName(getUser(d.intervenants.expert))],
          ["Date prévue", d.expertise.date ? formatDate(d.expertise.date) : "—"],
          ["Statut", d.status === "nouveau" || d.status === "en_etude" ? "En attente de validation de l'expert" : "En cours"],
          ["Résultat", "—"],
          ["PV", "—"],
          ["Rapport", "—"],
        ]}
      />
    </div>
  )
}

function Resolution({ dossier: d, onClose }: { dossier: Dossier; onClose: () => void }) {
  const relances = d.timeline.filter((e) => e.kind === "relance")
  const reclam = d.timeline.find((e) => e.title.includes("Réclamation envoyée"))
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <InfoCard
        title="Réclamation"
        rows={[
          ["Envoyée le", reclam ? formatDate(reclam.at) : "—"],
          ["Accord / paiement", d.status === "attente_paiement" ? "Accord obtenu, paiement attendu" : d.status === "cloture" || d.status === "archive" ? "—" : "En attente"],
        ]}
      />
      <Card size="sm">
        <CardHeader>
          <CardTitle>Relances effectuées</CardTitle>
        </CardHeader>
        <CardContent>
          {relances.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune relance.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {relances.map((r) => (
                <li key={r.id} className="flex justify-between gap-2">
                  <span className="truncate">{r.title.replace("Relance envoyée — ", "")}</span>
                  <span className="shrink-0 text-muted-foreground">{formatDate(r.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card size="sm" className="md:col-span-2">
        <CardHeader>
          <CardTitle>Clôture</CardTitle>
          {!d.cloture && (
            <CardAction>
              <Button size="sm" variant="outline" onClick={onClose}>
                Clôturer le dossier
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="text-sm">
          {d.cloture ? (
            <p>
              Clôturé le {formatDate(d.cloture.at)} — motif : <span className="font-medium">{d.cloture.motif}</span>
              {d.cloture.commentaire && <span className="text-muted-foreground"> · {d.cloture.commentaire}</span>}
            </p>
          ) : (
            <p className="text-muted-foreground">Dossier en cours. La clôture est réservée à Nereids.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
