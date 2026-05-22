# Lien sécurisé de modification client/GP

Système permettant aux clients et transporteurs de corriger leurs infos via un lien unique à usage limité (24h).

## 1. Base de données

Migration créant :

- **Table `edit_tokens`** : token unique (32 bytes hex), entity_type (`dossier_client` / `dossier_destinataire` / `transporteur` / `client`), entity_id, fields_allowed (TEXT[]), used_at, expires_at (défaut +24h), created_by.
- **RLS** : 
  - Lecture publique d'un token valide via RPC `get_edit_token(token)` (SECURITY DEFINER) — retourne entity_type, entity_id, fields_allowed, valeurs actuelles, tracking_id si dossier.
  - Application de la modification via RPC `apply_edit_token(token, payload jsonb)` (SECURITY DEFINER) qui :
    - Vérifie validité du token
    - Filtre payload aux champs autorisés
    - Met à jour la table cible
    - Marque `used_at = now()`
    - INSERT dans `dossier_events` (ou log équivalent pour transporteur) avec `old → new`
    - Déclenche un appel HTTP à la fonction `notify-admin-edit` pour WhatsApp admin
  - Seuls admins/staff peuvent INSERT directement dans `edit_tokens`.

## 2. Page publique `/modifier/:token`

- Route ajoutée dans `App.tsx` (publique, hors auth).
- Composant `PublicEditPage.tsx` :
  - Appel RPC `get_edit_token`
  - Si invalide → écran "Lien expiré ou invalide. Contactez-nous : +221 78 607 80 80"
  - Si valide → formulaire dynamique (uniquement les champs autorisés, pré-remplis)
  - Submit → RPC `apply_edit_token` → toast succès + écran de confirmation
- Design : dark Yobbante + accent `#F5C518`, logo en header, titre + tracking_id, responsive mobile.

## 3. Edge function `notify-admin-edit`

- Appelée par la RPC après modification
- Envoie WhatsApp via `send-whatsapp` (numéro 607) au `+221 78 460 40 03` avec récap des changements
- Logue dans `whatsapp_outbound_messages` (trigger_type = `edit_notification`)

## 4. Génération de lien depuis admin

- **`OrderDetailDrawer`** : bouton "Envoyer lien de modification" → dialog avec checkboxes (Infos expéditeur / destinataire / date collecte / adresse livraison) → crée token via insert → envoie WhatsApp 607 au client avec `yobbante.com/modifier/{token}`.
- **Fiche transporteur** (`TransporteurDetailDrawer` ou équivalent) : même bouton avec champs transporteur (`telephone_1`, `adresse_collecte_dakar`, `adresses_remise`).

## 5. Commande bot `MODIFIER`

- **`bot-client/index.ts`** : intercepte "MODIFIER" → crée token `dossier_client` pour le dernier dossier actif du client (via téléphone) → envoie lien + menu court.
- **`gp-bot/index.ts`** : intercepte "MODIFIER" → crée token `transporteur` pour le GP courant → envoie lien.

## 6. Audit des modifications admin

- Vérifier que `OrderDetailDrawer` logue déjà les modifications de champs dans `dossier_events` (status, transporteur). Étendre pour : `contact_phone`, `pickup_address`, `actual_weight_kg`, `notes` (event_type = `field_edited`, event_data = `{field, old, new, edited_by}`).

## Contraintes respectées

- Token usage unique (used_at) + TTL 24h
- Champs strictement filtrés côté serveur (RPC)
- Toute modification → notification admin + event log
- Textes français, design dark Yobbante + #F5C518
- Page mobile-first

## Détails techniques

- RPC `get_edit_token` et `apply_edit_token` en SECURITY DEFINER avec `search_path = public`.
- Numéro admin stocké côté fonction (constante `ADMIN_PHONE`).
- Pas de wa.me — tout passe par `send-whatsapp` (607).
- Les anciennes valeurs sont capturées dans la RPC avant UPDATE pour produire le diff.
