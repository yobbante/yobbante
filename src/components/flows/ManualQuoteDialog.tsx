import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Send, CheckCircle2 } from 'lucide-react';
import { z } from 'zod';
import { toast } from 'sonner';
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
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prefill: Prefill;
  defaultName?: string;
  defaultPhone?: string;
}

const Schema = z.object({
  client_name: z.string().trim().min(2, 'Nom requis').max(120),
  client_phone: z.string().trim().regex(/^\+?[0-9 .()-]{7,20}$/, 'Téléphone invalide'),
  note: z.string().trim().max(500).optional().or(z.literal('')),
});

export function ManualQuoteDialog({ open, onOpenChange, prefill, defaultName, defaultPhone }: Props) {
  const [name, setName] = useState(defaultName ?? '');
  const [phone, setPhone] = useState(defaultPhone ?? '');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    const parsed = Schema.safeParse({ client_name: name, client_phone: phone, note });
    if (!parsed.success) {
      toast.error(Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? 'Champs invalides');
      return;
    }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('manual_quote_requests').insert({
        user_id: user?.id ?? null,
        origin_country: prefill.origin_country ?? null,
        origin_city: prefill.origin_city,
        destination_country: prefill.destination_country ?? null,
        destination_city: prefill.destination_city,
        weight_kg: prefill.weight_kg,
        transport_mode: prefill.transport_mode ?? null,
        priority: prefill.priority ?? null,
        client_name: parsed.data.client_name,
        client_phone: parsed.data.client_phone,
        note: parsed.data.note || null,
      });
      if (error) throw error;
      setDone(true);
      toast.success('Demande envoyée 🚀');
    } catch (e: any) {
      toast.error(e?.message ?? 'Erreur lors de l\'envoi');
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setDone(false);
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
            <div className="space-y-1.5">
              <h3 className="text-lg font-semibold tracking-tight">Demande reçue</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Notre équipe vous contacte sous <strong>2 h ouvrées</strong> sur WhatsApp au {phone}.
              </p>
            </div>
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center justify-center rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition"
            >
              Fermer
            </button>
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
                Réponse sous 2 h ouvrées · Aucun engagement
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
