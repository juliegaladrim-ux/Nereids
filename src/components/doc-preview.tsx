"use client"

import * as React from "react"
import { Download } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { docDate, docLabel, type DocCategory, type DocumentItem } from "@/lib/data"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"

/*
 * Aperçus simulés : pas de vrais fichiers dans le proto, on dessine une page « fantôme »
 * selon la catégorie (facture, rapport, constat…) et des photos de véhicule factices.
 * Aucun contenu inventé : uniquement des barres de texte, cadres et tableaux.
 */

type Kind = "photos" | "carte" | "constat" | "facture" | "rapport" | "courrier"

const KIND: Record<DocCategory, Kind> = {
  photos: "photos",
  carte_grise: "carte",
  constat: "constat",
  devis: "facture",
  facture: "facture",
  facture_proforma: "facture",
  facture_achat: "facture",
  entretien: "facture",
  pv: "rapport",
  pre_rapport: "rapport",
  rapport: "rapport",
  rapport_compagnie: "rapport",
  premier_rapport: "rapport",
  controle_technique: "rapport",
  recherche_marche: "rapport",
  courrier: "courrier",
  mail: "courrier",
  mandat: "courrier",
  autre: "courrier",
}

function hash(s: string) {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0
  return Math.abs(h)
}

/** Nombre de photos : « Photos du véhicule (6).zip » → 6 */
const photoCount = (doc: DocumentItem) => Number(doc.name.match(/\((\d+)\)/)?.[1]) || 1

/* ---------- Briques ---------- */

const Bar = ({ w, className }: { w: string; className?: string }) => (
  <div className={cn("h-[0.7em] shrink-0 rounded-full bg-neutral-200", className)} style={{ width: w }} />
)

function Lines({ n, seed = 0 }: { n: number; seed?: number }) {
  const widths = ["100%", "96%", "92%", "98%", "88%", "94%", "70%"]
  return (
    <div className="flex flex-col gap-[0.6em]">
      {Array.from({ length: n }, (_, i) => (
        <Bar key={i} w={i === n - 1 ? "55%" : widths[(i + seed) % widths.length]} />
      ))}
    </div>
  )
}

/* ---------- Pages ---------- */

function Page({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex aspect-[1/1.414] w-full flex-col gap-[1.6em] bg-white p-[3em] text-neutral-900 shadow-sm", className)}>{children}</div>
}

function FacturePage({ seed }: { seed: number }) {
  const rows = 4 + (seed % 4)
  return (
    <Page>
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-[0.6em]">
          <div className="size-[3.2em] rounded-[0.5em] bg-neutral-300" />
          <Bar w="9em" />
          <Bar w="7em" />
        </div>
        <div className="flex flex-col items-end gap-[0.6em]">
          <Bar w="7em" className="h-[1.2em] bg-neutral-800" />
          <Bar w="10em" />
          <Bar w="8em" />
        </div>
      </div>
      <div className="flex justify-end">
        <div className="flex w-[45%] flex-col gap-[0.6em] rounded-[0.4em] border border-neutral-200 p-[1em]">
          <Bar w="80%" />
          <Bar w="65%" />
          <Bar w="70%" />
        </div>
      </div>
      <div className="flex flex-col">
        <div className="flex gap-[1em] rounded-t-[0.3em] bg-neutral-100 px-[0.8em] py-[0.7em]">
          <Bar w="50%" className="bg-neutral-300" />
          <Bar w="15%" className="ml-auto bg-neutral-300" />
          <Bar w="15%" className="bg-neutral-300" />
        </div>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex gap-[1em] border-b border-neutral-100 px-[0.8em] py-[0.7em]">
            <Bar w={`${40 + ((seed + i * 7) % 20)}%`} />
            <Bar w="10%" className="ml-auto" />
            <Bar w="15%" />
          </div>
        ))}
      </div>
      <div className="mt-auto flex justify-end">
        <div className="flex w-[40%] flex-col gap-[0.7em]">
          <div className="flex justify-between"><Bar w="40%" /><Bar w="30%" /></div>
          <div className="flex justify-between"><Bar w="30%" /><Bar w="25%" /></div>
          <div className="flex justify-between rounded-[0.3em] bg-neutral-800 p-[0.6em]"><Bar w="35%" className="bg-neutral-500" /><Bar w="30%" className="bg-neutral-400" /></div>
        </div>
      </div>
    </Page>
  )
}

function RapportPage({ seed }: { seed: number }) {
  return (
    <Page>
      <div className="flex items-center justify-between border-b border-neutral-200 pb-[1em]">
        <div className="size-[2.6em] rounded-full bg-neutral-300" />
        <Bar w="8em" />
      </div>
      <div className="flex flex-col gap-[0.7em]">
        <Bar w="60%" className="h-[1.4em] bg-neutral-800" />
        <Bar w="40%" className="bg-neutral-300" />
      </div>
      <div className="grid grid-cols-2 gap-[0.8em] rounded-[0.4em] bg-neutral-50 p-[1em]">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex flex-col gap-[0.4em]">
            <Bar w="45%" className="h-[0.55em] bg-neutral-300" />
            <Bar w={`${60 + ((seed + i * 13) % 30)}%`} />
          </div>
        ))}
      </div>
      <Bar w="35%" className="h-[1em] bg-neutral-600" />
      <Lines n={5} seed={seed} />
      {seed % 2 === 0 && (
        <div className="grid grid-cols-2 gap-[0.8em]">
          <CarPhoto seed={seed} className="aspect-[4/3] rounded-[0.3em]" />
          <CarPhoto seed={seed + 3} className="aspect-[4/3] rounded-[0.3em]" />
        </div>
      )}
      <Lines n={seed % 2 === 0 ? 3 : 7} seed={seed + 2} />
    </Page>
  )
}

function CourrierPage({ seed, contenu }: { seed: number; contenu?: string }) {
  // Document rédigé dans l'outil : on affiche son texte
  if (contenu)
    return (
      <Page className="gap-[1em]">
        <p className="text-[1.5em] leading-[1.6] whitespace-pre-wrap text-neutral-800">{contenu}</p>
      </Page>
    )
  return (
    <Page className="gap-[2em]">
      <div className="flex flex-col gap-[0.6em]">
        <Bar w="9em" className="bg-neutral-400" />
        <Bar w="7em" />
        <Bar w="8em" />
      </div>
      <div className="ml-auto flex w-[40%] flex-col gap-[0.6em]">
        <Bar w="90%" />
        <Bar w="75%" />
        <Bar w="60%" />
      </div>
      <Bar w="30%" className="ml-auto" />
      <Bar w="55%" className="bg-neutral-500" />
      <Lines n={6} seed={seed} />
      <Lines n={4} seed={seed + 3} />
      <div className="mt-auto ml-auto flex w-[35%] flex-col items-center gap-[0.6em]">
        <svg viewBox="0 0 100 30" className="w-full text-neutral-500">
          <path d="M5 22 C 20 2, 25 30, 40 14 S 60 4, 70 18 S 90 26, 95 8" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
        <Bar w="70%" />
      </div>
    </Page>
  )
}

function ConstatPage() {
  // Constat amiable : volet A (bleu) / volet B (jaune), cases à cocher au centre
  const volet = (tone: string) => (
    <div className={cn("flex flex-col gap-[0.7em] rounded-[0.4em] p-[0.9em]", tone)}>
      {Array.from({ length: 7 }, (_, i) => (
        <Bar key={i} w={`${55 + ((i * 17) % 40)}%`} className="bg-white/80" />
      ))}
    </div>
  )
  return (
    <Page className="gap-[1em] p-[2em]">
      <Bar w="50%" className="mx-auto h-[1.2em] bg-neutral-700" />
      <div className="grid grid-cols-[1fr_auto_1fr] gap-[0.8em]">
        {volet("bg-sky-200")}
        <div className="flex flex-col gap-[0.55em] pt-[0.4em]">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="flex gap-[0.4em]">
              <div className="size-[0.8em] border border-neutral-400" />
              <div className="size-[0.8em] border border-neutral-400" />
            </div>
          ))}
        </div>
        {volet("bg-yellow-200")}
      </div>
      <div className="grid flex-1 place-items-center rounded-[0.4em] border border-dashed border-neutral-300">
        <svg viewBox="0 0 120 60" className="w-[60%] text-neutral-400">
          <path d="M10 50 L110 50 M60 5 L60 55" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
          <rect x="18" y="30" width="30" height="14" rx="3" fill="none" stroke="#0284c7" strokeWidth="2" />
          <rect x="66" y="16" width="14" height="30" rx="3" fill="none" stroke="#ca8a04" strokeWidth="2" />
        </svg>
      </div>
      <div className="grid grid-cols-2 gap-[0.8em]">
        <div className="h-[3em] rounded-[0.4em] bg-sky-100" />
        <div className="h-[3em] rounded-[0.4em] bg-yellow-100" />
      </div>
    </Page>
  )
}

function CarteGrise() {
  // Certificat d'immatriculation : carte au format paysage, fond vert pâle
  return (
    <div className="flex aspect-[1.55/1] w-full flex-col gap-[0.9em] rounded-[0.6em] bg-[#e7efe4] p-[1.6em] text-neutral-900 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center gap-[0.8em]">
        <div className="h-[2em] w-[1.4em] rounded-[0.2em] bg-blue-700" />
        <Bar w="45%" className="h-[1em] bg-neutral-500" />
      </div>
      <div className="grid flex-1 grid-cols-2 gap-x-[1.6em] gap-y-[0.7em]">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="flex items-center gap-[0.5em]">
            <Bar w="1.6em" className="bg-neutral-400" />
            <Bar w={`${45 + ((i * 23) % 45)}%`} className="bg-white" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Photo de véhicule factice (illustration) — couleur et cadrage dérivés du document */
function CarPhoto({ seed, className }: { seed: number; className?: string }) {
  const bodies = ["#8a99a3", "#3f4a55", "#b4483c", "#d8d8d4", "#2f5d86", "#5b6b4b"]
  const skies = [
    ["#c9d6df", "#eef2f4"],
    ["#d9d2c5", "#f3efe7"],
    ["#b9c7cf", "#e3e9ec"],
  ]
  const body = bodies[seed % bodies.length]
  const [sky1, sky2] = skies[seed % skies.length]
  const flip = seed % 2 === 1
  const zoom = seed % 3 === 2 // gros plan sur un dommage
  return (
    <svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" className={cn("block w-full", className)} aria-hidden>
      <defs>
        <linearGradient id={`sky-${seed}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={sky1} />
          <stop offset="1" stopColor={sky2} />
        </linearGradient>
      </defs>
      <rect width="160" height="120" fill={`url(#sky-${seed})`} />
      <rect y="78" width="160" height="42" fill="#9a9a94" />
      <rect y="78" width="160" height="3" fill="#86867f" />
      <g transform={`${flip ? "translate(160 0) scale(-1 1)" : ""} ${zoom ? "translate(-70 -55) scale(1.9)" : ""}`}>
        <ellipse cx="80" cy="92" rx="58" ry="5" fill="#000" opacity=".18" />
        <path d="M24 86 L26 70 Q28 64 36 62 L52 60 L66 47 Q70 44 78 44 L104 44 Q112 44 117 50 L126 60 L134 63 Q140 65 140 72 L140 86 Z" fill={body} />
        <path d="M70 49 Q72 47 78 47 L92 47 L92 60 L59 60 Z" fill="#cfdbe2" opacity=".9" />
        <path d="M96 47 L104 47 Q110 47 114 52 L120 60 L96 60 Z" fill="#cfdbe2" opacity=".9" />
        <rect x="26" y="74" width="114" height="2" fill="#000" opacity=".12" />
        <circle cx="50" cy="86" r="11" fill="#222" />
        <circle cx="50" cy="86" r="5" fill="#9b9b9b" />
        <circle cx="116" cy="86" r="11" fill="#222" />
        <circle cx="116" cy="86" r="5" fill="#9b9b9b" />
        <rect x="134" y="66" width="5" height="4" rx="1" fill="#f2e7b5" />
        <path d="M30 70 l6 4 l-4 3 l7 2" stroke="#2b2b2b" strokeWidth="1.2" fill="none" opacity=".55" />
      </g>
    </svg>
  )
}

function PhotoGrid({ doc, max, className }: { doc: DocumentItem; max?: number; className?: string }) {
  const seed = hash(doc.id)
  const n = Math.min(photoCount(doc), max ?? Infinity)
  return (
    <div className={cn("grid gap-1", n > 1 && "grid-cols-2", n > 4 && "sm:grid-cols-3", className)}>
      {Array.from({ length: n }, (_, i) => (
        <CarPhoto key={i} seed={seed + i} className="aspect-[4/3] rounded-md" />
      ))}
    </div>
  )
}

function DocPage({ doc }: { doc: DocumentItem }) {
  const seed = hash(doc.id)
  switch (KIND[doc.category]) {
    case "facture":
      return <FacturePage seed={seed} />
    case "rapport":
      return <RapportPage seed={seed} />
    case "constat":
      return <ConstatPage />
    case "carte":
      return <CarteGrise />
    default:
      return <CourrierPage seed={seed} contenu={doc.contenu} />
  }
}

/* ---------- Vignette (galerie) ---------- */

export function DocThumbnail({ doc, className }: { doc: DocumentItem; className?: string }) {
  const kind = KIND[doc.category]
  if (kind === "photos") {
    // Une seule photo, ou une mosaïque 2×2 pour une archive de plusieurs photos
    const seed = hash(doc.id)
    const n = photoCount(doc)
    return (
      <div className={cn("grid size-full overflow-hidden", n > 1 && "grid-cols-2 gap-px bg-background", className)}>
        {Array.from({ length: Math.min(n, 4) }, (_, i) => (
          <CarPhoto key={i} seed={seed + i} className="size-full" />
        ))}
      </div>
    )
  }
  return (
    <div className={cn("size-full overflow-hidden bg-muted text-[4px]", kind === "carte" ? "grid place-items-center p-[4em]" : "px-[9em] pt-[5em]", className)}>
      <DocPage doc={doc} />
    </div>
  )
}

/* ---------- Modale d'aperçu ---------- */

export function DocPreviewDialog({ doc, onOpenChange }: { doc: DocumentItem | null; onOpenChange: (open: boolean) => void }) {
  // On garde le dernier document pendant l'animation de fermeture
  const [shown, setShown] = React.useState(doc)
  if (doc && doc !== shown) setShown(doc)
  const d = doc ?? shown
  return (
    <Dialog open={!!doc} onOpenChange={onOpenChange}>
      <DialogContent bodyClassName="flex flex-1 flex-col gap-0 overflow-hidden p-0">
        {d && (
          <>
            <div className="flex items-center gap-3 border-b py-4 pr-16 pl-6">
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate text-left text-base">{d.name}</DialogTitle>
                <DialogDescription className="truncate text-left">
                  {docLabel(d)} · Document du {formatDate(docDate(d))} · {d.size}
                </DialogDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => toast.info(`Téléchargement de « ${d.name} » — simulation`)}>
                <Download /> Télécharger
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto bg-muted p-4 sm:p-8">
              {KIND[d.category] === "photos" ? (
                <PhotoGrid doc={d} className="gap-2" />
              ) : (
                <div className={cn("mx-auto text-[7px] sm:text-[9px]", KIND[d.category] === "carte" ? "max-w-xl" : "max-w-lg")}>
                  <DocPage doc={d} />
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** État partagé : document en cours d'aperçu + la modale à rendre une seule fois */
export function useDocPreview() {
  const [doc, setDoc] = React.useState<DocumentItem | null>(null)
  const dialog = <DocPreviewDialog doc={doc} onOpenChange={(o) => !o && setDoc(null)} />
  return { open: setDoc, dialog }
}
