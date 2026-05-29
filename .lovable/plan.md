# Mode réception à l'arrivée

Implémentation complète des 3 modes de réception (partenaire / point relais / domicile) avec gestion admin des relais et du partenaire destination.

## 1. Base de données (migration unique)

**Table `relay_points`** — points relais Dakar
- `id`, `name`, `address`, `contact_phone`, `contact_name`, `quartier`, `is_active` (default false), `opening_hours`, `notes`, timestamps
- RLS : lecture publique des actifs, écriture admin uniquement
- GRANT anon SELECT (filtré par RLS sur `is_active = true`), admin full

**Table `delivery_partners`** — partenaires de retrait à destination
- `id`, `destination_country` (unique), `name`, `address`, `phone`, `opening_hours`, `instructions`, `is_active`, timestamps
- RLS : lecture authentifiée, écriture admin

**Enum `delivery_mode_type`** : `partner_pickup`, `relay_point`, `home_delivery`

**Colonnes ajoutées à `dossiers`** :
- `delivery_mode delivery_mode_type` (default `partner_pickup`)
- `relay_point_id uuid references relay_points`

**Seeds** : 2 relais Dakar inactifs (Liberté 6, Mermoz)

**Trigger** : sur passage de `dossiers.status` → `ARRIVED_HUB`, si `delivery_mode = 'partner_pickup'`, appel HTTP edge function `notify-partner-pickup` (best-effort, ne bloque pas l'update).

## 2. Edge function `notify-partner-pickup`

- Reçoit `dossier_id`
- Charge dossier + profil client + `delivery_partners` du pays destination
- Envoie WhatsApp via fonction existante `send-whatsapp` avec template texte exact demandé
- Log dans `whatsapp_outbound_messages`

## 3. Admin `/admin/relais`

Page protégée admin :
- Liste tableau (Nom · Adresse · Contact · Quartier · Actif · Actions)
- Bouton "+ Ajouter un point relais" (haut droite)
- Drawer édition / création avec tous les champs + toggle actif
- Toggle activer/désactiver inline

## 4. Admin `/admin/parametres` — section "Partenaire livraison à destination"

- Si page existe : ajout de la section ; sinon création minimale
- Liste partenaires par pays destination
- Formulaire CRUD : nom, adresse, téléphone, horaires, instructions, actif
- Routing ajouté + lien dans nav admin

## 5. SendFlow — étape destinataire

- 3 cards : Partenaire (gratuit) / Point relais / Domicile
- Si destination ≠ Dakar (Sénégal/Dakar) : cards 2 et 3 désactivées avec note "Disponible uniquement à Dakar"
- Card "Point relais" : dropdown des relais actifs ; si aucun → card masquée avec tooltip "Points relais bientôt disponibles à Dakar. Contactez-nous."
- État local `deliveryMode` + `relayPointId` → envoyés au submit (`delivery_mode`, `relay_point_id`)
- Card "Domicile" reste l'option existante avec champ adresse

## 6. Contraintes appliquées
- Design dark + accent `#F5C518` (semantic tokens existants)
- Mobile-first
- Français
- RLS strict (admin only writes ; lecture publique limitée)
- Notification auto best-effort (n'interrompt pas la transition)

## Fichiers prévus
- Migration SQL (1 call)
- `supabase/functions/notify-partner-pickup/index.ts`
- `src/pages/admin/RelaisPage.tsx`
- `src/pages/admin/ParametresPage.tsx` (ou ajout section si existante)
- `src/components/flows/SendFlow.tsx` (étape destinataire)
- `src/App.tsx` (routes)
- Lien admin nav si applicable

## Limitations / hypothèses
- "Dakar" détecté via `destCity.city === 'Dakar'` (et `destination_country === 'SN'`).
- Le trigger PG appelle l'edge function via `net.http_post` — pattern déjà utilisé dans le projet.
- Si `/admin/parametres` n'existe pas, page minimale créée avec uniquement la section partenaires (extensible ensuite).
