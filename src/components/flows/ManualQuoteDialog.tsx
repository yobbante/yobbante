import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildQuoteRequestUrl } from '@/lib/quoteRequest';

interface Prefill {
  origin_country?: string | null;
  origin_city: string;
  destination_country?: string | null;
  destination_city: string;
  weight_kg: number;
  transport_mode?: string | null;
  priority?: string | null;
  sender_name?: string | null;
  sender_phone?: string | null;
  sender_address?: string | null;
  recipient_name?: string | null;
  recipient_phone?: string | null;
  recipient_address?: string | null;
  description?: string | null;
  declared_value?: number | string | null;
  declared_currency?: string | null;
  parcel_count?: number | null;
  goods_type?: string | null;
  insurance?: string | null;
  pickup_date?: string | null;
  pickup_slot?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prefill: Prefill;
  defaultName?: string;
  defaultPhone?: string;
  /** Origine de la demande, pour le suivi admin. */
  source?: string;
}

/**
 * Point de convergence unique : toute demande de devis du site redirige
 * désormais vers le formulaire /demande-devis, pré-rempli avec le contexte
 * du parcours (trajet, poids, mode, description, coordonnées).
 */
export function ManualQuoteDialog({ open, onOpenChange, prefill, defaultName, defaultPhone, source }: Props) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    onOpenChange(false);
    navigate(
      buildQuoteRequestUrl({
        originCity: prefill.origin_city,
        destinationCity: prefill.destination_city,
        weightKg: prefill.weight_kg,
        transportMode: prefill.transport_mode,
        parcelCount: prefill.parcel_count,
        description: [
          prefill.description,
          prefill.goods_type ? `Type : ${prefill.goods_type}` : null,
          prefill.priority === 'express' ? 'Envoi express souhaité' : null,
        ].filter(Boolean).join(' · ') || null,
        clientName: defaultName || prefill.sender_name || prefill.recipient_name || null,
        clientPhone: defaultPhone || prefill.sender_phone || prefill.recipient_phone || null,
        source: source ?? 'send_flow',
      }),
    );
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
