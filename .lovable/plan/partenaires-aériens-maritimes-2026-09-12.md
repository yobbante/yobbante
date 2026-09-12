# Partenaires aériens & maritimes

Créer un espace partenaire pour les transitaires aériens et maritimes, sur le même principe que l'espace GP, plus un formulaire admin simplifié pour saisir un départ aérien ou maritime à la main.

## 1. Comptes partenaires

Nouvelle fiche partenaire : société, mode (aérien / maritime / les deux), contact (téléphone WhatsApp, email), villes/ports desservis, statut (actif, suspendu), délais et tarifs par défaut, notes internes.

L'admin crée le compte depuis un nouvel onglet **Partenaires** dans Départs, puis envoie un lien d'accès par WhatsApp. Connexion sans mot de passe, comme pour les GP : le partenaire saisit son numéro sur une page de connexion, reçoit un lien valable 24 h, et accède à son tableau de bord.

## 2. Tableau de bord partenaire

Adresse `/partenaire/:ref`, même style sombre/or que l'espace GP, pensé mobile :

- Résumé : départs à venir, capacité restante, réservations reçues.
- Liste de ses départs (à venir / passés) avec modification et annulation.
- Bouton « Publier un départ » avec un formulaire adapté au mode :
  - **Aérien** : compagnie, n° de vol, aéroport de départ/arrivée, date de départ, date limite de dépôt (cut-off), capacité en kg, prix au kg, délai d'arrivée estimé.
  - **Maritime** : compagnie/armateur, navire, port de départ/arrivée, LCL ou FCL (20"/40"), date de départ, cut-off, capacité en CBM (ou nombre de conteneurs), prix au CBM ou au conteneur, transit estimé en jours.
- Les départs publiés apparaissent automatiquement sur la page publique « Prochains départs » et sont utilisables par l'admin pour affecter des dossiers.

## 3. Côté admin

- Onglet **Partenaires** (dans Départs) : liste, création, envoi/renvoi du lien d'accès, activation/suspension, vue des départs de chaque partenaire.
- Formulaire **Nouveau départ aérien / maritime** simplifié (plus court que celui des GP) : partenaire (optionnel), trajet, dates, capacité, prix — les champs suivent le mode choisi.
- Les départs partenaires arrivent en « à valider » ; l'admin peut publier, corriger ou refuser. Un badge distingue les départs saisis par un partenaire de ceux saisis en interne.

## 4. Détails techniques

- Table `freight_partners` (+ GRANT + RLS : admin/staff plein accès, lecture publique limitée aux partenaires actifs).
- Table `freight_partner_tokens` et fonctions `fp_request_auth` / `fp_consume_token` calquées sur `gp_request_auth` / `gp_consume_token`, session stockée côté navigateur (`freight_partner_session`).
- Réutilisation de `manual_departures` avec `transport_mode` `air` / `sea_lcl`, `source = 'partner'`, et nouvelles colonnes : `partner_id`, `carrier_company`, `flight_or_vessel`, `cutoff_date`, `port_origin`, `port_destination`, `container_type`, `capacity_cbm`, `price_per_kg_xof`, `price_per_cbm_xof`, `transit_days`.
- Écriture des départs partenaires via une fonction sécurisée (jeton partenaire vérifié côté serveur), jamais en accès direct à la table.
- Envoi des liens d'accès via la fonction WhatsApp existante.
- La page `/departs` et l'affectation de dossiers lisent déjà `manual_departures` : rien à refaire, juste l'affichage des champs propres à chaque mode.
