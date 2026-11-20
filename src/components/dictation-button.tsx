"use client"

import * as React from "react"
import { Mic, Square } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Reconnaissance vocale du navigateur (Chrome, Edge, Safari) : l'API n'est pas dans les types TypeScript standard */
type RecognitionEvent = { resultIndex: number; results: ArrayLike<{ isFinal: boolean; [i: number]: { transcript: string } }> }
type Recognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
type RecognitionCtor = new () => Recognition

function recognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

/** Ajoute le texte dicté à la suite de la saisie existante */
export function appendText(value: string, text: string): string {
  const t = text.trim()
  if (!t) return value
  return value.trim() ? `${value.trimEnd()} ${t}` : t
}

/**
 * Bouton micro à placer à droite du libellé d'un champ libre : dicte en français et ajoute le texte au champ.
 * Là où le navigateur ne propose pas la dictée (Firefox, micro refusé), un message l'indique.
 */
export function DictationButton({ onText, className }: { onText: (text: string) => void; className?: string }) {
  const [recording, setRecording] = React.useState(false)
  const recognition = React.useRef<Recognition | null>(null)
  // Toujours la dernière version de onText (le texte du champ change pendant la dictée)
  const latest = React.useRef(onText)
  React.useEffect(() => {
    latest.current = onText
  })
  React.useEffect(() => () => recognition.current?.stop(), [])

  function toggle() {
    if (recording) {
      recognition.current?.stop()
      return
    }
    const Ctor = recognitionCtor()
    if (!Ctor) {
      toast("Dictée vocale indisponible", { description: "Utilisez Chrome ou Edge pour dicter vos notes." })
      return
    }
    const r = new Ctor()
    r.lang = "fr-FR"
    r.interimResults = false
    r.continuous = true
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) latest.current(e.results[i][0].transcript)
    }
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed")
        toast("Micro non autorisé", { description: "Autorisez l'accès au micro dans le navigateur pour dicter." })
    }
    r.onend = () => {
      setRecording(false)
      recognition.current = null
    }
    recognition.current = r
    setRecording(true)
    r.start()
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="icon-xs"
      onClick={toggle}
      aria-pressed={recording}
      aria-label={recording ? "Arrêter la dictée" : "Dicter"}
      title={recording ? "Arrêter la dictée" : "Dicter"}
      className={cn("shrink-0", recording && "bg-destructive/10 text-destructive animate-pulse hover:bg-destructive/15", className)}
    >
      {recording ? <Square /> : <Mic />}
    </Button>
  )
}
