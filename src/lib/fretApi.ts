import { supabase } from '@/integrations/supabase/client';

export type FretStatus =
  | 'A_ENLEVER'
  | 'PENDING_ACCEPT'
  | 'REMIS_CHAUFFEUR'
  | 'EN_ROUTE'
  | 'ARRIVE'
  | 'LIVRE'
  | 'ANNULE';

export interface FretCourse {
  id: string;
  ref: string;
  destination: string;
  client_nom: string | null;
  client_phone?: string | null;
  colis_description: string | null;
  photo_url: string | null;
  status: FretStatus;
  remis_at: string | null;
  accepted_at: string | null;
  en_route_at: string | null;
  arrived_at: string | null;
  delivered_at: string | null;
}

export interface FretChauffeur {
  id: string;
  telephone: string;
  nom_complet: string | null;
  immatriculation: string | null;
  routes: string[] | null;
}

export const FRET_STATUS_LABEL: Record<FretStatus, string> = {
  A_ENLEVER: "En attente d'enlèvement",
  PENDING_ACCEPT: "En attente d'acceptation",
  REMIS_CHAUFFEUR: 'Remis au chauffeur',
  EN_ROUTE: 'En route',
  ARRIVE: 'Arrivé à destination',
  LIVRE: 'Livré au client',
  ANNULE: 'Annulé',
};

/** Libellé du seul bouton d'action proposé au chauffeur pour l'étape suivante. */
export const FRET_NEXT_ACTION: Partial<Record<FretStatus, string>> = {
  PENDING_ACCEPT: "J'accepte cette course",
  REMIS_CHAUFFEUR: 'Je suis en route',
  EN_ROUTE: 'Je suis arrivé',
};

export const FRET_TOKEN_KEY = 'yobbante:fret-chauffeur-token';

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('fret-chauffeur', { body });
  if (error) {
    // Les erreurs HTTP renvoient un corps JSON exploitable
    const ctx = (error as any)?.context;
    try {
      const j = await ctx?.json?.();
      if (j?.error) throw new Error(j.error);
    } catch (e) {
      if (e instanceof Error && e.message && e.message !== 'Failed to fetch') throw e;
    }
    throw new Error(error.message || 'network_error');
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

export const fretApi = {
  login: (phone: string, pin: string) =>
    call<{ token: string; chauffeur: FretChauffeur }>({ action: 'login', phone, pin }),
  me: (token: string) =>
    call<{ chauffeur: FretChauffeur; courses: FretCourse[] }>({ action: 'me', token }),
  advance: (token: string, course_id: string) =>
    call<{ ok: boolean; status: FretStatus }>({
      action: 'advance',
      token,
      course_id,
      origin: typeof window !== 'undefined' ? window.location.origin : undefined,
    }),
  byConfirmToken: (confirm_token: string) =>
    call<{ course: { ref: string; destination: string; client_nom: string | null; status: FretStatus } }>({
      action: 'course',
      confirm_token,
    }),
  confirmDelivery: (confirm_token: string) =>
    call<{ ok: boolean; status: FretStatus }>({ action: 'confirm', confirm_token }),
  track: (ref: string) =>
    call<{
      course: Omit<FretCourse, 'id' | 'client_nom' | 'colis_description' | 'photo_url'>;
      chauffeur: { nom_complet: string | null; immatriculation: string | null } | null;
    }>({ action: 'track', ref }),
};
