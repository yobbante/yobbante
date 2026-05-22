## Réorganisation Dashboard Admin — Plan d'exécution

L'ampleur du chantier (12+ pages fusionnées, nouveau dashboard, page Dossiers unifiée avec vue liste/kanban/hover-card, nouvelle page Revenus, 11 redirections) ne tient pas en une seule passe sans risque. Je propose 4 phases incrémentales, chacune livrable et testable.

### Architecture cible

```text
🏠 Vue globale        → /admin               (refonte Overview)
📦 Dossiers           → /admin/dossiers      (NEW — 4 onglets)
─ OPÉRATIONS ─
🚚 Départs            → /admin/departs       (NEW — 3 onglets)
👥 Équipe terrain     → /admin/terrain       (NEW — 3 onglets)
─ CONTACTS ─
👤 Clients            → /admin/clients       (existant)
💬 Messages           → /admin/messages      (existant)
📋 Leads & devis      → /admin/leads         (NEW — 2 onglets)
─ FINANCES ─
💰 Revenus            → /admin/revenus       (NEW)
💳 Paiements GP       → /admin/finances      (existant)
─ SYSTÈME ─
🛒 Boutique Dëkk      → /admin/boutique      (existant)
🌐 Hubs               → /admin/hubs          (+ Konnekt en sous-onglet)
⚙️ Paramètres         → /admin/settings      (existant)
```

### Phase 1 — Sidebar + redirections (livrable seul)

- Réécrire `AdminSidebar.tsx` avec les 6 sections groupées (icônes, labels, ordre exacts du brief).
- Ajouter table `LEGACY_REDIRECTS` dans `AdminPage.tsx` qui mappe les anciens slugs (`inbox`, `shipments`, `orders`, `reception`, `transporteurs`, `livreurs`, `gp-operations`, `transport`, `departures`, `manual-quotes`, `enterprise`) vers les nouveaux paths + querystring (`?tab=...`), via `<Navigate replace>` côté React Router (équivalent 301 client).
- Les **anciennes pages restent fonctionnelles** sous leurs nouveaux paths — c'est de la tuyauterie, zéro perte de fonctionnalité.
- Mobile : drawer hamburger existant, juste mis à jour avec les 6 sections.

À la fin de la phase 1 : nouvelle sidebar visible, toutes les URLs anciennes redirigent, tout marche comme avant.

### Phase 2 — Pages onglets fusionnés (Dossiers v1, Départs, Terrain, Leads)

Chacune est un wrapper léger `<Tabs>` qui réutilise les composants `*Tab.tsx` existants — pas de refonte interne, juste un regroupement visuel.

- **`/admin/dossiers`** — `[Tous] [Expédier] [Réception] [Sourcing]` : vue "Tous" = nouveau composant `AllDossiersTab` (table simple sur `dossiers` toutes catégories) ; les 3 autres réutilisent `RequestsTab`, `ReceptionKanbanTab`, `SourcingTab`. **L'Inbox** devient un 5e onglet `[Demandes entrantes]` (réutilise `InboxTab`).
- **`/admin/departs`** — `[Vue semaine] [Liste] [Publication]` : réutilise `DeparturesWeekPage` (semaine), `DeparturesTab` (liste), `KonnektMonitorTab` (publication/monitoring).
- **`/admin/terrain`** — `[Transporteurs GP] [Livreurs Dakar] [Opérations du jour]` : réutilise `TransporteursTab`, `LivreursTab`, `GpOperationsTab`.
- **`/admin/leads`** — `[Particuliers] [Entreprises B2B]` : réutilise `ManualQuotesTab`, `EnterpriseQuotesTab`.

L'URL synchronise l'onglet via `?tab=...` (déjà le pattern dans `InboxTab`).

À la fin de la phase 2 : les 6 sections sont navigables, structure cible en place.

### Phase 3 — Page Revenus (nouvelle)

- `/admin/revenus` avec 4 sections (KPIs, paiements reçus, paiements en attente, export CSV).
- Source : table `dossiers` (`payment_status`, `final_amount_xof`, `paid_at`, `payment_method`, `payment_provider_ref`, `invoice_url`) — toutes les colonnes existent déjà.
- KPIs : agrégats SQL via `supabase.from('dossiers').select(...)` côté client.
- Bouton "Marquer payé" → update `payment_status = 'paid'`.
- Bouton "Relancer client" → invoke `send-whatsapp` avec template de relance.
- Export CSV : génération côté client (papaparse déjà dans le bundle, sinon `Blob` natif).

### Phase 4 — Vue globale redesignée + Dossiers v2 (avancé)

Les éléments les plus complexes, livrés en dernier :

- **Overview redesigné** : bandeau alertes urgentes (4 conditions SQL), 4 KPIs, 2 colonnes "À traiter" / "Départs du jour", feed activité (`dossier_events`).
- **Dossiers v2** : actions inline (dropdown statut, dropdown GP), filtres pills, recherche full-text, hover-card mini-timeline, toggle vue Kanban avec drag-drop (`@dnd-kit/core` déjà installé pour la boutique je vérifierai).

### Hors scope (à confirmer si on les ajoute)

- Le drag-drop Kanban sur Dossiers — si pas de lib dispo, je propose un changement de colonne via dropdown au lieu d'installer une nouvelle dépendance.
- Réécriture des composants existants (`RequestsTab`, etc.) : on les garde tels quels, ils sont juste remontés sous les nouveaux onglets.

### Question avant de démarrer

Plutôt que de tout livrer d'un coup (risque élevé de casser des flux opérationnels en prod), **je commence par la Phase 1 + Phase 2** dans ce tour (sidebar + 4 pages onglets + redirections), puis tu valides en navigant avant que j'enchaîne Phase 3 et 4. OK pour toi ?
