import type { Dossier } from "./data"
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
    d.refs.interne,
    d.refs.expert,
    d.vehicule.immat,
    d.vehicule.immat.replace(/-/g, ""),
    `${d.client.firstName} ${d.client.lastName}`,
    d.compagnie?.nom,
    names(d.intervenants.expert),
    names(d.intervenants.gestionnaire),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
  return hay.includes(s)
}
