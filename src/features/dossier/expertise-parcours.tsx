"use client"

import * as React from "react"
import { toast } from "sonner"
import { CalendarCheck, CalendarDays, FileSignature, FileText, Hourglass, MapPin, SearchCheck, User, UserPlus } from "lucide-react"

import { useRole } from "@/components/app-shell/role-context"
import { DateInput } from "@/components/date-input"
import { ValidationPills } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { DictableTextarea } from "@/components/dictable-textarea"
import {
  STATUS_ORDER,
  VALIDATION_ITEMS,
  clientConvoqueId,
  clientValidation,
  expertisePhase,
  fullName,
  getUser,
  personneName,
  type ClientValidation,
  type Dossier,
  type ValidationState,
} from "@/lib/data"
import { formatDateTime, formatLongDate } from "@/lib/format"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { fromDateInput, toDateTimeInput } from "./dossier-edit"

/**
 * Parcours d'une expertise (point client 26/10) : mission générée puis signée (voyant M),
 * pré-étude de l'expert (accepte / refuse), formulaire de l'expert (honoraires, motif,
 * convoqués, lieu, 3 dates), puis le gestionnaire appelle le lieu et génère les convocations.
 * Les voyants M/D/R ne bloquent rien.
 */

const ROLE_ORDER: string[] = ["expert", "reparateur", "suiveur"]

export const eur = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 })

/** Personnes du dossier qu'on peut convoquer : client, expert, réparateur, suiveurs */
function convocables(d: Dossier): { id: string; label: string; detail: string }[] {
  const people = [d.intervenants.expert, d.intervenants.reparateur, ...d.intervenants.suiveurs]
    .map((id) => getUser(id))
    .filter((u) => !!u)
    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))
    .map((u) => ({
      id: u.id,
      label: fullName(u) || u.structure,
      detail: u.role === "expert" ? "Expert" : u.role === "reparateur" ? `Réparateur${u.structure && fullName(u) ? ` · ${u.structure}` : ""}` : u.fonction || "Intervenant suiveur",
    }))
  return [{ id: clientConvoqueId(d), label: personneName(d.client), detail: "Client" }, ...people]
}

export function convoqueName(d: Dossier, id: string): string {
  if (id === clientConvoqueId(d)) return personneName(d.client)
  const u = getUser(id)
  return u ? fullName(u) || u.structure : id
}

/** Actions du parcours partagées par la bannière et les voyants M/D/R de l'en-tête */
export function useParcoursActions(d: Dossier) {
  const { user } = useRole()
  const { updateDossier, addEvent } = useStore()

  function setValidation(key: keyof ClientValidation, state: ValidationState) {
    const it = VALIDATION_ITEMS.find((x) => x.key === key)!
    const label = state === "ok" ? it.done : state === "en_attente" ? it.pending : it.todo
    const missionSigned = key === "mission" && state === "ok" && !!d.intervenants.expert && !d.proposition && !d.expertise.date
    updateDossier(d.id, (x) => ({
      ...x,
      validation: { ...clientValidation(x), [key]: state },
      // Mission signée : c'est à l'expert de faire sa pré-étude
      ...(missionSigned && {
        pilotage: {
          ...x.pilotage,
          ouEnEst: "Mission signée par le client.",
          attente: "Pré-étude de l'expert",
          prochaineAction: "Étudier le dossier et accepter ou refuser la mission",
          quiDoitAgir: "expert" as const,
        },
      }),
    }))
    addEvent(d.id, { kind: "system", author: user.id, title: `${it.label} ${label}` })
    const expert = getUser(d.intervenants.expert)
    toast.success(`${it.label} ${label}`, {
      description: missionSigned && expert ? `${fullName(expert)} est notifié(e) pour faire sa pré-étude.` : undefined,
    })
  }

  /** Générateur de documents (simulation) : la lettre de mission est ajoutée au dossier, à faire signer au client */
  function generateMission() {
    const now = new Date().toISOString()
    const doc = { id: `d${Date.now()}`, name: `Lettre de mission — ${d.vehicule.immat}.pdf`, category: "courrier" as const, addedBy: user.id, addedAt: now, docDate: now, size: "120 Ko" }
    updateDossier(d.id, (x) => ({
      ...x,
      documents: [...x.documents, doc],
      validation: { ...clientValidation(x), mission: "en_attente" },
      pilotage: { ...x.pilotage, ouEnEst: "Lettre de mission générée.", attente: "Signature de la mission par le client", prochaineAction: "Indiquer que la mission est signée (voyant M)", quiDoitAgir: x.intervenants.gestionnaire ? "gestionnaire" : "nereids" },
    }))
    addEvent(d.id, { kind: "document", author: user.id, title: "Lettre de mission générée", body: doc.name })
    toast.success("Lettre de mission générée", { description: "Elle est dans les documents du dossier, à faire signer au client." })
  }

  return { setValidation, generateMission }
}

/** Voyants M/D/R de l'en-tête, modifiables par Nereids et le gestionnaire */
export function EditableValidationPills({ dossier: d }: { dossier: Dossier }) {
  const { setValidation } = useParcoursActions(d)
  return <ValidationPills validation={clientValidation(d)} onChange={setValidation} />
}

// ─── Bannière « prochaine étape » ────────────────────────────────────────────

export function ExpertiseParcoursBanner({
  dossier: d,
  manager,
  onAssign,
  onRefused,
}: {
  dossier: Dossier
  /** Admin ou gestionnaire (hors Téléphonie seule) : génère la mission, la marque signée, programme l'expertise */
  manager: boolean
  onAssign: () => void
  /** L'expert a refusé : il n'a plus accès au dossier */
  onRefused: () => void
}) {
  const { role, user } = useRole()
  const { updateDossier, addEvent } = useStore()
  const { setValidation, generateMission } = useParcoursActions(d)
  const [dialog, setDialog] = React.useState<"accept" | "refuse" | "programmer" | null>(null)
  const phase = expertisePhase(d)
  const isExpert = role.id === "expert" && d.intervenants.expert === user.id
  const expert = getUser(d.intervenants.expert)

  function refuse() {
    updateDossier(d.id, (x) => ({
      ...x,
      intervenants: { ...x.intervenants, expert: undefined },
      refusExpert: { expert: user.id, at: new Date().toISOString() },
      pilotage: { ...x.pilotage, ouEnEst: "Mission refusée par l'expert après sa pré-étude.", attente: "Assignation d'un autre expert", prochaineAction: "Assigner un autre expert", quiDoitAgir: "nereids" },
    }))
    addEvent(d.id, { kind: "assignation", author: user.id, title: "Mission refusée par l'expert", body: "Le dossier revient à Nereids pour assigner un autre expert." })
    toast.success("Mission refusée", { description: "Nereids est notifié et assignera un autre expert." })
    setDialog(null)
    onRefused()
  }

  let content: { icon: React.ReactNode; title: string; text: React.ReactNode; actions?: React.ReactNode; waiting?: boolean } | null = null
  if (phase === "refus" && manager) {
    const refusedBy = getUser(d.refusExpert?.expert)
    content = {
      icon: <UserPlus />,
      title: "Mission refusée par l'expert",
      text: `${refusedBy ? fullName(refusedBy) : "L'expert"} a refusé la mission après sa pré-étude. Assignez un autre expert.`,
      actions: <Button onClick={onAssign}><UserPlus /> Assigner un expert</Button>,
    }
  } else if (phase === "mission" && manager) {
    content = {
      icon: <FileText />,
      title: "Créer la mission",
      text: `${expert ? fullName(expert) : "L'expert"} est assigné(e). Générez la lettre de mission à faire signer au client.`,
      actions: <Button onClick={generateMission}><FileText /> Générer la mission</Button>,
    }
  } else if (phase === "signature" && manager) {
    content = {
      icon: <FileSignature />,
      title: "Mission en attente de signature",
      text: "Dès que le client a signé, indiquez-le ici ou sur le voyant M : l'expert sera notifié pour sa pré-étude.",
      actions: <Button onClick={() => setValidation("mission", "ok")}><FileSignature /> Mission signée</Button>,
    }
  } else if (phase === "signature" && role.id === "client") {
    content = {
      icon: <FileSignature />,
      title: "Signature de la mission",
      text: "Signez votre lettre de mission pour que l'expert puisse étudier votre dossier.",
      actions: <Button onClick={() => setValidation("mission", "ok")}><FileSignature /> Signer la mission</Button>,
    }
  } else if (phase === "pre_etude" && isExpert) {
    content = {
      icon: <SearchCheck />,
      title: "Pré-étude du dossier",
      text: "Étudiez les éléments du dossier, puis acceptez ou refusez la mission.",
      actions: (
        <>
          <Button variant="outline" onClick={() => setDialog("refuse")}>Refuser</Button>
          <Button onClick={() => setDialog("accept")}>Accepter la mission</Button>
        </>
      ),
    }
  } else if (phase === "pre_etude" && manager) {
    content = { icon: <Hourglass />, title: "Pré-étude en cours", text: `${expert ? fullName(expert) : "L'expert"} étudie le dossier avant d'accepter ou de refuser la mission.`, waiting: true }
  } else if (phase === "programmation" && manager) {
    content = {
      icon: <CalendarCheck />,
      title: "Proposition de l'expert reçue",
      text: "Appelez le lieu d'expertise pour vérifier ses disponibilités, puis générez les convocations.",
      actions: <Button onClick={() => setDialog("programmer")}><CalendarCheck /> Programmer l&apos;expertise</Button>,
    }
  } else if (phase === "programmation" && isExpert) {
    content = { icon: <Hourglass />, title: "Proposition envoyée", text: "Le gestionnaire organise l'expertise avec le lieu et vous enverra la convocation.", waiting: true }
  }

  return (
    <>
      {content && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:gap-4">
          <span
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-lg [&_svg]:size-5",
              content.waiting ? "bg-muted text-muted-foreground" : "bg-brand text-primary-foreground",
            )}
          >
            {content.icon}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{content.title}</p>
            <p className="text-sm text-muted-foreground">{content.text}</p>
          </div>
          {content.actions && <div className="flex shrink-0 gap-2">{content.actions}</div>}
        </div>
      )}

      <Dialog open={dialog === "refuse"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Refuser la mission ?</DialogTitle>
            <DialogDescription>Le dossier revient à Nereids, qui assignera un autre expert. Vous n&apos;y aurez plus accès.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button variant="outline" onClick={() => setDialog(null)}>Annuler</Button>
            <Button variant="destructive" onClick={refuse}>Refuser la mission</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {dialog === "accept" && <PropositionDialog dossier={d} onClose={() => setDialog(null)} />}
      {dialog === "programmer" && <ProgrammerDialog dossier={d} onClose={() => setDialog(null)} />}
    </>
  )
}

/** Bloc numéroté d'un formulaire en plusieurs parties (titre + contenu), séparé du précédent par un filet */
function FormSection({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 border-t pt-5">
      <h3 className="flex items-center gap-2.5 text-sm font-semibold">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft text-xs text-brand-ink">{n}</span>
        {title}
        {hint && <span className="font-normal text-muted-foreground">· {hint}</span>}
      </h3>
      {children}
    </section>
  )
}

// ─── Expert : formulaire après la pré-étude ──────────────────────────────────

function PropositionDialog({ dossier: d, onClose }: { dossier: Dossier; onClose: () => void }) {
  const { user } = useRole()
  const { updateDossier, addEvent } = useStore()
  const people = convocables(d)
  const [honoraires, setHonoraires] = React.useState("")
  const [motif, setMotif] = React.useState("")
  const [convoques, setConvoques] = React.useState<string[]>(
    people.filter((p) => p.id === clientConvoqueId(d) || p.id === d.intervenants.expert || p.id === d.intervenants.reparateur).map((p) => p.id),
  )
  const [lieuMode, setLieuMode] = React.useState<"client" | "autre">(d.lieuClient ? "client" : "autre")
  const [autre, setAutre] = React.useState({ nom: "", adresse: "", cp: "", ville: "" })
  const [dates, setDates] = React.useState(["", "", ""])
  const lieuClient = d.lieuClient ? [d.lieuClient.nom, d.lieuClient.adresse].filter(Boolean).join(", ") : ""
  const autreComplet = !!(autre.nom.trim() && autre.adresse.trim() && /^\d{5}$/.test(autre.cp) && autre.ville.trim())
  const lieu =
    lieuMode === "client" ? lieuClient : autreComplet ? `${autre.nom.trim()}, ${autre.adresse.trim()}, ${autre.cp} ${autre.ville.trim()}` : ""
  const amount = Number(honoraires.replace(",", "."))
  const valid = amount > 0 && motif.trim() && convoques.length > 0 && lieu && dates.every(Boolean)

  function send() {
    const isoDates = dates.map((v) => fromDateInput(v)!)
    updateDossier(d.id, (x) => ({
      ...x,
      proposition: { at: new Date().toISOString(), expert: user.id, honoraires: amount, motif: motif.trim(), lieu, lieuConfirme: lieuMode === "client", dates: isoDates },
      expertise: { ...x.expertise, aConvoquer: convoques },
      pilotage: {
        ...x.pilotage,
        ouEnEst: "Mission acceptée par l'expert.",
        attente: "Programmation de l'expertise",
        prochaineAction: "Appeler le lieu d'expertise et générer les convocations",
        quiDoitAgir: x.intervenants.gestionnaire ? "gestionnaire" : "nereids",
      },
    }))
    addEvent(d.id, { kind: "expertise", author: user.id, title: "Mission acceptée par l'expert", body: "Dates et lieu d'expertise proposés au gestionnaire." })
    toast.success("Proposition envoyée au gestionnaire", { description: "Il organise l'expertise et vous enverra la convocation." })
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:w-full sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Accepter la mission</DialogTitle>
          <DialogDescription>
            Proposez vos conditions d&apos;expertise. Le gestionnaire vérifie les disponibilités du lieu, retient l&apos;une de vos dates et vous
            envoie la convocation.
          </DialogDescription>
        </DialogHeader>

        <FormSection n={1} title="Mission">
          <div className="grid gap-4">
            <Field className="sm:max-w-40">
              <FieldLabel htmlFor="p-honoraires">Honoraires *</FieldLabel>
              <div className="relative">
                <Input id="p-honoraires" inputMode="decimal" value={honoraires} onChange={(e) => setHonoraires(e.target.value)} className="pr-8" />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">€</span>
              </div>
            </Field>
            <DictableTextarea id="p-motif" label="Motif de la convocation *" rows={2} value={motif} onValueChange={setMotif} />
          </div>
        </FormSection>

        <FormSection n={2} title="Personnes à convoquer *">
          <div className="grid gap-2 sm:grid-cols-2">
            {people.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-brand/50 has-data-checked:border-brand has-data-checked:bg-brand-soft">
                <Checkbox
                  checked={convoques.includes(p.id)}
                  onCheckedChange={(c) => setConvoques((all) => (c ? [...all, p.id] : all.filter((id) => id !== p.id)))}
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.label}</span>
                  <span className="block text-xs text-muted-foreground">{p.detail}</span>
                </span>
              </label>
            ))}
          </div>
        </FormSection>

        <FormSection n={3} title="Lieu de l'expertise *">
          {d.lieuClient ? (
            <RadioGroup value={lieuMode} onValueChange={(v) => setLieuMode(v as "client" | "autre")} className="grid gap-2 sm:grid-cols-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-brand/50 has-data-checked:border-brand has-data-checked:bg-brand-soft">
                <RadioGroupItem value="client" className="mt-0.5" />
                <span className="min-w-0">
                  <span className="block font-medium">Lieu indiqué par le client</span>
                  <span className="block text-xs text-muted-foreground">{lieuClient}</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-brand/50 has-data-checked:border-brand has-data-checked:bg-brand-soft">
                <RadioGroupItem value="autre" className="mt-0.5" />
                <span className="min-w-0">
                  <span className="block font-medium">Autre lieu</span>
                  <span className="block text-xs text-muted-foreground">Garage ou adresse à proposer</span>
                </span>
              </label>
            </RadioGroup>
          ) : (
            <FieldDescription>Le client n&apos;a pas encore indiqué de lieu : proposez-en un.</FieldDescription>
          )}
          {lieuMode === "autre" && (
            <div className="grid gap-3 rounded-lg bg-muted/50 p-3 sm:grid-cols-[8rem_1fr]">
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="p-l-nom">Nom du garage</FieldLabel>
                <Input id="p-l-nom" value={autre.nom} onChange={(e) => setAutre((a) => ({ ...a, nom: e.target.value }))} />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="p-l-adresse">Adresse</FieldLabel>
                <Input id="p-l-adresse" value={autre.adresse} onChange={(e) => setAutre((a) => ({ ...a, adresse: e.target.value }))} />
              </Field>
              <Field>
                <FieldLabel htmlFor="p-l-cp">Code postal</FieldLabel>
                <Input
                  id="p-l-cp"
                  inputMode="numeric"
                  maxLength={5}
                  value={autre.cp}
                  onChange={(e) => setAutre((a) => ({ ...a, cp: e.target.value.replace(/\D/g, "") }))}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="p-l-ville">Ville</FieldLabel>
                <Input id="p-l-ville" value={autre.ville} onChange={(e) => setAutre((a) => ({ ...a, ville: e.target.value }))} />
              </Field>
            </div>
          )}
        </FormSection>

        <FormSection n={4} title="Dates proposées *" hint="Par ordre de priorité">
          <div className="flex flex-col gap-2">
            {dates.map((v, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-sm font-medium">{i === 0 ? "1er choix" : `${i + 1}e choix`}</span>
                <DateInput
                  withTime
                  aria-label={`Date, ${i + 1}e choix`}
                  value={v}
                  min={toDateTimeInput(new Date().toISOString())}
                  onChange={(val) => setDates((all) => all.map((x, j) => (j === i ? val : x)))}
                />
              </div>
            ))}
          </div>
        </FormSection>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={send} disabled={!valid}>Accepter et envoyer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Gestionnaire : programmer l'expertise et convoquer ──────────────────────

function ProgrammerDialog({ dossier: d, onClose }: { dossier: Dossier; onClose: () => void }) {
  const { user } = useRole()
  const { updateDossier, addEvent } = useStore()
  const p = d.proposition!
  const [choice, setChoice] = React.useState("0")
  const [autreDate, setAutreDate] = React.useState("")
  const [lieu, setLieu] = React.useState(p.lieu)
  const date = choice === "autre" ? fromDateInput(autreDate) : p.dates[Number(choice)]
  const convoques = d.expertise.aConvoquer ?? []

  function convoquer() {
    const now = new Date().toISOString()
    const doc = { id: `d${Date.now()}`, name: `Convocation expertise — ${d.vehicule.immat}.pdf`, category: "courrier" as const, addedBy: user.id, addedAt: now, docDate: now, size: "95 Ko" }
    const reached = STATUS_ORDER.indexOf(d.status) >= STATUS_ORDER.indexOf("attente_expertise")
    updateDossier(d.id, (x) => ({
      ...x,
      status: reached ? x.status : "attente_expertise",
      expertise: { ...x.expertise, date, lieu: lieu.trim(), convoques },
      documents: [...x.documents, doc],
      pilotage: {
        ...x.pilotage,
        ouEnEst: "Expertise programmée, convocations envoyées à toutes les parties.",
        attente: "Réalisation de l'expertise sur site",
        prochaineAction: "Réaliser l'expertise et déposer le PV sous 24 h",
        quiDoitAgir: "expert",
        echeance: date,
      },
    }))
    addEvent(d.id, {
      kind: "expertise",
      author: user.id,
      title: "Convocations envoyées",
      body: `Expertise le ${formatDateTime(date)}, ${lieu.trim()} — ${convoques.map((id) => convoqueName(d, id)).join(", ")}`,
    })
    addEvent(d.id, { kind: "document", author: "system", title: "Convocation générée", body: doc.name })
    if (!reached) addEvent(d.id, { kind: "status", author: "system", title: "Statut → En attente expertise" })
    toast.success("Convocations envoyées", { description: `${convoques.length} personne${convoques.length > 1 ? "s" : ""} convoquée${convoques.length > 1 ? "s" : ""}. Le document est dans le dossier.` })
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Programmer l&apos;expertise</DialogTitle>
          <DialogDescription>Appelez le lieu pour vérifier ses disponibilités, puis générez les convocations.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5">
          <PropositionRows dossier={d} withDates={false} className="rounded-lg border bg-muted/40 p-3" />
          <Field>
            <FieldLabel>Date retenue *</FieldLabel>
            <RadioGroup value={choice} onValueChange={(c) => setChoice(c as string)}>
              {p.dates.map((iso, i) => (
                <div key={i} className="flex items-center gap-2">
                  <RadioGroupItem id={`g-d-${i}`} value={String(i)} />
                  <Label htmlFor={`g-d-${i}`} className="font-normal">
                    <span className="first-letter:uppercase">{formatLongDate(iso)}</span>
                    <span className="text-muted-foreground">· {i === 0 ? "1er choix" : `${i + 1}e choix`}</span>
                  </Label>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <RadioGroupItem id="g-d-autre" value="autre" />
                <Label htmlFor="g-d-autre" className="font-normal">Autre date, convenue avec le client</Label>
              </div>
            </RadioGroup>
            {choice === "autre" && (
              <DateInput withTime aria-label="Autre date" value={autreDate} onChange={setAutreDate} min={toDateTimeInput(new Date().toISOString())} />
            )}
          </Field>
          <Field>
            <FieldLabel htmlFor="g-lieu">Lieu *</FieldLabel>
            <Input id="g-lieu" value={lieu} onChange={(e) => setLieu(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={convoquer} disabled={!date || !lieu.trim() || !convoques.length}>Générer les convocations</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Contenu du formulaire de l'expert (honoraires, motif, lieu, convoqués, dates) — sans les dates quand on les choisit à côté */
function PropositionRows({ dossier: d, withDates = true, className }: { dossier: Dossier; withDates?: boolean; className?: string }) {
  const p = d.proposition!
  const rows = [
    ["Honoraires", eur(p.honoraires)] as [string, React.ReactNode],
    ["Motif", p.motif],
    ["Lieu", <span key="l">{p.lieu}<span className="block text-xs text-muted-foreground">{p.lieuConfirme ? "Lieu proposé par le client, confirmé" : "Autre lieu proposé par l'expert"}</span></span>],
    ["À convoquer", (d.expertise.aConvoquer ?? []).map((id) => convoqueName(d, id)).join(", ")],
    withDates && [
      "Dates proposées",
      <ol key="d" className="flex flex-col gap-0.5">
        {p.dates.map((iso, i) => (
          <li key={i}>
            <span className="text-muted-foreground">{i + 1}.</span> <span className="first-letter:uppercase">{formatLongDate(iso)}</span>
          </li>
        ))}
      </ol>,
    ],
  ].filter((r): r is [string, React.ReactNode] => !!r)
  return (
    <dl className={cn("grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-sm", className)}>
      {rows.map(([k, v]) => (
        <React.Fragment key={k}>
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0">{v}</dd>
        </React.Fragment>
      ))}
    </dl>
  )
}

/** Onglet Expertise (pilotage) : lieu souhaité par le client et formulaire de l'expert */
export function PreparationCard({ dossier: d, onProgrammer }: { dossier: Dossier; onProgrammer?: () => void }) {
  const [programmer, setProgrammer] = React.useState(false)
  if (!d.lieuClient && !d.proposition) return null
  const expert = getUser(d.proposition?.expert)
  const programmee = !!d.expertise.date
  return (
    <Card size="sm">
      {programmer && <ProgrammerDialog dossier={d} onClose={() => setProgrammer(false)} />}
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Préparation de l&apos;expertise
          <span
            className={cn(
              "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap",
              programmee ? "bg-tone-done-bg text-tone-done" : "bg-tone-waiting-bg text-tone-waiting",
            )}
          >
            <span className={cn("size-1.5 rounded-full", programmee ? "bg-tone-done" : "bg-tone-waiting")} />
            {programmee ? "Programmée" : "Non programmée"}
          </span>
        </CardTitle>
        {!programmee && onProgrammer && (
          <CardAction>
            {/* Proposition de l'expert reçue : même modale que la bannière */}
            <Button size="sm" onClick={d.proposition ? () => setProgrammer(true) : onProgrammer}>
              <CalendarDays /> Programmer l&apos;expertise
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <section className="flex flex-col gap-2 rounded-lg border p-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <User className="size-4 text-muted-foreground" /> Demande du client
          </p>
          <div className="flex gap-2 text-sm">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            {d.lieuClient ? (
              <span>
                <span className="text-muted-foreground">Lieu souhaité : </span>
                {[d.lieuClient.nom, d.lieuClient.adresse].filter(Boolean).join(", ")}
              </span>
            ) : (
              <span className="text-muted-foreground">Le client n&apos;a pas indiqué de lieu.</span>
            )}
          </div>
        </section>
        <section className="flex flex-col gap-2 rounded-lg border p-3">
          <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
            <SearchCheck className="size-4 text-muted-foreground" />
            Renseigné par l&apos;expert{expert ? ` · ${fullName(expert)}` : ""}
            {d.proposition && <span className="font-normal text-muted-foreground">· {formatDateTime(d.proposition.at)}</span>}
          </p>
          {d.proposition ? (
            <PropositionRows dossier={d} />
          ) : (
            <p className="text-sm text-muted-foreground">L&apos;expert n&apos;a pas encore rempli son formulaire.</p>
          )}
        </section>
      </CardContent>
    </Card>
  )
}
