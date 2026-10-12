"use client"

import * as React from "react"
import { toast } from "sonner"

import { useRole } from "@/components/app-shell/role-context"
import { SimpleSelect } from "@/components/simple-select"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AssignFields, type AssignValue } from "@/features/admin/create-dossier"
import {
  CLOSING_REASONS,
  DOC_CATEGORIES,
  STATUSES,
  daysFromNow,
  defaultPilotage,
  fullName,
  getUser,
  type DocCategory,
  type Dossier,
  type StatusId,
} from "@/lib/data"
import { useStore } from "@/lib/store"

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
    updateDossier(dossier.id, (d) => ({
      ...d,
      status: s,
      pilotage: { ...p, echeance: p.delayDays ? daysFromNow(p.delayDays) : undefined },
      // Réouverture : la clôture précédente ne s'applique plus
      cloture: s === "cloture" || s === "archive" ? d.cloture : undefined,
    }))
    addEvent(dossier.id, { kind: "status", author: user.id, title: `Statut → ${STATUSES[s].label}`, body: obs || undefined })
    toast.success("Statut mis à jour", { description: "Les intervenants concernés ont été notifiés." })
    setObs("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
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
          <Field>
            <FieldLabel htmlFor="obs">Observation</FieldLabel>
            <Textarea id="obs" rows={3} placeholder="Optionnel — visible dans le suivi" value={obs} onChange={(e) => setObs(e.target.value)} />
          </Field>
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
      <DialogContent className="sm:max-w-md">
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
          <Field>
            <FieldLabel htmlFor="close-comment">Commentaire</FieldLabel>
            <Textarea id="close-comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
          </Field>
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
  const { updateDossier, addEvent } = useStore()
  const initial: AssignValue = {
    gestionnaire: dossier.intervenants.gestionnaire ?? null,
    expert: dossier.intervenants.expert ?? null,
    reparateur: dossier.intervenants.reparateur ?? null,
    suiveur: dossier.intervenants.suiveurs[0] ?? null,
  }
  const [v, setV] = React.useState<AssignValue>(initial)

  function save() {
    const changed = (Object.keys(v) as (keyof AssignValue)[]).filter((k) => v[k] !== initial[k])
    if (!changed.length) return onOpenChange(false)
    const becomesReady = dossier.status === "nouveau" && v.gestionnaire && v.expert
    updateDossier(dossier.id, (d) => ({
      ...d,
      intervenants: {
        gestionnaire: v.gestionnaire ?? undefined,
        expert: v.expert ?? undefined,
        reparateur: v.reparateur ?? undefined,
        suiveurs: v.suiveur ? [v.suiveur, ...d.intervenants.suiveurs.filter((s) => s !== v.suiveur && s !== initial.suiveur)] : d.intervenants.suiveurs.filter((s) => s !== initial.suiveur),
      },
      ...(becomesReady
        ? { status: "en_etude" as const, pilotage: { ...defaultPilotage("en_etude", d.type), echeance: daysFromNow(3) } }
        : {}),
    }))
    addEvent(dossier.id, {
      kind: "assignation",
      author: user.id,
      title: "Intervenants mis à jour",
      body: changed.map((k) => `${LABELS[k]} : ${v[k] ? fullName(getUser(v[k]!)) : "retiré"}`).join(" · "),
    })
    if (becomesReady) addEvent(dossier.id, { kind: "status", author: "system", title: "Statut → En étude" })
    toast.success("Intervenants assignés", { description: "Chaque intervenant a été notifié (plateforme + e-mail)." })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assigner les intervenants</DialogTitle>
          <DialogDescription>
            Le dossier passe « En étude » dès qu&apos;un gestionnaire et un expert sont assignés.
          </DialogDescription>
        </DialogHeader>
        <AssignFields value={v} onChange={(k, val) => setV((p) => ({ ...p, [k]: val }))} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={save}>Assigner et notifier</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const LABELS: Record<keyof AssignValue, string> = {
  gestionnaire: "Gestionnaire",
  expert: "Expert",
  reparateur: "Réparateur",
  suiveur: "Suiveur",
}

// ─── Relancer ────────────────────────────────────────────────────────────────

export function RelanceDialog({ dossier, open, onOpenChange }: DialogProps) {
  const { user } = useRole()
  const { addEvent, updateDossier } = useStore()
  const who = dossier.pilotage.quiDoitAgir
  const target =
    who === "expert" ? getUser(dossier.intervenants.expert) : who === "reparateur" ? getUser(dossier.intervenants.reparateur) : who === "gestionnaire" ? getUser(dossier.intervenants.gestionnaire) : undefined
  const [msg, setMsg] = React.useState(
    `Bonjour${target ? ` ${target.firstName}` : who === "client" ? ` ${dossier.client.firstName}` : ""},\n\nSauf erreur de notre part, nous sommes toujours en attente de : ${dossier.pilotage.attente.toLowerCase()} pour le dossier ${dossier.ref} (${dossier.vehicule.immat}).\n\nMerci de faire le nécessaire dans les meilleurs délais.\n\nBien cordialement,\n${user.firstName} ${user.lastName} — Nereids`,
  )

  function send() {
    addEvent(dossier.id, {
      kind: "relance",
      author: user.id,
      title: `Relance envoyée — ${target ? fullName(target) : who === "client" ? `${dossier.client.firstName} ${dossier.client.lastName}` : "compagnie"}`,
      body: msg.split("\n").filter(Boolean)[1],
      recipients: [who === "nereids" ? "admin" : who],
    })
    updateDossier(dossier.id, (d) => ({ ...d, pilotage: { ...d.pilotage, echeance: daysFromNow(3) } }))
    toast.success("Relance envoyée", { description: "Tracée dans le suivi · nouvelle échéance dans 3 jours." })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Envoyer une relance</DialogTitle>
          <DialogDescription>
            Destinataire : {target ? `${fullName(target)} (${target.structure})` : who === "client" ? `${dossier.client.firstName} ${dossier.client.lastName} (client)` : dossier.compagnie?.nom ?? "compagnie"}
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="relance">Message (modèle modifiable)</FieldLabel>
          <Textarea id="relance" rows={9} value={msg} onChange={(e) => setMsg(e.target.value)} />
          <FieldDescription>Envoyé par e-mail et visible dans le suivi du dossier.</FieldDescription>
        </Field>
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
  const [notify, setNotify] = React.useState(true)

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pré-remplissage à l'ouverture
    if (open) setCat(defaultCategory ?? null)
  }, [open, defaultCategory])

  function save() {
    if (!cat || !file) return
    const now = new Date().toISOString()
    updateDossier(dossier.id, (d) => ({
      ...d,
      documents: [...d.documents, { id: `d${Date.now()}`, name: file, category: cat as DocCategory, addedBy: user.id, addedAt: now, size: "1,4 Mo" }],
    }))
    addEvent(dossier.id, { kind: "document", author: user.id, title: `Document ajouté — ${DOC_CATEGORIES[cat as DocCategory]}`, body: file })
    toast.success("Document ajouté", { description: notify ? "Les intervenants concernés ont été notifiés." : undefined })
    setFile(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter un document</DialogTitle>
          <DialogDescription>Chaque document est classé dans une catégorie.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setFile(cat ? `${DOC_CATEGORIES[cat as DocCategory]} — ${dossier.vehicule.immat}.pdf` : "Document.pdf")}
            className="flex flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground transition-colors hover:border-primary hover:bg-primary/[0.03]"
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
            <SimpleSelect placeholder="Choisir une catégorie" value={cat} onChange={setCat} options={(categories ?? (Object.keys(DOC_CATEGORIES) as DocCategory[])).map((value) => ({ value, label: DOC_CATEGORIES[value] }))} />
          </Field>
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
          <Button onClick={save} disabled={!cat || !file}>
            Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
