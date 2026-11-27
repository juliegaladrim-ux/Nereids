import { docDate, docLabel, type Dossier, type DocumentItem } from "@/lib/data"

const clean = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

/**
 * Simulation du lot 2 : à l'ajout d'un document, l'IA propose un nom normalisé
 * AAAA-MM-JJ_Type_Immatriculation_Client.ext (la vraie lecture du contenu viendra avec l'IA).
 */
export function suggestName(doc: Pick<DocumentItem, "name" | "category" | "libelle" | "docDate" | "addedAt">, d: Pick<Dossier, "vehicule" | "client">): string {
  const ext = /\.[a-z0-9]{2,4}$/i.exec(doc.name)?.[0] ?? ".pdf"
  const date = docDate(doc as DocumentItem).slice(0, 10)
  const parts = [date, clean(docLabel(doc)), clean(d.vehicule.immat), clean(d.client.lastName || d.client.societe || "")].filter(Boolean)
  return `${parts.join("_")}${ext.toLowerCase()}`
}
