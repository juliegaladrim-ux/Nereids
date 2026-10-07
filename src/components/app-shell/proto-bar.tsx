"use client"

import { usePathname, useRouter } from "next/navigation"
import { ChevronUp, FlaskConical, Mail, RotateCcw } from "lucide-react"
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
import { CLIENT_ACTIVATION_DOSSIER, seedDossiers } from "@/lib/data"
import { ROLES } from "@/lib/roles"
import { useStore } from "@/lib/store"
import { useRole } from "./role-context"

/**
 * Bandeau propre au prototype (n'existera pas dans le produit) :
 * permet de changer de profil et de réinitialiser les données de démo.
 */
export function ProtoBar() {
  const { role } = useRole()
  const { reset, updateDossier } = useStore()
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
    router.push(`/${id}/${keep ? rest : "tableau-de-bord"}`)
  }

  /** Remet le dossier d'activation dans son état initial et rouvre l'e-mail d'invitation */
  function replayActivation() {
    const seed = seedDossiers().find((d) => d.id === CLIENT_ACTIVATION_DOSSIER)!
    updateDossier(seed.id, () => seed)
    router.push(`/activation/${seed.id}`)
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-50 flex justify-center px-3">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/10 bg-neutral-900 p-1 pl-3 text-sm text-white shadow-lg">
        <FlaskConical className="size-4 text-amber-300" />
        <span className="mr-1 hidden text-xs font-medium tracking-wide text-white/60 uppercase sm:inline">Prototype</span>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-8 items-center gap-1.5 rounded-full bg-white/10 px-3 font-medium outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/40">
            Vue : {role.label}
            <ChevronUp className="size-4 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="center" className="w-72">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Voir la plateforme en tant que…</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={role.id} onValueChange={switchRole}>
                {ROLES.map((r) => (
                  <DropdownMenuRadioItem key={r.id} value={r.id}>
                    <div className="flex flex-col">
                      <span>{r.label}</span>
                      {!r.ready && <span className="text-xs text-muted-foreground">Espace à concevoir</span>}
                    </div>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={replayActivation}>
              <Mail />
              Rejouer l&apos;activation client (e-mail)
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
      </div>
    </div>
  )
}
