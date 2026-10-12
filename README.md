# Nereids — Prototype

Prototype cliquable de la plateforme de suivi de dossiers automobiles Nereids (Galadrim).
**Toutes les données sont fictives.** Elles sont stockées dans le navigateur (localStorage) :
un dossier créé pendant une démo reste visible, et le bandeau « Prototype » permet de tout réinitialiser.

## Lancer en local

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:3000.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS v4
- [shadcn/ui](https://ui.shadcn.com) — variante **Base UI** (`components.json`), composants dans `src/components/ui`
- Icônes : lucide-react

## Organisation

| Dossier | Contenu |
| --- | --- |
| `src/app/[role]/…` | Une URL par rôle : `/admin`, `/gestionnaire`, `/expert`, `/reparateur`, `/suiveur`, `/client` |
| `src/lib/roles.ts` | Rôles, navigation et état d'avancement de chaque espace |
| `src/lib/data.ts` | Modèle de données (types), référentiels (statuts V1, types de dossiers, catégories de documents) et données fictives |
| `src/lib/store.tsx` | Store du proto (lecture / écriture des dossiers, persistance localStorage) |
| `src/lib/access.ts` | Règles de visibilité des dossiers par rôle |
| `src/features/…` | Écrans : tableau de bord admin, liste, création, fiche dossier, mon compte |
| `src/components/app-shell` | Sidebar, en-tête (recherche ⌘K, notifications), bandeau « Prototype » |

## Charte graphique

Couleurs **provisoires** dans `src/app/globals.css` (`--primary`, tons de statut `--tone-*`).
Logo provisoire dans `src/components/logo.tsx`. À remplacer à réception de la charte Nereids.

## Avancement

- ✅ Administrateur Nereids : tableau de bord, liste des dossiers, création, fiche dossier (assignation, statut, relance, documents, messages, clôture, archivage), mon compte
- ✅ Client particulier : activation par e-mail (`/activation/[dossier]`), mes dossiers, fiche dossier
- ✅ Intervenant suiveur : activation par e-mail (`/activation/suiveur/[utilisateur]` : mot de passe + coordonnées, sans écran d'e-mail simulé), dossiers suivis, fiche dossier (messages, dépôt et téléchargement de documents, sa propre référence)
- ⬜ Gestionnaire, expert, réparateur : espaces créés, écrans à concevoir (mon compte déjà disponible)
