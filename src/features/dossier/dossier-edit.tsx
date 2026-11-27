"use client"

import * as React from "react"

import { SimpleSelect, type Option } from "@/components/simple-select"
import { DateInput } from "@/components/date-input"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { DictableTextarea } from "@/components/dictable-textarea"
import { cn } from "@/lib/utils"

/**
 * Édition générique d'un bloc d'infos du dossier (admin : tout est modifiable,
 * à tout moment). Chaque bloc décrit ses champs + comment les réappliquer.
 */

export type Values = Record<string, string>

export type EditField = {
  key: string
  label: string
  type?: "text" | "email" | "tel" | "textarea" | "select" | "date" | "datetime" | "number"
  options?: Option[] | ((v: Values) => Option[])
  hidden?: (v: Values) => boolean
  hint?: string
  full?: boolean
  /** Unité affichée à droite d'un champ texte ou nombre (km, kW…) */
  unit?: string
  /** Petit repère à côté du libellé (ex. lettre de la carte grise) */
  tag?: string
  /** Titre de regroupement affiché au-dessus du premier champ du groupe */
  group?: string
}

export type EditSection = {
  title: string
  description?: string
  fields: EditField[]
  initial: Values
  onSave: (v: Values) => void
  /** Libellé du bouton de validation (défaut : « Enregistrer ») */
  submitLabel?: string
  /** Libellé du bouton de fermeture (défaut : « Annuler ») */
  cancelLabel?: string
  /** Champs obligatoires : le bouton reste désactivé tant qu'ils sont vides */
  required?: string[]
  /** Infos en lecture seule affichées sous les champs */
  info?: React.ReactNode
  size?: "default" | "sm"
}

export function EditDialog({ section, onOpenChange }: { section: EditSection | null; onOpenChange: (o: boolean) => void }) {
  const [v, setV] = React.useState<Values>(section?.initial ?? {})
  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }))

  function save() {
    section?.onSave(v)
    onOpenChange(false)
  }

  return (
    <Dialog open={!!section} onOpenChange={onOpenChange}>
      <DialogContent size={section?.size}>
        <DialogHeader>
          <DialogTitle>{section?.title}</DialogTitle>
          <DialogDescription>{section?.description ?? "La modification sera tracée dans le suivi du dossier."}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {section?.fields
            .filter((f) => !f.hidden?.(v))
            .map((f, i, list) => {
              const id = `edit-${f.key}`
              const groupTitle = f.group && f.group !== list[i - 1]?.group ? (
                <h3 key={`g-${f.group}`} className={cn("text-sm font-semibold sm:col-span-2", i > 0 && "mt-2 border-t pt-4")}>
                  {f.group}
                </h3>
              ) : null
              const full = f.full || f.type === "textarea"
              // Champ libre : micro de dictée à droite du libellé
              if (f.type === "textarea")
                return (
                  <DictableTextarea
                    key={f.key}
                    id={id}
                    className="sm:col-span-2"
                    label={
                      <>
                        {f.label}
                        {section.required?.includes(f.key) && " *"}
                      </>
                    }
                    description={f.hint}
                    value={v[f.key] ?? ""}
                    onValueChange={(val) => set(f.key, val)}
                  />
                )
              return (
                <React.Fragment key={f.key}>
                {groupTitle}
                <Field className={cn(full && "sm:col-span-2")}>
                  <FieldLabel htmlFor={id}>
                    {f.label}
                    {section.required?.includes(f.key) && " *"}
                    {f.tag && <span className="rounded border border-brand/40 bg-background px-1 text-[0.7rem] font-normal text-brand-ink">{f.tag}</span>}
                  </FieldLabel>
                  {f.type === "select" ? (
                    <SimpleSelect
                      id={id}
                      value={v[f.key] || null}
                      onChange={(val) => set(f.key, val ?? "")}
                      options={typeof f.options === "function" ? f.options(v) : (f.options ?? [])}
                    />
                  ) : f.type === "date" || f.type === "datetime" ? (
                    <DateInput id={id} withTime={f.type === "datetime"} value={v[f.key] ?? ""} onChange={(val) => set(f.key, val)} />
                  ) : f.unit ? (
                    <div className="relative">
                      <Input id={id} type={f.type ?? "text"} className="pr-14" value={v[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">{f.unit}</span>
                    </div>
                  ) : (
                    <Input
                      id={id}
                      type={f.type ?? "text"}
                      value={v[f.key] ?? ""}
                      onChange={(e) => set(f.key, e.target.value)}
                    />
                  )}
                  {f.hint && <FieldDescription>{f.hint}</FieldDescription>}
                </Field>
                </React.Fragment>
              )
            })}
        </div>
        {section?.info}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {section?.cancelLabel ?? "Annuler"}
          </Button>
          <Button onClick={save} disabled={section?.required?.some((k) => !v[k]?.trim())}>
            {section?.submitLabel ?? "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Conversions date ⇄ champ ────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0")

export function toDateInput(iso?: string): string {
  if (!iso) return ""
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function toDateTimeInput(iso?: string): string {
  if (!iso) return ""
  const d = new Date(iso)
  return `${toDateInput(iso)}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromDateInput(v: string, hour = 10): string | undefined {
  if (!v) return undefined
  const d = new Date(v.includes("T") ? v : `${v}T${pad(hour)}:00`)
  return isNaN(d.getTime()) ? undefined : d.toISOString()
}

/** Chaîne vide → undefined (pour les champs optionnels) */
export const opt = (s?: string) => (s?.trim() ? s.trim() : undefined)
