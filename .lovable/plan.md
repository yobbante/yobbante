ns## Objectif
Traiter les 5 fuites de conversion identifiées dans le funnel `/expedier` → paiement → suivi.

## F1 — Step 3 · Destination (ÉLEVÉ)
**Symptôme** : si la ville n'est pas dans les 36 standards, l'utilisateur bloque (aucun fallback exposé).
**Fix** :
- Dans `CityPicker.tsx` / le sélecteur Step 3 de `SendFlow`, fusionner `worldCities` (36) + `custom_cities` (via `useCustomCities`) dans la même liste.
- Ajouter un état "Aucun résultat → demander un devis manuel" avec un CTA qui pré-remplit `ManualQuoteDialog` avec la saisie libre.
- Autoriser saisie libre stockée dans preset (`destination_city_freeform`) si aucune option ne correspond, en fallback pour ne jamais bloquer.

## F2 — Step 4 · Destinataire (MOYEN)
**Symptôme** : format téléphone international non validé côté UI (silencieux, warn console seulement).
**Fix** :
- Utiliser `normalizePhone` + `isValidPhone` (`src/lib/phone.ts`) sur les champs "téléphone destinataire" et "téléphone expéditeur" dans `SendFlow` Step 4.
- Message d'erreur inline sous le champ (`aria-live`) : "Numéro international requis (ex: +33 6 12 34 56 78)".
- Bouton "Suivant" reste actif mais toast d'avertissement doux si numéro invalide (ne bloque pas l'admin, warn le client).
- Auto-préfixer `+221` si l'utilisateur tape 9 chiffres commençant par 7/3.

## F3 — Step 8 · Assurance (MOYEN)
**Symptôme** : jamais pré-sélectionnée, pas de rappel bénéfice → skip mécanique.
**Fix** :
- Pré-sélectionner "Standard" par défaut si `declared_value > 50 000 XOF` ou `content_type` sensible (electronics, docs).
- Ajouter un micro-rappel bénéfice sous l'option ("Remboursé jusqu'à X XOF en cas de perte").
- Bandeau discret si l'utilisateur désélectionne : "Sans assurance, aucun remboursement possible."

## F4 — Step 9 · Paiement · WhatsApp OK (CRITIQUE)
**Symptôme** : après clic "Payer", aucun accusé visible → clients paient puis paniquent, appellent le support.
**Fix** :
- Dans `SendConfirmation.tsx` (ou juste avant la redirection PayTech), afficher un écran intermédiaire "Confirmation envoyée" avec :
  - ✅ "Reçu WhatsApp envoyé au +221 XX XX XX XX"
  - ✅ "Numéro de suivi : YOB-XXXXX"
  - CTA "Continuer vers le paiement" (redirection PayTech au clic, pas auto).
- Envoyer un message WhatsApp `send-whatsapp` immédiatement (avant redirection PayTech) avec le tracking_id + lien /suivre + lien /pay.
- Persister le tracking_id en `localStorage` (`last_dossier_tracking_id`) pour récupération si PayTech échoue.

## F5 — Post-paiement `/pay` (CRITIQUE — C2)
**Symptôme** : la page `/pay/:tracking_id` bloque la confirmation (webhook PayTech tardif, UI en attente infinie).
**Fix** :
- Sur `PayPage.tsx`, si `?success=1` dans l'URL : afficher immédiatement un état "Paiement reçu, mise à jour en cours" (optimiste) sans attendre le webhook.
- Poll `dossiers.payment_status` toutes les 2s pendant 30s max, puis passer en état "Nous confirmons votre paiement — vous recevrez un WhatsApp sous 2 min" (rassurant, non bloquant).
- Bouton "Ouvrir mon suivi" toujours actif → `/suivre/:tracking_id`.
- Si `?cancel=1` : CTA "Réessayer le paiement" qui rappelle `paytech-payment`.

## F6 — Suivi `/track` (MOYEN)
**Symptôme** : M1+M4 partiellement traités, mais lookup fragile si l'utilisateur tape avec `#` ou espaces.
**Fix** :
- `normalizeTrackingId` déjà en place → étendre pour retirer préfixes `YOB-`, `#`, espaces, casse.
- Sur `/suivre/:id`, si non trouvé, proposer un fallback : "Recherche par numéro WhatsApp" (input tel qui appelle une edge function `find-dossier-by-phone`).

## Fichiers touchés
- `src/components/flows/SendFlow.tsx` (Step 3/4/8 UX + validation tel)
- `src/components/flows/send/SendConfirmation.tsx` (écran d'accusé WhatsApp avant PayTech)
- `src/components/quote/CityPicker.tsx` (fusion custom_cities + fallback)
- `src/pages/PayPage.tsx` (état optimiste + polling)
- `src/lib/trackingId.ts` (normalisation étendue)
- `supabase/functions/send-whatsapp/index.ts` (accusé pré-paiement — vérifier template)

## Ordre d'exécution
1. F4 + F5 (critiques : impact revenu direct)
2. F1 (élevé : blocage flow)
3. F2, F3, F6 (moyens : polish)
