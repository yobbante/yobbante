## Objectif

Remplacer l'assignation « GP seul » par une assignation **GP + Départ**. Chaque dossier sera lié à un `manual_departures.id` réel, avec vérification de capacité, mise à jour des kg réservés, blocage du passage en transit sans départ, et notification GP enrichie.

## Changements DB (migration unique)

1. **Trigger `enforce_departure_before_transit`** sur `dossiers` : empêche `status → IN_TRANSIT` si `assigned_departure_id IS NULL`.
2. **Fonction `assign_dossier_to_departure(p_dossier_id, p_departure_id, p_transporteur_ref)`** (SECURITY DEFINER, staff only) :
   - Vérifie que le départ existe et n'est pas annulé/complet.
   - UPDATE `dossiers` : `assigned_departure_id`, `assigned_transporteur_ref`, `estimated_departure_date = departure.departure_date`, bump status à `ASSIGNED` si encore en amont.
   - UPDATE `manual_departures` : recalcule `available_capacity_kg` = `total - reserved` (incrémente `reserved_capacity_kg` du poids du dossier, en libérant l'ancien départ s'il existait).
3. **Fonction `release_dossier_departure(p_dossier_id)`** : libère la réservation côté départ et nettoie le dossier (pour « Détacher » / « Changer »).

## Front-end

### Nouveau composant `AssignDepartureDialog.tsx` (3 étapes)

- **Étape 1 — GP** : Liste filtrée par destination (réutilise `TransporteurReferenceLookup` ou requête `transporteurs` servant la destination via `transporteur_serves_city`). Colonnes : nom, destinations, date du prochain départ (mini-aperçu via subquery sur `manual_departures`).
- **Étape 2 — Départ** : `SELECT * FROM manual_departures WHERE transporteur_ref = ? AND departure_date >= now() AND status IN ('active','draft','ready','published') AND (destination_city ILIKE %dest% OR destination_country = ?) ORDER BY departure_date`. Pour chaque ligne : date, route, kg dispo, nb colis déjà assignés (count sur `dossiers.assigned_departure_id`). Si aucun → message orange + bouton « + Créer un départ » (pré-remplit le formulaire existant via un drawer, pré-rempli avec GP+destination).
- **Étape 3 — Confirmation** : résumé GP / départ / capacité après. Warning orange non bloquant si poids > capacité restante. Bouton « Confirmer » → appelle la RPC `assign_dossier_to_departure`, puis re-déclenche l'envoi WhatsApp via `assignGpAndNotify` (modifié pour accepter un `departureId` et inclure date/route dans le message).

### Mise à jour `assignGpAndNotify.ts`

- Nouvelle signature : `{ dossierId, transporteurRef, departureId? }`.
- Si `departureId` fourni → appel RPC `assign_dossier_to_departure` au lieu du UPDATE direct.
- Le template WhatsApp GP intègre : route, date du départ, poids, nb total colis sur ce départ, total kg réservés sur ce départ.

### `TransportTab` (AdminDossierSheet)

- Ajout d'une carte « Départ assigné » avec ✈ route + date + GP + ref du départ + capacité restante.
- Bouton « Changer le départ » → réouvre le dialog directement à l'étape 2.
- Si pas de départ mais GP assigné : badge orange « Aucun départ — assignez-en un ».

### `RequestsTab`

- Le bouton « Attribuer un GP » ouvre maintenant `AssignDepartureDialog` (en remplacement de `QuickAssignGpDialog` que l'on garde pour rétro-compat mais qui n'est plus monté).

### Vue `/admin/departs` (DeparturesWeekPage)

- Pour chaque départ : section « Colis assignés » (liste tracking + poids + statut depuis `dossiers WHERE assigned_departure_id = …`) + `CapacityBar` `reserved/total`.

## Contraintes respectées

- `assigned_departure_id` obligatoire avant `IN_TRANSIT` (trigger DB).
- Warning capacité non bloquant (front uniquement).
- Filtre départs par destination du dossier.
- Notification GP enrichie avec infos départ.
- Design Yobbanté dark + `#F5C518`, mobile-first, FR.

## Fichiers touchés

- **Nouveau** : `src/components/admin/dossiers/AssignDepartureDialog.tsx`
- **Migration** : trigger `enforce_departure_before_transit` + RPC `assign_dossier_to_departure` / `release_dossier_departure`
- **Modifiés** :
  - `src/lib/assignGpAndNotify.ts` (signature + message enrichi)
  - `src/components/admin/RequestsTab.tsx` (utilise le nouveau dialog)
  - `src/components/admin/dossier-sheet/AdminDossierSheet.tsx` (TransportTab : carte départ + changer)
  - `src/pages/admin/DeparturesWeekPage.tsx` (liste colis + barre capacité)

## Hors scope (à confirmer)

- Pas de refonte des templates côté `_wa_send_via_function` SQL.
- Pas de modification de l'attribution depuis le bot GP.
