/**
 * Annuaire global (demande client 22/10) : toutes les personnes et organisations connues de l'outil,
 * avec ou sans compte. Une seule fiche par personne / entreprise, pour éviter les doublons.
 *
 * - Les utilisateurs (« Utilisateurs ») sont des personnes de l'annuaire qui ont un compte.
 * - Les clients et compagnies saisis dans les dossiers alimentent l'annuaire automatiquement.
 * - Les infos d'un dossier sont figées : modifier une fiche ne change pas les dossiers existants,
 *   seuls les nouveaux dossiers reprennent la fiche à jour.
 */

import * as React from "react"

import { allUsers, getUser, personneName, type Dossier, type EmailSecondaire, type Personne, type User } from "./data"
import type { RoleId } from "./roles"
import { useStore } from "./store"

// ─── Types ───────────────────────────────────────────────────────────────────

export type OrgType = "cabinet" | "garage" | "juridique" | "assurance" | "societe"

export const ORG_TYPES: Record<OrgType, { label: string; plural: string }> = {
  cabinet: { label: "Cabinet d'expertise", plural: "Cabinets d'expertise" },
  garage: { label: "Garage", plural: "Garages" },
  juridique: { label: "Protection juridique / avocat", plural: "Protections juridiques / avocats" },
  assurance: { label: "Compagnie d'assurance", plural: "Compagnies d'assurance" },
  societe: { label: "Société", plural: "Sociétés" },
}

/** Structure de rattachement d'un intervenant selon son rôle (un expert appartient à un cabinet, etc.) */
export const ROLE_ORG: Partial<Record<RoleId, OrgType>> = { expert: "cabinet", reparateur: "garage", suiveur: "juridique" }

/**
 * Abonnement souscrit par un cabinet d'expertise (point client 26/10) : il fixe les droits du gestionnaire
 * Help You sur les dossiers de ce cabinet. Un gestionnaire mandaté par plusieurs cabinets a donc des droits
 * différents d'un dossier à l'autre.
 */
export type Abonnement = "telephonie" | "gestion" | "gestion_telephonie"

export const ABONNEMENTS: Record<Abonnement, { label: string; detail: string }> = {
  telephonie: { label: "Téléphonie seule", detail: "Consultation du dossier et traçage des appels uniquement" },
  gestion: { label: "Gestion seule", detail: "Gestion complète du dossier" },
  gestion_telephonie: { label: "Gestion + téléphonie", detail: "Gestion complète du dossier et téléphonie" },
}

export type Organisation = {
  id: string
  type: OrgType
  nom: string
  /** Cabinet d'expertise uniquement : choisi à la création de la fiche */
  abonnement?: Abonnement
  siret?: string
  phone?: string
  /** E-mail principal */
  email?: string
  autresEmails?: EmailSecondaire[]
  address?: string
}

/**
 * Type d'une personne sans compte, choisi à sa création dans l'annuaire.
 * `org` : organisation à laquelle on la rattache (un expert est lié à un cabinet, etc.).
 */
export type PersonType = "client" | "expert" | "reparateur" | "juridique" | "assurance" | "autre"

export const PERSON_TYPES: Record<PersonType, { label: string; org?: OrgType }> = {
  client: { label: "Client" },
  expert: { label: "Expert", org: "cabinet" },
  reparateur: { label: "Réparateur", org: "garage" },
  juridique: { label: "Protection juridique / avocat", org: "juridique" },
  assurance: { label: "Compagnie d'assurance", org: "assurance" },
  autre: { label: "Autre" },
}

/** Personne sans compte (client, propriétaire, contact ajouté à la main) */
export type Contact = {
  id: string
  type?: PersonType
  /** Monsieur, Madame, Maître… */
  civilite?: string
  firstName: string
  lastName: string
  fonction?: string
  orgId?: string
  phone?: string
  phone2?: string
  email?: string
  autresEmails?: EmailSecondaire[]
  address?: string
  /** Compte ouvert depuis cette fiche : la personne est désormais un utilisateur (la fiche n'est plus listée seule) */
  userId?: string
}

/** Fiches ajoutées ou modifiées pendant la démo (le reste est déduit des utilisateurs et des dossiers) */
export type AnnuaireData = { contacts: Record<string, Contact>; orgs: Record<string, Organisation> }

/** Ligne « Personnes » de l'annuaire : un contact, éventuellement relié à un compte utilisateur */
export type PersonEntry = Contact & { user?: User; org?: Organisation; isClient: boolean }

/** Fiche « Contact » seule (sans le compte ni l'organisation résolus) */
export const toContact = ({ id, type, civilite, firstName, lastName, fonction, orgId, phone, phone2, email, autresEmails, address, userId }: PersonEntry): Contact => ({
  id,
  type,
  civilite,
  firstName,
  lastName,
  fonction,
  orgId,
  phone,
  phone2,
  email,
  autresEmails,
  address,
  userId,
})

// ─── Normalisation (comparaisons sans accents, casse ni ponctuation) ─────────

export const norm = (s = "") =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
const words = (s = "") =>
  s
    .split(/[\s,.'’()-]+/)
    .map(norm)
    .filter(Boolean)
/** Chaque mot saisi est le début d'un mot du nom : « Cab Delorme » → « Cabinet Delorme Expertise » */
export const wordsMatch = (q: string, target = "") => {
  const qs = words(q)
  const ts = words(target)
  return qs.length > 0 && qs.every((w) => ts.some((t) => t.startsWith(w)))
}
const phoneKey = (s = "") => s.replace(/\D/g, "").replace(/^33/, "0")
/** « Cabinet Lambert (avocat) » → « Cabinet Lambert » */
const cleanOrgName = (s: string) => s.replace(/\s*\(.*\)\s*$/, "").trim()
export const orgIdFor = (nom: string) => `o-${norm(cleanOrgName(nom))}`

export const contactName = (c: Pick<Contact, "firstName" | "lastName">) => `${c.firstName} ${c.lastName}`.trim() || "—"
export const allEmails = (c: { email?: string; autresEmails?: EmailSecondaire[] }) =>
  [c.email, ...(c.autresEmails ?? []).map((e) => e.email)].filter((e): e is string => !!e)

// ─── Organisations de démo (données fictives) ────────────────────────────────

const SEED_ORGS: Organisation[] = [
  { id: orgIdFor("Cabinet Delorme Expertise"), type: "cabinet", nom: "Cabinet Delorme Expertise", abonnement: "gestion_telephonie", siret: "512 845 963 00027", phone: "04 71 05 22 10", email: "contact@cabinet-delorme.fr", autresEmails: [{ email: "secretariat@cabinet-delorme.fr", label: "Secrétariat" }], address: "7 place du Breuil, 43000 Le Puy-en-Velay" },
  { id: orgIdFor("Sud Expert"), type: "cabinet", nom: "Sud Expert", abonnement: "telephonie", siret: "803 114 520 00019", phone: "04 91 22 45 60", email: "contact@sudexpert.fr", address: "110 avenue du Prado, 13008 Marseille" },
  { id: orgIdFor("Garage Benali Carrosserie"), type: "garage", nom: "Garage Benali Carrosserie", siret: "441 220 876 00034", phone: "04 71 22 33 44", email: "contact@garage-benali.fr", autresEmails: [{ email: "compta@garage-benali.fr", label: "Comptabilité" }], address: "12 rue des Forges, 43200 Yssingeaux" },
  { id: orgIdFor("Carrosserie Chevalier"), type: "garage", nom: "Carrosserie Chevalier", phone: "04 77 22 33 44", email: "atelier@carrosserie-chevalier.fr", address: "233 rue de la Rive, 42320 La Grand-Croix" },
  { id: orgIdFor("Protec Juris"), type: "juridique", nom: "Protec Juris", phone: "01 44 55 66 00", email: "dossiers@protecjuris.fr", address: "9 rue de Châteaudun, 75009 Paris" },
  { id: orgIdFor("Cabinet Lambert"), type: "juridique", nom: "Cabinet Lambert", phone: "04 72 55 66 77", email: "p.lambert@avocat-lambert.fr", address: "4 quai Jules Courmont, 69002 Lyon" },
  { id: orgIdFor("Assurances Atlantique"), type: "assurance", nom: "Assurances Atlantique", phone: "09 69 32 10 10", email: "sinistres@atlantique-assur.fr", address: "40 quai de la Fosse, 44000 Nantes" },
  { id: orgIdFor("Garantia Assurances"), type: "assurance", nom: "Garantia Assurances", email: "recours@garantia.fr", address: "15 rue de la Bourse, 69002 Lyon" },
  { id: orgIdFor("Mutuelle du Centre"), type: "assurance", nom: "Mutuelle du Centre", email: "litiges@mutuelle-centre.fr", address: "3 boulevard Desaix, 63000 Clermont-Ferrand" },
]

/** « litiges@… » → « Litiges » : libellé par défaut d'un e-mail secondaire découvert dans un dossier */
const labelFromEmail = (email: string) => {
  const local = email.split("@")[0]
  return local.charAt(0).toUpperCase() + local.slice(1)
}

function addEmail<T extends { email?: string; autresEmails?: EmailSecondaire[] }>(x: T, email?: string): T {
  if (!email || allEmails(x).some((e) => norm(e) === norm(email))) return x
  if (!x.email) return { ...x, email }
  return { ...x, autresEmails: [...(x.autresEmails ?? []), { email, label: labelFromEmail(email) }] }
}

// ─── Construction de l'annuaire ──────────────────────────────────────────────

export function buildOrgs(dossiers: Dossier[], users: User[], stored: AnnuaireData): Organisation[] {
  const map = new Map<string, Organisation>([...SEED_ORGS, ...Object.values(stored.orgs)].map((o) => [o.id, o]))
  const upsert = (nom: string, type: OrgType, extra: Partial<Organisation> = {}) => {
    // Retrouve aussi une fiche renommée dans l'annuaire
    const id = map.has(orgIdFor(nom)) ? orgIdFor(nom) : ([...map.values()].find((o) => norm(o.nom) === norm(cleanOrgName(nom)))?.id ?? orgIdFor(nom))
    const cur = map.get(id)
    if (!cur) {
      map.set(id, { id, type, nom: cleanOrgName(nom), phone: extra.phone, email: extra.email, address: extra.address, siret: extra.siret })
      return
    }
    // Même organisation retrouvée dans un autre dossier : on complète sa fiche (un e-mail différent devient un e-mail secondaire)
    map.set(id, addEmail({ ...cur, phone: cur.phone ?? extra.phone, address: cur.address ?? extra.address, siret: cur.siret ?? extra.siret }, extra.email))
  }

  // Structure de chaque intervenant (cabinet de l'expert, garage du réparateur…)
  for (const u of users) {
    const type = ROLE_ORG[u.role]
    if (type && u.structure && u.structure !== "Expert indépendant") upsert(u.structure, type)
  }
  for (const d of dossiers) {
    // Compagnie visée / assurance adverse ; en litige auto, il s'agit souvent d'un vendeur ou d'un garage
    if (d.compagnie?.nom) upsert(d.compagnie.nom, d.type === "litige_auto" ? "societe" : "assurance", d.compagnie)
    for (const p of [d.client, d.proprietaire]) {
      if (p?.kind === "morale" && p.societe) upsert(p.societe, "societe", p)
    }
  }
  for (const o of Object.values(stored.orgs)) map.set(o.id, o)
  return [...map.values()].sort((a, b) => a.nom.localeCompare(b.nom))
}

/** Organisation de rattachement d'un utilisateur, d'après sa structure */
export const userOrg = (u: Pick<User, "structure">, orgs: Organisation[]) =>
  orgs.find((o) => o.id === orgIdFor(u.structure ?? "")) ?? orgs.find((o) => norm(o.nom) === norm(cleanOrgName(u.structure ?? "")))

/** Fiche d'une organisation d'après son nom (tel que saisi dans un dossier) */
export const orgByName = (nom: string, orgs: Organisation[]) => (nom.trim() ? userOrg({ structure: nom }, orgs) : undefined)

export function buildPeople(dossiers: Dossier[], users: User[], orgs: Organisation[], stored: AnnuaireData): PersonEntry[] {
  const clientIds = new Set(dossiers.flatMap((d) => [d.client.userId, d.client.contactId]).filter(Boolean))
  const clientEmails = new Set(dossiers.map((d) => norm(d.client.email)).filter(Boolean))
  const isClient = (c: Contact) => clientIds.has(c.id) || clientIds.has(c.userId) || allEmails(c).some((e) => clientEmails.has(norm(e)))

  const people: PersonEntry[] = users.map((u) => {
    const c: Contact = {
      id: u.id,
      civilite: u.civilite,
      firstName: u.firstName,
      lastName: u.lastName,
      fonction: u.fonction || undefined,
      phone: u.phone,
      phone2: u.phone2,
      email: u.email,
      autresEmails: u.autresEmails,
      address: u.address,
      userId: u.id,
    }
    const org = userOrg(u, orgs)
    return { ...c, orgId: org?.id, org, user: u, isClient: u.role === "client" }
  })
  const userEmails = new Set(users.map((u) => norm(u.email)))

  // Clients et propriétaires (personnes physiques) saisis dans les dossiers, sans compte
  const derived = new Map<string, Contact>()
  for (const d of dossiers) {
    for (const p of [d.client, d.proprietaire] as (Personne & { userId?: string })[]) {
      if (!p || p.kind === "morale" || p.userId || (p.email && userEmails.has(norm(p.email)))) continue
      const id = p.contactId ?? `c-${norm(p.email) || norm(personneName(p))}`
      if (derived.has(id)) continue
      derived.set(id, { id, civilite: p.civilite, firstName: p.firstName, lastName: p.lastName, phone: p.phone, phone2: p.phone2, email: p.email, address: p.address })
    }
  }
  for (const c of Object.values(stored.contacts)) derived.set(c.id, c)

  for (const c of derived.values()) {
    if (c.userId) continue // devenu utilisateur : listé via son compte
    const org = orgs.find((o) => o.id === c.orgId)
    people.push({ ...c, org, isClient: isClient(c) })
  }
  return people.sort((a, b) => `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`))
}

/** Cabinet d'un dossier : celui de son expert (aucun tant que l'expert n'est pas assigné) */
export function dossierCabinet(d: Dossier, orgs: Organisation[]): Organisation | undefined {
  const expert = getUser(d.intervenants.expert)
  const org = expert ? userOrg(expert, orgs) : undefined
  return org?.type === "cabinet" ? org : undefined
}

/** Cabinet d'un dossier, à jour de l'annuaire */
export function useDossierCabinet(d?: Dossier): Organisation | undefined {
  const { orgs } = useAnnuaire()
  return d ? dossierCabinet(d, orgs) : undefined
}

// ─── Recherche et doublons ───────────────────────────────────────────────────

/** Recherche par nom (dans les deux sens), e-mail, téléphone ou organisation */
export function searchPeople(people: PersonEntry[], q: string, limit = 6): PersonEntry[] {
  const k = norm(q)
  if (k.length < 2) return []
  const tel = phoneKey(q)
  return people
    .filter(
      (p) =>
        norm(`${p.firstName}${p.lastName}`).includes(k) ||
        norm(`${p.lastName}${p.firstName}`).includes(k) ||
        wordsMatch(q, `${p.firstName} ${p.lastName}`) ||
        allEmails(p).some((e) => norm(e).includes(k)) ||
        (tel.length >= 4 && phoneKey(p.phone).includes(tel)) ||
        norm(p.org?.nom).includes(k),
    )
    .slice(0, limit)
}

export function searchOrgs(orgs: Organisation[], q: string, types?: OrgType[], limit = 6): Organisation[] {
  const k = norm(cleanOrgName(q))
  if (k.length < 2) return []
  return orgs
    .filter((o) => (!types || types.includes(o.type)) && (norm(o.nom).includes(k) || wordsMatch(q, o.nom) || allEmails(o).some((e) => norm(e).includes(k)) || norm(o.siret) === k))
    .slice(0, limit)
}

export type Similar<T> = { entry: T; reason: string }

/** Fiches qui ressemblent à la saisie : même e-mail, même téléphone ou même nom */
export function similarPeople(
  people: PersonEntry[],
  cand: { firstName?: string; lastName?: string; email?: string; autresEmails?: EmailSecondaire[]; phone?: string },
  excludeId?: string,
): Similar<PersonEntry>[] {
  const emails = allEmails(cand).map(norm).filter(Boolean)
  const tel = phoneKey(cand.phone)
  const name = norm(`${cand.firstName ?? ""}${cand.lastName ?? ""}`)
  const reversed = norm(`${cand.lastName ?? ""}${cand.firstName ?? ""}`)
  const out: Similar<PersonEntry>[] = []
  for (const p of people) {
    if (p.id === excludeId) continue
    const reason = allEmails(p).some((e) => emails.includes(norm(e)))
      ? "même e-mail"
      : tel.length >= 10 && phoneKey(p.phone) === tel
        ? "même téléphone"
        : cand.firstName && cand.lastName && [name, reversed].includes(norm(`${p.firstName}${p.lastName}`))
          ? "même nom"
          : null
    if (reason) out.push({ entry: p, reason })
  }
  return out
}

export function similarOrgs(orgs: Organisation[], cand: { nom?: string; siret?: string; email?: string }, excludeId?: string): Similar<Organisation>[] {
  const nom = norm(cleanOrgName(cand.nom ?? ""))
  const siret = norm(cand.siret)
  const email = norm(cand.email)
  const out: Similar<Organisation>[] = []
  for (const o of orgs) {
    if (o.id === excludeId) continue
    const n = norm(o.nom)
    const reason =
      siret.length >= 9 && norm(o.siret) === siret
        ? "même SIRET"
        : email && allEmails(o).some((e) => norm(e) === email)
          ? "même e-mail"
          : nom.length >= 3 && (n === nom || n.includes(nom) || nom.includes(n) || wordsMatch(cand.nom ?? "", o.nom))
            ? "nom proche"
            : null
    if (reason) out.push({ entry: o, reason })
  }
  return out
}

// ─── Dossiers liés ───────────────────────────────────────────────────────────

const involves = (d: Dossier, id: string) =>
  d.intervenants.gestionnaire === id || d.intervenants.expert === id || d.intervenants.reparateur === id || d.intervenants.suiveurs.includes(id)

export function personDossiers(p: PersonEntry, dossiers: Dossier[]): Dossier[] {
  const emails = allEmails(p).map(norm)
  const matches = (x?: Personne & { userId?: string }) =>
    !!x && (x.contactId === p.id || (!!p.userId && x.userId === p.userId) || (x.kind !== "morale" && !!x.email && emails.includes(norm(x.email))))
  return dossiers.filter((d) => (p.userId && involves(d, p.userId)) || matches(d.client) || matches(d.proprietaire))
}

const sameOrg = (nom: string, o: Organisation) => orgIdFor(nom) === o.id || norm(cleanOrgName(nom)) === norm(o.nom)

export function orgDossiers(o: Organisation, dossiers: Dossier[], people: PersonEntry[]): Dossier[] {
  const members = people.filter((p) => p.orgId === o.id && p.userId).map((p) => p.userId!)
  return dossiers.filter(
    (d) =>
      (d.compagnie?.nom && sameOrg(d.compagnie.nom, o)) ||
      [d.client, d.proprietaire].some((x) => x?.kind === "morale" && !!x.societe && (x.contactId === o.id || sameOrg(x.societe, o))) ||
      members.some((m) => involves(d, m)),
  )
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/** Annuaire complet, recalculé à partir des utilisateurs, des dossiers et des fiches enregistrées */
export function useAnnuaire() {
  const { dossiers, accounts, annuaire } = useStore()
  return React.useMemo(() => {
    const users = allUsers()
    const orgs = buildOrgs(dossiers, users, annuaire)
    const people = buildPeople(dossiers, users, orgs, annuaire)
    return { orgs, people }
    // accounts : les profils et comptes invités modifient allUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dossiers, accounts, annuaire])
}
