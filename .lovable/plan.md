# Espace client /app — refonte intelligente

Cette demande touche des zones déjà fonctionnelles (HomeView, BottomNav 5 onglets, OrdersView, DossierDetail). Avant de tout casser, voici comment je propose de l'implémenter en cohabitation avec l'existant.

## Décisions structurantes (à valider rapidement)

1. **Remplacer l'onglet `home` actuel** par la nouvelle vue "Espace client" (Bonjour + Mes expéditions en cours + Historique + Actions rapides). L'ancien HomeView (KPI rail + ActionBar) est archivé.
2. **Garder la BottomNav existante à 5 onglets** mais la simplifier sur cette tâche : `Accueil · Colis · Historique · Contact` est demandé mais entre en conflit avec Envois/Réceptions/Sourcing/Profil déjà utilisés. **Proposition** : on garde la nav 5-onglets actuelle (qui marche partout), et la section "Historique" + "Contact" vivent à l'intérieur de la nouvelle home. Sinon dis-moi et je remplace.
3. **`/app/dossier/:id`** existe déjà (DossierDetail, 395 lignes, version admin+client). Je le **garde** et j'ajoute juste les manques (section livraison partner_pickup avec adresse en clair, bouton "Payer maintenant" mieux mis en avant). Pas de réécriture complète.

## Plan d'implémentation

### 1. Redirection intelligente (PARTIE 1)
- Nouveau hook `useHasDossiers` existe déjà → l'utiliser.
- Modifier `LandingPage` : si connecté + a des dossiers → bannière sticky top "Suivre mes commandes →" linkant /app.
- Modifier `Auth.tsx` : après login, si `has_dossiers` → redirect `/app`, sinon `/`.
- `homeHref.ts` : retourne `/app` si connecté+dossiers, sinon `/`.

### 2. Nouvelle home `/app` (PARTIES 2-5, 8, 9)
- Créer `src/pages/ClientSpaceView.tsx` (remplace HomeView dans Index quand `view=home`).
- Header : "Bonjour {prenom} 👋" + sous-texte + bouton "+ Nouvelle expédition" → `/expedier`.
- Section **Mes expéditions en cours** :
  - Filtre `status NOT IN ('DELIVERED','ARCHIVED','CANCELLED')` triés DESC.
  - Nouveau composant `ClientDossierCard` (différent de DossierCard actuel) avec : pill statut coloré, ref, route, poids, mode, mini-timeline 5 dots, ETA, boutons [Suivre] et [Payer] conditionnel.
  - Bordure orange + CTA "Payer maintenant" si `payment_status='pending'` ET status >= WEIGHED.
  - Bandeau vert "Colis arrivé — récupérez chez notre partenaire" si `delivery_mode='partner_pickup'` ET `status='ARRIVED_HUB'`.
- Section **Historique** : 5 derniers `DELIVERED`/`ARCHIVED`, card simplifiée + lien "Voir tout".
- Section **Actions rapides** : 3 boutons (Nouveau colis, Mes paiements, Mes factures).
- Empty state si zéro dossier : illustration + CTA "Envoyer mon premier colis".
- FAB "+" flottant mobile en bas droite.

### 3. Realtime (PARTIE 6)
- Hook `useDossiersRealtime` : `supabase.channel().on('postgres_changes', { table: 'dossiers', filter: 'user_id=eq.{uid}' })` → invalide la query react-query + toast sonner "Votre colis YOB-XXXX est maintenant {statut}".

### 4. Page détail (PARTIE 7) — patch ciblé sur DossierDetail.tsx
- Ajouter bloc "Mode de livraison" affichant `relay_point_address` ou adresse partenaire quand `partner_pickup` + ARRIVED_HUB.
- S'assurer que le CTA "Payer" pending est bien visible orange.
- Bouton "Contacter le support" → `wa.me/221786078080`.

### 5. Sécurité (PARTIE 10)
- RLS déjà en place sur `dossiers` (policy "Users can view own dossiers"). Rien à migrer.
- Index.tsx redirige déjà vers /auth si pas de session — OK.

## Fichiers touchés

**Créés**
- `src/pages/ClientSpaceView.tsx`
- `src/components/client/ClientDossierCard.tsx`
- `src/components/client/StatusPill.tsx`
- `src/components/client/MiniTimeline.tsx`
- `src/hooks/useDossiersRealtime.ts`

**Modifiés**
- `src/pages/Index.tsx` (utiliser ClientSpaceView au lieu de HomeView quand view=home)
- `src/pages/Auth.tsx` (redirect post-login intelligent)
- `src/pages/LandingPage.tsx` (bannière sticky)
- `src/pages/DossierDetail.tsx` (bloc livraison partner + CTA payer + support)
- `src/lib/homeHref.ts` (logique /app vs /)

## Questions

1. **BottomNav** : je garde les 5 onglets actuels (Accueil/Envois/Réceptions/Sourcing/Profil) OU je passe à 4 (Accueil/Colis/Historique/Contact) comme demandé ? Le 4-onglets casse Envois/Réceptions/Sourcing existants.
2. **HomeView actuel** : je le remplace complètement par ClientSpaceView, ou je le garde accessible quelque part ?

Sans réponse je pars sur : **garder 5 onglets, remplacer HomeView par ClientSpaceView**.
