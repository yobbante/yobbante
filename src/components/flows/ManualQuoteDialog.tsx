import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { normalizePhone } from '@/lib/phone';

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

function RecapPill({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-background/60 px-3 py-2.5 min-w-0">
      <div className="grid place-items-center w-7 h-7 rounded-lg bg-secondary shrink-0">
        <Icon className="w-3.5 h-3.5 text-foreground" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground truncate">{label}</p>
        <p className="text-[13px] font-medium text-foreground truncate leading-tight">{value}</p>
      </div>
    </div>
  );
}

export function ManualQuoteDialog({ open, onOpenChange, prefill, defaultName, defaultPhone }: Props) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [done, setDone] = useState<{ reference: string; trackingId: string } | null>(null);

  // Sync prefill defaults every time the dialog opens
  useEffect(() => {
    if (!open) return;
    setName((prev) => prev || defaultName || prefill.sender_name || prefill.recipient_name || '');
    setPhone((prev) => prev || defaultPhone || prefill.sender_phone || prefill.recipient_phone || '');
    supabase.auth.getUser().then(({ data }) => {
      setIsAuthed(!!data.user);
      // Prefer authenticated user profile for name if empty
      const meta: any = data.user?.user_metadata ?? {};
      const fullName = meta.full_name || meta.name;
      if (fullName) setName((p) => p || String(fullName));
      const userPhone = data.user?.phone;
      if (userPhone) setPhone((p) => p || (userPhone.startsWith('+') ? userPhone : `+${userPhone}`));
    });
  }, [open, defaultName, defaultPhone, prefill.sender_name, prefill.sender_phone, prefill.recipient_name, prefill.recipient_phone]);

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
        source: 'site_web',
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
      toast.success('Demande envoyée');

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
    setName('');
    setPhone('');
    setNote('');
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); else onOpenChange(v); }}>
      <DialogContent className="max-w-lg p-0 overflow-hidden rounded-3xl border border-border/70 bg-background">
        <AnimatePresence mode="wait" initial={false}>
          {done ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <div className="px-7 pt-9 pb-6 text-center border-b border-border/50">
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.05, type: 'spring', stiffness: 220, damping: 18 }}
                  className="mx-auto w-14 h-14 rounded-full bg-secondary grid place-items-center"
                >
                  <CheckCircle2 className="w-7 h-7 text-foreground" strokeWidth={1.75} />
                </motion.div>
                <h3 className="mt-5 text-[22px] font-semibold tracking-tight leading-tight">Demande envoyée</h3>
                <p className="mt-2 text-[13px] text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  Notre équipe revient vers vous sous <span className="text-foreground font-medium">2 h ouvrées</span> sur WhatsApp au <span className="text-foreground font-medium">{BOT_DISPLAY}</span>.
                </p>
                <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-border/70 bg-secondary px-3.5 py-1.5 text-[12px] font-mono">
                  <span className="text-muted-foreground">Réf.</span>
                  <span className="font-semibold">{done.reference}</span>
                </div>
              </div>

              <div className="px-7 py-6 space-y-2">
                <Link
                  to={`/suivre/${done.trackingId}`}
                  onClick={reset}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-foreground text-background px-5 py-3 text-[13px] font-semibold hover:opacity-90 transition-opacity"
                >
                  Suivre ma demande <ArrowRight className="w-4 h-4" strokeWidth={2} />
                </Link>
                {isAuthed ? (
                  <button
                    type="button"
                    onClick={() => { reset(); navigate('/app'); }}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-5 py-2.5 text-[13px] font-medium hover:bg-secondary transition-colors"
                  >
                    <LayoutDashboard className="w-4 h-4" strokeWidth={1.75} /> Voir dans mon espace
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      try { sessionStorage.setItem('post_auth_redirect', `/suivre/${done.trackingId}`); } catch {}
                      reset();
                      navigate('/auth');
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-5 py-2.5 text-[13px] font-medium hover:bg-secondary transition-colors"
                  >
                    Créer un compte pour être notifié
                  </button>
                )}
                <a
                  href={`https://wa.me/${BOT_DISPLAY.replace(/[^\d]/g, '')}?text=${encodeURIComponent(`Bonjour, je suis ${name}. Réf ${done.reference}.`)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <MessageCircle className="w-4 h-4" strokeWidth={1.75} /> Ouvrir WhatsApp
                </a>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="px-7 pt-7 pb-5 border-b border-border/50">
                <div className="flex items-start gap-3.5">
                  <div className="grid place-items-center w-11 h-11 rounded-2xl bg-foreground text-background shrink-0">
                    <Sparkles className="w-5 h-5" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Devis sur mesure</p>
                    <h2 className="text-[19px] font-semibold tracking-tight leading-snug mt-1">Un chargé de dossier vous répond sous 2 h</h2>
                    <p className="text-[12.5px] text-muted-foreground mt-1.5 leading-relaxed">Sans engagement · Réponse WhatsApp · Devis validé par un humain</p>
                  </div>
                </div>
              </div>

              <div className="px-7 pb-6 pt-5 space-y-6 max-h-[70vh] overflow-y-auto">
                <section className="space-y-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Récapitulatif</p>
                  <div className="grid grid-cols-2 gap-2">
                    {recap.map((it, i) => (
                      <RecapPill key={i} icon={it.icon} label={it.label} value={it.value} />
                    ))}
                  </div>
                </section>

                <section className="space-y-3">
                  <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Vos coordonnées</p>
                  <TextField label="Nom complet" value={name} onChange={setName} placeholder="Ex. Aïssatou Diop" />
                  <TextField label="Téléphone / WhatsApp" value={phone} onChange={setPhone} placeholder="+221 77 000 00 00" type="tel" />
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      Précisions (optionnel)
                    </label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      maxLength={500}
                      placeholder="Contenu détaillé, contraintes, date souhaitée, budget…"
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-[13px] placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground/30 transition resize-none"
                    />
                  </div>
                </section>

                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={submit}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-foreground text-background px-5 py-3.5 text-[13px] font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" strokeWidth={2} />}
                    {submitting ? 'Envoi…' : 'Envoyer ma demande'}
                  </button>
                  <p className="text-[11px] text-muted-foreground text-center">
                    Réponse sous 2 h ouvrées · Aucun engagement
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
