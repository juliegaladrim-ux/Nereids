import {
  Archive,
  CalendarDays,
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
  /** Onglet prévu mais pas encore conçu : affiché désactivé avec ce badge (ex. "V2") */
  soon?: string
}

export type Role = {
  id: RoleId
  label: string
  short: string
  description: string
  /** Utilisateur fictif connecté pour ce rôle */
  userId: string
  nav: NavItem[]
  /** Page d'arrivée de l'espace (connexion, logo, changement de rôle) */
  home: string
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
    // Pas de tableau de bord (réunion client 15/10) : l'admin arrive sur les dossiers en cours
    home: "dossiers",
    nav: [
      { label: "Dossiers en cours", path: "dossiers", icon: FolderOpen },
      { label: "Calendrier experts", path: "calendrier-experts", icon: CalendarDays, soon: "V2" },
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
    ready: true,
    canCreateDossier: true,
    // Même base que l'admin (pas de tableau de bord) : arrive sur ses dossiers en cours
    home: "dossiers",
    nav: [
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
    home: "tableau-de-bord",
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
    home: "tableau-de-bord",
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
    ready: true,
    canCreateDossier: false,
    // Comme le client : invité par e-mail, il arrive directement sur ses dossiers suivis
    home: "dossiers",
    nav: [{ label: "Dossiers suivis", path: "dossiers", icon: FolderOpen }],
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
    // Pas de page d'accueil séparée : le client arrive directement sur ses dossiers
    home: "dossiers",
    nav: [{ label: "Mes dossiers", path: "dossiers", icon: FolderOpen }],
  },
]

export const ROLE_IDS = ROLES.map((r) => r.id)

export function getRole(id: string): Role | undefined {
  return ROLES.find((r) => r.id === id)
}
