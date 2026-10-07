"use client"

import * as React from "react"

import { seedDossiers, type Dossier, type TimelineEvent } from "./data"

/**
 * Store du prototype : données fictives en mémoire, persistées dans le
 * navigateur (localStorage) pour que les dossiers créés pendant une démo
 * restent visibles. Un bouton « Réinitialiser » remet les données de départ.
 */

const STORAGE_KEY = "nereids-proto-v1"

type Store = {
  dossiers: Dossier[]
  getDossier: (id: string) => Dossier | undefined
  createDossier: (d: Dossier) => void
  updateDossier: (id: string, patch: (d: Dossier) => Dossier) => void
  addEvent: (id: string, e: Omit<TimelineEvent, "id" | "at"> & { at?: string }) => void
  reset: () => void
}

const StoreContext = React.createContext<Store | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  // Données chargées uniquement côté navigateur : dates relatives + localStorage
  const [dossiers, setDossiers] = React.useState<Dossier[] | null>(null)

  React.useEffect(() => {
    let initial: Dossier[] | null = null
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) initial = JSON.parse(raw)
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydratation côté client
    setDossiers(initial ?? seedDossiers())
  }, [])

  React.useEffect(() => {
    if (!dossiers) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dossiers))
    } catch {}
  }, [dossiers])

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
      reset: () => {
        try {
          window.localStorage.removeItem(STORAGE_KEY)
        } catch {}
        setDossiers(seedDossiers())
      },
    },
    [dossiers],
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
  const max = dossiers.reduce((m, d) => Math.max(m, Number(d.ref.split("-").pop()) || 0), 0)
  return `NER-${year}-${String(max + 1).padStart(4, "0")}`
}
