import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Send, CheckCircle2, ArrowRight } from 'lucide-react';
import { z } from 'zod';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { TextField } from './FlowPrimitives';
import { supabase } from '@/integrations/supabase/client';

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
}

const ADMIN_PHONE = '+221784604003';
const BOT_DISPLAY = '+221 78 607 80 80';

const Schema = z.object({
  client_name: z.string().trim().min(2, 'Nom requis').max(120),
  client_phone: z.string().trim().regex(/^\+?[0-9 .()-]{7,20}$/, 'Téléphone invalide'),
  note: z.string().trim().max(500).optional().or(z.literal('')),
});

function normalizePhone(input: string): string {
  let v = input.replace(/[\s().\-_]/g, '');
  if (!v) return '';
  if (v.startsWith('+')) return v;
  if (v.startsWith('00221')) return '+' + v.slice(2);
  if (v.startsWith('00') && v.length > 5) return '+' + v.slice(2);
  if (v.startsWith('221') && v.length >= 11) return '+' + v;
  const d = v.replace(/\D/g, '');
  if (d.length === 9 && (d.startsWith('7') || d.startsWith('3'))) return '+221' + d;
  if (d.length === 10 && d.startsWith('0')) return '+221' + d.slice(1);
  return d ? '+' + d : v;
}

export function ManualQuoteDialog({ open, onOpenChange, prefill, defaultName, defaultPhone }: Props) {
  const [name, setName] = useState(defaultName ?? '');
  const [phone, setPhone] = useState(defaultPhone ?? '');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ reference: string; trackingId: string } | null>(null);

  async function submit() {
    const parsed = Schema.safeParse({ client_name: name, client_phone: phone, note });
    if (!parsed.success) {
      toast.error(Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? 'Champs invalides');
      return;
    }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const clientPhone = normalizePhone(parsed.data.client_phone);
      const desc = prefill.description?.trim() || 'Demande de devis personnalisé';

      const notesParts = [
        `[DEVIS SUR MESURE]`,
        `Trajet: ${prefill.origin_city} → ${prefill.destination_city}`,
        `Poids: ${prefill.weight_kg} kg`,
        prefill.parcel_count ? `Colis: ${prefill.parcel_count}` : '',
        prefill.goods_type ? `Type marchandise: ${prefill.goods_type}` : '',
        prefill.transport_mode ? `Transport: ${prefill.transport_mode}` : '',
        prefill.priority ? `Priorité: ${prefill.priority}` : '',
        prefill.declared_value ? `Valeur déclarée: ${prefill.declared_value} ${prefill.declared_currency ?? ''}` : '',
        prefill.insurance ? `Assurance: ${prefill.insurance}` : '',
        prefill.pickup_date ? `Collecte souhaitée: ${prefill.pickup_date}${prefill.pickup_slot ? ` (${prefill.pickup_slot})` : ''}` : '',
        parsed.data.note ? `Note client: ${parsed.data.note}` : '',
      ].filter(Boolean).join('\n');

      const insertPayload: Record<string, any> = {
        user_id: user?.id ?? null,
        status: 'QUOTE_REQUESTED',
        product_description: desc,
        estimated_weight: prefill.weight_kg,
        origin_country: prefill.origin_country ?? 'SN',
        destination_country: prefill.destination_country ?? 'SN',
        origin_city: prefill.origin_city,
        destination_city: prefill.destination_city,
        app_source: 'expedier_devis_sur_mesure',
        source: 'devis_sur_mesure',
        needs_sourcing: false,
        contact_phone: clientPhone,
        sender_name: prefill.sender_name || parsed.data.client_name,
        sender_phone: prefill.sender_phone ? normalizePhone(prefill.sender_phone) : clientPhone,
        sender_address: prefill.sender_address || null,
        recipient_name: prefill.recipient_name || null,
        recipient_phone: prefill.recipient_phone ? normalizePhone(prefill.recipient_phone) : null,
        recipient_address: prefill.recipient_address || null,
        pickup_date: prefill.pickup_date || null,
        buyer_name: parsed.data.client_name,
        buyer_contact: clientPhone,
        notes: notesParts,
      };

      const { data: dossier, error } = await supabase
        .from('dossiers')
        .insert(insertPayload as any)
        .select('id,reference,tracking_id')
        .single();

      if (error) throw error;

      const ref: string = dossier.reference;
      const trackingId: string = (dossier as any).tracking_id || ref;

      setDone({ reference: ref, trackingId });
      toast.success('Demande envoyée 🚀');

      // Notification WhatsApp client
      const prenom = parsed.data.client_name.split(' ')[0];
      const clientMsg =
        `Bonjour ${prenom},\n` +
        `Votre demande de devis Yobbante est bien recue !\n\n` +
        `Reference : ${ref}\n` +
        `Trajet : ${prefill.origin_city} -> ${prefill.destination_city}\n` +
        `Poids : ${prefill.weight_kg} kg\n\n` +
        `Notre equipe vous repond sous 2 h ouvrees sur WhatsApp au ${BOT_DISPLAY}.\n\n` +
        `Suivez votre demande :\nyobbante.com/suivre/${trackingId}`;
      supabase.functions.invoke('send-whatsapp', {
        body: { recipient_phone: clientPhone, message: clientMsg, template: 'free_text' },
      }).catch((e) => console.error('WA client error', e));

      // Notification admin
      const adminMsg =
        `Nouvelle demande devis : ${trackingId} ` +
        `${prefill.origin_city} -> ${prefill.destination_city} ` +
        `${prefill.weight_kg}kg\n` +
        `Client: ${parsed.data.client_name} ${clientPhone}` +
        (parsed.data.note ? `\nNote: ${parsed.data.note}` : '');
      supabase.functions.invoke('send-whatsapp', {
        body: { recipient_phone: ADMIN_PHONE, message: adminMsg, template: 'free_text' },
      }).catch((e) => console.error('WA admin error', e));
    } catch (e: any) {
      console.error('Quote submit error', e);
      toast.error(e?.message ?? "Erreur lors de l'envoi");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setDone(null);
    setName(defaultName ?? '');
    setPhone(defaultPhone ?? '');
    setNote('');
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); else onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        {done ? (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="py-4 text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-[#25D366]/15 grid place-items-center">
              <CheckCircle2 className="w-7 h-7 text-[#25D366]" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold tracking-tight">Demande envoyée ✅</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Votre demande de devis a bien été transmise.<br />
                Notre équipe vous répond sous <strong>2 h ouvrées</strong> sur WhatsApp au <strong>{BOT_DISPLAY}</strong>.
              </p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-mono">
                Référence : <strong className="font-semibold">{done.reference}</strong>
              </div>
            </div>
            <Link
              to={`/suivre/${done.trackingId}`}
              onClick={reset}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition"
            >
              Suivre ma demande <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Search className="w-4 h-4" /> Demander un devis personnalisé
              </DialogTitle>
              <DialogDescription>
                {prefill.origin_city} → {prefill.destination_city} · {prefill.weight_kg} kg
                {prefill.transport_mode ? ` · ${prefill.transport_mode}` : ''}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <TextField label="Nom complet" value={name} onChange={setName} placeholder="Ex. Aïssatou Diop" />
              <TextField label="Téléphone / WhatsApp" value={phone} onChange={setPhone} placeholder="+221 77 000 00 00" type="tel" />
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Note (optionnel)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Précisions sur le contenu, l'urgence, etc."
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/15 transition resize-none"
                />
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={submit}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-foreground text-background px-5 py-3 text-sm font-semibold shadow-sm hover:opacity-90 disabled:opacity-50 transition"
              >
                <Send className="w-4 h-4" />
                {submitting ? 'Envoi…' : 'Envoyer ma demande'}
              </button>
              <p className="text-[11px] text-muted-foreground text-center">
                Réponse sous 2 h ouvrées · Aucun engagement · Aucune connexion requise
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
