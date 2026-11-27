"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  Copy,
  CornerDownRight,
  Link2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react"

import { DateInput } from "@/components/date-input"
import { SimpleSelect } from "@/components/simple-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import type { Dossier } from "@/lib/data"
import {
  CLIENT_TYPES,
  MODES_PAIEMENT,
  PIECE_LABELS,
  STATUT_LABELS,
  compteurs,
  ligneHt,
  ligneTtc,
  nextNumber,
  pieceNumero,
  totaux,
  type ClientType,
  type Facturation,
  type Ligne,
  type LigneType,
  type ModePaiement,
  type Piece,
  type PieceKind,
  type PieceStatut,
} from "@/lib/facturation"
import { formatDate } from "@/lib/format"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { eur } from "./expertise-parcours"

const EMPTY: Facturation = { pieces: [], paiements: [], liens: [] }
const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const num = (s: string) => {
  const n = parseFloat(s.replace(",", ".").replace(/\s/g, ""))
  return Number.isFinite(n) ? n : 0
}
const today = () => new Date().toISOString().slice(0, 10)

const STATUT_TONE: Record<PieceStatut, string> = {
  brouillon: "bg-muted text-muted-foreground",
  emis: "bg-tone-progress-bg text-tone-progress",
  accepte: "bg-tone-done-bg text-tone-done",
  refuse: "bg-tone-alert-bg text-tone-alert",
}

/** Applique une modification à la facturation d'un dossier */
function useFacturation(dossier: Dossier) {
  const { updateDossier } = useStore()
  return React.useCallback(
    (fn: (f: Facturation) => Facturation) => updateDossier(dossier.id, (d) => ({ ...d, facturation: fn(d.facturation ?? EMPTY) })),
    [dossier.id, updateDossier],
  )
}

// ─── Onglet « Paiement et facture » ──────────────────────────────────────────

type EditorState = { kind: PieceKind; piece?: Piece; from?: Piece } | null

export function DossierFacturation({ dossier }: { dossier: Dossier }) {
  const { dossiers } = useStore()
  const update = useFacturation(dossier)
  const f = dossier.facturation ?? EMPTY
  const [editor, setEditor] = React.useState<EditorState>(null)
  const [importKind, setImportKind] = React.useState<PieceKind | null>(null)
  const [paiementOpen, setPaiementOpen] = React.useState(false)
  const [lienOpen, setLienOpen] = React.useState(false)
  const [sub, setSub] = React.useState("paiements")

  const count = (k: PieceKind) => f.pieces.filter((p) => p.kind === k).length

  function setStatut(p: Piece, statut: PieceStatut) {
    update((x) => ({ ...x, pieces: x.pieces.map((q) => (q.id === p.id ? { ...q, statut } : q)) }))
    toast.success(`${PIECE_LABELS[p.kind].plural.replace(/s$/, "")} ${pieceNumero(p)} : ${STATUT_LABELS[statut].toLowerCase()}`)
  }
  function remove(p: Piece) {
    update((x) => ({ ...x, pieces: x.pieces.filter((q) => q.id !== p.id) }))
    toast(`${pieceNumero(p)} supprimé`)
  }
  function sync(p: Piece) {
    update((x) => ({ ...x, pieces: x.pieces.map((q) => (q.id === p.id ? { ...q, pennylane: { at: new Date().toISOString() } } : q)) }))
    toast.success("Envoyé vers Pennylane", { description: "Simulation : aucune donnée n'a été transmise." })
  }
  function toFacture(p: Piece) {
    setSub("factures")
    setEditor({ kind: "facture", from: p })
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <RefreshCw className="size-3" /> Devis, factures, avoirs et paiements du dossier. Les pièces émises seront synchronisées avec Pennylane (simulation dans ce prototype).
      </p>

      <Tabs value={sub} onValueChange={(v) => setSub(v as string)}>
        <TabsList variant="line" className="mb-2">
          <TabsTrigger value="paiements">Paiements</TabsTrigger>
          <TabsTrigger value="factures">Factures {count("facture") > 0 && <CountBadge n={count("facture")} />}</TabsTrigger>
          <TabsTrigger value="avoirs">Avoirs {count("avoir") > 0 && <CountBadge n={count("avoir")} />}</TabsTrigger>
          <TabsTrigger value="devis">Devis {count("devis") > 0 && <CountBadge n={count("devis")} />}</TabsTrigger>
        </TabsList>

        <TabsContent value="paiements">
          <Paiements
            dossier={dossier}
            onAdd={() => setPaiementOpen(true)}
            onAddLien={() => setLienOpen(true)}
            onDeletePaiement={(id) => update((x) => ({ ...x, paiements: x.paiements.filter((p) => p.id !== id) }))}
            onDeleteLien={(id) => update((x) => ({ ...x, liens: x.liens.filter((l) => l.id !== id) }))}
          />
        </TabsContent>
        {(["facture", "avoir", "devis"] as const).map((k) => (
          <TabsContent key={k} value={k === "devis" ? "devis" : `${k}s`}>
            <PieceList
              kind={k}
              pieces={f.pieces.filter((p) => p.kind === k)}
              onCreate={() => setEditor({ kind: k })}
              onImport={() => setImportKind(k)}
              onEdit={(p) => setEditor({ kind: k, piece: p })}
              onStatut={setStatut}
              onDelete={remove}
              onSync={sync}
              onToFacture={k === "devis" ? toFacture : undefined}
            />
          </TabsContent>
        ))}
      </Tabs>

      {editor && (
        <PieceEditor
          key={editor.piece?.id ?? editor.from?.id ?? editor.kind}
          dossier={dossier}
          kind={editor.kind}
          piece={editor.piece}
          from={editor.from}
          number={editor.piece?.number ?? nextNumber(editor.kind, dossiers.map((d) => d.facturation))}
          onClose={() => setEditor(null)}
          onSave={(p) => {
            update((x) => ({ ...x, pieces: x.pieces.some((q) => q.id === p.id) ? x.pieces.map((q) => (q.id === p.id ? p : q)) : [p, ...x.pieces] }))
            toast.success(`${PIECE_LABELS[p.kind].plural.replace(/s$/, "")} ${pieceNumero(p)} enregistré`)
            setEditor(null)
          }}
        />
      )}
      {importKind && (
        <ImportDialog
          dossier={dossier}
          kind={importKind}
          number={nextNumber(importKind, dossiers.map((d) => d.facturation))}
          onClose={() => setImportKind(null)}
          onSave={(p) => {
            update((x) => ({ ...x, pieces: [p, ...x.pieces] }))
            toast.success(`${PIECE_LABELS[p.kind].plural.replace(/s$/, "")} importé`)
            setImportKind(null)
          }}
        />
      )}
      {paiementOpen && (
        <PaiementDialog
          reste={compteurs(f).reste}
          onClose={() => setPaiementOpen(false)}
          onSave={(p) => {
            update((x) => ({ ...x, paiements: [p, ...x.paiements] }))
            toast.success("Paiement enregistré")
            setPaiementOpen(false)
          }}
        />
      )}
      {lienOpen && (
        <LienDialog
          reste={compteurs(f).reste}
          onClose={() => setLienOpen(false)}
          onSave={(l) => {
            update((x) => ({ ...x, liens: [l, ...x.liens] }))
            toast.success("Lien de paiement créé")
            setLienOpen(false)
          }}
        />
      )}
    </div>
  )
}

function CountBadge({ n }: { n: number }) {
  return (
    <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-foreground/10 px-1.5 text-[0.7rem] leading-none font-semibold text-foreground tabular-nums">
      {n}
    </span>
  )
}

function EmptyCard({ title, description, children }: { title: string; description: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

// ─── Paiements ───────────────────────────────────────────────────────────────

function Paiements({
  dossier,
  onAdd,
  onAddLien,
  onDeletePaiement,
  onDeleteLien,
}: {
  dossier: Dossier
  onAdd: () => void
  onAddLien: () => void
  onDeletePaiement: (id: string) => void
  onDeleteLien: (id: string) => void
}) {
  const f = dossier.facturation ?? EMPTY
  const c = compteurs(f)
  const du = Math.max(0, c.total - c.avoirs)
  const pct = du > 0 ? Math.min(100, Math.round((c.paye / du) * 100)) : c.total > 0 ? 100 : 0
  const lignes: [string, number, boolean?][] = [
    ["Montant", c.montant],
    ["Frais annexes", c.frais],
    ["Montant total", c.total, true],
    ...(c.avoirs > 0 ? ([["Avoirs", -c.avoirs]] as [string, number][]) : []),
    ["Déjà réglé", c.paye],
  ]
  return (
    <div className="flex flex-col gap-4">
      <Card size="sm">
        <CardContent className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:items-center">
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">Restant à payer</p>
            <p className={cn("text-3xl leading-none font-semibold tabular-nums", c.reste > 0 ? "text-tone-alert" : c.total > 0 ? "text-tone-done" : "text-foreground")}>{eur(c.reste)}</p>
            <div className="flex flex-col gap-1.5">
              <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Part réglée">
                <div className={cn("h-full rounded-full transition-all", pct >= 100 ? "bg-tone-done" : "bg-brand")} style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">
                {c.total === 0 ? "Aucun montant à régler pour l'instant" : pct >= 100 ? "Entièrement réglé" : `${pct} % réglé`}
              </p>
            </div>
          </div>
          <dl className="flex flex-col divide-y text-sm">
            {lignes.map(([label, value, strong]) => (
              <div key={label} className="flex items-center justify-between gap-4 py-1.5 first:pt-0 last:pb-0">
                <dt className={strong ? "font-medium" : "text-muted-foreground"}>{label}</dt>
                <dd className={cn("tabular-nums", strong ? "font-semibold" : "font-medium")}>{eur(value)}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      {c.base ? (
        <p className="text-xs text-muted-foreground">
          Calculé d&apos;après {c.base.kind === "facture" ? "la facture" : "le devis"} {pieceNumero(c.base)}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Les montants se calculent à partir du dernier devis émis ou de la dernière facture émise.</p>
      )}

      {f.paiements.length === 0 ? (
        <EmptyCard title="Paiements" description="Aucun paiement enregistré.">
          <Button variant="secondary" onClick={onAdd}>
            Ajouter un paiement
          </Button>
        </EmptyCard>
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Paiements</h3>
              <Button size="sm" variant="outline" onClick={onAdd}>
                <Plus /> Ajouter un paiement
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {f.paiements.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDate(p.date)}</TableCell>
                    <TableCell>{MODES_PAIEMENT.find((m) => m.value === p.mode)?.label}</TableCell>
                    <TableCell className="text-muted-foreground">{p.reference || "—"}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{eur(p.amount)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon-xs" aria-label="Supprimer le paiement" onClick={() => onDeletePaiement(p.id)}>
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {f.liens.length === 0 ? (
        <EmptyCard title="Liens de paiement" description="Aucun lien de paiement enregistré.">
          <Button variant="secondary" onClick={onAddLien}>
            Ajouter un lien de paiement
          </Button>
        </EmptyCard>
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Liens de paiement</h3>
              <Button size="sm" variant="outline" onClick={onAddLien}>
                <Plus /> Ajouter un lien de paiement
              </Button>
            </div>
            <ul className="flex flex-col divide-y">
              {f.liens.map((l) => (
                <li key={l.id} className="flex items-center gap-3 py-2 text-sm">
                  <Link2 className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{l.url}</span>
                  <span className="font-medium tabular-nums">{eur(l.amount)}</span>
                  <Badge variant="secondary">{formatDate(l.createdAt)}</Badge>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Copier le lien"
                    onClick={() => {
                      navigator.clipboard?.writeText(l.url).catch(() => {})
                      toast.success("Lien copié")
                    }}
                  >
                    <Copy />
                  </Button>
                  <Button variant="ghost" size="icon-xs" aria-label="Supprimer le lien" onClick={() => onDeleteLien(l.id)}>
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function PaiementDialog({ reste, onClose, onSave }: { reste: number; onClose: () => void; onSave: (p: { id: string; date: string; amount: number; mode: ModePaiement; reference?: string }) => void }) {
  const [date, setDate] = React.useState(today())
  const [amount, setAmount] = React.useState(reste > 0 ? String(reste) : "")
  const [mode, setMode] = React.useState<string | null>("virement")
  const [reference, setReference] = React.useState("")
  const ok = num(amount) > 0 && !!date && !!mode
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Ajouter un paiement</DialogTitle>
          <DialogDescription>Enregistre un règlement reçu pour ce dossier.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel>Date du paiement</FieldLabel>
            <DateInput value={date} onChange={setDate} />
          </Field>
          <Field>
            <FieldLabel htmlFor="pay-amount">Montant TTC (€)</FieldLabel>
            <Input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel>Mode de paiement</FieldLabel>
            <SimpleSelect value={mode} onChange={setMode} options={MODES_PAIEMENT} />
          </Field>
          <Field>
            <FieldLabel htmlFor="pay-ref">Référence (facultatif)</FieldLabel>
            <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="N° de chèque, libellé du virement…" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={!ok} onClick={() => onSave({ id: uid("pay"), date, amount: num(amount), mode: mode as ModePaiement, reference: reference.trim() || undefined })}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LienDialog({ reste, onClose, onSave }: { reste: number; onClose: () => void; onSave: (l: { id: string; amount: number; createdAt: string; url: string }) => void }) {
  const [amount, setAmount] = React.useState(reste > 0 ? String(reste) : "")
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Ajouter un lien de paiement</DialogTitle>
          <DialogDescription>Génère un lien à envoyer au client (simulation : le lien ne mène nulle part).</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="lien-amount">Montant à régler (€)</FieldLabel>
          <Input id="lien-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={num(amount) <= 0}
            onClick={() => onSave({ id: uid("lnk"), amount: num(amount), createdAt: new Date().toISOString(), url: `https://paiement.exemple.fr/l/${Math.random().toString(36).slice(2, 10)}` })}
          >
            Créer le lien
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Liste des devis / factures / avoirs ─────────────────────────────────────

function PieceList({
  kind,
  pieces,
  onCreate,
  onImport,
  onEdit,
  onStatut,
  onDelete,
  onSync,
  onToFacture,
}: {
  kind: PieceKind
  pieces: Piece[]
  onCreate: () => void
  onImport: () => void
  onEdit: (p: Piece) => void
  onStatut: (p: Piece, s: PieceStatut) => void
  onDelete: (p: Piece) => void
  onSync: (p: Piece) => void
  onToFacture?: (p: Piece) => void
}) {
  const L = PIECE_LABELS[kind]
  if (pieces.length === 0)
    return (
      <EmptyCard title={L.plural} description={`Aucun${kind === "facture" ? "e" : ""} ${L.singular} enregistré${kind === "facture" ? "e" : ""}.`}>
        <Button variant="secondary" onClick={onCreate}>
          Créer {L.article} {L.singular}
        </Button>
        <Button variant="link" size="sm" onClick={onImport}>
          Importer {L.article} {L.singular}
        </Button>
      </EmptyCard>
    )
  const statuts: PieceStatut[] = kind === "devis" ? ["brouillon", "emis", "accepte", "refuse"] : ["brouillon", "emis"]
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">{L.plural}</h3>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={onImport}>
              <Upload /> Importer {L.article} {L.singular}
            </Button>
            <Button size="sm" variant="outline" onClick={onCreate}>
              <Plus /> Créer {L.article} {L.singular}
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numéro</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Pennylane</TableHead>
                <TableHead className="text-right">Total TTC</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pieces.map((p) => (
                <TableRow key={p.id} className="cursor-pointer" onClick={() => onEdit(p)}>
                  <TableCell className="font-medium">{pieceNumero(p)}</TableCell>
                  <TableCell>{formatDate(p.date)}</TableCell>
                  <TableCell>{`${p.client.firstName} ${p.client.lastName}`.trim() || "—"}</TableCell>
                  <TableCell>
                    <Badge className={cn("border-transparent", STATUT_TONE[p.statut])}>{STATUT_LABELS[p.statut]}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.pennylane ? `Synchronisé le ${formatDate(p.pennylane.at)}` : p.statut === "brouillon" ? "—" : "À synchroniser"}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{eur(totaux(p.lignes).ttc)}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" aria-label="Actions" />}>
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={() => onEdit(p)}>Modifier</DropdownMenuItem>
                        {statuts
                          .filter((s) => s !== p.statut)
                          .map((s) => (
                            <DropdownMenuItem key={s} onClick={() => onStatut(p, s)}>
                              Marquer comme {STATUT_LABELS[s].toLowerCase()}
                            </DropdownMenuItem>
                          ))}
                        {onToFacture && (
                          <DropdownMenuItem onClick={() => onToFacture(p)}>
                            <CornerDownRight /> Créer la facture
                          </DropdownMenuItem>
                        )}
                        {p.statut !== "brouillon" && !p.pennylane && (
                          <DropdownMenuItem onClick={() => onSync(p)}>
                            <RefreshCw /> Envoyer vers Pennylane
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => toast.info(`Téléchargement du PDF ${pieceNumero(p)} — simulation`)}>Télécharger le PDF</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => onDelete(p)}>
                          <Trash2 /> Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Création / modification d'un devis, d'une facture ou d'un avoir ─────────

type FLigne = { id: string; type: LigneType; label: string; qty: string; unitHt: string; tva: string }
const toFLigne = (l: Ligne): FLigne => ({ id: l.id, type: l.type, label: l.label, qty: String(l.qty), unitHt: String(l.unitHt), tva: String(l.tva) })
const fromFLigne = (l: FLigne): Ligne => ({ id: l.id, type: l.type, label: l.label, qty: num(l.qty), unitHt: num(l.unitHt), tva: num(l.tva) })

/** « Expertise du 8 décembre 2026 à 14h » + lieu, d'après l'expertise du dossier */
function expertiseLabel(d: Dossier): string {
  const e = d.expertise
  if (!e.date) return `Expertise — ${d.vehicule.marque} ${d.vehicule.modele} (${d.vehicule.immat})`
  const t = new Date(e.date)
  const date = t.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
  const mn = t.getMinutes()
  return `Expertise du ${date} à ${t.getHours()}h${mn ? String(mn).padStart(2, "0") : ""}${e.lieu ? `\n${e.lieu}` : ""}`
}

function PieceEditor({
  dossier,
  kind,
  piece,
  from,
  number,
  onClose,
  onSave,
}: {
  dossier: Dossier
  kind: PieceKind
  piece?: Piece
  /** Devis dont on reprend les lignes pour créer une facture */
  from?: Piece
  number: number
  onClose: () => void
  onSave: (p: Piece) => void
}) {
  const L = PIECE_LABELS[kind]
  const src = piece ?? from
  const [prefix, setPrefix] = React.useState(piece?.prefix ?? `${L.prefix}-${new Date().getFullYear()}`)
  const [numero, setNumero] = React.useState(String(number))
  const [date, setDate] = React.useState((piece?.date ?? new Date().toISOString()).slice(0, 10))
  const [observations, setObservations] = React.useState(src?.observations ?? "")
  const [lignes, setLignes] = React.useState<FLigne[]>(() => {
    if (src) return src.lignes.map((l) => ({ ...toFLigne(l), id: piece ? l.id : uid("l") }))
    if (kind === "avoir") return []
    const t = dossier.tarif
    const unit = t?.prix !== undefined ? (t.mode === "ht" ? t.prix : Math.round((t.prix / 1.2) * 100) / 100) : 0
    return [{ id: uid("l"), type: "service", label: expertiseLabel(dossier), qty: "1", unitHt: unit ? String(unit) : "", tva: "20" }]
  })
  const [clientType, setClientType] = React.useState<ClientType>(src?.client.type ?? "mandant")
  const [firstName, setFirstName] = React.useState(src?.client.firstName ?? dossier.client.firstName)
  const [lastName, setLastName] = React.useState(src?.client.lastName ?? dossier.client.lastName)
  const [email, setEmail] = React.useState(src?.client.email ?? dossier.client.email)
  const [address, setAddress] = React.useState(src?.client.address ?? dossier.client.address ?? "")

  const parsed = lignes.map(fromFLigne)
  const t = totaux(parsed)
  const ok = !!email.trim() && parsed.length > 0 && !!numero && !!date

  const setLigne = (id: string, patch: Partial<FLigne>) => setLignes((all) => all.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  const addLigne = (type: LigneType) =>
    setLignes((all) => [...all, { id: uid("l"), type, label: type === "frais" ? "Frais annexes" : type === "remise" ? "Remise" : "", qty: "1", unitHt: "", tva: "20" }])

  function save() {
    onSave({
      id: piece?.id ?? uid("p"),
      kind,
      prefix: prefix.trim() || `${L.prefix}-${new Date().getFullYear()}`,
      number: Math.round(num(numero)) || number,
      date: new Date(`${date}T12:00:00`).toISOString(),
      statut: piece?.statut ?? "brouillon",
      observations: observations.trim() || undefined,
      lignes: parsed,
      client: { type: clientType, firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), address: address.trim() || undefined },
      fichier: piece?.fichier,
      pennylane: piece?.pennylane,
      createdAt: piece?.createdAt ?? new Date().toISOString(),
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:w-3/4 sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{piece ? `Modifier ${L.article === "une" ? "la" : "le"} ${L.singular} ${pieceNumero(piece)}` : `Création d’${L.article} ${L.singular}`}</DialogTitle>
          <DialogDescription>
            {from ? `Lignes reprises du devis ${pieceNumero(from)}. ` : ""}Dossier {dossier.ref}. Enregistré en brouillon : vous pourrez l&apos;émettre ensuite.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-4">
            <Field>
              <FieldLabel htmlFor="pc-prefix">Préfixe</FieldLabel>
              <Input id="pc-prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="pc-num">Numéro du {L.singular}</FieldLabel>
              <Input id="pc-num" inputMode="numeric" value={numero} onChange={(e) => setNumero(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel>Date</FieldLabel>
              <DateInput value={date} onChange={setDate} />
            </Field>
            <Field>
              <FieldLabel htmlFor="pc-devise">Devise</FieldLabel>
              <Input id="pc-devise" value="EUR (Euro)" readOnly disabled />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="pc-obs">Observations</FieldLabel>
            <p className="-mt-1 text-xs text-muted-foreground">Affichées en bas du {L.singular}</p>
            <Textarea id="pc-obs" rows={4} value={observations} onChange={(e) => setObservations(e.target.value)} />
          </Field>

          <section className="flex flex-col gap-3">
            <h3 className="font-semibold">Produits</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                    <th className="w-16 pb-2 font-medium">Qté</th>
                    <th className="pb-2 font-medium">Service</th>
                    <th className="w-28 pb-2 font-medium">Unit HT</th>
                    <th className="w-20 pb-2 font-medium">TVA (%)</th>
                    <th className="w-24 pb-2 font-medium">Prix HT</th>
                    <th className="w-24 pb-2 font-medium">Prix TTC</th>
                    <th className="w-8 pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l) => {
                    const p = fromFLigne(l)
                    return (
                      <tr key={l.id} className="align-top">
                        <td className="pr-2 pb-2">
                          <Input aria-label="Quantité" inputMode="decimal" value={l.qty} onChange={(e) => setLigne(l.id, { qty: e.target.value })} />
                        </td>
                        <td className="pr-2 pb-2">
                          <Textarea
                            aria-label="Service"
                            rows={2}
                            className="min-h-0"
                            value={l.label}
                            placeholder={l.type === "service" ? "Description du service" : undefined}
                            onChange={(e) => setLigne(l.id, { label: e.target.value })}
                          />
                          {l.type !== "service" && <span className="text-xs text-muted-foreground">{l.type === "frais" ? "Frais" : "Remise (déduite du total)"}</span>}
                        </td>
                        <td className="pr-2 pb-2">
                          <Input aria-label="Prix unitaire HT" inputMode="decimal" value={l.unitHt} onChange={(e) => setLigne(l.id, { unitHt: e.target.value })} />
                        </td>
                        <td className="pr-2 pb-2">
                          <Input aria-label="TVA" inputMode="decimal" value={l.tva} onChange={(e) => setLigne(l.id, { tva: e.target.value })} />
                        </td>
                        <td className="pr-2 pb-2">
                          <Input aria-label="Prix HT" readOnly tabIndex={-1} value={ligneHt(p).toLocaleString("fr-FR")} />
                        </td>
                        <td className="pr-2 pb-2">
                          <Input aria-label="Prix TTC" readOnly tabIndex={-1} value={ligneTtc(p).toLocaleString("fr-FR")} />
                        </td>
                        <td className="pb-2">
                          <Button variant="ghost" size="icon-xs" aria-label="Retirer la ligne" onClick={() => setLignes((all) => all.filter((x) => x.id !== l.id))}>
                            <Trash2 />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                  {lignes.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-muted-foreground">
                        Aucune ligne : ajoutez un service, un frais ou une remise.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <dl className="ml-auto grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1 border-t pt-3 text-sm">
              <dt className="font-semibold">Montant HT</dt>
              <dd className="text-right font-semibold tabular-nums">{eur(t.ht)}</dd>
              <dt className="font-semibold">Montant TVA</dt>
              <dd className="text-right font-semibold tabular-nums">{eur(t.tva)}</dd>
              <dt className="font-semibold">Montant TTC</dt>
              <dd className="text-right font-semibold tabular-nums">{eur(t.ttc)}</dd>
            </dl>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => addLigne("service")}>
                <Plus /> Ajouter un service
              </Button>
              <Button variant="secondary" size="sm" onClick={() => addLigne("frais")}>
                <Plus /> Ajouter un frais
              </Button>
              <Button variant="secondary" size="sm" onClick={() => addLigne("remise")}>
                <Plus /> Ajouter une remise
              </Button>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="font-semibold">Informations du client</h3>
            <Field>
              <FieldLabel>Type de client</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {CLIENT_TYPES.map((c) => (
                  <Button key={c.value} size="sm" variant={clientType === c.value ? "default" : "secondary"} onClick={() => setClientType(c.value)}>
                    {c.label}
                  </Button>
                ))}
              </div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="pc-fn">Prénom</FieldLabel>
                <Input id="pc-fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="pc-ln">Nom</FieldLabel>
                <Input id="pc-ln" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="pc-email">Adresse e-mail *</FieldLabel>
                <Input id="pc-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="pc-addr">Adresse postale</FieldLabel>
                <Input id="pc-addr" value={address} onChange={(e) => setAddress(e.target.value)} />
              </Field>
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={!ok} onClick={save}>
            Valider
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Import d'un fichier (simulation) ────────────────────────────────────────

function ImportDialog({ dossier, kind, number, onClose, onSave }: { dossier: Dossier; kind: PieceKind; number:
number; onClose: () => void; onSave: (p: Piece) => void }) {
  const L = PIECE_LABELS[kind]
  const [file, setFile] = React.useState<string>("")
  const [numero, setNumero] = React.useState(String(number))
  const [date, setDate] = React.useState(today())
  const [ttc, setTtc] = React.useState("")
  const ok = !!file && num(ttc) > 0 && !!numero

  function save() {
    onSave({
      id: uid("p"),
      kind,
      prefix: `${L.prefix}-${new Date().getFullYear()}`,
      number: Math.round(num(numero)) || number,
      date: new Date(`${date}T12:00:00`).toISOString(),
      statut: "emis",
      fichier: file,
      lignes: [{ id: uid("l"), type: "service", label: `${L.plural.replace(/s$/, "")} importé — ${file}`, qty: 1, unitHt: Math.round((num(ttc) / 1.2) * 100) / 100, tva: 20 }],
      client: { type: "mandant", firstName: dossier.client.firstName, lastName: dossier.client.lastName, email: dossier.client.email, address: dossier.client.address },
      createdAt: new Date().toISOString(),
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Importer {L.article} {L.singular}</DialogTitle>
          <DialogDescription>Ajoute un PDF déjà établi ailleurs. Le fichier n&apos;est pas envoyé : seul son nom est conservé dans ce prototype.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="imp-file">Fichier (PDF)</FieldLabel>
            <Input id="imp-file" type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0]?.name ?? "")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="imp-num">Numéro</FieldLabel>
              <Input id="imp-num" inputMode="numeric" value={numero} onChange={(e) => setNumero(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel>Date</FieldLabel>
              <DateInput value={date} onChange={setDate} />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="imp-ttc">Montant TTC (€)</FieldLabel>
            <Input id="imp-ttc" inputMode="decimal" value={ttc} onChange={(e) => setTtc(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={!ok} onClick={save}>
            Importer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
