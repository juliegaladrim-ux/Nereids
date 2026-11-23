"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Archive,
  BellRing,
  CalendarDays,
  Check,
  ChevronLeft,
  CircleCheck,
  CircleDashed,
  Clock,
  Copy,
  Download,
  FileText,
  Flag,
  LayoutGrid,
  List,
  Lock,
  LockOpen,
  Mail,
  MapPin,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Trash2,
  UserCheck,
  User as UserIcon,
  UserPlus,
  Wrench,
  X,
} from "lucide-react"

import { useRole } from "@/components/app-shell/role-context"
import { DocThumbnail, useDocPreview } from "@/components/doc-preview"
import { Immat } from "@/components/immat"
import { AbonnementBadge, ExpertiseBadge, LateBadge, StatusBadge, ValidationPills } from "@/components/status-badge"
import { RoleBadge } from "@/components/role-badge"
import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ADMIN_DOC_CATEGORIES,
  CIVILITES,
  CLOSING_REASONS,
  DOC_CATEGORIES,
  DOSSIER_TYPES,
  LITIGE_ASSUR_TYPES,
  REGIONS,
  REGION_DEPARTEMENTS,
  SINISTRE_TYPES,
  STATUS_ORDER,
  isClosedStatus,
  SUIVEUR_QUALITES,
  WORKFLOW_STEPS,
  clientValidation,
  compagnieLabel,
  allExpertises,
  docLabel,
  docVisibleTo,
  isNewDoc,
  type DocumentItem,
  docDate,
  dossierDepartement,
  expertisePeople,
  expectedDocs,
  fullName,
  getUser,
  isLate,
  lateDays,
  nextAction,
  personneName,
  setExpertise,
  type DocCategory,
  type Dossier,
  type DossierType,
  type LitigeAssurantielType,
  type Personne,
  type SinistreType,
  type SuiveurRequest,
  type User,
} from "@/lib/data"
import { dossierRights, visibleDossiers } from "@/lib/access"
import { useDossierCabinet, type Organisation } from "@/lib/annuaire"
import { formatDate, formatDateTime, formatLongDate, relativeDays } from "@/lib/format"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { AddDocDialog, AssignDialog, CloseDialog, RelanceDialog, StatusDialog } from "./dossier-dialogs"
import { EditDialog, fromDateInput, opt, toDateInput, toDateTimeInput, type EditField, type EditSection, type Values } from "./dossier-edit"
import { DossierNotes } from "./dossier-notes"
import { PartiesCard } from "./dossier-parties"
import { VehiculeTab } from "./dossier-vehicule"
import { DossierSuivi } from "./dossier-suivi"
import { ConvoquesCard } from "./expertise-convoques"
import { convoqueName, EditableValidationPills, eur, ExpertiseParcoursBanner, PreparationCard } from "./expertise-parcours"
import { EditIntervenantDialog, RemoveIntervenantDialog, type IntervenantSlot } from "./intervenant-dialogs"

/** Émis par le bandeau du prototype (detail : id du dossier) */
export const REPARATEUR_PROMPT_EVENT = "proto:reparateur-prompt"

type DialogId = "status" | "close" | "assign" | "relance" | "doc" | null

export type SectionId = "client" | "vehicule" | "compagnie" | "cabinet" | "dossier" | "tiers" | "description" | "refs" | "expertise" | "cloture"

const opts = <T extends string>(rec: Record<T, string | { label: string }>) =>
  (Object.entries(rec) as [T, string | { label: string }][]).map(([value, l]) => ({ value, label: typeof l === "string" ? l : l.label }))

export function DossierDetail({ id }: { id: string }) {
  const { href, user, role } = useRole()
  const router = useRouter()
  const { getDossier, updateDossier, addEvent, logConsultation } = useStore()
  const found = getDossier(id)
  // Cabinet du dossier (celui de l'expert) : son abonnement fixe les droits du gestionnaire Help You
  const cabinet = useDossierCabinet(found)
  const rights = dossierRights(role.id, user.id, cabinet?.abonnement)
  // Notes internes partagées entre Nereids et les gestionnaires Help You
  const canSeeNotes = role.id === "admin" || role.id === "gestionnaire"
  const isClient = role.id === "client"
  const listLabel = role.nav.find((n) => n.path === "dossiers")?.label ?? "Dossiers"
  // Un rôle restreint n'ouvre que les dossiers qui le concernent
  const d = found && visibleDossiers([found], role.id, user.id).length ? found : undefined
  const [dialog, setDialog] = React.useState<DialogId>(null)
  const [docCategory, setDocCategory] = React.useState<DocCategory | undefined>()
  const [tab, setTab] = React.useState("suivi")
  const [edit, setEdit] = React.useState<EditSection | null>(null)
  // Admin : modifier / retirer un intervenant assigné
  const [editSlot, setEditSlot] = React.useState<IntervenantSlot | null>(null)
  const [removeSlot, setRemoveSlot] = React.useState<IntervenantSlot | null>(null)
  // Les visites des intervenants et du client sont tracées dans le suivi (visibles par Nereids, qui n'est pas tracé)
  const trackVisit = !!d && role.id !== "admin"

  React.useEffect(() => {
    if (trackVisit) logConsultation(id, user.id)
  }, [trackVisit, id, user.id, logConsultation])

  // Proto client : choisir l'étape « Recours validé » dans le bandeau du prototype demande le réparateur
  const [reparateurPrompt, setReparateurPrompt] = React.useState(false)
  React.useEffect(() => {
    if (!isClient) return
    const open = (e: Event) => (e as CustomEvent<string>).detail === id && setReparateurPrompt(true)
    window.addEventListener(REPARATEUR_PROMPT_EVENT, open)
    return () => window.removeEventListener(REPARATEUR_PROMPT_EVENT, open)
  }, [isClient, id])

  if (!d) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">Dossier introuvable.</p>
        <Button variant="link" render={<Link href={href("dossiers")} />} nativeButton={false}>
          Retour à « {listLabel} »
        </Button>
      </div>
    )
  }

  const closed = isClosedStatus(d.status)
  const late = isLate(d)
  // L'admin, c'est Nereids : « Nereids doit agir » = c'est à lui
  const { quiDoitAgir } = nextAction(d)
  const yourTurn = !closed && (quiDoitAgir === role.id || (role.id === "admin" && quiDoitAgir === "nereids"))
  // Client et suiveur ne voient l'échéance (et le retard) que quand c'est à eux d'agir : les délais internes ne les concernent pas
  const showDeadline = rights.pilot || yourTurn
  const ownRef = d.suiveurRefs?.[user.id]

  function archive() {
    updateDossier(d!.id, (x) => ({ ...x, status: "archive", pilotage: { ...x.pilotage, ouEnEst: "Dossier archivé.", prochaineAction: "—" } }))
    addEvent(d!.id, { kind: "status", author: user.id, title: "Statut → Archivé" })
    toast.success("Dossier archivé", { description: "Il reste consultable dans les archives." })
  }

  /** Applique une modification admin + la trace dans le suivi */
  function apply(title: string, patch: (x: Dossier) => Dossier) {
    updateDossier(d!.id, patch)
    addEvent(d!.id, { kind: "system", author: user.id, title: `${title} modifié(e)` })
    toast.success("Modifications enregistrées")
  }

  function openEdit(id: SectionId) {
    const section = buildSection(id, d!, apply)
    // Le client ne modifie que ses coordonnées ; le reste passe par Nereids
    if (id === "client" && !rights.pilot) {
      section.title = "Modifier mes coordonnées"
      section.description = "Pour corriger votre nom, écrivez à Nereids dans le suivi."
      section.fields = section.fields.filter((f) => f.key === "phone" || f.key === "email")
    }
    setEdit(section)
  }

  /** Bouton crayon seulement si le rôle a le droit de modifier ce bloc */
  /** Admin : ouvre un compte au client après coup (dossier créé sans compte) */
  function inviteClient() {
    if (!d!.client.email) {
      toast.error("E-mail du client manquant", { description: "Ajoutez son e-mail dans la carte Client pour l'inviter." })
      return
    }
    updateDossier(d!.id, (x) => ({ ...x, noClientAccount: undefined, clientAccess: { invitedAt: new Date().toISOString() } }))
    addEvent(d!.id, { kind: "system", author: user.id, title: "Compte client ouvert", body: `Invitation envoyée à ${d!.client.email}` })
    toast.success("Invitation envoyée", { description: `${personneName(d!.client)} peut maintenant suivre son dossier.` })
  }
  const editable = (id: SectionId) => (rights.canEdit(id) ? () => openEdit(id) : undefined)
  // Expertises multiples et convoqués : admin, expert et gestionnaire (CDC v2 : expertise à planifier, convocations)
  const canManageExpertise = role.id === "admin" || role.id === "expert" || (role.id === "gestionnaire" && !rights.telephonieSeule)
  // Parcours d'expertise : mission, voyants M/D/R, programmation — Nereids et gestionnaire (hors Téléphonie seule)
  const manager = role.id === "admin" || (role.id === "gestionnaire" && !rights.telephonieSeule)

  /** Le client indique le lieu de l'expertise (son garage) — à l'activation, ou ici s'il ne l'avait pas encore */
  function lieuSection(): EditSection {
    return {
      title: "Lieu de l'expertise",
      description: "Indiquez le garage où se trouve votre véhicule. L'expert confirmera ce lieu ou en proposera un autre.",
      fields: [
        { key: "nom", label: "Nom du garage", full: true },
        { key: "adresse", label: "Adresse", full: true },
      ],
      initial: { nom: d!.lieuClient?.nom ?? "", adresse: d!.lieuClient?.adresse ?? "" },
      required: ["nom", "adresse"],
      onSave: (v) => {
        const lieu = { nom: v.nom.trim(), adresse: v.adresse.trim(), at: new Date().toISOString() }
        updateDossier(d!.id, (x) => ({ ...x, lieuClient: lieu }))
        addEvent(d!.id, { kind: "expertise", author: user.id, title: "Lieu de l'expertise indiqué par le client", body: `${lieu.nom}, ${lieu.adresse}` })
        toast.success("Lieu de l'expertise enregistré", { description: "L'expert le confirmera ou en proposera un autre." })
      },
    }
  }

  /** Le client indique son garage : il apparaît aussitôt dans les intervenants du dossier, Nereids le contacte */
  function reparateurSection(afterRecours = false): EditSection {
    return {
      title: "Indiquer mon réparateur",
      description: afterRecours
        ? "Votre recours est validé. Indiquez le garage qui réparera votre véhicule : il sera ajouté à votre dossier et Nereids le contactera."
        : "Le garage sera ajouté à votre dossier et Nereids le contactera.",
      ...(afterRecours && { cancelLabel: "Plus tard" }),
      fields: [
        { key: "garage", label: "Nom du garage", full: true },
        { key: "adresse", label: "Adresse", full: true },
        { key: "ville", label: "Ville" },
        { key: "phone", label: "Téléphone", type: "tel" },
      ],
      initial: { garage: "", adresse: "", ville: "", phone: "" },
      required: ["garage"],
      onSave: (v) => {
        const garage: User = {
          id: `u-rep-${Date.now()}`,
          role: "reparateur",
          firstName: "",
          lastName: "",
          email: "",
          phone: v.phone.trim(),
          structure: v.garage.trim(),
          fonction: "",
          address: opt([v.adresse, v.ville].map((x) => x.trim()).filter(Boolean).join(", ")),
        }
        updateDossier(d!.id, (x) => ({
          ...x,
          intervenants: { ...x.intervenants, reparateur: garage.id },
          extraIntervenants: [...(x.extraIntervenants ?? []), garage],
        }))
        addEvent(d!.id, {
          kind: "assignation",
          author: user.id,
          title: "Réparateur indiqué par le client",
          body: [garage.structure, garage.address, garage.phone].filter(Boolean).join(" · "),
        })
        toast.success("Réparateur ajouté à votre dossier", { description: "Nereids va prendre contact avec le garage." })
      },
    }
  }

  /** Le client demande l'ouverture d'un compte pour un intervenant suiveur (avocat…) : Nereids crée le compte */
  function requestSuiveur() {
    setEdit({
      title: "Ajouter un intervenant suiveur",
      description: "Votre avocat ou votre protection juridique pourra suivre le dossier. Nereids créera son accès.",
      fields: [
        { key: "qualite", label: "Qualité", type: "select", options: SUIVEUR_QUALITES.map((q) => ({ value: q, label: q })), full: true },
        { key: "firstName", label: "Prénom" },
        { key: "lastName", label: "Nom" },
        { key: "structure", label: "Cabinet / société", full: true },
        { key: "email", label: "E-mail", type: "email" },
        { key: "phone", label: "Téléphone", type: "tel" },
        { key: "message", label: "Message pour Nereids", type: "textarea" },
      ],
      initial: { qualite: "Avocat", firstName: "", lastName: "", structure: "", email: "", phone: "", message: "" },
      required: ["qualite", "firstName", "lastName", "email"],
      submitLabel: "Envoyer la demande",
      onSave: (v) => {
        const r: SuiveurRequest = {
          id: `sr${Date.now()}`,
          at: new Date().toISOString(),
          requestedBy: user.id,
          qualite: v.qualite,
          firstName: v.firstName.trim(),
          lastName: v.lastName.trim(),
          structure: v.structure.trim(),
          email: v.email.trim(),
          phone: v.phone.trim(),
          message: opt(v.message),
          status: "pending",
        }
        updateDossier(d!.id, (x) => ({ ...x, suiveurRequests: [...(x.suiveurRequests ?? []), r] }))
        addEvent(d!.id, {
          kind: "system",
          author: user.id,
          title: "Demande d'accès pour un intervenant",
          body: [`${r.firstName} ${r.lastName}`, r.qualite, r.structure].filter(Boolean).join(" · "),
        })
        toast.success("Demande envoyée à Nereids", { description: "Vous serez prévenu dès que son accès sera créé." })
      },
    })
  }

  /** L'admin vérifie les infos, crée le compte suiveur et l'ajoute au dossier */
  function createSuiveur(reqId: string) {
    const r = d!.suiveurRequests?.find((x) => x.id === reqId)
    if (!r) return
    setEdit({
      title: "Créer le compte intervenant",
      description: "Il recevra un e-mail pour activer son compte et sera ajouté au dossier.",
      fields: [
        { key: "qualite", label: "Qualité", type: "select", options: SUIVEUR_QUALITES.map((q) => ({ value: q, label: q })), full: true },
        { key: "firstName", label: "Prénom" },
        { key: "lastName", label: "Nom" },
        { key: "structure", label: "Cabinet / société", full: true },
        { key: "email", label: "E-mail", type: "email" },
        { key: "phone", label: "Téléphone", type: "tel" },
      ],
      initial: { qualite: r.qualite, firstName: r.firstName, lastName: r.lastName, structure: r.structure, email: r.email, phone: r.phone },
      required: ["firstName", "lastName", "email"],
      submitLabel: "Créer et inviter",
      onSave: (v) => {
        const userId = `u-s-${r.id}`
        const now = new Date().toISOString()
        updateDossier(d!.id, (x) => ({
          ...x,
          intervenants: { ...x.intervenants, suiveurs: [...x.intervenants.suiveurs, userId] },
          suiveurRequests: (x.suiveurRequests ?? []).map((y) =>
            y.id === reqId
              ? { ...y, qualite: v.qualite, firstName: v.firstName.trim(), lastName: v.lastName.trim(), structure: v.structure.trim(), email: v.email.trim(), phone: v.phone.trim(), status: "created", userId, handledAt: now }
              : y,
          ),
        }))
        addEvent(d!.id, {
          kind: "assignation",
          author: user.id,
          title: "Intervenant ajouté au dossier",
          body: `${v.firstName} ${v.lastName} (${v.qualite}) — invitation envoyée à ${v.email}`,
        })
        toast.success("Compte créé", { description: `Invitation envoyée à ${v.email}. Le client est prévenu.` })
      },
    })
  }

  function refuseSuiveur(reqId: string) {
    const r = d!.suiveurRequests?.find((x) => x.id === reqId)
    if (!r) return
    updateDossier(d!.id, (x) => ({
      ...x,
      suiveurRequests: (x.suiveurRequests ?? []).map((y) => (y.id === reqId ? { ...y, status: "refused", handledAt: new Date().toISOString() } : y)),
    }))
    addEvent(d!.id, { kind: "system", author: user.id, title: "Demande d'accès refusée", body: `${r.firstName} ${r.lastName} (${r.qualite})` })
    toast.success("Demande refusée", { description: "Le client est prévenu dans le suivi." })
  }

  function editDoc(docId: string) {
    const doc = d!.documents.find((x) => x.id === docId)
    if (!doc) return
    setEdit({
      title: "Modifier le document",
      fields: [
        { key: "name", label: "Nom du fichier", full: true },
        { key: "category", label: "Catégorie", type: "select", options: opts(DOC_CATEGORIES), full: true },
        { key: "docDate", label: "Date du document", type: "date" },
      ],
      initial: { name: doc.name, category: doc.category, docDate: toDateInput(docDate(doc)) },
      onSave: (v) =>
        apply("Document", (x) => ({
          ...x,
          documents: x.documents.map((y) => (y.id === docId ? { ...y, name: v.name || y.name, category: (v.category || y.category) as DocCategory, docDate: fromDateInput(v.docDate) ?? y.docDate } : y)),
        })),
    })
  }

  function deleteDoc(docId: string) {
    const doc = d!.documents.find((x) => x.id === docId)
    updateDossier(d!.id, (x) => ({ ...x, documents: x.documents.filter((y) => y.id !== docId) }))
    addEvent(d!.id, { kind: "document", author: user.id, title: "Document supprimé", body: doc?.name })
    toast.success("Document supprimé")
  }

  /** Le suiveur classe le dossier sous sa propre référence (réf. PJ, réf. cabinet) */
  function editOwnRef() {
    setEdit({
      title: "Ma référence",
      description: "Votre référence interne pour ce dossier. Elle n'est visible que par vous et Nereids.",
      fields: [{ key: "ref", label: "Référence", full: true }],
      initial: { ref: d!.suiveurRefs?.[user.id] ?? "" },
      onSave: (v) => {
        updateDossier(d!.id, (x) => {
          const others = Object.fromEntries(Object.entries(x.suiveurRefs ?? {}).filter(([id]) => id !== user.id))
          return { ...x, suiveurRefs: opt(v.ref) ? { ...others, [user.id]: v.ref.trim() } : others }
        })
        toast.success("Référence enregistrée")
      },
    })
  }

  const openDoc = (c?: DocCategory) => {
    setDocCategory(c)
    setDialog("doc")
  }

  const pendingRequests = (d.suiveurRequests ?? []).filter((r) => r.status === "pending")

  const subtype = d.sinistreType ? SINISTRE_TYPES[d.sinistreType].label : d.litigeType ? LITIGE_ASSUR_TYPES[d.litigeType].label : null

  return (
    <>
      {/* En-tête */}
      <div className="mb-5">
        {(() => {
          const toArchives = d.status === "archive" && role.nav.some((n) => n.path === "archives")
          return (
            <Link href={href(toArchives ? "archives" : "dossiers")} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ChevronLeft className="size-4" /> {toArchives ? "Archives" : listLabel}
            </Link>
          )
        })()}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                {/* Le client se repère à son véhicule, pas à son propre nom */}
                {isClient ? `${d.vehicule.marque} ${d.vehicule.modele}` : personneName(d.client)}
              </h1>
              <Immat value={d.vehicule.immat} className="h-7 text-sm" />
              <StatusBadge status={d.status} className="ml-1" />
              {late && showDeadline && <LateBadge days={lateDays(d)} />}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {d.ref} · {DOSSIER_TYPES[d.type].label}
              {subtype && ` — ${subtype}`}
              {!isClient && ` · ${d.vehicule.marque} ${d.vehicule.modele}`} · créé le {formatDate(d.createdAt)}
            </p>
          </div>

          {/* Intervenants (expert compris) : tout télécharger et déposer ses pièces, sans relance ni statut */}
          {!rights.pilot || role.id === "expert" ? (
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button variant="outline" onClick={() => toast.info("Export du dossier complet (ZIP) — simulation")}>
                <Download /> Tout télécharger
              </Button>
              {!closed && rights.docCategories.length > 0 && (
                <Button onClick={() => openDoc()}>
                  <Plus /> Ajouter un document
                </Button>
              )}
            </div>
          ) : (
          <div className="flex shrink-0 flex-wrap gap-2">
            {!closed && (
              <Button variant="outline" onClick={() => setDialog("relance")}>
                <BellRing /> Relancer
              </Button>
            )}
            {rights.changeStatus && (
              <Button variant="outline" onClick={() => setDialog("status")}>
                <Pencil /> Modifier le statut
              </Button>
            )}
            {rights.changeStatus && d.status === "cloture" && (
              <Button onClick={archive}>
                <Archive /> Archiver
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Plus d'actions" />}>
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {rights.assign && (
                  <DropdownMenuItem onClick={() => setDialog("assign")}>
                    <UserPlus /> Assigner les intervenants
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => openDoc()}>
                  <Plus /> Ajouter un document
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast.info("Export du dossier complet (ZIP) — simulation")}>
                  <Download /> Télécharger tout le dossier
                </DropdownMenuItem>
                {rights.close && !closed && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => setDialog("close")}>
                      <Flag /> Clôturer le dossier
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          )}
        </div>

        {/* Repères du dossier : une carte, une colonne étiquetée par sujet */}
        {((!isClient && (d.client.phone || d.client.email)) || rights.pilot || (canSeeNotes && cabinet)) && (
          <div className="mt-4 flex flex-wrap overflow-hidden rounded-xl border bg-card">
            {/* Coordonnées du client à portée de main : un clic copie */}
            {!isClient && (d.client.phone || d.client.email) && (
              <HeaderCell label="Contact client">
                {d.client.phone && <CopyLine icon={Phone} value={d.client.phone} />}
                {d.client.email && <CopyLine icon={Mail} value={d.client.email} />}
              </HeaderCell>
            )}
            {rights.pilot && (
              <>
                <HeaderCell label="Expertise">
                  <ExpertiseBadge dossier={d} />
                </HeaderCell>
                <HeaderCell label="Mission · Devis · Règlement">
                  {manager ? <EditableValidationPills dossier={d} /> : <ValidationPills validation={clientValidation(d)} />}
                </HeaderCell>
              </>
            )}
            {/* Nereids et gestionnaires : cabinet du dossier et abonnement souscrit */}
            {canSeeNotes && cabinet && (
              <HeaderCell label="Cabinet">
                <span className="text-sm font-medium">{cabinet.nom}</span>
                <AbonnementBadge abonnement={cabinet.abonnement} showLabel className="w-fit" />
                {rights.telephonieSeule && <span className="text-xs text-muted-foreground">Consultation et traçage des appels dans le suivi uniquement</span>}
              </HeaderCell>
            )}
          </div>
        )}
      </div>

      {/* Client : dossier pas encore complété depuis l'invitation */}
      {isClient && !d.clientAccess?.submittedAt && d.clientAccess && (
        <Link
          href={`/activation/${d.id}${d.clientAccess.activatedAt ? "?etape=infos" : ""}`}
          className="mb-6 flex items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:border-brand"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand text-primary-foreground [&_svg]:size-5">
            <Mail />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Complétez votre dossier</p>
            <p className="text-sm text-muted-foreground">Vérifiez vos informations et envoyez vos documents.</p>
          </div>
          <span className="text-sm font-semibold text-brand-ink">Compléter</span>
        </Link>
      )}

      {/* Client : lieu de l'expertise pas indiqué à l'activation */}
      {isClient && d.clientAccess?.submittedAt && !d.lieuClient && !closed && !d.expertise.date && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:gap-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand text-primary-foreground [&_svg]:size-5">
            <MapPin />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Indiquez le lieu de l&apos;expertise</p>
            <p className="text-sm text-muted-foreground">Le garage où se trouve votre véhicule, dès que vous le connaissez.</p>
          </div>
          <Button onClick={() => setEdit(lieuSection())}>Indiquer le lieu</Button>
        </div>
      )}

      {/* Prochaine étape du parcours d'expertise (mission, pré-étude, programmation) */}
      <ExpertiseParcoursBanner dossier={d} manager={manager} onAssign={() => setDialog("assign")} onRefused={() => router.push(href("dossiers"))} />

      {/* Admin : demandes d'ouverture de compte intervenant faites par le client */}
      {rights.assign &&
        pendingRequests.map((r) => (
          <SuiveurRequestBanner key={r.id} request={r} onCreate={() => createSuiveur(r.id)} onRefuse={() => refuseSuiveur(r.id)} />
        ))}

      {/* Étapes du dossier — la prochaine action est dans le suivi, le retard dans le tag, les actions en haut */}
      <Progress dossier={d} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Tabs value={tab} onValueChange={(v) => setTab(v as string)} className="min-w-0">
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <TabsList variant="line" className="mb-2">
              <TabsTrigger value="suivi">Suivi <Count n={d.timeline.filter((e) => rights.canSeeEvent(e) && e.kind !== "consultation").length} /></TabsTrigger>
              <TabsTrigger value="general">Général</TabsTrigger>
              <TabsTrigger value="vehicule">Véhicule</TabsTrigger>
              <TabsTrigger value="documents">
                Documents <Count n={d.documents.filter((doc) => docVisibleTo(doc, role.id, d)).length} />
                {d.documents.some((doc) => docVisibleTo(doc, role.id, d) && isNewDoc(doc, user.id)) && <span className="size-2 rounded-full bg-tone-alert" aria-label="Nouveaux documents" />}
              </TabsTrigger>
              <TabsTrigger value="expertise">Expertise</TabsTrigger>
              {d.type === "litige_assurantiel" && <TabsTrigger value="tierce">Tierce expertise</TabsTrigger>}
              {canSeeNotes && (
                <TabsTrigger value="notes">
                  Notes internes {!!d.notes?.length && <Count n={d.notes.length} />}
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          <TabsContent value="suivi">
            <DossierSuivi dossier={d} onEditCloture={editable("cloture")} />
          </TabsContent>
          <TabsContent value="general">
            <General dossier={d} cabinet={cabinet} editable={editable} showAccount={rights.pilot} onInviteClient={rights.pilot && d.status !== "archive" ? inviteClient : undefined} />
          </TabsContent>
          <TabsContent value="vehicule">
            <VehiculeTab dossier={d} canEdit={!!editable("vehicule")} />
          </TabsContent>
          <TabsContent value="documents">
            <Documents
              dossier={d}
              onAdd={(closed && !rights.pilot) || !rights.docCategories.length ? undefined : openDoc}
              canManage={rights.canManageDoc}
              allowed={rights.docCategories}
              onEditDoc={editDoc}
              onDeleteDoc={deleteDoc}
            />
          </TabsContent>
          <TabsContent value="expertise">
            <ExpertiseTab
              dossier={d}
              canManage={canManageExpertise}
              canAdd={manager}
              showPreparation={rights.pilot}
              onEdit={(i) =>
                // Programmer (expertise sans date) : réservé au gestionnaire — l'expert ne fait que proposer
                !allExpertises(d)[i]?.date && !manager
                  ? undefined
                  : i === 0
                    ? editable("expertise")
                    : canManageExpertise
                      ? () => setEdit(expertiseSection(d, i, apply))
                      : undefined
              }
              onAddPv={() => openDoc("pv")}
            />
          </TabsContent>
          <TabsContent value="tierce">
            <TierceTab dossier={d} onAdd={(closed && !rights.pilot) || !rights.docCategories.length ? undefined : openDoc} allowed={rights.docCategories} />
          </TabsContent>
          {canSeeNotes && (
            <TabsContent value="notes">
              <DossierNotes dossier={d} />
            </TabsContent>
          )}
        </Tabs>

        <aside className="flex flex-col gap-4">
          <Intervenants
            dossier={d}
            onAssign={rights.assign ? () => setDialog("assign") : undefined}
            onEditIntervenant={rights.assign ? setEditSlot : undefined}
            onRemoveIntervenant={rights.assign ? setRemoveSlot : undefined}
            onSuggestReparateur={isClient && !closed && !d.intervenants.reparateur ? () => setEdit(reparateurSection()) : undefined}
            pending={pendingRequests}
            onRequestSuiveur={isClient && !closed ? requestSuiveur : undefined}
          />
          <Card size="sm">
            <CardHeader>
              <CardTitle>Références</CardTitle>
              {rights.canEdit("refs") && (
                <CardAction>
                  <EditAction onClick={() => openEdit("refs")} label="Modifier les références" />
                </CardAction>
              )}
            </CardHeader>
            <CardContent>
              <InfoRows
                rows={[
                  ...(rights.ownRef
                    ? [
                        [
                          "Ma référence",
                          <span key="own" className="flex items-center justify-end gap-1">
                            {ownRef ?? <span className="font-normal text-muted-foreground">—</span>}
                            <EditButton onClick={editOwnRef} label="Modifier ma référence" className="-my-1 -mr-1.5 size-6" />
                          </span>,
                        ] as [string, React.ReactNode],
                      ]
                    : []),
                  ["Nereids", d.ref],
                  ["Sinistre", d.refs.sinistre],
                ]}
              />
            </CardContent>
          </Card>
        </aside>
      </div>

      <StatusDialog key={`s-${d.status}`} dossier={d} open={dialog === "status"} onOpenChange={(o) => setDialog(o ? "status" : null)} />
      <CloseDialog dossier={d} open={dialog === "close"} onOpenChange={(o) => setDialog(o ? "close" : null)} />
      <EditIntervenantDialog key={`ei-${JSON.stringify(editSlot)}`} dossier={d} slot={editSlot} onOpenChange={(o) => !o && setEditSlot(null)} />
      <RemoveIntervenantDialog dossier={d} slot={removeSlot} onOpenChange={(o) => !o && setRemoveSlot(null)} />
      <AssignDialog key={`a-${JSON.stringify(d.intervenants)}`} dossier={d} open={dialog === "assign"} onOpenChange={(o) => setDialog(o ? "assign" : null)} />
      <RelanceDialog key={`r-${d.pilotage.attente}`} dossier={d} open={dialog === "relance"} onOpenChange={(o) => setDialog(o ? "relance" : null)} />
      <EditDialog key={edit ? `${edit.title}-${d.updatedAt}` : "none"} section={edit} onOpenChange={(o) => !o && setEdit(null)} />
      <EditDialog key={`rp-${reparateurPrompt}`} section={reparateurPrompt ? reparateurSection(true) : null} onOpenChange={(o) => !o && setReparateurPrompt(false)} />
      <AddDocDialog dossier={d} defaultCategory={docCategory} categories={rights.docCategories} open={dialog === "doc"} onOpenChange={(o) => setDialog(o ? "doc" : null)} />
    </>
  )
}

/** Colonne de la carte d'en-tête ; les séparateurs du bord gauche/haut sont rognés par la carte quand les colonnes passent à la ligne */
function HeaderCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="-mt-px -ml-px flex min-w-[14rem] flex-1 flex-col gap-1.5 border-t border-l px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

function CopyLine({ icon: Icon, value }: { icon: React.ElementType; value: string }) {
  return (
    <button
      type="button"
      title="Copier"
      onClick={() => {
        navigator.clipboard?.writeText(value)
        toast.success("Copié", { description: value })
      }}
      className="group -mx-1.5 inline-flex w-fit max-w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-0.5 text-sm transition-colors hover:bg-muted"
    >
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate font-medium">{value}</span>
      <Copy className="size-3.5 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
    </button>
  )
}

function Count({ n }: { n: number }) {
  return (
    <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-foreground/10 px-1.5 text-[0.7rem] leading-none font-semibold text-foreground tabular-nums">
      {n}
    </span>
  )
}

/**
 * Progression : bandeau bleu clair (couleur du bandeau de page, en aplat) (étape en cours + dernière mise à jour) au-dessus de la frise,
 * un point par étape, toutes nommées. La première étape est calée à gauche, la dernière à droite.
 */
function Progress({ dossier }: { dossier: Dossier }) {
  const steps = WORKFLOW_STEPS[dossier.type]
  const done = isClosedStatus(dossier.status)
  const current = done ? steps.length - 1 : Math.max(0, steps.findIndex((s) => s.statuses.includes(dossier.status)))
  const last = steps.length - 1
  const at = (i: number) => `${(i / last) * 100}%`
  const ref = React.useRef<HTMLDivElement>(null)

  // Si la frise déborde (mobile), on la cale sur l'étape précédente pour voir l'étape en cours et les suivantes
  React.useEffect(() => {
    const el = ref.current
    if (el) el.scrollLeft = (Math.max(0, current - 1) / last) * el.scrollWidth
  }, [current, last])

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-brand/40 bg-brand-soft">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-band px-4 py-2.5 text-sm text-brand-ink">
        {done ? <CircleCheck className="size-4 shrink-0" /> : <CircleDashed className="size-4 shrink-0" />}
        <span className="tabular-nums">{done ? "Terminé" : `Étape ${current + 1}/${steps.length}`}</span>
        <span className="font-semibold">{steps[current].label}</span>
        <span className="ml-auto">Mis à jour le {formatDate(dossier.updatedAt)}</span>
      </div>
      {/* Sur mobile, la frise défile horizontalement plutôt que de tasser les libellés */}
      <div ref={ref} className="overflow-x-auto px-4 pt-4 pb-3 [scrollbar-width:none]">
        <div className="relative mx-3" style={{ minWidth: steps.length * 80 }}>
          <div className="relative h-5">
            <span className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-brand/20" />
            <span className="absolute top-1/2 left-0 h-1.5 -translate-y-1/2 rounded-full bg-brand" style={{ width: at(current) }} />
            {steps.map((s, i) => (
              <span
                key={s.label}
                className={cn(
                  "absolute top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full",
                  i === current && !done
                    ? "size-5 border-4 border-brand bg-card ring-4 ring-brand/25"
                    : i <= current
                      ? "size-4 bg-brand text-primary-foreground"
                      : "size-3 border-2 border-brand/40 bg-card",
                )}
                style={{ left: at(i) }}
              >
                {(i < current || done) && <Check className="size-2.5" strokeWidth={4} />}
              </span>
            ))}
          </div>
          <div className="relative mt-2 h-5 text-xs whitespace-nowrap sm:text-sm">
            {steps.map((s, i) => (
              <span
                key={s.label}
                className={cn(
                  "absolute",
                  i === 0 ? "-left-1.5" : i === last ? "-right-1.5" : "-translate-x-1/2",
                  i === current ? "font-semibold text-brand-ink" : i < current ? "text-foreground" : "text-muted-foreground",
                )}
                style={i === 0 || i === last ? undefined : { left: at(i) }}
              >
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Intervenants({
  dossier,
  onAssign,
  onEditIntervenant,
  onRemoveIntervenant,
  onSuggestReparateur,
  pending,
  onRequestSuiveur,
}: {
  dossier: Dossier
  onAssign?: () => void
  onEditIntervenant?: (s: IntervenantSlot) => void
  onRemoveIntervenant?: (s: IntervenantSlot) => void
  onSuggestReparateur?: () => void
  pending: SuiveurRequest[]
  onRequestSuiveur?: () => void
}) {
  const rows: { label: string; id?: string; ref?: string; slot?: IntervenantSlot }[] = [
    { label: "Gestionnaire", id: dossier.intervenants.gestionnaire, slot: { kind: "gestionnaire" } },
    { label: "Expert", id: dossier.intervenants.expert, slot: { kind: "expert" } },
    { label: "Réparateur", id: dossier.intervenants.reparateur, slot: { kind: "reparateur" } },
    ...(dossier.intervenants.suiveurs.length
      ? dossier.intervenants.suiveurs.map((id) => ({ label: getUser(id)?.fonction || "Suiveur", id, ref: dossier.suiveurRefs?.[id], slot: { kind: "suiveur" as const, id } }))
      : pending.length
        ? []
        : [{ label: "Suiveur", id: undefined, slot: { kind: "suiveur" as const } }]),
  ]
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Intervenants</CardTitle>
        {onAssign && (
          <CardAction>
            <Button size="xs" onClick={onAssign}>
              Assigner
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3">
          <li className="flex items-center gap-3">
            <UserAvatar user={dossier.client} role="client" />
            <div className="min-w-0 text-sm">
              <p className="flex items-center gap-1.5 truncate font-medium">
                {personneName(dossier.client)}
                <RoleBadge role="client" />
              </p>
              <p className="text-xs text-muted-foreground">Client</p>
            </div>
          </li>
          {rows.map((r, i) => {
            const u = getUser(r.id)
            return (
              <li key={i} className="flex items-center gap-3">
                {u ? <UserAvatar user={u} /> : <span className="grid size-7 place-items-center rounded-full border border-dashed"><CircleDashed className="size-3.5 text-muted-foreground" /></span>}
                <div className="min-w-0 flex-1 text-sm">
                  <p className={cn("flex items-center gap-1.5 truncate", u ? "font-medium" : "text-muted-foreground italic")}>
                    {u ? fullName(u) : "Non assigné"}
                    {u && <RoleBadge role={u.role} />}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.label}
                    {u && u.structure !== fullName(u) && ` · ${u.structure}`}
                  </p>
                  {r.ref && <p className="truncate text-xs text-muted-foreground">Réf. {r.ref}</p>}
                </div>
                {!u && r.slot && onEditIntervenant && (
                  <Button variant="ghost" size="icon-xs" className="shrink-0" aria-label={`Ajouter : ${r.label.toLowerCase()}`} title="Ajouter" onClick={() => onEditIntervenant(r.slot!)}>
                    <Plus />
                  </Button>
                )}
                {u && r.slot && onEditIntervenant && onRemoveIntervenant && (
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" className="shrink-0" aria-label={`Actions sur ${fullName(u)}`} />}>
                      <MoreHorizontal />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={() => onEditIntervenant(r.slot!)}>
                        <Pencil /> Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={() => onRemoveIntervenant(r.slot!)}>
                        <Trash2 /> Retirer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </li>
            )
          })}
          {/* Demande d'accès en attente de création par Nereids */}
          {pending.map((r) => (
            <li key={r.id} className="flex items-center gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full border border-dashed border-tone-waiting">
                <Clock className="size-3.5 text-tone-waiting" />
              </span>
              <div className="min-w-0 text-sm">
                <p className="truncate font-medium">
                  {r.firstName} {r.lastName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.qualite} · <span className="font-medium text-tone-waiting">accès en cours de création</span>
                </p>
              </div>
            </li>
          ))}
        </ul>
        {(onSuggestReparateur || onRequestSuiveur) && (
          <div className="mt-4 flex flex-col gap-2">
            {onSuggestReparateur && (
              <Button size="sm" variant="outline" className="w-full" onClick={onSuggestReparateur}>
                <Wrench /> Indiquer mon réparateur
              </Button>
            )}
            {onRequestSuiveur && (
              <Button size="sm" variant="outline" className="w-full" onClick={onRequestSuiveur}>
                <UserPlus /> Ajouter un intervenant suiveur
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SuiveurRequestBanner({ request: r, onCreate, onRefuse }: { request: SuiveurRequest; onCreate: () => void; onRefuse: () => void }) {
  const author = getUser(r.requestedBy)
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:gap-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand text-primary-foreground [&_svg]:size-5">
        <UserPlus />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Demande de compte intervenant</p>
        <p className="text-sm">
          {r.firstName} {r.lastName} · {r.qualite}
          {r.structure && ` · ${r.structure}`}
        </p>
        <p className="text-sm text-muted-foreground">
          {r.email}
          {r.phone && ` · ${r.phone}`} — demandé par {author ? fullName(author) : "le client"} {relativeDays(r.at)}
        </p>
        {r.message && <p className="mt-1 text-sm italic text-muted-foreground">« {r.message} »</p>}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="outline" onClick={onRefuse}>
          Refuser
        </Button>
        <Button onClick={onCreate}>
          <UserCheck /> Créer le compte
        </Button>
      </div>
    </div>
  )
}

function EditButton({ onClick, label, className }: { onClick: () => void; label: string; className?: string }) {
  return (
    <Button size="icon-sm" variant="ghost" aria-label={label} title={label} onClick={onClick} className={className}>
      <Pencil />
    </Button>
  )
}

function InfoCard({ title, rows, onEdit, inline }: { title: string; rows: [string, React.ReactNode][]; onEdit?: () => void; inline?: boolean }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {onEdit && (
          <CardAction>
            <EditAction onClick={onEdit} label={`Modifier — ${title}`} />
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        <InfoRows rows={rows} inline={inline} />
      </CardContent>
    </Card>
  )
}

/** Lignes d'identité d'un client : société + SIRET (personne morale) ou nom (personne physique), puis coordonnées */
function personneRows(p: Personne): [string, React.ReactNode][] {
  return [
    ...(p.kind === "morale"
      ? ([
          ["Société", p.societe],
          ["SIRET", p.siret],
        ] as [string, React.ReactNode][])
      : ([["Nom", personneName(p)]] as [string, React.ReactNode][])),
    ["Téléphone", p.phone],
    ["E-mail", p.email],
    ["Adresse", p.address],
  ]
}

/** Bouton « Modifier » discret dans l'en-tête d'une carte */
function EditAction({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button size="xs" variant="secondary" aria-label={label} onClick={onClick}>
      Modifier
    </Button>
  )
}

/** Lignes libellé / valeur sur fond gris clair (inline : valeur toujours à côté du libellé, même longue) */
function InfoRows({ rows, inline }: { rows: [React.ReactNode, React.ReactNode][]; inline?: boolean }) {
  return (
    <dl className="flex flex-col gap-1 text-sm">
      {rows.map(([k, v], i) => {
        // Texte long (description…) : libellé au-dessus, valeur alignée à gauche
        const long = !inline && typeof v === "string" && v.length > 40
        return (
          <div key={i} className={cn("flex gap-4 rounded-md bg-muted/70 px-3 py-2", long ? "flex-col gap-1" : "items-start justify-between")}>
            <dt className="shrink-0 text-muted-foreground">{k}</dt>
            <dd className={cn("min-w-0 font-medium break-words", !long && "text-right")}>{v || "—"}</dd>
          </div>
        )
      })}
    </dl>
  )
}

const ouiNonNsp = (v?: "oui" | "non" | "nsp") => (v === "oui" ? "Oui" : v === "non" ? "Non" : v === "nsp" ? "Je ne sais pas" : undefined)

function General({
  dossier: d,
  cabinet,
  editable,
  showAccount,
  onInviteClient,
}: {
  dossier: Dossier
  cabinet?: Organisation
  editable: (id: SectionId) => (() => void) | undefined
  showAccount?: boolean
  onInviteClient?: () => void
}) {
  const account: React.ReactNode = d.noClientAccount ? (
    <span className="flex flex-wrap items-center gap-x-2">
      <span className="text-muted-foreground">Pas de compte</span>
      {onInviteClient && (
        <button type="button" className="font-medium text-brand-ink underline-offset-2 hover:underline" onClick={onInviteClient}>
          Inviter le client
        </button>
      )}
    </span>
  ) : d.clientAccess?.activatedAt ? (
    `Actif depuis le ${formatDate(d.clientAccess.activatedAt)}`
  ) : d.clientAccess ? (
    `Invité le ${formatDate(d.clientAccess.invitedAt)} · pas encore activé`
  ) : null
  const expert = getUser(d.intervenants.expert)
  // Honoraires saisis par l'expert dans son formulaire après la pré-étude
  const honoraires = d.proposition && d.proposition.expert === expert?.id ? d.proposition.honoraires : undefined
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <InfoCard
        title="Client"
        rows={[
          ...personneRows(d.client),
          ...(showAccount && account ? [["Compte client", account] as [string, React.ReactNode]] : []),
        ]}
        onEdit={editable("client")}
      />
      <InfoCard
        title="Véhicule"
        rows={[
          ["Marque / modèle", `${d.vehicule.marque} ${d.vehicule.modele}`],
          ["Immatriculation", <Immat key="i" value={d.vehicule.immat} />],
          ["VIN", d.vehicule.vin && <span key="v" className="font-mono text-xs">{d.vehicule.vin}</span>],
          [
            "Propriétaire",
            d.proprietaire ? (
              <span key="p" className="flex flex-col">
                <span>{personneName(d.proprietaire)}</span>
                <span className="text-xs text-muted-foreground">
                  {[d.proprietaire.kind === "morale" && d.proprietaire.siret && `SIRET ${d.proprietaire.siret}`, d.proprietaire.phone, d.proprietaire.email, d.proprietaire.address]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            ) : (
              "Le client"
            ),
          ],
        ]}
        onEdit={editable("vehicule")}
      />
      <PartiesCard
        dossier={d}
        canEdit={!!editable("tiers")}
        onEditSection={(id) => editable(id)}
      />
      <InfoCard
        title="Dossier"
        rows={[
          ["Type", DOSSIER_TYPES[d.type].label],
          ["Qualification", d.sinistreType ? SINISTRE_TYPES[d.sinistreType].label : d.litigeType ? LITIGE_ASSUR_TYPES[d.litigeType].label : "—"],
          ...(d.litigeType === "autre" && d.litigeAutre ? ([["Précision", d.litigeAutre]] as [string, React.ReactNode][]) : []),
          ...(d.objetMission ? ([["Objet de la mission", d.objetMission]] as [string, React.ReactNode][]) : []),
          ...(d.typeMission ? ([["Type de mission", d.typeMission]] as [string, React.ReactNode][]) : []),
          ...(d.objetsPanne?.length
            ? ([["Objet de la panne ou du litige", d.objetsPanne.map((o) => (o === "Autre" && d.panneAutre ? `Autre : ${d.panneAutre}` : o)).join(", ")]] as [string, React.ReactNode][])
            : []),
          ["Créé le", formatDate(d.createdAt)],
          ["Région", d.region],
          ["Département d'intervention", dossierDepartement(d)],
        ]}
        onEdit={editable("dossier")}
      />
      <InfoCard
        title="Description"
        rows={[
          ["Problème", d.description],
          ["Déclaration de la demande client et commentaire de l'expert", d.declaration],
          ["Souhait prioritaire du mandant", d.souhait],
        ]}
        onEdit={editable("description")}
      />
      {d.type === "litige_auto" && d.immobilisation && (
        <InfoCard
          title="Immobilisation"
          rows={[
            ["Véhicule immobilisé", ouiNonNsp(d.immobilisation.immobilise)],
            ["Lieu d'immobilisation", d.immobilisation.lieu],
            ["Frais de gardiennage", ouiNonNsp(d.immobilisation.frais)],
            ["Type de frais", d.immobilisation.typeFrais],
          ]}
        />
      )}
      {showAccount && d.tarif && (
        <InfoCard
          title="Honoraires de la 1re expertise"
          rows={[
            ["Prix", d.tarif.prix !== undefined ? `${eur(d.tarif.prix)} ${d.tarif.mode === "ht" ? "HT" : "TTC"}` : undefined],
            ["Affiché au client", d.tarif.afficher ? "Oui" : "Non"],
            ["Observations sur le tarif", d.tarif.observations],
            ["Signature du mandat", d.tarif.signatureMandat ? "Nécessaire" : "Non nécessaire"],
          ]}
        />
      )}
      <InfoCard
        title="Expert"
        rows={
          expert
            ? [
                ["Nom", fullName(expert)],
                ["Téléphone", expert.phone],
                ["E-mail", expert.email],
                ["Cabinet", cabinet?.nom ?? expert.structure],
                ["Adresse du cabinet", cabinet?.address ?? expert.address],
                ...(honoraires !== undefined ? [["Honoraires", eur(honoraires)] as [string, React.ReactNode]] : []),
              ]
            : [["Expert", <span key="e" className="text-muted-foreground">Pas encore assigné</span>]]
        }
      />
    </div>
  )
}

function Documents({
  dossier: d,
  onAdd,
  canManage,
  allowed,
  onEditDoc,
  onDeleteDoc,
}: {
  dossier: Dossier
  onAdd?: (c?: DocCategory) => void
  canManage: (doc: Dossier["documents"][number]) => boolean
  allowed: DocCategory[]
  onEditDoc: (id: string) => void
  onDeleteDoc: (id: string) => void
}) {
  const { user, role } = useRole()
  const { patchDocs } = useStore()
  const expected = expectedDocs(d.type, d.litigeType, d.sinistreType)
  const missing = expected.filter((c) => !d.documents.some((doc) => doc.category === c))
  // Selon le rôle : documents confidentiels et rapport d'expertise (tant que le règlement n'est pas reçu) masqués
  const visible = d.documents.filter((doc) => docVisibleTo(doc, role.id, d))
  const [section, setSection] = React.useState<"dossier" | "admin">("dossier")
  const inSection = visible.filter((doc) => ADMIN_DOC_CATEGORIES.includes(doc.category) === (section === "admin"))
  // Classement : date du document, de la plus ancienne à la plus récente (ex. carte grise 11/06 avant facture d'entretien 15/06)
  const sorted = [...inSection].sort((a, b) => docDate(a).localeCompare(docDate(b)))
  const [view, setView] = React.useState<"liste" | "galerie">("liste")
  const [selected, setSelected] = React.useState<string[]>([])
  const preview = useDocPreview()
  // Nereids, gestionnaire et expert décident de la confidentialité
  const canSetConfidential = role.id === "admin" || role.id === "gestionnaire" || role.id === "expert"
  const newIds = visible.filter((doc) => isNewDoc(doc, user.id)).map((doc) => doc.id)
  const countOf = (adm: boolean) => visible.filter((doc) => ADMIN_DOC_CATEGORIES.includes(doc.category) === adm).length
  const newIn = (adm: boolean) => visible.filter((doc) => ADMIN_DOC_CATEGORIES.includes(doc.category) === adm && isNewDoc(doc, user.id)).length
  const markSeen = (ids: string[]) => patchDocs(d.id, ids, (doc) => ({ ...doc, seenBy: [...(doc.seenBy ?? []), user.id] }))
  const openDoc = (doc: DocumentItem) => {
    preview.open(doc)
    if (isNewDoc(doc, user.id)) markSeen([doc.id])
  }
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const allChecked = sorted.length > 0 && sorted.every((doc) => selected.includes(doc.id))
  const picked = selected.filter((id) => sorted.some((doc) => doc.id === id))

  function setConfidential(doc: DocumentItem) {
    patchDocs(d.id, [doc.id], (x) => ({ ...x, confidentiel: !x.confidentiel }))
    toast.success(doc.confidentiel ? "Document visible par tous les intervenants" : "Document confidentiel", {
      description: doc.confidentiel ? undefined : "Visible uniquement par Nereids, les gestionnaires, les experts et le client.",
    })
  }

  function actions(doc: Dossier["documents"][number], className?: string) {
    return (
      <div className={cn("relative z-10 flex shrink-0", className)}>
        {canSetConfidential && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={doc.confidentiel ? "Retirer la confidentialité" : "Marquer comme confidentiel"}
            aria-pressed={!!doc.confidentiel}
            title={doc.confidentiel ? "Confidentiel — cliquer pour retirer" : "Marquer comme confidentiel"}
            onClick={() => setConfidential(doc)}
          >
            {doc.confidentiel ? <Lock className="text-tone-alert" /> : <LockOpen className="text-muted-foreground" />}
          </Button>
        )}
        <Button variant="ghost" size="icon-sm" aria-label="Télécharger" onClick={() => toast.info(`Téléchargement de « ${doc.name} » — simulation`)}>
          <Download />
        </Button>
        {canManage(doc) && (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Actions sur le document" />}>
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onEditDoc(doc.id)}>
                <Pencil /> Modifier
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => onDeleteDoc(doc.id)}>
                <Trash2 /> Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    )
  }

  /** Pastilles à côté du nom : nouveau, confidentiel */
  const badges = (doc: DocumentItem) => (
    <>
      {isNewDoc(doc, user.id) && (
        <span className="inline-flex h-5 items-center gap-1 rounded-full bg-tone-alert-bg px-2 text-[0.7rem] font-semibold text-tone-alert">
          <span className="size-1.5 rounded-full bg-tone-alert" /> Nouveau
        </span>
      )}
      {doc.confidentiel && (
        <span className="inline-flex h-5 items-center gap-1 rounded-full bg-muted px-2 text-[0.7rem] font-medium text-foreground">
          <Lock className="size-3" /> Confidentiel
        </span>
      )}
    </>
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Documents du dossier / documents de gestion du dossier (devis, mandats, factures) */}
      <div className="flex rounded-lg border p-0.5 self-start" role="group" aria-label="Type de documents">
        {(
          [
            ["dossier", "Documents du dossier", false],
            ["admin", "Documents administratifs", true],
          ] as const
        ).map(([id, label, adm]) => (
          <Button
            key={id}
            variant="ghost"
            size="sm"
            aria-pressed={section === id}
            onClick={() => {
              setSection(id)
              setSelected([])
            }}
            className={cn(section === id ? "bg-foreground text-background hover:bg-foreground hover:text-background" : "text-muted-foreground")}
          >
            {label}
            <span className="tabular-nums opacity-70">{countOf(adm)}</span>
            {newIn(adm) > 0 && <span className="size-2 rounded-full bg-tone-alert" aria-label="Nouveaux documents" />}
          </Button>
        ))}
      </div>

      {newIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-tone-alert/30 bg-tone-alert-bg/60 px-4 py-2.5 text-sm">
          <span className="size-2 shrink-0 rounded-full bg-tone-alert" />
          <span className="font-medium">
            {newIds.length} nouveau{newIds.length > 1 ? "x" : ""} document{newIds.length > 1 ? "s" : ""} depuis votre dernière visite
          </span>
          <Button size="xs" variant="outline" className="ml-auto bg-background" onClick={() => markSeen(newIds)}>
            Tout marquer comme lu
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          {sorted.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox checked={allChecked} onCheckedChange={(c) => setSelected(c ? sorted.map((doc) => doc.id) : [])} aria-label="Tout sélectionner" />
              {picked.length > 0 ? `${picked.length} sélectionné(s)` : `${sorted.length} document(s)`}
            </label>
          )}
          {sorted.length === 0 && <p className="text-sm text-muted-foreground">0 document</p>}
          <div className="flex rounded-lg border p-0.5" role="group" aria-label="Affichage">
            {(
              [
                ["liste", List, "Liste"],
                ["galerie", LayoutGrid, "Galerie"],
              ] as const
            ).map(([id, Icon, label]) => (
              <Button
                key={id}
                variant="ghost"
                size="icon-xs"
                aria-label={label}
                aria-pressed={view === id}
                onClick={() => setView(id)}
                className={cn(view === id ? "bg-foreground text-background hover:bg-foreground hover:text-background" : "text-muted-foreground")}
              >
                <Icon />
              </Button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          {picked.length > 0 ? (
            <Button variant="outline" size="sm" onClick={() => toast.info(`Téléchargement de ${picked.length} document(s) (ZIP) — simulation`)}>
              <Download /> Télécharger la sélection ({picked.length})
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => toast.info("Téléchargement groupé (ZIP) — simulation")}>
              <Download /> Tout télécharger
            </Button>
          )}
          {onAdd && (
            <Button size="sm" onClick={() => onAdd()}>
              <Plus /> Ajouter un document
            </Button>
          )}
        </div>
      </div>

      {onAdd && section === "dossier" && missing.length > 0 && !isClosedStatus(d.status) && (
        <Card size="sm" className="bg-tone-waiting-bg/50 ring-tone-waiting/20">
          <CardContent>
            <p className="mb-2 text-sm font-medium">Pièces manquantes</p>
            <div className="flex flex-wrap gap-2">
              {missing.filter((c) => allowed.includes(c)).map((c) => (
                <Button key={c} size="xs" variant="outline" className="bg-background" onClick={() => onAdd(c)}>
                  <Plus /> {DOC_CATEGORIES[c]}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {sorted.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Aucun document pour le moment.</p>}

      {sorted.length > 0 && view === "liste" && (
        <ul className="divide-y rounded-xl border bg-card">
          {sorted.map((doc) => {
            const author = getUser(doc.addedBy)
            return (
              <li key={doc.id} className="relative flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                <button type="button" className="absolute inset-0 cursor-pointer" aria-label={`Aperçu de ${doc.name}`} onClick={() => openDoc(doc)} />
                <Checkbox
                  className="relative z-10"
                  checked={selected.includes(doc.id)}
                  onCheckedChange={() => toggle(doc.id)}
                  aria-label={`Sélectionner ${doc.name}`}
                />
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                  <FileText className="size-4 text-muted-foreground" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className={cn("truncate text-sm", isNewDoc(doc, user.id) ? "font-semibold" : "font-medium")}>{doc.name}</span>
                    {badges(doc)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {docLabel(doc)} · <span className="text-foreground">Document du {formatDate(docDate(doc))}</span> · ajouté par{" "}
                    {fullName(author)}
                    {author && <RoleBadge role={author.role} className="mx-1 h-4 align-middle" />}le {formatDateTime(doc.addedAt)} · {doc.size}
                  </p>
                </div>
                {actions(doc)}
              </li>
            )
          })}
        </ul>
      )}

      {sorted.length > 0 && view === "galerie" && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {sorted.map((doc) => {
            return (
              <li key={doc.id} className="group relative flex flex-col overflow-hidden rounded-xl border bg-card">
                <button type="button" className="absolute inset-0 z-[1] cursor-pointer" aria-label={`Aperçu de ${doc.name}`} onClick={() => openDoc(doc)} />
                <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                  <DocThumbnail doc={doc} className="transition-transform duration-200 group-hover:scale-[1.03]" />
                  <Checkbox
                    className="absolute top-2 left-2 z-10 bg-background"
                    checked={selected.includes(doc.id)}
                    onCheckedChange={() => toggle(doc.id)}
                    aria-label={`Sélectionner ${doc.name}`}
                  />
                  {actions(doc, "absolute top-1.5 right-1.5 rounded-lg bg-background/90 shadow-xs")}
                </div>
                <div className="min-w-0 p-3">
                  <p className="truncate text-sm font-medium" title={doc.name}>
                    {doc.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{docLabel(doc)}</p>
                  <p className="text-xs">Document du {formatDate(docDate(doc))}</p>
                  <div className="mt-1 flex flex-wrap gap-1">{badges(doc)}</div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {preview.dialog}
    </div>
  )
}

function ExpertiseTab({
  dossier: d,
  onEdit,
  canManage,
  canAdd,
  showPreparation,
  onAddPv,
}: {
  dossier: Dossier
  /** Pilotage : lieu proposé par le client et formulaire de l'expert */
  showPreparation?: boolean
  /** Ouvre la modification de l'expertise n° index + 1 */
  onEdit: (index: number) => (() => void) | undefined
  /** Admin et expert : ajouter une expertise, la compléter, ajouter des convoqués */
  canManage: boolean
  /** Ajouter / retirer une expertise : réservé au gestionnaire (et Nereids) */
  canAdd: boolean
  onAddPv: () => void
}) {
  const { user, role } = useRole()
  const { updateDossier, addEvent } = useStore()
  const expertises = allExpertises(d)
  const [index, setIndex] = React.useState(0)
  const i = Math.min(index, expertises.length - 1)
  const e = expertises[i]
  // Un PV par expertise, dans l'ordre de dépôt : 1er PV → expertise n°1, 2e PV → n°2…
  const pvs = d.documents.filter((x) => x.category === "pv").sort((a, b) => a.addedAt.localeCompare(b.addedAt))
  const preRapport = d.documents.find((x) => x.category === "pre_rapport")
  const rapport = d.documents.find((x) => x.category === "rapport")
  const sent = e.convoques.length > 0
  const last = i === expertises.length - 1
  // PV attendu à partir du statut « En attente PV » (ou s'il est déjà déposé) ; les expertises précédentes sont passées
  const pvVisible = !last || !!pvs[i] || STATUS_ORDER.indexOf(d.status) >= STATUS_ORDER.indexOf("attente_pv")
  // Préparation en cours (expertise n°1 pas encore programmée) : tout se passe dans le bloc Préparation
  const preparing = i === 0 && !!showPreparation && !e.date && (!!d.lieuClient || !!d.proposition)
  const add = (label: string, onClick?: () => void) =>
    canManage && onClick ? (
      <Button key={label} size="xs" variant="outline" onClick={onClick}>
        <Plus /> Ajouter
      </Button>
    ) : (
      <span className="text-muted-foreground">—</span>
    )

  function addExpertise() {
    const n = expertises.length + 1
    updateDossier(d.id, (x) => ({ ...x, autresExpertises: [...(x.autresExpertises ?? []), { convoques: [], aConvoquer: [] }] }))
    addEvent(d.id, { kind: "expertise", author: user.id, title: `Expertise n°${n} ajoutée` })
    setIndex(n - 1)
    toast.success(`Expertise n°${n} ajoutée`, { description: "Renseignez la date, le lieu et les personnes à convoquer." })
  }

  /** Supprime une expertise ajoutée (par erreur) — la n°1 reste */
  function removeExpertise(k: number) {
    const removed = expertises[k]
    updateDossier(d.id, (x) => ({ ...x, autresExpertises: (x.autresExpertises ?? []).filter((_, j) => j !== k - 1) }))
    addEvent(d.id, { kind: "expertise", author: user.id, title: `Expertise n°${k + 1} supprimée` })
    if (i >= k) setIndex(i - 1)
    toast.success(`Expertise n°${k + 1} supprimée`, {
      action: {
        label: "Annuler",
        onClick: () => {
          updateDossier(d.id, (x) => {
            const list = [...(x.autresExpertises ?? [])]
            list.splice(k - 1, 0, removed)
            return { ...x, autresExpertises: list }
          })
          setIndex(k)
        },
      },
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {(expertises.length > 1 || (canAdd && !preparing)) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {expertises.length > 1 ? (
            <div className="flex rounded-lg border bg-card p-0.5 shadow-xs" role="group" aria-label="Expertises">
              {expertises.map((_, k) => (
                <div key={k} className={cn("flex items-center rounded-md", k === i ? "bg-foreground text-background" : "text-muted-foreground")}>
                  <Button
                    variant="ghost"
                    size="xs"
                    aria-pressed={k === i}
                    onClick={() => setIndex(k)}
                    className={cn(k === i && "hover:bg-transparent hover:text-background", canAdd && k > 0 && k === expertises.length - 1 && "pr-1")}
                  >
                    Expertise n°{k + 1}
                  </Button>
                  {/* Dernière expertise ajoutée (par erreur) : petite croix pour la retirer — la n°1 reste */}
                  {canAdd && k > 0 && k === expertises.length - 1 && (
                    <button
                      type="button"
                      aria-label={`Supprimer l'expertise n°${k + 1}`}
                      title={`Supprimer l'expertise n°${k + 1}`}
                      onClick={() => removeExpertise(k)}
                      className="mr-1 grid size-4 cursor-pointer place-items-center rounded-sm opacity-60 hover:opacity-100"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <span />
          )}
          {canAdd && !preparing && (
            <Button size="sm" onClick={addExpertise}>
              <Plus /> Ajouter une expertise
            </Button>
          )}
        </div>
      )}

      {/* Une fois l'expertise programmée, la préparation laisse place aux blocs ci-dessous */}
      {preparing && <PreparationCard dossier={d} onProgrammer={onEdit(0)} />}

      {preparing ? null : i === 0 && !e.date ? (
        <Card size="sm">
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
            <CalendarDays className="size-6 text-muted-foreground" />
            <p className="font-medium">Expertise non programmée</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {role.id === "expert"
                ? "Le gestionnaire programmera l'expertise à partir de votre proposition."
                : role.id === "admin" || role.id === "gestionnaire"
                  ? "Programmez l'expertise dès que la date et le lieu sont arrêtés. Les participants seront convoqués automatiquement."
                  : "Vous recevrez une convocation dès que la date et le lieu seront fixés."}
            </p>
            {onEdit(0) && (
              <Button size="sm" variant="outline" className="mt-2" onClick={onEdit(0)}>
                <CalendarDays /> Programmer l&apos;expertise
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <InfoCard
              title="Rendez-vous"
              rows={[
                ["Date", e.date ? <span key="d" className="first-letter:uppercase">{formatLongDate(e.date)}</span> : add("date", onEdit(i))],
                ["Lieu", e.lieu ?? add("lieu", onEdit(i))],
                ...(i === 0 && d.proposition ? [["Motif", d.proposition.motif] as [string, React.ReactNode]] : []),
                ["Statut", !e.date ? "À programmer" : e.realisee ? "Réalisée" : `Prévue ${relativeDays(e.date)}`],
                [
                  "Convocation",
                  <span key="c" className="inline-flex items-center gap-1.5">
                    <span className={cn("size-2 rounded-full", sent ? "bg-tone-done" : "bg-muted-foreground/40")} />
                    {sent ? "Envoyée" : "Pas encore envoyée"}
                  </span>,
                ],
              ]}
              onEdit={e.date ? onEdit(i) : undefined}
              inline
            />
            {(pvVisible || last) && (
              <InfoCard
                title="Livrables de l'expert"
                rows={[
                  ...(pvVisible
                    ? [["PV d'expertise", <DocSlot key="p" doc={pvs[i]} category="pv" onAdd={canManage && (i === 0 || !!pvs[i - 1]) ? onAddPv : undefined} />] as [string, React.ReactNode]]
                    : []),
                  // Pré-rapport et rapport : uniquement sur la dernière expertise
                  ...(last && d.type === "litige_auto"
                    ? [["Pré-rapport", <DocSlot key="pr" doc={preRapport} category="pre_rapport" />] as [string, React.ReactNode]]
                    : []),
                  ...(last ? [[d.type === "litige_auto" ? "Rapport final" : "Rapport", <DocSlot key="r" doc={rapport} category="rapport" />] as [string, React.ReactNode]] : []),
                ]}
              />
            )}
          </div>
          <ConvoquesCard dossier={d} index={i} canAdd={canManage} />
        </>
      )}
    </div>
  )
}

/** Livrable attendu : le document s'il est déposé, sinon un bouton d'ajout */
function DocSlot({ doc, category, onAdd }: { doc?: Dossier["documents"][number]; category: DocCategory; onAdd?: (c: DocCategory) => void }) {
  const preview = useDocPreview()
  if (doc)
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        <button type="button" className="flex min-w-0 cursor-pointer items-center gap-1.5 hover:underline" onClick={() => preview.open(doc)}>
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{doc.name}</span>
        </button>
        {preview.dialog}
        <Button variant="ghost" size="icon-xs" aria-label="Télécharger" onClick={() => toast.info(`Téléchargement de « ${doc.name} » — simulation`)}>
          <Download />
        </Button>
      </span>
    )
  return onAdd ? (
    <Button size="xs" variant="outline" onClick={() => onAdd(category)}>
      <Plus /> Ajouter
    </Button>
  ) : (
    <span className="text-muted-foreground">En attente</span>
  )
}

function TierceTab({ dossier: d, onAdd, allowed }: { dossier: Dossier; onAdd?: (c?: DocCategory) => void; allowed: DocCategory[] }) {
  const pv = d.documents.find((x) => x.category === "pv")
  const rapport = d.documents.find((x) => x.category === "rapport")
  const add = (c: DocCategory) => (onAdd && allowed.includes(c) ? onAdd : undefined)
  return (
    <div className="flex flex-col gap-4">
      <InfoCard
        title="Tierce expertise"
        rows={[
          ["Type", d.litigeType === "valeur" ? "Contre-expertise" : d.litigeType === "imputable" ? "Expertise contradictoire" : "À définir par l'expert"],
          ["Expert", fullName(getUser(d.intervenants.expert))],
          ["Date prévue", d.expertise.date ? formatDate(d.expertise.date) : "—"],
          ["Statut", d.status === "nouveau" || d.status === "en_etude" ? "En attente de validation de l'expert" : "En cours"],
          ["Résultat", "—"],
          ["PV", <DocSlot key="pv" doc={pv} category="pv" onAdd={add("pv")} />],
          ["Rapport", <DocSlot key="rapport" doc={rapport} category="rapport" onAdd={add("rapport")} />],
        ]}
      />
    </div>
  )
}

// ─── Blocs modifiables par l'admin ───────────────────────────────────────────

/** Modification d'une expertise (n° index + 1) : date et lieu ; les personnes à convoquer sont rappelées */
export function expertiseSection(d: Dossier, index: number, apply: (title: string, patch: (x: Dossier) => Dossier) => void): EditSection {
  const e = allExpertises(d)[index]
  const n = allExpertises(d).length > 1 ? ` n°${index + 1}` : ""
  const people = expertisePeople(d, index)
  // Lieu proposé par le client (repris par l'expert dans sa proposition s'il y en a une)
  const lieuClient = d.lieuClient ? [d.lieuClient.nom, d.lieuClient.adresse].filter(Boolean).join(", ") : ""
  return {
    title: e.date ? `Modifier l'expertise${n}` : `Programmer l'expertise${n}`,
    size: "sm",
    fields: [
      { key: "date", label: "Date et heure", type: "datetime", full: true },
      { key: "lieu", label: "Lieu", full: true },
    ],
    initial: {
      date: toDateTimeInput(e.date),
      lieu: e.lieu ?? (index === 0 ? (d.proposition?.lieu ?? lieuClient) : ""),
    },
    info: (
      <div className="flex flex-col gap-1.5 text-sm">
        <p className="font-medium">Personnes à convoquer</p>
        {people.length ? (
          <ul className="flex flex-col gap-1">
            {people.map((id) => (
              <li key={id} className="flex items-center gap-2">
                <UserIcon className="size-4 shrink-0 text-muted-foreground" />
                {convoqueName(d, id)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">Aucune personne à convoquer pour l&apos;instant.</p>
        )}
      </div>
    ),
    onSave: (v: Values) =>
      apply(`Expertise${n}`, (x) =>
        setExpertise(x, index, (cur) => ({
          ...cur,
          date: fromDateInput(v.date),
          lieu: opt(v.lieu),
          // Programmer convoque les personnes prévues
          convoques: cur.convoques.length || !v.date ? cur.convoques : expertisePeople(x, index),
        })),
      ),
  }
}

/** Champs d'une personne (client, propriétaire) : physique = prénom / nom, morale = société / SIRET */
function personneFields(hidden: (v: Values) => boolean = () => false): EditField[] {
  const morale = (v: Values) => v.kind === "morale"
  return [
    {
      key: "kind",
      label: "Type de personne",
      type: "select",
      full: true,
      options: [
        { value: "physique", label: "Personne physique" },
        { value: "morale", label: "Personne morale (société)" },
      ],
      hidden,
    },
    {
      key: "civilite",
      label: "Civilité",
      type: "select",
      options: CIVILITES.map((c) => ({ value: c, label: c })),
      hidden: (v) => hidden(v) || morale(v),
    },
    { key: "firstName", label: "Prénom", hidden: (v) => hidden(v) || morale(v) },
    { key: "lastName", label: "Nom", hidden: (v) => hidden(v) || morale(v) },
    { key: "societe", label: "Nom de la société", hidden: (v) => hidden(v) || !morale(v) },
    { key: "siret", label: "N° de SIRET", hidden: (v) => hidden(v) || !morale(v) },
    { key: "phone", label: "Téléphone", type: "tel", hidden },
    { key: "email", label: "E-mail", type: "email", hidden },
    { key: "email2", label: "Deuxième e-mail", type: "email", hidden },
    { key: "address", label: "Adresse postale", full: true, hidden },
  ]
}

function personneInitial(p?: Personne): Values {
  return {
    kind: p?.kind ?? "physique",
    civilite: p?.civilite ?? "",
    firstName: p?.firstName ?? "",
    lastName: p?.lastName ?? "",
    societe: p?.societe ?? "",
    siret: p?.siret ?? "",
    phone: p?.phone ?? "",
    email: p?.email ?? "",
    email2: p?.email2 ?? "",
    address: p?.address ?? "",
  }
}

function personneFromValues(v: Values): Personne {
  const morale = v.kind === "morale"
  return {
    kind: morale ? "morale" : undefined,
    civilite: morale ? undefined : opt(v.civilite ?? ""),
    firstName: morale ? "" : v.firstName,
    lastName: morale ? "" : v.lastName,
    societe: morale ? opt(v.societe) : undefined,
    siret: morale ? opt(v.siret) : undefined,
    phone: v.phone,
    email: v.email,
    email2: opt(v.email2 ?? ""),
    address: opt(v.address),
  }
}

function buildSection(id: SectionId, d: Dossier, apply: (title: string, patch: (x: Dossier) => Dossier) => void): EditSection {
  const save = (title: string, patch: (x: Dossier, v: Values) => Dossier) => (v: Values) => apply(title, (x) => patch(x, v))

  switch (id) {
    case "client":
      return {
        title: "Modifier le client",
        fields: personneFields(),
        initial: personneInitial(d.client),
        onSave: save("Client", (x, v) => ({ ...x, client: { ...x.client, ...personneFromValues(v) } })),
      }
    case "vehicule":
      return {
        title: "Modifier le véhicule",
        fields: [
          { key: "marque", label: "Marque" },
          { key: "modele", label: "Modèle" },
          { key: "immat", label: "Immatriculation" },
          { key: "vin", label: "VIN" },
          {
            key: "proprio",
            label: "Propriétaire du véhicule",
            type: "select",
            full: true,
            options: [
              { value: "client", label: "Le client" },
              { value: "autre", label: "Une autre personne" },
            ],
          },
          ...personneFields((v) => v.proprio !== "autre"),
        ],
        initial: {
          marque: d.vehicule.marque,
          modele: d.vehicule.modele,
          immat: d.vehicule.immat,
          vin: d.vehicule.vin ?? "",
          proprio: d.proprietaire ? "autre" : "client",
          ...personneInitial(d.proprietaire),
        },
        onSave: save("Véhicule", (x, v) => ({
          ...x,
          vehicule: { marque: v.marque, modele: v.modele, immat: v.immat.toUpperCase(), vin: opt(v.vin) },
          proprietaire: v.proprio === "autre" ? personneFromValues(v) : undefined,
        })),
      }
    case "compagnie":
      return {
        title: `Modifier — ${compagnieLabel(d.type)}`,
        fields: [
          { key: "nom", label: "Nom", full: true },
          { key: "phone", label: "Téléphone", type: "tel" },
          { key: "email", label: "E-mail", type: "email" },
          { key: "address", label: "Adresse postale", full: true },
          { key: "reference", label: "Référence" },
        ],
        initial: {
          nom: d.compagnie?.nom ?? "",
          phone: d.compagnie?.phone ?? "",
          email: d.compagnie?.email ?? "",
          address: d.compagnie?.address ?? "",
          reference: d.compagnie?.reference ?? "",
        },
        onSave: save(compagnieLabel(d.type), (x, v) => ({
          ...x,
          compagnie: Object.values(v).some((s) => opt(s))
            ? { nom: v.nom, phone: opt(v.phone), email: opt(v.email), address: opt(v.address), reference: opt(v.reference) }
            : undefined,
        })),
      }
    case "cabinet":
      return {
        title: "Modifier — Cabinet d'expertise visé",
        fields: [
          { key: "nom", label: "Nom", full: true },
          { key: "phone", label: "Téléphone", type: "tel" },
          { key: "email", label: "E-mail", type: "email" },
          { key: "address", label: "Adresse postale", full: true },
          { key: "reference", label: "Référence" },
        ],
        initial: {
          nom: d.cabinetVise?.nom ?? "",
          phone: d.cabinetVise?.phone ?? "",
          email: d.cabinetVise?.email ?? "",
          address: d.cabinetVise?.address ?? "",
          reference: d.cabinetVise?.reference ?? "",
        },
        onSave: save("Cabinet d'expertise visé", (x, v) => ({
          ...x,
          cabinetVise: Object.values(v).some((t) => opt(t))
            ? { nom: v.nom, phone: opt(v.phone), email: opt(v.email), address: opt(v.address), reference: opt(v.reference) }
            : undefined,
        })),
      }
    case "dossier":
      return {
        title: "Modifier le dossier",
        fields: [
          { key: "type", label: "Type", type: "select", options: opts(DOSSIER_TYPES) },
          {
            key: "sinistreType",
            label: "Qualification",
            type: "select",
            options: opts(SINISTRE_TYPES),
            hidden: (v) => v.type !== "sinistre",
          },
          {
            key: "litigeType",
            label: "Qualification",
            type: "select",
            options: opts(LITIGE_ASSUR_TYPES),
            hidden: (v) => v.type !== "litige_assurantiel",
          },
          { key: "region", label: "Région", type: "select", options: REGIONS.map((r) => ({ value: r, label: r })) },
          {
            key: "departement",
            label: "Département d'intervention",
            type: "select",
            options: (v) => (REGION_DEPARTEMENTS[v.region] ?? []).map((dep) => ({ value: dep, label: dep })),
          },
          { key: "createdAt", label: "Créé le", type: "date" },
        ],
        initial: {
          type: d.type,
          sinistreType: d.sinistreType ?? "",
          litigeType: d.litigeType ?? "",
          region: d.region,
          departement: dossierDepartement(d) ?? "",
          createdAt: toDateInput(d.createdAt),
        },
        onSave: save("Dossier", (x, v) => ({
          ...x,
          type: v.type as DossierType,
          sinistreType: v.type === "sinistre" ? ((opt(v.sinistreType) as SinistreType) ?? undefined) : undefined,
          litigeType: v.type === "litige_assurantiel" ? ((opt(v.litigeType) as LitigeAssurantielType) ?? undefined) : undefined,
          region: v.region,
          // Département hors de la région choisie : on l'efface
          departement: REGION_DEPARTEMENTS[v.region]?.includes(v.departement) ? v.departement : undefined,
          createdAt: fromDateInput(v.createdAt) ?? x.createdAt,
        })),
      }
    case "tiers":
      return {
        title: "Modifier les tiers",
        fields: [{ key: "tiers", label: "Tiers", type: "textarea", hint: "Un tiers par ligne : Nom · téléphone · e-mail" }],
        initial: { tiers: (d.tiers ?? []).map((t) => [t.nom, t.phone ?? "", t.email ?? ""].join(" · ").replace(/( · )+$/, "")).join("\n") },
        onSave: save("Tiers", (x, v) => ({
          ...x,
          tiers: v.tiers
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)
            .map((l) => {
              const [nom, phone, email] = l.split("·").map((p) => p.trim())
              return { nom, phone: opt(phone ?? ""), email: opt(email ?? "") }
            }),
        })),
      }
    case "description":
      return {
        title: "Modifier la description",
        fields: [
          { key: "description", label: "Problème", type: "textarea" },
          { key: "declaration", label: "Déclaration de la demande client et commentaire de l'expert", type: "textarea" },
          { key: "souhait", label: "Souhait prioritaire du mandant", type: "textarea" },
        ],
        initial: { description: d.description ?? "", declaration: d.declaration ?? "", souhait: d.souhait ?? "" },
        onSave: save("Description", (x, v) => ({ ...x, description: opt(v.description), declaration: opt(v.declaration), souhait: opt(v.souhait) })),
      }
    case "refs":
      return {
        title: "Modifier les références",
        fields: [
          { key: "ref", label: "Réf. Nereids" },
          { key: "sinistre", label: "Réf. sinistre" },
        ],
        initial: { ref: d.ref, sinistre: d.refs.sinistre ?? "" },
        onSave: save("Références", (x, v) => ({
          ...x,
          ref: opt(v.ref) ?? x.ref,
          refs: { sinistre: opt(v.sinistre) },
        })),
      }
    case "expertise":
      return expertiseSection(d, 0, apply)
    case "cloture":
      return {
        title: "Modifier la clôture",
        fields: [
          { key: "motif", label: "Motif", type: "select", options: CLOSING_REASONS.map((m) => ({ value: m, label: m })) },
          { key: "at", label: "Clôturé le", type: "date" },
          { key: "commentaire", label: "Commentaire", type: "textarea" },
        ],
        initial: { motif: d.cloture?.motif ?? "", at: toDateInput(d.cloture?.at), commentaire: d.cloture?.commentaire ?? "" },
        onSave: save("Clôture", (x, v) => ({
          ...x,
          cloture: { motif: v.motif, commentaire: opt(v.commentaire), at: fromDateInput(v.at) ?? x.cloture?.at ?? new Date().toISOString() },
        })),
      }
  }
}
