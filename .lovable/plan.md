# Gestion des dossiers à plusieurs colis

Aujourd'hui un envoi scindé crée des colis enfants, mais le dossier parent garde son propre statut, chaque colis n'a pas de numéro de suivi propre, et les paiements (encaissement client, reversements aux transporteurs) ne se gèrent qu'au niveau global. Voici comment rendre le tout cohérent.

## 1. Statut : le parent se déduit des colis

Règle unique : dès qu'un dossier a des colis, **son statut n'est plus modifiable à la main**. Il se calcule tout seul :

- tous les colis au même statut → le parent prend ce statut ;
- statuts différents → le parent prend le statut **le moins avancé** (le client n'est « livré » que quand tout est livré) ;
- un colis annulé est ignoré dans le calcul (sauf si tous le sont).

Affichage partout (liste admin, fiche, espace client, lien public) :
« En transit — 1 colis sur 2 livré ». La barre d'avancement du client reflète le colis le moins avancé, avec le détail par colis en dessous.

Le calcul se fait côté base (déclencheur sur les colis enfants) pour que la vue globale, la finance et les notifications restent justes sans dépendre de l'écran ouvert.

## 2. Ajouter, modifier, retirer un colis à tout moment

- Bouton **« Ajouter un colis »** toujours disponible dans la fiche (plus seulement au moment du « Scinder »).
- Chaque colis se modifie en place : contenu, poids, transporteur, départ, statut, montant.
- Un colis peut être **annulé** (il sort du calcul de statut et des totaux) ; suppression réservée à un colis sans mouvement.
- Si un seul colis reste actif, on peut **refusionner** vers le dossier simple.

## 3. Suivi : un numéro par colis

- Chaque colis reçoit son propre numéro de suivi dérivé du dossier (`YOB-XXXX-1`, `-2`, …), affiché et copiable en un clic côté admin et client.
- Le lien public accepte aussi bien le numéro du dossier que celui d'un colis : le numéro du dossier montre la vue d'ensemble + la liste des colis ; le numéro d'un colis ouvre directement ce colis avec un retour vers l'envoi complet.
- Chaque colis a sa propre date d'arrivée estimée (elle dépend de son transporteur / de son départ) ; l'envoi affiche la date la plus tardive.
- Les messages WhatsApp de changement de statut précisent le colis concerné (« Colis 2/2 — arrivé à Dakar »).

## 4. Paiements : un encaissement client, plusieurs reversements

- **Côté client** : le montant reste porté par le dossier parent (pas de double comptage). On peut enregistrer des **paiements partiels** (acompte, solde) : montant, date, moyen (Wave, Orange Money, espèces, virement), note. Le reste dû se calcule automatiquement.
- **Côté transporteurs** : chaque colis porte son transporteur, son coût et son état de reversement (à verser / versé, date, moyen). Ajout manuel possible sur n'importe quel colis.
- La fiche paiement affiche : total client, déjà encaissé, reste dû, total à reverser par colis, marge nette réelle.
- Les onglets Paiements et Bilan & TVA reprennent exactement ces chiffres : revenu = parent uniquement, coûts = somme des colis.

## 5. Cohérence dans tout l'admin

- Liste des dossiers : une seule ligne par envoi avec le badge « N colis » et les colis dépliables (comportement actuel conservé).
- Vue globale, finance, agents terrain et fret routier lisent tous le statut calculé.
- Historique : chaque changement de statut ou paiement est journalisé au niveau du colis et remonte dans la chronologie de l'envoi.

## Détails techniques

- Base : ajout `tracking_id` par enfant, table `dossier_payments` (dossier_id, sens client/transporteur, montant, moyen, date, note, auteur) avec droits d'accès réservés au personnel ; déclencheur `recompute_parent_status()` sur `dossiers` (insert/update/delete des enfants) ; RPC `add_dossier_parcel` et `merge_dossier_parcels`.
- Front : `useDossierSplit.ts` étendu (ajout/annulation/refusion), nouveau `useDossierPayments.ts`, `SplitColisPanel.tsx` en mode édition, `PaymentDetailSheet.tsx` avec journal des paiements, `useAllPayments.ts` / `useFinanceLedger.ts` alignés sur les paiements réels.
- Public : `track-shipment` accepte un numéro de colis, renvoie statut agrégé + `parcels` enrichis (tracking, ETA, transporteur) ; `TrackPage.tsx` adapté.
