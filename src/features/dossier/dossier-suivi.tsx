"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  ArrowRightLeft,
  BellRing,
  CalendarCheck,
  CircleDashed,
  FilePlus2,
  FolderPlus,
  MessageSquare,
  Paperclip,
  Send,
  Settings2,
  UserPlus,
  type LucideIcon,
} from "lucide-react"

import { useRole } from "@/components/app-shell/role-context"
import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { dossierRights } from "@/lib/access"
import { ACTOR_LABELS, fullName, getUser, type Dossier, type TimelineKind } from "@/lib/data"
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
}

type Filter = "tout" | "messages" | "documents" | "etapes"
const FILTERS: { id: Filter; label: string; kinds?: TimelineKind[] }[] = [
  { id: "tout", label: "Tout" },
  { id: "messages", label: "Messages", kinds: ["message", "relance"] },
  { id: "documents", label: "Documents", kinds: ["document"] },
  { id: "etapes", label: "Étapes & statuts", kinds: ["status", "creation", "assignation", "expertise", "system"] },
]

const RECIPIENT_ROLES: { id: RoleId | "all"; field?: keyof Dossier["intervenants"] }[] = [
  { id: "client" },
  { id: "gestionnaire", field: "gestionnaire" },
  { id: "expert", field: "expert" },
  { id: "reparateur", field: "reparateur" },
  { id: "suiveur", field: "suiveurs" },
  { id: "all" },
]

export function DossierSuivi({ dossier }: { dossier: Dossier }) {
  const { role, user } = useRole()
  const rights = dossierRights(role.id, user.id)
  const [filter, setFilter] = React.useState<Filter>("tout")
  const kinds = FILTERS.find((f) => f.id === filter)!.kinds
  const closed = dossier.status === "cloture" || dossier.status === "archive"
  // Prochaine étape attendue, en tête du fil (vue « Tout » et « Étapes & statuts »)
  const showNext = !closed && (filter === "tout" || filter === "etapes")
  const { quiDoitAgir } = dossier.pilotage
  const yourTurn = quiDoitAgir === role.id || (role.id === "admin" && quiDoitAgir === "nereids")
  const events = [...dossier.timeline]
    .filter(rights.canSeeEvent)
    .filter((e) => !kinds || kinds.includes(e.kind)).sort((a, b) => b.at.localeCompare(a.at))

  return (
    <div className="flex flex-col gap-4">
      <Composer dossier={dossier} pickRecipients={rights.pickRecipients} />

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "h-7 rounded-full border px-3 text-xs font-medium transition-colors",
              filter === f.id ? "border-foreground bg-foreground text-background" : "bg-background text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <ol className="relative flex flex-col">
        {showNext && (
          <li className="relative flex gap-3 pb-5">
            {events.length > 0 && <span className="absolute top-8 bottom-0 left-[15px] border-l border-dashed" />}
            <span className="z-10 grid size-8 shrink-0 place-items-center rounded-full border border-dashed border-primary/50 bg-background">
              <CircleDashed className="size-3.5 text-primary" />
            </span>
            <div className="min-w-0 flex-1 pt-1 text-sm">
              <p>
                <span className="font-medium">À venir : {dossier.pilotage.prochaineAction}</span>{" "}
                {yourTurn ? (
                  <span className="font-semibold text-primary">· À vous d&apos;agir</span>
                ) : (
                  <span className="text-muted-foreground">· {ACTOR_LABELS[quiDoitAgir]}</span>
                )}
              </p>
            </div>
          </li>
        )}
        {events.map((e, i) => {
          const Icon = KIND_ICONS[e.kind]
          const author = e.author === "system" ? undefined : getUser(e.author)
          const isMsg = e.kind === "message"
          return (
            <li key={e.id} className="relative flex gap-3 pb-5">
              {i < events.length - 1 && <span className="absolute top-8 bottom-0 left-[15px] w-px bg-border" />}
              {isMsg && author ? (
                <UserAvatar user={author} className="size-8" />
              ) : (
                <span className="z-10 grid size-8 shrink-0 place-items-center rounded-full border bg-background">
                  <Icon className="size-3.5 text-muted-foreground" />
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
                {e.recipients && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    → {e.recipients.map((r) => ACTOR_LABELS[r]).join(", ")}
                  </p>
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
