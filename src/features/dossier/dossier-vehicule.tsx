"use client"

import * as React from "react"
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
  /** Unité affichée après la valeur (km, kW…) */
  unit?: string
  hint?: string
  /** Sous-titre de regroupement à l'intérieur d'une carte */
  group?: string
}

const OUI_NON = ["Oui", "Non"]
const OUI_NON_NSP = ["Oui", "Non", "Je ne sais pas"]

const PAYS = ["France", "Allemagne", "Belgique", "Espagne", "Italie", "Luxembourg", "Pays-Bas", "Portugal", "Royaume-Uni", "Suisse", "Autre"]

type VSection = { id: string; title: string; fields: VField[] }

const SECTIONS: VSection[] = [
  {
    id: "identification",
    title: "Identification",
    fields: [
      { key: "marque", label: "Marque", cg: "D.1", real: "marque", group: "Véhicule" },
      { key: "modele", label: "Modèle", cg: "D.3", real: "modele", group: "Véhicule" },
      { key: "finition", label: "Finition", group: "Véhicule" },
      { key: "couleur", label: "Couleur", type: "select", options: ["Blanc", "Noir", "Gris", "Argent", "Bleu", "Rouge", "Vert", "Jaune", "Orange", "Marron", "Beige", "Autre"], group: "Véhicule" },
      { key: "immat", label: "Immatriculation", cg: "A", real: "immat", group: "Carte grise" },
      { key: "pays", label: "Pays d'immatriculation", type: "select", options: PAYS, group: "Carte grise" },
      { key: "nonImmatricule", label: "Véhicule non immatriculé", type: "select", options: OUI_NON, group: "Carte grise" },
      { key: "formule", label: "N° de formule sur la carte grise", hint: "Si immatriculation depuis 2009", group: "Carte grise" },
      { key: "vin", label: "Numéro de série (VIN)", cg: "E", real: "vin", group: "Carte grise" },
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
    title: "Caractéristiques techniques",
    fields: [
      {
        key: "motorisation",
        label: "Motorisation",
        cg: "P.3",
        type: "select",
        options: ["Essence (ES)", "Diesel (GO)", "Électrique (EL)", "Hybride essence (EH)", "Hybride diesel (GH)", "GPL (GP)", "Superéthanol (E85)", "Hydrogène", "Autre"],
        group: "Moteur et boîte",
      },
      { key: "cylindree", label: "Cylindrée", cg: "P.1", type: "number", unit: "cm³", group: "Moteur et boîte" },
      { key: "puissanceKw", label: "Puissance nette maximale", cg: "P.2", type: "number", unit: "kW", group: "Moteur et boîte" },
      { key: "puissance", label: "Puissance administrative", cg: "P.6", type: "number", unit: "CV", group: "Moteur et boîte" },
      { key: "co2", label: "Émissions de CO₂", cg: "V.7", type: "number", unit: "g/km", group: "Moteur et boîte" },
      { key: "codeMoteur", label: "Code moteur", group: "Moteur et boîte" },
      { key: "boite", label: "Boîte de vitesse", type: "select", options: ["Manuelle", "Automatique", "Robotisée", "Variation continue (CVT)"], group: "Moteur et boîte" },
      { key: "typeBoite", label: "Type de boîte de vitesse", group: "Moteur et boîte" },
      { key: "nbVitesses", label: "Nombre de vitesses", type: "number", group: "Moteur et boîte" },
      {
        key: "genre",
        label: "Genre",
        cg: "J.1",
        type: "select",
        options: ["Voiture particulière (VP)", "Camionnette (CTTE)", "Camion (CAM)", "Tracteur routier (TRR)", "Véhicule spécialisé (VASP)", "Cyclomoteur (CL)", "Motocyclette (MTL)", "Autre"],
        group: "Carrosserie et places",
      },
      {
        key: "carrosserie",
        label: "Carrosserie",
        cg: "J.3",
        type: "select",
        options: ["Conduite intérieure (CI)", "Break (BREAK)", "Coupé (COUPE)", "Cabriolet (CABRIOLET)", "Monospace (MONOSPACE)", "Camionnette (CAM)", "Autre"],
        group: "Carrosserie et places",
      },
      { key: "places", label: "Places assises", cg: "S.1", type: "number", group: "Carrosserie et places" },
      { key: "cnit", label: "CNIT / Type mine", cg: "D.2.1", group: "Réception" },
      { key: "numeroReception", label: "Numéro de réception par type", cg: "K", group: "Réception" },
    ],
  },
  {
    id: "usage",
    title: "Usage et état",
    fields: [
      { key: "utilisation", label: "Utilisation", type: "select", options: ["Privée", "Professionnelle"], group: "Usage" },
      { key: "typeUtilisation", label: "Type d'utilisation", type: "select", options: ["Non précisé", "Normal", "Ambulance", "Auto-école", "Taxi", "VSL", "Collection", "Autre"], group: "Usage" },
      { key: "kilometrage", label: "Kilométrage", type: "number", unit: "km", group: "Usage" },
      { key: "vrade", label: "VRADE approximative", type: "number", unit: "€", group: "Usage" },
      { key: "demonte", label: "Véhicule démonté", type: "select", options: OUI_NON_NSP, group: "Interventions" },
      { key: "remonte", label: "Véhicule remonté", type: "select", options: OUI_NON_NSP, group: "Interventions" },
      { key: "vidange", label: "Vidange des fluides et filtres réalisée suite à la panne", type: "select", options: OUI_NON_NSP, group: "Interventions" },
    ],
  },
]

const ALL_FIELDS = SECTIONS.flatMap((s) => s.fields)
const FIELD = (key: string) => ALL_FIELDS.find((f) => f.key === key)!

/** Valeur d'un champ : portée par le dossier (marque, immat…) ou par le détail du véhicule */
function valueOf(d: Dossier, f: VField): string {
  if (f.real) return d.vehicule[f.real] ?? ""
  const v = d.vehicule.details?.[f.key]
  if (f.key === "pays" && !v) return "France"
  return v ?? ""
}

const isOuiNon = (f: VField) => f.options === OUI_NON || f.options === OUI_NON_NSP

const PILL: Record<string, string> = {
  Oui: "bg-foreground/10 text-foreground",
  Non: "bg-muted text-muted-foreground",
  "Je ne sais pas": "bg-tone-waiting-bg text-tone-waiting",
}

/** Valeur mise en forme : nombres avec séparateur et unité, Oui/Non en pastilles, plaque, dates en clair */
function display(f: VField, v: string): React.ReactNode {
  if (!v) return null
  if (f.real === "immat") return <Immat value={v} />
  if (f.type === "date") return formatDate(v)
  if (isOuiNon(f)) return <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", PILL[v] ?? "bg-muted")}>{v}</span>
  if (f.type === "number") {
    const n = Number(v.replace(",", ".").replace(/\s/g, ""))
    const txt = Number.isFinite(n) ? n.toLocaleString("fr-FR") : v
    return f.unit ? `${txt} ${f.unit}` : txt
  }
  return v
}

function sectionEdit(d: Dossier, s: VSection, save: (v: Values) => void): EditSection {
  const fields: EditField[] = s.fields.map((f) => ({
    key: f.key,
    label: f.label,
    type: f.type === "select" ? "select" : f.type === "date" ? "date" : f.type === "number" ? "number" : "text",
    options: f.options?.map((o) => ({ value: o, label: o })),
    hint: f.hint,
    unit: f.unit,
    tag: f.cg,
    // Une carte à un seul groupe n'a pas besoin de sous-titre
    group: new Set(s.fields.map((x) => x.group)).size > 1 ? f.group : undefined,
  }))
  const initial: Values = {}
  for (const f of s.fields) initial[f.key] = f.type === "date" ? toDateInput(valueOf(d, f) || undefined) : valueOf(d, f)
  return { title: `Modifier — ${s.title}`, description: "Les repères en vert sont ceux de la carte grise. La modification sera tracée dans le suivi du dossier.", fields, initial, onSave: save }
}

// ─── Dates ───────────────────────────────────────────────────────────────────

const dayLong = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })

/** Écart entre aujourd'hui et une date, en mois entiers (positif = date passée) */
function monthsSince(iso: string): number {
  const t = new Date(iso)
  const n = new Date()
  return (n.getFullYear() - t.getFullYear()) * 12 + (n.getMonth() - t.getMonth()) - (n.getDate() < t.getDate() ? 1 : 0)
}
const spanLabel = (m: number) => {
  const a = Math.floor(m / 12)
  const r = m % 12
  return [a > 0 && `${a} an${a > 1 ? "s" : ""}`, r > 0 && `${r} mois`].filter(Boolean).join(" et ") || "moins d'1 mois"
}

/** Sous-texte et ton d'une date : âge pour les dates passées, échéance pour le contrôle technique */
function dateNote(key: string, iso: string): { text: string; tone?: "ok" | "soon" | "late" } {
  const m = monthsSince(iso)
  if (key === "finControleTechnique") {
    if (m > 0) return { text: `Expiré depuis ${spanLabel(m)}`, tone: "late" }
    const left = -m
    return left <= 2 ? { text: left === 0 ? "Expire ce mois-ci" : `Expire dans ${spanLabel(left)}`, tone: "soon" } : { text: `Valide encore ${spanLabel(left)}`, tone: "ok" }
  }
  return { text: m > 0 ? `Il y a ${spanLabel(m)}` : "Récente" }
}

const TONE: Record<string, string> = {
  ok: "bg-tone-done-bg text-tone-done",
  soon: "bg-tone-waiting-bg text-tone-waiting",
  late: "bg-tone-alert-bg text-tone-alert",
}

function CgTag({ cg }: { cg: string }) {
  return <span className="shrink-0 rounded border border-brand/40 bg-background px-1 text-[0.7rem] text-brand-ink">{cg}</span>
}

/** Encadré Dates : une tuile par date, la date en clair puis son ancienneté ou son échéance */
function DatesGrid({ dossier: d, fields }: { dossier: Dossier; fields: VField[] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-3">
      {fields.map((f) => {
        const v = valueOf(d, f)
        const note = v ? dateNote(f.key, v) : null
        return (
          <div key={f.key} className="flex flex-col gap-1.5 rounded-lg border bg-card p-3">
            <dt className="flex items-start justify-between gap-2 text-sm leading-snug text-muted-foreground">
              <span>{f.label}</span>
              {f.cg && <CgTag cg={f.cg} />}
            </dt>
            <dd className={cn("text-base font-semibold", !v && "text-sm font-normal text-muted-foreground/70 italic")}>{v ? dayLong(v) : "Non renseignée"}</dd>
            {note && (
              <dd>
                <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[0.7rem] font-medium", note.tone ? TONE[note.tone] : "bg-muted text-muted-foreground")}>{note.text}</span>
              </dd>
            )}
          </div>
        )
      })}
    </dl>
  )
}

// ─── Synthèse ────────────────────────────────────────────────────────────────

/** Bandeau du haut : le véhicule en un coup d'œil (plaque, modèle, points clés, contrôle technique) */
function Synthese({ dossier: d }: { dossier: Dossier }) {
  const val = (k: string) => valueOf(d, FIELD(k))
  const fmt = (k: string) => display(FIELD(k), val(k))
  const ct = val("finControleTechnique") ? dateNote("finControleTechnique", val("finControleTechnique")) : null
  const mec = val("miseEnCirculation")
  const infos: [string, React.ReactNode][] = (
    [
      ["Motorisation", fmt("motorisation")],
      ["Couleur", fmt("couleur")],
      ["Kilométrage", fmt("kilometrage")],
      ["Mise en circulation", mec ? new Date(mec).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) : null],
    ] as [string, React.ReactNode][]
  ).filter(([, v]) => !!v)

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <Immat value={d.vehicule.immat} className="h-8 text-sm" />
            <p className="text-lg font-semibold">
              {d.vehicule.marque} {d.vehicule.modele}
            </p>
          </div>
          {val("finition") && <p className="text-sm text-muted-foreground">{val("finition")}</p>}
        </div>
        <dl className="flex flex-wrap gap-x-8 gap-y-3">
          {infos.map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5">
              <dt className="text-sm text-muted-foreground">{k}</dt>
              <dd className="text-sm font-medium first-letter:uppercase">{v}</dd>
            </div>
          ))}
          {ct && (
            <div className="flex flex-col gap-0.5">
              <dt className="text-sm text-muted-foreground">Contrôle technique</dt>
              <dd>
                <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", ct.tone ? TONE[ct.tone] : "bg-muted text-muted-foreground")}>{ct.text}</span>
              </dd>
            </div>
          )}
        </dl>
      </CardContent>
    </Card>
  )
}

// ─── Cartes ──────────────────────────────────────────────────────────────────

/** Une information : libellé au-dessus (avec le repère de la carte grise), valeur en dessous */
function Info({ field: f, value }: { field: VField; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="flex items-center gap-1.5 text-sm leading-snug text-muted-foreground">
        {f.label}
        {f.cg && <CgTag cg={f.cg} />}
      </dt>
      <dd className={cn("min-w-0 text-sm font-medium break-words", !value && "font-normal text-muted-foreground/70 italic")}>{display(f, value) || "Non renseigné"}</dd>
    </div>
  )
}

/** Carte à sous-titres : seuls les champs renseignés sont affichés, les autres se déplient à la demande */
function GroupedCard({ dossier: d, section: s, showEmpty, onToggleEmpty }: { dossier: Dossier; section: VSection; showEmpty: boolean; onToggleEmpty: () => void }) {
  const groups = [...new Set(s.fields.map((f) => f.group))]
  const emptyCount = s.fields.filter((f) => !valueOf(d, f)).length
  const filled = s.fields.length - emptyCount
  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => {
        const fields = s.fields.filter((f) => f.group === g)
        const shown = showEmpty ? fields : fields.filter((f) => valueOf(d, f))
        if (shown.length === 0) return null
        return (
          <section key={g ?? "_"} className="flex flex-col gap-3">
            {groups.length > 1 && g && <h4 className="border-b pb-1.5 text-sm font-semibold">{g}</h4>}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-3">
              {shown.map((f) => (
                <Info key={f.key} field={f} value={valueOf(d, f)} />
              ))}
            </dl>
          </section>
        )
      })}
      {filled === 0 && !showEmpty && <p className="text-sm text-muted-foreground">Aucune information renseignée pour l&apos;instant.</p>}
      {emptyCount > 0 && (
        <button type="button" className="w-fit text-sm font-medium text-brand-ink underline-offset-2 hover:underline" onClick={onToggleEmpty}>
          {showEmpty ? "Masquer les champs non renseignés" : `Afficher les ${emptyCount} champ${emptyCount > 1 ? "s" : ""} non renseigné${emptyCount > 1 ? "s" : ""}`}
        </button>
      )}
    </div>
  )
}

/** Onglet Véhicule : synthèse en haut, puis les caractéristiques avec le repère de la carte grise de chaque champ */
export function VehiculeTab({ dossier: d, canEdit }: { dossier: Dossier; canEdit: boolean }) {
  const { user } = useRole()
  const { updateDossier, addEvent } = useStore()
  const [expanded, setExpanded] = React.useState<string[]>([])
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
      <Synthese dossier={d} />
      {SECTIONS.map((s) => (
        <Card key={s.id} size="sm">
          <CardHeader>
            <CardTitle>{s.title}</CardTitle>
            {canEdit && (
              <CardAction>
                <Button size="xs" variant="secondary" aria-label={`Modifier — ${s.title}`} onClick={() => setEdit(sectionEdit(d, s, (v) => save(s, v)))}>
                  Modifier
                </Button>
              </CardAction>
            )}
          </CardHeader>
          <CardContent>
            {s.id === "dates" ? (
              <DatesGrid dossier={d} fields={s.fields} />
            ) : (
              <GroupedCard
                dossier={d}
                section={s}
                showEmpty={expanded.includes(s.id)}
                onToggleEmpty={() => setExpanded((e) => (e.includes(s.id) ? e.filter((x) => x !== s.id) : [...e, s.id]))}
              />
            )}
          </CardContent>
        </Card>
      ))}
      <EditDialog key={edit ? edit.title : "none"} section={edit} onOpenChange={(o) => !o && setEdit(null)} />
    </div>
  )
}
