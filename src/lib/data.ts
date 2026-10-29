/**
 * Modèle de données du prototype — toutes les données sont FICTIVES.
 * Structure pensée pour être réutilisable par les devs (types proches du CDC §6/§7).
 */

import type { RoleId } from "./roles"

// ─── Référentiels ────────────────────────────────────────────────────────────

export type DossierType = "sinistre" | "litige_auto" | "litige_assurantiel"

export const DOSSIER_TYPES: Record<DossierType, { label: string; short: string; description: string }> = {
  sinistre: {
    label: "Sinistre",
    short: "Sinistre",
    description: "Accident, recours direct contre l'assurance adverse.",
  },
  litige_auto: {
    label: "Litige automobile",
    short: "Litige auto",
    description: "Achat, vente, réparation, désaccord technique.",
  },
  litige_assurantiel: {
    label: "Litige assurantiel",
    short: "Litige assur.",
    description: "Désaccord avec la compagnie du client (valeur, rapport…).",
  },
}

export type SinistreType = "responsable" | "non_resp_sans_tiers" | "non_resp_avec_tiers"

export const SINISTRE_TYPES: Record<SinistreType, { label: string; recours: boolean }> = {
  responsable: { label: "Sinistre responsable", recours: false },
  non_resp_sans_tiers: { label: "Non responsable, sans tiers", recours: false },
  non_resp_avec_tiers: { label: "Non responsable, avec tiers", recours: true },
}

export type LitigeAssurantielType =
  | "valeur"
  | "rapport_minore"
  | "imputable"
  | "incoherence"
  | "indemnisation"
  | "sans_reparation"

export const LITIGE_ASSUR_TYPES: Record<LitigeAssurantielType, { label: string; hint: string }> = {
  valeur: { label: "Valeur contestée", hint: "La valeur retenue pour le véhicule est trop basse." },
  rapport_minore: { label: "Rapport minoré", hint: "Le rapport de la compagnie sous-évalue les dommages." },
  imputable: { label: "Problème imputable", hint: "Dommage causé lors d'une réparation ou expertise." },
  incoherence: { label: "Incohérence de déclaration", hint: "La compagnie conteste la déclaration." },
  indemnisation: { label: "Problème d'indemnisation", hint: "Retard ou refus d'indemnisation." },
  sans_reparation: { label: "Indemnisation sans réparation", hint: "Désaccord sur une indemnisation en l'état." },
}

/** Statuts V1 (CDC §17) */
export type StatusId =
  | "nouveau"
  | "en_etude"
  | "recours_valide"
  | "attente_client"
  | "attente_tiers"
  | "attente_compagnie"
  | "attente_expertise"
  | "attente_pv"
  | "attente_rapport"
  | "attente_reparation"
  | "complement"
  | "reclamation_envoyee"
  | "attente_retour"
  | "attente_paiement"
  | "cloture"
  | "archive"

/** Ton visuel du statut — les couleurs seront recalées sur la charte */
export type StatusTone = "new" | "progress" | "waiting" | "alert" | "final" | "done" | "muted"

export const STATUSES: Record<StatusId, { label: string; tone: StatusTone }> = {
  nouveau: { label: "Nouveau", tone: "new" },
  en_etude: { label: "En étude", tone: "progress" },
  recours_valide: { label: "Recours validé", tone: "progress" },
  attente_client: { label: "En attente client", tone: "waiting" },
  attente_tiers: { label: "En attente tiers", tone: "waiting" },
  attente_compagnie: { label: "En attente compagnie", tone: "waiting" },
  attente_expertise: { label: "En attente expertise", tone: "waiting" },
  attente_pv: { label: "En attente PV", tone: "waiting" },
  attente_rapport: { label: "En attente rapport", tone: "waiting" },
  attente_reparation: { label: "En attente réparation", tone: "waiting" },
  complement: { label: "Complément à traiter", tone: "alert" },
  reclamation_envoyee: { label: "Réclamation envoyée", tone: "final" },
  attente_retour: { label: "En attente retour", tone: "final" },
  attente_paiement: { label: "En attente paiement", tone: "final" },
  cloture: { label: "Clôturé", tone: "done" },
  archive: { label: "Archivé", tone: "muted" },
}

/** Ordre d'avancement des statuts (sert à savoir si une étape est atteinte, ex. « En attente PV ») */
export const STATUS_ORDER = Object.keys(STATUSES) as StatusId[]

export const ACTIVE_STATUSES = (Object.keys(STATUSES) as StatusId[]).filter(
  (s) => s !== "cloture" && s !== "archive",
)

export const CLOSING_REASONS = [
  "Dossier terminé",
  "Accord trouvé",
  "Paiement reçu",
  "Sans suite",
  "Hors périmètre",
  "Non validé par l'expert",
]

export type DocCategory =
  | "constat"
  | "carte_grise"
  | "photos"
  | "devis"
  | "facture"
  | "facture_proforma"
  | "pv"
  | "pre_rapport"
  | "rapport"
  | "controle_technique"
  | "facture_achat"
  | "entretien"
  | "recherche_marche"
  | "rapport_compagnie"
  | "courrier"
  | "autre"

export const DOC_CATEGORIES: Record<DocCategory, string> = {
  constat: "Constat",
  carte_grise: "Carte grise",
  photos: "Photos",
  devis: "Devis",
  facture: "Factures de réparation",
  facture_proforma: "Facture proforma",
  pv: "PV d'expertise",
  pre_rapport: "Pré-rapport",
  rapport: "Rapport d'expertise",
  controle_technique: "Contrôle technique",
  facture_achat: "Factures d'achat",
  entretien: "Factures d'entretien",
  recherche_marche: "Recherche marché",
  rapport_compagnie: "Rapport de la compagnie",
  courrier: "Courrier",
  autre: "Autre",
}

/** Pièces attendues à la création, selon le type (CDC §4) */
export function expectedDocs(type: DossierType, sub?: LitigeAssurantielType): DocCategory[] {
  if (type === "sinistre") return ["constat", "carte_grise", "photos"]
  if (type === "litige_auto")
    return ["facture_achat", "facture", "entretien", "carte_grise", "controle_technique"]
  switch (sub) {
    case "valeur":
      return ["recherche_marche", "carte_grise", "entretien", "controle_technique", "rapport_compagnie"]
    case "rapport_minore":
      return ["rapport_compagnie", "carte_grise"]
    case "imputable":
      return ["photos", "rapport_compagnie", "carte_grise"]
    default:
      return ["carte_grise", "entretien", "controle_technique", "rapport_compagnie"]
  }
}

/** Libellé de la « compagnie visée » selon le type (CDC §8) */
export function compagnieLabel(type: DossierType): string {
  if (type === "sinistre") return "Assurance adverse"
  if (type === "litige_auto") return "Suiveur principal"
  return "Compagnie visée"
}

// ─── Entités ─────────────────────────────────────────────────────────────────

export type User = {
  id: string
  role: RoleId
  firstName: string
  lastName: string
  /** E-mail principal : connexion et notifications */
  email: string
  /** Autres e-mails (secrétariat, comptabilité…), affichés sur la fiche — l'e-mail principal reste le seul utilisé pour l'outil */
  autresEmails?: EmailSecondaire[]
  phone: string
  structure: string
  fonction: string
  /** Adresse postale (affichée sur les fiches des personnes convoquées à l'expertise) */
  address?: string
  region?: string
  /** Départements d'intervention (dans sa région), saisis à l'ajout de l'utilisateur */
  departements?: string[]
  /** Charge actuelle (nb dossiers actifs) — utile pour l'assignation */
  load?: number
}

/** E-mail secondaire d'un contact, avec un libellé libre (ex. « Secrétariat ») */
export type EmailSecondaire = { email: string; label: string }

export type Intervenants = {
  gestionnaire?: string
  expert?: string
  reparateur?: string
  suiveurs: string[]
}

export type DocumentItem = {
  id: string
  name: string
  category: DocCategory
  addedBy: string // userId
  addedAt: string // ISO
  /** Date figurant sur la pièce (ex. date du certificat d'immatriculation) — ISO ; à défaut, la date d'ajout */
  docDate?: string
  size: string
}

/** Date du document, utilisée pour le classement par défaut de l'onglet Documents */
export const docDate = (doc: DocumentItem) => doc.docDate ?? doc.addedAt

/** Ancienneté typique d'une pièce au moment de son dépôt (jours) — données de démo */
const DOC_AGE: Partial<Record<DocCategory, number>> = {
  carte_grise: 820,
  facture_achat: 540,
  controle_technique: 300,
  entretien: 120,
  rapport_compagnie: 12,
  recherche_marche: 2,
  constat: 1,
  photos: 1,
}
export function demoDocDate(category: DocCategory, addedAt: string): string {
  const t = new Date(addedAt)
  t.setDate(t.getDate() - (DOC_AGE[category] ?? 0))
  return t.toISOString()
}

export type TimelineKind = "creation" | "status" | "document" | "message" | "assignation" | "relance" | "expertise" | "system" | "consultation"

export type TimelineEvent = {
  id: string
  at: string // ISO
  kind: TimelineKind
  author: string // userId ou "system"
  title: string
  body?: string
  /** Pour les messages : rôles destinataires */
  recipients?: (RoleId | "all")[]
  /** Réponse unique à un message (pas de fil de discussion) */
  reply?: MessageReply
  /** Pièces jointes d'un message : documents du dossier (classés aussi dans l'onglet Documents) */
  docIds?: string[]
}

export type MessageReply = { author: string; at: string; body: string }

/** Note interne Nereids : visible uniquement par les admins */
export type InternalNote = { id: string; at: string; author: string; body: string }

export type Expertise = {
  date?: string // ISO
  lieu?: string
  /** Personnes à qui la convocation a été envoyée — vide = convocation pas encore faite */
  convoques: string[]
  /** Personnes à convoquer, ajoutées à la main avant l'envoi (à défaut : client, réparateur, expert) */
  aConvoquer?: string[]
  pvDocId?: string
  rapportDocId?: string
  realisee?: boolean
}

export type Dossier = {
  id: string
  ref: string // réf. Nereids
  type: DossierType
  sinistreType?: SinistreType
  litigeType?: LitigeAssurantielType
  status: StatusId
  createdAt: string
  updatedAt: string
  client: Personne & { userId?: string }
  /** Propriétaire du véhicule, s'il n'est pas le client (absent = le client est propriétaire) */
  proprietaire?: Personne
  vehicule: { marque: string; modele: string; immat: string; vin?: string }
  compagnie?: { nom: string; email?: string; phone?: string; address?: string; reference?: string }
  tiers?: { nom: string; phone?: string; email?: string }[]
  refs: { sinistre?: string }
  region: string
  /** Département d'intervention (ex. « 43 Haute-Loire ») — à défaut, déduit du code postal du client */
  departement?: string
  intervenants: Intervenants
  /** Les 3 questions du CDC §2 */
  pilotage: {
    ouEnEst: string
    attente: string
    prochaineAction: string
    quiDoitAgir: RoleId | "nereids"
    echeance?: string // ISO — si dépassée → retard
  }
  /** Expertise n°1 (celle affichée en en-tête, calendrier, scénario) */
  expertise: Expertise
  /** Expertises suivantes : n°2, n°3… ajoutées par l'admin ou l'expert */
  autresExpertises?: Expertise[]
  documents: DocumentItem[]
  timeline: TimelineEvent[]
  description?: string
  cloture?: { motif: string; commentaire?: string; at: string }
  horsPerimetre?: boolean
  /** Accès du client particulier : invitation e-mail → activation → envoi des pièces */
  clientAccess?: { invitedAt: string; activatedAt?: string; submittedAt?: string }
  /** L'admin a choisi de ne pas ouvrir de compte au client à la création (il pourra l'inviter plus tard) */
  noClientAccount?: boolean
  /** Demandes d'ouverture de compte intervenant suiveur faites par le client */
  suiveurRequests?: SuiveurRequest[]
  /** Experts / réparateurs hors annuaire, saisis à la main par Nereids lors de l'assignation */
  extraIntervenants?: User[]
  /** Référence de chaque intervenant suiveur dans son propre outil (réf. PJ, réf. cabinet), par userId */
  suiveurRefs?: Record<string, string>
  /** Notes internes (onglet « Notes internes », admin Nereids + gestionnaires Help You) */
  notes?: InternalNote[]
  /** Validation client (mission / devis / règlement) — alimentée par les automatisations ; absente = déduite du statut */
  validation?: ClientValidation
}

/** Client ou propriétaire : personne physique (prénom, nom) ou morale (société, SIRET) */
export type Personne = {
  /** Absent = personne physique */
  kind?: "physique" | "morale"
  firstName: string
  lastName: string
  societe?: string
  siret?: string
  phone: string
  email: string
  /** Adresse postale */
  address?: string
  /** Fiche de l'annuaire d'où viennent ces infos (copiées à la création : le dossier n'est pas modifié si la fiche change) */
  contactId?: string
}

/** Nom affiché : la société pour une personne morale, sinon prénom + nom */
export function personneName(p: Pick<Personne, "kind" | "firstName" | "lastName" | "societe">): string {
  if (p.kind === "morale") return p.societe || "Société"
  return `${p.firstName} ${p.lastName}`.trim()
}

/** Département d'intervention du dossier : saisi à la création, sinon déduit du code postal du client */
export function dossierDepartement(d: Pick<Dossier, "departement" | "client">): string | undefined {
  return d.departement ?? departementFromAddress(d.client.address)
}

/** Département d'une adresse postale, d'après son code postal (« 43000 Le Puy » → « 43 Haute-Loire ») */
export function departementFromAddress(address?: string): string | undefined {
  const cp = address?.match(/\b(\d{5})\b/)?.[1]
  if (!cp) return undefined
  const code = cp.startsWith("20") ? (Number(cp) < 20200 ? "2A" : "2B") : cp.slice(0, 2)
  return Object.values(REGION_DEPARTEMENTS).flat().find((dep) => dep.startsWith(`${code} `))
}

/** Région d'un département (« 43 Haute-Loire » → Auvergne-Rhône-Alpes) */
export const departementRegion = (dep: string) => Object.keys(REGION_DEPARTEMENTS).find((r) => REGION_DEPARTEMENTS[r].includes(dep))

/** Catégorie du dossier : type + qualification (ex. « Sinistre » / « Non responsable, avec tiers ») */
export function dossierCategory(d: Pick<Dossier, "type" | "sinistreType" | "litigeType">): { type: string; detail?: string } {
  const detail = d.sinistreType ? SINISTRE_TYPES[d.sinistreType].label : d.litigeType ? LITIGE_ASSUR_TYPES[d.litigeType].label : undefined
  return { type: DOSSIER_TYPES[d.type].label, detail }
}

/** rouge = rien d'envoyé · orange = envoyé, en attente · vert = signé / reçu */
export type ValidationState = "a_faire" | "en_attente" | "ok"
export type ClientValidation = { mission: ValidationState; devis: ValidationState; reglement: ValidationState }

export const VALIDATION_ITEMS = [
  { key: "mission", letter: "M", label: "Mission", done: "signée", pending: "envoyée, en attente de signature", todo: "non envoyée" },
  { key: "devis", letter: "D", label: "Devis", done: "signé", pending: "envoyé, en attente de signature", todo: "non envoyé" },
  { key: "reglement", letter: "R", label: "Règlement", done: "reçu", pending: "en attente", todo: "non demandé" },
] as const

export function clientValidation(d: Dossier): ClientValidation {
  if (d.validation) return d.validation
  // Déduit du statut : mission signée avant l'étude, devis puis règlement avant l'expertise
  switch (d.status) {
    case "nouveau":
      return { mission: "en_attente", devis: "a_faire", reglement: "a_faire" }
    case "en_etude":
    case "attente_client":
      return { mission: "ok", devis: "en_attente", reglement: "a_faire" }
    case "recours_valide":
    case "attente_tiers":
    case "attente_compagnie":
      return { mission: "ok", devis: "ok", reglement: "en_attente" }
    case "complement":
      // Expertise complémentaire : nouveau devis à faire signer, nouveau règlement à attendre
      return { mission: "ok", devis: "en_attente", reglement: "a_faire" }
    default:
      return { mission: "ok", devis: "ok", reglement: "ok" }
  }
}

export const SUIVEUR_QUALITES = ["Avocat", "Protection juridique", "Autre"] as const

/** Le client demande l'accès au dossier pour un tiers (avocat, protection juridique…) ; Nereids crée le compte */
export type SuiveurRequest = {
  id: string
  at: string // ISO
  requestedBy: string // userId du client
  qualite: string
  firstName: string
  lastName: string
  structure: string
  email: string
  phone: string
  message?: string
  status: "pending" | "created" | "refused"
  handledAt?: string
  /** Compte créé par l'admin */
  userId?: string
}

/** Compte suiveur créé à partir d'une demande client */
export function suiveurFromRequest(r: SuiveurRequest): User {
  return {
    id: r.userId ?? `u-s-${r.id}`,
    role: "suiveur",
    firstName: r.firstName,
    lastName: r.lastName,
    email: r.email,
    phone: r.phone,
    structure: r.structure,
    fonction: r.qualite,
  }
}

// ─── Dates relatives (pour que le proto reste « frais ») ─────────────────────

const DAY = 86_400_000
export function daysFromNow(d: number, hour = 10): string {
  const t = new Date(Date.now() + d * DAY)
  t.setHours(hour, 0, 0, 0)
  return t.toISOString()
}

/** Consultations fictives : deux intervenants sont passés sur le dossier après la dernière activité (visibles par Nereids uniquement) */
export function withConsultations(d: Dossier): Dossier {
  // On remplace les exemples déjà générés, sans toucher aux vraies consultations tracées pendant la démo
  const seeded = (e: TimelineEvent) => e.kind === "consultation" && e.id.startsWith(`${d.id}-c`)
  const timeline = d.timeline.filter((e) => !seeded(e))
  const last = timeline.reduce((m, e) => (e.kind !== "consultation" && e.at > m ? e.at : m), d.createdAt)
  const { gestionnaire, expert, reparateur, suiveurs } = d.intervenants
  const visitors = [d.client.userId, gestionnaire, expert, reparateur, ...(suiveurs ?? [])].filter((u): u is string => !!u).slice(0, 2)
  const now = Date.now()
  const visits = visitors.flatMap((u, i) => {
    // Décalage déterministe : 1h20 puis 3h05 après la dernière activité
    const at = new Date(new Date(last).getTime() + (80 + i * 105) * 60_000)
    if (at.getTime() > now) return []
    return [{ id: `${d.id}-c${i}`, at: at.toISOString(), kind: "consultation" as const, author: u, title: "A consulté le dossier" }]
  })
  return { ...d, timeline: [...timeline, ...visits] }
}

/** Convocation à l'expertise envoyée aux parties */
export const convocationSent = (d: Dossier) => d.expertise.convoques.length > 0

/** Identifiant du client dans les listes de convocation (il n'a pas toujours de compte) */
export const clientConvoqueId = (d: Dossier) => d.client.userId ?? "client"

/** Toutes les expertises du dossier, n°1 en premier */
export const allExpertises = (d: Dossier): Expertise[] => [d.expertise, ...(d.autresExpertises ?? [])]

/** Remplace l'expertise n° index + 1 */
export function setExpertise(d: Dossier, index: number, patch: (e: Expertise) => Expertise): Dossier {
  if (index === 0) return { ...d, expertise: patch(d.expertise) }
  return { ...d, autresExpertises: (d.autresExpertises ?? []).map((e, i) => (i === index - 1 ? patch(e) : e)) }
}

/** Personnes convoquées (ou à convoquer) pour une expertise donnée */
export function expertisePeople(d: Dossier, index: number): string[] {
  const e = allExpertises(d)[index]
  if (e.convoques.length) return e.convoques
  // Pas de liste par défaut : les personnes à convoquer sont ajoutées à la main
  return e.aConvoquer ?? []
}

/** Proto : une 2e expertise vide (à compléter) dès que la 1re a eu lieu ou est programmée */
export function withDemoExpertise(d: Dossier): Dossier {
  return d.expertise.date && !d.autresExpertises ? { ...d, autresExpertises: [{ convoques: [], aConvoquer: [] }] } : d
}

export function isLate(d: Dossier): boolean {
  if (d.status === "cloture" || d.status === "archive") return false
  return !!d.pilotage.echeance && new Date(d.pilotage.echeance).getTime() < Date.now()
}

export function lateDays(d: Dossier): number {
  if (!d.pilotage.echeance) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(d.pilotage.echeance).getTime()) / DAY))
}

export function needsAssignment(d: Dossier): boolean {
  return (
    d.status !== "cloture" &&
    d.status !== "archive" &&
    !d.horsPerimetre &&
    (!d.intervenants.gestionnaire || !d.intervenants.expert)
  )
}

// ─── Utilisateurs fictifs ────────────────────────────────────────────────────

export const USERS: User[] = [
  { id: "u-admin", role: "admin", firstName: "Sophie", lastName: "Marchand", email: "sophie.marchand@nereids.fr", phone: "06 12 34 56 78", structure: "Nereids", fonction: "Responsable des opérations" },
  { id: "u-admin2", role: "admin", firstName: "Antoine", lastName: "Roux", email: "antoine.roux@nereids.fr", phone: "06 22 34 56 78", structure: "Nereids", fonction: "Chargé de pilotage" },

  { id: "u-gest", role: "gestionnaire", firstName: "Julie", lastName: "Perrin", email: "julie.perrin@helpyou.fr", phone: "06 45 67 89 12", structure: "Help You", fonction: "Gestionnaire de dossiers", address: "18 rue de la République, 69002 Lyon", region: "Auvergne-Rhône-Alpes", load: 14 },
  { id: "u-gest2", role: "gestionnaire", firstName: "Nicolas", lastName: "Fabre", email: "nicolas.fabre@helpyou.fr", phone: "06 45 67 00 12", structure: "Help You", fonction: "Gestionnaire de dossiers", address: "18 rue de la République, 69002 Lyon", region: "Auvergne-Rhône-Alpes", load: 9 },
  // Gestionnaire Nereids : mêmes droits que les gestionnaires Help You (point client 22/10)
  { id: "u-gest-n", role: "gestionnaire", firstName: "Claire", lastName: "Dumas", email: "claire.dumas@nereids.fr", phone: "06 32 14 58 76", structure: "Nereids", fonction: "Gestionnaire de dossiers", region: "Auvergne-Rhône-Alpes", load: 8 },
  { id: "u-gest3", role: "gestionnaire", firstName: "Inès", lastName: "Haddad", email: "ines.haddad@helpyou.fr", phone: "06 45 11 89 12", structure: "Help You", fonction: "Gestionnaire de dossiers", address: "42 boulevard Longchamp, 13001 Marseille", region: "Provence-Alpes-Côte d'Azur", load: 17 },

  { id: "u-expert", role: "expert", firstName: "Marc", lastName: "Delorme", email: "m.delorme@cabinet-delorme.fr", phone: "06 78 90 12 34", structure: "Cabinet Delorme Expertise", fonction: "Expert automobile", address: "7 place du Breuil, 43000 Le Puy-en-Velay", region: "Auvergne-Rhône-Alpes", load: 11 },
  { id: "u-expert2", role: "expert", firstName: "Hélène", lastName: "Garnier", email: "h.garnier@cabinet-delorme.fr", phone: "06 78 11 12 34", structure: "Cabinet Delorme Expertise", fonction: "Experte automobile", address: "25 rue Michelet, 42000 Saint-Étienne", region: "Auvergne-Rhône-Alpes", load: 6 },
  { id: "u-expert3", role: "expert", firstName: "Yanis", lastName: "Meunier", email: "y.meunier@sudexpert.fr", phone: "06 78 22 12 34", structure: "Sud Expert", fonction: "Expert automobile", address: "110 avenue du Prado, 13008 Marseille", region: "Provence-Alpes-Côte d'Azur", load: 15 },

  { id: "u-rep", role: "reparateur", firstName: "Luc", lastName: "Benali", email: "contact@garage-benali.fr", phone: "04 71 22 33 44", structure: "Garage Benali Carrosserie", fonction: "Gérant", address: "12 rue des Forges, 43200 Yssingeaux", region: "Auvergne-Rhône-Alpes", load: 7 },
  { id: "u-rep2", role: "reparateur", firstName: "Laura", lastName: "Chevalier", email: "atelier@carrosserie-chevalier.fr", phone: "04 77 22 33 44", structure: "Carrosserie Chevalier", fonction: "Cheffe d'atelier", address: "233 rue de la Rive, 42320 La Grand-Croix", region: "Auvergne-Rhône-Alpes", load: 4 },

  { id: "u-suiveur", role: "suiveur", firstName: "Élodie", lastName: "Vasseur", email: "e.vasseur@protecjuris.fr", phone: "01 44 55 66 77", structure: "Protec Juris (protection juridique)", fonction: "Juriste", address: "9 rue de Châteaudun, 75009 Paris", region: "Île-de-France" },
  { id: "u-suiveur2", role: "suiveur", firstName: "Paul", lastName: "Lambert", email: "p.lambert@avocat-lambert.fr", phone: "04 72 55 66 77", structure: "Cabinet Lambert", fonction: "Avocat", address: "4 quai Jules Courmont, 69002 Lyon", region: "Auvergne-Rhône-Alpes" },

  // Autres clients des dossiers de démo (sans compte actif dans le proto)
  { id: "u-c-lefevre", role: "client", firstName: "Thomas", lastName: "Lefèvre", email: "thomas.lefevre@mail.fr", phone: "06 98 76 54 32", structure: "Particulier", fonction: "", address: "38 rue Gambetta, 43200 Yssingeaux" },
  { id: "u-c-morel", role: "client", firstName: "Sandrine", lastName: "Morel", email: "s.morel@mail.fr", phone: "06 33 21 45 67", structure: "Particulier", fonction: "", address: "5 chemin des Prés, 43400 Le Chambon-sur-Lignon" },
  { id: "u-c-fontaine", role: "client", firstName: "Aurélie", lastName: "Fontaine", email: "a.fontaine@mail.fr", phone: "06 87 65 43 21", structure: "Particulier", fonction: "", address: "14 allée des Tilleuls, 42100 Saint-Étienne" },
  { id: "u-c-caron", role: "client", firstName: "Romain", lastName: "Caron", email: "r.caron@mail.fr", phone: "06 19 28 37 46", structure: "Particulier", fonction: "", address: "3 rue Victor Hugo, 42400 Saint-Chamond" },
  { id: "u-client", role: "client", firstName: "Mehdi", lastName: "Saïdi", email: "mehdi.saidi@mail.fr", phone: "06 55 44 33 22", structure: "Particulier", fonction: "", address: "21 avenue de la Libération, 43000 Le Puy-en-Velay" },
]

/** Comptes créés pendant la démo (ex. suiveur créé depuis une demande client) */
let extraUsers: User[] = []
export function registerUsers(users: User[]) {
  extraUsers = users
}

/** Coordonnées corrigées par l'utilisateur lui-même (activation de son compte) */
let profiles: Record<string, Partial<User>> = {}
export function registerProfiles(p: Record<string, Partial<User>>) {
  profiles = p
}

export function getUser(id?: string): User | undefined {
  const u = USERS.find((x) => x.id === id) ?? extraUsers.find((x) => x.id === id)
  return u && profiles[u.id] ? { ...u, ...profiles[u.id] } : u
}

export function allUsers(): User[] {
  return [...USERS, ...extraUsers].map((u) => getUser(u.id)!)
}

/** Compte d'un intervenant invité par e-mail : invitation → activation (mot de passe + vérification des infos) */
export type Account = {
  invitedAt: string
  activatedAt?: string
  /** Dernière connexion (à défaut : la date d'activation) */
  lastLoginAt?: string
  profile?: Partial<User>
  /** Utilisateur ajouté par Nereids depuis « Utilisateurs » (invité par e-mail) */
  user?: User
}

/** Intervenant suiveur de démo : invité, pas encore activé (parcours d'activation rejouable) */
export const SUIVEUR_ACTIVATION_USER = "u-suiveur"

/** Comptes de démo sans connexion depuis plus de 6 mois (→ « Inactif ») ; les autres sont considérés connectés récemment */
export const SEED_LAST_LOGIN: Record<string, number> = { "u-suiveur2": -232, "u-rep2": -197 }

export function seedAccounts(): Record<string, Account> {
  return { [SUIVEUR_ACTIVATION_USER]: { invitedAt: daysFromNow(-1, 15) } }
}

/** Nom affiché ; un réparateur saisi sans contact est affiché sous le nom de son garage */
export function fullName(u?: { firstName: string; lastName: string; structure?: string }): string {
  return u ? `${u.firstName} ${u.lastName}`.trim() || u.structure || "—" : "—"
}

const letters = (s = "") => s.normalize("NFD").replace(/[^A-Za-z]/g, "").toUpperCase()

/**
 * Référence dossier : initiales du client, année, 3 premières lettres du cabinet de l'expert
 * (ex. Julie Martin, 2026, Cabinet Delorme → JM-2026-DEL). Sans expert : JM-2026.
 */
export function dossierRef(client: Pick<Personne, "kind" | "firstName" | "lastName" | "societe">, createdAt: string, cabinet?: string): string {
  // Personne morale : deux premières lettres de la société
  const initials = client.kind === "morale" ? letters(client.societe).slice(0, 2) : letters(client.firstName).charAt(0) + letters(client.lastName).charAt(0)
  const year = new Date(createdAt).getFullYear()
  const cab = letters(cabinet?.replace(/^\s*(cabinet|société)\s+/i, "")).slice(0, 3)
  return [initials, year, cab].filter(Boolean).join("-")
}

/** Recalcule la référence d'un dossier d'après son client et le cabinet de son expert */
export const withRef = <T extends Pick<Dossier, "client" | "createdAt" | "intervenants">>(d: T, expert = getUser(d.intervenants.expert)) => ({
  ...d,
  ref: dossierRef(d.client, d.createdAt, expert?.structure),
})

/** Zones d'intervention des utilisateurs : régions métropolitaines et leurs départements */
export const REGION_DEPARTEMENTS: Record<string, string[]> = {
  "Auvergne-Rhône-Alpes": ["01 Ain", "03 Allier", "07 Ardèche", "15 Cantal", "26 Drôme", "38 Isère", "42 Loire", "43 Haute-Loire", "63 Puy-de-Dôme", "69 Rhône", "73 Savoie", "74 Haute-Savoie"],
  "Bourgogne-Franche-Comté": ["21 Côte-d'Or", "25 Doubs", "39 Jura", "58 Nièvre", "70 Haute-Saône", "71 Saône-et-Loire", "89 Yonne", "90 Territoire de Belfort"],
  Bretagne: ["22 Côtes-d'Armor", "29 Finistère", "35 Ille-et-Vilaine", "56 Morbihan"],
  "Centre-Val de Loire": ["18 Cher", "28 Eure-et-Loir", "36 Indre", "37 Indre-et-Loire", "41 Loir-et-Cher", "45 Loiret"],
  Corse: ["2A Corse-du-Sud", "2B Haute-Corse"],
  "Grand Est": ["08 Ardennes", "10 Aube", "51 Marne", "52 Haute-Marne", "54 Meurthe-et-Moselle", "55 Meuse", "57 Moselle", "67 Bas-Rhin", "68 Haut-Rhin", "88 Vosges"],
  "Hauts-de-France": ["02 Aisne", "59 Nord", "60 Oise", "62 Pas-de-Calais", "80 Somme"],
  "Île-de-France": ["75 Paris", "77 Seine-et-Marne", "78 Yvelines", "91 Essonne", "92 Hauts-de-Seine", "93 Seine-Saint-Denis", "94 Val-de-Marne", "95 Val-d'Oise"],
  Normandie: ["14 Calvados", "27 Eure", "50 Manche", "61 Orne", "76 Seine-Maritime"],
  "Nouvelle-Aquitaine": ["16 Charente", "17 Charente-Maritime", "19 Corrèze", "23 Creuse", "24 Dordogne", "33 Gironde", "40 Landes", "47 Lot-et-Garonne", "64 Pyrénées-Atlantiques", "79 Deux-Sèvres", "86 Vienne", "87 Haute-Vienne"],
  Occitanie: ["09 Ariège", "11 Aude", "12 Aveyron", "30 Gard", "31 Haute-Garonne", "32 Gers", "34 Hérault", "46 Lot", "48 Lozère", "65 Hautes-Pyrénées", "66 Pyrénées-Orientales", "81 Tarn", "82 Tarn-et-Garonne"],
  "Pays de la Loire": ["44 Loire-Atlantique", "49 Maine-et-Loire", "53 Mayenne", "72 Sarthe", "85 Vendée"],
  "Provence-Alpes-Côte d'Azur": ["04 Alpes-de-Haute-Provence", "05 Hautes-Alpes", "06 Alpes-Maritimes", "13 Bouches-du-Rhône", "83 Var", "84 Vaucluse"],
}

export const REGIONS = ["Auvergne-Rhône-Alpes", "Provence-Alpes-Côte d'Azur", "Île-de-France", "Occitanie"]

// ─── Dossiers fictifs ────────────────────────────────────────────────────────

let seq = 0
const ev = (at: string, kind: TimelineKind, author: string, title: string, body?: string, recipients?: TimelineEvent["recipients"]): TimelineEvent => ({
  id: `e${++seq}`,
  at,
  kind,
  author,
  title,
  body,
  recipients,
})
const doc = (name: string, category: DocCategory, addedBy: string, at: string, size = "1,2 Mo"): DocumentItem => ({
  id: `d${++seq}`,
  name,
  category,
  addedBy,
  addedAt: at,
  docDate: demoDocDate(category, at),
  size,
})
/** Message de démo, avec ou sans pièces jointes (rangées dans les documents du dossier par `withAttachments`) */
type SeedEvent = TimelineEvent & { files?: DocumentItem[] }
const msg = (at: string, author: string, body: string, recipients: TimelineEvent["recipients"], ...files: DocumentItem[]): SeedEvent => ({
  ...ev(at, "message", author, "Message", body, recipients),
  ...(files.length && { files }),
})
function withAttachments(d: Dossier): Dossier {
  const timeline = d.timeline as SeedEvent[]
  return {
    ...d,
    documents: [...d.documents, ...timeline.flatMap((e) => e.files ?? [])],
    timeline: timeline.map(({ files, ...e }) => (files ? { ...e, docIds: files.map((f) => f.id) } : e)),
  }
}

/** Dossier de démo du parcours d'activation client (invitation e-mail) */
export const CLIENT_ACTIVATION_DOSSIER = "NER-2026-0149"

export function seedDossiers(): Dossier[] {
  seq = 0
  const all: Dossier[] = [
    {
      id: "NER-2026-0142",
      ref: "NER-2026-0142",
      type: "sinistre",
      sinistreType: "non_resp_avec_tiers",
      status: "attente_expertise",
      createdAt: daysFromNow(-12),
      updatedAt: daysFromNow(-1),
      client: { firstName: "Thomas", lastName: "Lefèvre", phone: "06 98 76 54 32", email: "thomas.lefevre@mail.fr", address: "38 rue Gambetta, 43200 Yssingeaux" },
      vehicule: { marque: "Peugeot", modele: "308 SW", immat: "GH-482-KL", vin: "VF3LBYHZPKS123456" },
      compagnie: { nom: "Assurances Atlantique", email: "sinistres@atlantique-assur.fr", reference: "AT-77812-S" },
      refs: { sinistre: "SIN-2026-55481" },
      region: "Auvergne-Rhône-Alpes",
      intervenants: { gestionnaire: "u-gest", expert: "u-expert", reparateur: "u-rep", suiveurs: ["u-suiveur"] },
      suiveurRefs: { "u-suiveur": "PJ-55-2026-0981" },
      pilotage: {
        ouEnEst: "Expertise programmée, convocations envoyées à toutes les parties.",
        attente: "Réalisation de l'expertise sur site",
        prochaineAction: "Réaliser l'expertise et déposer le PV sous 24 h",
        quiDoitAgir: "expert",
        echeance: daysFromNow(2),
      },
      expertise: { date: daysFromNow(2, 9), lieu: "Garage Benali Carrosserie, 12 rue des Forges, 43200 Yssingeaux", convoques: ["u-c-lefevre", "u-rep", "u-expert"] },
      documents: [
        doc("Constat amiable.pdf", "constat", "u-c-lefevre", daysFromNow(-12), "820 Ko"),
        doc("Carte grise recto-verso.pdf", "carte_grise", "u-c-lefevre", daysFromNow(-12), "1,1 Mo"),
        doc("Photos avant droit (6).zip", "photos", "u-c-lefevre", daysFromNow(-12), "14,3 Mo"),
        doc("Devis réparation n°D-2291.pdf", "devis", "u-rep", daysFromNow(-6), "240 Ko"),
      ],
      timeline: [
        ev(daysFromNow(-12, 9), "creation", "u-c-lefevre", "Dossier créé", "Sinistre non responsable avec tiers — recours direct."),
        ev(daysFromNow(-12, 9), "document", "u-c-lefevre", "3 documents ajoutés", "Constat, carte grise, photos"),
        ev(daysFromNow(-11, 14), "assignation", "u-admin", "Intervenants assignés", "Gestionnaire : Julie Perrin · Expert : Marc Delorme"),
        ev(daysFromNow(-11, 14), "status", "system", "Statut → En étude"),
        ev(daysFromNow(-9, 11), "status", "u-expert", "Statut → Recours validé", "Responsabilité du tiers établie par le constat (cas 10)."),
        {
          ...ev(daysFromNow(-9, 11), "message", "u-gest", "Message", "Bonjour M. Lefèvre, pouvez-vous nous indiquer le garage qui réalisera les réparations ?", ["client"]),
          reply: { author: "u-c-lefevre", at: daysFromNow(-8, 18), body: "Bonjour, ce sera le Garage Benali à Yssingeaux." },
        },
        ev(daysFromNow(-6, 10), "document", "u-rep", "Devis déposé", "Devis réparation n°D-2291 — 3 480,00 € TTC"),
        ev(daysFromNow(-3, 15), "expertise", "u-gest", "Convocation envoyée", "Expertise prévue sur site, client, réparateur et expert convoqués."),
        msg(daysFromNow(-3, 16), "u-gest", "Bonjour à tous, vous trouverez ci-joint la convocation à l'expertise sur site, au Garage Benali Carrosserie. Merci de confirmer votre présence.", ["client", "reparateur", "expert"], doc("Convocation expertise.pdf", "courrier", "u-gest", daysFromNow(-3, 16), "95 Ko")),
        ev(daysFromNow(-3, 15), "status", "system", "Statut → En attente expertise"),
        ev(daysFromNow(-1, 9), "message", "u-suiveur", "Message", "Merci de nous transmettre le PV dès réception.", ["gestionnaire", "expert"]),
      ],
      notes: [
        { id: "n-0142-1", at: daysFromNow(-11, 14), author: "u-admin", body: "Client très réactif. Le tiers est assuré chez Atlantique aussi : voir si on peut accélérer le recours en direct avec leur service sinistres." },
        { id: "n-0142-2", at: daysFromNow(-2, 17), author: "u-admin2", body: "Appelé Marc Delorme : l'expertise est confirmée pour jeudi 9 h. Penser à relancer le garage pour le devis définitif après l'expertise." },
      ],
    },
    // Réparateur : le devis est demandé au garage (CDC v1 étape 2, parcours réparateur « En attente devis »)
    {
      id: "NER-2026-0146",
      ref: "NER-2026-0146",
      type: "sinistre",
      sinistreType: "non_resp_avec_tiers",
      status: "recours_valide",
      createdAt: daysFromNow(-8, 10),
      updatedAt: daysFromNow(-1, 11),
      client: { firstName: "Nicolas", lastName: "Roux", phone: "06 52 41 30 29", email: "nicolas.roux@mail.fr", address: "21 avenue de la Gare, 43200 Yssingeaux" },
      vehicule: { marque: "Volkswagen", modele: "Golf VIII", immat: "GB-307-KT" },
      compagnie: { nom: "Assurances Atlantique", email: "sinistres@atlantique-assur.fr", reference: "AT-77418-S" },
      refs: { sinistre: "SIN-2026-52866" },
      region: "Auvergne-Rhône-Alpes",
      intervenants: { gestionnaire: "u-gest", expert: "u-expert", reparateur: "u-rep", suiveurs: [] },
      pilotage: {
        ouEnEst: "Recours validé, devis demandé au réparateur.",
        attente: "Devis du réparateur",
        prochaineAction: "Déposer le devis de réparation",
        quiDoitAgir: "reparateur",
        echeance: daysFromNow(2),
      },
      expertise: { convoques: [] },
      documents: [
        doc("Constat amiable.pdf", "constat", "u-gest", daysFromNow(-8, 10), "760 Ko"),
        doc("Carte grise.pdf", "carte_grise", "u-gest", daysFromNow(-8, 10), "950 Ko"),
        doc("Photos arrière gauche (4).zip", "photos", "u-gest", daysFromNow(-8, 10), "9,8 Mo"),
      ],
      timeline: [
        ev(daysFromNow(-8, 10), "creation", "u-gest", "Dossier créé", "Sinistre non responsable avec tiers — recours direct."),
        ev(daysFromNow(-7, 15), "assignation", "u-admin", "Intervenants assignés", "Gestionnaire : Julie Perrin · Expert : Marc Delorme · Réparateur : Garage Benali Carrosserie"),
        ev(daysFromNow(-5, 9), "status", "u-expert", "Statut → Recours validé", "Responsabilité du tiers établie par le constat."),
        msg(daysFromNow(-1, 11), "u-gest", "Bonjour M. Benali, pouvez-vous déposer votre devis pour la Golf de M. Roux ? Les photos du sinistre sont dans les documents du dossier.", ["reparateur"]),
      ],
    },
    {
      id: "NER-2026-0151",
      ref: "NER-2026-0151",
      type: "litige_assurantiel",
      litigeType: "valeur",
      status: "nouveau",
      createdAt: daysFromNow(-1, 16),
      updatedAt: daysFromNow(-1, 16),
      client: { firstName: "Camille", lastName: "Bertin", phone: "06 11 22 33 44", email: "camille.bertin@mail.fr", address: "6 rue des Écoles, 43120 Monistrol-sur-Loire" },
      vehicule: { marque: "Renault", modele: "Clio V", immat: "FX-219-AB" },
      compagnie: { nom: "Mutuelle du Centre", email: "litiges@mutuelle-centre.fr", reference: "MDC-2026-0087" },
      refs: { sinistre: "MDC-SIN-44120" },
      region: "Auvergne-Rhône-Alpes",
      intervenants: { suiveurs: [] },
      pilotage: {
        ouEnEst: "Dossier reçu, en attente d'assignation.",
        attente: "Assignation d'un gestionnaire et d'un expert",
        prochaineAction: "Assigner les intervenants",
        quiDoitAgir: "nereids",
        echeance: daysFromNow(1),
      },
      expertise: { convoques: [] },
      documents: [
        doc("Rapport expertise compagnie.pdf", "rapport_compagnie", "u-gest", daysFromNow(-1, 16)),
        doc("Carte grise.pdf", "carte_grise", "u-gest", daysFromNow(-1, 16), "900 Ko"),
        doc("Annonces véhicules similaires.pdf", "recherche_marche", "u-gest", daysFromNow(-1, 16), "3,4 Mo"),
      ],
      timeline: [
        ev(daysFromNow(-1, 16), "creation", "u-gest", "Dossier créé", "Litige assurantiel — valeur contestée (VRADE proposée : 9 800 €)."),
        msg(daysFromNow(-1, 17), "u-gest", "Dossier transmis : la cliente conteste la VRADE de 9 800 €, les annonces qu'elle a trouvées tournent autour de 11 500 €.", ["admin"]),
        msg(daysFromNow(-1, 18), "u-admin", "Bonjour Mme Bertin, nous avons bien reçu votre dossier. Vous trouverez ci-joint la lettre de mission à nous retourner signée.", ["client"], doc("Lettre de mission.pdf", "courrier", "u-admin", daysFromNow(-1, 18), "140 Ko")),
      ],
    },
    {
      id: "NER-2026-0149",
      ref: "NER-2026-0149",
      type: "sinistre",
      sinistreType: "non_resp_avec_tiers",
      status: "nouveau",
      createdAt: daysFromNow(-2, 11),
      updatedAt: daysFromNow(-2, 11),
      client: { firstName: "Mehdi", lastName: "Saïdi", phone: "06 55 44 33 22", email: "mehdi.saidi@mail.fr", address: "21 avenue de la Libération, 43000 Le Puy-en-Velay", userId: "u-client" },
      vehicule: { marque: "Volkswagen", modele: "Golf 8", immat: "GA-773-RT" },
      compagnie: { nom: "Garantia Assurances", email: "recours@garantia.fr" },
      refs: {},
      region: "Auvergne-Rhône-Alpes",
      intervenants: { gestionnaire: "u-gest2", suiveurs: [] },
      pilotage: {
        ouEnEst: "Dossier créé, invitation envoyée au client.",
        attente: "Assignation d'un expert · pièces du client (constat, carte grise, photos)",
        prochaineAction: "Assigner un expert",
        quiDoitAgir: "nereids",
        echeance: daysFromNow(-1),
      },
      expertise: { convoques: [] },
      documents: [],
      timeline: [
        ev(daysFromNow(-2, 11), "creation", "u-admin", "Dossier créé", "Sinistre non responsable avec tiers — recours direct."),
        ev(daysFromNow(-2, 11), "system", "system", "Invitation envoyée au client", "E-mail de création de compte envoyé à mehdi.saidi@mail.fr"),
        msg(daysFromNow(-2, 12), "u-admin", "Bonjour M. Saïdi, bienvenue chez Nereids. Vous trouverez ci-joint la lettre de mission à signer : elle nous permet de démarrer votre recours.", ["client"], doc("Lettre de mission.pdf", "courrier", "u-admin", daysFromNow(-2, 12), "140 Ko")),
        msg(daysFromNow(-1, 10), "u-gest2", "Bonjour, je prends le dossier. Pouvez-vous assigner un expert en Haute-Loire ? M. Delorme serait le plus proche.", ["admin"]),
      ],
      clientAccess: { invitedAt: daysFromNow(-2, 11) },
    },
    {
      id: "NER-2026-0108",
      ref: "NER-2026-0108",
      type: "litige_auto",
      status: "attente_client",
      createdAt: daysFromNow(-34),
      updatedAt: daysFromNow(-3),
      client: { firstName: "Mehdi", lastName: "Saïdi", phone: "06 55 44 33 22", email: "mehdi.saidi@mail.fr", address: "21 avenue de la Libération, 43000 Le Puy-en-Velay", userId: "u-client" },
      vehicule: { marque: "Peugeot", modele: "208", immat: "FX-219-PB", vin: "VR3UPHNKSLT204417" },
      compagnie: { nom: "Auto Sélection Lyon", email: "sav@autoselection-lyon.fr" },
      refs: {},
      region: "Auvergne-Rhône-Alpes",
      intervenants: { gestionnaire: "u-gest", expert: "u-expert2", suiveurs: [] },
      pilotage: {
        ouEnEst: "L'expert a étudié le dossier : il manque l'historique d'entretien.",
        attente: "Factures d'entretien du véhicule",
        prochaineAction: "Déposer les factures d'entretien",
        quiDoitAgir: "client",
        echeance: daysFromNow(4),
      },
      expertise: { convoques: [] },
      documents: [
        doc("Facture d'achat 208.pdf", "facture_achat", "u-client", daysFromNow(-34), "610 Ko"),
        doc("Carte grise.pdf", "carte_grise", "u-client", daysFromNow(-34), "1,0 Mo"),
        doc("Contrôle technique 2025.pdf", "controle_technique", "u-client", daysFromNow(-33), "430 Ko"),
        doc("Facture garage boîte de vitesses.pdf", "facture", "u-client", daysFromNow(-33), "380 Ko"),
      ],
      timeline: [
        ev(daysFromNow(-34, 10), "creation", "u-admin", "Dossier créé", "Litige automobile — boîte de vitesses défaillante 2 mois après l'achat."),
        ev(daysFromNow(-34, 10), "document", "u-client", "4 documents ajoutés", "Facture d'achat, carte grise, contrôle technique, facture garage"),
        ev(daysFromNow(-32, 15), "assignation", "u-admin", "Intervenants assignés", "Gestionnaire : Julie Perrin · Expert : Hélène Garnier"),
        ev(daysFromNow(-32, 15), "status", "system", "Statut → En étude"),
        ev(daysFromNow(-20, 11), "message", "u-expert2", "Message", "Le vendeur conteste : merci de récupérer son rapport de reprise.", ["gestionnaire"]),
        msg(daysFromNow(-18, 15), "u-gest", "Voici le rapport de reprise transmis par Auto Sélection Lyon : il ne mentionne aucun défaut sur la boîte de vitesses.", ["expert"], doc("Rapport de reprise Auto Sélection.pdf", "courrier", "u-gest", daysFromNow(-18, 15), "520 Ko")),
        ev(daysFromNow(-3, 9), "status", "u-expert2", "Statut → En attente client"),
        ev(daysFromNow(-3, 9), "message", "u-gest", "Message", "Bonjour M. Saïdi, pour avancer, pouvez-vous déposer les factures d'entretien de la 208 (carnet ou factures garage) ?", ["client"]),
      ],
      clientAccess: { invitedAt: daysFromNow(-34), activatedAt: daysFromNow(-34), submittedAt: daysFromNow(-34) },
    },
    {
      id: "NER-2025-0412",
      ref: "NER-2025-0412",
      type: "sinistre",
      sinistreType: "non_resp_avec_tiers",
      status: "cloture",
      createdAt: daysFromNow(-260),
      updatedAt: daysFromNow(-150),
      client: { firstName: "Mehdi", lastName: "Saïdi", phone: "06 55 44 33 22", email: "mehdi.saidi@mail.fr", address: "21 avenue de la Libération, 43000 Le Puy-en-Velay", userId: "u-client" },
      vehicule: { marque: "Peugeot", modele: "208", immat: "FX-219-PB" },
      compagnie: { nom: "Assurances Atlantique", email: "sinistres@atlantique-assur.fr", reference: "AT-61204-S" },
      tiers: [{ nom: "M. Laurent Petit (assuré chez Assurances Atlantique)" }],
      refs: { sinistre: "SIN-2025-31877" },
      region: "Auvergne-Rhône-Alpes",
      intervenants: { gestionnaire: "u-gest", expert: "u-expert", reparateur: "u-rep", suiveurs: [] },
      pilotage: { ouEnEst: "Dossier clôturé.", attente: "—", prochaineAction: "Archiver le dossier", quiDoitAgir: "nereids" },
      expertise: { date: daysFromNow(-230, 9), lieu: "Garage Benali Carrosserie, 12 rue des Forges, 43200 Yssingeaux", convoques: ["u-client", "u-rep", "u-expert"], realisee: true },
      documents: [
        doc("Constat amiable.pdf", "constat", "u-client", daysFromNow(-260), "790 Ko"),
        doc("Carte grise.pdf", "carte_grise", "u-client", daysFromNow(-260), "1,0 Mo"),
        doc("Photos pare-choc arrière (4).zip", "photos", "u-client", daysFromNow(-260), "9,8 Mo"),
        doc("PV d'expertise.pdf", "pv", "u-expert", daysFromNow(-229), "310 Ko"),
        doc("Rapport d'expertise.pdf", "rapport", "u-expert", daysFromNow(-222), "1,6 Mo"),
        doc("Facture réparation.pdf", "facture", "u-rep", daysFromNow(-210), "220 Ko"),
      ],
      timeline: [
        ev(daysFromNow(-260, 10), "creation", "u-admin", "Dossier créé", "Sinistre non responsable avec tiers — choc arrière à l'arrêt."),
        ev(daysFromNow(-258, 14), "status", "u-expert", "Statut → Recours validé"),
        ev(daysFromNow(-230, 9), "expertise", "u-expert", "Expertise réalisée"),
        ev(daysFromNow(-222, 16), "document", "u-expert", "Rapport déposé"),
        ev(daysFromNow(-200, 10), "status", "u-admin", "Statut → Réclamation envoyée"),
        msg(daysFromNow(-200, 11), "u-admin", "Bonjour M. Saïdi, la réclamation est partie chez Assurances Atlantique. Vous en trouverez la copie ci-jointe.", ["client"], doc("Courrier réclamation Atlantique.pdf", "courrier", "u-admin", daysFromNow(-200, 11), "120 Ko")),
        ev(daysFromNow(-150, 11), "message", "u-admin", "Message", "Bonne nouvelle : l'indemnisation de 2 140 € a été versée. Votre dossier est clôturé.", ["client"]),
        ev(daysFromNow(-150, 11), "status", "u-admin", "Statut → Clôturé", "Motif : Paiement reçu"),
      ],
      cloture: { motif: "Paiement reçu", at: daysFromNow(-150) },
      clientAccess: { invitedAt: daysFromNow(-260), activatedAt: daysFromNow(-260), submittedAt: daysFromNow(-260) },
    },
    {
      id: "NER-2026-0137",
      ref: "NER-2026-0137",
      type: "litige_auto",
      status: "attente_rapport",
      createdAt: daysFromNow(-24),
      updatedAt: daysFromNow(-6),
      client: { firstName: "Sandrine", lastName: "Morel", phone: "06 33 21 45 67", email: "s.morel@mail.fr", address: "5 chemin des Prés, 43400 Le Chambon-sur-Lignon" },
      vehicule: { marque: "Citroën", modele: "C4 Picasso", immat: "DJ-085-XN" },
      compagnie: { nom: "Protec Juris", email: "dossiers@protecjuris.fr", reference: "PJ-55-2026-1209" },
      tiers: [{ nom: "Garage du Lignon (réparateur mis en cause)", phone: "04 71 00 11 22" }],
      refs: {},
      region: "Auvergne-Rhône-Alpes",
      intervenants: { gestionnaire: "u-gest", expert: "u-expert", suiveurs: ["u-suiveur"] },
      suiveurRefs: { "u-suiveur": "PJ-55-2026-1209" },
      pilotage: {
        ouEnEst: "Expertise contradictoire réalisée, PV déposé.",
        attente: "Pré-rapport de l'expert (attendu à +48 h)",
        prochaineAction: "Relancer l'expert pour le pré-rapport",
        quiDoitAgir: "expert",
        echeance: daysFromNow(-3),
      },
      expertise: { date: daysFromNow(-7, 14), lieu: "Garage du Lignon, Le Chambon-sur-Lignon", convoques: ["u-c-morel", "u-expert", "u-suiveur"], realisee: true },
      documents: [
        doc("Facture réparation boîte de vitesses.pdf", "facture", "u-c-morel", daysFromNow(-24)),
        doc("Carnet d'entretien.pdf", "entretien", "u-c-morel", daysFromNow(-24), "4,8 Mo"),
        doc("PV expertise contradictoire.pdf", "pv", "u-expert", daysFromNow(-6), "610 Ko"),
      ],
      timeline: [
        ev(daysFromNow(-24), "creation", "u-gest", "Dossier créé", "Litige suite à réparation — boîte de vitesses."),
        ev(daysFromNow(-21), "status", "u-expert", "Statut → Recours validé", "Le dossier est recevable."),
        ev(daysFromNow(-14), "expertise", "u-gest", "Convocation envoyée"),
        msg(daysFromNow(-14, 11), "u-gest", "Bonjour, vous trouverez ci-joint la convocation à l'expertise contradictoire au Garage du Lignon.", ["client", "suiveur", "expert"], doc("Convocation expertise contradictoire.pdf", "courrier", "u-gest", daysFromNow(-14, 11), "98 Ko")),
        ev(daysFromNow(-7, 14), "expertise", "u-expert", "Expertise réalisée"),
        ev(daysFromNow(-6), "document", "u-expert", "PV déposé"),
        ev(daysFromNow(-6), "status", "system", "Statut → En attente rapport"),
        ev(daysFromNow(-2), "relance", "system", "Relance automatique envoyée à l'expert", "Pré-rapport non transmis à +96 h.", ["expert"]),
        msg(daysFromNow(-1, 14), "u-suiveur", "Bonjour, avez-vous une date pour le pré-rapport ? Notre assurée souhaite engager la discussion avec le garage rapidement.", ["admin", "expert"]),
      ],
    },
    {
      id: "NER-2026-0129",
      ref: "NER-2026-0129",
      type: "sinistre",
      sinistreType: "non_resp_avec_tiers",
      status: "attente_reparation",
      createdAt: daysFromNow(-35),
      updatedAt: daysFromNow(-9),
      client: { firstName: "Julien", lastName: "Arnaud", phone: "06 71 82 93 04", email: "julien.arnaud@mail.fr", address: "17 rue Paul Bert, 42000 Saint-Étienne" },
      vehicule: { marque: "Toyota", modele: "Yaris Hybride", immat: "FN-512-QS" },
      compagnie: { nom: "Assurances Atlantique", email: "sinistres@atlantique-assur.fr", reference: "AT-76201-S" },
      refs: { sinistre: "SIN-2026-51209" },
      region: "Auvergne-Rhône-Alpes",
      intervenants: { gestionnaire: "u-gest2", expert: "u-expert2", reparateur: "u-rep2", suiveurs: [] },
      pilotage: {
        ouEnEst: "PV reçu, réparations en cours chez le réparateur.",
        attente: "Facture proforma du réparateur",
        prochaineAction: "Déposer la facture proforma",
        quiDoitAgir: "reparateur",
        echeance: daysFromNow(-5),
      },
      expertise: { date: daysFromNow(-12), lieu: "Carrosserie Chevalier, Saint-Étienne", convoques: ["u-expert2", "u-rep2"], realisee: true },
      documents: [doc("PV expertise.pdf", "pv", "u-expert2", daysFromNow(-11))],
      timeline: [
        ev(daysFromNow(-35), "creation", "u-gest2", "Dossier créé"),
        ev(daysFromNow(-12), "expertise", "u-expert2", "Expertise réalisée"),
        ev(daysFromNow(-11), "status", "system", "Statut → En attente réparation"),
        msg(daysFromNow(-9, 16), "u-rep2", "Démontage effectué : photos des pièces endommagées ci-jointes. Rien de plus que ce qui figure au PV.", ["gestionnaire", "expert"], doc("Photos démontage (8).zip", "photos", "u-rep2", daysFromNow(-9, 16), "18,6 Mo")),
        msg(daysFromNow(-4, 9), "u-gest2", "Bonjour Mme Chevalier, où en sont les réparations de la Yaris ? Nous attendons la facture proforma.", ["reparateur"]),
      ],
    },
    {
      id: "NER-2026-0118",
      ref: "NER-2026-0118",
      type: "litige_assurantiel",
      litigeType: "rapport_minore",
      status: "attente_retour",
      createdAt: daysFromNow(-48),
      updatedAt: daysFromNow(-10),
      client: { firstName: "Nathalie", lastName: "Giraud", phone: "06 40 50 60 70", email: "n.giraud@mail.fr", address: "2 place de l'Église, 42500 Le Chambon-Feugerolles" },
      vehicule: { marque: "Dacia", modele: "Duster", immat: "EZ-904-LM" },
      compagnie: { nom: "Garantia Assurances", email: "reclamations@garantia.fr", reference: "GA-2026-11873" },
      refs: { sinistre: "GA-SIN-90311" },
      region: "Auvergne-Rhône-Alpes",
      intervenants: { gestionnaire: "u-gest", expert: "u-expert", suiveurs: ["u-suiveur"] },
      suiveurRefs: { "u-suiveur": "PJ-55-2026-0712" },
      pilotage: {
        ouEnEst: "Réclamation envoyée à la compagnie le " + new Date(daysFromNow(-10)).toLocaleDateString("fr-FR") + ".",
        attente: "Retour de la compagnie",
        prochaineAction: "Relance automatique compagnie à J+15",
        quiDoitAgir: "nereids",
        echeance: daysFromNow(5),
      },
      expertise: { convoques: [] },
      documents: [doc("Courrier réclamation.pdf", "courrier", "u-admin", daysFromNow(-10))],
      timeline: [
        ev(daysFromNow(-48), "creation", "u-gest", "Dossier créé"),
        msg(daysFromNow(-12, 15), "u-expert", "Rapport finalisé : l'écart avec le rapport de la compagnie est de 1 870 €. Il peut partir en réclamation.", ["admin", "gestionnaire"], doc("Rapport Nereids.pdf", "rapport", "u-expert", daysFromNow(-12, 15))),
        ev(daysFromNow(-10), "status", "u-admin", "Statut → Réclamation envoyée"),
        ev(daysFromNow(-10), "status", "system", "Statut → En attente retour"),
        ev(daysFromNow(-9, 11), "message", "u-admin", "Message", "Bonjour Mme Vasseur, la réclamation est partie chez Garantia. Nous vous tenons informée de leur retour.", ["suiveur"]),
      ],
    },
    {
      id: "NER-2026-0103",
      ref: "NER-2026-0103",
      type: "sinistre",
      sinistreType: "non_resp_avec_tiers",
      status: "attente_paiement",
      createdAt: daysFromNow(-70),
      updatedAt: daysFromNow(-4),
      client: { firstName: "Hugo", lastName: "Leroy", phone: "06 12 98 34 76", email: "hugo.leroy@mail.fr", address: "48 cours Fauriel, 42100 Saint-Étienne" },
      vehicule: { marque: "Peugeot", modele: "2008", immat: "GB-311-DF" },
      compagnie: { nom: "Mutuelle du Centre", email: "recours@mutuelle-centre.fr", reference: "MDC-REC-3381" },
      refs: { sinistre: "MDC-SIN-41007" },
      region: "Provence-Alpes-Côte d'Azur",
      intervenants: { gestionnaire: "u-gest3", expert: "u-expert3", reparateur: "u-rep", suiveurs: [] },
      pilotage: {
        ouEnEst: "Accord de la compagnie adverse, paiement annoncé.",
        attente: "Réception du paiement",
        prochaineAction: "Confirmer la réception du paiement puis clôturer",
        quiDoitAgir: "nereids",
        echeance: daysFromNow(8),
      },
      expertise: { date: daysFromNow(-40), convoques: [], realisee: true },
      documents: [],
      timeline: [
        ev(daysFromNow(-70), "creation", "u-gest3", "Dossier créé"),
        msg(daysFromNow(-5, 16), "u-gest3", "Accord écrit de la Mutuelle du Centre reçu, ci-joint.", ["admin"], doc("Accord Mutuelle du Centre.pdf", "courrier", "u-gest3", daysFromNow(-5, 16), "160 Ko")),
        ev(daysFromNow(-4), "status", "u-admin", "Statut → En attente paiement"),
        msg(daysFromNow(-4, 11), "u-admin", "Bonjour M. Leroy, la Mutuelle du Centre a donné son accord : le paiement est annoncé sous 15 jours.", ["client"]),
      ],
    },
    {
      id: "NER-2026-0097",
      ref: "NER-2026-0097",
      type: "litige_assurantiel",
      litigeType: "imputable",
      status: "attente_client",
      createdAt: daysFromNow(-30),
      updatedAt: daysFromNow(-8),
      client: { firstName: "Aurélie", lastName: "Fontaine", phone: "06 87 65 43 21", email: "a.fontaine@mail.fr", address: "14 allée des Tilleuls, 42100 Saint-Étienne" },
      vehicule: { marque: "BMW", modele: "Série 1", immat: "FT-640-PR" },
      compagnie: { nom: "Assurances Atlantique", email: "litiges@atlantique-assur.fr" },
      refs: { sinistre: "AT-SIN-12093" },
      region: "Provence-Alpes-Côte d'Azur",
      // Julie Perrin est aussi mandatée par Sud Expert (abonnement Téléphonie seule) : droits réduits sur ce dossier
      intervenants: { gestionnaire: "u-gest", expert: "u-expert3", suiveurs: ["u-suiveur2"] },
      pilotage: {
        ouEnEst: "Étude en cours : photos insuffisantes pour l'expert.",
        attente: "Au moins 3 photos du dommage (1 reçue)",
        prochaineAction: "Relancer le client pour les photos",
        quiDoitAgir: "client",
        echeance: daysFromNow(-4),
      },
      expertise: { date: daysFromNow(3, 10), lieu: "14 allée des Tilleuls, 42100 Saint-Étienne", convoques: ["u-c-fontaine", "u-expert3"] },
      documents: [doc("Photo portière.jpg", "photos", "u-c-fontaine", daysFromNow(-30), "3,0 Mo")],
      timeline: [
        ev(daysFromNow(-30), "creation", "u-gest3", "Dossier créé"),
        msg(daysFromNow(-25, 14), "u-suiveur2", "Bonjour, je représente Mme Fontaine dans ce litige. Vous trouverez ci-joint notre mandat.", ["admin", "gestionnaire"], doc("Mandat Cabinet Lambert.pdf", "courrier", "u-suiveur2", daysFromNow(-25, 14), "210 Ko")),
        ev(daysFromNow(-8), "status", "u-expert3", "Statut → En attente client", "Il manque au moins 2 photos."),
        msg(daysFromNow(-4, 10), "u-gest3", "Bonjour Mme Fontaine, il nous manque encore au moins 2 photos de la portière (vue d'ensemble et gros plan) pour que l'expert puisse avancer.", ["client"]),
      ],
    },
    {
      id: "NER-2026-0088",
      ref: "NER-2026-0088",
      type: "sinistre",
      sinistreType: "non_resp_avec_tiers",
      status: "attente_pv",
      createdAt: daysFromNow(-20),
      updatedAt: daysFromNow(-2),
      client: { firstName: "Léa", lastName: "Dupuis", phone: "06 23 45 67 89", email: "lea.dupuis@mail.fr", address: "9 rue de la Gare, 43600 Sainte-Sigolène" },
      vehicule: { marque: "Fiat", modele: "500", immat: "GD-118-VC" },
      compagnie: { nom: "Garantia Assurances", email: "recours@garantia.fr", reference: "GA-REC-7720" },
      refs: { sinistre: "GA-SIN-88120" },
      region: "Auvergne-Rhône-Alpes",
      intervenants: { gestionnaire: "u-gest2", expert: "u-expert2", reparateur: "u-rep2", suiveurs: [] },
      pilotage: {
        ouEnEst: "Expertise réalisée il y a 2 jours.",
        attente: "PV d'expertise",
        prochaineAction: "Déposer le PV",
        quiDoitAgir: "expert",
        echeance: daysFromNow(-1),
      },
      expertise: { date: daysFromNow(-2, 10), lieu: "Carrosserie Chevalier, Saint-Étienne", convoques: ["u-expert2", "u-rep2"], realisee: true },
      documents: [],
      timeline: [
        ev(daysFromNow(-20), "creation", "u-gest2", "Dossier créé"),
        msg(daysFromNow(-5, 11), "u-rep2", "Ci-joint le devis de réparation de la Fiat 500, pour l'expertise.", ["gestionnaire", "expert"], doc("Devis réparation n°C-0418.pdf", "devis", "u-rep2", daysFromNow(-5, 11), "230 Ko")),
        ev(daysFromNow(-2), "expertise", "u-expert2", "Expertise réalisée"),
        ev(daysFromNow(-2), "status", "system", "Statut → En attente PV"),
        msg(daysFromNow(-1, 14), "u-gest2", "Bonjour Mme Garnier, pouvez-vous déposer le PV d'expertise ? Le délai de 24 h est dépassé.", ["expert"]),
      ],
    },
    {
      id: "NER-2026-0076",
      ref: "NER-2026-0076",
      type: "litige_auto",
      status: "en_etude",
      createdAt: daysFromNow(-6),
      updatedAt: daysFromNow(-5),
      client: { firstName: "Romain", lastName: "Caron", phone: "06 19 28 37 46", email: "r.caron@mail.fr", address: "3 rue Victor Hugo, 42400 Saint-Chamond" },
      vehicule: { marque: "Audi", modele: "A3 Sportback", immat: "EH-337-GN" },
      compagnie: { nom: "Cabinet Lambert (avocat)", email: "p.lambert@avocat-lambert.fr" },
      tiers: [{ nom: "AutoPlus Occasions (vendeur)" }],
      refs: {},
      region: "Auvergne-Rhône-Alpes",
      intervenants: { gestionnaire: "u-gest", expert: "u-expert2", suiveurs: ["u-suiveur2"] },
      pilotage: {
        ouEnEst: "Pièces reçues, analyse par l'expert.",
        attente: "Validation du dossier par l'expert",
        prochaineAction: "Valider ou refuser le dossier",
        quiDoitAgir: "expert",
        echeance: daysFromNow(3),
      },
      expertise: { date: daysFromNow(4, 14), lieu: "Carrosserie Chevalier, 233 rue de la Rive, 42320 La Grand-Croix", convoques: ["u-c-caron", "u-expert2", "u-rep2"] },
      documents: [doc("Facture d'achat.pdf", "facture_achat", "u-c-caron", daysFromNow(-6))],
      timeline: [
        ev(daysFromNow(-6), "creation", "u-gest", "Dossier créé", "Vice caché suspecté après achat d'occasion."),
        msg(daysFromNow(-5, 15), "u-suiveur2", "Bonjour, ci-joint l'annonce de vente d'AutoPlus Occasions : elle indiquait « aucun frais à prévoir ».", ["admin", "expert"], doc("Annonce de vente AutoPlus.pdf", "autre", "u-suiveur2", daysFromNow(-5, 15), "680 Ko")),
        msg(daysFromNow(-2, 10), "u-expert2", "Premier examen : le vice caché est plausible. J'attends le contrôle technique avant de valider le dossier.", ["gestionnaire", "suiveur"]),
      ],
    },
    {
      id: "NER-2026-0064",
      ref: "NER-2026-0064",
      type: "sinistre",
      sinistreType: "non_resp_avec_tiers",
      status: "cloture",
      createdAt: daysFromNow(-120),
      updatedAt: daysFromNow(-15),
      client: { firstName: "Martine", lastName: "Blanc", phone: "06 01 02 03 04", email: "m.blanc@mail.fr", address: "27 boulevard Carnot, 43000 Le Puy-en-Velay" },
      vehicule: { marque: "Renault", modele: "Captur", immat: "FA-220-HJ" },
      compagnie: { nom: "Assurances Atlantique", reference: "AT-70011-S" },
      refs: { sinistre: "SIN-2026-40102" },
      region: "Auvergne-Rhône-Alpes",
      intervenants: { gestionnaire: "u-gest", expert: "u-expert", reparateur: "u-rep", suiveurs: ["u-suiveur"] },
      suiveurRefs: { "u-suiveur": "PJ-55-2026-0344" },
      pilotage: { ouEnEst: "Dossier clôturé.", attente: "—", prochaineAction: "Archiver le dossier", quiDoitAgir: "nereids" },
      expertise: { convoques: [], realisee: true },
      documents: [],
      timeline: [
        ev(daysFromNow(-120), "creation", "u-gest", "Dossier créé"),
        ev(daysFromNow(-15), "status", "u-admin", "Statut → Clôturé", "Motif : Paiement reçu"),
        msg(daysFromNow(-15, 11), "u-admin", "Le paiement de 1 960 € a été reçu, le dossier est clôturé. Vous trouverez ci-joint le justificatif de règlement.", ["client", "suiveur"], doc("Justificatif de paiement.pdf", "courrier", "u-admin", daysFromNow(-15, 11), "85 Ko")),
        msg(daysFromNow(-14, 10), "u-suiveur", "Merci pour votre accompagnement, nous clôturons également le dossier de notre côté.", ["admin"]),
      ],
      cloture: { motif: "Paiement reçu", at: daysFromNow(-15) },
    },
    {
      id: "NER-2026-0031",
      ref: "NER-2026-0031",
      type: "litige_assurantiel",
      litigeType: "valeur",
      status: "archive",
      createdAt: daysFromNow(-200),
      updatedAt: daysFromNow(-60),
      client: { firstName: "Patrick", lastName: "Vidal", phone: "06 09 08 07 06", email: "p.vidal@mail.fr", address: "11 rue du Commerce, 42700 Firminy" },
      vehicule: { marque: "Skoda", modele: "Octavia", immat: "EK-551-TY" },
      compagnie: { nom: "Mutuelle du Centre" },
      refs: {},
      region: "Auvergne-Rhône-Alpes",
      intervenants: { gestionnaire: "u-gest2", expert: "u-expert", suiveurs: [] },
      pilotage: { ouEnEst: "Dossier archivé.", attente: "—", prochaineAction: "—", quiDoitAgir: "nereids" },
      expertise: { convoques: [] },
      documents: [],
      timeline: [
        ev(daysFromNow(-200), "creation", "u-gest2", "Dossier créé"),
        msg(daysFromNow(-80, 15), "u-expert", "Rapport de valeur finalisé : VRADE réévaluée à 14 200 €.", ["admin", "gestionnaire"], doc("Rapport de valeur.pdf", "rapport", "u-expert", daysFromNow(-80, 15), "1,4 Mo")),
        msg(daysFromNow(-70, 10), "u-admin", "Bonjour M. Vidal, un accord a été trouvé avec la Mutuelle du Centre. Votre dossier est clôturé.", ["client"]),
        ev(daysFromNow(-60), "status", "u-admin", "Statut → Archivé"),
      ],
      cloture: { motif: "Accord trouvé", at: daysFromNow(-70) },
    },
  ]
  return all.map(withAttachments).map(withConsultations).map((d) => withRef(withDemoExpertise(d)))
}

/** Étapes du workflow par type — utilisé pour la frise de progression */
export const WORKFLOW_STEPS: Record<DossierType, { label: string; statuses: StatusId[] }[]> = {
  sinistre: [
    { label: "Création", statuses: ["nouveau"] },
    { label: "Étude", statuses: ["en_etude", "attente_client"] },
    { label: "Recours validé", statuses: ["recours_valide", "attente_tiers", "attente_compagnie"] },
    { label: "Expertise", statuses: ["attente_expertise", "attente_pv", "complement"] },
    { label: "Réparation", statuses: ["attente_reparation"] },
    { label: "Rapport", statuses: ["attente_rapport"] },
    { label: "Réclamation", statuses: ["reclamation_envoyee", "attente_retour"] },
    { label: "Paiement", statuses: ["attente_paiement"] },
    { label: "Clôture", statuses: ["cloture", "archive"] },
  ],
  litige_auto: [
    { label: "Création", statuses: ["nouveau"] },
    { label: "Étude", statuses: ["en_etude", "attente_client"] },
    { label: "Validé", statuses: ["recours_valide", "attente_tiers", "attente_compagnie"] },
    { label: "Expertise", statuses: ["attente_expertise", "attente_pv", "complement"] },
    // CDC §4.3 : pré-rapport, discussion, rapport final et relances sont suivis dans la timeline
    { label: "Rapport", statuses: ["attente_rapport"] },
    { label: "Clôture", statuses: ["cloture", "archive"] },
  ],
  litige_assurantiel: [
    { label: "Création", statuses: ["nouveau"] },
    { label: "Étude", statuses: ["en_etude", "attente_client"] },
    { label: "Validé", statuses: ["recours_valide", "attente_compagnie", "attente_tiers"] },
    { label: "Tierce expertise", statuses: ["attente_expertise", "attente_pv", "complement", "attente_rapport", "attente_reparation"] },
    { label: "Réclamation", statuses: ["reclamation_envoyee", "attente_retour"] },
    { label: "Paiement", statuses: ["attente_paiement"] },
    { label: "Clôture", statuses: ["cloture", "archive"] },
  ],
}

export const ACTOR_LABELS: Record<RoleId | "nereids" | "all", string> = {
  admin: "Nereids",
  nereids: "Nereids",
  gestionnaire: "Gestionnaire",
  expert: "Expert",
  reparateur: "Réparateur",
  suiveur: "Intervenant suiveur",
  client: "Client",
  all: "Tous les intervenants",
}

/** Pilotage par défaut associé à un statut (utilisé lors d'un changement de statut) */
export function defaultPilotage(status: StatusId, type: DossierType): Omit<Dossier["pilotage"], "echeance"> & { delayDays?: number } {
  const map: Record<StatusId, Omit<Dossier["pilotage"], "echeance"> & { delayDays?: number }> = {
    nouveau: { ouEnEst: "Dossier créé.", attente: "Assignation des intervenants", prochaineAction: "Assigner les intervenants", quiDoitAgir: "nereids", delayDays: 1 },
    en_etude: { ouEnEst: "Dossier en cours d'étude par l'expert.", attente: "Validation du dossier par l'expert", prochaineAction: "Étudier et valider le dossier", quiDoitAgir: "expert", delayDays: 3 },
    recours_valide: {
      ouEnEst: type === "sinistre" ? "Recours validé." : "Dossier validé par l'expert.",
      attente: type === "sinistre" ? "Devis du réparateur et coordonnées de la compagnie adverse" : "Organisation de l'expertise",
      prochaineAction: type === "sinistre" ? "Demander le devis au réparateur" : "Organiser l'expertise (date, lieu, convocation)",
      quiDoitAgir: "gestionnaire",
      delayDays: 5,
    },
    attente_client: { ouEnEst: "Informations ou pièces demandées au client.", attente: "Retour du client", prochaineAction: "Relancer le client si besoin", quiDoitAgir: "client", delayDays: 5 },
    attente_tiers: { ouEnEst: "Demande envoyée au tiers.", attente: "Retour du tiers", prochaineAction: "Relancer le tiers", quiDoitAgir: "nereids", delayDays: 7 },
    attente_compagnie: { ouEnEst: "Demande envoyée à la compagnie.", attente: "Retour de la compagnie", prochaineAction: "Relancer la compagnie", quiDoitAgir: "nereids", delayDays: 15 },
    attente_expertise: { ouEnEst: "Expertise programmée, convocations envoyées.", attente: "Réalisation de l'expertise", prochaineAction: "Réaliser l'expertise", quiDoitAgir: "expert", delayDays: 7 },
    attente_pv: { ouEnEst: "Expertise réalisée.", attente: "PV d'expertise (sous 24 h)", prochaineAction: "Déposer le PV", quiDoitAgir: "expert", delayDays: 1 },
    attente_rapport:
      type === "litige_auto"
        ? { ouEnEst: "PV déposé.", attente: "Pré-rapport de l'expert (+48 h)", prochaineAction: "Déposer le pré-rapport", quiDoitAgir: "expert", delayDays: 2 }
        : { ouEnEst: "PV déposé.", attente: "Rapport de l'expert", prochaineAction: "Déposer le rapport", quiDoitAgir: "expert", delayDays: 2 },
    attente_reparation: { ouEnEst: "PV reçu, réparation en cours.", attente: "Facture proforma du réparateur", prochaineAction: "Déposer la facture proforma", quiDoitAgir: "reparateur", delayDays: 10 },
    complement: { ouEnEst: "Dommage complémentaire constaté après expertise.", attente: "Expertise complémentaire", prochaineAction: "Organiser l'expertise complémentaire", quiDoitAgir: "gestionnaire", delayDays: 3 },
    reclamation_envoyee: { ouEnEst: "Réclamation envoyée à la compagnie.", attente: "Retour de la compagnie", prochaineAction: "Relance automatique à J+15", quiDoitAgir: "nereids", delayDays: 15 },
    attente_retour: { ouEnEst: "Réclamation en cours de traitement.", attente: "Retour de la compagnie", prochaineAction: "Relance automatique à J+21", quiDoitAgir: "nereids", delayDays: 21 },
    attente_paiement: { ouEnEst: "Accord obtenu.", attente: "Réception du paiement", prochaineAction: "Confirmer le paiement puis clôturer", quiDoitAgir: "nereids", delayDays: 15 },
    cloture: { ouEnEst: "Dossier clôturé.", attente: "—", prochaineAction: "Archiver le dossier", quiDoitAgir: "nereids" },
    archive: { ouEnEst: "Dossier archivé.", attente: "—", prochaineAction: "—", quiDoitAgir: "nereids" },
  }
  return map[status]
}

/** Expertise non réalisée prévue dans les `days` prochains jours (inclut aujourd'hui) */
export function hasUpcomingExpertise(d: Dossier, days = 7): boolean {
  if (!d.expertise.date || d.expertise.realisee) return false
  const t = new Date(d.expertise.date).getTime()
  return t >= Date.now() - DAY && t <= Date.now() + days * DAY
}
