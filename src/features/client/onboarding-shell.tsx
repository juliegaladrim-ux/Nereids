/* eslint-disable @next/next/no-img-element -- photos d'illustration du proto, hors next/image */
"use client"

import * as React from "react"
import { CalendarClock, Camera, Check, CircleDashed, FileText, IdCard, MapPin, ShieldCheck } from "lucide-react"

import { Immat } from "@/components/immat"
import { Cartouche, Logo } from "@/components/logo"
import type { Dossier } from "@/lib/data"
import { cn } from "@/lib/utils"
import { CLIENT_STEPS, clientTypeLabel } from "./client-docs"

/** Photos d'illustration provisoires (Unsplash), à remplacer par celles de Nereids */
const PHOTO_GARAGE = "https://images.unsplash.com/photo-1711386689622-1cda23e10217?auto=format&fit=crop&w=1400&q=80"
const PHOTO_MOTEUR = "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=900&q=80"

type Variant = "a" | "b" | "c"
const VARIANTS: { id: Variant; label: string }[] = [
  { id: "a", label: "A · Photo" },
  { id: "b", label: "B · Mosaïque" },
  { id: "c", label: "C · Carrousel" },
]

/**
 * Mise en page du 1er écran d'activation : formulaire à gauche, bloc visuel à droite (grand écran).
 * Proto : trois pistes de bloc visuel à comparer (sélecteur en haut du bloc).
 * Sur mobile : une seule colonne, l'avancement reste dans l'en-tête.
 */
export function OnboardingShell({
  d,
  steps,
  index,
  children,
}: {
  d: Dossier
  /** Libellés des étapes, dans l'ordre */
  steps: string[]
  /** Étape en cours (0 = première) */
  index: number
  children: React.ReactNode
}) {
  const [variant, setVariant] = React.useState<Variant>("a")

  return (
    <div className="min-h-svh bg-background lg:p-4">
      <div className="lg:grid lg:min-h-[calc(100svh-2rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:overflow-hidden lg:rounded-2xl lg:border lg:bg-card">
        {/* ─── Bloc formulaire ─── */}
        <div className="flex min-h-svh flex-col lg:min-h-0">
          <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:backdrop-blur-none">
            <div className="flex h-14 items-center gap-3 px-4 lg:h-20 lg:px-8">
              <Logo />
              <div className="ml-auto flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground tabular-nums">
                  Étape {index + 1} sur {steps.length}
                </span>
                <div className="flex gap-1">
                  {steps.map((s, i) => (
                    <span key={s} className={cn("h-1.5 w-6 rounded-full", i <= index ? "bg-brand" : "bg-border")} />
                  ))}
                </div>
              </div>
            </div>
          </header>

          <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pt-6 pb-44 sm:pb-24 lg:max-w-md lg:justify-center lg:px-0 lg:pt-0">
            {children}
          </main>
        </div>

        {/* ─── Bloc visuel (grand écran) ─── */}
        <aside className="relative hidden overflow-hidden lg:m-3 lg:block lg:rounded-xl">
          {variant === "a" && <VisualPhoto d={d} />}
          {variant === "b" && <VisualMosaic d={d} />}
          {variant === "c" && <VisualCarousel d={d} />}

          {/* Proto : choix de la piste */}
          <div className="absolute top-4 right-4 z-20 flex gap-1 rounded-full bg-black/45 p-1 backdrop-blur">
            {VARIANTS.map((v) => (
              <button
                key={v.id}
                onClick={() => setVariant(v.id)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium text-white/80 transition-colors hover:text-white",
                  variant === v.id && "bg-white text-foreground hover:text-foreground",
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}

// ─── A · Photo plein cadre + aperçu de l'espace ─────────────────────────────

function VisualPhoto({ d }: { d: Dossier }) {
  return (
    <div className="absolute inset-0">
      <img src={PHOTO_GARAGE} alt="" className="absolute inset-0 size-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-black/60" />

      <div className="relative flex h-full flex-col justify-center px-10 xl:px-16">
        <p className="flex items-center gap-2 text-lg font-medium text-white/90">
          <Cartouche className="size-6" /> Votre espace Nereids
        </p>
        <div className="mt-5 max-w-md">
          <DossierCard d={d} className="shadow-2xl shadow-black/40" />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {[
            [Camera, "Déposez vos pièces"],
            [MapPin, "Indiquez le lieu d'expertise"],
            [ShieldCheck, "Suivez votre recours"],
          ].map(([Icon, label]) => {
            const I = Icon as typeof Camera
            return (
              <span
                key={label as string}
                className="flex items-center gap-2 rounded-lg border border-white/30 bg-white/15 px-3.5 py-2 text-sm font-medium text-white backdrop-blur-md"
              >
                <I className="size-4" /> {label as string}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── B · Mosaïque de tuiles ──────────────────────────────────────────────────

function VisualMosaic({ d }: { d: Dossier }) {
  return (
    <div className="absolute inset-0 grid grid-cols-6 grid-rows-6 gap-0 bg-[#f1f0ec]">
      {/* Haut gauche : tuile bleue */}
      <div className="relative col-span-3 row-span-2 overflow-hidden bg-brand">
        <svg className="absolute inset-0 size-full text-white/15" aria-hidden>
          <defs>
            <pattern id="grille" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M32 0H0V32" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grille)" />
        </svg>
        <Cartouche className="absolute -bottom-10 -left-6 size-44 opacity-40" />
      </div>

      {/* Haut droite : pièces du dossier */}
      <div className="col-span-3 col-start-4 row-span-3 flex flex-col justify-center bg-card p-6 xl:p-8">
        <p className="text-3xl font-bold tracking-tight tabular-nums">3 pièces</p>
        <p className="text-sm text-muted-foreground">à envoyer depuis votre téléphone</p>
        <DocRows className="mt-4" />
      </div>

      {/* Accroche */}
      <div className="col-span-3 row-span-2 row-start-3 flex items-center justify-center px-6">
        <p className="text-center text-2xl font-semibold tracking-tight text-foreground/45">
          Votre dossier, suivi pas à pas<span className="text-brand">.</span>
        </p>
      </div>

      {/* Bas gauche : véhicule */}
      <div className="col-span-2 row-span-2 row-start-5 flex flex-col justify-end gap-2 bg-brand-soft p-5">
        <Immat value={d.vehicule.immat} className="h-8 self-start text-sm" />
        <p className="text-sm font-semibold">
          {d.vehicule.marque} {d.vehicule.modele}
        </p>
      </div>
      <div className="col-start-3 row-start-6 grid place-items-center bg-primary text-primary-foreground">
        <Check className="size-8" />
      </div>

      {/* Bas droite : photo */}
      <div className="relative col-span-3 col-start-4 row-span-3 row-start-4 overflow-hidden">
        <img src={PHOTO_MOTEUR} alt="" className="absolute inset-0 size-full object-cover" />
      </div>
    </div>
  )
}

// ─── C · Carrousel de cartes sur fond bleu ───────────────────────────────────

const SLIDES: { title: string; text: string; render: (d: Dossier) => React.ReactNode }[] = [
  { title: "Suivez votre dossier", text: "Vous voyez à tout moment où en est votre recours.", render: (d) => <StepTracker d={d} compact /> },
  { title: "Envoyez vos pièces", text: "Constat, carte grise et photos, directement depuis votre téléphone.", render: () => <DocRows /> },
  {
    title: "Préparez l'expertise",
    text: "Indiquez où se trouve votre véhicule, l'expert vous confirme le rendez-vous.",
    render: () => (
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <MapPin className="size-4 text-brand-ink" />
          <span className="font-medium">Lieu de l&apos;expertise</span>
        </div>
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <CalendarClock className="size-4 text-brand-ink" />
          <span className="font-medium">Date du rendez-vous</span>
        </div>
      </div>
    ),
  },
]

function VisualCarousel({ d }: { d: Dossier }) {
  const [i, setI] = React.useState(0)
  React.useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % SLIDES.length), 4500)
    return () => clearInterval(t)
  }, [i])

  return (
    <div className="absolute inset-0 flex flex-col bg-brand p-10 text-white">
      <Cartouche className="pointer-events-none absolute -right-28 -bottom-28 size-[30rem] opacity-25" />
      <p className="relative text-lg font-medium">Bienvenue chez Nereids</p>

      <div className="relative flex flex-1 items-center">
        <div className="relative h-[24rem] w-full">
          {SLIDES.map((s, k) => {
            const pos = (k - i + SLIDES.length) % SLIDES.length // 0 = au centre, 1 = à droite, 2 = à gauche
            return (
              <div
                key={s.title}
                className={cn(
                  "absolute top-1/2 left-1/2 w-80 -translate-y-1/2 rounded-2xl bg-card p-6 text-foreground shadow-xl shadow-black/10 transition-all duration-500",
                  pos === 0 && "-translate-x-1/2 opacity-100",
                  pos === 1 && "translate-x-[45%] scale-90 opacity-40",
                  pos === 2 && "-translate-x-[145%] scale-90 opacity-40",
                )}
              >
                <h3 className="text-center text-lg font-semibold">{s.title}</h3>
                <p className="mt-1 text-center text-sm text-muted-foreground">{s.text}</p>
                <div className="mt-5">{s.render(d)}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="relative flex justify-center gap-1.5">
        {SLIDES.map((s, k) => (
          <button
            key={s.title}
            aria-label={s.title}
            onClick={() => setI(k)}
            className={cn("h-1.5 rounded-full bg-white transition-all", k === i ? "w-6" : "w-1.5 opacity-50")}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Aperçus partagés ────────────────────────────────────────────────────────

function DossierCard({ d, className }: { d: Dossier; className?: string }) {
  return (
    <div className={cn("rounded-2xl bg-card p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{d.ref}</p>
          <p className="truncate font-semibold">{clientTypeLabel(d)}</p>
        </div>
        <Immat value={d.vehicule.immat} />
      </div>
      <div className="mt-4 border-t pt-4">
        <StepTracker d={d} />
      </div>
    </div>
  )
}

/** Avancement du dossier vu par le client (frise de l'espace client) */
function StepTracker({ d, compact }: { d: Dossier; compact?: boolean }) {
  const current = Math.max(0, CLIENT_STEPS.findIndex((s) => s.statuses.includes(d.status)))
  return (
    <div>
      <div className="flex gap-1">
        {CLIENT_STEPS.map((s, k) => (
          <span key={s.label} className={cn("h-1.5 flex-1 rounded-full", k <= current ? "bg-brand" : "bg-border")} />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[0.7rem] text-muted-foreground">
        {CLIENT_STEPS.map((s, k) => (
          <span key={s.label} className={cn(k === current && "font-semibold text-brand-ink")}>
            {s.label}
          </span>
        ))}
      </div>
      {!compact && (
        <div className="mt-4 rounded-lg bg-brand-soft p-3">
          <p className="text-sm font-semibold">{CLIENT_STEPS[current].title}</p>
          <p className="text-sm text-muted-foreground">{CLIENT_STEPS[current].next}</p>
        </div>
      )}
    </div>
  )
}

function DocRows({ className }: { className?: string }) {
  return (
    <ul className={cn("flex flex-col gap-2", className)}>
      {[
        [FileText, "Constat amiable"],
        [IdCard, "Carte grise"],
        [Camera, "Photos du véhicule"],
      ].map(([Icon, label]) => {
        const I = Icon as typeof Camera
        return (
          <li key={label as string} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm">
            <CircleDashed className="size-4 text-muted-foreground" />
            <span className="flex-1 font-medium">{label as string}</span>
            <I className="size-4 text-brand-ink" />
          </li>
        )
      })}
    </ul>
  )
}
