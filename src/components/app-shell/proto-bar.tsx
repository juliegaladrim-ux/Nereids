"use client"

import { usePathname, useRouter } from "next/navigation"
import { ChevronUp, FlaskConical, LayoutGrid, Mail, RotateCcw } from "lucide-react"
import { toast } from "sonner"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useReplayActivation } from "@/features/client/use-replay-activation"
import { useReplaySuiveurActivation } from "@/features/suiveur/use-replay-suiveur-activation"
import {
  DOSSIER_TYPES,
  LITIGE_ASSUR_TYPES,
  SINISTRE_TYPES,
  STATUSES,
  WORKFLOW_STEPS,
  type Dossier,
  type DossierType,
  type LitigeAssurantielType,
  type SinistreType,
  type StatusId,
} from "@/lib/data"
import { ROLES } from "@/lib/roles"
import { applyScenario, isHorsRecours } from "@/lib/proto-scenario"
import { useStore } from "@/lib/store"
import { useRole } from "./role-context"

/**
 * Bandeau propre au prototype (n'existera pas dans le produit) :
 * permet de changer de profil et de réinitialiser les données de démo.
 */
export function ProtoBar() {
  const { role } = useRole()
  const { reset } = useStore()
  const replayActivation = useReplayActivation()
  const replaySuiveurActivation = useReplaySuiveurActivation()
  const router = useRouter()
  const pathname = usePathname()

  function switchRole(id: string) {
    // On garde la même page si elle existe pour le nouveau rôle
    const rest = pathname.split("/").slice(2).join("/")
    const target = ROLES.find((r) => r.id === id)!
    const keep =
      rest === "compte" ||
      target.nav.some((n) => rest === n.path) ||
      (rest.startsWith("dossiers/") && rest !== "dossiers/nouveau")
    router.push(`/${id}/${keep ? rest : target.home}`)
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-50 flex justify-center px-3">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/10 bg-neutral-900 max-w-full p-1 text-sm sm:pl-3 text-white shadow-lg">
        <FlaskConical className="hidden size-4 text-amber-300 sm:block" />
        <span className="mr-1 hidden text-xs font-medium tracking-wide text-white/60 uppercase sm:inline">Prototype</span>
        <DropdownMenu>
          <DropdownMenuTrigger className={pill}>
            <span className="truncate">
              <span className="hidden sm:inline">Vue : </span>
              {role.label}
            </span>
            <ChevronUp className="size-4 shrink-0 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="center" className="w-72">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Voir la plateforme en tant que…</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={role.id} onValueChange={switchRole}>
                {ROLES.map((r) => (
                  <DropdownMenuRadioItem key={r.id} value={r.id}>
                    {r.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/")}>
              <LayoutGrid />
              Accueil du prototype
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => replayActivation()}>
              <Mail />
              Rejouer l&apos;activation client
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => replaySuiveurActivation()}>
              <Mail />
              Rejouer l&apos;activation suiveur
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                reset()
                toast.success("Données de démo réinitialisées")
              }}
            >
              <RotateCcw />
              Réinitialiser les données de démo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DossierControls />
      </div>
    </div>
  )
}

const pill =
  "flex h-8 max-w-28 min-w-0 items-center gap-1 rounded-full bg-white/10 px-2.5 sm:max-w-56 sm:gap-1.5 sm:px-3 font-medium outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/40"

/** Type + qualification encodés en une seule valeur (ex. « sinistre:responsable ») */
function typeKey(d: Dossier): string {
  return [d.type, d.sinistreType ?? d.litigeType].filter(Boolean).join(":")
}

const TYPE_OPTIONS: { group: DossierType; options: { key: string; label: string }[] }[] = [
  {
    group: "sinistre",
    options: (Object.keys(SINISTRE_TYPES) as SinistreType[]).map((k) => ({ key: `sinistre:${k}`, label: SINISTRE_TYPES[k].label })),
  },
  { group: "litige_auto", options: [{ key: "litige_auto", label: DOSSIER_TYPES.litige_auto.label }] },
  {
    group: "litige_assurantiel",
    options: (Object.keys(LITIGE_ASSUR_TYPES) as LitigeAssurantielType[]).map((k) => ({
      key: `litige_assurantiel:${k}`,
      label: LITIGE_ASSUR_TYPES[k].label,
    })),
  },
]

/**
 * Sur une fiche dossier : bascule le type et l'étape du dossier affiché,
 * pour parcourir tous les cas sans chercher le bon dossier de démo.
 */
function DossierControls() {
  const pathname = usePathname()
  const { getDossier, updateDossier } = useStore()
  // Fiche dossier (tous rôles) ou parcours d'activation client, rattaché à un dossier
  const match = pathname.match(/^\/(?:[^/]+\/dossiers|activation)\/([^/]+)$/)
  const id = match && match[1] !== "nouveau" && match[1] !== "suiveur" ? decodeURIComponent(match[1]) : null
  const d = id ? getDossier(id) : undefined
  if (!d) return null

  const steps = WORKFLOW_STEPS[d.type]
  const step = steps.find((s) => s.statuses.includes(d.status))

  const hors = isHorsRecours(d)

  // Chaque changement reconstruit tout le dossier (pièces, intervenants, expertise, suivi…)
  function setType(key: string) {
    const [type, sub] = key.split(":") as [DossierType, string | undefined]
    updateDossier(d!.id, (x) =>
      applyScenario(x, {
        type,
        sinistreType: type === "sinistre" ? (sub as SinistreType) : undefined,
        litigeType: type === "litige_assurantiel" ? (sub as LitigeAssurantielType) : undefined,
        // Sortie du hors périmètre : on repart de l'étude
        status: x.horsPerimetre ? "en_etude" : x.status,
      }),
    )
  }

  function setStatus(status: string) {
    updateDossier(d!.id, (x) => applyScenario(x, { ...x, status: status as StatusId }))
  }

  return (
    <>
      <span className="mx-1 hidden h-5 w-px bg-white/15 sm:block" />
      <DropdownMenu>
        <DropdownMenuTrigger className={pill}>
          <span className="truncate">{DOSSIER_TYPES[d.type].short}</span>
          <ChevronUp className="size-4 shrink-0 opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="center" className="max-h-[70vh] w-72 overflow-y-auto">
          <DropdownMenuRadioGroup value={typeKey(d)} onValueChange={setType}>
            {TYPE_OPTIONS.map((g, i) => (
              <DropdownMenuGroup key={g.group}>
                {i > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel>{DOSSIER_TYPES[g.group].label}</DropdownMenuLabel>
                {g.options.map((o) => (
                  <DropdownMenuRadioItem key={o.key} value={o.key}>
                    {o.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuGroup>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger className={pill}>
          <span className="truncate">{STATUSES[d.status].label}</span>
          <ChevronUp className="size-4 shrink-0 opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" className="max-h-[70vh] w-72 overflow-y-auto">
          <DropdownMenuRadioGroup value={d.status} onValueChange={setStatus}>
            {steps.map((s, i) => (
              <DropdownMenuGroup key={s.label}>
                {i > 0 && <DropdownMenuSeparator />}
                {i === 0 && hors && (
                  <DropdownMenuLabel className="text-amber-600">Sinistre hors recours : dossier clôturé d&apos;office</DropdownMenuLabel>
                )}
                <DropdownMenuLabel>
                  {i + 1}. {s.label}
                  {s === step && " · étape en cours"}
                </DropdownMenuLabel>
                {s.statuses.map((st) => (
                  <DropdownMenuRadioItem key={st} value={st} disabled={hors && st !== "cloture" && st !== "archive"}>
                    {STATUSES[st].label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuGroup>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
