/**
 * Outil du prototype (n'existera pas dans le produit) : reconstruit un dossier
 * cohérent pour un type et un statut donnés, comme s'il avait suivi le parcours
 * normal jusque-là — intervenants, pièces, expertise, pilotage, suivi, clôture.
 * Garde l'identité du dossier (réf., client, véhicule, suiveurs).
 */

import {
  DOC_CATEGORIES,
  DOSSIER_TYPES,
  LITIGE_ASSUR_TYPES,
  SINISTRE_TYPES,
  STATUSES,
  WORKFLOW_STEPS,
  daysFromNow,
  defaultPilotage,
  expectedDocs,
  getUser,
  fullName,
  type DocCategory,
  type DocumentItem,
  type Dossier,
  type DossierType,
  type LitigeAssurantielType,
  type SinistreType,
  type StatusId,
  type TimelineEvent,
} from "./data"

export type Scenario = {
  type: DossierType
  sinistreType?: SinistreType
  litigeType?: LitigeAssurantielType
  status: StatusId
}

/** Sinistre responsable ou sans tiers : hors recours direct, enregistré directement clôturé */
export function isHorsRecours(s: Pick<Scenario, "type" | "sinistreType">): boolean {
  return s.type === "sinistre" && !!s.sinistreType && !SINISTRE_TYPES[s.sinistreType].recours
}

/** Statuts « de passage » : on n'y passe que si c'est le statut courant */
const DETOURS: StatusId[] = ["attente_client", "complement", "attente_tiers", "attente_compagnie"]

const STEP_DAYS = 3

const DEFAULT_COMPAGNIE: Record<DossierType, NonNullable<Dossier["compagnie"]>> = {
  sinistre: { nom: "Assurances Atlantique", email: "sinistres@atlantique-assur.fr", reference: "AT-77812-S" },
  litige_auto: { nom: "Auto Sélection Lyon", email: "sav@autoselection-lyon.fr" },
  litige_assurantiel: { nom: "Mutuelle du Centre", email: "litiges@mutuelle-centre.fr", reference: "MDC-2026-0087" },
}

const DOC_FILES: Partial<Record<DocCategory, [string, string]>> = {
  constat: ["Constat amiable.pdf", "820 Ko"],
  carte_grise: ["Carte grise.pdf", "1,0 Mo"],
  photos: ["Photos du véhicule (6).zip", "14,3 Mo"],
  facture_achat: ["Facture d'achat.pdf", "610 Ko"],
  facture: ["Facture garage.pdf", "380 Ko"],
  entretien: ["Factures d'entretien.pdf", "2,1 Mo"],
  controle_technique: ["Contrôle technique.pdf", "430 Ko"],
  recherche_marche: ["Annonces véhicules similaires.pdf", "3,4 Mo"],
  rapport_compagnie: ["Rapport expertise compagnie.pdf", "1,2 Mo"],
}

export function applyScenario(d: Dossier, s: Scenario): Dossier {
  const hors = isHorsRecours(s)
  const status: StatusId = hors && s.status !== "archive" ? "cloture" : s.status
  const isSinistre = s.type === "sinistre"
  const qualification = [
    DOSSIER_TYPES[s.type].label,
    s.type === "sinistre" && s.sinistreType ? SINISTRE_TYPES[s.sinistreType].label.toLowerCase() : null,
    s.type === "litige_assurantiel" && s.litigeType ? LITIGE_ASSUR_TYPES[s.litigeType].label.toLowerCase() : null,
  ]
    .filter(Boolean)
    .join(" — ")
  const expertiseLabel = s.type === "litige_assurantiel" ? "Tierce expertise" : "Expertise"

  // Parcours suivi jusqu'au statut courant
  const order = WORKFLOW_STEPS[s.type].flatMap((st) => st.statuses)
  const rank = (x: StatusId) => order.indexOf(x)
  const path: StatusId[] = hors
    ? (["nouveau", "cloture", "archive"] as StatusId[]).filter((x) => rank(x) <= rank(status))
    : order.filter(
        (x) =>
          rank(x) <= rank(status) &&
          (x === status || (!DETOURS.includes(x) && (isSinistre || x !== "attente_reparation"))),
      )
  const reached = (x: StatusId) => !hors && rank(status) >= rank(x)

  // Intervenants : on garde ceux du dossier, sinon ceux de démo
  const gestionnaire = reached("en_etude") ? (d.intervenants.gestionnaire ?? "u-gest") : undefined
  const expert = reached("en_etude") ? (d.intervenants.expert ?? "u-expert") : undefined
  const reparateur = isSinistre && reached("recours_valide") ? (d.intervenants.reparateur ?? "u-rep") : undefined
  const clientId = d.client.userId
  const depositor = clientId ?? gestionnaire ?? "u-admin"

  // On garde la compagnie du dossier si elle correspond au type (pas celle de démo d'un autre type)
  const foreign = (Object.keys(DEFAULT_COMPAGNIE) as DossierType[]).some((t) => t !== s.type && DEFAULT_COMPAGNIE[t].nom === d.compagnie?.nom)
  const compagnie = d.type === s.type && d.compagnie && !foreign ? d.compagnie : DEFAULT_COMPAGNIE[s.type]
  const expected = expectedDocs(s.type, s.litigeType)
  // En attente client : il manque une pièce attendue
  const missing = status === "attente_client" ? expected[expected.length - 1] : undefined

  const documents: DocumentItem[] = []
  const timeline: TimelineEvent[] = []
  let n = 0
  // Litige auto : l'attente du rapport couvre pré-rapport, discussion, rapport final et relances (CDC §4.3)
  const gapAfter = (x: StatusId) => (s.type === "litige_auto" && x === "attente_rapport" ? 20 : STEP_DAYS)
  const offset = (i: number) => path.slice(i, -1).reduce((sum, x) => sum + gapAfter(x), 0)
  const at = (i: number, hour = 10, plus = 0) => daysFromNow(-offset(i) - 2 + plus, hour)
  const addDoc = (name: string, category: DocCategory, by: string, when: string, size = "240 Ko") =>
    documents.push({ id: `${d.id}-g${++n}`, name, category, addedBy: by, addedAt: when, size })
  const addEv = (when: string, kind: TimelineEvent["kind"], author: string, title: string, body?: string, recipients?: TimelineEvent["recipients"]) =>
    timeline.push({ id: `${d.id}-e${++n}`, at: when, kind, author, title, body, recipients })
  const statusEv = (when: string, x: StatusId, author = "system", body?: string) =>
    addEv(when, "status", author, `Statut → ${STATUSES[x].label}`, body)

  const expertise: Dossier["expertise"] = { convoques: [] }
  let cloture: Dossier["cloture"]

  path.forEach((x, i) => {
    const t = at(i)
    const past = x !== status
    switch (x) {
      case "nouveau": {
        addEv(at(i, 9), "creation", "u-admin", "Dossier créé", qualification)
        const initial = expected.filter((c) => c !== missing)
        if (initial.length) {
          initial.forEach((c) => addDoc(DOC_FILES[c]?.[0] ?? `${DOC_CATEGORIES[c]}.pdf`, c, depositor, t, DOC_FILES[c]?.[1]))
          addEv(t, "document", depositor, `${initial.length} documents ajoutés`, initial.map((c) => DOC_CATEGORIES[c]).join(", "))
        }
        break
      }
      case "en_etude":
        addEv(t, "assignation", "u-admin", "Intervenants assignés", `Gestionnaire : ${fullName(getUser(gestionnaire))} · Expert : ${fullName(getUser(expert))}`)
        statusEv(t, x)
        break
      case "attente_client":
        statusEv(t, x, expert)
        addEv(t, "message", gestionnaire!, "Message", `Bonjour, pour avancer, pouvez-vous déposer la pièce suivante : ${DOC_CATEGORIES[missing!].toLowerCase()} ?`, ["client"])
        break
      case "complement":
        // CDC §17 étape 5 : dommage complémentaire découvert après l'expertise
        statusEv(t, x, expert, "Dommage complémentaire à traiter.")
        addEv(t, "message", expert!, "Message", isSinistre ? "Dommage complémentaire constaté au démontage : une expertise complémentaire est à organiser." : "Dommage complémentaire constaté après l'expertise : une expertise complémentaire est à organiser.", ["gestionnaire"])
        break
      case "recours_valide":
        statusEv(t, x, expert, isSinistre ? "Responsabilité du tiers établie par le constat." : "Dossier recevable, expertise à organiser.")
        if (reparateur) {
          addEv(t, "assignation", "u-admin", "Réparateur assigné", fullName(getUser(reparateur)))
          if (past) {
            addDoc("Devis réparation.pdf", "devis", reparateur, at(i, 15))
            addEv(at(i, 15), "document", reparateur, "Devis déposé", "Devis réparation — 3 480,00 € TTC")
          }
        }
        break
      case "attente_tiers":
      case "attente_compagnie":
        statusEv(t, x, gestionnaire)
        addEv(at(i, 11), "relance", gestionnaire!, `Relance envoyée — ${x === "attente_tiers" ? "tiers" : compagnie.nom}`)
        break
      case "attente_expertise": {
        const date = past ? at(i + 1, 9) : daysFromNow(2, 9)
        expertise.date = date
        expertise.lieu = reparateur
          ? `${getUser(reparateur)?.structure}, 12 rue des Forges, 43200 Yssingeaux`
          : `${getUser(expert)?.structure}, 8 avenue Foch, 69006 Lyon`
        expertise.convoques = [clientId, reparateur, expert].filter((u): u is string => !!u)
        expertise.realisee = past
        addDoc("Convocation expertise.pdf", "courrier", gestionnaire!, t, "95 Ko")
        addEv(t, "expertise", gestionnaire!, "Convocation envoyée", `${expertiseLabel} prévue, toutes les parties sont convoquées.`)
        statusEv(t, x)
        break
      }
      case "attente_pv":
        addEv(t, "expertise", expert!, `${expertiseLabel} réalisée`)
        statusEv(t, x)
        break
      default:
        statusEv(t, x, x === "cloture" || x === "archive" ? "u-admin" : "system")
    }

    // Pièces produites en quittant une étape
    const next = path[i + 1]
    if (!next || hors) return
    const tn = at(i + 1, 9)
    if (x === "attente_pv" || (rank(x) < rank("attente_pv") && rank(next) > rank("attente_pv"))) {
      addDoc("PV d'expertise.pdf", "pv", expert!, tn, "310 Ko")
      addEv(tn, "document", expert!, "PV d'expertise déposé")
    }
    if (isSinistre && x === "attente_reparation") {
      addDoc("Facture proforma.pdf", "facture_proforma", reparateur!, tn, "180 Ko")
      addEv(tn, "document", reparateur!, "Facture proforma déposée")
    }
    if (x === "attente_rapport" && s.type === "litige_auto") {
      addDoc("Pré-rapport.pdf", "pre_rapport", expert!, at(i, 9, 2), "1,1 Mo")
      addEv(at(i, 9, 2), "document", expert!, "Pré-rapport déposé", "Discussion ouverte entre les parties.")
      addEv(at(i, 15, 3), "message", gestionnaire!, "Pas d'accord entre les parties", "Le rapport final est demandé à l'expert.")
      addDoc("Rapport final.pdf", "rapport", expert!, at(i, 9, 4), "2,4 Mo")
      addEv(at(i, 9, 4), "document", expert!, "Rapport final déposé")
      addEv(at(i, 10, 14), "relance", "system", "Relance envoyée — parties (J+10)")
      addEv(at(i, 10, 19), "relance", "system", "Relance envoyée — parties (J+15)")
    } else if (x === "attente_rapport") {
      addDoc("Rapport d'expertise.pdf", "rapport", expert!, tn, "2,4 Mo")
      addEv(tn, "document", expert!, "Rapport d'expertise déposé")
    }
    if (next === "reclamation_envoyee") {
      addDoc(`Réclamation ${compagnie.nom}.pdf`, "courrier", gestionnaire!, tn, "120 Ko")
    }
  })

  const pv = documents.find((x) => x.category === "pv")
  const rapport = documents.find((x) => x.category === "rapport")
  if (pv) expertise.pvDocId = pv.id
  if (rapport) expertise.rapportDocId = rapport.id

  if (status === "cloture" || status === "archive") {
    const i = path.indexOf("cloture")
    cloture = hors
      ? { motif: "Hors périmètre", commentaire: "Sinistre hors recours direct", at: at(i) }
      : { motif: path.includes("attente_paiement") ? "Paiement reçu" : "Dossier terminé", at: at(i) }
  }

  const p = defaultPilotage(status, s.type)
  const pilotage: Dossier["pilotage"] = hors
    ? { ouEnEst: "Dossier enregistré, hors module recours direct.", attente: "—", prochaineAction: status === "archive" ? "—" : "Archiver le dossier", quiDoitAgir: "nereids" }
    : {
        ouEnEst: p.ouEnEst,
        attente: missing ? `${DOC_CATEGORIES[missing]} du client` : p.attente,
        prochaineAction: missing ? `Déposer : ${DOC_CATEGORIES[missing].toLowerCase()}` : p.prochaineAction,
        quiDoitAgir: p.quiDoitAgir,
        echeance: p.delayDays ? daysFromNow(p.delayDays - 2) : undefined,
      }

  const createdAt = at(0, 9)
  // Le client invité a terminé son activation dès que le dossier a avancé
  const clientAccess =
    d.clientAccess && status !== "nouveau"
      ? { invitedAt: createdAt, activatedAt: createdAt, submittedAt: createdAt }
      : d.clientAccess

  return {
    ...d,
    type: s.type,
    sinistreType: s.type === "sinistre" ? s.sinistreType : undefined,
    litigeType: s.type === "litige_assurantiel" ? s.litigeType : undefined,
    status,
    createdAt,
    compagnie,
    tiers: s.type === "litige_auto" ? d.tiers : undefined,
    description: d.type === s.type ? d.description : undefined,
    refs: { ...d.refs, expert: expert ? (d.refs.expert ?? "EXP-26-051") : undefined },
    intervenants: { gestionnaire, expert, reparateur, suiveurs: d.intervenants.suiveurs },
    pilotage,
    expertise,
    documents,
    timeline,
    cloture,
    horsPerimetre: hors || undefined,
    clientAccess,
  }
}
