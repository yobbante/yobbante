# Profil GP complet — navettes avec escales

## Stratégie de migration douce

La table `transporteurs` a déjà des colonnes qui recoupent partiellement le brief. Pour éviter les doublons et casser l'existant, on **réutilise et on étend** plutôt que de tout dupliquer.

| Champ brief            | Colonne existante              | Décision                                   |
|------------------------|--------------------------------|--------------------------------------------|
| `adresse_dakar_1`      | `adresse_collecte_dakar` (text) | Réutiliser, renommer logiquement côté UI   |
| `adresse_dakar_2`      | — *(neuf)*                     | Ajouter `adresse_dakar_2 text`             |
| `zone_dakar`           | `zone` (text)                  | Réutiliser sous le nom UI « zone Dakar »   |
| `creneau_dakar`        | — *(neuf)*                     | Ajouter `creneau_dakar text[]`             |
| `navettes`             | `adresses_remise` (jsonb)      | Migrer ancien format → nouveau `navettes jsonb`, garder `adresses_remise` pour rétro-compat lecture seule |
| `default_rate_per_kg`  | `default_rate_per_kg` (num)    | Déjà présent                              |
| `rates_per_city`       | `default_routes` (jsonb)       | Réutiliser `default_routes` (clé = ville)  |
| `profile_complete`     | — *(neuf)*                     | Colonne **generated** en lecture seule     |

Tous les nouveaux champs sont nullable (sauf la generated). Les transporteurs existants restent fonctionnels.

## Format JSON `navettes`

```json
[
  {
    "id": "nav_1",
    "villes": [
      { "ville": "Paris",      "adresse": "12 rue de la Paix",  "creneau": "Mar/Ven 9h-17h" },
      { "ville": "Lyon",       "adresse": "",                    "creneau": "" },
      { "ville": "Marseille",  "adresse": "",                    "creneau": "" }
    ]
  }
]
```

`Dakar` est implicite (départ). Une « escale » = un objet `villes[i]`. Plusieurs navettes possibles (ex. un GP fait Paris-Lyon et un autre voyage New York direct).

## Découpage en livrables

### Lot 1 — Migration DB (1 migration)
- Ajouter colonnes `adresse_dakar_2`, `creneau_dakar text[]`, `navettes jsonb default '[]'`
- Colonne générée `profile_complete bool` calculée sur `telephone_1 + adresse_collecte_dakar + zone + jsonb_array_length(navettes) > 0`
- Backfill : pour chaque ligne où `adresses_remise` n'est pas vide, créer une navette unique avec une escale par clé ville. `default_routes` reste tel quel (= `rates_per_city`).
- Helper SQL `transporteur_serves_city(uuid, text) returns boolean` pour le filtrage dossier.

### Lot 2 — Formulaire admin (`TransporteursTab` + nouveau dialog)
Refonte du dialog d'édition en 6 sections :
1. **Identité** — référence auto (4 chiffres, modifiable), prénom*, nom*, photo (optionnel, upload bucket `transporteur-photos`)
2. **Contact** — `telephone_1*`, `telephone_2`, validation regex international
3. **Adresses Dakar** — `adresse_dakar_1*` (= `adresse_collecte_dakar`), `adresse_dakar_2`, `zone_dakar*` (dropdown des 16 quartiers du brief), `creneau_dakar` (4 cases à cocher)
4. **Navettes** — composant `NavettesEditor` : liste de navettes, chaque navette = chips d'escales avec dropdown villes (groupées Europe / Amérique / Afrique / Asie-ME / Autre input libre), champ adresse + créneau optionnels par escale, boutons `+ escale` / `supprimer navette` / `+ ajouter navette`
5. **Tarification** — `default_rate_per_kg`, et un tarif par ville unique extraite des navettes (édition de `default_routes`)
6. **Notes internes** — `notes` (existant, libellé staff)

Bouton « Enregistrer » → upsert + log événement `transporteur_events`.

### Lot 3 — Affichage liste transporteurs
- Colonne « Navettes » : badges des 3 premières villes uniques tirées de `navettes`, puis `+N autres` (tooltip avec la liste complète)
- Colonne « Profil » : `profile_complete` → ✅ vert / ⚠️ orange + bouton « Compléter » qui ouvre le dialog d'édition pré-rempli
- Filtre rapide « Profils incomplets » au-dessus du tableau

### Lot 4 — Onboarding bot 122 (`gp-bot`)
Nouvel intent `onboarding` déclenché par `START` ou premier message d'un numéro inconnu :
1. prénom → 2. nom → 3. adresse Dakar → 4. quartier (menu numéroté 1-6) → 5. liste villes desservies (split sur `,`) → 6. boucle adresses par ville (`SKIP` accepté) → fin.
Session stockée dans `gp_bot_sessions.pending_data` avec étape courante. À la fin : UPSERT `transporteurs` (génération référence si absente), notification admin via `_wa_send_via_function` au `+221784604003`, message de confirmation.

### Lot 5 — Commande PROFIL du bot
Ajouter handlers dans `gp-bot` :
- `PROFIL` → affiche prénom, nom, tel, adresse Dakar, zone, liste navettes
- `MODIFIER ADRESSE` → demande nouvelle adresse → UPDATE + génère un `edit_token` (24h) avec lien `/modifier/{token}` pour sécurité supplémentaire
- `MODIFIER NAVETTE` → demande liste villes → reset `navettes` à une seule navette avec ces villes (pas d'adresses → bot demande dans foulée)
- `MODIFIER TEL` → demande nouveau numéro → UPDATE `telephone_1`

### Lot 6 — Sélecteur GP dans dossier
Modifier `TransporteurReferenceLookup` (déjà utilisé dans `AdminDossierSheet > Transport`) :
- Liste déroulante optionnelle « parcourir les GP » filtrée automatiquement sur `destination_country` du dossier en cours via la helper SQL `transporteur_serves_city`
- Chaque item : photo, nom, zone Dakar, badges navettes, adresse Dakar
- Saisie 4-chiffres conservée comme raccourci

### Lot 7 — Badges « Profil incomplet » + relance WhatsApp
- Sur la liste transporteurs et dans le dialog dossier, si `profile_complete = false` afficher badge orange + bouton « Compléter le profil ».
- Bouton admin « Envoyer rappel WhatsApp » → génère un `edit_token` pour le transporteur, envoie via `_wa_send_via_function` le message du brief avec le lien `yobbante.com/modifier/{token}`. La page `/modifier/:token` existe déjà (`apply_edit_token`).

## Risques / questions

1. **Suppression de `adresses_remise`** ? → **Non** dans cette PR : on garde pour rétro-compat, juste un commentaire SQL « deprecated, utiliser navettes ». Cleanup ultérieur.
2. **Photo de profil** : bucket nouveau `transporteur-photos` (public) + colonne `photo_url text`.
3. **Onboarding bot conflit ?** Le bot actuel a peut-être un flow d'inscription. Je l'inspecte au Lot 4 et je remplace plutôt que dupliquer.
4. **Quartiers Dakar** : 16 valeurs en dur dans une constante TS partagée `src/lib/dakarZones.ts`, le bot mappe le menu 1-6 vers le bon groupe.
5. **Tarifs par navette** : le brief liste « Dakar → ville » donc on garde la clé = ville unique (pas par navette). Si un GP a 2 navettes passant par Paris, un seul tarif Paris.

## Livraison

Je propose de livrer en 2 PR pour rester gérable :

- **PR-A** : Lots 1 + 2 + 3 + 6 (DB + admin UI + sélecteur dossier). C'est le cœur visible immédiatement.
- **PR-B** : Lots 4 + 5 + 7 (bot onboarding/profil + relance WhatsApp). Touche les edge functions et la campagne.

Réponds **OK PR-A** pour démarrer, ou indique des ajustements (ex. tout en une fois, photo non, autres quartiers, etc.).