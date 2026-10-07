import {
  Archive,
  FolderOpen,
  LayoutDashboard,
  Users,
  type LucideIcon,
} from "lucide-react"

export type RoleId =
  | "admin"
  | "gestionnaire"
  | "expert"
  | "reparateur"
  | "suiveur"
  | "client"

export type NavItem = {
  label: string
  /** Chemin relatif au rôle, ex. "dossiers" → /admin/dossiers */
  path: string
  icon: LucideIcon
}

export type Role = {
  id: RoleId
  label: string
  short: string
  description: string
  /** Utilisateur fictif connecté pour ce rôle */
  userId: string
  nav: NavItem[]
  /** L'espace est-il déjà conçu dans le proto ? */
  ready: boolean
  canCreateDossier: boolean
}

export const ROLES: Role[] = [
  {
    id: "admin",
    label: "Administrateur Nereids",
    short: "Admin",
    description: "Pilote tous les dossiers, assigne, modifie les statuts, clôture et archive.",
    userId: "u-admin",
    ready: true,
    canCreateDossier: true,
    nav: [
      { label: "Tableau de bord", path: "tableau-de-bord", icon: LayoutDashboard },
      { label: "Dossiers", path: "dossiers", icon: FolderOpen },
      { label: "Archives", path: "archives", icon: Archive },
      { label: "Utilisateurs", path: "utilisateurs", icon: Users },
    ],
  },
  {
    id: "gestionnaire",
    label: "Gestionnaire Help You",
    short: "Gestionnaire",
    description: "Crée et suit les dossiers Help You, dépose les documents, relance et échange.",
    userId: "u-gest",
    ready: false,
    canCreateDossier: true,
    nav: [
      { label: "Tableau de bord", path: "tableau-de-bord", icon: LayoutDashboard },
      { label: "Mes dossiers", path: "dossiers", icon: FolderOpen },
      { label: "Archives", path: "archives", icon: Archive },
    ],
  },
  {
    id: "expert",
    label: "Expert automobile",
    short: "Expert",
    description: "Consulte ses dossiers, organise l'expertise, dépose PV et rapports.",
    userId: "u-expert",
    ready: false,
    canCreateDossier: false,
    nav: [
      { label: "Tableau de bord", path: "tableau-de-bord", icon: LayoutDashboard },
      { label: "Mes dossiers", path: "dossiers", icon: FolderOpen },
    ],
  },
  {
    id: "reparateur",
    label: "Réparateur",
    short: "Réparateur",
    description: "Dépose devis, factures et photos, échange dans le suivi.",
    userId: "u-rep",
    ready: false,
    canCreateDossier: false,
    nav: [
      { label: "Tableau de bord", path: "tableau-de-bord", icon: LayoutDashboard },
      { label: "Mes dossiers", path: "dossiers", icon: FolderOpen },
    ],
  },
  {
    id: "suiveur",
    label: "Intervenant suiveur",
    short: "Suiveur",
    description: "Protection juridique, avocat… consulte le suivi, échange et dépose des pièces.",
    userId: "u-suiveur",
    ready: false,
    canCreateDossier: false,
    nav: [
      { label: "Tableau de bord", path: "tableau-de-bord", icon: LayoutDashboard },
      { label: "Dossiers suivis", path: "dossiers", icon: FolderOpen },
    ],
  },
  {
    id: "client",
    label: "Client particulier",
    short: "Client",
    description: "Suit son dossier, dépose ses pièces et échange avec Nereids.",
    userId: "u-client",
    ready: true,
    // Le dossier est toujours créé par Nereids (CR 05/10) : le client est invité par e-mail
    canCreateDossier: false,
    nav: [
      { label: "Accueil", path: "tableau-de-bord", icon: LayoutDashboard },
      { label: "Mes dossiers", path: "dossiers", icon: FolderOpen },
    ],
  },
]

export const ROLE_IDS = ROLES.map((r) => r.id)

export function getRole(id: string): Role | undefined {
  return ROLES.find((r) => r.id === id)
}
