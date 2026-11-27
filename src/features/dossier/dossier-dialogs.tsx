"use client"

import * as React from "react"
import { toast } from "sonner"
import { Sparkles } from "lucide-react"

import { useRole } from "@/components/app-shell/role-context"
import { DateInput } from "@/components/date-input"
import { SimpleSelect } from "@/components/simple-select"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogBack,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DictableTextarea } from "@/components/dictable-textarea"
import { AssignFields, NEW_INTERVENANT_FORM, NEW_LABELS, NewIntervenantForm, type AssignValue, type NewRole } from "@/features/admin/create-dossier"
import {
  CLOSING_REASONS,
  DOC_CATEGORIES,
  STATUSES,
  STATUS_ORDER,
  isClosedStatus,
  daysFromNow,
  defaultPilotage,
  fullName,
  getUser,
  type DocCategory,
  type Dossier,
  type StatusId,
  type User,
  personneName,
  withRef,
} from "@/lib/data"
import { useStore } from "@/lib/store"
import { formatDate } from "@/lib/format"
import { suggestName } from "./doc-ai-rename"
import { fromDateInput, toDateInput } from "./dossier-edit"

type DialogProps = { dossier: Dossier; open: boolean; onOpenChange: (o: boolean) => void }

// ─── Modifier le statut ──────────────────────────────────────────────────────

export function StatusDialog({ dossier, open, onOpenChange }: DialogProps) {
  const { user } = useRole()
  const { updateDossier, addEvent } = useStore()
  const [status, setStatus] = React.useState<string | null>(dossier.status)
  const [obs, setObs] = React.useState("")

  function save() {
    if (!status || status === dossier.status) return onOpenChange(false)
    const s = status as StatusId
    const p = defaultPilotage(s, dossier.type)
    // Passé l'étape « En attente PV », l'expert a déposé son PV : on le simule s'il manque
    const rank = (x: StatusId) => STATUS_ORDER.indexOf(x)
    const expert = dossier.intervenants.expert ?? "u-expert"
    const now = new Date().toISOString()
    const pv =
      rank(dossier.status) <= rank("attente_pv") && rank(s) > rank("attente_pv") && !isClosedStatus(s) && !dossier.documents.some((x) => x.category === "pv")
        ? { id: `d${Date.now()}`, name: "PV d'expertise.pdf", category: "pv" as const, addedBy: expert, addedAt: now, docDate: now, size: "310 Ko" }
        : undefined
    updateDossier(dossier.id, (d) => ({
      ...d,
      status: s,
      pilotage: { ...p, echeance: p.delayDays ? daysFromNow(p.delayDays) : undefined },
      // Réouverture : la clôture précédente ne s'applique plus
      cloture: isClosedStatus(s) ? d.cloture : undefined,
      ...(pv && { documents: [...d.documents, pv], expertise: { ...d.expertise, pvDocId: pv.id } }),
    }))
    if (pv) addEvent(dossier.id, { kind: "document", author: expert, title: "PV d'expertise déposé", docIds: [pv.id] })
    addEvent(dossier.id, { kind: "status", author: user.id, title: `Statut → ${STATUSES[s].label}`, body: obs || undefined })
    toast.success("Statut mis à jour", { description: "Les intervenants concernés ont été notifiés." })
    setObs("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Modifier le statut</DialogTitle>
          <DialogDescription>
            Les statuts évoluent normalement automatiquement. Le changement sera tracé dans le suivi.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Statut actuel :</span> <StatusBadge status={dossier.status} />
          </div>
          <Field>
            <FieldLabel>Nouveau statut</FieldLabel>
            <SimpleSelect
              value={status}
              onChange={setStatus}
              options={(Object.keys(STATUSES) as StatusId[]).map((s) => ({ value: s, label: STATUSES[s].label }))}
            />
          </Field>
          <DictableTextarea id="obs" label="Observation" rows={3} placeholder="Optionnel — visible dans le suivi" value={obs} onValueChange={setObs} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={save} disabled={status === dossier.status}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Clôturer ────────────────────────────────────────────────────────────────

export function CloseDialog({ dossier, open, onOpenChange }: DialogProps) {
  const { user } = useRole()
  const { updateDossier, addEvent } = useStore()
  const [motif, setMotif] = React.useState<string | null>(null)
  const [comment, setComment] = React.useState("")

  function save() {
    if (!motif) return
    const now = new Date().toISOString()
    updateDossier(dossier.id, (d) => ({
      ...d,
      status: "cloture",
      cloture: { motif, commentaire: comment || undefined, at: now },
      pilotage: { ...defaultPilotage("cloture", d.type), echeance: undefined },
    }))
    addEvent(dossier.id, { kind: "status", author: user.id, title: "Statut → Clôturé", body: `Motif : ${motif}${comment ? ` — ${comment}` : ""}` })
    toast.success("Dossier clôturé", { description: "Les intervenants ont été notifiés." })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Clôturer le dossier</DialogTitle>
          <DialogDescription>
            Le dossier restera consultable. Il pourra ensuite être archivé.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel>Motif de clôture *</FieldLabel>
            <SimpleSelect placeholder="Choisir un motif" value={motif} onChange={setMotif} options={CLOSING_REASONS.map((m) => ({ value: m, label: m }))} />
          </Field>
          <DictableTextarea id="close-comment" label="Commentaire" rows={3} value={comment} onValueChange={setComment} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={save} disabled={!motif}>
            Clôturer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Assigner ────────────────────────────────────────────────────────────────

export function AssignDialog({ dossier, open, onOpenChange }: DialogProps) {
  const { user } = useRole()
  const { updateDossier, addEvent, inviteUser } = useStore()
  const initial: AssignValue = {
    gestionnaire: dossier.intervenants.gestionnaire ?? null,
    expert: dossier.intervenants.expert ?? null,
    reparateur: dossier.intervenants.reparateur ?? null,
  }
  const [v, setV] = React.useState<AssignValue>(initial)
  const [added, setAdded] = React.useState<User[]>([])
  /** Écran de saisie d'un intervenant hors liste, à la place de l'écran d'assignation */
  const [creating, setCreating] = React.useState<NewRole | null>(null)
  // Au retour de l'écran d'ajout, la modale change de taille : un double-clic sur « Ajouter » ne doit
  // ni la fermer (clic à côté) ni déclencher « Assigner et notifier » (même emplacement)
  const switchedAt = React.useRef(0)
  function showScreen(role: NewRole | null) {
    switchedAt.current = Date.now()
    setCreating(role)
  }
  const justSwitched = () => Date.now() - switchedAt.current < 600

  function save() {
    const changed = (Object.keys(v) as (keyof AssignValue)[]).filter((k) => v[k] !== initial[k])
    if (!changed.length) return onOpenChange(false)
    const becomesReady = dossier.status === "nouveau" && v.gestionnaire && v.expert
    const expert = added.find((u) => u.id === v.expert) ?? getUser(v.expert ?? undefined)
    updateDossier(dossier.id, (d) => withRef({
      ...d,
      intervenants: {
        gestionnaire: v.gestionnaire ?? undefined,
        expert: v.expert ?? undefined,
        reparateur: v.reparateur ?? undefined,
        suiveurs: d.intervenants.suiveurs,
      },
      ...(becomesReady
        ? { status: "en_etude" as const, pilotage: { ...defaultPilotage("en_etude", d.type), echeance: daysFromNow(3) } }
        : {}),
    }, expert))
    // Intervenant ajouté à la main : invité comme depuis « Utilisateurs »
    added.filter((u) => u.id === v.expert || u.id === v.reparateur).forEach(inviteUser)
    addEvent(dossier.id, {
      kind: "assignation",
      author: user.id,
      title: "Intervenants mis à jour",
      body: changed.map((k) => `${LABELS[k]} : ${v[k] ? fullName(getUser(v[k]!) ?? added.find((u) => u.id === v[k])) : "retiré"}`).join(" · "),
    })
    if (becomesReady) addEvent(dossier.id, { kind: "status", author: "system", title: "Statut → En étude" })
    toast.success("Intervenants assignés", { description: "Chaque intervenant a été notifié (plateforme + e-mail)." })
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o, details) => {
        if (!o && details.reason === "outside-press" && justSwitched()) return details.cancel()
        if (!o) setCreating(null)
        onOpenChange(o)
      }}
    >
      <DialogContent size="sm">
        {creating ? (
          <>
            <DialogBack onClick={() => showScreen(null)} />
            <DialogHeader>
              <DialogTitle>{NEW_LABELS[creating].title}</DialogTitle>
              <DialogDescription>Pour un intervenant qui n&apos;est pas encore dans la liste.</DialogDescription>
            </DialogHeader>
            <NewIntervenantForm
              role={creating}
              onAdd={(u) => {
                setAdded((a) => [...a, u])
                setV((p) => ({ ...p, [creating]: u.id }))
                showScreen(null)
              }}
            />
            <DialogFooter>
              <Button type="submit" form={NEW_INTERVENANT_FORM}>
                {NEW_LABELS[creating].submit}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Assigner les intervenants</DialogTitle>
            </DialogHeader>
            <AssignFields value={v} onChange={(k, val) => setV((p) => ({ ...p, [k]: val }))} added={added} onCreate={showScreen} />
            <DialogFooter>
              <Button variant="outline" onClick={() => !justSwitched() && onOpenChange(false)}>
                Annuler
              </Button>
              <Button onClick={() => !justSwitched() && save()}>Assigner et notifier</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

const LABELS: Record<keyof AssignValue, string> = {
  gestionnaire: "Gestionnaire",
  expert: "Expert",
  reparateur: "Réparateur",
}

// ─── Relancer ────────────────────────────────────────────────────────────────

export function RelanceDialog({ dossier, open, onOpenChange }: DialogProps) {
  const { user, role } = useRole()
  const { addEvent, updateDossier } = useStore()
  const who = dossier.pilotage.quiDoitAgir
  const target =
    who === "expert" ? getUser(dossier.intervenants.expert) : who === "reparateur" ? getUser(dossier.intervenants.reparateur) : who === "gestionnaire" ? getUser(dossier.intervenants.gestionnaire) : undefined
  const [msg, setMsg] = React.useState(
    `Bonjour${target ? ` ${target.firstName}` : who === "client" ? ` ${dossier.client.kind === "morale" ? "" : dossier.client.firstName}`.trimEnd() : ""},\n\nSauf erreur de notre part, nous sommes toujours en attente de : ${dossier.pilotage.attente.toLowerCase()} pour le dossier ${dossier.ref} (${dossier.vehicule.immat}).\n\nMerci de faire le nécessaire dans les meilleurs délais.\n\nBien cordialement,\n${user.firstName} ${user.lastName} — ${role.id === "gestionnaire" ? user.structure : "Nereids"}`,
  )

  function send() {
    addEvent(dossier.id, {
      kind: "relance",
      author: user.id,
      title: `Relance envoyée — ${target ? fullName(target) : who === "client" ? personneName(dossier.client) : "compagnie"}`,
      body: msg.split("\n").filter(Boolean)[1],
      recipients: [who === "nereids" ? "admin" : who],
    })
    updateDossier(dossier.id, (d) => ({ ...d, pilotage: { ...d.pilotage, echeance: daysFromNow(3) } }))
    toast.success("Relance envoyée", { description: "Tracée dans le suivi · nouvelle échéance dans 3 jours." })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Envoyer une relance</DialogTitle>
          <DialogDescription>
            Destinataire : {target ? `${fullName(target)} (${target.structure})` : who === "client" ? `${personneName(dossier.client)} (client)` : dossier.compagnie?.nom ?? "compagnie"}
          </DialogDescription>
        </DialogHeader>
        <DictableTextarea
          id="relance"
          label="Message (modèle modifiable)"
          description="Envoyé par e-mail et visible dans le suivi du dossier."
          rows={9}
          value={msg}
          onValueChange={setMsg}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={send}>Envoyer la relance</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Ajouter un document ─────────────────────────────────────────────────────

export function AddDocDialog({
  dossier,
  open,
  onOpenChange,
  defaultCategory,
  categories,
}: DialogProps & { defaultCategory?: DocCategory; categories?: DocCategory[] }) {
  const { user } = useRole()
  const { updateDossier, addEvent } = useStore()
  const [cat, setCat] = React.useState<string | null>(defaultCategory ?? null)
  const [file, setFile] = React.useState<string | null>(null)
  const [libelle, setLibelle] = React.useState("")
  const [notify, setNotify] = React.useState(true)
  // Date figurant sur la pièce : sert au classement des documents (aujourd'hui par défaut)
  const [date, setDate] = React.useState("")

  React.useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pré-remplissage à l'ouverture
    setCat(defaultCategory ?? null)
    setDate(toDateInput(new Date().toISOString()))
  }, [open, defaultCategory])

  // Renommage par l'IA (simulation) : nom normalisé proposé dès que fichier et catégorie sont connus
  const [aiRename, setAiRename] = React.useState(true)
  const [aiName, setAiName] = React.useState<string | null>(null)
  const suggested =
    file && cat && (cat !== "autre" || libelle.trim())
      ? suggestName({ name: file, category: cat as DocCategory, libelle: cat === "autre" ? libelle.trim() : undefined, docDate: fromDateInput(date), addedAt: new Date().toISOString() }, dossier)
      : null
  const finalName = file ? (aiRename ? (aiName ?? suggested ?? file) : file) : ""

  function save() {
    if (!cat || !file || (cat === "autre" && !libelle.trim())) return
    const now = new Date().toISOString()
    const label = cat === "autre" ? libelle.trim() : DOC_CATEGORIES[cat as DocCategory]
    updateDossier(dossier.id, (d) => ({
      ...d,
      documents: [
        ...d.documents,
        { id: `d${Date.now()}`, name: finalName, category: cat as DocCategory, libelle: cat === "autre" ? label : undefined, addedBy: user.id, addedAt: now, docDate: fromDateInput(date) ?? now, size: "1,4 Mo" },
      ],
    }))
    addEvent(dossier.id, { kind: "document", author: user.id, title: `Document ajouté — ${label}`, body: finalName })
    toast.success("Document ajouté", { description: notify ? "Les intervenants concernés ont été notifiés." : undefined })
    setFile(null)
    setAiName(null)
    setLibelle("")
    onOpenChange(false)
  }

  // Alphabétique, « Autre » en dernier ; le rapport de la compagnie n'est plus proposé
  const categoryOptions = (categories ?? (Object.keys(DOC_CATEGORIES) as DocCategory[]))
    .filter((c) => c !== "rapport_compagnie")
    .sort((a, b) => (a === "autre" ? 1 : b === "autre" ? -1 : DOC_CATEGORIES[a].localeCompare(DOC_CATEGORIES[b], "fr")))
    .map((value) => ({ value, label: DOC_CATEGORIES[value] }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Ajouter un document</DialogTitle>
          <DialogDescription>Chaque document est classé dans une catégorie.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setFile(cat ? `${DOC_CATEGORIES[cat as DocCategory]} — ${dossier.vehicule.immat}.pdf` : "Document.pdf")}
            className="flex flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground transition-colors hover:border-brand hover:bg-brand/[0.03]"
          >
            {file ? (
              <span className="font-medium text-foreground">{file}</span>
            ) : (
              <>
                <span className="font-medium text-foreground">Glissez un fichier ici</span>
                <span>ou cliquez pour parcourir (simulation)</span>
              </>
            )}
          </button>
          <Field>
            <FieldLabel>Catégorie *</FieldLabel>
            <SimpleSelect placeholder="Choisir une catégorie" value={cat} onChange={setCat} options={categoryOptions} />
          </Field>
          {cat === "autre" && (
            <Field>
              <FieldLabel htmlFor="doc-libelle">Intitulé du document *</FieldLabel>
              <Input id="doc-libelle" placeholder="Ex. Attestation de l'employeur" value={libelle} onChange={(e) => setLibelle(e.target.value)} />
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="doc-date">Date du document</FieldLabel>
            <p className="-mt-1 text-xs text-muted-foreground">La date inscrite sur le document. La date d&apos;ajout dans le dossier ({formatDate(new Date().toISOString())}) est enregistrée automatiquement.</p>
            <DateInput id="doc-date" value={date} onChange={setDate} />
          </Field>
          {file && (
            <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <Checkbox className="mt-0.5" checked={aiRename} onCheckedChange={(c) => setAiRename(!!c)} />
                <span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <Sparkles className="size-3.5 text-brand-ink" /> Renommer le document avec l&apos;IA
                  </span>
                  <span className="text-xs text-muted-foreground">Date, type, immatriculation et client : le fichier se retrouve facilement.</span>
                </span>
              </label>
              {aiRename &&
                (suggested ? (
                  <Input aria-label="Nom proposé par l'IA" value={aiName ?? suggested} onChange={(e) => setAiName(e.target.value)} className="h-8 bg-background text-sm" />
                ) : (
                  <p className="text-xs text-muted-foreground">Choisissez une catégorie pour obtenir le nom proposé.</p>
                ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Checkbox id="notify" checked={notify} onCheckedChange={(c) => setNotify(!!c)} />
            <Label htmlFor="notify" className="font-normal">
              Notifier les intervenants du dossier
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={save} disabled={!cat || !file || (cat === "autre" && !libelle.trim())}>
            Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
