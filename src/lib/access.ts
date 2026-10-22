import { DOC_CATEGORIES, type DocCategory, type DocumentItem, type Dossier, type TimelineEvent } from "./data"
import type { RoleId } from "./roles"

/** Règles de visibilité par rôle (CDC §12) */
export function visibleDossiers(all: Dossier[], role: RoleId, userId: string): Dossier[] {
  switch (role) {
    case "admin":
      return all
    case "gestionnaire":
      return all.filter((d) => d.intervenants.gestionnaire === userId)
    case "expert":
      return all.filter((d) => d.intervenants.expert === userId)
    case "reparateur":
      return all.filter((d) => d.intervenants.reparateur === userId)
    case "suiveur":
      return all.filter((d) => d.intervenants.suiveurs.includes(userId))
    case "client":
      return all.filter((d) => d.client.userId === userId)
  }
}

export function matchesSearch(d: Dossier, q: string, names: (id?: string) => string): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return true
  const hay = [
    d.ref,
    d.refs.sinistre,
    d.vehicule.immat,
    d.vehicule.immat.replace(/-/g, ""),
    `${d.client.firstName} ${d.client.lastName}`,
    d.client.societe,
    d.compagnie?.nom,
    names(d.intervenants.expert),
    names(d.intervenants.gestionnaire),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
  return hay.includes(s)
}

/** Pièces qu'un client ou un suiveur peut déposer (pas de PV / rapport d'expert ni de facture proforma) */
const CLIENT_DOC_CATEGORIES: DocCategory[] = [
  "constat",
  "carte_grise",
  "photos",
  "devis",
  "facture",
  "facture_achat",
  "entretien",
  "controle_technique",
  "recherche_marche",
  "rapport_compagnie",
  "courrier",
  "autre",
]

/** Pièces que dépose le réparateur (CDC v1 §12.4) */
const REPARATEUR_DOC_CATEGORIES: DocCategory[] = ["devis", "facture_proforma", "facture", "photos"]

export type DossierRights = {
  /** Pilotage : relance, infos internes (M/D/R, échéances), modification des blocs, expertise, références… */
  pilot: boolean
  /** Statut et archivage : réservés à Nereids (CDC v1 §1-2) */
  changeStatus: boolean
  /** Clôturer le dossier (motif, date) : Nereids et gestionnaires Help You (point client 22/10) */
  close: boolean
  /** Assigner les intervenants, ouvrir les comptes intervenants : Nereids et gestionnaires Help You (point client 22/10) */
  assign: boolean
  /** Blocs d'infos modifiables (client : ses coordonnées uniquement) */
  canEdit: (section: string) => boolean
  docCategories: DocCategory[]
  /** Renommer / supprimer un document */
  canManageDoc: (doc: DocumentItem) => boolean
  /** Éléments du suivi visibles (le client ne voit pas les échanges entre intervenants) */
  canSeeEvent: (e: TimelineEvent) => boolean
  /** Choix libre des destinataires d'un message (sinon : message envoyé à Nereids) */
  pickRecipients: boolean
  /** Peut renseigner sa propre référence sur le dossier (réf. PJ, réf. cabinet) */
  ownRef: boolean
}

/** Droits sur la fiche dossier, par rôle */
export function dossierRights(role: RoleId, userId: string): DossierRights {
  if (role === "client") {
    return {
      pilot: false,
      canEdit: (s) => s === "client",
      docCategories: CLIENT_DOC_CATEGORIES,
      canManageDoc: (doc) => doc.addedBy === userId,
      canSeeEvent: (e) =>
        e.kind !== "consultation" &&
        ((e.kind !== "message" && e.kind !== "relance") ||
          e.author === userId ||
          !!e.recipients?.some((r) => r === "client" || r === "all")),
      pickRecipients: false,
      ownRef: false,
      changeStatus: false,
      close: false,
      assign: false,
    }
  }
  // Intervenant suiveur (avocat, protection juridique) : consultation, messages et pièces, aucun pilotage
  if (role === "suiveur") {
    return {
      pilot: false,
      canEdit: () => false,
      docCategories: CLIENT_DOC_CATEGORIES,
      canManageDoc: (doc) => doc.addedBy === userId,
      canSeeEvent: (e) =>
        e.kind !== "consultation" &&
        ((e.kind !== "message" && e.kind !== "relance") ||
          e.author === userId ||
          !!e.recipients?.some((r) => r === "suiveur" || r === "all")),
      pickRecipients: true,
      ownRef: true,
      changeStatus: false,
      close: false,
      assign: false,
    }
  }
  // Réparateur : ses dossiers uniquement, dépôt devis / facture proforma / facture / photos, échanges dans le suivi,
  // téléchargement des documents (CDC v1 §1, §12.4) — aucun pilotage, statut ni modification des infos
  if (role === "reparateur") {
    return {
      pilot: false,
      canEdit: () => false,
      docCategories: REPARATEUR_DOC_CATEGORIES,
      canManageDoc: (doc) => doc.addedBy === userId,
      canSeeEvent: (e) =>
        e.kind !== "consultation" &&
        ((e.kind !== "message" && e.kind !== "relance") ||
          e.author === userId ||
          !!e.recipients?.some((r) => r === "reparateur" || r === "all")),
      // Coordination avec le gestionnaire et l'expert (proposition Galadrim, persona réparateur)
      pickRecipients: true,
      ownRef: false,
      changeStatus: false,
      close: false,
      assign: false,
    }
  }
  // Gestionnaire Help You : même base que l'admin sur ses dossiers (CDC v1 §1, §12.2) —
  // modifie, dépose, relance, échange, assigne les intervenants et clôture (point client 22/10) ;
  // le changement de statut et l'archivage restent à Nereids
  if (role === "gestionnaire") {
    return {
      pilot: true,
      canEdit: () => true,
      docCategories: Object.keys(DOC_CATEGORIES) as DocCategory[],
      canManageDoc: () => true,
      canSeeEvent: (e) => e.kind !== "consultation",
      pickRecipients: true,
      ownRef: false,
      changeStatus: false,
      close: true,
      assign: true,
    }
  }
  return {
    pilot: true,
    canEdit: () => true,
    docCategories: Object.keys(DOC_CATEGORIES) as DocCategory[],
    canManageDoc: () => true,
    // Les consultations du dossier ne sont visibles que par Nereids
    canSeeEvent: (e) => e.kind !== "consultation" || role === "admin",
    pickRecipients: true,
    ownRef: false,
    changeStatus: true,
    close: true,
    assign: true,
  }
}
