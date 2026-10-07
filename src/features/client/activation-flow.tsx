"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Camera,
  Car,
  Check,
  CircleAlert,
  Eye,
  EyeOff,
  Hourglass,
  Lock,
  Mail,
  Pencil,
  Send,
  Upload,
  UserRound,
  X,
} from "lucide-react"

import { Immat } from "@/components/immat"
import { Logo } from "@/components/logo"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  DOC_CATEGORIES,
  expectedDocs,
  type DocCategory,
  type Dossier,
  type TimelineEvent,
} from "@/lib/data"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { CLIENT_DOC_COPY, clientTypeLabel } from "./client-docs"

export type ActivationStep = "mail" | "password" | "infos" | "pieces" | "recap" | "done"

/** Étapes numérotées vues par le client (le mail et l'écran final n'en font pas partie) */
const NUMBERED: ActivationStep[] = ["password", "infos", "pieces", "recap"]

type Infos = {
  client: { firstName: string; lastName: string; phone: string; email: string }
  vehicule: { marque: string; modele: string; immat: string; vin: string }
}
type Upload = { name: string; preview?: string }

export function ActivationFlow({ id, initialStep }: { id: string; initialStep?: ActivationStep }) {
  const { getDossier } = useStore()
  const d = getDossier(id)
  if (!d) return <p className="p-8 text-muted-foreground">Dossier introuvable.</p>
  return <Flow key={d.id} d={d} initialStep={initialStep} />
}

function Flow({ d, initialStep }: { d: Dossier; initialStep?: ActivationStep }) {
  const { updateDossier } = useStore()
  const router = useRouter()

  const [step, setStep] = React.useState<ActivationStep>(
    initialStep ?? (d.clientAccess?.submittedAt ? "done" : d.clientAccess?.activatedAt ? "infos" : "mail"),
  )
  const [infos, setInfos] = React.useState<Infos>({
    client: { firstName: d.client.firstName, lastName: d.client.lastName, phone: d.client.phone, email: d.client.email },
    vehicule: { marque: d.vehicule.marque, modele: d.vehicule.modele, immat: d.vehicule.immat, vin: d.vehicule.vin ?? "" },
  })
  const [uploads, setUploads] = React.useState<Partial<Record<DocCategory, Upload[]>>>({})

  const go = (s: ActivationStep) => {
    setStep(s)
    window.scrollTo({ top: 0 })
  }

  const expected = expectedDocs(d.type, d.litigeType)
  const has = (c: DocCategory) => (uploads[c]?.length ?? 0) > 0 || d.documents.some((doc) => doc.category === c)
  const missing = expected.filter((c) => !has(c))

  function activate() {
    const now = new Date().toISOString()
    updateDossier(d.id, (x) => ({
      ...x,
      clientAccess: { invitedAt: x.clientAccess?.invitedAt ?? now, ...x.clientAccess, activatedAt: now },
      timeline: [...x.timeline, ev("system", "system", "Compte client activé", `${fullNameOf(x.client)} a créé son mot de passe.`)],
    }))
    go("infos")
  }

  function submit() {
    const now = new Date().toISOString()
    const added = Object.entries(uploads).flatMap(([cat, files]) =>
      (files ?? []).map((f, i) => ({
        id: `d-${d.id}-${cat}-${Date.now()}-${i}`,
        name: f.name,
        category: cat as DocCategory,
        addedBy: "u-client",
        addedAt: now,
        size: cat === "photos" ? "2,4 Mo" : "1,1 Mo",
      })),
    )
    const changed = diffInfos(d, infos)

    updateDossier(d.id, (x) => {
      const timeline: TimelineEvent[] = [...x.timeline]
      if (changed.length) timeline.push(ev("system", "u-client", "Informations modifiées par le client", changed.join(" · ")))
      if (added.length)
        timeline.push(
          ev("document", "u-client", `${added.length} document${added.length > 1 ? "s" : ""} ajouté${added.length > 1 ? "s" : ""} par le client`, [...new Set(added.map((a) => DOC_CATEGORIES[a.category]))].join(", ")),
        )
      timeline.push(
        ev("system", "u-client", x.clientAccess?.submittedAt ? "Dossier complété par le client" : "Dossier envoyé par le client", missing.length ? `Pièces manquantes : ${missing.map((c) => DOC_CATEGORIES[c]).join(", ")}` : "Toutes les pièces demandées sont fournies."),
      )
      const who = [!x.intervenants.gestionnaire && "d'un gestionnaire", !x.intervenants.expert && "d'un expert"].filter(Boolean).join(" et ")
      const attente = x.status === "nouveau" && who ? `Assignation ${who}` : x.pilotage.attente.split(" · pièces manquantes")[0]
      return {
        ...x,
        client: { ...x.client, ...infos.client },
        vehicule: { ...infos.vehicule, immat: infos.vehicule.immat.toUpperCase(), vin: infos.vehicule.vin || undefined },
        documents: [...x.documents, ...added],
        timeline,
        clientAccess: { invitedAt: x.clientAccess?.invitedAt ?? now, activatedAt: x.clientAccess?.activatedAt ?? now, submittedAt: now },
        pilotage: {
          ...x.pilotage,
          ouEnEst: missing.length ? "Dossier envoyé par le client, pièces incomplètes." : "Dossier complet envoyé par le client.",
          attente: missing.length ? `${attente} · pièces manquantes : ${missing.map((c) => DOC_CATEGORIES[c]).join(", ")}` : attente,
        },
      }
    })
    go("done")
  }

  const index = NUMBERED.indexOf(step)

  return (
    <div className="flex min-h-svh flex-col bg-background">
      {step !== "mail" && (
        <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-xl items-center gap-3 px-4">
            {index > 0 ? (
              <Button variant="ghost" size="icon-sm" aria-label="Retour" onClick={() => go(NUMBERED[index - 1])}>
                <ArrowLeft />
              </Button>
            ) : (
              <Logo />
            )}
            {index >= 0 && (
              <div className="ml-auto flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground tabular-nums">
                  Étape {index + 1} sur {NUMBERED.length}
                </span>
                <div className="flex gap-1">
                  {NUMBERED.map((s, i) => (
                    <span key={s} className={cn("h-1.5 w-6 rounded-full", i <= index ? "bg-primary" : "bg-border")} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </header>
      )}

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pt-6 pb-44 sm:pb-24">
        {step === "mail" && <MailStep d={d} onOpen={() => go("password")} />}
        {step === "password" && <PasswordStep client={d.client} onDone={activate} />}
        {step === "infos" && <InfosStep infos={infos} setInfos={setInfos} onNext={() => go("pieces")} />}
        {step === "pieces" && (
          <PiecesStep d={d} expected={expected} uploads={uploads} setUploads={setUploads} missing={missing} onNext={() => go("recap")} />
        )}
        {step === "recap" && (
          <RecapStep d={d} infos={infos} expected={expected} uploads={uploads} missing={missing} onEdit={go} onSubmit={submit} />
        )}
        {step === "done" && <DoneStep d={d} missing={missing} onHome={() => router.push("/client/tableau-de-bord")} />}
      </main>
    </div>
  )
}

// ─── 1. E-mail reçu ──────────────────────────────────────────────────────────

function MailStep({ d, onOpen }: { d: Dossier; onOpen: () => void }) {
  return (
    <>
      <p className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Mail className="size-4" /> E-mail reçu par le client
      </p>
      <article className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b px-5 py-4">
          <p className="text-lg font-semibold">Votre dossier Nereids est ouvert</p>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Nereids</span> &lt;ne-pas-repondre@nereids.fr&gt; · à {d.client.email}
          </p>
        </div>
        <div className="flex flex-col gap-4 px-5 py-6 text-[15px] leading-relaxed">
          <Logo />
          <p>Bonjour {d.client.firstName},</p>
          <p>
            Nereids a ouvert un dossier pour votre véhicule <strong>{d.vehicule.marque} {d.vehicule.modele}</strong>.
            Créez votre compte pour envoyer vos documents et suivre l&apos;avancement.
          </p>
          <ul className="flex flex-col gap-2 rounded-lg bg-muted p-4 text-sm">
            <li className="flex items-center gap-2"><Lock className="size-4 text-primary" /> Créer votre mot de passe</li>
            <li className="flex items-center gap-2"><UserRound className="size-4 text-primary" /> Vérifier vos informations</li>
            <li className="flex items-center gap-2"><Camera className="size-4 text-primary" /> Envoyer constat, carte grise et photos</li>
          </ul>
          <p className="text-sm text-muted-foreground">Cela prend environ 5 minutes.</p>
          <Button size="lg" className="w-full sm:w-auto sm:self-start" onClick={onOpen}>
            Créer mon compte
          </Button>
          <p className="border-t pt-4 text-xs text-muted-foreground">
            Dossier {d.ref} · Ce lien est valable 7 jours.
          </p>
        </div>
      </article>
    </>
  )
}

// ─── 2. Mot de passe ─────────────────────────────────────────────────────────

function PasswordStep({ client, onDone }: { client: Dossier["client"]; onDone: () => void }) {
  const [pwd, setPwd] = React.useState("")
  const [show, setShow] = React.useState(false)

  return (
    <StepLayout
      icon={<Lock />}
      title={`Bienvenue ${client.firstName}`}
      subtitle="Créez votre mot de passe pour accéder à votre dossier."
      footer={
        <Button size="lg" className="w-full" onClick={onDone}>
          Créer mon compte
        </Button>
      }
    >
      {/* Identité reprise du dossier créé par Nereids : non modifiable ici */}
      <dl className="mb-6 flex flex-col gap-3 rounded-xl border bg-card p-4">
        {[
          ["Prénom", client.firstName],
          ["Nom", client.lastName],
          ["E-mail", client.email],
        ].map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 text-[15px]">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="min-w-0 truncate text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="a-pwd">Mot de passe</FieldLabel>
          <div className="relative">
            <Input
              id="a-pwd"
              type={show ? "text" : "password"}
              autoFocus
              autoComplete="new-password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onDone()}
              className="h-12 pr-12 text-base"
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-1 right-1"
              aria-label={show ? "Masquer" : "Afficher"}
              onClick={() => setShow((s) => !s)}
            >
              {show ? <EyeOff /> : <Eye />}
            </Button>
          </div>
          {/* Proto : aucun contrôle, n'importe quel mot de passe est accepté */}
        </Field>
      </FieldGroup>
      <p className="mt-6 text-xs text-muted-foreground">
        En créant votre compte, vous acceptez les conditions d&apos;utilisation et la politique de confidentialité de Nereids.
      </p>
    </StepLayout>
  )
}

// ─── 3. Vérification des informations ───────────────────────────────────────

function InfosStep({ infos, setInfos, onNext }: { infos: Infos; setInfos: React.Dispatch<React.SetStateAction<Infos>>; onNext: () => void }) {
  const [editing, setEditing] = React.useState<"client" | "vehicule" | null>(null)
  const setIn = <K extends keyof Infos>(k: K, field: keyof Infos[K], v: string) =>
    setInfos((p) => ({ ...p, [k]: { ...p[k], [field]: v } }))

  return (
    <StepLayout
      icon={<UserRound />}
      title="Vérifiez vos informations"
      subtitle="Elles ont été remplies par Nereids. Corrigez-les si besoin."
      footer={
        <Button size="lg" className="w-full" onClick={onNext}>
          {editing ? "Enregistrer et continuer" : "C'est correct, continuer"}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <InfoBlock
          icon={<UserRound />}
          title="Mes coordonnées"
          editing={editing === "client"}
          onEdit={() => setEditing(editing === "client" ? null : "client")}
          rows={[
            ["Nom", `${infos.client.firstName} ${infos.client.lastName}`],
            ["Téléphone", infos.client.phone],
            ["E-mail", infos.client.email],
          ]}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="i-first" label="Prénom" value={infos.client.firstName} onChange={(v) => setIn("client", "firstName", v)} />
            <TextField id="i-last" label="Nom" value={infos.client.lastName} onChange={(v) => setIn("client", "lastName", v)} />
            <TextField id="i-phone" label="Téléphone" type="tel" value={infos.client.phone} onChange={(v) => setIn("client", "phone", v)} />
            <TextField id="i-mail" label="E-mail" type="email" value={infos.client.email} onChange={(v) => setIn("client", "email", v)} />
          </div>
        </InfoBlock>

        <InfoBlock
          icon={<Car />}
          title="Mon véhicule"
          editing={editing === "vehicule"}
          onEdit={() => setEditing(editing === "vehicule" ? null : "vehicule")}
          rows={[
            ["Véhicule", `${infos.vehicule.marque} ${infos.vehicule.modele}`.trim()],
            ["Immatriculation", <Immat key="i" value={infos.vehicule.immat} />],
            ["VIN", infos.vehicule.vin || <span key="v" className="text-muted-foreground">Non renseigné</span>],
          ]}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="i-marque" label="Marque" value={infos.vehicule.marque} onChange={(v) => setIn("vehicule", "marque", v)} />
            <TextField id="i-modele" label="Modèle" value={infos.vehicule.modele} onChange={(v) => setIn("vehicule", "modele", v)} />
            <TextField id="i-immat" label="Immatriculation" className="font-mono uppercase" value={infos.vehicule.immat} onChange={(v) => setIn("vehicule", "immat", v)} />
            <TextField id="i-vin" label="VIN (si disponible)" hint="Case E de la carte grise" className="font-mono uppercase" value={infos.vehicule.vin} onChange={(v) => setIn("vehicule", "vin", v)} />
          </div>
        </InfoBlock>
      </div>
    </StepLayout>
  )
}

function InfoBlock({
  icon,
  title,
  rows,
  editing,
  onEdit,
  children,
}: {
  icon: React.ReactNode
  title: string
  rows: [string, React.ReactNode][]
  editing: boolean
  onEdit: () => void
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border bg-card">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <span className="text-primary [&_svg]:size-5">{icon}</span>
        <h2 className="font-semibold">{title}</h2>
        <Button variant={editing ? "secondary" : "ghost"} size="sm" className="ml-auto" onClick={onEdit}>
          {editing ? <Check /> : <Pencil />}
          {editing ? "OK" : "Modifier"}
        </Button>
      </div>
      <div className="p-4">
        {editing ? (
          children
        ) : (
          <dl className="flex flex-col gap-3">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 text-[15px]">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="min-w-0 truncate text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  )
}

function TextField({
  id,
  label,
  value,
  onChange,
  type = "text",
  hint,
  className,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  hint?: string
  className?: string
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} className={cn("h-11 text-base", className)} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </Field>
  )
}

// ─── 4. Dépôt des pièces ─────────────────────────────────────────────────────

function PiecesStep({
  d,
  expected,
  uploads,
  setUploads,
  missing,
  onNext,
}: {
  d: Dossier
  expected: DocCategory[]
  uploads: Partial<Record<DocCategory, Upload[]>>
  setUploads: React.Dispatch<React.SetStateAction<Partial<Record<DocCategory, Upload[]>>>>
  missing: DocCategory[]
  onNext: () => void
}) {
  function add(c: DocCategory, files: Upload[]) {
    setUploads((p) => ({ ...p, [c]: [...(p[c] ?? []), ...files] }))
  }
  function remove(c: DocCategory, i: number) {
    setUploads((p) => ({ ...p, [c]: (p[c] ?? []).filter((_, j) => j !== i) }))
  }

  return (
    <StepLayout
      icon={<Camera />}
      title="Envoyez vos documents"
      subtitle="Prenez-les en photo avec votre téléphone ou importez un fichier."
      footer={
        <div className="flex flex-col gap-2">
          <Button size="lg" className="w-full" onClick={onNext}>
            Continuer
          </Button>
          {missing.length > 0 && (
            <p className="text-center text-sm text-muted-foreground">Il vous manque un document ? Vous pourrez l&apos;ajouter plus tard.</p>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {expected.map((c) => (
          <DocSlot
            key={c}
            category={c}
            files={uploads[c] ?? []}
            existing={d.documents.filter((doc) => doc.category === c).map((doc) => doc.name)}
            multiple={c === "photos"}
            onAdd={(f) => add(c, f)}
            onRemove={(i) => remove(c, i)}
          />
        ))}
      </div>
    </StepLayout>
  )
}

const FAKE_NAMES: Partial<Record<DocCategory, string>> = {
  constat: "Constat amiable.jpg",
  carte_grise: "Carte grise.jpg",
}

function DocSlot({
  category,
  files,
  existing,
  multiple,
  onAdd,
  onRemove,
}: {
  category: DocCategory
  files: Upload[]
  existing: string[]
  multiple: boolean
  onAdd: (f: Upload[]) => void
  onRemove: (i: number) => void
}) {
  const cameraRef = React.useRef<HTMLInputElement>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)
  const copy = CLIENT_DOC_COPY[category] ?? { label: DOC_CATEGORIES[category], hint: "", icon: Upload }
  const Icon = copy.icon
  const done = files.length + existing.length > 0

  // Sur mobile : vraie caméra / galerie. Sur ordinateur (démo) : fichier fictif ajouté directement.
  function pick(ref: React.RefObject<HTMLInputElement | null>) {
    if (window.matchMedia("(pointer: coarse)").matches) return ref.current?.click()
    const n = files.length + existing.length + 1
    onAdd([{ name: category === "photos" ? `Photo ${n}.jpg` : (FAKE_NAMES[category] ?? `${DOC_CATEGORIES[category]}.pdf`) }])
  }
  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? [])
    onAdd(list.map((f) => ({ name: f.name, preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined })))
    e.target.value = ""
  }

  return (
    <section className={cn("rounded-xl border bg-card p-4 transition-colors", done && "border-tone-done/40")}>
      <div className="flex items-start gap-3">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg", done ? "bg-tone-done-bg text-tone-done" : "bg-primary-soft text-primary")}>
          {done ? <Check className="size-5" /> : <Icon className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{copy.label}</h3>
          <p className="text-sm text-muted-foreground">{copy.hint}</p>
        </div>
      </div>

      {(existing.length > 0 || files.length > 0) && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {existing.map((name) => (
            <li key={name} className="flex h-9 items-center gap-2 rounded-md bg-muted px-3 text-sm">
              <Check className="size-4 text-tone-done" /> {name}
            </li>
          ))}
          {files.map((f, i) => (
            <li key={i} className="flex h-9 items-center gap-2 rounded-md bg-muted pr-1 pl-1 text-sm">
              {f.preview ? (
                // eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob)
                <img src={f.preview} alt="" className="size-7 rounded object-cover" />
              ) : (
                <span className="grid size-7 place-items-center rounded bg-card"><Icon className="size-4 text-muted-foreground" /></span>
              )}
              <span className="max-w-40 truncate">{f.name}</span>
              <Button variant="ghost" size="icon-xs" aria-label={`Retirer ${f.name}`} onClick={() => onRemove(i)}>
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {(!done || multiple) && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant={done ? "outline" : "soft"} className="h-11" onClick={() => pick(cameraRef)}>
            <Camera /> {done ? "Ajouter" : "Prendre en photo"}
          </Button>
          <Button variant="outline" className="h-11" onClick={() => pick(fileRef)}>
            <Upload /> Importer
          </Button>
        </div>
      )}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple={multiple} hidden onChange={onFiles} />
      <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple={multiple} hidden onChange={onFiles} />
    </section>
  )
}

// ─── 5. Récapitulatif ────────────────────────────────────────────────────────

function RecapStep({
  d,
  infos,
  expected,
  uploads,
  missing,
  onEdit,
  onSubmit,
}: {
  d: Dossier
  infos: Infos
  expected: DocCategory[]
  uploads: Partial<Record<DocCategory, Upload[]>>
  missing: DocCategory[]
  onEdit: (s: ActivationStep) => void
  onSubmit: () => void
}) {
  return (
    <StepLayout
      icon={<Check />}
      title="Récapitulatif"
      subtitle="Vérifiez avant d'envoyer votre dossier à Nereids."
      footer={
        <Button size="lg" className="w-full" onClick={onSubmit}>
          <Send /> Envoyer mon dossier
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <RecapCard title="Mon dossier">
          <Row k="Type" v={clientTypeLabel(d)} />
          <Row k="Référence" v={d.ref} />
        </RecapCard>

        <RecapCard title="Mes informations" onEdit={() => onEdit("infos")}>
          <Row k="Nom" v={`${infos.client.firstName} ${infos.client.lastName}`} />
          <Row k="Téléphone" v={infos.client.phone} />
          <Row k="E-mail" v={infos.client.email} />
          <Row k="Véhicule" v={`${infos.vehicule.marque} ${infos.vehicule.modele}`.trim()} />
          <Row k="Immatriculation" v={<Immat value={infos.vehicule.immat} />} />
        </RecapCard>

        <RecapCard title="Mes documents" onEdit={() => onEdit("pieces")}>
          <ul className="flex flex-col gap-2.5">
            {expected.map((c) => {
              const n = (uploads[c]?.length ?? 0) + d.documents.filter((doc) => doc.category === c).length
              const ok = !missing.includes(c)
              return (
                <li key={c} className="flex items-center gap-3 text-[15px]">
                  {ok ? <Check className="size-5 text-tone-done" /> : <CircleAlert className="size-5 text-tone-waiting" />}
                  <span className="flex-1">{CLIENT_DOC_COPY[c]?.label ?? DOC_CATEGORIES[c]}</span>
                  <span className={cn("text-sm font-medium", ok ? "text-muted-foreground" : "text-tone-waiting")}>
                    {ok ? (c === "photos" ? `${n} photo${n > 1 ? "s" : ""}` : "Déposé") : "Manquant"}
                  </span>
                </li>
              )
            })}
          </ul>
          {missing.length > 0 && (
            <p className="mt-3 rounded-md bg-tone-waiting-bg px-3 py-2 text-sm text-tone-waiting">
              Vous pouvez envoyer maintenant et ajouter les documents manquants plus tard depuis votre espace.
            </p>
          )}
        </RecapCard>
      </div>
    </StepLayout>
  )
}

function RecapCard({ title, onEdit, children }: { title: string; onEdit?: () => void; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        {onEdit && (
          <Button variant="link" size="sm" className="h-auto p-0" onClick={onEdit}>
            Modifier
          </Button>
        )}
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  )
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 text-[15px]">
      <span className="text-muted-foreground">{k}</span>
      <span className="min-w-0 truncate text-right font-medium">{v}</span>
    </div>
  )
}

// ─── 6. Dossier envoyé ───────────────────────────────────────────────────────

function DoneStep({ d, missing, onHome }: { d: Dossier; missing: DocCategory[]; onHome: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center pt-6 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-tone-done-bg text-tone-done">
        <Check className="size-8" strokeWidth={2.5} />
      </span>
      <h1 className="mt-5 text-2xl font-bold tracking-tight">Dossier envoyé</h1>
      <p className="mt-2 text-muted-foreground">Merci {d.client.firstName}, Nereids a bien reçu votre dossier.</p>

      <div className="mt-8 w-full rounded-xl border bg-card p-4 text-left">
        <div className="flex items-center justify-between">
          <span className="font-semibold">{d.ref}</span>
          <StatusBadge status={d.status} />
        </div>
        <div className="mt-4 flex gap-3 rounded-lg bg-muted p-3">
          <Hourglass className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="text-[15px]">
            <p className="font-medium">Prochaine étape</p>
            <p className="text-muted-foreground">Un expert va étudier votre dossier. Vous serez prévenu par e-mail sous 48 h.</p>
          </div>
        </div>
        {missing.length > 0 && (
          <p className="mt-3 flex items-center gap-2 text-sm text-tone-waiting">
            <CircleAlert className="size-4 shrink-0" />
            À compléter : {missing.map((c) => CLIENT_DOC_COPY[c]?.label ?? DOC_CATEGORIES[c]).join(", ")}
          </p>
        )}
      </div>

      <Button size="lg" className="mt-8 w-full" onClick={onHome}>
        Accéder à mon espace
      </Button>
    </div>
  )
}

// ─── Mise en page commune ────────────────────────────────────────────────────

function StepLayout({
  icon,
  title,
  subtitle,
  footer,
  children,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  footer: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <>
      <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary [&_svg]:size-5">{icon}</span>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-[15px] text-muted-foreground">{subtitle}</p>}
      <div className="mt-6">{children}</div>
      {/* Bouton principal collé en bas sur mobile, dans le flux sur grand écran (pb-16 : place pour la barre du proto) */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-card/95 px-4 pt-3 pb-16 backdrop-blur sm:static sm:mt-8 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <div className="mx-auto max-w-xl">{footer}</div>
      </div>
    </>
  )
}

// ─── Utilitaires ─────────────────────────────────────────────────────────────

function ev(kind: TimelineEvent["kind"], author: string, title: string, body?: string): TimelineEvent {
  return { id: `e${Date.now()}${Math.random().toString(36).slice(2, 6)}`, at: new Date().toISOString(), kind, author, title, body }
}

function fullNameOf(c: { firstName: string; lastName: string }) {
  return `${c.firstName} ${c.lastName}`
}

function diffInfos(d: Dossier, i: Infos): string[] {
  const out: string[] = []
  const pairs: [string, string | undefined, string][] = [
    ["Prénom", d.client.firstName, i.client.firstName],
    ["Nom", d.client.lastName, i.client.lastName],
    ["Téléphone", d.client.phone, i.client.phone],
    ["E-mail", d.client.email, i.client.email],
    ["Marque", d.vehicule.marque, i.vehicule.marque],
    ["Modèle", d.vehicule.modele, i.vehicule.modele],
    ["Immatriculation", d.vehicule.immat, i.vehicule.immat.toUpperCase()],
    ["VIN", d.vehicule.vin ?? "", i.vehicule.vin],
  ]
  for (const [label, before, after] of pairs) if ((before ?? "") !== after) out.push(`${label} : ${after || "—"}`)
  return out
}
