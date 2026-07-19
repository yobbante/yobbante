import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles, Send, CheckCircle2, ArrowRight, MapPin, Package, Shield, Zap,
  Truck, User2, Loader2, MessageCircle, LayoutDashboard,
} from 'lucide-react';
import { z } from 'zod';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
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

function RecapPill({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2">
      <div className="grid place-items-center w-7 h-7 rounded-lg bg-[#F5C518]/15 shrink-0">
        <Icon className="w-3.5 h-3.5 text-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <p className="text-xs font-semibold text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}

export function ManualQuoteDialog({ open, onOpenChange, prefill, defaultName, defaultPhone }: Props) {
  const navigate = useNavigate();
  const [name, setName] = useState(defaultName ?? '');
  const [phone, setPhone] = useState(defaultPhone ?? '');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [done, setDone] = useState<{ reference: string; trackingId: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setIsAuthed(!!data.user));
  }, [open]);

  const recap = useMemo(() => {
    const items: { icon: any; label: string; value: string }[] = [
      { icon: MapPin, label: 'Trajet', value: `${prefill.origin_city} → ${prefill.destination_city}` },
      { icon: Package, label: 'Poids', value: `${prefill.weight_kg} kg${prefill.parcel_count ? ` · ${prefill.parcel_count} colis` : ''}` },
    ];
    if (prefill.goods_type) items.push({ icon: Package, label: 'Marchandise', value: prefill.goods_type });
    if (prefill.transport_mode) items.push({ icon: Truck, label: 'Transport', value: prefill.transport_mode });
    if (prefill.priority) items.push({ icon: Zap, label: 'Urgence', value: prefill.priority });
    if (prefill.declared_value) items.push({ icon: Shield, label: 'Valeur', value: `${prefill.declared_value} ${prefill.declared_currency ?? ''}`.trim() });
    if (prefill.insurance) items.push({ icon: Shield, label: 'Assurance', value: prefill.insurance });
    if (prefill.recipient_name) items.push({ icon: User2, label: 'Destinataire', value: prefill.recipient_name });
    return items;
  }, [prefill]);

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

      const adminMsg =
        `Nouvelle demande devis : ${trackingId} ` +
        `${prefill.origin_city} -> ${prefill.destination_city} ` +
        `${prefill.weight_kg}kg\n` +
        `Client: ${parsed.data.client_name} ${clientPhone}` +
        (parsed.data.note ? `\nNote: ${parsed.data.note}` : '');
      supabase.functions.invoke('send-whatsapp', {
        body: { recipient_phone: ADMIN_PHONE, message: adminMsg, template: 'free_text' },
      }).catch((e) => console.error('WA admin error', e));

      try { localStorage.setItem('last_dossier_tracking_id', trackingId); } catch {}
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
      <DialogContent className="max-w-lg p-0 overflow-hidden rounded-2xl border-border/70">
        {done ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative"
          >
            <div className="bg-gradient-to-br from-[#25D366]/15 via-[#F5C518]/10 to-transparent px-6 pt-8 pb-6 text-center">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-[#25D366]/20 grid place-items-center shadow-sm">
                <CheckCircle2 className="w-8 h-8 text-[#25D366]" />
              </div>
              <h3 className="mt-4 text-xl font-semibold tracking-tight">Demande envoyée ✅</h3>
              <p className="mt-1.5 text-sm text-muted-foreground max-w-sm mx-auto">
                Notre équipe revient vers vous sous <strong className="text-foreground">2 h ouvrées</strong> sur WhatsApp au <strong className="text-foreground">{BOT_DISPLAY}</strong>.
              </p>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-background/80 backdrop-blur px-3 py-1.5 text-xs font-mono">
                Référence : <strong className="font-semibold">{done.reference}</strong>
              </div>
            </div>

            <div className="px-6 pb-6 pt-2 space-y-2.5">
              <Link
                to={`/suivre/${done.trackingId}`}
                onClick={reset}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-foreground text-background px-5 py-3 text-sm font-semibold hover:opacity-90 transition"
              >
                Suivre ma demande <ArrowRight className="w-4 h-4" />
              </Link>
              {isAuthed ? (
                <button
                  type="button"
                  onClick={() => { reset(); navigate('/app'); }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-5 py-2.5 text-sm font-semibold hover:bg-secondary transition"
                >
                  <LayoutDashboard className="w-4 h-4" /> Voir dans mon espace
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    try { sessionStorage.setItem('post_auth_redirect', `/suivre/${done.trackingId}`); } catch {}
                    reset();
                    navigate('/auth');
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-5 py-2.5 text-sm font-semibold hover:bg-secondary transition"
                >
                  Créer un compte pour être notifié
                </button>
              )}
              <a
                href={`https://wa.me/${BOT_DISPLAY.replace(/[^\d]/g, '')}?text=${encodeURIComponent(`Bonjour, je suis ${name}. Réf ${done.reference}.`)}`}
                target="_blank" rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition"
              >
                <MessageCircle className="w-4 h-4" /> Ouvrir WhatsApp maintenant
              </a>
            </div>
          </motion.div>
        ) : (
          <>
            <div className="relative bg-gradient-to-br from-[#F5C518]/25 via-[#F5C518]/10 to-transparent px-6 pt-6 pb-5">
              <div className="flex items-start gap-3">
                <div className="grid place-items-center w-11 h-11 rounded-2xl bg-foreground text-background shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Devis sur mesure</p>
                  <h2 className="text-lg font-semibold tracking-tight leading-tight">Un chargé de dossier vous répond sous 2 h</h2>
                  <p className="text-xs text-muted-foreground mt-1">Sans engagement · Réponse WhatsApp · Devis chiffré et validé humain</p>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 pt-4 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Mini récap */}
              <section className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Récapitulatif</p>
                <div className="grid grid-cols-2 gap-2">
                  {recap.map((it, i) => (
                    <RecapPill key={i} icon={it.icon} label={it.label} value={it.value} />
                  ))}
                </div>
              </section>

              {/* Coordonnées */}
              <section className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Vos coordonnées</p>
                <TextField label="Nom complet" value={name} onChange={setName} placeholder="Ex. Aïssatou Diop" />
                <TextField label="Téléphone / WhatsApp" value={phone} onChange={setPhone} placeholder="+221 77 000 00 00" type="tel" />
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Précisions (optionnel)
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="Contenu détaillé, contraintes, date souhaitée, budget…"
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-[#F5C518]/40 transition resize-none"
                  />
                </div>
              </section>

              <button
                type="button"
                disabled={submitting}
                onClick={submit}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-foreground text-background px-5 py-3.5 text-sm font-semibold shadow-sm hover:opacity-90 disabled:opacity-50 transition"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {submitting ? 'Envoi…' : 'Envoyer ma demande'}
              </button>
              <p className="text-[11px] text-muted-foreground text-center -mt-1">
                Réponse sous 2 h ouvrées · Aucun engagement · Aucune connexion requise
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
