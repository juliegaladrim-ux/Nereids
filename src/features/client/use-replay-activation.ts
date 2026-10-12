"use client"

import { useRouter } from "next/navigation"

import { CLIENT_ACTIVATION_DOSSIER, seedDossiers } from "@/lib/data"
import { useStore } from "@/lib/store"
import type { ActivationStep } from "./activation-flow"

/** Remet le dossier d'activation dans son état initial et rouvre le parcours (première connexion du client) */
export function useReplayActivation() {
  const { updateDossier } = useStore()
  const router = useRouter()
  return (step: ActivationStep = "password") => {
    const seed = seedDossiers().find((d) => d.id === CLIENT_ACTIVATION_DOSSIER)!
    updateDossier(seed.id, () => seed)
    router.push(`/activation/${seed.id}${step === "password" ? "" : `?etape=${step}`}`)
  }
}
