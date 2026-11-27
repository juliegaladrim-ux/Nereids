import {
  Archive,
  BookUser,
  Building2,
  CalendarDays,
  FolderOpen,
  Users,
  type LucideIcon,
} from "lucide-react"

export type RoleId =
  | "admin"
  | "admin_cabinet"
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
      { label: "Annuaire", path: "annuaire", icon: BookUser },
    ],
  },
  {
    id: "admin_cabinet",
    label: "Administrateur cabinet",
    short: "Admin cabinet",
    description: "Renseigne la fiche de son cabinet (RIB, logo, informations) et gère ses gestionnaires et ses experts.",
    userId: "u-admincab",
    ready: true,
    canCreateDossier: false,
    home: "dossiers",
    nav: [
      { label: "Dossiers du cabinet", path: "dossiers", icon: FolderOpen },
      { label: "Mon cabinet", path: "cabinet", icon: Building2 },
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
    description: "Crée et consulte ses dossiers, organise l'expertise, dépose PV et rapports.",
    userId: "u-expert",
    ready: true,
    canCreateDossier: true,
    // Comme le réparateur : il arrive directement sur ses dossiers, dates d'expertise en évidence
    home: "dossiers",
    nav: [{ label: "Mes dossiers", path: "dossiers", icon: FolderOpen }],
  },
  {
    id: "reparateur",
    label: "Réparateur",
    short: "Réparateur",
    description: "Transmet une demande simplifiée, dépose devis, factures et photos, échange dans le suivi.",
    userId: "u-rep",
    ready: true,
    canCreateDossier: true,
    // Comme le suiveur : il arrive directement sur ses dossiers, présentés en tableau
    home: "dossiers",
    nav: [{ label: "Mes dossiers", path: "dossiers", icon: FolderOpen }],
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

/**
 * Profils d'utilisateurs : le rôle + sa structure. Le gestionnaire Nereids a exactement les droits du
 * gestionnaire Help You (point client 22/10) : même rôle « gestionnaire », seule la structure change.
 */
export type ProfileId = RoleId | "gestionnaire_nereids"

type Profile = { id: ProfileId; role: RoleId; label: string; short: string; structure?: string }

export const PROFILES: Profile[] = ROLES.flatMap((r): Profile[] => {
  if (r.id === "admin") return [{ id: r.id, role: r.id, label: r.label, short: "Admin Nereids", structure: "Nereids" }]
  if (r.id === "gestionnaire")
    return [
      { id: "gestionnaire_nereids", role: r.id, label: "Gestionnaire Nereids", short: "Gestionnaire Nereids", structure: "Nereids" },
      { id: r.id, role: r.id, label: r.label, short: "Gestionnaire Help You", structure: "Help You" },
    ]
  return [{ id: r.id, role: r.id, label: r.label, short: r.short }]
})

export const getProfile = (id: ProfileId) => PROFILES.find((p) => p.id === id)!

export function userProfile(u: { role?: RoleId; structure?: string }): ProfileId | undefined {
  if (u.role === "gestionnaire" && u.structure?.trim().toLowerCase() === "nereids") return "gestionnaire_nereids"
  return u.role
}
