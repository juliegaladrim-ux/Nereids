"use client"

import * as React from "react"
import { toast } from "sonner"
import { ShieldCheck } from "lucide-react"

import { useRole } from "@/components/app-shell/role-context"
import { PageHeader } from "@/components/page-header"
import { UserAvatar } from "@/components/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const EVENTS = [
  { id: "message", label: "Nouveau message", hint: "Quand un message vous est adressé dans le suivi" },
  { id: "document", label: "Nouveau document", hint: "Ajouté sur l'un de vos dossiers" },
  { id: "status", label: "Changement de statut", hint: "Étape importante franchie" },
  { id: "expertise", label: "Convocation, PV ou rapport déposé", hint: "" },
  { id: "relance", label: "Relances", hint: "Relances automatiques et manuelles vous concernant" },
]

export function AccountPage() {
  const { user, role } = useRole()
  const [prefs, setPrefs] = React.useState<Record<string, { app: boolean; mail: boolean }>>(
    Object.fromEntries(EVENTS.map((e) => [e.id, { app: true, mail: e.id !== "document" }])),
  )
  const needs2FA = role.id === "admin" || role.id === "expert"

  return (
    <>
      <PageHeader title="Mon compte" />
      <div className="mb-6 flex items-center gap-4">
        <UserAvatar user={user} className="size-14 text-base" />
        <div>
          <p className="text-lg font-medium">
            {user.firstName} {user.lastName}
          </p>
          <p className="text-sm text-muted-foreground">
            {role.label} · {user.structure}
          </p>
        </div>
      </div>

      <Tabs defaultValue="profil" className="max-w-3xl">
        <TabsList className="mb-2">
          <TabsTrigger value="profil" className="px-3">Profil</TabsTrigger>
          <TabsTrigger value="securite" className="px-3">Sécurité</TabsTrigger>
          <TabsTrigger value="notifications" className="px-3">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="profil">
          <Card>
            <CardHeader>
              <CardTitle>Informations personnelles</CardTitle>
              <CardDescription>Ces informations sont visibles par les intervenants de vos dossiers.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="a-first">Prénom</FieldLabel>
                    <Input id="a-first" defaultValue={user.firstName} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="a-last">Nom</FieldLabel>
                    <Input id="a-last" defaultValue={user.lastName} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="a-fn">Fonction</FieldLabel>
                    <Input id="a-fn" defaultValue={user.fonction} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="a-st">Structure</FieldLabel>
                    <Input id="a-st" defaultValue={user.structure} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="a-tel">Téléphone</FieldLabel>
                    <Input id="a-tel" type="tel" defaultValue={user.phone} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="a-mail">E-mail</FieldLabel>
                    <Input id="a-mail" type="email" defaultValue={user.email} />
                  </Field>
                </div>
                <div className="grid gap-4 border-t pt-5 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>Rôle</FieldLabel>
                    <p className="text-sm">{role.label}</p>
                    <FieldDescription>Défini par Nereids.</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel>Statut du compte</FieldLabel>
                    <Badge variant="secondary" className="bg-tone-done-bg text-tone-done">Actif</Badge>
                  </Field>
                </div>
              </FieldGroup>
            </CardContent>
            <CardFooter className="justify-end border-t">
              <Button onClick={() => toast.success("Informations enregistrées")}>Enregistrer</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="securite" className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Mot de passe</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup className="max-w-sm">
                <Field>
                  <FieldLabel htmlFor="pw-old">Mot de passe actuel</FieldLabel>
                  <Input id="pw-old" type="password" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="pw-new">Nouveau mot de passe</FieldLabel>
                  <Input id="pw-new" type="password" />
                  <FieldDescription>12 caractères minimum.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="pw-conf">Confirmation</FieldLabel>
                  <Input id="pw-conf" type="password" />
                </Field>
              </FieldGroup>
            </CardContent>
            <CardFooter className="justify-end border-t">
              <Button onClick={() => toast.success("Mot de passe modifié")}>Modifier le mot de passe</Button>
            </CardFooter>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4" /> Double authentification
              </CardTitle>
              <CardDescription>
                {needs2FA
                  ? "Obligatoire pour votre rôle : elle protège l'accès aux données sensibles des dossiers."
                  : "Recommandée : ajoute une vérification par code à la connexion."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4 text-sm">
              <span>
                {needs2FA ? (
                  <>Activée · application d&apos;authentification</>
                ) : (
                  <span className="text-muted-foreground">Non activée</span>
                )}
              </span>
              <Button variant="outline" size="sm" onClick={() => toast.info("Configuration 2FA — parcours à concevoir")}>
                {needs2FA ? "Gérer" : "Activer"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Préférences de notification</CardTitle>
              <CardDescription>Choisissez comment être prévenu, pour chaque type d&apos;événement.</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <div className="grid grid-cols-[1fr_80px_80px] items-center border-b px-4 pb-2 text-xs font-medium text-muted-foreground">
                <span>Événement</span>
                <span className="text-center">Plateforme</span>
                <span className="text-center">E-mail</span>
              </div>
              <ul className="divide-y">
                {EVENTS.map((e) => (
                  <li key={e.id} className="grid grid-cols-[1fr_80px_80px] items-center px-4 py-3">
                    <div className="min-w-0 pr-2">
                      <p className="text-sm font-medium">{e.label}</p>
                      {e.hint && <p className="text-xs text-muted-foreground">{e.hint}</p>}
                    </div>
                    <div className="flex justify-center">
                      <Switch
                        aria-label={`${e.label} — plateforme`}
                        checked={prefs[e.id].app}
                        onCheckedChange={(c) => setPrefs((p) => ({ ...p, [e.id]: { ...p[e.id], app: c } }))}
                      />
                    </div>
                    <div className="flex justify-center">
                      <Switch
                        aria-label={`${e.label} — e-mail`}
                        checked={prefs[e.id].mail}
                        onCheckedChange={(c) => setPrefs((p) => ({ ...p, [e.id]: { ...p[e.id], mail: c } }))}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="justify-end border-t">
              <Button onClick={() => toast.success("Préférences enregistrées")}>Enregistrer</Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  )
}
