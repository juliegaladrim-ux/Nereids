"use client"

import * as React from "react"
import { toast } from "sonner"

import { useRole } from "@/components/app-shell/role-context"
import { SimpleSelect } from "@/components/simple-select"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { allExpertises, clientConvoqueId, expertisePeople, fullName, getUser, STATUS_ORDER, setExpertise, type Dossier, type DocumentItem } from "@/lib/data"
import { formatLongDate } from "@/lib/format"
import { useStore } from "@/lib/store"

/** Modèles de convocation : un par type d'interlocuteur */
export type Modele = "client" | "vendeur" | "reparateur" | "representant" | "autre"

export const MODELES: Record<Modele, string> = {
  client: "Client / acheteur du véhicule",
  vendeur: "Vendeur / partie adverse",
  reparateur: "Réparateur / lieu d'expertise",
  representant: "Expert, avocat ou représentant d'une partie",
  autre: "Autre intervenant",
}

/** Personne à convoquer, quelle que soit son origine (utilisateur, client, intervenant ajouté à la main) */
export type Convoque = {
  id: string
  /** Nom affiché, civilité comprise */
  name: string
  /** Rôle ou qualité (Client, Réparateur, Vendeur…) */
  label: string
  civilite?: string
  address?: string
  modele: Modele
}

/** Modèle proposé selon la qualité de la personne */
export function modeleFor(role: string | undefined, qualite: string): Modele {
  if (role === "client") return "client"
  if (role === "reparateur") return "reparateur"
  if (role === "expert" || role === "suiveur") return "representant"
  const q = qualite.toLowerCase()
  if (/vendeur|compagnie|assur|adverse|mis en cause/.test(q)) return "vendeur"
  if (/acheteur|propri|client|lésé|mandant/.test(q)) return "client"
  if (/réparateur|garage|carross|atelier|lieu/.test(q)) return "reparateur"
  if (/avocat|expert|cabinet|représent|conseil/.test(q)) return "representant"
  return "autre"
}

/** Texte de la convocation, à compléter avant l'envoi (désordres précisés, frais de mise à disposition du lieu…) */
function corps(d: Dossier, index: number, c: Convoque, modele: Modele, expertName: string): string {
  const e = allExpertises(d)[index]
  const vehicule = `${d.vehicule.marque} ${d.vehicule.modele}, immatriculé ${d.vehicule.immat}`.replace("  ", " ")
  const quand = e.date ? formatLongDate(e.date) : "[date à préciser]"
  const desordres =
    d.proposition?.motif ||
    (d.objetsPanne?.length ? d.objetsPanne.map((o) => (o === "Autre" && d.panneAutre ? d.panneAutre : o)).join(", ") : "") ||
    d.description ||
    "[désordres à préciser]"
  const salut = c.civilite && c.civilite !== "Docteur" && c.civilite !== "Professeur" ? `${c.civilite},` : "Madame, Monsieur,"
  const intro: Record<Modele, string> = {
    client: `En votre qualité de client et d'acheteur du véhicule, vous êtes convoqué(e) à l'expertise organisée dans le cadre du dossier ${d.ref}.`,
    vendeur: `En votre qualité de vendeur ou de partie concernée, vous êtes convoqué(e) à l'expertise contradictoire organisée dans le cadre du dossier ${d.ref}. Vous pouvez vous y faire assister ou représenter.`,
    reparateur: `Le véhicule ayant été confié à vos soins, nous vous convoquons à l'expertise organisée dans le cadre du dossier ${d.ref}. Merci de mettre à disposition le véhicule ainsi qu'un emplacement permettant son examen.`,
    representant: `En votre qualité de représentant d'une des parties, vous êtes convoqué(e) à l'expertise organisée dans le cadre du dossier ${d.ref}.`,
    autre: `Vous êtes convoqué(e) à l'expertise organisée dans le cadre du dossier ${d.ref}.`,
  }
  return [
    `Objet : convocation à l'expertise du véhicule ${vehicule}`,
    `Référence du dossier : ${d.ref}`,
    "",
    salut,
    "",
    intro[modele],
    "",
    `Date : ${quand}`,
    `Lieu : ${e.lieu ?? "[lieu à préciser]"}`,
    `Véhicule : ${vehicule}`,
    `Désordres allégués : ${desordres}`,
    "",
    "Précisions : ",
    "",
    "Nous vous remercions de bien vouloir vous présenter muni(e) de toute pièce utile au dossier.",
    "",
    "Veuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées.",
    "",
    expertName,
  ].join("\n")
}

/**
 * Convocation d'une personne : modèle adapté à son rôle, texte modifiable avant l'envoi.
 * Le document généré est classé dans « Documents » ; la personne passe de « à convoquer » à « convoquée ».
 */
export function ConvocationDialog({ dossier: d, index, person, onClose }: { dossier: Dossier; index: number; person: Convoque; onClose: () => void }) {
  const { user } = useRole()
  const { updateDossier, addEvent } = useStore()
  const expert = getUser(d.intervenants.expert)
  const expertName = expert ? `${expert.civilite ?? ""} ${fullName(expert)}`.trim() : "L'expert"
  const [modele, setModele] = React.useState<Modele>(person.modele)
  const [texte, setTexte] = React.useState(() => corps(d, index, person, person.modele, expertName))

  function changeModele(m: string | null) {
    if (!m) return
    setModele(m as Modele)
    setTexte(corps(d, index, person, m as Modele, expertName))
  }

  function generer() {
    const now = new Date().toISOString()
    const doc: DocumentItem = {
      id: `d${Date.now()}`,
      name: `Convocation expertise — ${person.name}.pdf`,
      category: "courrier",
      addedBy: user.id,
      addedAt: now,
      docDate: now,
      size: "95 Ko",
      contenu: texte.trim(),
    }
    updateDossier(d.id, (x) => {
      // Dossier déjà convoqué avant la convocation par personne : la lettre envoyée à tous est rattachée à chacun
      const legacy = x.documents
        .filter((y) => y.category === "courrier" && /convocation/i.test(y.name))
        .sort((p, q) => q.addedAt.localeCompare(p.addedAt))[0]
      const next = setExpertise({ ...x, documents: [...x.documents, doc] }, index, (cur) => {
        const legacyIds = !cur.convocationDocs && legacy ? [...cur.convoques, ...(index === 0 && cur.convoques.length ? [clientConvoqueId(x)] : [])] : []
        return {
          ...cur,
          convoques: cur.convoques.includes(person.id) ? cur.convoques : [...cur.convoques, person.id],
          convocationDocs: { ...Object.fromEntries(legacyIds.map((id) => [id, legacy!.id])), ...(cur.convocationDocs ?? {}), [person.id]: doc.id },
        }
      })
      // Toutes les convocations de l'expertise n°1 sont générées : on attend l'expertise
      const e1 = next.expertise
      const all = expertisePeople(next, 0).every((id) => e1.convocationDocs?.[id])
      const reached = STATUS_ORDER.indexOf(x.status) >= STATUS_ORDER.indexOf("attente_expertise")
      if (index !== 0 || !all || reached) return next
      return {
        ...next,
        status: "attente_expertise",
        pilotage: {
          ...next.pilotage,
          ouEnEst: "Expertise programmée, convocations envoyées à toutes les parties.",
          attente: "Réalisation de l'expertise sur site",
          prochaineAction: "Réaliser l'expertise et déposer le PV sous 24 h",
          quiDoitAgir: "expert",
        },
      }
    })
    const n = allExpertises(d).length > 1 ? ` n°${index + 1}` : ""
    addEvent(d.id, { kind: "expertise", author: user.id, title: `Convocation générée pour ${person.name}${n}`, body: MODELES[modele] })
    addEvent(d.id, { kind: "document", author: "system", title: "Convocation générée", body: doc.name })
    toast.success(`Convocation générée pour ${person.name}`, { description: "Le document est dans les documents du dossier." })
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convocation — {person.name}</DialogTitle>
          <DialogDescription>
            Le texte est généré d&apos;après le modèle de l&apos;interlocuteur. Vous pouvez le modifier avant de générer le document.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="conv-modele">Modèle</FieldLabel>
            <SimpleSelect id="conv-modele" value={modele} onChange={changeModele} options={(Object.keys(MODELES) as Modele[]).map((m) => ({ value: m, label: MODELES[m] }))} />
            <FieldDescription>Changer de modèle remplace le texte ci-dessous.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="conv-texte">Texte de la convocation</FieldLabel>
            <Textarea id="conv-texte" rows={16} value={texte} onChange={(e) => setTexte(e.target.value)} className="text-xs" />
            <FieldDescription>Précisez par exemple les désordres constatés ou les frais de mise à disposition du lieu à régler le jour de l&apos;expertise.</FieldDescription>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={generer} disabled={!texte.trim()}>
            Générer la convocation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
