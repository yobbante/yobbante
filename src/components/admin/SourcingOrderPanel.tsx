import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ExternalLink, Loader2, Package, Save, ShoppingCart, Truck, CheckCircle2, Wallet, Send,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  CURRENCIES, RELAY_CURRENCY, RELAY_LABEL, computeSourcingTotals, fetchFxMarkupPercent,
  fmtXof, SOURCING_QUOTE_DISCLAIMER,
} from '@/lib/sourcingPricing';

type Item = {
  id: string;
  dossier_id: string;
  site: string;
  relay_country: string;
  url: string;
  qty: number;
  note: string | null;
  price_amount: number | null;
  price_currency: string | null;
  weight_kg: number | null;
  confirmed: boolean;
  reception_order_id: string | null;
};

type DossierLite = {
  id: string;
  reference: string;
  tracking_id?: string | null;
  user_id?: string | null;
  status: string;
  payment_status?: string | null;
  contact_phone?: string | null;
  final_amount_xof?: number | null;
};

/**
 * Panneau admin « Sourcing / Relais D » — Parties 3 à 6 du parcours :
 * confirmation des prix réels + poids majoré, total unique tout compris,
 * devis WhatsApp, paiement, achat réel par site, création automatique des
 * entrées Réception (module existant) et suivi des colis reçus.
 */
export function SourcingOrderPanel({ dossier }: { dossier: DossierLite }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const { data: markup = 8 } = useQuery({
    queryKey: ['fx-markup'],
    queryFn: fetchFxMarkupPercent,
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['sourcing-items', dossier.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sourcing_items')
        .select('*')
        .eq('dossier_id', dossier.id)
        .order('created_at');
      if (error) throw error;
      return (data || []) as Item[];
    },
  });

  const { data: receptions = [] } = useQuery({
    queryKey: ['sourcing-receptions', dossier.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reception_orders')
        .select('id, reference, merchant_name, status, relay_address_id, order_reference')
        .eq('sourcing_dossier_id', dossier.id);
      if (error) throw error;
      return data || [];
    },
  });

  const [draft, setDraft] = useState<Record<string, Partial<Item>>>({});
  const merged = useMemo(
    () => items.map(i => ({ ...i, ...(draft[i.id] || {}) })),
    [items, draft],
  );

  const totals = useMemo(() => computeSourcingTotals(merged, markup), [merged, markup]);

  const groups = useMemo(() => {
    const map = new Map<string, Item[]>();
    merged.forEach(i => map.set(i.site, [...(map.get(i.site) ?? []), i]));
    return [...map.entries()];
  }, [merged]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['sourcing-items', dossier.id] });
    qc.invalidateQueries({ queryKey: ['sourcing-receptions', dossier.id] });
  };

  async function saveItem(item: Item) {
    setBusy(item.id);
    try {
      const { error } = await supabase
        .from('sourcing_items')
        .update({
          price_amount: item.price_amount,
          price_currency: item.price_currency || RELAY_CURRENCY[item.relay_country] || 'EUR',
          weight_kg: item.weight_kg,
          confirmed: item.price_amount != null && (item.weight_kg ?? 0) > 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);
      if (error) throw error;
      setDraft(d => { const n = { ...d }; delete n[item.id]; return n; });
      refresh();
      toast.success('Article confirmé');
    } catch (e: any) {
      toast.error(e?.message ?? 'Échec de l\'enregistrement');
    } finally { setBusy(null); }
  }

  async function saveQuote() {
    if (!totals.allPriced || !totals.allWeighed) {
      toast.error('Confirmez le prix ET le poids estimé (majoré) de chaque article');
      return;
    }
    setBusy('quote');
    try {
      const { error } = await supabase
        .from('dossiers')
        .update({
          final_amount_xof: totals.totalXof,
          quote_amount_xof: totals.totalXof,
          estimated_cost: totals.totalXof,
          status: 'QUOTE_SENT',
        })
        .eq('id', dossier.id);
      if (error) throw error;
      refresh();
      qc.invalidateQueries({ queryKey: ['admin-sourcing-dossiers'] });
      toast.success('Devis enregistré — total unique tout compris');
    } catch (e: any) {
      toast.error(e?.message ?? 'Échec');
    } finally { setBusy(null); }
  }

  function sendWhatsApp() {
    const ref = dossier.tracking_id || dossier.reference;
    const msg = [
      `*Yobbanté — Votre commande ${ref}*`,
      '',
      ...groups.map(([site, list]) => `• ${site} : ${list.length} article(s)`),
      '',
      `*Total tout compris : ${fmtXof(totals.totalXof)}*`,
      '(produits + acheminement jusqu\'à Dakar)',
      '',
      SOURCING_QUOTE_DISCLAIMER,
      '',
      'Un seul paiement, avant achat. Aucun complément ne vous sera demandé.',
    ].join('\n');
    const phone = (dossier.contact_phone || '').replace(/\D/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  async function markPaid() {
    setBusy('paid');
    try {
      const { error } = await supabase
        .from('dossiers')
        .update({ payment_status: 'paid', status: 'SOURCING' })
        .eq('id', dossier.id);
      if (error) throw error;
      supabase.functions.invoke('relais-d-notify', {
        body: {
          kind: 'shop',
          reference: dossier.tracking_id || dossier.reference,
          dossier_id: dossier.id,
          summary: `Commande sourcing payée — ${fmtXof(totals.totalXof)} — à acheter (${groups.length} site(s)).`,
        },
      }).catch(() => {});
      refresh();
      qc.invalidateQueries({ queryKey: ['admin-sourcing-dossiers'] });
      toast.success('Paiement enregistré — statut « Achat en cours »');
    } catch (e: any) {
      toast.error(e?.message ?? 'Échec');
    } finally { setBusy(null); }
  }

  /** Un site acheté = un colis attendu = une entrée Réception (module existant). */
  async function createReception(site: string, list: Item[], orderNumber: string) {
    if (!orderNumber.trim()) { toast.error('Saisissez le n° de commande du marchand'); return; }
    setBusy(`recep-${site}`);
    try {
      const relay = list[0].relay_country;
      const { data: addr, error: addrErr } = await supabase
        .from('relay_addresses')
        .select('id')
        .eq('country_code', relay)
        .limit(1)
        .maybeSingle();
      if (addrErr) throw addrErr;
      if (!addr) throw new Error(`Aucune adresse relais configurée pour ${relay}`);

      const weight = list.reduce((s, i) => s + (Number(i.weight_kg) || 0) * (i.qty || 1), 0);
      const { data: created, error } = await supabase
        .from('reception_orders')
        .insert({
          user_id: dossier.user_id,
          sourcing_dossier_id: dossier.id,
          relay_address_id: addr.id,
          merchant_name: site,
          merchant_url: list[0].url,
          order_reference: orderNumber.trim(),
          order_description: `Sourcing ${dossier.tracking_id || dossier.reference} — ${list.length} article(s) ${site}`,
          expected_packages: 1,
          estimated_weight_kg: weight || null,
          status: 'pending_arrival',
          internal_note: list.map(i => `${i.url} ×${i.qty}${i.note ? ` (${i.note})` : ''}`).join('\n'),
        })
        .select('id')
        .single();
      if (error) throw error;

      await supabase
        .from('sourcing_items')
        .update({ reception_order_id: created.id })
        .in('id', list.map(i => i.id));

      refresh();
      toast.success(`Colis ${site} créé au ${RELAY_LABEL[relay]}`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Échec de la création du colis');
    } finally { setBusy(null); }
  }

  if (isLoading) return <Skeleton className="h-40 rounded-xl" />;
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-center">
        <ShoppingCart className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Aucun article panier sur ce dossier.</p>
      </div>
    );
  }

  const receivedCount = receptions.filter(r =>
    ['received', 'inspected', 'consolidated', 'in_transit', 'delivered'].includes(r.status)).length;

  return (
    <div className="space-y-5">
      {/* Articles */}
      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Articles à chiffrer · taux de change majoré {markup}%
        </p>
        {merged.map(item => (
          <div key={item.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{item.site} · ×{item.qty}</p>
                <a href={item.url} target="_blank" rel="noreferrer"
                   className="text-[11px] text-primary inline-flex items-center gap-1 truncate max-w-[240px]">
                  <ExternalLink className="w-3 h-3" /> {item.url}
                </a>
                {item.note && <p className="text-[11px] text-muted-foreground mt-0.5">Note : {item.note}</p>}
              </div>
              {item.confirmed && <CheckCircle2 className="w-4 h-4 text-success shrink-0" />}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-[10px]">Prix réel</Label>
                <Input
                  type="number" inputMode="decimal" value={item.price_amount ?? ''}
                  onChange={e => setDraft(d => ({ ...d, [item.id]: { ...d[item.id], price_amount: e.target.value === '' ? null : Number(e.target.value) } }))}
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-[10px]">Devise</Label>
                <Select
                  value={item.price_currency || RELAY_CURRENCY[item.relay_country] || 'EUR'}
                  onValueChange={v => setDraft(d => ({ ...d, [item.id]: { ...d[item.id], price_currency: v } }))}
                >
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px]">Poids majoré (kg)</Label>
                <Input
                  type="number" inputMode="decimal" value={item.weight_kg ?? ''}
                  onChange={e => setDraft(d => ({ ...d, [item.id]: { ...d[item.id], weight_kg: e.target.value === '' ? null : Number(e.target.value) } }))}
                  className="h-8"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">{RELAY_LABEL[item.relay_country]}</p>
              <Button size="sm" variant="outline" className="h-7 text-xs"
                      disabled={busy === item.id}
                      onClick={() => saveItem(item as Item)}>
                {busy === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                Confirmer
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="rounded-xl border border-border bg-secondary p-4 space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Produits (taux majoré {markup}%)</span><span>{fmtXof(totals.productsXof)}</span>
        </div>
        {totals.perRelay.map(r => (
          <div key={r.relay} className="flex justify-between text-xs text-muted-foreground">
            <span>Acheminement {r.relay} · {r.weightKg} kg</span><span>{fmtXof(r.shippingXof)}</span>
          </div>
        ))}
        <div className="flex justify-between text-sm font-bold text-foreground pt-1.5 border-t border-border">
          <span>Total unique tout compris</span><span>{fmtXof(totals.totalXof)}</span>
        </div>
        <p className="text-[10px] text-muted-foreground pt-1">{SOURCING_QUOTE_DISCLAIMER}</p>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button size="sm" onClick={saveQuote} disabled={busy === 'quote'}>
            {busy === 'quote' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wallet className="w-3.5 h-3.5 mr-1" />}
            Enregistrer le devis
          </Button>
          <Button size="sm" variant="outline" onClick={sendWhatsApp} disabled={!dossier.contact_phone}>
            <Send className="w-3.5 h-3.5 mr-1" /> Envoyer WhatsApp
          </Button>
          <Button size="sm" variant="outline" onClick={markPaid} disabled={busy === 'paid' || dossier.payment_status === 'paid'}>
            {busy === 'paid' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
            {dossier.payment_status === 'paid' ? 'Payé' : 'Marquer payé'}
          </Button>
        </div>
      </div>

      {/* Achat réel par site → Réception */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Achat par site → Réception ({receivedCount}/{receptions.length || groups.length} colis reçus)
        </p>
        {groups.map(([site, list]) => {
          const recep = receptions.find(r => r.merchant_name === site);
          return (
            <SiteRow
              key={site}
              site={site}
              relay={list[0].relay_country}
              count={list.length}
              reception={recep}
              busy={busy === `recep-${site}`}
              onCreate={n => createReception(site, list, n)}
            />
          );
        })}
      </div>
    </div>
  );
}

function SiteRow({
  site, relay, count, reception, busy, onCreate,
}: {
  site: string; relay: string; count: number;
  reception?: { id: string; reference: string; status: string; order_reference: string | null };
  busy: boolean; onCreate: (orderNumber: string) => void;
}) {
  const [value, setValue] = useState('');
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" /> {site} · {count} article(s) → 1 colis
          </p>
          <p className="text-[11px] text-muted-foreground">{RELAY_LABEL[relay]}</p>
        </div>
        {reception && (
          <span className="text-[11px] font-mono text-muted-foreground shrink-0">
            {reception.reference} · {reception.status}
          </span>
        )}
      </div>
      {!reception && (
        <div className="flex gap-2 mt-2">
          <Input
            value={value} onChange={e => setValue(e.target.value)}
            placeholder="N° de commande / tracking marchand" className="h-8 text-xs"
          />
          <Button size="sm" className="h-8 text-xs shrink-0" disabled={busy} onClick={() => onCreate(value)}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5 mr-1" />}
            Créer le colis
          </Button>
        </div>
      )}
    </div>
  );
}
