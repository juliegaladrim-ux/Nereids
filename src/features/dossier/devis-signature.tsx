"use client"

import * as React from "react"
import { Check, Copy, FileSignature, Landmark, PenLine } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useDossierCabinet, type Organisation } from "@/lib/annuaire"
import { clientValidation, type Dossier } from "@/lib/data"
import { ligneHt, pieceNumero, totaux, type Piece } from "@/lib/facturation"
import { formatDateTime } from "@/lib/format"
import { useStore } from "@/lib/store"
import { useRole } from "@/components/app-shell/role-context"
import { eur } from "./expertise-parcours"

/** Devis en attente de signature du client : le dernier devis émis, tant que le voyant D n'est pas validé */
export function devisASigner(d: Dossier): Piece | undefined {
  if (clientValidation(d).devis === "ok") return undefined
  return (d.facturation?.pieces ?? []).filter((p) => p.kind === "devis" && p.statut === "emis" && !p.signature).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
}

/** Client : bannière « Signez votre devis » avec acceptation des CGV (simulation YouSign) */
export function DevisSignatureBanner({ dossier }: { dossier: Dossier }) {
  const piece = devisASigner(dossier)
  const [open, setOpen] = React.useState(false)
  if (!piece) return null
  const t = totaux(piece.lignes)
  return (
    <>
      <div className="mb-6 flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand text-primary-foreground [&_svg]:size-5">
          <FileSignature />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Votre devis est prêt à être signé</p>
          <p className="text-sm text-muted-foreground">
            Devis {pieceNumero(piece)} — {eur(t.ttc)} TTC. Les conditions générales de vente s&apos;acceptent en même temps que la signature.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>Consulter et signer</Button>
      </div>
      <DevisSignatureDialog open={open} onClose={() => setOpen(false)} dossier={dossier} piece={piece} />
    </>
  )
}

function DevisSignatureDialog({ open, onClose, dossier: d, piece }: { open: boolean; onClose: () => void; dossier: Dossier; piece: Piece }) {
  const { updateDossier, addEvent } = useStore()
  const { user } = useRole()
  const cabinet = useDossierCabinet(d)
  const [cgv, setCgv] = React.useState(false)
  const t = totaux(piece.lignes)

  const sign = () => {
    const at = new Date().toISOString()
    updateDossier(d.id, (x) => ({
      ...x,
      facturation: x.facturation && {
        ...x.facturation,
        pieces: x.facturation.pieces.map((p) => (p.id === piece.id ? { ...p, statut: "accepte" as const, signature: { at, by: user.id, cgv: true } } : p)),
      },
      validation: { ...clientValidation(x), devis: "ok" as const },
    }))
    addEvent(d.id, { kind: "system", author: user.id, title: "Devis signé par le client", body: `${pieceNumero(piece)} signé (YouSign) — CGV acceptées` })
    toast.success("Devis signé", { description: "Les CGV sont acceptées avec la signature. L'expert et le gestionnaire sont notifiés." })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Devis {pieceNumero(piece)}</DialogTitle>
          <DialogDescription>Vérifiez le devis, acceptez les CGV puis signez avec YouSign.</DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border">
          {piece.lignes.map((l) => (
            <div key={l.id} className="flex items-start justify-between gap-4 border-b px-3 py-2 text-sm last:border-b-0">
              <span className="min-w-0 whitespace-pre-line">
                {l.label}
                {l.info && <span className="mt-0.5 block text-xs text-muted-foreground">À titre d&apos;information — non inclus dans le total</span>}
              </span>
              <span className={l.info ? "shrink-0 text-muted-foreground tabular-nums" : "shrink-0 font-medium tabular-nums"}>{eur(ligneHt(l))} HT</span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-4 bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Total HT {eur(t.ht)} · TVA {eur(t.tva)}</span>
            <span className="font-semibold tabular-nums">{eur(t.ttc)} TTC</span>
          </div>
        </div>
        {cabinet?.rib && (
          <p className="text-xs text-muted-foreground">Règlement par virement : le RIB du cabinet restera accessible dans votre dossier, après signature.</p>
        )}
        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <Checkbox checked={cgv} onCheckedChange={(v) => setCgv(v === true)} className="mt-0.5" />
          <span>
            J&apos;ai lu et j&apos;accepte les <span className="font-medium text-brand-ink underline underline-offset-2">conditions générales de vente</span> de {cabinet?.nom ?? "l'expert"}.
          </span>
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Plus tard
          </Button>
          <Button onClick={sign} disabled={!cgv}>
            <PenLine /> Signer avec YouSign
          </Button>
        </DialogFooter>
        <p className="text-center text-xs text-muted-foreground">Simulation : dans l&apos;outil réel, la signature s&apos;ouvre dans YouSign.</p>
      </DialogContent>
    </Dialog>
  )
}

/** Carte « RIB du cabinet » : accessible en un clic au client et à l'équipe, pour régler par virement */
export function RibCard({ cabinet }: { cabinet?: Organisation }) {
  const [copied, setCopied] = React.useState(false)
  const rib = cabinet?.rib
  if (!cabinet || !rib) return null
  const copy = () => {
    try {
      void navigator.clipboard?.writeText(rib.iban.replace(/\s/g, ""))
    } catch {
      /* presse-papier indisponible */
    }
    setCopied(true)
    toast.success("IBAN copié")
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <Landmark className="size-4 text-muted-foreground" /> RIB du cabinet
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <p className="font-medium">{rib.titulaire ?? cabinet.nom}</p>
        <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2">
          <span className="min-w-0 break-all text-[13px] tabular-nums">{rib.iban}</span>
          <Button variant="ghost" size="icon-sm" onClick={copy} aria-label="Copier l'IBAN">
            {copied ? <Check /> : <Copy />}
          </Button>
        </div>
        {rib.bic && <p className="text-xs text-muted-foreground">BIC {rib.bic}</p>}
      </CardContent>
    </Card>
  )
}

/** Mention de signature, affichée sur une pièce signée */
export const signatureLabel = (p: Piece) => (p.signature ? `${p.signature.manual ? "Signature enregistrée le" : "Signé le"} ${formatDateTime(p.signature.at)}${p.signature.manual ? "" : " (YouSign)"} — CGV acceptées` : undefined)
