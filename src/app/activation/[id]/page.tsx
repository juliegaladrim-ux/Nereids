"use client"

import { use } from "react"

import { ProtoBar } from "@/components/app-shell/proto-bar"
import { RoleProvider } from "@/components/app-shell/role-context"
import { ActivationFlow, type ActivationStep } from "@/features/client/activation-flow"

const STEPS: ActivationStep[] = ["mail", "password", "infos", "pieces", "recap"]

/** Parcours d'activation du client particulier, ouvert depuis l'e-mail d'invitation (hors espace connecté) */
export default function ActivationPage({ params, searchParams }: PageProps<"/activation/[id]">) {
  const { id } = use(params)
  const { etape } = use(searchParams)
  const initial = STEPS.find((s) => s === etape)

  return (
    <RoleProvider roleId="client">
      <ActivationFlow id={decodeURIComponent(id)} initialStep={initial} />
      <ProtoBar />
    </RoleProvider>
  )
}
