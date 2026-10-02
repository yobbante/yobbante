# Bandeau d’information et récupération des demandes

## Objectif
Informer avec transparence sans fragiliser la confiance, et donner aux personnes concernées une action immédiate pour reprendre leur demande.

## Mise en œuvre
- Ajouter un bandeau discret sur toutes les pages publiques Yobbanté, visible du 2 octobre au 1er novembre 2026 inclus.
- Employer un message factuel et rassurant : certaines demandes envoyées entre le 10 septembre et le 1er octobre peuvent ne pas avoir été reçues, le service est rétabli, et les clients concernés sont invités à renvoyer leur demande.
- Prévoir un bouton « Renvoyer ma demande » ouvrant WhatsApp avec un message déjà rédigé, ainsi qu’un accès à la demande de devis en ligne.
- Permettre de réduire le bandeau sans le masquer définitivement, afin que l’information reste accessible pendant la période prévue.
- Ne pas afficher le bandeau dans les espaces internes admin, partenaires, GP ou chauffeur, ni sur le sous-domaine Dëkk.
- Vérifier l’affichage mobile et ordinateur, les liens, l’absence de chevauchement avec le menu et le bon arrêt automatique après un mois.

## Récupération des clients perdus
- Exploiter les contacts déjà connus dans les demandes et conversations existantes pour identifier les personnes ayant eu une activité autour de la période concernée.
- Ne pas envoyer de communication massive automatiquement sans liste fiable : préparer d’abord un ciblage des demandes potentiellement incomplètes ou sans réponse, puis proposer une relance WhatsApp personnalisée depuis les outils existants.

## Détails techniques
- Composant global autonome, dates d’affichage codées explicitement en UTC pour éviter les décalages.
- Réutilisation du numéro WhatsApp client officiel et du générateur de lien existant.
- Aucun changement des données métiers ni des parcours de commande.
