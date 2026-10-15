"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  Archive,
  BellRing,
  CalendarDays,
  Check,
  ChevronLeft,
  CircleDashed,
  Clock,
  Copy,
  Download,
  FileText,
  Flag,
  Image as ImageIcon,
  LayoutGrid,
  List,
  Mail,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Trash2,
  UserCheck,
  UserPlus,
  Wrench,
} from "lucide-react"

import { useRole } from "@/components/app-shell/role-context"
import { Immat } from "@/components/immat"
import { ExpertiseBadge, LateBadge, StatusBadge, ValidationPills } from "@/components/status-badge"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  CLOSING_REASONS,
  DOC_CATEGORIES,
  DOSSIER_TYPES,
  LITIGE_ASSUR_TYPES,
  REGIONS,
  SINISTRE_TYPES,
  SUIVEUR_QUALITES,
  WORKFLOW_STEPS,
  clientValidation,
  compagnieLabel,
  convocationSent,
  defaultConvoques,
  docDate,
  expectedDocs,
  fullName,
  getUser,
  isLate,
  lateDays,
  type DocCategory,
  type Dossier,
  type DossierType,
  type LitigeAssurantielType,
  type SinistreType,
  type SuiveurRequest,
} from "@/lib/data"
import { dossierRights, visibleDossiers } from "@/lib/access"
import { formatDate, formatDateTime, formatLongDate, relativeDays } from "@/lib/format"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { AddDocDialog, AssignDialog, CloseDialog, RelanceDialog, StatusDialog } from "./dossier-dialogs"
import { EditDialog, fromDateInput, opt, toDateInput, toDateTimeInput, type EditSection, type Values } from "./dossier-edit"
import { DossierNotes } from "./dossier-notes"
import { DossierSuivi } from "./dossier-suivi"
import { ConvoquesCard } from "./expertise-convoques"

type DialogId = "status" | "close" | "assign" | "relance" | "doc" | null

export type SectionId = "client" | "vehicule" | "compagnie" | "dossier" | "tiers" | "description" | "refs" | "expertise" | "cloture"

const opts = <T extends string>(rec: Record<T, string | { label: string }>) =>
  (Object.entries(rec) as [T, string | { label: string }][]).map(([value, l]) => ({ value, label: typeof l === "string" ? l : l.label }))

export function DossierDetail({ id }: { id: string }) {
  const { href, user, role } = useRole()
  const { getDossier, updateDossier, addEvent, logConsultation } = useStore()
  const rights = dossierRights(role.id, user.id)
  const isClient = role.id === "client"
  const listLabel = role.nav.find((n) => n.path === "dossiers")?.label ?? "Dossiers"
  const found = getDossier(id)
  // Un rôle restreint n'ouvre que les dossiers qui le concernent
  const d = found && visibleDossiers([found], role.id, user.id).length ? found : undefined
  const [dialog, setDialog] = React.useState<DialogId>(null)
  const [docCategory, setDocCategory] = React.useState<DocCategory | undefined>()
  const [tab, setTab] = React.useState("suivi")
  const [edit, setEdit] = React.useState<EditSection | null>(null)
  // Les visites des intervenants et du client sont tracées dans le suivi (visibles par Nereids, qui n'est pas tracé)
  const trackVisit = !!d && role.id !== "admin"

  React.useEffect(() => {
    if (trackVisit) logConsultation(id, user.id)
  }, [trackVisit, id, user.id, logConsultation])

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

  const closed = d.status === "cloture" || d.status === "archive"
  const late = isLate(d)
  // L'admin, c'est Nereids : « Nereids doit agir » = c'est à lui
  const yourTurn = !closed && (d.pilotage.quiDoitAgir === role.id || (role.id === "admin" && d.pilotage.quiDoitAgir === "nereids"))
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
    toast.success("Invitation envoyée", { description: `${d!.client.firstName} ${d!.client.lastName} peut maintenant suivre son dossier.` })
  }
  const editable = (id: SectionId) => (rights.canEdit(id) ? () => openEdit(id) : undefined)

  /** Le client indique son garage : message à Nereids, qui l'ajoute comme intervenant */
  function suggestReparateur() {
    setEdit({
      title: "Indiquer mon réparateur",
      description: "Nereids contactera le garage et l'ajoutera à votre dossier.",
      fields: [
        { key: "garage", label: "Nom du garage", full: true },
        { key: "ville", label: "Ville" },
        { key: "phone", label: "Téléphone", type: "tel" },
      ],
      initial: { garage: "", ville: "", phone: "" },
      onSave: (v) => {
        if (!v.garage.trim()) return
        addEvent(d!.id, {
          kind: "message",
          author: user.id,
          title: "Message",
          body: `Mon réparateur : ${[v.garage, v.ville, v.phone].filter((x) => x.trim()).join(" · ")}`,
          recipients: ["admin"],
        })
        toast.success("Réparateur transmis à Nereids")
      },
    })
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
                {isClient ? `${d.vehicule.marque} ${d.vehicule.modele}` : `${d.client.firstName} ${d.client.lastName}`}
              </h1>
              <Immat value={d.vehicule.immat} className="h-7 text-sm" />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {d.ref} · {DOSSIER_TYPES[d.type].label}
              {subtype && ` — ${subtype}`}
              {!isClient && ` · ${d.vehicule.marque} ${d.vehicule.modele}`} · créé le {formatDate(d.createdAt)}
            </p>
            {/* Coordonnées du client à portée de main : un clic copie */}
            {!isClient && (d.client.phone || d.client.email) && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {d.client.phone && <CopyChip icon={Phone} value={d.client.phone} />}
                {d.client.email && <CopyChip icon={Mail} value={d.client.email} />}
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={d.status} />
              {late && showDeadline && <LateBadge days={lateDays(d)} />}
              {rights.pilot && (
                <>
                  <span className="mx-1 h-4 w-px bg-border" aria-hidden />
                  <ValidationPills validation={clientValidation(d)} />
                  <ExpertiseBadge dossier={d} className="max-w-md min-w-56 flex-1" />
                </>
              )}
            </div>
          </div>

          {!rights.pilot ? (
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button variant="outline" onClick={() => toast.info("Export du dossier complet (ZIP) — simulation")}>
                <Download /> Tout télécharger
              </Button>
              {!closed && (
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
            <Button variant="outline" onClick={() => setDialog("status")}>
              <Pencil /> Modifier le statut
            </Button>
            {d.status === "cloture" && (
              <Button onClick={archive}>
                <Archive /> Archiver
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Plus d'actions" />}>
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => setDialog("assign")}>
                  <UserPlus /> Assigner les intervenants
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openDoc()}>
                  <Plus /> Ajouter un document
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast.info("Export du dossier complet (ZIP) — simulation")}>
                  <Download /> Télécharger tout le dossier
                </DropdownMenuItem>
                {!closed && (
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
      </div>

      {/* Client : dossier pas encore complété depuis l'invitation */}
      {isClient && !d.clientAccess?.submittedAt && d.clientAccess && (
        <Link
          href={`/activation/${d.id}${d.clientAccess.activatedAt ? "?etape=infos" : ""}`}
          className="mb-6 flex items-center gap-4 rounded-xl border border-brand/30 bg-brand-soft p-4 transition-colors hover:border-brand"
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

      {/* Admin : demandes d'ouverture de compte intervenant faites par le client */}
      {rights.pilot &&
        pendingRequests.map((r) => (
          <SuiveurRequestBanner key={r.id} request={r} onCreate={() => createSuiveur(r.id)} onRefuse={() => refuseSuiveur(r.id)} />
        ))}

      {/* Étapes du dossier — la prochaine action est dans le suivi, le retard dans le tag, les actions en haut */}
      <Card size="sm" className="mb-6 border-brand/30 bg-brand-soft">
        <CardContent>
          <Progress dossier={d} />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Tabs value={tab} onValueChange={(v) => setTab(v as string)} className="min-w-0">
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <TabsList variant="line" className="mb-2">
              <TabsTrigger value="suivi">Suivi <Count n={d.timeline.filter((e) => rights.canSeeEvent(e) && e.kind !== "consultation").length} /></TabsTrigger>
              <TabsTrigger value="general">Général</TabsTrigger>
              <TabsTrigger value="documents">Documents <Count n={d.documents.length} /></TabsTrigger>
              <TabsTrigger value="expertise">Expertise</TabsTrigger>
              {d.type === "litige_assurantiel" && <TabsTrigger value="tierce">Tierce expertise</TabsTrigger>}
              <TabsTrigger value="resolution">Résolution</TabsTrigger>
              {role.id === "admin" && (
                <TabsTrigger value="notes">
                  Notes internes {!!d.notes?.length && <Count n={d.notes.length} />}
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          <TabsContent value="suivi">
            <DossierSuivi dossier={d} />
          </TabsContent>
          <TabsContent value="general">
            <General dossier={d} editable={editable} showAccount={rights.pilot} onInviteClient={rights.pilot && d.status !== "archive" ? inviteClient : undefined} />
          </TabsContent>
          <TabsContent value="documents">
            <Documents
              dossier={d}
              onAdd={closed && !rights.pilot ? undefined : openDoc}
              canManage={rights.canManageDoc}
              allowed={rights.docCategories}
              onEditDoc={editDoc}
              onDeleteDoc={deleteDoc}
            />
          </TabsContent>
          <TabsContent value="expertise">
            <ExpertiseTab dossier={d} onEdit={editable("expertise")} />
          </TabsContent>
          <TabsContent value="tierce">
            <TierceTab dossier={d} onAdd={closed && !rights.pilot ? undefined : openDoc} allowed={rights.docCategories} />
          </TabsContent>
          <TabsContent value="resolution">
            <Resolution dossier={d} onClose={rights.pilot ? () => setDialog("close") : undefined} onEdit={editable("cloture")} />
          </TabsContent>
          {role.id === "admin" && (
            <TabsContent value="notes">
              <DossierNotes dossier={d} />
            </TabsContent>
          )}
        </Tabs>

        <aside className="flex flex-col gap-4">
          <Intervenants
            dossier={d}
            onAssign={rights.pilot ? () => setDialog("assign") : undefined}
            onSuggestReparateur={isClient && !closed && !d.intervenants.reparateur ? suggestReparateur : undefined}
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
                  ["Interne", d.refs.interne],
                  ["Expert", d.refs.expert],
                ]}
              />
            </CardContent>
          </Card>
        </aside>
      </div>

      <StatusDialog key={`s-${d.status}`} dossier={d} open={dialog === "status"} onOpenChange={(o) => setDialog(o ? "status" : null)} />
      <CloseDialog dossier={d} open={dialog === "close"} onOpenChange={(o) => setDialog(o ? "close" : null)} />
      <AssignDialog key={`a-${JSON.stringify(d.intervenants)}`} dossier={d} open={dialog === "assign"} onOpenChange={(o) => setDialog(o ? "assign" : null)} />
      <RelanceDialog key={`r-${d.pilotage.attente}`} dossier={d} open={dialog === "relance"} onOpenChange={(o) => setDialog(o ? "relance" : null)} />
      <EditDialog key={edit ? `${edit.title}-${d.updatedAt}` : "none"} section={edit} onOpenChange={(o) => !o && setEdit(null)} />
      <AddDocDialog dossier={d} defaultCategory={docCategory} categories={rights.docCategories} open={dialog === "doc"} onOpenChange={(o) => setDialog(o ? "doc" : null)} />
    </>
  )
}

function CopyChip({ icon: Icon, value }: { icon: React.ElementType; value: string }) {
  return (
    <button
      type="button"
      title="Copier"
      onClick={() => {
        navigator.clipboard?.writeText(value)
        toast.success("Copié", { description: value })
      }}
      className="group inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border bg-card px-2 text-sm transition-colors hover:border-foreground/30 hover:bg-muted/60"
    >
      <Icon className="size-3.5 text-muted-foreground" />
      <span className="font-medium">{value}</span>
      <Copy className="size-3.5 text-muted-foreground transition-colors group-hover:text-foreground" />
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
 * Progression fine : un point par étape, toutes nommées, l'étape en cours en gras.
 * La première étape est calée à gauche, la dernière à droite.
 */
function Progress({ dossier }: { dossier: Dossier }) {
  const steps = WORKFLOW_STEPS[dossier.type]
  const done = dossier.status === "cloture" || dossier.status === "archive"
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
    <div>
      <p className="mb-3 flex items-baseline gap-2 text-sm">
        <span className="font-semibold text-brand-ink tabular-nums">
          {done ? "Terminé" : `Étape ${current + 1}/${steps.length}`}
        </span>
        <span className="font-semibold">{steps[current].label}</span>
      </p>
      {/* Sur mobile, la frise défile horizontalement plutôt que de tasser les libellés */}
      <div ref={ref} className="-mx-4 overflow-x-auto px-4 pt-1 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
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
  onSuggestReparateur,
  pending,
  onRequestSuiveur,
}: {
  dossier: Dossier
  onAssign?: () => void
  onSuggestReparateur?: () => void
  pending: SuiveurRequest[]
  onRequestSuiveur?: () => void
}) {
  const rows: { label: string; id?: string; ref?: string }[] = [
    { label: "Gestionnaire", id: dossier.intervenants.gestionnaire },
    { label: "Expert", id: dossier.intervenants.expert },
    { label: "Réparateur", id: dossier.intervenants.reparateur },
    ...(dossier.intervenants.suiveurs.length
      ? dossier.intervenants.suiveurs.map((id) => ({ label: getUser(id)?.fonction || "Suiveur", id, ref: dossier.suiveurRefs?.[id] }))
      : pending.length
        ? []
        : [{ label: "Suiveur", id: undefined }]),
  ]
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Intervenants</CardTitle>
        {onAssign && (
          <CardAction>
            <Button size="xs" variant="outline" onClick={onAssign}>
              Assigner
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3">
          <li className="flex items-center gap-3">
            <UserAvatar user={dossier.client} />
            <div className="min-w-0 text-sm">
              <p className="truncate font-medium">
                {dossier.client.firstName} {dossier.client.lastName}
              </p>
              <p className="text-xs text-muted-foreground">Client</p>
            </div>
          </li>
          {rows.map((r, i) => {
            const u = getUser(r.id)
            return (
              <li key={i} className="flex items-center gap-3">
                {u ? <UserAvatar user={u} /> : <span className="grid size-7 place-items-center rounded-full border border-dashed"><CircleDashed className="size-3.5 text-muted-foreground" /></span>}
                <div className="min-w-0 text-sm">
                  <p className={cn("truncate", u ? "font-medium" : "text-muted-foreground italic")}>{u ? fullName(u) : "Non assigné"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.label}
                    {u && ` · ${u.structure}`}
                  </p>
                  {r.ref && <p className="truncate text-xs text-muted-foreground">Réf. {r.ref}</p>}
                </div>
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
    <div className="mb-6 flex flex-col gap-3 rounded-xl border border-brand/30 bg-brand-soft p-4 sm:flex-row sm:items-center sm:gap-4">
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

function InfoCard({ title, rows, onEdit }: { title: string; rows: [string, React.ReactNode][]; onEdit?: () => void }) {
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
        <InfoRows rows={rows} />
      </CardContent>
    </Card>
  )
}

/** Bouton « Modifier » discret dans l'en-tête d'une carte */
function EditAction({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button size="xs" variant="secondary" aria-label={label} onClick={onClick}>
      Modifier
    </Button>
  )
}

/** Lignes libellé / valeur sur fond gris clair */
function InfoRows({ rows }: { rows: [React.ReactNode, React.ReactNode][] }) {
  return (
    <dl className="flex flex-col gap-1 text-sm">
      {rows.map(([k, v], i) => {
        // Texte long (description…) : libellé au-dessus, valeur alignée à gauche
        const long = typeof v === "string" && v.length > 40
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

function General({
  dossier: d,
  editable,
  showAccount,
  onInviteClient,
}: {
  dossier: Dossier
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
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <InfoCard
        title="Client"
        rows={[
          ["Nom", `${d.client.firstName} ${d.client.lastName}`],
          ["Téléphone", d.client.phone],
          ["E-mail", d.client.email],
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
        ]}
        onEdit={editable("vehicule")}
      />
      <InfoCard
        title={compagnieLabel(d.type)}
        rows={[
          ["Nom", d.compagnie?.nom],
          ["E-mail", d.compagnie?.email],
          ["Référence", d.compagnie?.reference],
        ]}
        onEdit={editable("compagnie")}
      />
      <InfoCard
        title="Dossier"
        rows={[
          ["Type", DOSSIER_TYPES[d.type].label],
          ["Qualification", d.sinistreType ? SINISTRE_TYPES[d.sinistreType].label : d.litigeType ? LITIGE_ASSUR_TYPES[d.litigeType].label : "—"],
          ["Créé le", formatDate(d.createdAt)],
          ["Région", d.region],
        ]}
        onEdit={editable("dossier")}
      />
      <InfoCard
        title="Tiers"
        rows={d.tiers?.length ? d.tiers.map((t, i) => [`Tiers ${i + 1}`, [t.nom, t.phone, t.email].filter(Boolean).join(" · ")]) : [["Tiers", null]]}
        onEdit={editable("tiers")}
      />
      <InfoCard title="Description" rows={[["Problème", d.description]]} onEdit={editable("description")} />
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
  const expected = expectedDocs(d.type, d.litigeType)
  const missing = expected.filter((c) => !d.documents.some((doc) => doc.category === c))
  // Classement : date du document, de la plus ancienne à la plus récente (ex. carte grise 11/06 avant facture d'entretien 15/06)
  const sorted = [...d.documents].sort((a, b) => docDate(a).localeCompare(docDate(b)))
  const [view, setView] = React.useState<"liste" | "galerie">("liste")

  function actions(doc: Dossier["documents"][number], className?: string) {
    return (
      <div className={cn("flex shrink-0", className)}>
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">{d.documents.length} document(s)</p>
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
          <Button variant="outline" size="sm" onClick={() => toast.info("Téléchargement groupé (ZIP) — simulation")}>
            <Download /> Tout télécharger
          </Button>
          {onAdd && (
            <Button size="sm" onClick={() => onAdd()}>
              <Plus /> Ajouter un document
            </Button>
          )}
        </div>
      </div>

      {onAdd && missing.length > 0 && d.status !== "cloture" && d.status !== "archive" && (
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

      {d.documents.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Aucun document pour le moment.</p>}

      {d.documents.length > 0 && view === "liste" && (
        <ul className="divide-y rounded-xl border bg-card">
          {sorted.map((doc) => {
            const author = getUser(doc.addedBy)
            return (
              <li key={doc.id} className="flex items-center gap-3 px-4 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                  <FileText className="size-4 text-muted-foreground" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {DOC_CATEGORIES[doc.category]} · <span className="text-foreground">Document du {formatDate(docDate(doc))}</span> · ajouté par{" "}
                    {fullName(author)} le {formatDateTime(doc.addedAt)} · {doc.size}
                  </p>
                </div>
                {actions(doc)}
              </li>
            )
          })}
        </ul>
      )}

      {d.documents.length > 0 && view === "galerie" && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {sorted.map((doc) => {
            const Icon = doc.category === "photos" ? ImageIcon : FileText
            return (
              <li key={doc.id} className="flex flex-col overflow-hidden rounded-xl border bg-card">
                <div className="relative grid aspect-[4/3] place-items-center bg-muted">
                  <Icon className="size-8 text-muted-foreground" />
                  {actions(doc, "absolute top-1.5 right-1.5 rounded-lg bg-background/90 shadow-xs")}
                </div>
                <div className="min-w-0 p-3">
                  <p className="truncate text-sm font-medium" title={doc.name}>
                    {doc.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{DOC_CATEGORIES[doc.category]}</p>
                  <p className="text-xs">Document du {formatDate(docDate(doc))}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function ExpertiseTab({ dossier: d, onEdit }: { dossier: Dossier; onEdit?: () => void }) {
  const pv = d.documents.find((x) => x.category === "pv")
  const preRapport = d.documents.find((x) => x.category === "pre_rapport")
  const rapport = d.documents.find((x) => x.category === "rapport")
  if (!d.expertise.date) {
    return (
      <Card size="sm">
        <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
          <CalendarDays className="size-6 text-muted-foreground" />
          <p className="font-medium">Expertise non programmée</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            L&apos;expert assigné proposera une date et un lieu. Les participants seront convoqués automatiquement.
          </p>
          {onEdit && (
            <Button size="sm" variant="outline" className="mt-2" onClick={onEdit}>
              <CalendarDays /> Programmer l&apos;expertise
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <InfoCard
          title="Rendez-vous"
          rows={[
            ["Date", <span key="d" className="first-letter:uppercase">{formatLongDate(d.expertise.date)}</span>],
            ["Lieu", d.expertise.lieu],
            ["Statut", d.expertise.realisee ? "Réalisée" : `Prévue ${relativeDays(d.expertise.date)}`],
            [
              "Convocation",
              <span key="c" className="inline-flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", convocationSent(d) ? "bg-tone-done" : "bg-muted-foreground/40")} />
                {convocationSent(d) ? "Envoyée" : "Pas encore envoyée"}
              </span>,
            ],
          ]}
          onEdit={onEdit}
        />
        <InfoCard
          title="Livrables de l'expert"
          rows={[
            ["PV d'expertise", <DocSlot key="p" doc={pv} category="pv" />],
            ...(d.type === "litige_auto"
              ? [["Pré-rapport", <DocSlot key="pr" doc={preRapport} category="pre_rapport" />] as [string, React.ReactNode]]
              : []),
            [d.type === "litige_auto" ? "Rapport final" : "Rapport", <DocSlot key="r" doc={rapport} category="rapport" />],
          ]}
        />
      </div>
      <ConvoquesCard dossier={d} />
    </div>
  )
}

/** Livrable attendu : le document s'il est déposé, sinon un bouton d'ajout */
function DocSlot({ doc, category, onAdd }: { doc?: Dossier["documents"][number]; category: DocCategory; onAdd?: (c: DocCategory) => void }) {
  if (doc)
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{doc.name}</span>
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

function Resolution({ dossier: d, onClose, onEdit }: { dossier: Dossier; onClose?: () => void; onEdit?: () => void }) {
  const relances = d.timeline.filter((e) => e.kind === "relance")
  const reclam = d.timeline.find((e) => e.title.includes("Réclamation envoyée"))
  const preRapport = d.documents.find((x) => x.category === "pre_rapport")
  const rapport = d.documents.find((x) => x.category === "rapport")
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {d.type === "litige_auto" ? (
        <InfoCard
          title="Rapport"
          rows={[
            ["Pré-rapport", preRapport ? `Déposé le ${formatDate(preRapport.addedAt)}` : "En attente"],
            ["Rapport final", rapport ? `Déposé le ${formatDate(rapport.addedAt)}` : "—"],
          ]}
        />
      ) : (
        <InfoCard
          title="Réclamation"
          rows={[
            ["Envoyée le", reclam ? formatDate(reclam.at) : "—"],
            ["Accord / paiement", d.status === "attente_paiement" ? "Accord obtenu, paiement attendu" : d.status === "cloture" || d.status === "archive" ? "—" : "En attente"],
          ]}
        />
      )}
      <Card size="sm">
        <CardHeader>
          <CardTitle>Relances effectuées</CardTitle>
        </CardHeader>
        <CardContent>
          {relances.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune relance.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {relances.map((r) => (
                <li key={r.id} className="flex justify-between gap-2">
                  <span className="truncate">{r.title.replace("Relance envoyée — ", "")}</span>
                  <span className="shrink-0 text-muted-foreground">{formatDate(r.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card size="sm" className="md:col-span-2">
        <CardHeader>
          <CardTitle>Clôture</CardTitle>
          <CardAction>
            {d.cloture
              ? onEdit && <EditAction onClick={onEdit} label="Modifier la clôture" />
              : onClose && (
                  <Button size="sm" variant="outline" onClick={onClose}>
                    Clôturer le dossier
                  </Button>
                )}
          </CardAction>
        </CardHeader>
        <CardContent className="text-sm">
          {d.cloture ? (
            <p>
              Clôturé le {formatDate(d.cloture.at)} — motif : <span className="font-medium">{d.cloture.motif}</span>
              {d.cloture.commentaire && <span className="text-muted-foreground"> · {d.cloture.commentaire}</span>}
            </p>
          ) : (
            <p className="text-muted-foreground">Dossier en cours. La clôture est réservée à Nereids.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Blocs modifiables par l'admin ───────────────────────────────────────────

function buildSection(id: SectionId, d: Dossier, apply: (title: string, patch: (x: Dossier) => Dossier) => void): EditSection {
  const save = (title: string, patch: (x: Dossier, v: Values) => Dossier) => (v: Values) => apply(title, (x) => patch(x, v))

  switch (id) {
    case "client":
      return {
        title: "Modifier le client",
        fields: [
          { key: "firstName", label: "Prénom" },
          { key: "lastName", label: "Nom" },
          { key: "phone", label: "Téléphone", type: "tel" },
          { key: "email", label: "E-mail", type: "email" },
        ],
        initial: { firstName: d.client.firstName, lastName: d.client.lastName, phone: d.client.phone, email: d.client.email },
        onSave: save("Client", (x, v) => ({ ...x, client: { ...x.client, ...v } })),
      }
    case "vehicule":
      return {
        title: "Modifier le véhicule",
        fields: [
          { key: "marque", label: "Marque" },
          { key: "modele", label: "Modèle" },
          { key: "immat", label: "Immatriculation" },
          { key: "vin", label: "VIN" },
        ],
        initial: { ...d.vehicule, vin: d.vehicule.vin ?? "" },
        onSave: save("Véhicule", (x, v) => ({
          ...x,
          vehicule: { marque: v.marque, modele: v.modele, immat: v.immat.toUpperCase(), vin: opt(v.vin) },
        })),
      }
    case "compagnie":
      return {
        title: `Modifier — ${compagnieLabel(d.type)}`,
        fields: [
          { key: "nom", label: "Nom", full: true },
          { key: "email", label: "E-mail", type: "email" },
          { key: "reference", label: "Référence" },
        ],
        initial: { nom: d.compagnie?.nom ?? "", email: d.compagnie?.email ?? "", reference: d.compagnie?.reference ?? "" },
        onSave: save(compagnieLabel(d.type), (x, v) => ({
          ...x,
          compagnie: opt(v.nom) || opt(v.email) || opt(v.reference) ? { nom: v.nom, email: opt(v.email), reference: opt(v.reference) } : undefined,
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
          { key: "createdAt", label: "Créé le", type: "date" },
        ],
        initial: {
          type: d.type,
          sinistreType: d.sinistreType ?? "",
          litigeType: d.litigeType ?? "",
          region: d.region,
          createdAt: toDateInput(d.createdAt),
        },
        onSave: save("Dossier", (x, v) => ({
          ...x,
          type: v.type as DossierType,
          sinistreType: v.type === "sinistre" ? ((opt(v.sinistreType) as SinistreType) ?? undefined) : undefined,
          litigeType: v.type === "litige_assurantiel" ? ((opt(v.litigeType) as LitigeAssurantielType) ?? undefined) : undefined,
          region: v.region,
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
        fields: [{ key: "description", label: "Problème", type: "textarea" }],
        initial: { description: d.description ?? "" },
        onSave: save("Description", (x, v) => ({ ...x, description: opt(v.description) })),
      }
    case "refs":
      return {
        title: "Modifier les références",
        fields: [
          { key: "ref", label: "Réf. Nereids" },
          { key: "sinistre", label: "Réf. sinistre" },
          { key: "interne", label: "Réf. interne" },
          { key: "expert", label: "Réf. expert" },
        ],
        initial: { ref: d.ref, sinistre: d.refs.sinistre ?? "", interne: d.refs.interne ?? "", expert: d.refs.expert ?? "" },
        onSave: save("Références", (x, v) => ({
          ...x,
          ref: opt(v.ref) ?? x.ref,
          refs: { sinistre: opt(v.sinistre), interne: opt(v.interne), expert: opt(v.expert) },
        })),
      }
    case "expertise":
      return {
        title: d.expertise.date ? "Modifier l'expertise" : "Programmer l'expertise",
        fields: [
          { key: "date", label: "Date et heure", type: "datetime" },
          { key: "realisee", label: "Statut", type: "select", options: [{ value: "non", label: "Prévue" }, { value: "oui", label: "Réalisée" }] },
          { key: "lieu", label: "Lieu", full: true },
          { key: "convocation", label: "Convocation", type: "select", options: [{ value: "non", label: "Pas encore envoyée" }, { value: "oui", label: "Envoyée" }] },
        ],
        initial: {
          date: toDateTimeInput(d.expertise.date),
          lieu: d.expertise.lieu ?? "",
          realisee: d.expertise.realisee ? "oui" : "non",
          convocation: convocationSent(d) ? "oui" : "non",
        },
        onSave: save("Expertise", (x, v) => ({
          ...x,
          expertise: {
            ...x.expertise,
            date: fromDateInput(v.date),
            lieu: opt(v.lieu),
            realisee: v.realisee === "oui",
            convoques: v.convocation === "oui" ? (convocationSent(x) ? x.expertise.convoques : defaultConvoques(x)) : [],
          },
        })),
      }
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
