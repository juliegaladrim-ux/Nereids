"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Check, CircleDashed, Paperclip, Plus, Upload, X } from "lucide-react"

import { useRole } from "@/components/app-shell/role-context"
import { DictableTextarea } from "@/components/dictable-textarea"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  DOC_CATEGORIES,
  daysFromNow,
  departementFromAddress,
  departementRegion,
  dossierRef,
  expectedDocs,
  type DocCategory,
  type Dossier,
  type TimelineEvent,
} from "@/lib/data"
import { EMPTY_PERSONNE, PersonneFields, digits, letters, personneDefaults, toPersonne, type PersonneForm } from "@/features/admin/create-dossier"
import { nextDossierRef, useStore } from "@/lib/store"

type Demande = {
  client: PersonneForm
  clientProprietaire: boolean
  proprietaire: PersonneForm
  vehicule: { marque: string; modele: string; immat: string; vin: string }
  docs: Partial<Record<DocCategory, string[]>>
  autres: string[]
  demande: string
}

const EMPTY: Demande = {
  client: EMPTY_PERSONNE,
  clientProprietaire: true,
  proprietaire: EMPTY_PERSONNE,
  vehicule: { marque: "", modele: "", immat: "", vin: "" },
  docs: {},
  autres: [],
  demande: "",
}

/**
 * Création très simple pour le réparateur : le client, le véhicule, quelques pièces et une demande libre.
 * Nereids qualifie ensuite le dossier (type, expert, gestionnaire) depuis la fiche.
 */
export function CreateDemande() {
  const { user, href } = useRole()
  const { dossiers, createDossier } = useStore()
  const router = useRouter()
  const [f, setF] = React.useState<Demande>(EMPTY)
  const set = <K extends keyof Demande>(k: K, v: Demande[K]) => setF((p) => ({ ...p, [k]: v }))
  const setVehicule = (field: keyof Demande["vehicule"], v: string) => setF((p) => ({ ...p, vehicule: { ...p.vehicule, [field]: v } }))

  // Mêmes pièces que pour un litige automobile : le réparateur ne choisit pas de type de dossier
  const pieces = expectedDocs("litige_auto")

  function addFile(c: DocCategory) {
    set("docs", { ...f.docs, [c]: [...(f.docs[c] ?? []), `${DOC_CATEGORIES[c]}.pdf`] })
  }
  function removeFile(c: DocCategory, i: number) {
    set("docs", { ...f.docs, [c]: (f.docs[c] ?? []).filter((_, j) => j !== i) })
  }

  function submit() {
    // Proto : aucun champ bloquant, les champs vides sont remplis avec des données fictives
    const client = personneDefaults(f.client)
    const now = new Date().toISOString()
    const ref = nextDossierRef(dossiers)
    const departement = departementFromAddress(client.address) ?? "43 Haute-Loire"
    const documents = [
      ...Object.entries(f.docs).flatMap(([cat, files]) =>
        (files ?? []).map((name, i) => ({ id: `d-${ref}-${cat}-${i}`, name, category: cat as DocCategory, addedBy: user.id, addedAt: now, size: "1,0 Mo" })),
      ),
      ...f.autres.map((name, i) => ({ id: `d-${ref}-autre-${i}`, name, category: "autre" as const, addedBy: user.id, addedAt: now, size: "500 Ko" })),
    ]
    const timeline: TimelineEvent[] = [
      { id: `e-${ref}-1`, at: now, kind: "creation", author: user.id, title: "Demande transmise par le réparateur", body: user.structure },
    ]
    if (documents.length)
      timeline.push({ id: `e-${ref}-2`, at: now, kind: "document", author: user.id, title: `${documents.length} document(s) ajouté(s)` })

    const d: Dossier = {
      id: ref,
      ref: dossierRef(client, now),
      type: "litige_auto",
      createdBy: user.id,
      demandeReparateur: true,
      status: "nouveau",
      createdAt: now,
      updatedAt: now,
      client: toPersonne(client),
      proprietaire: f.clientProprietaire ? undefined : toPersonne(personneDefaults(f.proprietaire)),
      vehicule: {
        marque: f.vehicule.marque.trim() || "À préciser",
        modele: f.vehicule.modele.trim(),
        immat: (f.vehicule.immat.trim() || `${letters(2)}-${digits(3)}-${letters(2)}`).toUpperCase(),
        vin: f.vehicule.vin.trim() || undefined,
      },
      refs: {},
      region: departementRegion(departement) ?? "Auvergne-Rhône-Alpes",
      departement,
      intervenants: { reparateur: user.id, suiveurs: [] },
      pilotage: {
        ouEnEst: "Demande transmise par le réparateur, à qualifier par Nereids.",
        attente: "Qualification de la demande",
        prochaineAction: "Qualifier la demande et assigner les intervenants",
        quiDoitAgir: "nereids",
        echeance: daysFromNow(1),
      },
      expertise: { convoques: [] },
      documents,
      timeline,
      declaration: f.demande.trim() || undefined,
      noClientAccount: true,
    }
    createDossier(d)
    toast.success(`Demande ${ref} transmise`, { description: "Nereids qualifie le dossier et revient vers vous." })
    router.push(href(`dossiers/${ref}`))
  }

  const sectionNum = (n: number) => (
    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand/10 text-xs font-semibold text-brand-ink">{n}</span>
  )

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b bg-card px-4 sm:px-6">
        <Logo />
        <span className="h-6 w-px bg-border" />
        <span className="text-sm font-semibold">Nouvelle demande</span>
        <Button variant="ghost" size="icon" className="ml-auto" aria-label="Fermer" render={<Link href={href("dossiers")} />} nativeButton={false}>
          <X />
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 pt-8 pb-28 sm:px-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">Nouvelle demande</h1>
            <p className="mt-1 text-[15px] text-muted-foreground">
              Transmettez une demande à Nereids en quelques informations. Nereids qualifie le dossier et revient vers vous.
            </p>
          </div>

          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">{sectionNum(1)} Client</CardTitle>
              </CardHeader>
              <CardContent>
                <PersonneFields id="c" value={f.client} onChange={(v) => set("client", v)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">{sectionNum(2)} Véhicule</CardTitle>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="r-immat">Immatriculation</FieldLabel>
                      <Input id="r-immat" className="uppercase" placeholder="AB-123-CD" value={f.vehicule.immat} onChange={(e) => setVehicule("immat", e.target.value)} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="r-vin">VIN</FieldLabel>
                      <Input id="r-vin" className="uppercase" placeholder="Si disponible" value={f.vehicule.vin} onChange={(e) => setVehicule("vin", e.target.value)} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="r-marque">Marque</FieldLabel>
                      <Input id="r-marque" value={f.vehicule.marque} onChange={(e) => setVehicule("marque", e.target.value)} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="r-modele">Modèle</FieldLabel>
                      <Input id="r-modele" value={f.vehicule.modele} onChange={(e) => setVehicule("modele", e.target.value)} />
                    </Field>
                  </div>
                  <Field orientation="horizontal">
                    <Checkbox id="r-proprio" checked={f.clientProprietaire} onCheckedChange={(v) => set("clientProprietaire", !!v)} />
                    <FieldLabel htmlFor="r-proprio" className="font-normal">
                      Le client est le propriétaire du véhicule
                    </FieldLabel>
                  </Field>
                  {!f.clientProprietaire && (
                    <div className="flex flex-col gap-4 rounded-lg border p-4">
                      <p className="text-sm font-medium">Propriétaire du véhicule</p>
                      <PersonneFields id="p" value={f.proprietaire} onChange={(v) => set("proprietaire", v)} />
                    </div>
                  )}
                </FieldGroup>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">{sectionNum(3)} Pièces</CardTitle>
                <CardDescription>Les pièces manquantes peuvent être ajoutées plus tard.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {pieces.map((c) => {
                  const files = f.docs[c] ?? []
                  return (
                    <div key={c} className="rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        {files.length > 0 ? <Check className="size-4 text-tone-done" /> : <CircleDashed className="size-4 text-muted-foreground" />}
                        <span className="flex-1 text-sm font-medium">{DOC_CATEGORIES[c]}</span>
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

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">{sectionNum(4)} Votre demande</CardTitle>
              </CardHeader>
              <CardContent>
                <DictableTextarea
                  id="r-demande"
                  label="Expliquez la demande"
                  rows={5}
                  placeholder="Contexte, dommages constatés, ce que vous attendez de Nereids…"
                  value={f.demande}
                  onValueChange={(v) => set("demande", v)}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <footer className="shrink-0 border-t bg-card">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
          <Button variant="ghost" render={<Link href={href("dossiers")} />} nativeButton={false}>
            Annuler
          </Button>
          <Button onClick={submit}>Envoyer la demande</Button>
        </div>
      </footer>
    </div>
  )
}
