// Server-side renderer for WhatsApp templates approved on Meta.
// Used by send-whatsapp to build a HUMAN-READABLE `message_body` to store
// alongside the template_name, so the dossier chat and admin UI never show
// the raw template id like "order_confirmation_v2" to the client/staff.
//
// Keep these messages aligned with the Meta-approved template bodies
// (visible spelling/wording only — variables are mapped 1:1 by index).

type Spec = {
  /** Ordered params expected from the caller — kept for docs only. */
  params: readonly string[];
  /** Renders the human text using the same ordered params. */
  render: (p: string[]) => string;
};

const ord = (p: string[], i: number, fallback = '') => (p[i] ?? '').trim() || fallback;

export const WA_TEMPLATE_RENDER: Record<string, Spec> = {
  // ----- Client -----
  order_confirmation_v2: {
    params: ['prenom', 'tracking_id', 'route', 'amount'],
    render: (p) =>
      `Bonjour ${ord(p, 0, 'cher client')} 👋\n\n` +
      `Votre commande Yobbanté est confirmée ✅\n` +
      `Référence : ${ord(p, 1)}\n` +
      `Itinéraire : ${ord(p, 2)}\n` +
      `Montant : ${ord(p, 3)}\n\n` +
      `Suivi : https://yobbante.com/suivre/${ord(p, 1)}`,
  },
  order_confirmation: {
    params: ['prenom', 'tracking_id', 'route', 'amount'],
    render: (p) =>
      `Bonjour ${ord(p, 0, 'cher client')}, votre commande ${ord(p, 1)} est confirmée. ` +
      `${ord(p, 2)} — ${ord(p, 3)}. Suivi : https://yobbante.com/suivre/${ord(p, 1)}`,
  },

  departure_assigned_v2: {
    params: ['prenom', 'tracking_id', 'departure_date', 'eta'],
    render: (p) =>
      `Bonjour ${ord(p, 0, 'cher client')} 👋\n\n` +
      `Bonne nouvelle : un départ a été assigné à votre colis ${ord(p, 1)}.\n` +
      `Date de départ : ${ord(p, 2)}\n` +
      `Arrivée estimée : ${ord(p, 3)}`,
  },
  departure_assigned: {
    params: ['prenom', 'tracking_id', 'departure_date', 'eta'],
    render: (p) =>
      `Bonjour ${ord(p, 0, 'cher client')}, votre colis ${ord(p, 1)} part le ${ord(p, 2)}. ETA ${ord(p, 3)}.`,
  },

  package_collected_v2: {
    params: ['prenom', 'tracking_id'],
    render: (p) =>
      `Bonjour ${ord(p, 0, 'cher client')} 👋\n\n` +
      `Votre colis ${ord(p, 1)} a bien été collecté ✅\n` +
      `Suivi : https://yobbante.com/suivre/${ord(p, 1)}`,
  },
  package_collected: {
    params: ['prenom', 'tracking_id'],
    render: (p) =>
      `Bonjour ${ord(p, 0, 'cher client')}, votre colis ${ord(p, 1)} a été collecté.`,
  },

  package_in_transit_v2: {
    params: ['prenom', 'tracking_id', 'eta'],
    render: (p) =>
      `Bonjour ${ord(p, 0, 'cher client')} 👋\n\n` +
      `Votre colis ${ord(p, 1)} est en transit ✈️\n` +
      `Arrivée estimée : ${ord(p, 2)}`,
  },
  package_in_transit: {
    params: ['prenom', 'tracking_id', 'eta'],
    render: (p) =>
      `Bonjour ${ord(p, 0, 'cher client')}, colis ${ord(p, 1)} en transit. ETA ${ord(p, 2)}.`,
  },

  package_arrived_v2: {
    params: ['prenom', 'tracking_id'],
    render: (p) =>
      `Bonjour ${ord(p, 0, 'cher client')} 👋\n\n` +
      `Votre colis ${ord(p, 1)} est arrivé au hub Dakar 📦\n` +
      `Notre équipe vous contacte pour la livraison.`,
  },
  package_arrived: {
    params: ['prenom', 'tracking_id'],
    render: (p) =>
      `Bonjour ${ord(p, 0, 'cher client')}, votre colis ${ord(p, 1)} est arrivé.`,
  },

  package_delivered_v2: {
    params: ['prenom', 'tracking_id'],
    render: (p) =>
      `Bonjour ${ord(p, 0, 'cher client')} 👋\n\n` +
      `Votre colis ${ord(p, 1)} a été livré ✅\n` +
      `Merci pour votre confiance Yobbanté !`,
  },
  package_delivered: {
    params: ['prenom', 'tracking_id'],
    render: (p) =>
      `Bonjour ${ord(p, 0, 'cher client')}, votre colis ${ord(p, 1)} a été livré. Merci !`,
  },

  weight_confirmation_v2: {
    params: ['prenom', 'tracking_id', 'weight', 'amount'],
    render: (p) =>
      `Bonjour ${ord(p, 0, 'cher client')} 👋\n\n` +
      `Votre colis ${ord(p, 1)} a été pesé : ${ord(p, 2)} kg.\n` +
      `Montant final : ${ord(p, 3)}\n\n` +
      `Lien de paiement reçu juste après.`,
  },
  weight_confirmation: {
    params: ['prenom', 'tracking_id', 'weight', 'amount'],
    render: (p) =>
      `Bonjour ${ord(p, 0, 'cher client')}, ${ord(p, 1)} pesé ${ord(p, 2)} kg — ${ord(p, 3)}.`,
  },

  payment_confirmation_v2: {
    params: ['prenom', 'tracking_id', 'amount'],
    render: (p) =>
      `Bonjour ${ord(p, 0, 'cher client')} 👋\n\n` +
      `Paiement reçu ✅ ${ord(p, 2)}\n` +
      `Référence : ${ord(p, 1)}\n\n` +
      `Merci pour votre confiance Yobbanté !`,
  },

  payment_reminder_48h_v2: {
    params: ['prenom', 'tracking_id', 'amount'],
    render: (p) =>
      `Bonjour ${ord(p, 0, 'cher client')} 👋\n\n` +
      `Rappel : le paiement de votre colis ${ord(p, 1)} (${ord(p, 2)}) est en attente depuis 48 h.\n` +
      `Régler maintenant pour éviter le retour à l'expéditeur.`,
  },
  payment_reminder_48h: {
    params: ['prenom', 'tracking_id', 'amount'],
    render: (p) =>
      `Bonjour ${ord(p, 0, 'cher client')}, rappel paiement ${ord(p, 1)} — ${ord(p, 2)}.`,
  },

  collection_instructions: {
    params: ['client_name', 'tracking_id', 'gp_name', 'gp_phone'],
    render: (p) =>
      `Bonjour ${ord(p, 0, 'cher client')} 👋\n\n` +
      `Instructions de collecte pour ${ord(p, 1)} :\n` +
      `Transporteur partenaire : ${ord(p, 2)}\n` +
      `Contact : ${ord(p, 3)}`,
  },

  payment_request: {
    params: ['client_name', 'tracking_id', 'amount', 'payment_link'],
    render: (p) =>
      `Bonjour ${ord(p, 0, 'cher client')} 👋\n\n` +
      `Votre colis ${ord(p, 1)} est prêt — montant : ${ord(p, 2)}.\n` +
      `Payer : ${ord(p, 3)}`,
  },

  _1537_client_reminder_48h_v3: {
    params: ['client_name', 'tracking_id'],
    render: (p) =>
      `Bonjour ${ord(p, 0, 'cher client')} 👋\n\n` +
      `Rappel : votre dossier ${ord(p, 1)} est en attente d'information. ` +
      `Répondez ici pour le faire avancer.`,
  },

  feedback_request_v3: {
    params: ['client_name', 'tracking_id', 'review_link'],
    render: (p) =>
      `Bonjour ${ord(p, 0, 'cher client')} 👋\n\n` +
      `Comment s'est passée votre expérience avec Yobbanté (colis ${ord(p, 1)}) ?\n` +
      `Laissez un avis : ${ord(p, 2)}`,
  },

  cash_on_delivery_confirmed: {
    params: ['client_name', 'tracking_id', 'amount'],
    render: (p) =>
      `Bonjour ${ord(p, 0, 'cher client')} 👋\n\n` +
      `Paiement à la livraison confirmé pour ${ord(p, 1)} (${ord(p, 2)}). Merci !`,
  },

  // ----- GP -----
  mission_assigned_gp_v2: {
    params: ['gp_prenom', 'tracking_id', 'client_name', 'route', 'weight'],
    render: (p) =>
      `Salam ${ord(p, 0, 'ami(e)')} 👋\n\n` +
      `Nouvelle mission : ${ord(p, 1)}\n` +
      `Client : ${ord(p, 2)}\n` +
      `Trajet : ${ord(p, 3)}\n` +
      `Poids : ${ord(p, 4)} kg\n\n` +
      `Répondez OUI pour accepter, NON pour refuser.`,
  },
  mission_assigned_gp: {
    params: ['gp_prenom', 'tracking_id', 'client_name', 'route', 'weight'],
    render: (p) =>
      `Salam ${ord(p, 0, 'ami(e)')}, mission ${ord(p, 1)} — ${ord(p, 2)} — ${ord(p, 3)} — ${ord(p, 4)} kg. OUI/NON ?`,
  },

  gp_mission_recap_j1_v2: {
    params: ['gp_prenom', 'missions_count', 'next_departure'],
    render: (p) =>
      `Salam ${ord(p, 0, 'ami(e)')} 👋\n\n` +
      `Récap J-1 : vous avez ${ord(p, 1)} mission(s) en cours.\n` +
      `Prochain départ : ${ord(p, 2)}`,
  },
  gp_mission_recap_j1: {
    params: ['gp_prenom', 'missions_count', 'next_departure'],
    render: (p) =>
      `Salam ${ord(p, 0, 'ami(e)')}, ${ord(p, 1)} mission(s). Prochain départ : ${ord(p, 2)}.`,
  },
};

/**
 * Render a template name into a human-readable WhatsApp message body.
 * Returns null if the template is unknown — caller should fall back to
 * a generic "Notification Yobbanté" message rather than the raw template id.
 */
export function renderTemplateBody(name: string | null | undefined, params: string[] = []): string | null {
  if (!name) return null;
  const spec = WA_TEMPLATE_RENDER[name];
  if (!spec) return null;
  try {
    return spec.render(params);
  } catch {
    return null;
  }
}

/**
 * Templates whose FIRST param is the GP first name. send-whatsapp uses this
 * list to force-resolve the prenom from `transporteurs` by recipient phone
 * and never let an empty / wrong prenom slip through.
 */
export const GP_PRENOM_TEMPLATES = new Set<string>([
  'mission_assigned_gp_v2',
  'mission_assigned_gp',
  'gp_mission_recap_j1_v2',
  'gp_mission_recap_j1',
]);
