# Onglet actif visible + module de split de colis

## 1. Savoir en un coup d'œil dans quel onglet on est

Dans la barre d'onglets de `/admin/dossiers` :
- l'onglet actif prend un fond plein couleur primaire avec texte contrasté (mobile **et** desktop), au lieu du simple soulignement actuel ;
- les autres onglets restent discrets (texte gris, pas de fond) ;
- sur mobile, l'onglet actif affiche aussi son libellé à côté de l'icône (les autres restent en icône seule), pour qu'on lise « À traiter » sans deviner ;
- le bandeau de contexte sous les onglets reprend la même couleur d'accent que l'onglet actif.

Fichiers : `src/components/admin/hub-ui.tsx` (composant `HubTab`), `src/components/admin/DossiersHubTab.tsx` (bandeau).

## 2. Module de split de colis

### Principe
Un dossier peut être scindé en plusieurs **sous-colis**, chacun avec son propre poids, son propre GP/transporteur et son propre départ. Cas Mulah : 1 demande → colis 1 chez GP A, colis 2 chez GP B.

- Le dossier d'origine devient le **dossier parent** : il garde le client, le prix total facturé, l'adresse, et sert de vue d'ensemble.
- Chaque sous-colis est un dossier enfant avec sa référence dérivée (`YBT-2026-5830-1`, `-2`, …), son poids, son GP, son départ, son statut et son suivi.
- Le statut public du parent est calculé à partir des enfants : on affiche l'étape la moins avancée (« 1 colis livré, 1 en transit »).
- Le coût transporteur se saisit par enfant ; le parent additionne pour la marge et la finance.

### Base de données
Ajout sur `dossiers` : `parent_dossier_id` (référence au parent), `split_index`, `split_count`.
Fonction `split_dossier(dossier_id, parts[])` qui crée les enfants en copiant les données client/route, répartit le poids et le prix, et journalise l'événement dans la timeline du parent.
Règles d'accès identiques au dossier parent (le client voit ses enfants, l'admin/agent aussi).

### Côté admin
- Fiche dossier (`AdminDossierSheet`) : nouvelle action **« Scinder en plusieurs colis »** → dialogue où l'on choisit le nombre de colis, puis pour chacun : description, poids, GP/transporteur et départ. Après validation, la fiche affiche la liste des sous-colis, chacun cliquable pour ouvrir sa propre fiche.
- Fiche d'un enfant : bandeau « Colis 2/2 du dossier YBT-… » avec retour au parent.
- Liste des dossiers (`RequestsTab`) : le parent affiche un badge « 2 colis » et, au dépliement, la ligne de chaque sous-colis avec son GP et son statut. Les enfants ne polluent pas la liste principale (ils apparaissent sous leur parent).
- Départs : chaque sous-colis compte dans la capacité de son propre départ.
- Finance / paiements : un seul paiement client au niveau du parent ; les reversements transporteurs sont listés par sous-colis et additionnés dans le bénéfice net.

### Côté client
- Espace client et page publique de suivi : le dossier affiche « Votre envoi a été réparti en 2 colis » avec une mini-timeline par colis (GP, départ, statut, date estimée).
- Notifications WhatsApp/push : envoyées par colis, avec mention « Colis 1/2 ».

### Responsive
Dialogue de split en pleine hauteur scrollable sur mobile, cartes de sous-colis empilées ; tableau en colonnes sur desktop.

## Ordre de réalisation
1. Onglet actif (rapide, visible immédiatement).
2. Migration base + fonction de split.
3. Dialogue de split + affichage parent/enfants en admin.
4. Synchronisation finance, départs, liste des dossiers.
5. Affichage client (espace client + suivi public) et notifications.
