import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Search, Phone, MessageCircle, X, MapPin, Package, User, Calendar,
  Send, Eye, DollarSign, Clock,
} from 'lucide-react';

/**
 * Devis sur mesure — écran admin responsive.
 * Source : table `dossiers` avec status = 'QUOTE_REQUESTED' (créés par ManualQuoteDialog).
 * Permet à l'admin de consulter, de contacter le client et d'envoyer un devis chiffré.
 */

type QuoteStatus = 'QUOTE_REQUESTED' | 'QUOTE_SENT' | 'QUOTE_ACCEPTED' | 'QUOTE_REFUSED' | 'CANCELLED';

const STATUS_LABEL: Record<string, string> = {
  QUOTE_REQUESTED: 'À traiter',
  QUOTE_SENT: 'Devis envoyé',
  QUOTE_ACCEPTED: 'Accepté',
  QUOTE_REFUSED: 'Refusé',
  CANCELLED: 'Annulé',
};
const STATUS_COLOR: Record<string, string> = {
  QUOTE_REQUESTED: 'bg-amber-100 text-amber-900 border-amber-200',
  QUOTE_SENT: 'bg-violet-100 text-violet-900 border-violet-200',
  QUOTE_ACCEPTED: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  QUOTE_REFUSED: 'bg-rose-100 text-rose-800 border-rose-200',
  CANCELLED: 'bg-zinc-100 text-zinc-700 border-zinc-200',
};

function fmtDate(d?: string | null) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return d; }
}

export function DevisSurMesureTab() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | QuoteStatus>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['dossiers-devis-sur-mesure'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dossiers')
        .select('*')
        .in('status', ['QUOTE_REQUESTED', 'QUOTE_SENT', 'QUOTE_ACCEPTED', 'QUOTE_REFUSED'])
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  const rows = useMemo(() => {
    const list = data ?? [];
    if (filter === 'all') return list;
    return list.filter((r: any) => (r.status ?? 'QUOTE_REQUESTED') === filter);
  }, [data, filter]);

  const openDossier = (data ?? []).find((r: any) => r.id === openId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Search className="w-5 h-5" /> Devis sur mesure
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Demandes de devis personnalisées reçues depuis le flow d'expédition (trajets sans départ instantané).
          </p>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-1.5">
        {(['all','QUOTE_REQUESTED','QUOTE_SENT','QUOTE_ACCEPTED','QUOTE_REFUSED'] as const).map(k => {
          const active = filter === k;
          const count = k === 'all' ? (data?.length ?? 0) : (data ?? []).filter((r: any) => (r.status ?? 'QUOTE_REQUESTED') === k).length;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                active ? 'bg-foreground text-background border-foreground' : 'bg-card border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {k === 'all' ? 'Tous' : STATUS_LABEL[k]}
              <span className="tabular-nums opacity-80">({count})</span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground p-4">Chargement…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Aucune demande pour ce filtre.
        </div>
      ) : (
        <>
          {/* Desktop: table */}
          <div className="hidden md:block rounded-2xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2.5">Réf.</th>
                  <th className="text-left px-4 py-2.5">Client</th>
                  <th className="text-left px-4 py-2.5">Trajet</th>
                  <th className="text-left px-4 py-2.5">Poids</th>
                  <th className="text-left px-4 py-2.5">Statut</th>
                  <th className="text-left px-4 py-2.5">Reçu</th>
                  <th className="text-right px-4 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => {
                  const status = (r.status ?? 'QUOTE_REQUESTED');
                  const phone = r.contact_phone || r.buyer_contact || r.sender_phone || '';
                  const name = r.buyer_name || r.sender_name || '—';
                  const waUrl = phone ? `https://wa.me/${phone.replace(/[^\d]/g, '')}` : '#';
                  return (
                    <tr key={r.id} className="border-t border-border align-top hover:bg-secondary/30">
                      <td className="px-4 py-3 font-mono text-[11px]">{r.reference}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold">{name}</p>
                        <p className="text-xs text-muted-foreground">{phone || '—'}</p>
                      </td>
                      <td className="px-4 py-3">{r.origin_city} → {r.destination_city}</td>
                      <td className="px-4 py-3 tabular-nums">{r.estimated_weight ?? '—'} kg</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLOR[status] ?? 'bg-zinc-100 border-zinc-200'}`}>
                          {STATUS_LABEL[status] ?? status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums whitespace-nowrap">{fmtDate(r.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {phone && (
                            <>
                              <a href={waUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-secondary">
                                <MessageCircle className="w-3 h-3" /> WA
                              </a>
                              <a href={`tel:${phone}`} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-secondary">
                                <Phone className="w-3 h-3" /> Appel
                              </a>
                            </>
                          )}
                          <button onClick={() => setOpenId(r.id)} className="inline-flex items-center gap-1 rounded-md bg-foreground text-background px-2.5 py-1 text-[11px] font-semibold hover:opacity-90">
                            <Eye className="w-3 h-3" /> Ouvrir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: cartes */}
          <div className="md:hidden space-y-2.5">
            {rows.map((r: any) => {
              const status = (r.status ?? 'QUOTE_REQUESTED');
              const phone = r.contact_phone || r.buyer_contact || r.sender_phone || '';
              const name = r.buyer_name || r.sender_name || '—';
              return (
                <button
                  key={r.id}
                  onClick={() => setOpenId(r.id)}
                  className="w-full text-left rounded-2xl border border-border bg-card p-3.5 space-y-2 hover:border-foreground/40 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{name}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{r.reference}</p>
                    </div>
                    <span className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLOR[status] ?? 'bg-zinc-100 border-zinc-200'}`}>
                      {STATUS_LABEL[status] ?? status}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">{r.origin_city} → {r.destination_city}</span>
                    <span>·</span>
                    <span className="tabular-nums">{r.estimated_weight ?? '—'} kg</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span>{fmtDate(r.created_at)}</span>
                    <span>{phone || '—'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Drawer détail */}
      {openDossier && (
        <QuoteDetailDrawer
          dossier={openDossier}
          onClose={() => setOpenId(null)}
          onUpdated={() => qc.invalidateQueries({ queryKey: ['dossiers-devis-sur-mesure'] })}
        />
      )}
    </div>
  );
}

// ─── Drawer détail + envoi devis ─────────────────────────────────────────
function QuoteDetailDrawer({ dossier, onClose, onUpdated }: { dossier: any; onClose: () => void; onUpdated: () => void }) {
  const [amount, setAmount] = useState<string>(dossier.quote_amount_xof?.toString() ?? '');
  const [validUntil, setValidUntil] = useState<string>(dossier.quote_valid_until ?? '');
  const [adminNotes, setAdminNotes] = useState<string>(dossier.quote_notes_admin ?? '');
  const [saving, setSaving] = useState(false);

  const phone = dossier.contact_phone || dossier.buyer_contact || dossier.sender_phone || '';
  const name = dossier.buyer_name || dossier.sender_name || 'Client';
  const trackingId = dossier.tracking_id || dossier.reference;

  async function sendQuote() {
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error('Montant invalide'); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.from('dossiers').update({
        quote_amount_xof: amt,
        quote_currency: 'XOF',
        quote_valid_until: validUntil || null,
        quote_notes_admin: adminNotes || null,
        quote_sent_at: new Date().toISOString(),
        status: 'QUOTE_SENT',
      } as any).eq('id', dossier.id).select('id').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Mise à jour refusée : vérifiez votre rôle administrateur');

      // WhatsApp client
      if (phone) {
        const prenom = name.split(' ')[0];
        const validity = validUntil ? `\nValide jusqu'au ${new Date(validUntil).toLocaleDateString('fr-FR')}` : '';
        const msg =
          `Bonjour ${prenom},\n` +
          `Votre devis Yobbanté est prêt !\n\n` +
          `Trajet : ${dossier.origin_city} → ${dossier.destination_city}\n` +
          `Poids : ${dossier.estimated_weight ?? '—'} kg\n` +
          `Montant : ${new Intl.NumberFormat('fr-FR').format(amt)} FCFA${validity}\n\n` +
          `Consulter et accepter :\nyobbante.com/suivre/${trackingId}`;
        supabase.functions.invoke('send-whatsapp', {
          body: { recipient_phone: phone, message: msg, template: 'free_text' },
        }).catch((e) => console.error('WA client', e));
      }

      toast.success('Devis envoyé au client');
      onUpdated();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? 'Erreur lors de l\'envoi');
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(status: QuoteStatus) {
    try {
      const { data, error } = await supabase.from('dossiers').update({ status } as any).eq('id', dossier.id).select('id').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Mise à jour refusée : vérifiez votre rôle administrateur');
      toast.success('Statut mis à jour');
      onUpdated();
    } catch (e: any) { toast.error(e?.message ?? 'Erreur'); }
  }

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative ml-auto h-full w-full max-w-xl overflow-y-auto bg-background shadow-2xl">
        <div className="sticky top-0 z-10 bg-background border-b border-border px-5 py-4 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Devis sur mesure</p>
            <p className="font-semibold truncate">{dossier.reference}</p>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="rounded-full p-1.5 hover:bg-secondary"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Client */}
          <section className="rounded-xl border border-border bg-card p-4 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5"><User className="w-3 h-3" /> Client</p>
            <p className="font-semibold">{name}</p>
            <p className="text-sm text-muted-foreground">{phone || '—'}</p>
            {phone && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                <a href={`https://wa.me/${phone.replace(/[^\d]/g, '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full bg-[#25D366] text-white px-3 py-1 text-xs font-semibold">
                  <MessageCircle className="w-3 h-3" /> WhatsApp
                </a>
                <a href={`tel:${phone}`} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-semibold">
                  <Phone className="w-3 h-3" /> Appeler
                </a>
              </div>
            )}
          </section>

          {/* Colis */}
          <section className="rounded-xl border border-border bg-card p-4 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5"><Package className="w-3 h-3" /> Colis & trajet</p>
            <p className="text-sm"><MapPin className="w-3 h-3 inline mr-1" /> {dossier.origin_city} → {dossier.destination_city}</p>
            <p className="text-sm">Poids : <strong className="tabular-nums">{dossier.estimated_weight ?? '—'} kg</strong></p>
            {dossier.product_description && (
              <p className="text-sm text-muted-foreground">{dossier.product_description}</p>
            )}
            {dossier.notes && (
              <details className="mt-2">
                <summary className="text-xs font-medium cursor-pointer text-muted-foreground">Voir toutes les précisions</summary>
                <pre className="mt-2 text-[11px] whitespace-pre-wrap bg-secondary/50 rounded p-2 text-foreground/80">{dossier.notes}</pre>
              </details>
            )}
          </section>

          {/* Formulaire devis */}
          <section className="rounded-xl border-2 border-[#F5C518] bg-[rgba(245,197,24,0.05)] p-4 space-y-3">
            <p className="text-sm font-semibold flex items-center gap-1.5"><DollarSign className="w-4 h-4" /> Chiffrer et envoyer le devis</p>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Montant (FCFA)</label>
              <input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="ex : 145 000"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/15"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-1.5">
                <Calendar className="w-3 h-3" /> Validité
              </label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/15"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Notes (internes)</label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/15 resize-none"
              />
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={sendQuote}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-foreground text-background px-5 py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition"
            >
              <Send className="w-4 h-4" />
              {saving ? 'Envoi…' : dossier.quote_sent_at ? 'Renvoyer le devis' : 'Envoyer le devis au client'}
            </button>

            {dossier.quote_sent_at && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> Envoyé le {fmtDate(dossier.quote_sent_at)}
              </p>
            )}
          </section>

          {/* Actions statut */}
          <section className="rounded-xl border border-border bg-card p-4 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Statut</p>
            <div className="flex flex-wrap gap-1.5">
              {(['QUOTE_REQUESTED','QUOTE_SENT','QUOTE_ACCEPTED','QUOTE_REFUSED','CANCELLED'] as QuoteStatus[]).map(s => (
                <button key={s} onClick={() => updateStatus(s)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    (dossier.status ?? 'QUOTE_REQUESTED') === s
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-background border-border hover:border-foreground/40'
                  }`}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
