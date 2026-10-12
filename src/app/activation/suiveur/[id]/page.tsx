"use client"

import { use } from "react"

import { ProtoBar } from "@/components/app-shell/proto-bar"
import { RoleProvider } from "@/components/app-shell/role-context"
import { SuiveurActivation, type SuiveurActivationStep } from "@/features/suiveur/suiveur-activation"

const STEPS: SuiveurActivationStep[] = ["password", "infos"]

/** Parcours d'activation de l'intervenant suiveur, ouvert depuis le lien de l'e-mail d'invitation (hors espace connecté) */
export default function SuiveurActivationPage({ params, searchParams }: PageProps<"/activation/suiveur/[id]">) {
  const { id } = use(params)
  const { etape } = use(searchParams)
  const initial = STEPS.find((s) => s === etape)

  return (
    <RoleProvider roleId="suiveur">
      <SuiveurActivation userId={decodeURIComponent(id)} initialStep={initial} />
      <ProtoBar />
    </RoleProvider>
  )
}
