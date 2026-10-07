import { Camera, FileText, IdCard, type LucideIcon } from "lucide-react"

import { DOSSIER_TYPES, SINISTRE_TYPES, expectedDocs, type DocCategory, type Dossier } from "@/lib/data"

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
  const expected = expectedDocs(d.type, d.litigeType)
  const missing = expected.filter((c) => !d.documents.some((doc) => doc.category === c))
  return { expected, missing }
}
