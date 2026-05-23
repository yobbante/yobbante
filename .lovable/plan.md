## Objectif

Remplacer la redirection « Ouvrir la fiche » par un **panneau latéral plein écran** (`Sheet` à droite, largeur ~960px sur desktop, plein écran sur mobile) qui s'ouvre **par-dessus le dashboard admin**, sans quitter la liste des dossiers ni perdre les filtres en place.

L'admin doit pouvoir tout faire depuis ce panneau, sans naviguer ailleurs.

---

## Nouveau composant : `AdminDossierSheet`

Fichier : `src/components/admin/AdminDossierSheet.tsx`

Props :
```
{ dossierId: string | null; onClose: () => void }
```

Monté **une seule fois** dans `DossiersHubTab` ; les sous-composants (`RequestsTab`, `InboxTab`, `ReceptionKanbanTab`, `SourcingTab`) déclenchent l'ouverture via un contexte léger `DossierSheetContext` (`open(id)`), pour qu'un même clic « Ouvrir la fiche » fonctionne dans les 4 onglets.

### Header collant
- Référence + tracking_id (copier en 1 clic)
- Badge statut + sélecteur de transition (réutilise `getStatutsPourDossier`)
- Pays origine → destination avec drapeaux
- Boutons rapides : *WhatsApp client*, *Envoyer lien d'édition*, *Imprimer étiquette*, *Fermer*

### Corps en onglets (`Tabs`)
1. **Aperçu** — fiche éditable inline (`AdminInlineEditor` déjà présent) sur :
   expéditeur (nom/tel/adresse/date enlèvement), destinataire (nom/tel/adresse), produit, poids estimé, valeur, notes admin. Sauvegarde optimistic via mutation `updateDossier`.
2. **Colis & poids** — liste des packages liés + bouton « Rattacher des colis » (`AttachPackagesDialog`) + bouton « Peser » (`WeighingDialog`) qui passe le dossier en `WEIGHED` et calcule `final_amount_xof`.
3. **Transport** — section clé :
   - Si pas encore assigné : `TransporteurReferenceLookup` + liste des départs ouverts compatibles (route + poids) issus de `all_active_departures`. Un clic → met à jour `assigned_transporteur_ref`, `assigned_departure_id`, recalcule la capacité réservée via `recompute_departure_reserved_capacity`.
   - Si assigné : carte transporteur (nom, tel, capacité restante, date départ) + bouton « Détacher / Réassigner ».
4. **Paiement** — statut paiement, montant final, COD on/off (`set_dossier_cod_public` côté SQL), bouton « Marquer payé » (réutilise la mutation déjà créée en Phase 3 dans `RevenusTab`), lien facture (`invoice_url`).
5. **Livraison (dernier km)** — réutilise `DernierKmPanel` existant.
6. **Messages** — `useDossierMessages` (public + interne staff), composer avec switch « Note interne ».
7. **Documents** — `DossierDocuments` existant.
8. **Historique** — flux `dossier_events` (lecture seule, ordre antéchronologique).

### Footer collant
Statut + dernière mise à jour à gauche, à droite : « Annuler le dossier » (rouge, confirmation, appelle un trigger `cancel_dossier` ou met à jour status `CANCELLED`), « Voir la page publique » (lien tracking).

---

## Câblage

- Le bouton actuel `onClick={() => navigate(...)}` dans `RequestsTab.tsx` (ligne 412) appelle désormais `sheet.open(d.id)`.
- Idem dans `InboxTab`, `ReceptionKanbanTab`, `SourcingTab` (remplace les anciens drawers/dialog par le même `open(id)`).
- Synchro URL : `?dossier=<id>` poussé en query string pour partage / refresh sans perdre la fiche ouverte.
- Realtime : abonnement `dossiers:id=eq.<id>` pour refléter automatiquement les changements externes (paiement webhook, nouveau message client).

---

## Couches techniques

- **Hook** `useAdminDossier(id)` → fetch dossier + packages + events + messages, expose toutes les mutations (`updateField`, `setStatus`, `assignTransporteur`, `markPaid`, `cancel`).
- **Permissions** : guard via `useUserRole().isStaff` ; les actions destructives requièrent `isAdmin`.
- **Réutilisation maximale** : aucun composant existant n'est dupliqué (`AttachPackagesDialog`, `WeighingDialog`, `DernierKmPanel`, `DossierDocuments`, `useDossierMessages`, `TransporteurReferenceLookup` sont tous montés tels quels).
- **Mobile (< 768px)** : `Sheet` plein écran, onglets scrollables horizontalement.

---

## Livraison en 2 étapes

1. **Étape A (ce tour)** — Créer `AdminDossierSheet` + contexte + hook, brancher dans `DossiersHubTab` et `RequestsTab`. Onglets *Aperçu*, *Transport*, *Paiement*, *Messages* fonctionnels. Le reste sous forme de placeholders bien identifiés.
2. **Étape B (tour suivant)** — Brancher *Colis & poids*, *Livraison*, *Documents*, *Historique* + brancher les autres entrées (`InboxTab`, `ReceptionKanbanTab`, `SourcingTab`) sur le même contexte, et la synchro URL.

Cette séparation évite un commit géant et permet de valider l'ergonomie avant d'investir sur les onglets secondaires.