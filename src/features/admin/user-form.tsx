"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

import { SimpleSelect } from "@/components/simple-select"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { EmailsField, SimilarAlert, SuggestInput, cleanEmails, orgSuggestion } from "@/features/annuaire/annuaire-fields"
import { ORG_TYPES, ROLE_ORG, norm, searchOrgs, similarOrgs, useAnnuaire } from "@/lib/annuaire"
import { CIVILITES, REGION_DEPARTEMENTS, type EmailSecondaire, type User } from "@/lib/data"
import type { RoleId } from "@/lib/roles"
import { cn } from "@/lib/utils"

/**
 * Fiche d'un utilisateur (CDC §16 : nom, prénom, structure, téléphone, e-mail + zone d'intervention ;
 * point client 22/10 : adresse postale, plusieurs e-mails, expert rattaché à un cabinet de l'annuaire).
 * Même formulaire partout où Nereids ajoute quelqu'un : onglet « Utilisateurs » et ajout d'un intervenant
 * hors liste lors d'une assignation dans un dossier. Dans les deux cas, la personne est invitée par e-mail
 * et apparaît dans « Utilisateurs » avec l'invitation en attente.
 */

export type FormValues = {
  civilite: string
  firstName: string
  lastName: string
  fonction: string
  structure: string
  phone: string
  email: string
  autresEmails: EmailSecondaire[]
  address: string
  region: string
  departements: string[]
}

type TextKey = Exclude<keyof FormValues, "region" | "departements" | "autresEmails" | "civilite">

export const toForm = (u?: Partial<User>): FormValues => ({
  civilite: u?.civilite ?? "",
  firstName: u?.firstName ?? "",
  lastName: u?.lastName ?? "",
  fonction: u?.fonction ?? "",
  structure: u?.structure ?? "",
  phone: u?.phone ?? "",
  email: u?.email ?? "",
  autresEmails: u?.autresEmails ?? [],
  address: u?.address ?? "",
  region: u?.region ?? "",
  departements: u?.departements ?? [],
})

/** Zone d'intervention demandée à tous, sauf aux admins Nereids qui pilotent toute la France */
export const hasZone = (role: RoleId | null) => role !== "admin"

export function cleanValues(v: FormValues): Partial<User> {
  const text = Object.fromEntries((["firstName", "lastName", "fonction", "structure", "phone", "email"] as TextKey[]).map((k) => [k, v[k].trim()]))
  const autresEmails = cleanEmails(v.autresEmails)
  return {
    ...text,
    civilite: v.civilite || undefined,
    autresEmails: autresEmails.length ? autresEmails : undefined,
    address: v.address.trim() || undefined,
    region: v.region || undefined,
    departements: v.region ? v.departements : undefined,
  }
}

/** Réparateur : le garage suffit ; sinon prénom + nom. Un expert est toujours rattaché à un cabinet. */
export function missingFields(role: RoleId | null, v: FormValues): Partial<Record<keyof FormValues, boolean>> {
  const garage = role === "reparateur"
  return {
    structure: (garage || role === "expert") && !v.structure.trim(),
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
  const org = (
    <div className="sm:col-span-2">
      {role && ROLE_ORG[role] ? (
        <OrgField role={role} value={v.structure} onChange={(structure) => setV((p) => ({ ...p, structure }))} invalid={tried && !!missing.structure} />
      ) : (
        field("structure", "Structure")
      )}
    </div>
  )
  // Expert : on demande d'abord le cabinet
  const orgFirst = role === "expert"
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {orgFirst && org}
      <Field className="sm:col-span-2 sm:max-w-xs">
        <FieldLabel htmlFor="user-civilite">Civilité (optionnel)</FieldLabel>
        <SimpleSelect
          id="user-civilite"
          placeholder="Choisir"
          value={v.civilite || null}
          onChange={(c) => setV((p) => ({ ...p, civilite: c ?? "" }))}
          options={CIVILITES.map((c) => ({ value: c, label: c }))}
        />
      </Field>
      {field("firstName", role === "reparateur" ? "Prénom (optionnel)" : "Prénom")}
      {field("lastName", role === "reparateur" ? "Nom (optionnel)" : "Nom")}
      {!orgFirst && org}
      <div className="sm:col-span-2">
        <EmailsField
          id="user"
          value={{ email: v.email, autresEmails: v.autresEmails }}
          onChange={(e) => setV((p) => ({ ...p, ...e }))}
          invalid={tried && !!missing.email}
          description="Utilisé pour la connexion et les notifications. Les autres e-mails sont affichés sur sa fiche."
        />
      </div>
      <div className="sm:col-span-2">{field("phone", "Téléphone (optionnel)", "tel")}</div>
      <div className="sm:col-span-2">{field("address", "Adresse postale (optionnel)")}</div>
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

const ORG_LABEL: Partial<Record<RoleId, string>> = { expert: "Cabinet", reparateur: "Garage", suiveur: "Structure (optionnel)" }

/**
 * Cabinet de l'expert, garage du réparateur, structure du suiveur : on choisit la fiche de l'annuaire
 * pour ne pas créer « Cabinet Delorme » et « Cab. Delorme Expertise » en double. Un nom inconnu crée la fiche.
 */
function OrgField({ role, value, onChange, invalid }: { role: RoleId; value: string; onChange: (v: string) => void; invalid: boolean }) {
  const { orgs } = useAnnuaire()
  const type = ROLE_ORG[role]!
  const ofType = orgs.filter((o) => o.type === type)
  const exact = ofType.find((o) => norm(o.nom) === norm(value))
  const similar = exact || !value.trim() ? [] : similarOrgs(ofType, { nom: value })
  return (
    <div className="flex flex-col gap-2">
      <Field data-invalid={invalid || undefined}>
        <FieldLabel htmlFor="user-structure">{ORG_LABEL[role]}</FieldLabel>
        <SuggestInput
          id="user-structure"
          value={value}
          aria-invalid={invalid || undefined}
          placeholder={`Rechercher : ${ORG_TYPES[type].label.toLowerCase()}`}
          onChange={(e) => onChange(e.target.value)}
          suggestions={(exact ? [] : searchOrgs(ofType, value)).map(orgSuggestion)}
          onPick={(id) => onChange(orgs.find((o) => o.id === id)?.nom ?? value)}
        />
        {value.trim() && !exact && similar.length === 0 && (
          <FieldDescription>Nouvelle fiche « {ORG_TYPES[type].label} » : elle sera ajoutée à l&apos;annuaire.</FieldDescription>
        )}
      </Field>
      <SimilarAlert
        title="Une fiche proche existe"
        action="Choisir"
        items={similar.map((s) => ({ ...s, entry: orgSuggestion(s.entry) }))}
        onUse={(id) => onChange(orgs.find((o) => o.id === id)?.nom ?? value)}
      />
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
 * Formulaire autonome pour un rôle déjà connu (ajout depuis un dossier, expert depuis la fiche de son cabinet).
 * Le bouton d'envoi est dans le pied de la modale du parent (attribut form={formId}).
 */
export function NewUserForm({
  role,
  formId,
  onAdd,
  note,
  initial,
}: {
  role: RoleId
  formId: string
  onAdd: (u: User) => void
  note?: React.ReactNode
  initial?: Partial<User>
}) {
  const [v, setV] = React.useState<FormValues>(toForm({ structure: DEFAULT_STRUCTURE[role], ...initial }))
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
