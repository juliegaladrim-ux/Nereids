"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  ArrowRightLeft,
  BellRing,
  CalendarCheck,
  Check,
  CircleDashed,
  CornerDownRight,
  Download,
  Eye,
  FilePlus2,
  FileText,
  Flag,
  FolderPlus,
  HandCoins,
  ImageIcon,
  MessageSquare,
  Paperclip,
  Send,
  Settings2,
  UserPlus,
  type LucideIcon,
} from "lucide-react"

import { useRole } from "@/components/app-shell/role-context"
import { useDocPreview } from "@/components/doc-preview"
import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { appendText, DictationButton } from "@/components/dictation-button"
import { Textarea } from "@/components/ui/textarea"
import { dossierRights } from "@/lib/access"
import { useDossierCabinet } from "@/lib/annuaire"
import { ACTOR_LABELS, DOC_CATEGORIES, STATUSES, fullName, getUser, nextAction, type Dossier, type StatusId, type TimelineEvent, type TimelineKind } from "@/lib/data"
import type { RoleId } from "@/lib/roles"
import { formatDateTime } from "@/lib/format"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"

const KIND_ICONS: Record<TimelineKind, LucideIcon> = {
  creation: FolderPlus,
  status: ArrowRightLeft,
  document: FilePlus2,
  message: MessageSquare,
  assignation: UserPlus,
  relance: BellRing,
  expertise: CalendarCheck,
  system: Settings2,
  consultation: Eye,
}

/** Jalons de résolution (ex-onglet Résolution) : réclamation, accord / paiement, clôture — mis en avant dans le fil */
const MILESTONES: { status: StatusId; icon: LucideIcon }[] = [
  { status: "reclamation_envoyee", icon: Send },
  { status: "attente_paiement", icon: HandCoins },
  { status: "cloture", icon: Flag },
]
const milestone = (e: TimelineEvent) =>
  e.kind === "status" ? MILESTONES.find((m) => e.title === `Statut → ${STATUSES[m.status].label}`) : undefined
const RESOLUTION_DOCS = ["Pré-rapport", "Rapport d'expertise"].map((c) => `Document ajouté — ${c}`)

type Filter = "messages" | "documents" | "etapes" | "resolution" | "consultations"
const FILTERS: { id: Filter; label: string; match: (e: TimelineEvent) => boolean; adminOnly?: boolean }[] = [
  { id: "messages", label: "Messages", match: (e) => e.kind === "message" || e.kind === "relance" },
  { id: "documents", label: "Documents", match: (e) => e.kind === "document" },
  { id: "etapes", label: "Étapes & statuts", match: (e) => ["status", "creation", "assignation", "expertise", "system"].includes(e.kind) },
  {
    id: "resolution",
    label: "Relances & résolution",
    match: (e) => e.kind === "relance" || !!milestone(e) || e.title === `Statut → ${STATUSES.attente_retour.label}` || RESOLUTION_DOCS.includes(e.title),
  },
  { id: "consultations", label: "Consultations", match: (e) => e.kind === "consultation", adminOnly: true },
]

const RECIPIENT_ROLES: { id: RoleId | "all"; field?: keyof Dossier["intervenants"] }[] = [
  { id: "client" },
  { id: "gestionnaire", field: "gestionnaire" },
  { id: "expert", field: "expert" },
  { id: "reparateur", field: "reparateur" },
  { id: "suiveur", field: "suiveurs" },
  { id: "all" },
]

export function DossierSuivi({ dossier, onEditCloture }: { dossier: Dossier; onEditCloture?: () => void }) {
  const { role, user } = useRole()
  const rights = dossierRights(role.id, user.id, useDossierCabinet(dossier)?.abonnement)
  const filters = FILTERS.filter((f) => !f.adminOnly || role.id === "admin")
  // Filtres cumulables : aucune sélection = « Tout »
  const [selected, setSelected] = React.useState<Filter[]>([])
  const active = filters.filter((f) => selected.includes(f.id))
  const closed = dossier.status === "cloture" || dossier.status === "archive"
  // Prochaine étape attendue, en tête du fil (vue « Tout » ou avec « Étapes & statuts »)
  const showNext = !closed && (!selected.length || selected.includes("etapes"))

  function toggle(id: Filter) {
    setSelected((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
      // Tout coché revient à « Tout »
      return next.length === filters.length ? [] : next
    })
  }
  const { prochaineAction, quiDoitAgir } = nextAction(dossier)
  const yourTurn = quiDoitAgir === role.id || (role.id === "admin" && quiDoitAgir === "nereids")
  const events = [...dossier.timeline]
    .filter(rights.canSeeEvent)
    .filter((e) => !active.length || active.some((f) => f.match(e)))
    // Un message qui reçoit une réponse remonte en tête du fil
    .sort((a, b) => (b.reply?.at ?? b.at).localeCompare(a.reply?.at ?? a.at))
  const lastClosing = events.find((e) => milestone(e)?.status === "cloture")

  return (
    <div className="flex flex-col gap-4">
      <Composer dossier={dossier} pickRecipients={rights.pickRecipients} />

      <div className="flex flex-wrap items-center gap-1.5">
        <FilterChip active={!selected.length} onClick={() => setSelected([])}>
          Tout
        </FilterChip>
        <span className="mx-0.5 h-4 w-px bg-border" />
        {filters.map((f) => (
          <FilterChip key={f.id} active={selected.includes(f.id)} onClick={() => toggle(f.id)} check>
            {f.label}
          </FilterChip>
        ))}
      </div>

      <ol className="relative flex flex-col">
        {showNext && (
          <li className="relative flex gap-3 pb-5">
            {events.length > 0 && <span className="absolute top-8 bottom-0 left-[15px] border-l border-dashed" />}
            <span className="z-10 grid size-8 shrink-0 place-items-center rounded-full border border-dashed border-brand/50 bg-background">
              <CircleDashed className="size-3.5 text-brand-ink" />
            </span>
            <div className="min-w-0 flex-1 pt-1 text-sm">
              <p>
                <span className="font-medium">À venir : {prochaineAction}</span>{" "}
                {yourTurn ? (
                  <span className="font-semibold text-brand-ink">· À vous d&apos;agir</span>
                ) : (
                  <span className="text-muted-foreground">· {ACTOR_LABELS[quiDoitAgir]}</span>
                )}
              </p>
            </div>
          </li>
        )}
        {events.map((e, i) => {
          const step = milestone(e)
          const Icon = step?.icon ?? KIND_ICONS[e.kind]
          const author = e.author === "system" ? undefined : getUser(e.author)
          const isMsg = e.kind === "message"
          const line = i < events.length - 1 && <span className="absolute top-8 bottom-0 left-[15px] w-px bg-border" />
          // Consultation : ligne discrète, sans contenu
          if (e.kind === "consultation")
            return (
              <li key={e.id} className={cn("relative flex items-center gap-3", events[i + 1]?.kind === "consultation" ? "pb-2" : "pb-5")}>
                {line}
                <span className="z-10 grid size-8 shrink-0 place-items-center">
                  <span className="grid size-6 place-items-center rounded-full border border-dashed border-foreground/20 bg-background">
                    <Icon className="size-3 text-foreground/60" />
                  </span>
                </span>
                <p className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
                  <span>
                    <span className="font-medium text-foreground">{fullName(author)}</span> a consulté le dossier
                  </span>
                  {author && <span>· {ACTOR_LABELS[author.role]}</span>}
                  <span className="ml-auto whitespace-nowrap">{formatDateTime(e.at)}</span>
                </p>
              </li>
            )
          return (
            <li key={e.id} className="relative flex gap-3 pb-5">
              {line}
              {isMsg && author ? (
                <UserAvatar user={author} className="size-8" />
              ) : author && !step ? (
                // Action d'un intervenant : son avatar coloré, le type d'action en pastille
                <span className="relative z-10 size-8 shrink-0">
                  <UserAvatar user={author} className="size-8" />
                  <span className="absolute -right-1 -bottom-1 grid size-[18px] place-items-center rounded-full border border-foreground/15 bg-background">
                    <Icon className="size-2.5 text-foreground/70" />
                  </span>
                </span>
              ) : (
                <span
                  className={cn(
                    "z-10 grid size-8 shrink-0 place-items-center rounded-full border border-foreground/15 bg-background",
                    step && "border-brand/40 bg-brand-soft",
                  )}
                >
                  <Icon className={cn("size-4 text-foreground/70", step && "text-brand-ink")} />
                </span>
              )}
              <div className="min-w-0 flex-1 pt-1">
                <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="font-medium">{isMsg ? fullName(author) : e.title}</span>
                  {!isMsg && (
                    <span className="text-muted-foreground">
                      {author ? `par ${fullName(author)}` : "automatique"}
                    </span>
                  )}
                  {isMsg && author && <span className="text-xs text-muted-foreground">{author.structure}</span>}
                  <span className="ml-auto text-xs whitespace-nowrap text-muted-foreground">{formatDateTime(e.at)}</span>
                </div>
                {e.body &&
                  (isMsg ? (
                    <div className="mt-1.5 rounded-lg rounded-tl-none border bg-card px-3 py-2 text-sm">{e.body}</div>
                  ) : (
                    <p className="mt-0.5 text-sm text-muted-foreground">{e.body}</p>
                  ))}
                {isMsg && <Attachments dossier={dossier} event={e} />}
                {e.recipients && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Send className="size-3 shrink-0" />
                    <span>Envoyé à {e.recipients.map((r) => ACTOR_LABELS[r]).join(", ")}</span>
                  </p>
                )}
                {isMsg && <Reply dossier={dossier} event={e} />}
                {step?.status === "cloture" && onEditCloture && dossier.cloture && e.id === lastClosing?.id && (
                  <Button variant="link" size="xs" className="mt-1 h-auto p-0" onClick={onEditCloture}>
                    Modifier la clôture
                  </Button>
                )}
              </div>
            </li>
          )
        })}
        {events.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Aucun élément.</p>}
      </ol>
    </div>
  )
}

/** Pièces jointes d'un message (les documents restent aussi dans l'onglet Documents) */
function Attachments({ dossier, event }: { dossier: Dossier; event: TimelineEvent }) {
  const docs = (event.docIds ?? []).map((id) => dossier.documents.find((d) => d.id === id)).filter((d) => !!d)
  const preview = useDocPreview()
  if (!docs.length) return null
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {docs.map((doc) => (
        <div key={doc.id} className="relative flex max-w-full min-w-0 items-center gap-3 rounded-xl border bg-card py-2 pr-2 pl-2.5 hover:bg-muted/50 sm:max-w-sm">
          <button type="button" className="absolute inset-0 cursor-pointer rounded-xl" aria-label={`Aperçu de ${doc.name}`} onClick={() => preview.open(doc)} />
          {/* Même aspect que les lignes de l'onglet Documents */}
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
            {doc.category === "photos" ? <ImageIcon className="size-4 text-muted-foreground" /> : <FileText className="size-4 text-muted-foreground" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{doc.name}</p>
            <p className="text-xs text-muted-foreground">
              {DOC_CATEGORIES[doc.category]} · {doc.size}
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" className="relative" aria-label="Télécharger" onClick={() => toast.info(`Téléchargement de « ${doc.name} » — simulation`)}>
            <Download />
          </Button>
        </div>
      ))}
      {preview.dialog}
    </div>
  )
}

/** Réponse unique à un message : un destinataire (ou Nereids) répond une fois, sans ouvrir de discussion */
function Reply({ dossier, event }: { dossier: Dossier; event: TimelineEvent }) {
  const { role, user } = useRole()
  const { replyToMessage } = useStore()
  const [open, setOpen] = React.useState(false)
  const [text, setText] = React.useState("")

  if (event.reply) {
    const author = getUser(event.reply.author)
    const toMe = event.author === user.id
    return (
      <div className="mt-3 ml-4 flex gap-2.5">
        <UserAvatar user={author} className="size-7" />
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-medium">{author?.role === "admin" ? `${fullName(author)} (Nereids)` : fullName(author)}</span>
            <span className="text-xs text-muted-foreground">{toMe ? "vous a répondu" : "a répondu"}</span>
            <span className="ml-auto text-xs whitespace-nowrap text-muted-foreground">{formatDateTime(event.reply.at)}</span>
          </p>
          <div className="mt-1.5 rounded-lg rounded-tl-none border border-brand/25 bg-brand/5 px-3 py-2 text-sm">{event.reply.body}</div>
        </div>
      </div>
    )
  }

  // Peut répondre : un destinataire du message, ou Nereids (qui voit tout) — jamais l'auteur lui-même
  const recipient = role.id === "admin" || !!event.recipients?.some((r) => r === role.id || r === "all")
  if (event.author === user.id || !recipient || dossier.status === "archive") return null

  if (!open)
    return (
      <Button variant="ghost" size="xs" className="mt-1 -ml-2 text-muted-foreground" onClick={() => setOpen(true)}>
        <CornerDownRight /> Répondre
      </Button>
    )

  function send() {
    if (!text.trim()) return
    replyToMessage(dossier.id, event.id, user.id, text.trim())
    toast.success("Réponse envoyée", { description: `Notification envoyée à ${fullName(getUser(event.author))} (plateforme + e-mail).` })
    setOpen(false)
  }

  return (
    <div className="mt-3 ml-4 flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <Textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder={`Répondre à ${fullName(getUser(event.author))}…`}
          className="resize-none"
        />
        <DictationButton onText={(t) => setText((p) => appendText(p, t))} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Une seule réponse possible par message.</p>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setOpen(false)
              setText("")
            }}
          >
            Annuler
          </Button>
          <Button size="sm" onClick={send} disabled={!text.trim()}>
            <Send /> Répondre
          </Button>
        </div>
      </div>
    </div>
  )
}

function FilterChip({ active, check, onClick, children }: { active: boolean; check?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-full border px-3 text-xs font-medium transition-colors",
        active ? "border-foreground bg-foreground text-background" : "bg-background text-muted-foreground hover:text-foreground",
      )}
    >
      {check && active && <Check className="-ml-0.5 size-3" />}
      {children}
    </button>
  )
}

function Composer({ dossier, pickRecipients }: { dossier: Dossier; pickRecipients: boolean }) {
  const { user, role } = useRole()
  const { addEvent } = useStore()
  const [text, setText] = React.useState("")
  // Sans choix des destinataires (client), le message part à Nereids
  const fixedTo: (RoleId | "all")[] = ["admin"]
  // Un intervenant extérieur écrit d'abord à Nereids : coché par défaut
  const defaultTo: (RoleId | "all")[] = role.id === "admin" ? [] : ["admin"]
  const [picked, setTo] = React.useState<(RoleId | "all")[]>(defaultTo)
  const to = pickRecipients ? picked : fixedTo
  const [focused, setFocused] = React.useState(false)

  const available = [
    ...(role.id === "admin" ? [] : [{ id: "admin" as const }]),
    ...RECIPIENT_ROLES.filter((r) => {
      if (r.id === role.id) return false
      if (r.id === "all" || r.id === "client") return true
      const v = dossier.intervenants[r.field!]
      return Array.isArray(v) ? v.length > 0 : !!v
    }),
  ]

  function toggle(id: RoleId | "all") {
    if (id === "all") return setTo((t) => (t.includes("all") ? [] : ["all"]))
    setTo((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t.filter((x) => x !== "all"), id]))
  }

  function send() {
    if (!text.trim() || !to.length) return
    addEvent(dossier.id, { kind: "message", author: user.id, title: "Message", body: text.trim(), recipients: to })
    toast.success("Message envoyé", { description: "Les destinataires sont notifiés (plateforme + e-mail)." })
    setText("")
    setTo(defaultTo)
    setFocused(false)
  }

  const open = focused || text.length > 0

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3">
        <div className="flex gap-3">
          <UserAvatar user={user} className="size-8" />
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setFocused(true)}
            rows={open ? 3 : 1}
            placeholder={pickRecipients ? "Écrire un message dans le suivi…" : "Écrire un message à Nereids…"}
            className="min-h-0 resize-none"
          />
          <DictationButton onText={(t) => setText((p) => appendText(p, t))} />
        </div>
        {open && (
          <div className="flex flex-col gap-3 pl-11">
            {!pickRecipients && <p className="text-xs text-muted-foreground">Votre message est envoyé à l&apos;équipe Nereids, qui vous répond ici et par e-mail.</p>}
            {pickRecipients && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Destinataires *</p>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {available.map((r) => (
                  <div key={r.id} className="flex items-center gap-1.5">
                    <Checkbox id={`to-${r.id}`} checked={to.includes(r.id) || (r.id !== "all" && to.includes("all"))} onCheckedChange={() => toggle(r.id)} />
                    <Label htmlFor={`to-${r.id}`} className="text-sm font-normal">
                      {ACTOR_LABELS[r.id]}
                      {"field" in r && r.field && r.field !== "suiveurs" && dossier.intervenants[r.field] && (
                        <span className="text-muted-foreground">({getUser(dossier.intervenants[r.field] as string)?.firstName})</span>
                      )}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={() => toast.info("Pièce jointe — simulation")}>
                <Paperclip /> Joindre
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setText("")
                    setTo(defaultTo)
                    setFocused(false)
                  }}
                >
                  Annuler
                </Button>
                <Button size="sm" onClick={send} disabled={!text.trim() || !to.length}>
                  <Send /> Envoyer
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
