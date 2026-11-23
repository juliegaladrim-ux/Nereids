"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { toast } from "sonner"

import { useRole } from "@/components/app-shell/role-context"
import { Immat } from "@/components/immat"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Dossier } from "@/lib/data"
import { formatDate } from "@/lib/format"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { EditDialog, fromDateInput, opt, toDateInput, type EditField, type EditSection, type Values } from "./dossier-edit"

/**
 * Fiche véhicule : les champs reprennent ceux du certificat d'immatriculation (carte grise).
 * `cg` est le repère de la carte grise : il s'affiche à côté du champ pour retrouver l'information sur le document.
 */
type VField = {
  key: string
  label: string
  /** Repère du champ sur la carte grise (ex. « D.2.1 ») */
  cg?: string
  type?: "text" | "date" | "select" | "number"
  options?: string[]
  /** Champ déjà porté par le dossier (marque, modèle, immatriculation, VIN) */
  real?: "marque" | "modele" | "immat" | "vin"
  full?: boolean
}

const OUI_NON = ["Oui", "Non"]
const OUI_NON_NSP = ["Oui", "Non", "Je ne sais pas"]

const PAYS = ["France", "Allemagne", "Belgique", "Espagne", "Italie", "Luxembourg", "Pays-Bas", "Portugal", "Royaume-Uni", "Suisse", "Autre"]

type VSection = { id: string; title: string; fields: VField[] }

const SECTIONS: VSection[] = [
  {
    id: "marque",
    title: "Marque et modèle",
    fields: [
      { key: "marque", label: "Marque", cg: "D.1", real: "marque" },
      { key: "modele", label: "Modèle", cg: "D.3", real: "modele" },
      { key: "finition", label: "Finition" },
      {
        key: "motorisation",
        label: "Motorisation",
        cg: "P.3",
        type: "select",
        options: ["Essence (ES)", "Diesel (GO)", "Électrique (EL)", "Hybride essence (EH)", "Hybride diesel (GH)", "GPL (GP)", "Superéthanol (E85)", "Hydrogène", "Autre"],
      },
      { key: "couleur", label: "Couleur", type: "select", options: ["Blanc", "Noir", "Gris", "Argent", "Bleu", "Rouge", "Vert", "Jaune", "Orange", "Marron", "Beige", "Autre"] },
    ],
  },
  {
    id: "identification",
    title: "Identification du véhicule",
    fields: [
      { key: "immat", label: "Immatriculation", cg: "A", real: "immat" },
      { key: "pays", label: "Pays d'immatriculation", type: "select", options: PAYS },
      { key: "nonImmatricule", label: "Véhicule non immatriculé", type: "select", options: OUI_NON },
      { key: "formule", label: "N° de formule sur la carte grise", hint: "Si immatriculation depuis 2009" } as VField,
      { key: "vin", label: "Numéro de série (VIN)", cg: "E", real: "vin" },
    ],
  },
  {
    id: "dates",
    title: "Dates",
    fields: [
      { key: "miseEnCirculation", label: "Date de première mise en circulation", cg: "B", type: "date" },
      { key: "dateCarteGrise", label: "Date de création de la carte grise", cg: "I", type: "date" },
      { key: "finControleTechnique", label: "Date de fin de validité du contrôle technique", cg: "X.1", type: "date" },
    ],
  },
  {
    id: "caracteristiques",
    title: "Caractéristiques du véhicule",
    fields: [
      { key: "cnit", label: "CNIT / Type mine", cg: "D.2.1" },
      { key: "numeroReception", label: "Numéro de réception par type", cg: "K" },
      {
        key: "genre",
        label: "Genre",
        cg: "J.1",
        type: "select",
        options: ["Voiture particulière (VP)", "Camionnette (CTTE)", "Camion (CAM)", "Tracteur routier (TRR)", "Véhicule spécialisé (VASP)", "Cyclomoteur (CL)", "Motocyclette (MTL)", "Autre"],
      },
      {
        key: "carrosserie",
        label: "Carrosserie",
        cg: "J.3",
        type: "select",
        options: ["Conduite intérieure (CI)", "Break (BREAK)", "Coupé (COUPE)", "Cabriolet (CABRIOLET)", "Monospace (MONOSPACE)", "Camionnette (CAM)", "Autre"],
      },
      { key: "cylindree", label: "Cylindrée (cm³)", cg: "P.1", type: "number" },
      { key: "puissanceKw", label: "Puissance nette maximale (kW)", cg: "P.2", type: "number" },
      { key: "puissance", label: "Puissance administrative (CV)", cg: "P.6", type: "number" },
      { key: "co2", label: "CO₂ (g/km)", cg: "V.7", type: "number" },
      { key: "codeMoteur", label: "Code moteur" },
      { key: "boite", label: "Boîte de vitesse", type: "select", options: ["Manuelle", "Automatique", "Robotisée", "Variation continue (CVT)"] },
      { key: "typeBoite", label: "Type de boîte de vitesse" },
      { key: "nbVitesses", label: "Nombre de vitesses", type: "number" },
      { key: "places", label: "Nombre de places assises", cg: "S.1", type: "number" },
      { key: "utilisation", label: "Utilisation", type: "select", options: ["Privée", "Professionnelle"] },
      {
        key: "typeUtilisation",
        label: "Type d'utilisation",
        type: "select",
        options: ["Non précisé", "Normal", "Ambulance", "Auto-école", "Taxi", "VSL", "Collection", "Autre"],
      },
      { key: "vrade", label: "VRADE approximative (€)", type: "number" },
      { key: "kilometrage", label: "Kilométrage (km)", type: "number" },
    ],
  },
  {
    id: "interventions",
    title: "Interventions sur le véhicule",
    fields: [
      { key: "demonte", label: "Véhicule démonté", type: "select", options: OUI_NON_NSP },
      { key: "remonte", label: "Véhicule remonté", type: "select", options: OUI_NON_NSP },
      { key: "vidange", label: "Vidange des fluides et filtres réalisée suite à la panne", type: "select", options: OUI_NON_NSP },
    ],
  },
]

/** Valeur d'un champ : portée par le dossier (marque, immat…) ou par le détail du véhicule */
function valueOf(d: Dossier, f: VField): string {
  if (f.real) return d.vehicule[f.real] ?? ""
  const v = d.vehicule.details?.[f.key]
  if (f.key === "pays" && !v) return "France"
  return v ?? ""
}

function display(f: VField, v: string): React.ReactNode {
  if (!v) return null
  if (f.real === "immat") return <Immat value={v} />
  if (f.type === "date") return formatDate(v)
  if (f.key === "vrade") return `${v} €`
  if (f.real === "vin") return <span className="font-mono text-xs">{v}</span>
  return v
}

function sectionEdit(d: Dossier, s: VSection, save: (v: Values) => void): EditSection {
  const fields: EditField[] = s.fields.map((f) => ({
    key: f.key,
    label: f.label,
    type: f.type === "select" ? "select" : f.type === "date" ? "date" : "text",
    options: f.options?.map((o) => ({ value: o, label: o })),
    hint: [f.cg && `Lettre ${f.cg} de la carte grise`, (f as { hint?: string }).hint].filter(Boolean).join(" · ") || undefined,
  }))
  const initial: Values = {}
  for (const f of s.fields) initial[f.key] = f.type === "date" ? toDateInput(valueOf(d, f) || undefined) : valueOf(d, f)
  return { title: `Modifier — ${s.title}`, fields, initial, onSave: save }
}

/** Onglet Véhicule : toutes les caractéristiques, avec le repère de la carte grise de chaque champ */
export function VehiculeTab({ dossier: d, canEdit }: { dossier: Dossier; canEdit: boolean }) {
  const { user } = useRole()
  const { updateDossier, addEvent } = useStore()
  const [closed, setClosed] = React.useState<string[]>([])
  const [edit, setEdit] = React.useState<EditSection | null>(null)

  function save(s: VSection, v: Values) {
    updateDossier(d.id, (x) => {
      const details = { ...(x.vehicule.details ?? {}) }
      const real: Partial<Dossier["vehicule"]> = {}
      for (const f of s.fields) {
        const raw = f.type === "date" ? (fromDateInput(v[f.key] ?? "") ?? "") : (v[f.key] ?? "").trim()
        if (f.real === "marque" || f.real === "modele" || f.real === "immat") real[f.real] = raw || x.vehicule[f.real]
        else if (f.real === "vin") real.vin = opt(raw)
        else if (raw) details[f.key] = raw
        else delete details[f.key]
      }
      return { ...x, vehicule: { ...x.vehicule, ...real, details } }
    })
    addEvent(d.id, { kind: "system", author: user.id, title: "Véhicule modifié(e)", body: s.title })
    toast.success("Modifications enregistrées")
  }

  return (
    <div className="flex flex-col gap-4">
      {SECTIONS.map((s) => {
        const open = !closed.includes(s.id)
        return (
          <Card key={s.id} size="sm">
            <CardHeader>
              <CardTitle>
                <button
                  type="button"
                  className="flex cursor-pointer items-center gap-1.5 text-left"
                  aria-expanded={open}
                  onClick={() => setClosed((c) => (open ? [...c, s.id] : c.filter((x) => x !== s.id)))}
                >
                  <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", !open && "-rotate-90")} />
                  {s.title}
                </button>
              </CardTitle>
              {canEdit && (
                <CardAction>
                  <Button size="xs" variant="secondary" aria-label={`Modifier — ${s.title}`} onClick={() => setEdit(sectionEdit(d, s, (v) => save(s, v)))}>
                    Modifier
                  </Button>
                </CardAction>
              )}
            </CardHeader>
            {open && (
              <CardContent>
                <dl className="grid gap-1 text-sm md:grid-cols-2">
                  {s.fields.map((f) => {
                    const v = valueOf(d, f)
                    return (
                      <div key={f.key} className="flex items-start justify-between gap-4 rounded-md bg-muted/70 px-3 py-2">
                        <dt className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                          {f.label}
                          {f.cg && <span className="rounded border border-brand/40 bg-background px-1 font-mono text-[0.65rem] text-brand-ink">{f.cg}</span>}
                        </dt>
                        <dd className="min-w-0 text-right font-medium break-words">{display(f, v) || "—"}</dd>
                      </div>
                    )
                  })}
                </dl>
              </CardContent>
            )}
          </Card>
        )
      })}
      <EditDialog key={edit ? edit.title : "none"} section={edit} onOpenChange={(o) => !o && setEdit(null)} />
    </div>
  )
}
