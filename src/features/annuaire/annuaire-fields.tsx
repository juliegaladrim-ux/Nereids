"use client"

import * as React from "react"
import { BookUser, Building2, Plus, Trash2 } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ORG_TYPES, PERSON_TYPES, contactName, type Organisation, type PersonEntry, type Similar } from "@/lib/annuaire"
import type { EmailSecondaire } from "@/lib/data"
import { PROFILES, userProfile } from "@/lib/roles"
import { cn } from "@/lib/utils"

// ─── Suggestions de l'annuaire sous un champ texte ─────────────────────────────

export type Suggestion = { id: string; title: string; subtitle?: string; badge?: string; org?: boolean }


/** Rôle ou type d'une personne de l'annuaire (« Expert », « Client », « Contact ») */
export function personKind(p: PersonEntry): string {
  if (p.user) return PROFILES.find((x) => x.id === userProfile(p.user!))?.short ?? p.user.role
  if (p.isClient) return "Client"
  return p.type ? PERSON_TYPES[p.type].label : "Contact"
}

export const personSuggestion = (p: PersonEntry): Suggestion => ({
  id: p.id,
  title: contactName(p),
  subtitle: [p.org?.nom, p.email, p.address?.split(",").pop()?.trim()].filter(Boolean).join(" · "),
  badge: personKind(p),
})

export const orgSuggestion = (o: Organisation): Suggestion => ({
  id: o.id,
  title: o.nom,
  subtitle: [o.email, o.address?.split(",").pop()?.trim()].filter(Boolean).join(" · "),
  badge: ORG_TYPES[o.type].label,
  org: true,
})

/**
 * Champ texte qui propose les fiches de l'annuaire pendant la saisie.
 * Choisir une suggestion remplit le formulaire (le parent copie les infos de la fiche).
 */
export function SuggestInput({
  suggestions,
  onPick,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "onSelect"> & { suggestions: Suggestion[]; onPick: (id: string) => void }) {
  const [open, setOpen] = React.useState(false)
  const [active, setActive] = React.useState(0)
  const show = open && suggestions.length > 0

  function pick(id: string) {
    onPick(id)
    setOpen(false)
  }

  return (
    <div className="relative">
      <Input
        {...props}
        autoComplete="off"
        className={className}
        onFocus={(e) => {
          setOpen(true)
          props.onFocus?.(e)
        }}
        onBlur={(e) => {
          setOpen(false)
          props.onBlur?.(e)
        }}
        onChange={(e) => {
          setOpen(true)
          setActive(0)
          props.onChange?.(e)
        }}
        onKeyDown={(e) => {
          if (!show) return
          if (e.key === "ArrowDown") {
            e.preventDefault()
            setActive((i) => (i + 1) % suggestions.length)
          } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setActive((i) => (i - 1 + suggestions.length) % suggestions.length)
          } else if (e.key === "Enter") {
            e.preventDefault()
            pick(suggestions[Math.min(active, suggestions.length - 1)].id)
          } else if (e.key === "Escape") setOpen(false)
        }}
      />
      {show && (
        <div className="absolute top-full left-0 z-50 mt-1 w-full min-w-72 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg">
          <p className="flex items-center gap-1.5 border-b px-3 py-2 text-xs font-medium text-muted-foreground">
            <BookUser className="size-3.5" /> Déjà dans l&apos;annuaire
          </p>
          <ul className="max-h-72 overflow-y-auto py-1">
            {suggestions.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  // mousedown : avant que le champ ne perde le focus et ne ferme la liste
                  onMouseDown={(e) => {
                    e.preventDefault()
                    pick(s.id)
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={cn("flex w-full items-start gap-2.5 px-3 py-2 text-left", i === active && "bg-muted")}
                >
                  {s.org && <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{s.title}</span>
                    {s.subtitle && <span className="block truncate text-xs text-muted-foreground">{s.subtitle}</span>}
                  </span>
                  {s.badge && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{s.badge}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ─── Alerte doublon ─────────────────────────────────────────────────────────

/** « Cette personne est peut-être déjà dans l'annuaire » + bouton pour reprendre la fiche existante */
export function SimilarAlert({
  items,
  title = "Déjà dans l'annuaire ?",
  action = "Utiliser cette fiche",
  onUse,
}: {
  items: Similar<Suggestion>[]
  title?: string
  action?: string
  onUse?: (id: string) => void
}) {
  if (items.length === 0) return null
  return (
    <Alert variant="warning">
      <BookUser />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <ul className="mt-1 flex flex-col gap-1.5">
          {items.slice(0, 3).map(({ entry, reason }) => (
            <li key={entry.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>
                <span className="font-medium text-foreground">{entry.title}</span>
                {entry.subtitle && <span> · {entry.subtitle}</span>} <span className="text-muted-foreground">({reason})</span>
              </span>
              {onUse && (
                <Button type="button" size="xs" variant="secondary" onClick={() => onUse(entry.id)}>
                  {action}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}

// ─── E-mails : un principal + d'autres avec libellé ──────────────────────────

export type EmailsValue = { email: string; autresEmails: EmailSecondaire[] }

export function EmailsField({
  id,
  value,
  onChange,
  invalid,
  description = "Utilisé pour la connexion et les notifications.",
}: {
  id: string
  value: EmailsValue
  onChange: (v: EmailsValue) => void
  invalid?: boolean
  description?: string
}) {
  const setOther = (i: number, patch: Partial<EmailSecondaire>) =>
    onChange({ ...value, autresEmails: value.autresEmails.map((e, j) => (j === i ? { ...e, ...patch } : e)) })
  return (
    <div className="flex flex-col gap-3">
      <Field data-invalid={invalid || undefined}>
        <FieldLabel htmlFor={`${id}-email`}>E-mail principal</FieldLabel>
        <Input id={`${id}-email`} type="email" value={value.email} aria-invalid={invalid || undefined} onChange={(e) => onChange({ ...value, email: e.target.value })} />
        {description && <FieldDescription>{description}</FieldDescription>}
      </Field>
      {value.autresEmails.map((e, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,9rem)_auto] items-end gap-2">
          <Field>
            <FieldLabel htmlFor={`${id}-email-${i}`}>Autre e-mail</FieldLabel>
            <Input id={`${id}-email-${i}`} type="email" value={e.email} onChange={(ev) => setOther(i, { email: ev.target.value })} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-label-${i}`}>Libellé</FieldLabel>
            <Input id={`${id}-label-${i}`} placeholder="Ex. Secrétariat" value={e.label} onChange={(ev) => setOther(i, { label: ev.target.value })} />
          </Field>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Retirer cet e-mail"
            onClick={() => onChange({ ...value, autresEmails: value.autresEmails.filter((_, j) => j !== i) })}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => onChange({ ...value, autresEmails: [...value.autresEmails, { email: "", label: "" }] })}>
        <Plus /> Ajouter un e-mail
      </Button>
    </div>
  )
}

/** E-mails secondaires vides retirés avant enregistrement */
export const cleanEmails = (xs: EmailSecondaire[]) =>
  xs.map((e) => ({ email: e.email.trim(), label: e.label.trim() })).filter((e) => e.email)
