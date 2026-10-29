"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Bell, CornerDownRight, FileText, MessageSquare, RefreshCw, Search, UserPlus } from "lucide-react"

import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { daysFromNow, fullName, getUser, personneName } from "@/lib/data"
import { dossierRights, visibleDossiers } from "@/lib/access"
import { relativeDays } from "@/lib/format"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { useRole } from "./role-context"

export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 bg-background/85 px-3 backdrop-blur sm:px-6 lg:px-8">
      {/* Sur mobile le menu est fermé par défaut : on garde le bouton pour l'ouvrir */}
      <SidebarTrigger className="md:hidden" />
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
  // Le client ne cherche que parmi ses propres dossiers : il s'y repère par véhicule et référence
  const isClient = role.id === "client"
  const copy = isClient
    ? { short: "Rechercher un dossier", long: "Rechercher : véhicule, immat., référence…", hint: "Véhicule, immatriculation, référence de dossier ou de sinistre" }
    : { short: "Rechercher un dossier", long: "Rechercher un dossier : immat., réf., client…", hint: "Immatriculation, réf. sinistre, réf. dossier, client, expert…" }

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
        className="flex h-10 w-full max-w-md items-center gap-2 rounded-full bg-card/80 px-4 text-sm text-muted-foreground shadow-xs transition-colors hover:bg-card"
      >
        <Search className="size-4" />
        <span className="truncate">
          <span className="hidden sm:inline">{copy.long}</span>
          <span className="sm:hidden">{copy.short}</span>
        </span>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen} className="sm:max-w-xl" title="Rechercher un dossier" description={copy.hint}>
        <Command>
          <CommandInput autoFocus placeholder={copy.hint} />
          <CommandList>
            <CommandEmpty>Aucun dossier trouvé.</CommandEmpty>
            <CommandGroup heading="Dossiers">
              {list.map((d) => (
                <CommandItem
                  key={d.id}
                  value={[
                    d.ref,
                    d.refs.sinistre,
                    d.vehicule.immat,
                    d.vehicule.immat.replace(/-/g, ""),
                    d.vehicule.marque,
                    d.vehicule.modele,
                    ...(isClient
                      ? []
                      : [
                          d.client.firstName,
                          d.client.lastName,
                          d.client.societe,
                          d.compagnie?.nom,
                          fullName(getUser(d.intervenants.expert)),
                          fullName(getUser(d.intervenants.gestionnaire)),
                        ]),
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onSelect={() => {
                    setOpen(false)
                    router.push(href(`dossiers/${d.id}`))
                  }}
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">
                      {isClient ? `${d.vehicule.marque} ${d.vehicule.modele}` : personneName(d.client)}{" "}
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
        </Command>
      </CommandDialog>
    </>
  )
}

/** `toDo` : reste non lue tant que l'action n'est pas faite */
type Notif = { icon: typeof Bell; title: string; dossier: string; at: string; unread: boolean; toDo?: boolean }

const NOTIFS: (Omit<Notif, "at"> & { days: number })[] = [
  { icon: MessageSquare, title: "Nouveau message d'Élodie Vasseur", dossier: "NER-2026-0142", days: -1, unread: true },
  { icon: FileText, title: "Nouveau dossier à assigner", dossier: "NER-2026-0151", days: -1, unread: true },
  { icon: RefreshCw, title: "Relance automatique envoyée à l'expert", dossier: "NER-2026-0137", days: -2, unread: false },
  { icon: FileText, title: "Devis déposé par Garage Benali", dossier: "NER-2026-0142", days: -6, unread: false },
]

/** Suiveur, réparateur, gestionnaire : ce qui s'est passé récemment dans ses dossiers (hors ses propres actions) */
function recentNotifs(dossiers: ReturnType<typeof useStore>["dossiers"], role: "suiveur" | "reparateur" | "gestionnaire", userId: string): Notif[] {
  const rights = dossierRights(role, userId)
  const recent = daysFromNow(-3, 0)
  return visibleDossiers(dossiers, role, userId)
    .flatMap((d) =>
      d.timeline
        .filter((e) => rights.canSeeEvent(e) && e.author !== userId && e.kind !== "creation")
        .map((e) => {
          const author = getUser(e.author)
          const from = author?.role === "admin" ? "Nereids" : fullName(author)
          return {
            icon: e.kind === "message" ? MessageSquare : e.kind === "document" ? FileText : RefreshCw,
            title: e.kind === "message" ? `Nouveau message de ${from}` : e.title,
            dossier: d.id,
            at: e.at,
            unread: e.at > recent,
          }
        }),
    )
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 6)
}

function Notifications() {
  const { href, role, user } = useRole()
  const { dossiers } = useStore()
  const router = useRouter()
  const [read, setRead] = React.useState(false)
  // Admin : chaque demande de compte intervenant faite par un client est notifiée
  const requests: Notif[] =
    role.id === "admin"
      ? dossiers
          .flatMap((d) =>
            (d.suiveurRequests ?? [])
              .filter((r) => r.status === "pending")
              .map((r) => ({ icon: UserPlus, title: `Demande de compte intervenant : ${r.firstName} ${r.lastName} (${r.qualite})`, dossier: d.id, at: r.at, unread: true, toDo: true })),
          )
          .sort((a, b) => b.at.localeCompare(a.at))
      : []
  // Tous les rôles : réponses reçues à ses propres messages
  const replies: Notif[] = visibleDossiers(dossiers, role.id, user.id)
    .flatMap((d) =>
      d.timeline
        .filter((e) => e.author === user.id && e.reply)
        .map((e) => ({ icon: CornerDownRight, title: `${fullName(getUser(e.reply!.author))} a répondu à votre message`, dossier: d.id, at: e.reply!.at, unread: e.reply!.at > daysFromNow(-3, 0) })),
    )
  const notifs: Notif[] = [
    ...replies,
    ...(role.id === "suiveur" || role.id === "reparateur" || role.id === "gestionnaire" ? recentNotifs(dossiers, role.id, user.id) : [...requests, ...NOTIFS.map(({ days, ...n }) => ({ ...n, at: daysFromNow(days) }))]),
  ].sort((a, b) => Number(!!b.toDo) - Number(!!a.toDo) || b.at.localeCompare(a.at))
  const unread = read ? requests.length : notifs.filter((n) => n.unread).length

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="icon" className="relative" aria-label="Notifications" />}>
        <Bell />
        {unread > 0 && (
          <span className="pointer-events-none absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-destructive px-1 text-[0.65rem] leading-none font-semibold text-white tabular-nums ring-2 ring-background">
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
          {notifs.map((n, i) => (
            <li key={i}>
              <button
                className="flex w-full gap-3 px-4 py-2.5 text-left hover:bg-muted"
                onClick={() => router.push(href(`dossiers/${n.dossier}`))}
              >
                <n.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", n.unread && (!read || n.toDo) && "font-medium")}>{n.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {dossiers.find((d) => d.id === n.dossier)?.ref ?? n.dossier} · {relativeDays(n.at)}
                  </p>
                </div>
                {n.unread && (!read || n.toDo) && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" />}
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
