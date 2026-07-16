# M1 · M2 · M3 — Plan d'exécution

## M1 — Route de suivi unique : `/suivre` canonique

**Décision** : `/suivre` devient canonique (déjà utilisé par WhatsApp bot, footer public, templates client, ManualQuoteDialog, SendConfirmation, admin sheets). `/track` devient un alias redirigé.

Changements :
- `src/pages/SuivreEntry.tsx` → devient le composant qui **rend** TrackPage (au lieu de rediriger vers /track). Renommer interne : `SuivreEntry` continue à normaliser puis rend `<TrackPage />`.
- `src/pages/TrackPage.tsx` :
  - `useSeo({ path: '/suivre/…' })` avec canonical dynamique par ID.
  - Normalisation redirect cible `/suivre/:id` au lieu de `/track/:id`.
  - Form vide redirige vers `/suivre/:id`.
- `src/App.tsx` : `/suivre` et `/suivre/:trackingNumber` rendent `<TrackPage />`. `/track` et `/track/:id` → `<Navigate to="/suivre…" replace />` (301-like côté client). Retirer les doublons de blocs (lignes 106-109 vs 159-160 vs 199-200).
- `src/components/PublicNav.tsx` : lien Suivre → `/suivre`.
- `src/pages/LandingPage.tsx` (2 refs) : `/track` → `/suivre`.
- `src/pages/OrderConfirmationPage.tsx` : `/track` → `/suivre`.
- `src/pages/DevisConfirmerPage.tsx` : `navigate('/track/…')` → `/suivre/…`.
- `public/sitemap.xml` + `scripts/generate-sitemap.ts` : entrée `/track` → `/suivre` (garder une seule URL indexable).
- `public/robots.txt` : rien à changer (aucun disallow sur ces routes).

## M2 — Draft DB persisté AVANT auth (SendFlow)

Objectif : si l'utilisateur ferme la modale auth interstitielle, il retrouve son intake au retour et n'a pas à tout re-saisir.

Changements dans `src/components/flows/SendFlow.tsx` :
- Juste avant d'ouvrir `AuthInterstitialModal` (ligne 2380), appeler un helper `saveIntakeDraftForAuth(formState)` qui :
  1. tente `supabase.auth.getUser()` — si déjà connecté, skip modale.
  2. sinon, écrit dans `intake_drafts` avec `user_id = null` + un **claim token** UUID stocké en `localStorage` (`yob.intake.claim`) + le `draft_data`. (nouveau champ `claim_token uuid nullable` si absent — sinon on stocke dans `draft_data.__claim`).
  3. la modale d'auth affiche un texte : « Vos infos sont sauvegardées, connectez-vous pour finaliser ».
- Après auth réussie (retour sur SendFlow via `useEffect` de restauration existant), si `localStorage.yob.intake.claim` est présent :
  - `select` sur `intake_drafts` par claim, `update` `user_id = auth.uid()`, restaurer le state, effacer le claim local.
- Ajouter le hook `useIntakeDraft` déjà existant côté SendFlow s'il ne l'est pas (auto-save 10s en plus du snapshot pré-auth).

Note DB : `intake_drafts.user_id` doit accepter `null` OU on stocke le pré-auth via une table dédiée. **Vérification à faire à l'exécution** : lire la migration existante. Si `user_id` est NOT NULL, on utilise `localStorage` seul comme fallback pré-auth (pas d'écriture DB), et on écrit en DB juste après auth. Plus simple, moins de surface RLS → **c'est l'option retenue par défaut**.

**Approche retenue (simple)** :
- Pré-auth : `localStorage.setItem('yob.intake.pending', JSON.stringify(state))` juste avant d'ouvrir la modale.
- Post-auth : dans le `useEffect` de restauration, si `yob.intake.pending` existe, l'hydrater en priorité, puis appeler l'auto-save `useIntakeDraft` normalement, puis `removeItem`.

Aucune migration nécessaire. Aucun risque RLS. Compat totale.

## M3 — `buildClientRecap` robuste (InboxTab)

`src/components/admin/inbox/InboxTab.tsx` :
- Remplacer `Math.round(d.estimated_cost * 655.957)` par : `d.final_amount_xof ?? Math.round((d.estimated_cost ?? 0) * 655.957)` — priorité au montant final déjà ajusté (inclut `pricing_adjustments`).
- Guard cities : si `origin_city` ou `destination_city` est null, ligne trajet omise (au lieu de `"null -> Paris"`).
- URL suivi : `https://yobbante.com/suivre/${d.reference}` (chemin, plus `?ref=`), aligné sur la canonique M1 + templates existants.
- Guard `d.reference` : si absent, pas de ligne « Suivi ».

## Technique — ordre d'exécution

1. M1 routes + liens (bas risque, purement navigation).
2. M3 recap (isolé, 1 fichier).
3. M2 draft pré-auth (le plus délicat — teste flux complet).

Type-check après chaque étape. Pas de changement de schéma DB.
