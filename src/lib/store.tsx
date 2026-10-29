"use client"

import * as React from "react"

import {
  registerProfiles,
  registerUsers,
  seedAccounts,
  seedDossiers,
  suiveurFromRequest,
  withConsultations,
  demoDocDate,
  type Account,
  type User,
  type Dossier,
  type TimelineEvent,
  withDemoExpertise,
  withRef,
} from "./data"
import type { AnnuaireData, Contact, Organisation } from "./annuaire"

/**
 * Store du prototype : données fictives en mémoire, persistées dans le
 * navigateur (localStorage) pour que les dossiers créés pendant une démo
 * restent visibles. Un bouton « Réinitialiser » remet les données de départ.
 */

const STORAGE_KEY = "nereids-proto-v11"
const ACCOUNTS_KEY = "nereids-proto-accounts-v1"
const ANNUAIRE_KEY = "nereids-proto-annuaire-v1"
const EMPTY_ANNUAIRE: AnnuaireData = { contacts: {}, orgs: {} }

type Store = {
  dossiers: Dossier[]
  getDossier: (id: string) => Dossier | undefined
  createDossier: (d: Dossier) => void
  updateDossier: (id: string, patch: (d: Dossier) => Dossier) => void
  addEvent: (id: string, e: Omit<TimelineEvent, "id" | "at"> & { at?: string }) => void
  /** Trace l'ouverture d'un dossier (sans changer sa date de dernière activité) */
  logConsultation: (id: string, userId: string) => void
  /** Réponse unique à un message du suivi (ignorée si le message a déjà une réponse) */
  replyToMessage: (id: string, eventId: string, author: string, body: string) => void
  /** Notes internes Nereids — n'affectent pas la date de dernière activité (invisible des autres rôles) */
  addNote: (id: string, author: string, body: string) => void
  deleteNote: (id: string, noteId: string) => void
  /** Comptes intervenants invités par e-mail (activation, coordonnées vérifiées) */
  accounts: Record<string, Account>
  updateAccount: (userId: string, patch: (a: Account | undefined) => Account) => void
  /** Nouvel utilisateur invité par e-mail (onglet « Utilisateurs » ou intervenant ajouté lors d'une assignation) */
  inviteUser: (u: User) => void
  /** Remet un compte dans son état de départ (pour rejouer l'activation) */
  resetAccount: (userId: string) => void
  /** Fiches de l'annuaire ajoutées ou modifiées (le reste est déduit des utilisateurs et des dossiers) */
  annuaire: AnnuaireData
  saveContact: (c: Contact) => void
  saveOrg: (o: Organisation) => void
  reset: () => void
}

const StoreContext = React.createContext<Store | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  // Données chargées uniquement côté navigateur : dates relatives + localStorage
  const [dossiers, setDossiers] = React.useState<Dossier[] | null>(null)
  const [accounts, setAccounts] = React.useState<Record<string, Account>>({})
  const [annuaire, setAnnuaire] = React.useState<AnnuaireData>(EMPTY_ANNUAIRE)

  React.useEffect(() => {
    let initial: Dossier[] | null = null
    let initialAccounts: Record<string, Account> | null = null
    let initialAnnuaire: AnnuaireData | null = null
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      // Données déjà sauvegardées : on y ajoute les consultations fictives et les notes internes d'exemple si elles n'existent pas encore
      if (raw) {
        const seed = seedDossiers()
        initial = (JSON.parse(raw) as Dossier[]).map((d) =>
          withConsultations({
            ...d,
            notes: d.notes ?? seed.find((x) => x.id === d.id)?.notes,
            autresExpertises: d.autresExpertises ?? withDemoExpertise(d).autresExpertises,
            // Date du document : estimée pour les pièces déjà enregistrées
            documents: d.documents.map((doc) => (doc.docDate ? doc : { ...doc, docDate: demoDocDate(doc.category, doc.addedAt) })),
          }),
        ).map((d) => (d.ref.startsWith("NER-") ? withRef(d) : d)) // ancien format de référence
      }
      const rawAccounts = window.localStorage.getItem(ACCOUNTS_KEY)
      if (rawAccounts) initialAccounts = JSON.parse(rawAccounts)
      const rawAnnuaire = window.localStorage.getItem(ANNUAIRE_KEY)
      if (rawAnnuaire) initialAnnuaire = JSON.parse(rawAnnuaire)
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydratation côté client
    setDossiers(initial ?? seedDossiers())
    setAccounts(initialAccounts ?? seedAccounts())
    setAnnuaire(initialAnnuaire ?? EMPTY_ANNUAIRE)
  }, [])

  React.useEffect(() => {
    if (!dossiers) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dossiers))
    } catch {}
  }, [dossiers])

  React.useEffect(() => {
    if (!dossiers) return
    try {
      window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
    } catch {}
  }, [accounts, dossiers])

  React.useEffect(() => {
    if (!dossiers) return
    try {
      window.localStorage.setItem(ANNUAIRE_KEY, JSON.stringify(annuaire))
    } catch {}
  }, [annuaire, dossiers])

  // Les coordonnées vérifiées à l'activation remplacent celles saisies par Nereids
  registerProfiles(Object.fromEntries(Object.entries(accounts).flatMap(([id, a]) => (a.profile ? [[id, a.profile]] : []))))

  // Les comptes suiveurs créés depuis une demande client (et ceux ajoutés dans « Utilisateurs ») deviennent des utilisateurs à part entière
  if (dossiers)
    registerUsers(
      dossiers.flatMap((d) => [
        ...(d.suiveurRequests ?? []).filter((r) => r.status === "created").map(suiveurFromRequest),
        ...(d.extraIntervenants ?? []),
      ]).concat(Object.values(accounts).flatMap((a) => (a.user ? [a.user] : []))),
    )

  const value = React.useMemo<Store | null>(
    () =>
      dossiers && {
      dossiers,
      getDossier: (id) => dossiers.find((d) => d.id === id),
      createDossier: (d) => setDossiers((all) => [d, ...(all ?? [])]),
      updateDossier: (id, patch) =>
        setDossiers((all) =>
          (all ?? []).map((d) => (d.id === id ? { ...patch(d), updatedAt: new Date().toISOString() } : d)),
        ),
      addEvent: (id, e) =>
        setDossiers((all) =>
          (all ?? []).map((d) =>
            d.id === id
              ? {
                  ...d,
                  updatedAt: new Date().toISOString(),
                  timeline: [
                    ...d.timeline,
                    { ...e, id: `e${Date.now()}${Math.random().toString(36).slice(2, 6)}`, at: e.at ?? new Date().toISOString() },
                  ],
                }
              : d,
          ),
        ),
      logConsultation: (id, userId) =>
        setDossiers((all) => {
          const d = all?.find((x) => x.id === id)
          // Une seule trace par personne et par demi-heure (état inchangé sinon, pour ne pas reboucler)
          const since = new Date(Date.now() - 30 * 60_000).toISOString()
          if (!all || !d || d.timeline.some((e) => e.kind === "consultation" && e.author === userId && e.at > since)) return all
          const e: TimelineEvent = { id: `c${Date.now()}`, at: new Date().toISOString(), kind: "consultation", author: userId, title: "A consulté le dossier" }
          return all.map((x) => (x.id === id ? { ...x, timeline: [...x.timeline, e] } : x))
        }),
      replyToMessage: (id, eventId, author, body) =>
        setDossiers((all) =>
          (all ?? []).map((d) =>
            d.id === id
              ? {
                  ...d,
                  updatedAt: new Date().toISOString(),
                  timeline: d.timeline.map((e) => (e.id === eventId && !e.reply ? { ...e, reply: { author, body, at: new Date().toISOString() } } : e)),
                }
              : d,
          ),
        ),
      addNote: (id, author, body) =>
        setDossiers((all) =>
          (all ?? []).map((d) =>
            d.id === id ? { ...d, notes: [...(d.notes ?? []), { id: `n${Date.now()}`, at: new Date().toISOString(), author, body }] } : d,
          ),
        ),
      deleteNote: (id, noteId) =>
        setDossiers((all) => (all ?? []).map((d) => (d.id === id ? { ...d, notes: d.notes?.filter((n) => n.id !== noteId) } : d))),
      accounts,
      updateAccount: (userId, patch) => setAccounts((all) => ({ ...all, [userId]: patch(all[userId]) })),
      inviteUser: (u) => setAccounts((all) => ({ ...all, [u.id]: { invitedAt: new Date().toISOString(), user: u } })),
      resetAccount: (userId) =>
        setAccounts((all) => {
          const seed = seedAccounts()[userId]
          const rest = Object.fromEntries(Object.entries(all).filter(([id]) => id !== userId))
          return seed ? { ...rest, [userId]: seed } : rest
        }),
      annuaire,
      saveContact: (c) => setAnnuaire((a) => ({ ...a, contacts: { ...a.contacts, [c.id]: c } })),
      saveOrg: (o) => setAnnuaire((a) => ({ ...a, orgs: { ...a.orgs, [o.id]: o } })),
      reset: () => {
        try {
          window.localStorage.removeItem(STORAGE_KEY)
          window.localStorage.removeItem(ACCOUNTS_KEY)
          window.localStorage.removeItem(ANNUAIRE_KEY)
        } catch {}
        setDossiers(seedDossiers())
        setAccounts(seedAccounts())
        setAnnuaire(EMPTY_ANNUAIRE)
      },
    },
    [dossiers, accounts, annuaire],
  )

  if (!value) return null
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const ctx = React.useContext(StoreContext)
  if (!ctx) throw new Error("useStore doit être utilisé dans <StoreProvider>")
  return ctx
}

export function nextDossierRef(dossiers: Dossier[]): string {
  const year = new Date().getFullYear()
  const max = dossiers.reduce((m, d) => Math.max(m, Number(d.id.split("-").pop()) || 0), 0)
  return `NER-${year}-${String(max + 1).padStart(4, "0")}`
}
