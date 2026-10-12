"use client"

import { useRouter } from "next/navigation"

import { SUIVEUR_ACTIVATION_USER } from "@/lib/data"
import { useStore } from "@/lib/store"
import type { SuiveurActivationStep } from "./suiveur-activation"

/** Remet le compte du suiveur de démo dans son état initial (invité) et rouvre le parcours */
export function useReplaySuiveurActivation() {
  const { dossiers, resetAccount, updateDossier } = useStore()
  const router = useRouter()
  return (step: SuiveurActivationStep = "password") => {
    resetAccount(SUIVEUR_ACTIVATION_USER)
    // On retire aussi la trace de l'activation précédente dans le suivi des dossiers
    const isActivation = (e: { author: string; title: string }) => e.author === SUIVEUR_ACTIVATION_USER && e.title === "Compte intervenant activé"
    for (const d of dossiers.filter((x) => x.timeline.some(isActivation)))
      updateDossier(d.id, (x) => ({ ...x, timeline: x.timeline.filter((e) => !isActivation(e)) }))
    router.push(`/activation/suiveur/${SUIVEUR_ACTIVATION_USER}${step === "password" ? "" : `?etape=${step}`}`)
  }
}
