import { Camera, FileText, IdCard, type LucideIcon } from "lucide-react"

import { DOSSIER_TYPES, SINISTRE_TYPES, expectedDocs, type DocCategory, type Dossier, type StatusId } from "@/lib/data"

/** Libellés et aides « grand public » pour les pièces demandées au client */
export const CLIENT_DOC_COPY: Partial<Record<DocCategory, { label: string; hint: string; icon: LucideIcon }>> = {
  constat: { label: "Constat amiable", hint: "Les 2 pages, bien lisibles", icon: FileText },
  carte_grise: { label: "Carte grise", hint: "Recto et verso", icon: IdCard },
  photos: { label: "Photos du véhicule", hint: "Dommages de près, véhicule entier, plaque", icon: Camera },
}

/** « Sinistre non responsable, avec tiers », « Litige automobile »… */
export function clientTypeLabel(d: Dossier): string {
  const sub = d.sinistreType && SINISTRE_TYPES[d.sinistreType].label.toLowerCase().replace(/^sinistre /, "")
  return sub ? `${DOSSIER_TYPES[d.type].label} ${sub}` : DOSSIER_TYPES[d.type].label
}

/** Pièces attendues du client, et celles qui manquent encore */
export function clientDocsStatus(d: Dossier) {
  const expected = expectedDocs(d.type, d.litigeType, d.sinistreType)
  const missing = expected.filter((c) => !d.documents.some((doc) => doc.category === c))
  return { expected, missing }
}

/**
 * Étapes vues par le client : 5 grandes étapes compréhensibles,
 * au lieu des statuts internes (CDC §17) trop détaillés pour un particulier.
 */
export const CLIENT_STEPS: { label: string; statuses: StatusId[]; title: string; next: string }[] = [
  {
    label: "Ouverture",
    statuses: ["nouveau"],
    title: "Nereids vérifie votre dossier",
    next: "Il sera confié à un expert automobile sous 48 h.",
  },
  {
    label: "Étude",
    statuses: ["en_etude", "attente_client", "recours_valide", "attente_tiers", "attente_compagnie"],
    title: "Un expert étudie votre dossier",
    next: "Il vérifie que le recours est possible, puis organise l'expertise.",
  },
  {
    label: "Expertise",
    statuses: ["attente_expertise", "attente_pv", "complement", "attente_rapport", "attente_reparation"],
    title: "L'expertise de votre véhicule est en cours",
    next: "L'expert chiffre les dommages et rédige son rapport.",
  },
  {
    label: "Indemnisation",
    statuses: ["reclamation_envoyee", "attente_retour", "attente_paiement"],
    title: "Nereids réclame votre indemnisation",
    next: "Vous serez prévenu dès que l'assurance aura répondu.",
  },
  {
    label: "Terminé",
    statuses: ["cloture", "archive"],
    title: "Votre dossier est terminé",
    next: "Merci de votre confiance.",
  },
]
