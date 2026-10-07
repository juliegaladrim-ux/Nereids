"use client"

import { Hammer } from "lucide-react"

import { useRole } from "@/components/app-shell/role-context"
import { PageHeader } from "@/components/page-header"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import type { RoleId } from "@/lib/roles"

type PageKey = "tableau-de-bord" | "dossiers" | "dossier" | "nouveau" | "archives" | "utilisateurs"

const TITLES: Record<PageKey, string> = {
  "tableau-de-bord": "Tableau de bord",
  dossiers: "Dossiers",
  dossier: "Fiche dossier",
  nouveau: "Nouveau dossier",
  archives: "Archives",
  utilisateurs: "Gestion des utilisateurs",
}

/** Ce qui est prévu pour chaque espace (source : parcours FigJam + CDC) */
const PLANNED: Partial<Record<RoleId, Partial<Record<PageKey, string[]>>>> = {
  gestionnaire: {
    "tableau-de-bord": ["Mes dossiers Help You uniquement", "Dossiers en retard et actions attendues", "Relances à envoyer"],
    dossiers: ["Filtres : statut, type, expert, réparateur, période, en retard", "Recherche globale"],
    dossier: ["Écrire dans le suivi, déposer des documents", "Voir l'action à réaliser", "Pas de changement de statut ni de clôture (réservé à Nereids)"],
    nouveau: ["Même parcours de création que l'administrateur", "Nereids est notifié pour l'assignation"],
  },
  expert: {
    "tableau-de-bord": ["Mes dossiers uniquement", "Dates d'expertise prévues en évidence"],
    dossiers: ["Filtre par statut : en étude, attente expertise, attente PV, attente rapport"],
    dossier: ["Valider / refuser le recours", "Organiser l'expertise (date, lieu, convocation)", "Déposer PV et rapports, modifier le statut", "Onglet tierce expertise (litige assurantiel)"],
  },
  reparateur: {
    "tableau-de-bord": ["Liste simple : client, véhicule, statut, action attendue", "Résumé de ma charge par statut"],
    dossiers: ["Filtre : attente devis, attente réparation, en expertise, clôturé"],
    dossier: ["Action mise en avant : « Déposer votre devis »", "Dépôt facture proforma, facture, photos (mobile)"],
  },
  suiveur: {
    "tableau-de-bord": ["Dossiers suivis : réf. dossier, réf. PJ, client, statut, dernière mise à jour"],
    dossiers: ["Recherche par référence ou nom du client"],
    dossier: ["Consultation : statut, prochaine action, suivi", "Répondre aux messages, déposer et télécharger des pièces", "Aucune action de pilotage"],
  },
  client: {
    "tableau-de-bord": ["Parcours le plus guidé, pensé mobile en priorité", "Où en est mon dossier et ce que j'ai à faire"],
    dossiers: ["Mes dossiers (souvent un seul)"],
    dossier: ["Statut, documents, messages", "Renseigner mon réparateur, déposer mes pièces"],
    nouveau: ["Création guidée : sinistre, litige automobile ou assurantiel", "Pièces adaptées au type, complétables plus tard"],
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
