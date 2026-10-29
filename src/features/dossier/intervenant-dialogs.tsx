"use client"

import * as React from "react"
import { toast } from "sonner"

import { useRole } from "@/components/app-shell/role-context"
import { SimpleSelect } from "@/components/simple-select"
import { Button } from "@/components/ui/button"
import { Dialog, DialogBack, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { NEW_INTERVENANT_FORM, NEW_LABELS, NewIntervenantForm } from "@/features/admin/create-dossier"
import { allUsers, daysFromNow, defaultPilotage, fullName, getUser, withRef, type Dossier, type User } from "@/lib/data"
import { useStore } from "@/lib/store"

/** Poste sur lequel l'admin agit : un des 3 postes, ou un suiveur (identifié par son id ; sans id = nouveau suiveur) */
export type IntervenantSlot = { kind: "gestionnaire" | "expert" | "reparateur" } | { kind: "suiveur"; id?: string }

const LABELS: Record<IntervenantSlot["kind"], { label: string; article: string }> = {
  gestionnaire: { label: "gestionnaire", article: "le" },
  expert: { label: "expert", article: "l'" },
  reparateur: { label: "réparateur", article: "le" },
  suiveur: { label: "intervenant suiveur", article: "l'" },
}

const INDEFINITE: Record<IntervenantSlot["kind"], string> = {
  gestionnaire: "un gestionnaire",
  expert: "un expert",
  reparateur: "un réparateur",
  suiveur: "un intervenant suiveur",
}

const title = (s: IntervenantSlot) => `${LABELS[s.kind].article}${LABELS[s.kind].article.endsWith("'") ? "" : " "}${LABELS[s.kind].label}`

function currentId(d: Dossier, s: IntervenantSlot) {
  return s.kind === "suiveur" ? s.id : d.intervenants[s.kind]
}

/** Remplace (ou retire, si `next` est null) l'intervenant du poste */
function assign(d: Dossier, s: IntervenantSlot, next: string | null): Dossier {
  if (s.kind === "suiveur") {
    const suiveurs = !s.id
      ? [...d.intervenants.suiveurs, ...(next ? [next] : [])]
      : next
        ? d.intervenants.suiveurs.map((id) => (id === s.id ? next : id))
        : d.intervenants.suiveurs.filter((id) => id !== s.id)
    return { ...d, intervenants: { ...d.intervenants, suiveurs } }
  }
  const updated = { ...d, intervenants: { ...d.intervenants, [s.kind]: next ?? undefined } }
  // La référence dossier dépend de l'expert
  return s.kind === "expert" ? withRef(updated, getUser(next ?? undefined)) : updated
}

type Props = { dossier: Dossier; slot: IntervenantSlot | null; onOpenChange: (o: boolean) => void }

// ─── Ajouter / modifier ────────────────────────────────────────────────────────────────

export function EditIntervenantDialog({ dossier: d, slot, onOpenChange }: Props) {
  const { user } = useRole()
  const { updateDossier, addEvent, inviteUser } = useStore()
  const current = slot ? currentId(d, slot) : undefined
  const [v, setV] = React.useState<string | null>(current ?? null)
  // Intervenant saisi à la main (expert ou réparateur hors liste), comme dans « Assigner »
  const [added, setAdded] = React.useState<User[]>([])
  const [creating, setCreating] = React.useState(false)
  // Au retour de l'écran de saisie, un double-clic ne doit ni fermer la modale ni enregistrer
  const switchedAt = React.useRef(0)
  function showCreate(on: boolean) {
    switchedAt.current = Date.now()
    setCreating(on)
  }
  const justSwitched = () => Date.now() - switchedAt.current < 600

  if (!slot) return null
  const role = slot.kind
  const manual = role === "expert" || role === "reparateur" ? role : null
  const find = (id: string | null) => added.find((u) => u.id === id) ?? getUser(id ?? undefined)
  // Un suiveur déjà sur le dossier ne peut pas en remplacer un autre
  const options = [...allUsers(), ...(d.extraIntervenants ?? []), ...added]
    .filter((u, i, all) => u.role === role && all.findIndex((x) => x.id === u.id) === i)
    .filter((u) => role !== "suiveur" || u.id === current || !d.intervenants.suiveurs.includes(u.id))
    .map((u) => ({
      value: u.id,
      label: role === "reparateur" ? u.structure : fullName(u),
      hint: u.load !== undefined ? `${u.load} dossiers` : added.includes(u) ? "Ajouté à la main" : role === "suiveur" ? u.structure : undefined,
    }))

  function save() {
    if (!slot || !v || v === current) return onOpenChange(false)
    const before = getUser(current)
    const after = find(v)
    const extra = added.filter((u) => u.id === v)
    // Comme dans « Assigner » : un dossier nouveau passe en étude dès qu'il a un gestionnaire et un expert
    const next = role === "expert" ? withRef(assign(d, slot, v), after) : assign(d, slot, v)
    const becomesReady = d.status === "nouveau" && !!next.intervenants.gestionnaire && !!next.intervenants.expert
    updateDossier(d.id, (x) => {
      const assigned = assign(x, slot, v)
      const y = role === "expert" ? withRef(assigned, after) : assigned
      return becomesReady ? { ...y, status: "en_etude" as const, pilotage: { ...defaultPilotage("en_etude", y.type), echeance: daysFromNow(3) } } : y
    })
    // Intervenant ajouté à la main : invité comme depuis « Utilisateurs »
    extra.forEach(inviteUser)
    addEvent(d.id, {
      kind: "assignation",
      author: user.id,
      title: before ? "Intervenant modifié" : "Intervenant ajouté au dossier",
      body: `${capitalize(LABELS[slot.kind].label)} : ${before ? `${fullName(before)} → ` : ""}${after ? fullName(after) : "—"}`,
    })
    if (becomesReady) addEvent(d.id, { kind: "status", author: "system", title: "Statut → En étude" })
    toast.success(`${capitalize(LABELS[slot.kind].label)} ${before ? "modifié" : "ajouté"}`, { description: "L'intervenant a été notifié (plateforme + e-mail)." })
    onOpenChange(false)
  }

  return (
    <Dialog
      open
      onOpenChange={(o, details) => {
        if (!o && details.reason === "outside-press" && justSwitched()) return details.cancel()
        onOpenChange(o)
      }}
    >
      <DialogContent size="sm">
        {creating && manual ? (
          <>
            <DialogBack onClick={() => showCreate(false)} />
            <DialogHeader>
              <DialogTitle>{NEW_LABELS[manual].title}</DialogTitle>
              <DialogDescription>Pour un intervenant qui n&apos;est pas encore dans la liste.</DialogDescription>
            </DialogHeader>
            <NewIntervenantForm
              role={manual}
              onAdd={(u) => {
                setAdded((a) => [...a, u])
                setV(u.id)
                showCreate(false)
              }}
            />
            <DialogFooter>
              <Button type="submit" form={NEW_INTERVENANT_FORM}>
                {NEW_LABELS[manual].submit}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{current ? `Modifier ${title(slot)}` : `Ajouter ${INDEFINITE[slot.kind]}`}</DialogTitle>
              <DialogDescription>
                {current ? "Le nouvel intervenant aura accès au dossier ; l'ancien n'y aura plus accès." : "Il aura accès au dossier et sera notifié."}
              </DialogDescription>
            </DialogHeader>
            <Field>
              <FieldLabel>{capitalize(LABELS[slot.kind].label)}</FieldLabel>
              <SimpleSelect
                placeholder="Choisir"
                options={options}
                value={v}
                onChange={setV}
                action={manual ? { label: NEW_LABELS[manual].title, onSelect: () => showCreate(true) } : undefined}
              />
            </Field>
            <DialogFooter>
              <Button variant="outline" onClick={() => !justSwitched() && onOpenChange(false)}>
                Annuler
              </Button>
              <Button disabled={!v || v === current} onClick={() => !justSwitched() && save()}>
                {current ? "Enregistrer et notifier" : "Ajouter et notifier"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Retirer ─────────────────────────────────────────────────────────────────

export function RemoveIntervenantDialog({ dossier: d, slot, onOpenChange }: Props) {
  const { user } = useRole()
  const { updateDossier, addEvent } = useStore()
  if (!slot) return null
  const u = getUser(currentId(d, slot))

  function remove() {
    if (!slot) return
    updateDossier(d.id, (x) => assign(x, slot, null))
    addEvent(d.id, {
      kind: "assignation",
      author: user.id,
      title: "Intervenant retiré du dossier",
      body: `${capitalize(LABELS[slot.kind].label)} : ${u ? fullName(u) : "—"}`,
    })
    toast.success(`${capitalize(LABELS[slot.kind].label)} retiré du dossier`)
    onOpenChange(false)
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Retirer {title(slot)} ?</DialogTitle>
          <DialogDescription>
            {u ? fullName(u) : "Cet intervenant"}
            {u?.structure ? ` (${u.structure})` : ""} n&apos;aura plus accès au dossier.
            {slot.kind !== "suiveur" && slot.kind !== "reparateur" && " Le poste sera à réassigner."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button variant="destructive" onClick={remove}>
            Retirer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
