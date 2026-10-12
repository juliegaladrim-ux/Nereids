"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Briefcase, UserRound } from "lucide-react"

import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { InfoBlock, PasswordStep, StepLayout, TextField } from "@/features/client/activation-flow"
import { visibleDossiers } from "@/lib/access"
import { getUser, type Dossier, type User } from "@/lib/data"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"

export type SuiveurActivationStep = "password" | "infos"

const NUMBERED: SuiveurActivationStep[] = ["password", "infos"]

type Infos = Pick<User, "firstName" | "lastName" | "fonction" | "structure" | "phone" | "email">

const isClosed = (d: Dossier) => d.status === "cloture" || d.status === "archive"

/** Activation du compte intervenant suiveur (avocat, protection juridique), ouverte depuis le lien de l'e-mail d'invitation */
export function SuiveurActivation({ userId, initialStep }: { userId: string; initialStep?: SuiveurActivationStep }) {
  const { accounts } = useStore()
  const user = getUser(userId)
  if (!user || user.role !== "suiveur") return <p className="p-8 text-muted-foreground">Invitation introuvable.</p>
  return <Flow key={user.id} user={user} activated={!!accounts[user.id]?.activatedAt} initialStep={initialStep} />
}

function Flow({ user, activated, initialStep }: { user: User; activated: boolean; initialStep?: SuiveurActivationStep }) {
  const { dossiers, updateAccount, addEvent } = useStore()
  const router = useRouter()
  const followed = visibleDossiers(dossiers, "suiveur", user.id).filter((d) => !isClosed(d))

  const [step, setStep] = React.useState<SuiveurActivationStep>(initialStep ?? (activated ? "infos" : "password"))
  const [infos, setInfos] = React.useState<Infos>({
    firstName: user.firstName,
    lastName: user.lastName,
    fonction: user.fonction,
    structure: user.structure,
    phone: user.phone,
    email: user.email,
  })

  const go = (s: SuiveurActivationStep) => {
    setStep(s)
    window.scrollTo({ top: 0 })
  }

  function activate() {
    const now = new Date().toISOString()
    updateAccount(user.id, (a) => ({ invitedAt: a?.invitedAt ?? now, ...a, activatedAt: now }))
    go("infos")
  }

  function submit() {
    const changed = (Object.keys(infos) as (keyof Infos)[]).filter((k) => infos[k] !== user[k])
    updateAccount(user.id, (a) => ({
      invitedAt: a?.invitedAt ?? new Date().toISOString(),
      activatedAt: a?.activatedAt ?? new Date().toISOString(),
      ...a,
      profile: { ...a?.profile, ...infos },
    }))
    // Nereids voit dans le suivi de chaque dossier que l'intervenant a rejoint la plateforme
    for (const d of followed) {
      addEvent(d.id, {
        kind: "system",
        author: user.id,
        title: "Compte intervenant activé",
        body: `${infos.firstName} ${infos.lastName} (${infos.structure}) peut suivre le dossier.${changed.length ? " Coordonnées mises à jour." : ""}`,
      })
    }
    toast.success(`Bienvenue, ${infos.firstName}`, { description: `${followed.length} dossier${followed.length > 1 ? "s" : ""} à suivre.` })
    router.push("/suiveur/dossiers")
  }

  const index = NUMBERED.indexOf(step)

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-xl items-center gap-3 px-4">
          {index > 0 ? (
            <Button variant="ghost" size="icon-sm" aria-label="Retour" onClick={() => go(NUMBERED[index - 1])}>
              <ArrowLeft />
            </Button>
          ) : (
            <Logo />
          )}
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground tabular-nums">
              Étape {index + 1} sur {NUMBERED.length}
            </span>
            <div className="flex gap-1">
              {NUMBERED.map((s, i) => (
                <span key={s} className={cn("h-1.5 w-6 rounded-full", i <= index ? "bg-brand" : "bg-border")} />
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pt-6 pb-44 sm:pb-24">
        {step === "password" && (
          <PasswordStep client={user} subtitle="Créez votre mot de passe pour accéder aux dossiers que vous suivez." onDone={activate} />
        )}
        {step === "infos" && <InfosStep infos={infos} setInfos={setInfos} onSubmit={submit} />}
      </main>
    </div>
  )
}

// ─── 2. Vérification des coordonnées ────────────────────────────────────────

function InfosStep({ infos, setInfos, onSubmit }: { infos: Infos; setInfos: React.Dispatch<React.SetStateAction<Infos>>; onSubmit: () => void }) {
  const [editing, setEditing] = React.useState<"identite" | "structure" | null>(null)
  const set = (k: keyof Infos, v: string) => setInfos((p) => ({ ...p, [k]: v }))

  return (
    <StepLayout
      icon={<UserRound />}
      title="Vérifiez vos coordonnées"
      subtitle="Elles ont été saisies par Nereids. Corrigez-les si besoin : elles sont visibles des autres intervenants du dossier."
      footer={
        <Button size="lg" className="w-full" onClick={onSubmit}>
          {editing ? "Enregistrer et accéder à mes dossiers" : "C'est correct, accéder à mes dossiers"}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <InfoBlock
          icon={<UserRound />}
          title="Mes coordonnées"
          editing={editing === "identite"}
          onEdit={() => setEditing(editing === "identite" ? null : "identite")}
          rows={[
            ["Nom", `${infos.firstName} ${infos.lastName}`],
            ["Téléphone", infos.phone],
            ["E-mail", infos.email],
          ]}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="s-first" label="Prénom" value={infos.firstName} onChange={(v) => set("firstName", v)} />
            <TextField id="s-last" label="Nom" value={infos.lastName} onChange={(v) => set("lastName", v)} />
            <TextField id="s-phone" label="Téléphone" type="tel" value={infos.phone} onChange={(v) => set("phone", v)} />
            <TextField id="s-mail" label="E-mail" type="email" value={infos.email} onChange={(v) => set("email", v)} />
          </div>
        </InfoBlock>

        <InfoBlock
          icon={<Briefcase />}
          title="Ma structure"
          editing={editing === "structure"}
          onEdit={() => setEditing(editing === "structure" ? null : "structure")}
          rows={[
            ["Cabinet / société", infos.structure],
            ["Fonction", infos.fonction || <span key="f" className="text-muted-foreground">Non renseignée</span>],
          ]}
        >
          <div className="grid gap-4">
            <TextField id="s-structure" label="Cabinet / société" value={infos.structure} onChange={(v) => set("structure", v)} />
            <TextField id="s-fonction" label="Fonction" hint="Ex. : avocat, juriste protection juridique" value={infos.fonction} onChange={(v) => set("fonction", v)} />
          </div>
        </InfoBlock>
      </div>
    </StepLayout>
  )
}
