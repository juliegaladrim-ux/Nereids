"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

import { SimpleSelect } from "@/components/simple-select"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { REGION_DEPARTEMENTS, type User } from "@/lib/data"
import type { RoleId } from "@/lib/roles"
import { cn } from "@/lib/utils"

/**
 * Fiche d'un utilisateur (CDC §16 : nom, prénom, fonction, structure, téléphone, e-mail + zone d'intervention).
 * Même formulaire partout où Nereids ajoute quelqu'un : onglet « Utilisateurs » et ajout d'un intervenant
 * hors liste lors d'une assignation dans un dossier. Dans les deux cas, la personne est invitée par e-mail
 * et apparaît dans « Utilisateurs » avec le statut « Invité ».
 */

export type FormValues = {
  firstName: string
  lastName: string
  fonction: string
  structure: string
  phone: string
  email: string
  region: string
  departements: string[]
}

type TextKey = Exclude<keyof FormValues, "region" | "departements">

export const toForm = (u?: Partial<User>): FormValues => ({
  firstName: u?.firstName ?? "",
  lastName: u?.lastName ?? "",
  fonction: u?.fonction ?? "",
  structure: u?.structure ?? "",
  phone: u?.phone ?? "",
  email: u?.email ?? "",
  region: u?.region ?? "",
  departements: u?.departements ?? [],
})

/** Zone d'intervention demandée à tous, sauf aux admins Nereids qui pilotent toute la France */
export const hasZone = (role: RoleId | null) => role !== "admin"

export function cleanValues(v: FormValues): Partial<User> {
  const text = Object.fromEntries((["firstName", "lastName", "fonction", "structure", "phone", "email"] as TextKey[]).map((k) => [k, v[k].trim()]))
  return { ...text, region: v.region || undefined, departements: v.region ? v.departements : undefined }
}

/** Réparateur : le garage suffit ; sinon prénom + nom */
export function missingFields(role: RoleId | null, v: FormValues): Partial<Record<keyof FormValues, boolean>> {
  const garage = role === "reparateur"
  return {
    structure: garage && !v.structure.trim(),
    firstName: !garage && !v.firstName.trim(),
    lastName: !garage && !v.lastName.trim(),
    email: !/^\S+@\S+\.\S+$/.test(v.email.trim()),
    region: hasZone(role) && !v.region,
  }
}

export function UserFields({
  v,
  setV,
  missing,
  tried,
  role,
}: {
  v: FormValues
  setV: React.Dispatch<React.SetStateAction<FormValues>>
  missing: Partial<Record<keyof FormValues, boolean>>
  tried: boolean
  role: RoleId | null
}) {
  const field = (k: TextKey, label: string, type = "text") => {
    const invalid = tried && missing[k] ? true : undefined
    return (
      <Field data-invalid={invalid}>
        <FieldLabel htmlFor={`user-${k}`}>{label}</FieldLabel>
        <Input id={`user-${k}`} type={type} value={v[k]} aria-invalid={invalid} onChange={(e) => setV((p) => ({ ...p, [k]: e.target.value }))} />
      </Field>
    )
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {field("firstName", role === "reparateur" ? "Prénom (optionnel)" : "Prénom")}
      {field("lastName", role === "reparateur" ? "Nom (optionnel)" : "Nom")}
      <div className="sm:col-span-2">{field("structure", role === "reparateur" ? "Garage" : role === "expert" ? "Cabinet (optionnel)" : "Structure")}</div>
      <div className="sm:col-span-2">{field("fonction", "Fonction (optionnel)")}</div>
      <div className="sm:col-span-2">{field("email", "E-mail", "email")}</div>
      <div className="sm:col-span-2">{field("phone", "Téléphone (optionnel)", "tel")}</div>
      {hasZone(role) && (
        <>
          <Field data-invalid={tried && missing.region ? true : undefined} className="sm:col-span-2">
            <FieldLabel htmlFor="user-region">Région d&apos;intervention</FieldLabel>
            <SimpleSelect
              id="user-region"
              placeholder="Choisir"
              value={v.region || null}
              // Les départements dépendent de la région : on les vide au changement
              onChange={(r) => setV((p) => ({ ...p, region: r ?? "", departements: r === p.region ? p.departements : [] }))}
              options={Object.keys(REGION_DEPARTEMENTS).map((r) => ({ value: r, label: r }))}
            />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="user-dep">Départements d&apos;intervention</FieldLabel>
            <DepartementsSelect region={v.region} value={v.departements} onChange={(departements) => setV((p) => ({ ...p, departements }))} />
            <FieldDescription>Toute la région si aucun département n&apos;est choisi.</FieldDescription>
          </Field>
        </>
      )}
    </div>
  )
}

function DepartementsSelect({ region, value, onChange }: { region: string; value: string[]; onChange: (v: string[]) => void }) {
  const options = REGION_DEPARTEMENTS[region] ?? []
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        id="user-dep"
        disabled={!region}
        className="flex h-10 w-full items-center justify-between gap-1.5 rounded-[6px] border border-input bg-card pr-2.5 pl-3 text-left text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={cn("truncate", value.length === 0 && "text-muted-foreground")}>
          {!region ? "Choisir d'abord la région" : value.length === 0 ? "Toute la région" : value.map((d) => d.split(" ")[0]).join(", ")}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-72 w-(--anchor-width)">
        {options.map((d) => (
          <DropdownMenuCheckboxItem
            key={d}
            checked={value.includes(d)}
            onCheckedChange={(c) => onChange(c ? options.filter((o) => o === d || value.includes(o)) : value.filter((x) => x !== d))}
          >
            {d}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Structure pré-remplie selon le rôle (les autres structures sont propres à chaque intervenant) */
export const DEFAULT_STRUCTURE: Partial<Record<RoleId, string>> = { admin: "Nereids", gestionnaire: "Help You" }

/** Nouvel utilisateur invité, construit à partir du formulaire */
export function newUser(role: RoleId, v: FormValues): User {
  const u: User = {
    id: `u-n-${Date.now().toString(36)}`,
    role,
    ...(cleanValues(v) as Omit<User, "id" | "role">),
    ...(!hasZone(role) && { region: undefined, departements: undefined }),
  }
  // Expert sans cabinet ni fonction précisés : expert indépendant
  if (role === "expert") return { ...u, structure: u.structure || "Expert indépendant", fonction: u.fonction || "Expert automobile" }
  return u
}

/**
 * Formulaire autonome pour un rôle déjà connu (ajout depuis un dossier).
 * Le bouton d'envoi est dans le pied de la modale du parent (attribut form={formId}).
 */
export function NewUserForm({ role, formId, onAdd, note }: { role: RoleId; formId: string; onAdd: (u: User) => void; note?: React.ReactNode }) {
  const [v, setV] = React.useState<FormValues>(toForm({ structure: DEFAULT_STRUCTURE[role] }))
  const [tried, setTried] = React.useState(false)
  const missing = missingFields(role, v)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    e.stopPropagation()
    setTried(true)
    if (Object.values(missing).some(Boolean)) return
    onAdd(newUser(role, v))
  }

  return (
    <form id={formId} onSubmit={submit} noValidate className="grid gap-4">
      <UserFields v={v} setV={setV} missing={missing} tried={tried} role={role} />
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
    </form>
  )
}
