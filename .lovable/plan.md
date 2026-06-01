# Système Départs GP Autonome

Objectif : permettre aux GP de déclarer eux-mêmes leurs départs via une URL personnelle sans login, avec rappels WhatsApp automatiques et dashboard admin temps réel.

## 1. Base de données

**Migration** (`supabase/migrations/`)
- `transporteurs` : ajouter `depart_url TEXT` (auto-généré à partir de `reference`).
- `manual_departures` : ajouter `created_via TEXT` (`gp_self`, `admin`, `whatsapp_import`), `gp_reference TEXT`, `notified_admin_at TIMESTAMPTZ`, `reminder_48h_sent_at TIMESTAMPTZ`.
- Index sur `manual_departures(transporteur_id, departure_date)`.

**RPC `gp_publish_departure(p_ref, p_destination, p_date, p_kg, p_phone)`** SECURITY DEFINER, pas de login requis :
- Résout le transporteur via `reference`.
- INSERT dans `manual_departures` avec `created_via='gp_self'`.
- Trigger `_wa_send_via_function` pour notifier admin (+221784604003) et confirmer au GP depuis 122.
- Retourne `{ ok, departure_id, transporteur_name }`.

**Trigger `trg_manual_departure_gp_notify`** sur INSERT `manual_departures` : si `created_via='gp_self'` → enqueue admin notification + WhatsApp GP (déjà géré dans la RPC, donc le trigger n'est qu'un fallback).

**RPC `gp_get_context(p_ref)`** : retourne `{ prenom, telephone, destinations_servies }` pour pré-remplir la page publique.

**Backfill** : `UPDATE transporteurs SET depart_url = 'https://yobbante.com/gp/depart/' || reference WHERE depart_url IS NULL`.

## 2. Page publique GP (sans login)

`src/pages/gp/GpDepartPage.tsx` — route `/gp/depart/:ref`
- Mobile-first, dark + #F5C518.
- Appelle `gp_get_context(ref)` au mount pour récupérer prénom + téléphone.
- 4 champs : destination (Select villes catalogue), date (shadcn DatePicker, min=aujourd'hui), kilos (Input number), contact WhatsApp (Input pré-rempli).
- Bouton "Publier mon départ →" appelle `gp_publish_departure`.
- Écran de succès avec ref départ + bouton "Déclarer un autre départ".

Route ajoutée dans `src/App.tsx` hors layout app (public).

## 3. Edge functions

**`supabase/functions/gp-departure-reminders/`** (déclenché par cron) :
- Mode `weekly` (lundi 8h Dakar) : tous GP `is_active=true` sans départ dans 14 jours → WhatsApp depuis 122 (texte sans accents).
- Mode `48h` (toutes les heures) : départs dont `departure_date` ∈ [now+47h, now+49h] et `reminder_48h_sent_at IS NULL` → WhatsApp + marquer `reminder_48h_sent_at`.
- Mode `coverage_alert` (lundi 8h) : pour chaque destination active, si 0 départ dans 7 jours → admin notification.
- Param `?mode=weekly|48h|coverage` ou auto selon heure.

**`supabase/functions/parse-departure-message/`** : POST `{ text: "DEP Paris 15/06 25kg" }` → utilise Lovable AI (google/gemini-2.5-flash-lite) ou regex pour retourner `{ destination, date, kg }`.

## 4. Cron jobs (via `supabase--insert`, pas migration)

```sql
select cron.schedule(
  'gp-weekly-reminder',
  '0 8 * * 1', -- lundi 8h UTC = 8h Dakar (Dakar = UTC+0)
  $$ select net.http_post(url:='.../gp-departure-reminders?mode=weekly', ...); $$
);
select cron.schedule('gp-48h-reminder', '0 * * * *', $$...mode=48h...$$);
select cron.schedule('gp-coverage-alert', '0 8 * * 1', $$...mode=coverage...$$);
```

## 5. UI admin

**`src/pages/admin/DeparturesWeekPage.tsx`** — extension :
- Bouton "Importer depuis WhatsApp" → ouvre `WhatsAppImportDepartureDialog` : textarea + appel `parse-departure-message` + formulaire pré-rempli (transporteur, destination, date, kg) → INSERT.
- Section "Stock de départs" déjà présente : ajouter colonne capacité avec code couleur (vert >15kg, orange 5-15, rouge <5).
- Realtime : abonnement `postgres_changes` sur `manual_departures`.

**`src/pages/admin/RelaisPage.tsx` (ou page /admin/terrain équivalente)** : pour chaque transporteur, ajouter colonne "URL départ" avec :
- Lien copiable (icône Copy + toast).
- Bouton "Envoyer par WhatsApp" → `wa.me/{phone}?text=` avec message pré-rempli incluant l'URL.

## Contraintes techniques

- Page `/gp/depart/:ref` accessible sans auth (route publique, pas de guard).
- RPC `gp_publish_departure` doit être SECURITY DEFINER + GRANT EXECUTE TO anon.
- Tous textes WhatsApp sans accents (Salam, prevu, declarez, etc.).
- Africa/Dakar = UTC+0, donc `0 8 * * 1` UTC fonctionne directement.
- Realtime : `ALTER PUBLICATION supabase_realtime ADD TABLE public.manual_departures` (si pas déjà).
- Aucune migration ne touche aux schémas réservés (auth, storage…).

## Fichiers créés/modifiés

**Créés**
- `supabase/migrations/<timestamp>_gp_autonomous_departures.sql`
- `supabase/functions/gp-departure-reminders/index.ts`
- `supabase/functions/parse-departure-message/index.ts`
- `src/pages/gp/GpDepartPage.tsx`
- `src/components/admin/WhatsAppImportDepartureDialog.tsx`

**Modifiés**
- `src/App.tsx` (route `/gp/depart/:ref`)
- `src/pages/admin/DeparturesWeekPage.tsx` (bouton import + realtime + couleurs capacité)
- `src/pages/admin/RelaisPage.tsx` (ou équivalent terrain) — colonne URL + WhatsApp
- `src/integrations/supabase/types.ts` (auto via migration)

## Hors scope

- Refonte du dashboard admin existant.
- Notification SMS (uniquement WhatsApp).
- Gestion multi-langues (FR uniquement).
- Statistiques historiques GP.
