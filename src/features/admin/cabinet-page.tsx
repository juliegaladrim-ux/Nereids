"use client"

import * as React from "react"
import { Building2, Landmark, Plus, Upload, Users } from "lucide-react"
import { toast } from "sonner"

import { useRole } from "@/components/app-shell/role-context"
import { PageHeader } from "@/components/page-header"
import { SimpleSelect } from "@/components/simple-select"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { UserAvatar } from "@/components/user-avatar"
import { userOrg, useAnnuaire, type Organisation } from "@/lib/annuaire"
import { allUsers, fullName, type User } from "@/lib/data"
import { useStore } from "@/lib/store"

const ROLE_LABEL: Record<string, string> = { expert: "Expert", gestionnaire: "Gestionnaire", admin_cabinet: "Administrateur" }

/** Espace de l'administrateur du cabinet : fiche du cabinet (infos, logo, RIB) et équipe (gestionnaires, experts) */
export function CabinetPage() {
  const { user } = useRole()
  const { orgs } = useAnnuaire()
  const org = userOrg(user, orgs)
  if (!org) return <PageHeader title="Mon cabinet" description="Aucun cabinet rattaché à votre compte." />
  return <CabinetContent key={org.id} org={org} me={user} />
}

function CabinetContent({ org, me }: { org: Organisation; me: User }) {
  const { saveOrg, inviteUser, accounts } = useStore()
  const { orgs } = useAnnuaire()
  const [f, setF] = React.useState({
    nom: org.nom,
    siret: org.siret ?? "",
    phone: org.phone ?? "",
    email: org.email ?? "",
    address: org.address ?? "",
    titulaire: org.rib?.titulaire ?? org.nom,
    iban: org.rib?.iban ?? "",
    bic: org.rib?.bic ?? "",
    logo: org.logo ?? "",
  })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }))
  const [open, setOpen] = React.useState(false)

  const dirty =
    f.nom !== org.nom ||
    f.siret !== (org.siret ?? "") ||
    f.phone !== (org.phone ?? "") ||
    f.email !== (org.email ?? "") ||
    f.address !== (org.address ?? "") ||
    f.iban !== (org.rib?.iban ?? "") ||
    f.bic !== (org.rib?.bic ?? "") ||
    f.titulaire !== (org.rib?.titulaire ?? org.nom) ||
    f.logo !== (org.logo ?? "")

  const save = () => {
    saveOrg({
      ...org,
      nom: f.nom.trim() || org.nom,
      siret: f.siret.trim() || undefined,
      phone: f.phone.trim() || undefined,
      email: f.email.trim() || undefined,
      address: f.address.trim() || undefined,
      logo: f.logo || undefined,
      rib: f.iban.trim() ? { titulaire: f.titulaire.trim() || undefined, iban: f.iban.trim(), bic: f.bic.trim() || undefined } : undefined,
    })
    toast.success("Fiche du cabinet enregistrée")
  }

  const pickLogo = (file?: File) => {
    if (!file) return
    const r = new FileReader()
    r.onload = () => setF((s) => ({ ...s, logo: String(r.result) }))
    r.readAsDataURL(file)
  }

  // Équipe : tous les comptes rattachés au cabinet
  const team = React.useMemo(
    () => allUsers().filter((u) => ["expert", "gestionnaire", "admin_cabinet"].includes(u.role) && userOrg(u, orgs)?.id === org.id),
    // accounts : les invitations ajoutent des utilisateurs
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orgs, accounts, org.id],
  )

  return (
    <>
      <PageHeader title="Mon cabinet" description="Ces informations apparaissent sur les devis et les factures, et le RIB est accessible à vos clients dans leur dossier." />

      <div className="flex flex-col gap-6">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold">
            <Building2 className="size-4 text-muted-foreground" /> Informations du cabinet
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="c-nom">Nom du cabinet</FieldLabel>
              <Input id="c-nom" value={f.nom} onChange={set("nom")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="c-siret">SIRET</FieldLabel>
              <Input id="c-siret" value={f.siret} onChange={set("siret")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="c-email">E-mail</FieldLabel>
              <Input id="c-email" type="email" value={f.email} onChange={set("email")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="c-phone">Téléphone</FieldLabel>
              <Input id="c-phone" value={f.phone} onChange={set("phone")} />
            </Field>
            <Field className="md:col-span-2">
              <FieldLabel htmlFor="c-addr">Adresse postale</FieldLabel>
              <Input id="c-addr" value={f.address} onChange={set("address")} />
            </Field>
            <Field className="md:col-span-2">
              <FieldLabel>Logo</FieldLabel>
              <div className="flex items-center gap-4">
                <div className="flex size-16 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
                  {f.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.logo} alt="Logo du cabinet" className="size-full object-contain" />
                  ) : (
                    <Building2 className="size-6 text-muted-foreground" />
                  )}
                </div>
                <Button variant="outline" size="sm" nativeButton={false} render={<label className="cursor-pointer" />}>
                  <Upload /> {f.logo ? "Changer le logo" : "Ajouter un logo"}
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => pickLogo(e.target.files?.[0])} />
                </Button>
                {f.logo && (
                  <Button variant="ghost" size="sm" onClick={() => setF((s) => ({ ...s, logo: "" }))}>
                    Retirer
                  </Button>
                )}
              </div>
            </Field>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-1 flex items-center gap-2 text-base font-semibold">
            <Landmark className="size-4 text-muted-foreground" /> RIB du cabinet
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">Affiché au client dans le dossier et sur vos factures pour faciliter le règlement.</p>
          <div className="grid gap-4 md:grid-cols-2">
            <Field className="md:col-span-2">
              <FieldLabel htmlFor="c-tit">Titulaire du compte</FieldLabel>
              <Input id="c-tit" value={f.titulaire} onChange={set("titulaire")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="c-iban">IBAN</FieldLabel>
              <Input id="c-iban" value={f.iban} onChange={set("iban")} placeholder="FR76 …" className="tabular-nums" />
            </Field>
            <Field>
              <FieldLabel htmlFor="c-bic">BIC</FieldLabel>
              <Input id="c-bic" value={f.bic} onChange={set("bic")} className="tabular-nums" />
            </Field>
          </div>
        </section>

        <div className="flex justify-end">
          <Button onClick={save} disabled={!dirty}>
            Enregistrer la fiche du cabinet
          </Button>
        </div>

        <section className="rounded-xl border bg-card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Users className="size-4 text-muted-foreground" /> Équipe du cabinet
            </h2>
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus /> Ajouter un membre
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Compte</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <UserAvatar user={u} className="size-7" />
                      <span className="font-medium">{fullName(u)}</span>
                      {u.id === me.id && <span className="text-xs text-muted-foreground">(vous)</span>}
                    </span>
                  </TableCell>
                  <TableCell>{ROLE_LABEL[u.role] ?? u.role}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell className="text-muted-foreground">{accounts[u.id] && !accounts[u.id].activatedAt ? "Invitation envoyée" : "Actif"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      </div>

      <AddMemberDialog
        open={open}
        onOpenChange={setOpen}
        cabinet={org.nom}
        onAdd={(u) => {
          inviteUser(u)
          toast.success(`Invitation envoyée à ${u.email}`)
        }}
      />
    </>
  )
}

function AddMemberDialog({ open, onOpenChange, cabinet, onAdd }: { open: boolean; onOpenChange: (o: boolean) => void; cabinet: string; onAdd: (u: User) => void }) {
  const [role, setRole] = React.useState<"expert" | "gestionnaire">("gestionnaire")
  const [firstName, setFirstName] = React.useState("")
  const [lastName, setLastName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [tried, setTried] = React.useState(false)
  const valid = firstName.trim() && lastName.trim() && /^\S+@\S+\.\S+$/.test(email.trim())

  const submit = () => {
    setTried(true)
    if (!valid) return
    onAdd({
      id: `u-n-${Date.now().toString(36)}`,
      role,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      structure: cabinet,
      fonction: role === "expert" ? "Expert automobile" : "Gestionnaire de dossiers",
    })
    setFirstName("")
    setLastName("")
    setEmail("")
    setPhone("")
    setTried(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un membre au cabinet</DialogTitle>
          <DialogDescription>La personne reçoit une invitation par e-mail pour activer son compte.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field className="sm:col-span-2">
            <FieldLabel>Rôle</FieldLabel>
            <SimpleSelect
              value={role}
              onChange={(v) => v && setRole(v as "expert" | "gestionnaire")}
              options={[
                { value: "gestionnaire", label: "Gestionnaire" },
                { value: "expert", label: "Expert" },
              ]}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="m-fn">Prénom</FieldLabel>
            <Input id="m-fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} aria-invalid={tried && !firstName.trim()} />
          </Field>
          <Field>
            <FieldLabel htmlFor="m-ln">Nom</FieldLabel>
            <Input id="m-ln" value={lastName} onChange={(e) => setLastName(e.target.value)} aria-invalid={tried && !lastName.trim()} />
          </Field>
          <Field>
            <FieldLabel htmlFor="m-em">E-mail</FieldLabel>
            <Input id="m-em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={tried && !/^\S+@\S+\.\S+$/.test(email.trim())} />
          </Field>
          <Field>
            <FieldLabel htmlFor="m-ph">Téléphone</FieldLabel>
            <Input id="m-ph" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={submit}>Envoyer l&apos;invitation</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
