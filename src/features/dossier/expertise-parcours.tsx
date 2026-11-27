"use client"

import * as React from "react"
import { toast } from "sonner"
import { CalendarCheck, CalendarDays, FileSignature, FileText, Hourglass, MapPin, Plus, SearchCheck, User, UserPlus } from "lucide-react"

import { useRole } from "@/components/app-shell/role-context"
import { DateInput } from "@/components/date-input"
import { SimpleSelect } from "@/components/simple-select"
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
  QUALITES_INTERVENANT,
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
import { useDossierCabinet } from "@/lib/annuaire"
import { buildDevis, nextNumber, pieceNumero } from "@/lib/facturation"
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

/** Personnes du dossier qu'on peut convoquer : client, réparateur, suiveurs (jamais l'expert qui mène l'expertise) */
function convocables(d: Dossier): { id: string; label: string; detail: string }[] {
  const people = [d.intervenants.reparateur, ...d.intervenants.suiveurs]
    .map((id) => getUser(id))
    .filter((u) => !!u)
    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))
    .map((u) => ({
      id: u.id,
      label: fullName(u) || u.structure,
      detail: u.role === "expert" ? "Expert" : u.role === "reparateur" ? `Réparateur${u.structure && fullName(u) ? ` · ${u.structure}` : ""}` : u.fonction || "Intervenant suiveur",
    }))
  const parties = (d.parties ?? []).map((p) => ({
    id: p.id,
    label: p.kind === "morale" ? (p.societe ?? "Société") : [p.firstName, p.lastName].filter(Boolean).join(" ") || p.societe || "Intervenant",
    detail: p.qualite === "Autre" && p.qualiteAutre ? p.qualiteAutre : p.qualite,
  }))
  return [{ id: clientConvoqueId(d), label: personneName(d.client), detail: "Client" }, ...people, ...parties]
}

export function convoqueName(d: Dossier, id: string): string {
  if (id === clientConvoqueId(d)) return personneName(d.client)
  const u = getUser(id)
  if (u) return fullName(u) || u.structure
  const p = d.parties?.find((x) => x.id === id)
  return p ? (p.kind === "morale" ? (p.societe ?? "Société") : [p.firstName, p.lastName].filter(Boolean).join(" ") || p.societe || "Intervenant") : id
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
  const { dossiers, updateDossier, addEvent } = useStore()
  const cabinet = useDossierCabinet(d)
  // L'expert qui mène l'expertise n'est pas convoqué : la liste de départ reprend le client et le réparateur
  const people = convocables(d)
  const [honoraires, setHonoraires] = React.useState("")
  const [secondeOn, setSecondeOn] = React.useState(false)
  const [seconde, setSeconde] = React.useState({ montant: "", acte: "info" as "info" | "acte" })
  const [convoques, setConvoques] = React.useState<string[]>(people.filter((p) => p.id === clientConvoqueId(d) || p.id === d.intervenants.reparateur).map((p) => p.id))
  const [motifs, setMotifs] = React.useState<Record<string, string>>({})
  const [lieuMode, setLieuMode] = React.useState<"client" | "autre">(d.lieuClient ? "client" : "autre")
  const [lieuConvenu, setLieuConvenu] = React.useState(false)
  const [autre, setAutre] = React.useState({ nom: "", adresse: "", cp: "", ville: "", phone: "", phone2: "", email: "", email2: "" })
  const [dates, setDates] = React.useState(["", "", ""])
  const [dateConvenue, setDateConvenue] = React.useState(false)
  const [confirme, setConfirme] = React.useState(false)
  const [observations, setObservations] = React.useState("")
  // Personnes ajoutées par l'expert : elles deviennent des intervenants du dossier à l'envoi
  const [extras, setExtras] = React.useState<NewPerson[]>([])
  const [addOpen, setAddOpen] = React.useState(false)
  const [nv, setNv] = React.useState<Omit<NewPerson, "tmp">>(EMPTY_PERSON)
  const lieuClient = d.lieuClient ? [d.lieuClient.nom, d.lieuClient.adresse].filter(Boolean).join(", ") : ""
  const autreComplet = !!(autre.nom.trim() && autre.adresse.trim() && /^\d{5}$/.test(autre.cp) && autre.ville.trim())
  const lieu = lieuMode === "client" ? lieuClient : autreComplet ? `${autre.nom.trim()}, ${autre.adresse.trim()}, ${autre.cp} ${autre.ville.trim()}` : ""
  const amount = Number(honoraires.replace(",", "."))
  const secondeMontant = secondeOn ? Number(seconde.montant.replace(",", ".")) || 0 : 0
  const totalHt = (amount > 0 ? amount : 0) + (secondeMontant > 0 && seconde.acte === "acte" ? secondeMontant : 0)
  const singleDate = dates.filter(Boolean).length === 1
  const allPeople = [...people, ...extras.map((e) => ({ id: e.tmp, label: newPersonName(e), detail: qualiteLabel(e) }))]
  const motifsOk = convoques.every((id) => motifs[id]?.trim())
  const valid = amount > 0 && convoques.length > 0 && motifsOk && !!lieu && !!dates[0] && (!secondeOn || secondeMontant > 0)
  const nvOk = !!nv.qualite && (nv.qualite !== "Autre" || !!nv.qualiteAutre.trim()) && (nv.kind === "morale" ? !!nv.societe.trim() : !!(nv.prenom.trim() || nv.nom.trim()))

  function addExtra() {
    if (!nvOk) return
    const tmp = `new-${extras.length + 1}`
    setExtras((all) => [...all, { tmp, ...nv }])
    setConvoques((all) => [...all, tmp])
    setNv(EMPTY_PERSON)
    setAddOpen(false)
  }

  function send() {
    // Les dates restent par ordre de priorité, sans trou
    const isoDates = dates.filter(Boolean).map((v) => fromDateInput(v)!)
    const devisNumber = nextNumber("devis", dossiers.map((x) => x.facturation))
    updateDossier(d.id, (x) => {
      // Les personnes ajoutées rejoignent les intervenants du dossier (ids définitifs)
      const base = Math.max(0, ...(x.parties ?? []).map((p) => Number(p.id.slice(1)) || 0))
      const ids = Object.fromEntries(extras.map((e, i) => [e.tmp, `p${base + i + 1}`]))
      const newParties = extras.map((e) => ({
        id: ids[e.tmp],
        qualite: e.qualite,
        qualiteAutre: e.qualite === "Autre" ? e.qualiteAutre.trim() || undefined : undefined,
        kind: e.kind === "morale" ? ("morale" as const) : undefined,
        firstName: e.kind === "physique" ? e.prenom.trim() || undefined : undefined,
        lastName: e.kind === "physique" ? e.nom.trim() || undefined : undefined,
        societe: e.kind === "morale" ? e.societe.trim() : undefined,
        address: e.kind === "morale" ? e.adresse.trim() || undefined : undefined,
        email: e.email.trim() || undefined,
      }))
      const finalMotifs = Object.fromEntries(convoques.map((id) => [ids[id] ?? id, motifs[id].trim()]))
      // Le devis se génère dès que l'expert renseigne ses honoraires
      const devis = buildDevis(x, {
        honoraires: amount,
        seconde: secondeMontant > 0 ? { montant: secondeMontant, acte: seconde.acte === "acte" } : undefined,
        lieu,
        number: devisNumber,
      })
      const devisDoc = { id: `d${Date.now()}`, name: `Devis ${pieceNumero(devis)} — ${x.vehicule.immat}.pdf`, category: "devis" as const, addedBy: user.id, addedAt: devis.createdAt, docDate: devis.createdAt, size: "95 Ko" }
      const f = x.facturation ?? { pieces: [], paiements: [], liens: [] }
      return {
        ...x,
        parties: [...(x.parties ?? []), ...newParties],
        documents: [...x.documents, devisDoc],
        facturation: { ...f, pieces: [devis, ...f.pieces] },
        validation: { ...clientValidation(x), devis: "en_attente" as const },
        proposition: {
          at: new Date().toISOString(),
          expert: user.id,
          honoraires: amount,
          lieu,
          lieuConfirme: lieuMode === "client",
          lieuConvenu: lieuConvenu || undefined,
          ...(lieuMode === "autre" && {
            lieuPhone: autre.phone.trim() || undefined,
            lieuPhone2: autre.phone2.trim() || undefined,
            lieuEmail: autre.email.trim() || undefined,
            lieuEmail2: autre.email2.trim() || undefined,
          }),
          dates: isoDates,
          dateConvenue: (isoDates.length === 1 && (dateConvenue || confirme)) || undefined,
          secondeExpertise: secondeMontant > 0 ? { montant: secondeMontant, acte: seconde.acte === "acte" } : undefined,
          confirmeTelephone: confirme || undefined,
          observations: observations.trim() || undefined,
        },
        expertise: { ...x.expertise, aConvoquer: convoques.map((id) => ids[id] ?? id), motifs: finalMotifs },
        pilotage: {
          ...x.pilotage,
          ouEnEst: "Mission acceptée par l'expert. Devis généré.",
          attente: "Programmation de l'expertise et signature du devis par le client",
          prochaineAction: "Appeler le lieu d'expertise et générer les convocations",
          quiDoitAgir: x.intervenants.gestionnaire ? "gestionnaire" : "nereids",
        },
      }
    })
    addEvent(d.id, { kind: "expertise", author: user.id, title: "Mission acceptée par l'expert", body: "Honoraires renseignés : devis généré. Dates et lieu d'expertise proposés au gestionnaire." })
    toast.success("Proposition envoyée au gestionnaire", { description: `Le devis${cabinet ? ` de ${cabinet.nom}` : ""} a été généré et envoyé au client pour signature.` })
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:w-full sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Accepter la mission</DialogTitle>
          <DialogDescription>
            Proposez vos conditions d&apos;expertise. Vos honoraires génèrent le devis, envoyé au client pour signature. Le gestionnaire vérifie les disponibilités du lieu, retient l&apos;une de vos dates et envoie les convocations.
          </DialogDescription>
        </DialogHeader>

        <FormSection n={1} title="Honoraires" hint="Ils génèrent le devis du client">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="p-honoraires">Honoraires d&apos;expertise HT *</FieldLabel>
                <div className="relative">
                  <Input id="p-honoraires" inputMode="decimal" placeholder="0,00" value={honoraires} onChange={(e) => setHonoraires(e.target.value)} className="h-10 pr-14 text-base tabular-nums" />
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">€ HT</span>
                </div>
                {amount > 0 && <FieldDescription>Soit {eur(amount * 1.2)} TTC (TVA 20 %)</FieldDescription>}
              </Field>

              <div className="rounded-lg border bg-card">
                <label className="flex cursor-pointer items-start gap-3 p-3">
                  <Checkbox className="mt-0.5" checked={secondeOn} onCheckedChange={(c) => setSecondeOn(!!c)} />
                  <span className="text-sm">
                    <span className="block font-medium">Prévoir une deuxième expertise</span>
                    <span className="block text-xs text-muted-foreground">Une ligne « Si deuxième expertise » sera ajoutée au devis.</span>
                  </span>
                </label>
                {secondeOn && (
                  <div className="flex flex-col gap-3 border-t bg-muted/30 p-3">
                    <Field>
                      <FieldLabel htmlFor="p-seconde">Montant de la deuxième expertise *</FieldLabel>
                      <div className="relative">
                        <Input id="p-seconde" inputMode="decimal" placeholder="0,00" value={seconde.montant} onChange={(e) => setSeconde((s) => ({ ...s, montant: e.target.value }))} className="pr-14 tabular-nums" />
                        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">€ HT</span>
                      </div>
                    </Field>
                    <RadioGroup value={seconde.acte} onValueChange={(v) => setSeconde((s) => ({ ...s, acte: v as "info" | "acte" }))} className="grid gap-2">
                      {(
                        [
                          ["info", "À titre d'information", "Affiché sur le devis, non compté dans le total"],
                          ["acte", "Acté", "Compté dans le total du devis"],
                        ] as const
                      ).map(([v, label, hint]) => (
                        <label key={v} className={cn("flex cursor-pointer items-start gap-2 rounded-lg border bg-card p-2.5 text-sm transition-colors", seconde.acte === v && "border-brand bg-brand-soft/60")}>
                          <RadioGroupItem value={v} className="mt-0.5" />
                          <span>
                            <span className="block font-medium">{label}</span>
                            <span className="block text-xs text-muted-foreground">{hint}</span>
                          </span>
                        </label>
                      ))}
                    </RadioGroup>
                  </div>
                )}
              </div>
            </div>

            {/* Aperçu en direct de ce que verra le client sur son devis */}
            <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Aperçu du devis</p>
              <div className="flex items-start justify-between gap-3">
                <span>Expertise — {d.vehicule.marque} {d.vehicule.modele}</span>
                <span className="shrink-0 font-medium tabular-nums">{amount > 0 ? eur(amount) : "—"}</span>
              </div>
              {secondeOn && secondeMontant > 0 && (
                <div className={cn("flex items-start justify-between gap-3", seconde.acte === "info" && "text-muted-foreground")}>
                  <span>
                    Si deuxième expertise
                    {seconde.acte === "info" && <span className="block text-xs">À titre d&apos;information</span>}
                  </span>
                  <span className="shrink-0 tabular-nums">{eur(secondeMontant)}</span>
                </div>
              )}
              <div className="mt-auto flex flex-col gap-0.5 border-t pt-2 text-xs text-muted-foreground">
                <div className="flex justify-between"><span>Total HT</span><span className="tabular-nums">{eur(totalHt)}</span></div>
                <div className="flex justify-between"><span>TVA 20 %</span><span className="tabular-nums">{eur(totalHt * 0.2)}</span></div>
                <div className="flex justify-between text-sm font-semibold text-foreground"><span>Total TTC</span><span className="tabular-nums">{eur(totalHt * 1.2)}</span></div>
              </div>
            </div>
          </div>
        </FormSection>

        <FormSection n={2} title="Personnes à convoquer *" hint="Un motif par personne">
          <div className="flex flex-col gap-2">
            {allPeople.map((p) => {
              const on = convoques.includes(p.id)
              return (
                <div key={p.id} className={cn("flex flex-col gap-2 rounded-lg border bg-card p-3 transition-colors", on && "border-brand bg-brand-soft/60")}>
                  <label className="flex cursor-pointer items-center gap-3">
                    <Checkbox checked={on} onCheckedChange={(c) => setConvoques((all) => (c ? [...all, p.id] : all.filter((id) => id !== p.id)))} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{p.label}</span>
                      <span className="block text-xs text-muted-foreground">{p.detail}</span>
                    </span>
                  </label>
                  <Field className="pl-7">
                    <FieldLabel htmlFor={`p-motif-${p.id}`} className="text-xs text-muted-foreground">Motif de la convocation{on ? " *" : ""}</FieldLabel>
                    <Input
                      id={`p-motif-${p.id}`}
                      value={motifs[p.id] ?? ""}
                      placeholder="Ex. constater les dommages et chiffrer la réparation"
                      // Saisir un motif coche la personne : elle sera convoquée
                      onChange={(e) => {
                        setMotifs((m) => ({ ...m, [p.id]: e.target.value }))
                        if (e.target.value.trim() && !on) setConvoques((all) => [...all, p.id])
                      }}
                    />
                  </Field>
                </div>
              )
            })}
          </div>
          {!addOpen ? (
            <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setAddOpen(true)}>
              <Plus /> Ajouter une personne à convoquer
            </Button>
          ) : (
            <div className="grid gap-3 rounded-lg bg-muted/50 p-3 sm:grid-cols-2">
              <Field className="sm:col-span-2">
                <FieldLabel>Type de personne</FieldLabel>
                <RadioGroup value={nv.kind} onValueChange={(v) => setNv((a) => ({ ...a, kind: v as "physique" | "morale" }))} className="flex gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <RadioGroupItem value="physique" /> Personne physique
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <RadioGroupItem value="morale" /> Personne morale
                  </label>
                </RadioGroup>
              </Field>
              <Field className={nv.qualite === "Autre" ? undefined : "sm:col-span-2"}>
                <FieldLabel>Qualité *</FieldLabel>
                <SimpleSelect placeholder="Client, vendeur du véhicule, réparateur…" value={nv.qualite || null} onChange={(v) => setNv((a) => ({ ...a, qualite: v ?? "" }))} options={QUALITES_INTERVENANT.map((q) => ({ value: q, label: q }))} />
              </Field>
              {nv.qualite === "Autre" && (
                <Field>
                  <FieldLabel htmlFor="p-n-autre">Précisez la qualité *</FieldLabel>
                  <Input id="p-n-autre" value={nv.qualiteAutre} onChange={(e) => setNv((a) => ({ ...a, qualiteAutre: e.target.value }))} />
                </Field>
              )}
              {nv.kind === "physique" ? (
                <>
                  <Field>
                    <FieldLabel htmlFor="p-n-prenom">Prénom</FieldLabel>
                    <Input id="p-n-prenom" value={nv.prenom} onChange={(e) => setNv((a) => ({ ...a, prenom: e.target.value }))} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="p-n-nom">Nom *</FieldLabel>
                    <Input id="p-n-nom" value={nv.nom} onChange={(e) => setNv((a) => ({ ...a, nom: e.target.value }))} />
                  </Field>
                </>
              ) : (
                <>
                  <Field>
                    <FieldLabel htmlFor="p-n-soc">Nom de la société *</FieldLabel>
                    <Input id="p-n-soc" value={nv.societe} onChange={(e) => setNv((a) => ({ ...a, societe: e.target.value }))} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="p-n-adresse">Adresse postale</FieldLabel>
                    <Input id="p-n-adresse" value={nv.adresse} onChange={(e) => setNv((a) => ({ ...a, adresse: e.target.value }))} />
                  </Field>
                </>
              )}
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="p-n-mail">E-mail</FieldLabel>
                <Input id="p-n-mail" type="email" value={nv.email} onChange={(e) => setNv((a) => ({ ...a, email: e.target.value }))} />
                <FieldDescription>Facultatif : n&apos;empêche pas l&apos;envoi de la proposition.</FieldDescription>
              </Field>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="button" size="sm" onClick={addExtra} disabled={!nvOk}>
                  Ajouter
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setAddOpen(false)}>
                  Annuler
                </Button>
              </div>
            </div>
          )}
        </FormSection>

        <FormSection n={3} title="Lieu de l'expertise *">
          {d.lieuClient ? (
            <RadioGroup value={lieuMode} onValueChange={(v) => setLieuMode(v as "client" | "autre")} className="grid gap-2">
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
                <Input id="p-l-cp" inputMode="numeric" maxLength={5} value={autre.cp} onChange={(e) => setAutre((a) => ({ ...a, cp: e.target.value.replace(/\D/g, "") }))} />
              </Field>
              <Field>
                <FieldLabel htmlFor="p-l-ville">Ville</FieldLabel>
                <Input id="p-l-ville" value={autre.ville} onChange={(e) => setAutre((a) => ({ ...a, ville: e.target.value }))} />
              </Field>
              <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="p-l-tel">Téléphone du lieu</FieldLabel>
                  <Input id="p-l-tel" type="tel" value={autre.phone} onChange={(e) => setAutre((a) => ({ ...a, phone: e.target.value }))} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="p-l-tel2">Deuxième téléphone</FieldLabel>
                  <Input id="p-l-tel2" type="tel" value={autre.phone2} onChange={(e) => setAutre((a) => ({ ...a, phone2: e.target.value }))} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="p-l-mail">E-mail du lieu</FieldLabel>
                  <Input id="p-l-mail" type="email" value={autre.email} onChange={(e) => setAutre((a) => ({ ...a, email: e.target.value }))} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="p-l-mail2">Deuxième e-mail</FieldLabel>
                  <Input id="p-l-mail2" type="email" value={autre.email2} onChange={(e) => setAutre((a) => ({ ...a, email2: e.target.value }))} />
                </Field>
              </div>
            </div>
          )}
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border bg-card p-3 text-sm">
            <Checkbox checked={lieuConvenu} onCheckedChange={(c) => setLieuConvenu(!!c)} />
            <span>Lieu convenu avec le client</span>
          </label>
        </FormSection>

        <FormSection n={4} title="Dates proposées *" hint="Une seule date suffit">
          <div className="flex flex-col gap-2">
            {/* Accord confirmé par téléphone : une seule date, déjà convenue avec le client */}
            {dates.map((v, i) => (confirme && i > 0 ? null : (
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
            )))}
          </div>
          {singleDate && !confirme && (
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border bg-card p-3 text-sm">
              <Checkbox checked={dateConvenue} onCheckedChange={(c) => setDateConvenue(!!c)} />
              <span>Date convenue avec le client</span>
            </label>
          )}
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 text-sm">
            <Checkbox
              className="mt-0.5"
              checked={confirme}
              onCheckedChange={(c) => {
                setConfirme(!!c)
                // Une seule date : les autres choix sont retirés
                if (c) setDates((all) => [all[0], "", ""])
              }}
            />
            <span>J&apos;ai joint par téléphone le client et le lieu d&apos;expertise : ils confirment leur accord sur la date d&apos;expertise (date unique, convenue avec le client).</span>
          </label>
        </FormSection>

        <FormSection n={5} title="Observations">
          <DictableTextarea id="p-obs" label="Observations (facultatif)" rows={3} placeholder="Précisions pour le gestionnaire…" value={observations} onValueChange={setObservations} />
        </FormSection>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={send} disabled={!valid}>Accepter et envoyer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Personne ajoutée à la main par l'expert */
type NewPerson = { tmp: string; kind: "physique" | "morale"; qualite: string; qualiteAutre: string; prenom: string; nom: string; societe: string; adresse: string; email: string }
const EMPTY_PERSON: Omit<NewPerson, "tmp"> = { kind: "physique", qualite: "", qualiteAutre: "", prenom: "", nom: "", societe: "", adresse: "", email: "" }
const newPersonName = (e: Omit<NewPerson, "tmp">) => (e.kind === "morale" ? e.societe.trim() : [e.prenom.trim(), e.nom.trim()].filter(Boolean).join(" "))
const qualiteLabel = (e: Omit<NewPerson, "tmp">) => (e.qualite === "Autre" ? e.qualiteAutre.trim() || "Autre" : e.qualite)

// ─── Gestionnaire : programmer l'expertise et convoquer ──────────────────────

function ProgrammerDialog({ dossier: d, onClose }: { dossier: Dossier; onClose: () => void }) {
  const { user } = useRole()
  const { updateDossier, addEvent } = useStore()
  const p = d.proposition!
  const [choice, setChoice] = React.useState("0")
  const [autreDate, setAutreDate] = React.useState("")
  const [lieu, setLieu] = React.useState(p.lieu)
  const [lieuCoord, setLieuCoord] = React.useState({
    phone: d.expertise.lieuPhone ?? p.lieuPhone ?? "",
    phone2: d.expertise.lieuPhone2 ?? p.lieuPhone2 ?? "",
    email: d.expertise.lieuEmail ?? p.lieuEmail ?? "",
    email2: d.expertise.lieuEmail2 ?? p.lieuEmail2 ?? "",
  })
  const date = choice === "autre" ? fromDateInput(autreDate) : p.dates[Number(choice)]
  const convoques = d.expertise.aConvoquer ?? []

  // Programmer fixe la date et le lieu ; chaque convocation se génère ensuite pour une personne, depuis l'onglet Expertise
  function convoquer() {
    const reached = STATUS_ORDER.indexOf(d.status) >= STATUS_ORDER.indexOf("convocation_a_faire")
    updateDossier(d.id, (x) => ({
      ...x,
      status: reached ? x.status : "convocation_a_faire",
      expertise: {
        ...x.expertise,
        date,
        lieu: lieu.trim(),
        lieuPhone: lieuCoord.phone.trim() || undefined,
        lieuPhone2: lieuCoord.phone2.trim() || undefined,
        lieuEmail: lieuCoord.email.trim() || undefined,
        lieuEmail2: lieuCoord.email2.trim() || undefined,
      },
      pilotage: {
        ...x.pilotage,
        ouEnEst: "Expertise programmée, convocations à générer.",
        attente: "Convocation de chaque personne",
        prochaineAction: "Générer la convocation de chaque personne à convoquer (onglet Expertise)",
        quiDoitAgir: x.intervenants.gestionnaire ? "gestionnaire" : "nereids",
        echeance: date,
      },
    }))
    addEvent(d.id, {
      kind: "expertise",
      author: user.id,
      title: "Expertise programmée",
      body: `Le ${formatDateTime(date)}, ${lieu.trim()} — à convoquer : ${convoques.map((id) => convoqueName(d, id)).join(", ")}`,
    })
    if (!reached) addEvent(d.id, { kind: "status", author: "system", title: "Statut → Convocation à faire" })
    toast.success("Expertise programmée", { description: "Générez maintenant la convocation de chaque personne, dans l'onglet Expertise." })
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Programmer l&apos;expertise</DialogTitle>
          <DialogDescription>Appelez le lieu pour vérifier ses disponibilités, puis programmez l&apos;expertise. Les convocations se génèrent ensuite, une par personne.</DialogDescription>
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
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="g-lieu-tel">Téléphone du lieu</FieldLabel>
              <Input id="g-lieu-tel" type="tel" value={lieuCoord.phone} onChange={(e) => setLieuCoord((c) => ({ ...c, phone: e.target.value }))} />
            </Field>
            <Field>
              <FieldLabel htmlFor="g-lieu-tel2">Deuxième téléphone du lieu</FieldLabel>
              <Input id="g-lieu-tel2" type="tel" value={lieuCoord.phone2} onChange={(e) => setLieuCoord((c) => ({ ...c, phone2: e.target.value }))} />
            </Field>
            <Field>
              <FieldLabel htmlFor="g-lieu-mail">E-mail du lieu</FieldLabel>
              <Input id="g-lieu-mail" type="email" value={lieuCoord.email} onChange={(e) => setLieuCoord((c) => ({ ...c, email: e.target.value }))} />
            </Field>
            <Field>
              <FieldLabel htmlFor="g-lieu-mail2">Deuxième e-mail du lieu</FieldLabel>
              <Input id="g-lieu-mail2" type="email" value={lieuCoord.email2} onChange={(e) => setLieuCoord((c) => ({ ...c, email2: e.target.value }))} />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={convoquer} disabled={!date || !lieu.trim() || !convoques.length}>Programmer l&apos;expertise</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Contenu du formulaire de l'expert (honoraires, motif, lieu, convoqués, dates) — sans les dates quand on les choisit à côté */
function PropositionRows({ dossier: d, withDates = true, className }: { dossier: Dossier; withDates?: boolean; className?: string }) {
  const p = d.proposition!
  const rows = [
    ["Honoraires", eur(p.honoraires) + " HT"] as [string, React.ReactNode],
    p.secondeExpertise && [
      "Si 2e expertise",
      <span key="s2">
        {eur(p.secondeExpertise.montant)} HT
        <span className="block text-xs text-muted-foreground">{p.secondeExpertise.acte ? "Acté : compté dans le devis" : "À titre d'information : hors total du devis"}</span>
      </span>,
    ],
    ["Lieu", <span key="l">{p.lieu}<span className="block text-xs text-muted-foreground">{[p.lieuConfirme ? "Lieu proposé par le client, confirmé" : "Autre lieu proposé par l'expert", p.lieuConvenu && "convenu avec le client"].filter(Boolean).join(" · ")}</span></span>],
    [
      "À convoquer",
      <ul key="c" className="flex flex-col gap-0.5">
        {(d.expertise.aConvoquer ?? []).map((id) => (
          <li key={id}>
            {convoqueName(d, id)}
            {d.expertise.motifs?.[id] && <span className="block text-xs text-muted-foreground">{d.expertise.motifs[id]}</span>}
          </li>
        ))}
      </ul>,
    ],
    p.confirmeTelephone && ["Accord par téléphone", "Client et lieu d'expertise joints : d'accord sur la date"],
    p.observations && ["Observations", p.observations],
    withDates && [
      "Dates proposées",
      <ol key="d" className="flex flex-col gap-0.5">
        {p.dates.map((iso, i) => (
          <li key={i}>
            <span className="text-muted-foreground">{i + 1}.</span> <span className="first-letter:uppercase">{formatLongDate(iso)}</span>
          </li>
        ))}
        {p.dateConvenue && <li className="text-xs text-muted-foreground">Date convenue avec le client</li>}
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
