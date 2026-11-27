/**
 * Paiement et facture : devis, factures, avoirs et paiements d'un dossier.
 * Prototype : tout est fictif, rien n'est réellement envoyé à Pennylane.
 */

import type { Dossier } from "./data"

export type PieceKind = "devis" | "facture" | "avoir"
export type LigneType = "service" | "frais" | "remise"
/** Devis : brouillon → émis → accepté / refusé. Facture et avoir : brouillon → émis. */
export type PieceStatut = "brouillon" | "emis" | "accepte" | "refuse"
export type ClientType = "mandant" | "lese" | "proprietaire" | "autre"
export type ModePaiement = "virement" | "cb" | "cheque" | "especes"

export type Ligne = {
  id: string
  type: LigneType
  label: string
  qty: number
  /** Prix unitaire HT en euros (pour une remise : montant de la remise, saisi en positif) */
  unitHt: number
  /** TVA en % */
  tva: number
  /** Ligne affichée à titre d'information : elle ne compte pas dans les totaux (ex. deuxième expertise éventuelle) */
  info?: boolean
}

export type Piece = {
  id: string
  kind: PieceKind
  prefix: string
  number: number
  /** Date de la pièce (ISO) */
  date: string
  statut: PieceStatut
  observations?: string
  lignes: Ligne[]
  client: { type: ClientType; firstName: string; lastName: string; email: string; address?: string }
  /** Pièce importée depuis un fichier (les lignes se résument alors à un montant) */
  fichier?: string
  /** Signature du client (simulation YouSign) avec acceptation des CGV */
  signature?: { at: string; by: string; cgv: boolean }
  /** Pièce générée automatiquement quand l'expert renseigne ses honoraires */
  auto?: boolean
  /** Synchronisation Pennylane (simulée) */
  pennylane?: { at: string }
  createdAt: string
}

export type Paiement = {
  id: string
  date: string
  amount: number
  mode: ModePaiement
  reference?: string
}

export type LienPaiement = { id: string; amount: number; createdAt: string; url: string; paye?: boolean }

export type Facturation = {
  pieces: Piece[]
  paiements: Paiement[]
  liens: LienPaiement[]
}

export const PIECE_LABELS: Record<PieceKind, { singular: string; plural: string; prefix: string; start: number; article: string }> = {
  devis: { singular: "devis", plural: "Devis", prefix: "DE", start: 140, article: "un" },
  facture: { singular: "facture", plural: "Factures", prefix: "FA", start: 210, article: "une" },
  avoir: { singular: "avoir", plural: "Avoirs", prefix: "AV", start: 12, article: "un" },
}

export const STATUT_LABELS: Record<PieceStatut, string> = {
  brouillon: "Brouillon",
  emis: "Émis",
  accepte: "Accepté",
  refuse: "Refusé",
}

export const CLIENT_TYPES: { value: ClientType; label: string }[] = [
  { value: "mandant", label: "Mandant" },
  { value: "lese", label: "Lésé" },
  { value: "proprietaire", label: "Propriétaire du véhicule" },
  { value: "autre", label: "Autre" },
]

export const MODES_PAIEMENT: { value: ModePaiement; label: string }[] = [
  { value: "virement", label: "Virement" },
  { value: "cb", label: "Carte bancaire" },
  { value: "cheque", label: "Chèque" },
  { value: "especes", label: "Espèces" },
]

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export const pieceNumero = (p: Pick<Piece, "prefix" | "number">) => `${p.prefix}-${p.number}`

export function ligneHt(l: Ligne): number {
  const ht = round2(l.qty * l.unitHt)
  return l.type === "remise" ? -ht : ht
}
export const ligneTtc = (l: Ligne): number => round2(ligneHt(l) * (1 + l.tva / 100))

export function totaux(all: Ligne[]) {
  const lignes = all.filter((l) => !l.info)
  const ht = round2(lignes.reduce((s, l) => s + ligneHt(l), 0))
  const ttc = round2(lignes.reduce((s, l) => s + ligneTtc(l), 0))
  return { ht, tva: round2(ttc - ht), ttc }
}

/**
 * Compteurs de l'onglet Paiements. La base est la dernière facture émise, à défaut le dernier devis non refusé.
 * Les lignes de frais forment les « frais annexes ». Les avoirs et les paiements enregistrés réduisent le restant dû.
 */
export function compteurs(f: Facturation | undefined) {
  const pieces = f?.pieces ?? []
  const recent = (a: Piece, b: Piece) => b.createdAt.localeCompare(a.createdAt)
  const base =
    pieces.filter((p) => p.kind === "facture" && p.statut === "emis").sort(recent)[0] ??
    pieces.filter((p) => p.kind === "devis" && p.statut !== "refuse" && p.statut !== "brouillon").sort(recent)[0]
  const fraisTtc = base ? round2(base.lignes.filter((l) => l.type === "frais" && !l.info).reduce((s, l) => s + ligneTtc(l), 0)) : 0
  const total = base ? totaux(base.lignes).ttc : 0
  const avoirs = round2(pieces.filter((p) => p.kind === "avoir" && p.statut === "emis").reduce((s, p) => s + totaux(p.lignes).ttc, 0))
  const paye = round2((f?.paiements ?? []).reduce((s, p) => s + p.amount, 0))
  return {
    montant: round2(total - fraisTtc),
    frais: fraisTtc,
    total,
    avoirs,
    paye,
    reste: Math.max(0, round2(total - avoirs - paye)),
    base,
  }
}

/** Prochain numéro d'une pièce : le plus grand numéro existant (tous dossiers) + 1 */
export function nextNumber(kind: PieceKind, all: (Facturation | undefined)[]): number {
  const max = all.flatMap((f) => f?.pieces ?? []).filter((p) => p.kind === kind).reduce((m, p) => Math.max(m, p.number), PIECE_LABELS[kind].start - 1)
  return max + 1
}

/**
 * Devis généré quand l'expert renseigne ses honoraires (HT, TVA 20 %) : une ligne d'expertise, et si l'expert l'a prévu
 * une ligne « si deuxième expertise », à titre d'information (hors total) ou actée (dans le total).
 */
export function buildDevis(
  d: Pick<Dossier, "vehicule" | "client">,
  o: { honoraires: number; seconde?: { montant: number; acte: boolean }; lieu?: string; number: number; now?: string },
): Piece {
  const now = o.now ?? new Date().toISOString()
  const id = `l${Date.now().toString(36)}`
  return {
    id: `p${Date.now().toString(36)}`,
    kind: "devis",
    prefix: `DE-${new Date(now).getFullYear()}`,
    number: o.number,
    date: now,
    statut: "emis",
    auto: true,
    observations: "Devis généré à partir des honoraires de l'expert. Il est à signer par le client, avec acceptation des conditions générales de vente.",
    lignes: [
      { id: `${id}a`, type: "service", label: `Expertise — ${d.vehicule.marque} ${d.vehicule.modele} (${d.vehicule.immat})${o.lieu ? `\n${o.lieu}` : ""}`, qty: 1, unitHt: o.honoraires, tva: 20 },
      ...(o.seconde
        ? [{ id: `${id}b`, type: "service" as const, label: "Si deuxième expertise", qty: 1, unitHt: o.seconde.montant, tva: 20, info: !o.seconde.acte }]
        : []),
    ],
    client: { type: "mandant", firstName: d.client.firstName, lastName: d.client.lastName, email: d.client.email, address: d.client.address },
    createdAt: now,
  }
}
