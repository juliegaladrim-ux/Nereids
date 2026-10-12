"use client"

import * as React from "react"
import { toast } from "sonner"
import { Lock, Trash2 } from "lucide-react"

import { useRole } from "@/components/app-shell/role-context"
import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { fullName, getUser, type Dossier } from "@/lib/data"
import { formatDateTime } from "@/lib/format"
import { useStore } from "@/lib/store"

/** Notes internes Nereids : prise de notes entre admins, jamais visible des intervenants ni du client */
export function DossierNotes({ dossier }: { dossier: Dossier }) {
  const { user } = useRole()
  const { addNote, deleteNote } = useStore()
  const [text, setText] = React.useState("")
  const notes = [...(dossier.notes ?? [])].sort((a, b) => b.at.localeCompare(a.at))

  function save() {
    if (!text.trim()) return
    addNote(dossier.id, user.id, text.trim())
    setText("")
    toast.success("Note ajoutée")
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="size-3" /> Visible uniquement par l&apos;équipe Nereids. Les intervenants et le client ne voient pas ces notes.
      </p>

      <Card size="sm">
        <CardContent className="flex flex-col gap-3">
          <div className="flex gap-3">
            <UserAvatar user={user} className="size-8" />
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save()
              }}
              rows={text ? 3 : 2}
              placeholder="Ajouter une note interne (appel, point d'attention, à faire…)"
              className="min-h-0 resize-none"
            />
          </div>
          {text && (
            <div className="flex justify-end gap-2 pl-11">
              <Button variant="ghost" size="sm" onClick={() => setText("")}>
                Annuler
              </Button>
              <Button size="sm" onClick={save}>
                Ajouter la note
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ul className="flex flex-col gap-3">
        {notes.map((n) => {
          const author = getUser(n.author)
          return (
            <li key={n.id} className="group flex gap-3">
              <UserAvatar user={author} className="size-8" />
              <div className="min-w-0 flex-1 rounded-lg rounded-tl-none border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/60 dark:bg-amber-950/30">
                <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="font-medium">{fullName(author)}</span>
                  {author?.fonction && <span className="text-xs text-muted-foreground">{author.fonction}</span>}
                  <span className="ml-auto text-xs whitespace-nowrap text-muted-foreground">{formatDateTime(n.at)}</span>
                  {n.author === user.id && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="-my-1 -mr-1.5 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                      aria-label="Supprimer la note"
                      onClick={() => {
                        deleteNote(dossier.id, n.id)
                        toast("Note supprimée")
                      }}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </div>
                <p className="mt-1 text-sm whitespace-pre-line">{n.body}</p>
              </div>
            </li>
          )
        })}
        {notes.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Aucune note interne pour l&apos;instant.</p>}
      </ul>
    </div>
  )
}
