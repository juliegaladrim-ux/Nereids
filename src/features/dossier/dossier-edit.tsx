"use client"

import * as React from "react"

import { SimpleSelect, type Option } from "@/components/simple-select"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

/**
 * Édition générique d'un bloc d'infos du dossier (admin : tout est modifiable,
 * à tout moment). Chaque bloc décrit ses champs + comment les réappliquer.
 */

export type Values = Record<string, string>

export type EditField = {
  key: string
  label: string
  type?: "text" | "email" | "tel" | "textarea" | "select" | "date" | "datetime"
  options?: Option[] | ((v: Values) => Option[])
  hidden?: (v: Values) => boolean
  hint?: string
  full?: boolean
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{section?.title}</DialogTitle>
          <DialogDescription>{section?.description ?? "La modification sera tracée dans le suivi du dossier."}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {section?.fields
            .filter((f) => !f.hidden?.(v))
            .map((f) => {
              const id = `edit-${f.key}`
              const full = f.full || f.type === "textarea"
              return (
                <Field key={f.key} className={cn(full && "sm:col-span-2")}>
                  <FieldLabel htmlFor={id}>
                    {f.label}
                    {section.required?.includes(f.key) && " *"}
                  </FieldLabel>
                  {f.type === "textarea" ? (
                    <Textarea id={id} rows={3} value={v[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />
                  ) : f.type === "select" ? (
                    <SimpleSelect
                      id={id}
                      value={v[f.key] || null}
                      onChange={(val) => set(f.key, val ?? "")}
                      options={typeof f.options === "function" ? f.options(v) : (f.options ?? [])}
                    />
                  ) : (
                    <Input
                      id={id}
                      type={f.type === "datetime" ? "datetime-local" : (f.type ?? "text")}
                      value={v[f.key] ?? ""}
                      onChange={(e) => set(f.key, e.target.value)}
                    />
                  )}
                  {f.hint && <FieldDescription>{f.hint}</FieldDescription>}
                </Field>
              )
            })}
        </div>
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
