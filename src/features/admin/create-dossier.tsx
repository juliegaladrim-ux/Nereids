"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  AlertTriangle,
  Car,
  Check,
  CircleDashed,
  Gavel,
  Paperclip,
  Plus,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from "lucide-react"

import { useRole } from "@/components/app-shell/role-context"
import { Logo } from "@/components/logo"
import { SimpleSelect } from "@/components/simple-select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  DOC_CATEGORIES,
  DOSSIER_TYPES,
  LITIGE_ASSUR_TYPES,
  SINISTRE_TYPES,
  USERS,
  allUsers,
  compagnieLabel,
  daysFromNow,
  expectedDocs,
  fullName,
  type DocCategory,
  type Dossier,
  type DossierType,
  type LitigeAssurantielType,
  type SinistreType,
  type TimelineEvent,
  type User,
  dossierRef,
} from "@/lib/data"
import { nextDossierRef, useStore } from "@/lib/store"
import { cn } from "@/lib/utils"

type Form = {
  type?: DossierType
  sinistreType?: SinistreType
  litigeType?: LitigeAssurantielType
  client: { firstName: string; lastName: string; phone: string; email: string }
  vehicule: { marque: string; modele: string; immat: string; vin: string }
  compagnie: { nom: string; email: string; reference: string }
  tiers: { nom: string; phone: string; email: string }[]
  probleme: { description: string; date: string }
  docs: Partial<Record<DocCategory, string[]>>
  autres: string[]
  gestionnaire: string | null
  expert: string | null
  reparateur: string | null
  /** Ouvrir un compte au client (invitation e-mail) — activé par défaut, sauf pour les sinistres */
  clientAccount: boolean
}

const EMPTY: Form = {
  client: { firstName: "", lastName: "", phone: "", email: "" },
  vehicule: { marque: "", modele: "", immat: "", vin: "" },
  compagnie: { nom: "", email: "", reference: "" },
  tiers: [{ nom: "", phone: "", email: "" }],
  probleme: { description: "", date: "" },
  docs: {},
  autres: [],
  gestionnaire: null,
  expert: null,
  reparateur: null,
  clientAccount: true,
}

const TYPE_ICONS: Record<DossierType, React.ComponentType<{ className?: string }>> = {
  sinistre: Car,
  litige_auto: Gavel,
  litige_assurantiel: ShieldAlert,
}

const FAKE_FILES: Partial<Record<DocCategory, string>> = {
  constat: "Constat amiable.pdf",
  carte_grise: "Carte grise.pdf",
  photos: "Photo dommage.jpg",
  facture_achat: "Facture d'achat.pdf",
  facture: "Facture réparation.pdf",
  entretien: "Factures d'entretien.pdf",
  controle_technique: "Contrôle technique.pdf",
  recherche_marche: "Annonces similaires.pdf",
  rapport_compagnie: "Rapport compagnie.pdf",
}

export function CreateDossier() {
  const { user, href } = useRole()
  const { dossiers, createDossier } = useStore()
  const router = useRouter()
  const [f, setF] = React.useState<Form>(EMPTY)
  /** Experts / réparateurs saisis à la main (hors liste) */
  const [added, setAdded] = React.useState<User[]>([])
  const [creating, setCreating] = React.useState<NewRole | null>(null)
  const [submitted, setSubmitted] = React.useState(false)

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }))
  const setIn = <K extends "client" | "vehicule" | "compagnie" | "probleme">(k: K, field: keyof Form[K], v: string) =>
    setF((p) => ({ ...p, [k]: { ...p[k], [field]: v } }))

  const horsRecours = f.type === "sinistre" && !!f.sinistreType && !SINISTRE_TYPES[f.sinistreType].recours
  const typeComplete =
    !!f.type &&
    (f.type !== "sinistre" || !!f.sinistreType) &&
    (f.type !== "litige_assurantiel" || !!f.litigeType)
  const docsExpected = f.type ? expectedDocs(f.type, f.litigeType) : []
  const minPhotos = f.litigeType === "imputable" ? 3 : 1

  // Validation minimale (CDC §4.2 étape 1 : données minimales)
  const errors = {
    type: !typeComplete,
    clientNom: !f.client.lastName.trim() || !f.client.firstName.trim(),
    clientContact: !f.client.phone.trim() && !f.client.email.trim(),
    // L'invitation part par e-mail : pas de compte sans adresse
    clientEmail: f.clientAccount && !f.client.email.trim(),
    immat: !f.vehicule.immat.trim(),
    marque: !f.vehicule.marque.trim(),
  }
  const isValid = !Object.values(errors).some(Boolean)

  const missingDocs = docsExpected.filter((c) => {
    const n = f.docs[c]?.length ?? 0
    return c === "photos" ? n < minPhotos : n === 0
  })

  function addFile(c: DocCategory) {
    const name = FAKE_FILES[c] ?? `${DOC_CATEGORIES[c]}.pdf`
    const list = f.docs[c] ?? []
    const fileName = c === "photos" ? `Photo dommage ${list.length + 1}.jpg` : name
    set("docs", { ...f.docs, [c]: [...list, fileName] })
  }
  function removeFile(c: DocCategory, i: number) {
    set("docs", { ...f.docs, [c]: (f.docs[c] ?? []).filter((_, j) => j !== i) })
  }

  function submit() {
    setSubmitted(true)
    if (!isValid) {
      toast.error("Il manque des informations obligatoires")
      document.querySelector("[data-invalid=true]")?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }
    const now = new Date().toISOString()
    const ref = nextDossierRef(dossiers)
    const assigned = !!f.gestionnaire && !!f.expert
    const invite = f.clientAccount
    const status = horsRecours ? "cloture" : assigned ? "en_etude" : "nouveau"

    const documents = [
      ...Object.entries(f.docs).flatMap(([cat, files]) =>
        (files ?? []).map((name, i) => ({
          id: `d-${ref}-${cat}-${i}`,
          name,
          category: cat as DocCategory,
          addedBy: user.id,
          addedAt: now,
          size: "1,0 Mo",
        })),
      ),
      ...f.autres.map((name, i) => ({ id: `d-${ref}-autre-${i}`, name, category: "autre" as const, addedBy: user.id, addedAt: now, size: "500 Ko" })),
    ]

    const timeline: TimelineEvent[] = [
      {
        id: `e-${ref}-1`,
        at: now,
        kind: "creation",
        author: user.id,
        title: "Dossier créé",
        body: [
          DOSSIER_TYPES[f.type!].label,
          f.sinistreType && SINISTRE_TYPES[f.sinistreType].label,
          f.litigeType && LITIGE_ASSUR_TYPES[f.litigeType].label,
        ]
          .filter(Boolean)
          .join(" — "),
      },
    ]
    if (documents.length)
      timeline.push({ id: `e-${ref}-2`, at: now, kind: "document", author: user.id, title: `${documents.length} document(s) ajouté(s)` })
    if (f.gestionnaire || f.expert || f.reparateur)
      timeline.push({
        id: `e-${ref}-3`,
        at: now,
        kind: "assignation",
        author: user.id,
        title: "Intervenants assignés",
        body: [f.gestionnaire, f.expert, f.reparateur]
          .filter(Boolean)
          .map((id) => fullName([...USERS, ...added].find((u) => u.id === id)))
          .join(" · "),
      })
    if (status !== "nouveau")
      timeline.push({
        id: `e-${ref}-4`,
        at: now,
        kind: "status",
        author: "system",
        title: horsRecours ? "Statut → Clôturé" : "Statut → En étude",
        body: horsRecours ? "Motif : Hors périmètre (sinistre hors recours direct)" : undefined,
      })

    const d: Dossier = {
      id: ref,
      ref: dossierRef(f.client, now, [...allUsers(), ...added].find((u) => u.id === f.expert)?.structure),
      type: f.type!,
      sinistreType: f.sinistreType,
      litigeType: f.litigeType,
      status,
      createdAt: now,
      updatedAt: now,
      client: { ...f.client },
      vehicule: { ...f.vehicule, immat: f.vehicule.immat.toUpperCase(), vin: f.vehicule.vin || undefined },
      compagnie: f.compagnie.nom ? { ...f.compagnie } : undefined,
      tiers: f.type === "litige_auto" ? f.tiers.filter((t) => t.nom).map((t) => ({ nom: t.nom, phone: t.phone || undefined, email: t.email || undefined })) : undefined,
      refs: { sinistre: f.compagnie.reference || undefined },
      region: "Auvergne-Rhône-Alpes",
      intervenants: {
        gestionnaire: f.gestionnaire ?? undefined,
        expert: f.expert ?? undefined,
        reparateur: f.reparateur ?? undefined,
        suiveurs: [],
      },
      extraIntervenants: added.filter((u) => u.id === f.expert || u.id === f.reparateur),
      pilotage: horsRecours
        ? { ouEnEst: "Dossier enregistré, hors module recours direct.", attente: "—", prochaineAction: "Archiver le dossier", quiDoitAgir: "nereids" }
        : assigned
          ? {
              ouEnEst: "Dossier créé et transmis à l'expert pour étude.",
              attente: missingDocs.length ? `Validation de l'expert · ${missingDocs.length} pièce(s) manquante(s)` : "Validation du dossier par l'expert",
              prochaineAction: "Étudier le dossier et valider le recours",
              quiDoitAgir: "expert",
              echeance: daysFromNow(3),
            }
          : {
              ouEnEst: "Dossier créé, en attente d'assignation.",
              attente: "Assignation d'un gestionnaire et d'un expert",
              prochaineAction: "Assigner les intervenants",
              quiDoitAgir: "nereids",
              echeance: daysFromNow(1),
            },
      expertise: { convoques: [] },
      documents,
      timeline,
      description: f.probleme.description || undefined,
      horsPerimetre: horsRecours || undefined,
      clientAccess: invite ? { invitedAt: now } : undefined,
      noClientAccount: invite ? undefined : true,
      cloture: horsRecours ? { motif: "Hors périmètre", at: now } : undefined,
    }
    createDossier(d)
    toast.success(`Dossier ${ref} créé`, {
      description: [assigned && "Les intervenants assignés ont été notifiés.", invite ? "Le client a reçu une invitation par e-mail." : "Aucun compte client ouvert."].filter(Boolean).join(" ") || undefined,
    })
    router.push(href(`dossiers/${ref}`))
  }

  const sectionNum = (n: number) => (
    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand/10 text-xs font-semibold text-brand-ink">{n}</span>
  )

  return (
    // Assistant plein écran façon Deel : logo + fermeture en haut, étapes à droite, actions en pied de page
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b bg-card px-4 sm:px-6">
        <Logo />
        <span className="h-6 w-px bg-border" />
        <span className="text-sm font-semibold">Nouveau dossier</span>
        <Button variant="ghost" size="icon" className="ml-auto" aria-label="Fermer" render={<Link href={href("dossiers")} />} nativeButton={false}>
          <X />
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-4 pt-8 pb-28 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">Nouveau dossier</h1>
        <p className="mt-1 text-[15px] text-muted-foreground">Renseignez l&apos;essentiel : le reste pourra être complété plus tard.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* 1. Type */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">{sectionNum(1)} Type de dossier</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="grid gap-3 sm:grid-cols-3" data-invalid={submitted && !f.type}>
                {(Object.keys(DOSSIER_TYPES) as DossierType[]).map((t) => {
                  const Icon = TYPE_ICONS[t]
                  return (
                    <ChoiceCard
                      key={t}
                      selected={f.type === t}
                      onClick={() => setF((p) => ({ ...p, type: t, sinistreType: undefined, litigeType: undefined, clientAccount: t !== "sinistre" }))}
                      icon={<Icon className="size-5" />}
                      title={DOSSIER_TYPES[t].label}
                      description={DOSSIER_TYPES[t].description}
                    />
                  )
                })}
              </div>
              {submitted && !f.type && <FieldError>Choisissez un type de dossier.</FieldError>}

              {f.type === "sinistre" && (
                <div className="flex flex-col gap-3">
                  <p className="text-sm font-medium">Type de sinistre</p>
                  <div className="grid gap-2 sm:grid-cols-3" data-invalid={submitted && !f.sinistreType}>
                    {(Object.keys(SINISTRE_TYPES) as SinistreType[]).map((s) => (
                      <ChoiceCard key={s} compact selected={f.sinistreType === s} onClick={() => set("sinistreType", s)} title={SINISTRE_TYPES[s].label} description={SINISTRE_TYPES[s].recours ? "Recours direct" : undefined} />
                    ))}
                  </div>
                  {horsRecours && (
                    <Alert variant="warning">
                      <AlertTriangle />
                      <AlertTitle>Hors module recours direct</AlertTitle>
                      <AlertDescription>
                        Le dossier sera enregistré et classé « hors périmètre ». Seules les informations client et véhicule sont nécessaires.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {f.type === "litige_assurantiel" && (
                <div className="flex flex-col gap-3">
                  <p className="text-sm font-medium">Type de litige</p>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" data-invalid={submitted && !f.litigeType}>
                    {(Object.keys(LITIGE_ASSUR_TYPES) as LitigeAssurantielType[]).map((l) => (
                      <ChoiceCard key={l} compact selected={f.litigeType === l} onClick={() => set("litigeType", l)} title={LITIGE_ASSUR_TYPES[l].label} description={LITIGE_ASSUR_TYPES[l].hint} />
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {typeComplete && (
            <>
              {/* 2. Client & véhicule */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">{sectionNum(2)} Client et véhicule</CardTitle>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field data-invalid={submitted && !f.client.firstName.trim()}>
                        <FieldLabel htmlFor="c-first">Prénom *</FieldLabel>
                        <Input id="c-first" value={f.client.firstName} onChange={(e) => setIn("client", "firstName", e.target.value)} />
                      </Field>
                      <Field data-invalid={submitted && !f.client.lastName.trim()}>
                        <FieldLabel htmlFor="c-last">Nom *</FieldLabel>
                        <Input id="c-last" value={f.client.lastName} onChange={(e) => setIn("client", "lastName", e.target.value)} />
                      </Field>
                      <Field data-invalid={submitted && errors.clientContact}>
                        <FieldLabel htmlFor="c-phone">Téléphone</FieldLabel>
                        <Input id="c-phone" type="tel" value={f.client.phone} onChange={(e) => setIn("client", "phone", e.target.value)} />
                      </Field>
                      <Field data-invalid={submitted && (errors.clientContact || errors.clientEmail)}>
                        <FieldLabel htmlFor="c-mail">E-mail{f.clientAccount && " *"}</FieldLabel>
                        <Input id="c-mail" type="email" value={f.client.email} onChange={(e) => setIn("client", "email", e.target.value)} />
                      </Field>
                    </div>
                    {submitted && errors.clientContact && <FieldError>Indiquez au moins un téléphone ou un e-mail.</FieldError>}
                    {submitted && !errors.clientContact && errors.clientEmail && (
                      <FieldError>Indiquez l&apos;e-mail du client pour lui ouvrir un compte, ou désactivez l&apos;ouverture du compte.</FieldError>
                    )}

                    <Field orientation="horizontal" className="rounded-lg border p-3">
                      <Switch id="c-account" checked={f.clientAccount} onCheckedChange={(v) => set("clientAccount", v)} />
                      <div className="flex flex-col gap-0.5">
                        <FieldLabel htmlFor="c-account">Ouvrir un compte au client</FieldLabel>
                        <FieldDescription>
                          {f.clientAccount
                            ? "Le client reçoit une invitation par e-mail pour suivre son dossier et envoyer ses pièces."
                            : "Aucune invitation envoyée : Nereids gère le dossier seul. Vous pourrez inviter le client plus tard depuis la fiche."}
                        </FieldDescription>
                      </div>
                    </Field>

                    <div className="grid gap-4 border-t pt-5 sm:grid-cols-2">
                      <Field data-invalid={submitted && errors.immat}>
                        <FieldLabel htmlFor="v-immat">Immatriculation *</FieldLabel>
                        <Input id="v-immat" className="font-mono uppercase" placeholder="AB-123-CD" value={f.vehicule.immat} onChange={(e) => setIn("vehicule", "immat", e.target.value)} />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="v-vin">VIN</FieldLabel>
                        <Input id="v-vin" className="font-mono uppercase" placeholder="Si disponible" value={f.vehicule.vin} onChange={(e) => setIn("vehicule", "vin", e.target.value)} />
                      </Field>
                      <Field data-invalid={submitted && errors.marque}>
                        <FieldLabel htmlFor="v-marque">Marque *</FieldLabel>
                        <Input id="v-marque" value={f.vehicule.marque} onChange={(e) => setIn("vehicule", "marque", e.target.value)} />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="v-modele">Modèle</FieldLabel>
                        <Input id="v-modele" value={f.vehicule.modele} onChange={(e) => setIn("vehicule", "modele", e.target.value)} />
                      </Field>
                    </div>
                  </FieldGroup>
                </CardContent>
              </Card>

              {!horsRecours && (
                <>
                  {/* 3. Compagnie / parties */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        {sectionNum(3)} {f.type === "litige_auto" ? "Parties au litige" : compagnieLabel(f.type!)}
                      </CardTitle>
                      <CardDescription>
                        {f.type === "sinistre" && "Compagnie du tiers responsable, si elle est connue."}
                        {f.type === "litige_assurantiel" && "La compagnie contestée par le client."}
                        {f.type === "litige_auto" && "Vendeur, garage…"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <FieldGroup>
                        {f.type === "litige_auto" &&
                          f.tiers.map((t, i) => (
                            <div key={i} className="grid gap-4 sm:grid-cols-3">
                              <Field>
                                <FieldLabel>Tiers {i + 1} — nom ou raison sociale</FieldLabel>
                                <Input value={t.nom} placeholder="Ex. garage, vendeur…" onChange={(e) => set("tiers", f.tiers.map((x, j) => (j === i ? { ...x, nom: e.target.value } : x)))} />
                              </Field>
                              <Field>
                                <FieldLabel>Téléphone</FieldLabel>
                                <Input type="tel" value={t.phone} onChange={(e) => set("tiers", f.tiers.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))} />
                              </Field>
                              <Field>
                                <FieldLabel>E-mail</FieldLabel>
                                <div className="flex gap-2">
                                  <Input type="email" value={t.email} onChange={(e) => set("tiers", f.tiers.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} />
                                  {i > 0 && (
                                    <Button variant="ghost" size="icon" aria-label="Retirer" onClick={() => set("tiers", f.tiers.filter((_, j) => j !== i))}>
                                      <Trash2 />
                                    </Button>
                                  )}
                                </div>
                              </Field>
                            </div>
                          ))}
                        {f.type === "litige_auto" && f.tiers.length < 2 && (
                          <Button variant="outline" size="sm" className="w-fit" onClick={() => set("tiers", [...f.tiers, { nom: "", phone: "", email: "" }])}>
                            <Plus /> Ajouter un 2ᵉ tiers
                          </Button>
                        )}

                        {f.type !== "litige_auto" && (
                          <div className="grid gap-4 sm:grid-cols-3">
                            <Field>
                              <FieldLabel htmlFor="co-nom">Nom de la compagnie</FieldLabel>
                              <Input id="co-nom" value={f.compagnie.nom} onChange={(e) => setIn("compagnie", "nom", e.target.value)} />
                            </Field>
                            <Field>
                              <FieldLabel htmlFor="co-mail">E-mail</FieldLabel>
                              <Input id="co-mail" type="email" value={f.compagnie.email} onChange={(e) => setIn("compagnie", "email", e.target.value)} />
                            </Field>
                            <Field>
                              <FieldLabel htmlFor="co-ref">Référence sinistre</FieldLabel>
                              <Input id="co-ref" value={f.compagnie.reference} onChange={(e) => setIn("compagnie", "reference", e.target.value)} />
                            </Field>
                          </div>
                        )}

                        {f.litigeType === "imputable" && (
                          <div className="grid gap-4 border-t pt-5 sm:grid-cols-[1fr_200px]">
                            <Field>
                              <FieldLabel htmlFor="pb-desc">Problème constaté</FieldLabel>
                              <Textarea id="pb-desc" rows={3} value={f.probleme.description} onChange={(e) => setIn("probleme", "description", e.target.value)} placeholder="Décrivez le dommage et ses circonstances" />
                            </Field>
                            <Field>
                              <FieldLabel htmlFor="pb-date">Date de constatation</FieldLabel>
                              <Input id="pb-date" type="date" value={f.probleme.date} onChange={(e) => setIn("probleme", "date", e.target.value)} />
                            </Field>
                          </div>
                        )}
                      </FieldGroup>
                    </CardContent>
                  </Card>

                  {/* 4. Pièces */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">{sectionNum(4)} Pièces du dossier</CardTitle>
                      <CardDescription>Les pièces manquantes peuvent être ajoutées plus tard, par vous ou par le client.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                      {docsExpected.map((c) => {
                        const files = f.docs[c] ?? []
                        const ok = c === "photos" ? files.length >= minPhotos : files.length > 0
                        return (
                          <div key={c} className="rounded-lg border p-3">
                            <div className="flex items-center gap-3">
                              {ok ? <Check className="size-4 text-tone-done" /> : <CircleDashed className="size-4 text-muted-foreground" />}
                              <span className="flex-1 text-sm font-medium">
                                {DOC_CATEGORIES[c]}
                                {c === "photos" && minPhotos > 1 && (
                                  <span className="ml-2 font-normal text-muted-foreground">
                                    {files.length}/{minPhotos} minimum
                                  </span>
                                )}
                              </span>
                              <Button size="sm" variant="outline" onClick={() => addFile(c)}>
                                <Upload /> Ajouter
                              </Button>
                            </div>
                            {files.length > 0 && (
                              <ul className="mt-2 flex flex-wrap gap-1.5 pl-7">
                                {files.map((name, i) => (
                                  <li key={i} className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">
                                    <Paperclip className="size-3" /> {name}
                                    <button className="ml-1 text-muted-foreground hover:text-foreground" onClick={() => removeFile(c, i)} aria-label="Retirer">
                                      ×
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )
                      })}
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => set("autres", [...f.autres, `Pièce complémentaire ${f.autres.length + 1}.pdf`])}>
                          <Plus /> Autre pièce utile
                        </Button>
                        {f.autres.map((name, i) => (
                          <span key={i} className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">
                            <Paperclip className="size-3" /> {name}
                          </span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* 5. Intervenants */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">{sectionNum(5)} Intervenants</CardTitle>
                      <CardDescription>Optionnel : vous pourrez assigner les intervenants depuis la fiche dossier.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <AssignFields
                        value={{ gestionnaire: f.gestionnaire, expert: f.expert, reparateur: f.reparateur }}
                        onChange={(k, v) => set(k, v)}
                        added={added}
                        onCreate={setCreating}
                      />
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          )}
        </div>

        {/* Étapes */}
        <aside className="lg:sticky lg:top-0 lg:self-start">
          <Card size="sm">
            <CardContent className="text-sm">
              <ul className="flex flex-col gap-1">
                <RecapItem ok={typeComplete} label="Type de dossier" detail={f.type ? DOSSIER_TYPES[f.type].label : undefined} />
                <RecapItem
                  ok={!errors.clientNom && !errors.clientContact && !errors.clientEmail}
                  label="Client"
                  detail={
                    [f.client.lastName && `${f.client.firstName} ${f.client.lastName}`, typeComplete && (f.clientAccount ? "Compte ouvert" : "Sans compte")]
                      .filter(Boolean)
                      .join(" · ") || undefined
                  }
                />
                <RecapItem ok={!errors.immat && !errors.marque} label="Véhicule" detail={f.vehicule.immat ? `${f.vehicule.immat.toUpperCase()} ${f.vehicule.marque}` : undefined} />
                {!horsRecours && typeComplete && (
                  <>
                    {f.type !== "litige_auto" && <RecapItem optional ok={!!f.compagnie.nom} label={compagnieLabel(f.type!)} detail={f.compagnie.nom || undefined} />}
                    <RecapItem optional ok={missingDocs.length === 0} label="Pièces" detail={missingDocs.length ? `${missingDocs.length} manquante(s)` : "Complètes"} />
                    <RecapItem optional ok={!!f.gestionnaire && !!f.expert} label="Intervenants" detail={f.gestionnaire && f.expert ? "Gestionnaire et expert" : "À assigner"} />
                  </>
                )}
              </ul>
            </CardContent>
          </Card>
        </aside>
      </div>
      </div>
      </div>

      <footer className="shrink-0 border-t bg-card">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Button variant="ghost" render={<Link href={href("dossiers")} />} nativeButton={false}>
            Annuler
          </Button>
          <Button onClick={submit}>{horsRecours ? "Enregistrer" : "Créer le dossier"}</Button>
        </div>
      </footer>

      {/* Saisie d'un expert / réparateur absent de la liste */}
      <Dialog open={!!creating} onOpenChange={(o) => !o && setCreating(null)}>
        <DialogContent className="sm:max-w-lg">
          {creating && (
            <>
              <DialogHeader>
                <DialogTitle>{NEW_LABELS[creating].title}</DialogTitle>
                <DialogDescription>Pour un intervenant qui n&apos;est pas encore dans la liste.</DialogDescription>
              </DialogHeader>
              <NewIntervenantForm
                role={creating}
                onAdd={(u) => {
                  setAdded((a) => [...a, u])
                  set(creating, u.id)
                  setCreating(null)
                }}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreating(null)}>
                  Annuler
                </Button>
                <Button type="submit" form={NEW_INTERVENANT_FORM}>
                  {NEW_LABELS[creating].submit}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ChoiceCard({
  selected,
  onClick,
  icon,
  title,
  description,
  compact,
}: {
  selected: boolean
  onClick: () => void
  icon?: React.ReactNode
  title: string
  description?: string
  compact?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex flex-col items-start gap-1 rounded-lg border bg-background text-left transition-colors hover:border-foreground/30",
        compact ? "p-3" : "p-4",
        selected && "border-brand bg-brand/[0.04] ring-1 ring-brand hover:border-brand",
      )}
    >
      {icon && <span className={cn("mb-1 text-muted-foreground", selected && "text-brand-ink")}>{icon}</span>}
      <span className="text-sm font-medium">{title}</span>
      {description && <span className="text-xs text-muted-foreground">{description}</span>}
    </button>
  )
}

/** Étape façon Deel : « Terminé » en vert au-dessus du libellé quand c'est rempli */
function RecapItem({ ok, label, detail, optional }: { ok: boolean; label: string; detail?: string; optional?: boolean }) {
  return (
    <li className={cn("flex items-start gap-2.5 rounded-md px-2 py-2", !ok && !optional && "bg-muted/70")}>
      {ok ? (
        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-tone-done text-white">
          <Check className="size-3" strokeWidth={3} />
        </span>
      ) : (
        <CircleDashed className={cn("mt-0.5 size-5 shrink-0", optional ? "text-muted-foreground/60" : "text-muted-foreground")} />
      )}
      <div className="min-w-0">
        {ok && <span className="block text-[11px] leading-tight font-semibold tracking-wide text-tone-done uppercase">Terminé</span>}
        {!ok && optional && <span className="block text-[11px] leading-tight font-semibold tracking-wide text-muted-foreground uppercase">Optionnel</span>}
        <span className={cn("block font-medium", optional && !ok && "text-muted-foreground")}>{label}</span>
        {detail && <span className="block truncate text-xs text-muted-foreground">{detail}</span>}
      </div>
    </li>
  )
}

export type AssignValue = { gestionnaire: string | null; expert: string | null; reparateur: string | null }
export type NewRole = "expert" | "reparateur"

/**
 * Champs d'assignation — réutilisés dans la création et dans la fiche dossier.
 * L'intervenant suiveur ne s'assigne pas ici : son compte est ouvert à la demande du client.
 * « Ajouter un expert / réparateur » (en bas de chaque liste) ouvre l'écran de saisie géré par le parent.
 */
export function AssignFields({
  value,
  onChange,
  added,
  onCreate,
}: {
  value: AssignValue
  onChange: (k: keyof AssignValue, v: string | null) => void
  /** Intervenants saisis à la main, pas encore enregistrés sur le dossier */
  added: User[]
  onCreate: (role: NewRole) => void
}) {
  const opts = (role: string) =>
    [...allUsers(), ...added].filter((u) => u.role === role).map((u) => ({
      value: u.id,
      label: role === "reparateur" ? u.structure : fullName(u),
      hint: u.load !== undefined ? `${u.load} dossiers` : added.includes(u) ? "Ajouté à la main" : undefined,
    }))
  return (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel>Gestionnaire</FieldLabel>
        <SimpleSelect placeholder="Choisir un gestionnaire" options={opts("gestionnaire")} value={value.gestionnaire} onChange={(v) => onChange("gestionnaire", v)} />
      </Field>
      <Field>
        <FieldLabel>Expert</FieldLabel>
        <SimpleSelect
          placeholder="Choisir un expert"
          options={opts("expert")}
          value={value.expert}
          onChange={(v) => onChange("expert", v)}
          action={{ label: "Ajouter un expert", onSelect: () => onCreate("expert") }}
        />
      </Field>
      <Field>
        <FieldLabel>Réparateur</FieldLabel>
        <SimpleSelect
          placeholder="Optionnel"
          options={opts("reparateur")}
          value={value.reparateur}
          onChange={(v) => onChange("reparateur", v)}
          action={{ label: "Ajouter un réparateur", onSelect: () => onCreate("reparateur") }}
        />
      </Field>
    </div>
  )
}

export const NEW_INTERVENANT_FORM = "new-intervenant"
export const NEW_LABELS: Record<NewRole, { title: string; submit: string }> = {
  expert: { title: "Ajouter un expert", submit: "Ajouter l'expert" },
  reparateur: { title: "Ajouter un réparateur", submit: "Ajouter le réparateur" },
}

/**
 * Saisie d'un expert ou d'un réparateur absent de la liste.
 * Le bouton d'envoi est dans le pied de la modale du parent (attribut form={NEW_INTERVENANT_FORM}).
 */
export function NewIntervenantForm({ role, onAdd }: { role: NewRole; onAdd: (u: User) => void }) {
  const [v, setV] = React.useState({ structure: "", firstName: "", lastName: "", phone: "", email: "" })
  const [tried, setTried] = React.useState(false)
  const isExpert = role === "expert"
  const missing: Partial<Record<keyof typeof v, boolean>> = {
    structure: !isExpert && !v.structure.trim(),
    firstName: isExpert && !v.firstName.trim(),
    lastName: isExpert && !v.lastName.trim(),
    email: !/^\S+@\S+\.\S+$/.test(v.email.trim()),
  }
  const field = (k: keyof typeof v, label: string, type = "text") => {
    const invalid = tried && missing[k] ? true : undefined
    return (
      <Field data-invalid={invalid}>
        <FieldLabel htmlFor={`new-${k}`}>{label}</FieldLabel>
        <Input id={`new-${k}`} type={type} value={v[k]} aria-invalid={invalid} onChange={(e) => setV((p) => ({ ...p, [k]: e.target.value }))} />
      </Field>
    )
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setTried(true)
    if (Object.values(missing).some(Boolean)) return
    onAdd({
      id: `u-m-${Date.now().toString(36)}`,
      role,
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim(),
      email: v.email.trim(),
      phone: v.phone.trim(),
      structure: v.structure.trim() || (isExpert ? "Expert indépendant" : "Réparateur"),
      fonction: isExpert ? "Expert automobile" : "",
    })
  }

  return (
    <form id={NEW_INTERVENANT_FORM} onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      {isExpert ? (
        <>
          {field("firstName", "Prénom")}
          {field("lastName", "Nom")}
          <div className="sm:col-span-2">{field("structure", "Cabinet (optionnel)")}</div>
        </>
      ) : (
        <>
          <div className="sm:col-span-2">{field("structure", "Garage")}</div>
          {field("firstName", "Prénom du contact (optionnel)")}
          {field("lastName", "Nom du contact (optionnel)")}
        </>
      )}
      {field("email", "E-mail", "email")}
      {field("phone", "Téléphone (optionnel)", "tel")}
      <p className="text-sm text-muted-foreground sm:col-span-2">Il recevra une invitation par e-mail une fois l&apos;assignation enregistrée.</p>
    </form>
  )
}
