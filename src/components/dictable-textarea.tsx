"use client"

import { appendText, DictationButton } from "@/components/dictation-button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

/** Champ libre avec dictée vocale : libellé et description à gauche, micro à droite, puis la zone de texte */
export function DictableTextarea({
  id,
  label,
  description,
  value,
  onValueChange,
  rows = 3,
  placeholder,
  className,
}: {
  id: string
  label: React.ReactNode
  description?: React.ReactNode
  value: string
  onValueChange: (v: string) => void
  rows?: number
  placeholder?: string
  className?: string
}) {
  return (
    <Field className={className}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          {description && <FieldDescription>{description}</FieldDescription>}
        </div>
        <DictationButton onText={(t) => onValueChange(appendText(value, t))} />
      </div>
      <Textarea id={id} rows={rows} placeholder={placeholder} value={value} onChange={(e) => onValueChange(e.target.value)} />
    </Field>
  )
}
