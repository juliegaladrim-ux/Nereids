"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Bell, FileText, MessageSquare, RefreshCw, Search } from "lucide-react"

import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { daysFromNow, fullName, getUser } from "@/lib/data"
import { visibleDossiers } from "@/lib/access"
import { relativeDays } from "@/lib/format"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { useRole } from "./role-context"

export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 bg-background/90 px-3 backdrop-blur sm:px-6 lg:px-8">
      <SidebarTrigger />
            <GlobalSearch />
      <div className="ml-auto flex items-center gap-1">
        <Notifications />
      </div>
    </header>
  )
}

function GlobalSearch() {
  const [open, setOpen] = React.useState(false)
  const { role, user, href } = useRole()
  const { dossiers } = useStore()
  const router = useRouter()
  const list = visibleDossiers(dossiers, role.id, user.id)

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-10 w-full max-w-md items-center gap-2 rounded-[6px] border border-input bg-card px-3 text-sm text-muted-foreground transition-colors hover:border-foreground/30"
      >
        <Search className="size-4" />
        <span className="truncate">
          <span className="hidden sm:inline">Rechercher : immatriculation, réf. sinistre, client…</span>
          <span className="sm:hidden">Rechercher</span>
        </span>
        <kbd className="ml-auto hidden rounded border bg-background px-1.5 font-mono text-[0.65rem] sm:inline">⌘K</kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Rechercher un dossier" description="Immatriculation, référence, client, expert, gestionnaire">
        <CommandInput placeholder="Immatriculation, réf. sinistre, réf. dossier, client, expert…" />
        <CommandList>
          <CommandEmpty>Aucun dossier trouvé.</CommandEmpty>
          <CommandGroup heading="Dossiers">
            {list.map((d) => (
              <CommandItem
                key={d.id}
                value={[
                  d.ref,
                  d.vehicule.immat,
                  d.refs.sinistre,
                  d.client.firstName,
                  d.client.lastName,
                  fullName(getUser(d.intervenants.expert)),
                  fullName(getUser(d.intervenants.gestionnaire)),
                ].join(" ")}
                onSelect={() => {
                  setOpen(false)
                  router.push(href(`dossiers/${d.id}`))
                }}
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">
                    {d.client.firstName} {d.client.lastName}{" "}
                    <span className="font-normal text-muted-foreground">· {d.vehicule.immat}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {d.ref}
                    {d.refs.sinistre ? ` · ${d.refs.sinistre}` : ""}
                  </span>
                </div>
                <StatusBadge status={d.status} />
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}

const NOTIFS = [
  { icon: MessageSquare, title: "Nouveau message d'Élodie Vasseur", dossier: "NER-2026-0142", at: -1, unread: true },
  { icon: FileText, title: "Nouveau dossier à assigner", dossier: "NER-2026-0151", at: -1, unread: true },
  { icon: RefreshCw, title: "Relance automatique envoyée à l'expert", dossier: "NER-2026-0137", at: -2, unread: false },
  { icon: FileText, title: "Devis déposé par Garage Benali", dossier: "NER-2026-0142", at: -6, unread: false },
]

function Notifications() {
  const { href } = useRole()
  const router = useRouter()
  const [read, setRead] = React.useState(false)
  const unread = read ? 0 : NOTIFS.filter((n) => n.unread).length

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="icon" className="relative" aria-label="Notifications" />}>
        <Bell />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 grid size-4 place-items-center rounded-full bg-destructive text-[0.6rem] font-semibold text-white">
            {unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-medium">Notifications</span>
          <Button variant="link" size="xs" className="h-auto p-0" onClick={() => setRead(true)}>
            Tout marquer comme lu
          </Button>
        </div>
        <ul className="max-h-96 overflow-auto py-1">
          {NOTIFS.map((n, i) => (
            <li key={i}>
              <button
                className="flex w-full gap-3 px-4 py-2.5 text-left hover:bg-muted"
                onClick={() => router.push(href(`dossiers/${n.dossier}`))}
              >
                <n.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", n.unread && !read && "font-medium")}>{n.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {n.dossier} · {relativeDays(daysFromNow(n.at))}
                  </p>
                </div>
                {n.unread && !read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
