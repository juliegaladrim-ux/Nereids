"use client"

import { Hammer } from "lucide-react"

import { useRole } from "@/components/app-shell/role-context"
import { PageHeader } from "@/components/page-header"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import type { RoleId } from "@/lib/roles"

type PageKey = "tableau-de-bord" | "dossiers" | "dossier" | "nouveau" | "archives" | "utilisateurs" | "annuaire"

const TITLES: Record<PageKey, string> = {
  "tableau-de-bord": "Tableau de bord",
  dossiers: "Dossiers",
  dossier: "Fiche dossier",
  nouveau: "Nouveau dossier",
  archives: "Archives",
  utilisateurs: "Gestion des utilisateurs",
  annuaire: "Annuaire",
}

/** Ce qui est prévu pour chaque espace (source : parcours FigJam + CDC) */
const PLANNED: Partial<Record<RoleId, Partial<Record<PageKey, string[]>>>> = {
  expert: {
    "tableau-de-bord": ["Mes dossiers uniquement", "Dates d'expertise prévues en évidence"],
    dossiers: ["Filtre par statut : en étude, attente expertise, attente PV, attente rapport"],
    dossier: ["Valider / refuser le recours", "Organiser l'expertise (date, lieu, convocation)", "Déposer PV et rapports, modifier le statut", "Onglet tierce expertise (litige assurantiel)"],
  },
  suiveur: {
    "tableau-de-bord": ["Dossiers suivis : réf. dossier, réf. PJ, client, statut, dernière mise à jour"],
    dossiers: ["Recherche par référence ou nom du client"],
    dossier: ["Consultation : statut, prochaine action, suivi", "Répondre aux messages, déposer et télécharger des pièces", "Aucune action de pilotage"],
  },
  client: {
    dossier: ["Statut, documents, messages", "Renseigner mon réparateur, déposer mes pièces"],
  },
  admin: {
    utilisateurs: ["Liste : nom, rôle, structure, région, statut du compte", "Ajouter un utilisateur / partenaire et envoyer l'invitation", "Droits : lecture seule ou lecture / écriture"],
  },
}

export function RoleEmptyState({ page }: { page: PageKey }) {
  const { role } = useRole()
  const planned = PLANNED[role.id]?.[page]

  return (
    <>
      <PageHeader title={TITLES[page]} description={role.label} />
      <Empty className="flex-1 border border-dashed bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Hammer />
          </EmptyMedia>
          <EmptyTitle>Espace en cours de conception</EmptyTitle>
          <EmptyDescription>
            Cet écran de l&apos;espace « {role.label} » sera conçu dans une prochaine itération du prototype.
          </EmptyDescription>
        </EmptyHeader>
        {planned && (
          <EmptyContent>
            <div className="w-full max-w-md rounded-lg bg-muted/50 p-4 text-left">
              <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Ce qui est prévu</p>
              <ul className="list-disc space-y-1 pl-4 text-sm">
                {planned.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          </EmptyContent>
        )}
      </Empty>
    </>
  )
}
