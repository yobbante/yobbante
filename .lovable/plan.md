## Plan — Devis sur mesure + gating étapes SendFlow

### 1. Séquencement strict des étapes (SendFlow)
- Aujourd'hui après étape 2 (Type marchandise), l'utilisateur peut sauter à l'étape 7. Cause : `advanceFromStep(2)` scrolle vers l'étape 3 mais rien n'empêche le bouton "Continuer" des étapes suivantes de sauter au récap.
- Ajouter dans `advanceFromStep()` un `next = step + 1` strict, désactiver les boutons "Continuer" tant que `stepValidity[currentStep]` est faux, et forcer le focus/scroll sur l'étape N+1 uniquement (pas 7).
- Vérifier que le bouton "Continuer" de chaque étape appelle bien `advanceFromStep(N)` — corriger ceux qui appellent `submit()` ou sautent directement.

### 2. Popup devis "new generation"
- Étape 3, quand `noInstant = true` : le bouton "Demander un devis sur mesure" ouvre aujourd'hui `ManualQuoteDialog` très basique (nom + tel + note).
- Refonte visuelle du composant `ManualQuoteDialog` en gardant la table `dossiers` (statut `QUOTE_REQUESTED`, `source: devis_sur_mesure`) :
  - Reprendre exactement le langage visuel de `SendFlow` (FlowSection, TextField, ChipGroup, radios pastilles jaune #F5C518, arrondis `rounded-2xl`, boutons `bg-foreground text-background rounded-full`).
  - Pré-remplir automatiquement TOUS les champs déjà saisis (trajet, poids, valeur déclarée, type marchandise, transport, urgence, collecte, destinataire, assurance…).
  - Sections repliables :
    1. Trajet & colis (résumé lecture seule, éditable via "Modifier").
    2. Coordonnées client : nom, téléphone WhatsApp (validation phone), email optionnel.
    3. Précisions : contenu détaillé, contraintes (fragile, urgence, budget max, date souhaitée), photos (upload multi via `dossier_documents`).
  - Confirmation : référence + tracking ID + CTA "Suivre ma demande" + "Compléter mon dossier" (renvoie vers `/app/dossiers/:id` où il pourra ajouter étapes 4-7).

### 3. Masquer étapes 4-7 tant qu'aucun départ actif
- Nouvelle constante `hasActiveDeparture = options.length > 0` (déjà calculée = `hasInstantDeparture`).
- Conditionner le rendu des blocs étapes 4, 5, 6, 7 : ne rendre que si `hasActiveDeparture` OU si le dossier a déjà été créé via devis (mode "compléter mon dossier").
- Adapter la numérotation totale (`total={7}` → `total={hasActiveDeparture ? 7 : 3}`) et le stepper `aria-live`.

### 4. Module Devis — Admin + Client

**Backend :** conserver `dossiers` avec `status='QUOTE_REQUESTED'` (déjà utilisé par ManualQuoteDialog). Ajouter colonnes migration si absentes : `quote_amount_xof`, `quote_currency`, `quote_valid_until`, `quote_notes_admin`. Vérifier RLS existante.

**Admin — nouvelle vue `/admin/leads?tab=devis-mesure` (ou refonte `ManualQuotesTab`) :**
- Liste responsive (table desktop, cartes mobile) filtrable par statut : `pending / quoted / accepted / expired`.
- Drawer détail avec :
  - Résumé complet du dossier (trajet, poids, valeur, contenu, photos, urgence).
  - Coordonnées client + boutons WhatsApp/Téléphone.
  - Formulaire "Envoyer un devis" : montant XOF, validité (date), notes, → passe status à `quoted` + envoi WhatsApp template au client avec lien `/app/devis/:id`.
  - Historique des messages / événements.

**Client — dashboard `/app` :**
- Nouvelle section `MesDevis` dans `ClientSpaceView.tsx` listant les dossiers `status='QUOTE_REQUESTED'` de l'utilisateur.
- Carte devis : trajet, poids, statut (En attente / Devis reçu / Accepté), CTA :
  - `pending` → "Compléter ma demande" (rouvre popup pour ajouter infos manquantes 4-7).
  - `quoted` → "Voir le devis" (page détail avec montant, valide jusqu'au, boutons Accepter/Refuser).
  - `accepted` → devient un dossier standard, rejoint `useDossiers`.
- Page détail `/app/devis/:id` responsive avec toutes les infos + timeline.

### Détails techniques
- Fichiers à créer :
  - `supabase/migrations/xxx_quote_columns.sql` (colonnes quote_amount_xof, etc.)
  - `src/hooks/useMyQuotes.ts`
  - `src/pages/QuoteDetailPage.tsx` (client)
  - `src/components/admin/QuoteDetailDrawer.tsx`
- Fichiers à modifier :
  - `src/components/flows/SendFlow.tsx` (gating, masquage 4-7)
  - `src/components/flows/ManualQuoteDialog.tsx` (refonte UI + prefill étendu)
  - `src/components/admin/ManualQuotesTab.tsx` (refonte responsive + drawer)
  - `src/pages/ClientSpaceView.tsx` (section MesDevis)
  - `src/App.tsx` (route /app/devis/:id)

### Validation
- Test manuel : trajet sans départ → seules étapes 1-3 visibles → popup devis prérempli → soumission → apparition dans admin + espace client.
- Test manuel : trajet avec départ → toutes étapes visibles séquentiellement.
- Build + typecheck.
