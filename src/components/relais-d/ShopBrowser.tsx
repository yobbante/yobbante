import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ShoppingCart, ExternalLink, Plus, Trash2, X, Globe, Send, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useDossiers } from '@/hooks/useDossiers';
import { toast } from 'sonner';

/**
 * Relais D — Chemin "Commander en ligne".
 * Grille de 10 sites → navigateur immersif (iframe) → panier flottant.
 * Le panier est envoyé à Yobbanté : l'admin constate le prix réel,
 * applique le taux de change majoré + un poids estimé majoré, puis envoie
 * un devis unique tout compris (aucun complément demandé après paiement).
 */

/** relay = pays de l'adresse relais Yobbanté utilisée pour ce marchand. */
const SITES = [
  { id: 'amazon',     name: 'Amazon',     url: 'https://www.amazon.fr',      accent: '#FF9900', relay: 'FR' },
  { id: 'zara',       name: 'Zara',       url: 'https://www.zara.com',       accent: '#1A1A1A', relay: 'FR' },
  { id: 'shein',      name: 'Shein',      url: 'https://www.shein.com',      accent: '#000000', relay: 'CN' },
  { id: 'nike',       name: 'Nike',       url: 'https://www.nike.com',       accent: '#111111', relay: 'US' },
  { id: 'alibaba',    name: 'Alibaba',    url: 'https://www.alibaba.com',    accent: '#FF6A00', relay: 'CN' },
  { id: 'aliexpress', name: 'AliExpress', url: 'https://www.aliexpress.com', accent: '#E62E04', relay: 'CN' },
  { id: 'temu',       name: 'Temu',       url: 'https://www.temu.com',       accent: '#FB7701', relay: 'CN' },
  { id: 'ebay',       name: 'eBay',       url: 'https://www.ebay.com',       accent: '#0064D2', relay: 'US' },
  { id: 'decathlon',  name: 'Decathlon',  url: 'https://www.decathlon.fr',   accent: '#0082C3', relay: 'FR' },
  { id: 'hm',         name: 'H&M',        url: 'https://www2.hm.com/fr_fr',  accent: '#E50010', relay: 'FR' },
] as const;

const RELAY_LABEL: Record<string, string> = {
  FR: 'Relais Yobbanté France',
  US: 'Relais Yobbanté USA',
  CN: 'Relais Yobbanté Chine (Guangzhou)',
};

type Site = (typeof SITES)[number];
type CartItem = { site: string; relay: string; url: string; qty: number; note: string };

export function ShopBrowser({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const { createDossier } = useDossiers();
  const [site, setSite] = useState<Site | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [sending, setSending] = useState(false);

  // Regroupement par site : un panier Amazon avec 3 articles = 1 colis attendu.
  const groups = useMemo(() => {
    const map = new Map<string, CartItem[]>();
    cart.forEach(i => map.set(i.site, [...(map.get(i.site) ?? []), i]));
    return [...map.entries()];
  }, [cart]);

  function addItem(item: Omit<CartItem, 'site' | 'relay'>) {
    if (!site) return;
    if (cart.some(c => c.url === item.url)) {
      toast.message('Ce lien est déjà dans votre commande');
      return;
    }
    setCart(c => [...c, { site: site.name, relay: site.relay, ...item }]);
    setAddOpen(false);
    toast.success('Article ajouté à votre commande');
  }

  async function sendCart(info: { budget: string; address: string; phone: string }) {
    if (cart.length === 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.message('Connectez-vous pour envoyer votre commande — elle reste enregistrée.');
      navigate(`/auth?redirect=${encodeURIComponent('/relais-d/shop')}`);
      return;
    }
    setSending(true);
    try {
      const lines: string[] = [
        'RELAIS D — COMMANDER EN LIGNE',
        `Budget maximum client : ${info.budget ? `${info.budget} FCFA` : 'non précisé'}`,
        `Livraison finale (Dakar) : ${info.address || 'à préciser'}`,
        `Téléphone client : ${info.phone || 'à préciser'}`,
        '',
        'ARTICLES REGROUPÉS PAR SITE (1 site = 1 colis attendu) :',
      ];
      groups.forEach(([siteName, items]) => {
        lines.push(`• ${siteName} → ${RELAY_LABEL[items[0].relay]}`);
        items.forEach((it, i) => {
          lines.push(`   ${i + 1}. ${it.url}`);
          lines.push(`      Quantité: ${it.qty}${it.note ? ` · Variante/note: ${it.note}` : ''}`);
        });
      });
      lines.push(
        '',
        'ACTION ADMIN :',
        '1. Ouvrir chaque lien, saisir le prix réel constaté (devise d\'origine).',
        '2. Saisir un POIDS ESTIMÉ MAJORÉ (arrondi vers le haut, obligatoire) par article.',
        '3. Conversion FCFA au taux de change majoré + acheminement (grille Aérien/GP du pays du site).',
        '4. Un seul total tout compris, aucun complément après paiement.',
        '5. Après paiement → « Achat en cours », puis saisir le n° de commande/tracking par site pour créer l\'entrée de réception Relais D (adresse relais assignée automatiquement).',
      );

      const dossier = await createDossier.mutateAsync({
        product_description: `Relais D — Commander en ligne · ${cart.length} article(s) · ${groups.map(([s]) => s).join(', ')}`,
        origin_country: ((cart[0]?.relay as string) || 'FR') as any,
        destination_country: 'SN',
        needs_sourcing: true,
        contact_phone: info.phone || null,
        recipient_address: info.address || null,
        budget_eur: info.budget ? Number(info.budget) : null,
        notes: lines.join('\n'),
        app_source: 'relais_d_shop',
      });

      supabase.functions.invoke('relais-d-notify', {
        body: {
          kind: 'shop',
          reference: (dossier as any)?.reference ?? '',
          dossier_id: (dossier as any)?.id ?? null,
          summary: `${cart.length} article(s) · ${groups.map(([s]) => s).join(', ')}`,
        },
      }).catch(() => {});

      toast.success('Commande envoyée — devis tout compris sous 24h 🛒');
      setCart([]);
      setCartOpen(false);
      setCheckout(false);
      onBack();
    } catch (e: any) {
      toast.error(e?.message ?? 'Erreur lors de l\'envoi');
    } finally {
      setSending(false);
    }
  }

  const overlays = (
    <>
      <FloatingCart count={cart.length} onOpen={() => setCartOpen(true)} />
      <CartDrawer
        open={cartOpen} onClose={() => setCartOpen(false)} groups={groups} count={cart.length}
        onRemove={url => setCart(c => c.filter(i => i.url !== url))}
        onQty={(url, qty) => setCart(c => c.map(i => (i.url === url ? { ...i, qty } : i)))}
        onCheckout={() => { setCartOpen(false); setCheckout(true); }}
      />
      <CheckoutDialog open={checkout} onClose={() => setCheckout(false)} sending={sending} onSubmit={sendCart} />
    </>
  );

  // ── Navigateur immersif
  if (site) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-zinc-900">
          <button onClick={() => setSite(null)} className="p-2 rounded-lg hover:bg-white/10 transition-colors" aria-label="Retour aux sites">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 flex items-center gap-2 min-w-0 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
            <Globe className="w-3.5 h-3.5 text-white/50 shrink-0" />
            <span className="text-xs text-white/70 truncate">{site.url.replace(/^https:\/\/(www2?\.)?/, '')}</span>
          </div>
          <a href={site.url} target="_blank" rel="noreferrer"
             className="p-2 rounded-lg hover:bg-white/10 transition-colors" aria-label="Ouvrir dans un nouvel onglet">
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        <div className="flex-1 relative">
          <iframe src={site.url} title={site.name} className="absolute inset-0 w-full h-full bg-white" />
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 max-w-md w-[92%] rounded-xl bg-zinc-900/95 border border-white/10 backdrop-blur px-4 py-3 text-xs text-white/70">
            Si la page reste blanche, {site.name} refuse l'intégration.{' '}
            <a href={site.url} target="_blank" rel="noreferrer" className="text-yellow-400 font-semibold underline">
              Ouvrez-le dans un nouvel onglet
            </a>{' '}
            puis collez le lien de l'article ci-dessous.
          </div>
          {/* Bouton flottant toujours visible pendant la navigation */}
          <button
            onClick={() => setAddOpen(true)}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 inline-flex items-center gap-2 px-5 py-3 rounded-full bg-yellow-400 text-zinc-950 font-bold text-sm shadow-xl shadow-black/30 hover:scale-[1.02] active:scale-95 transition-transform"
          >
            <Plus className="w-4 h-4" /> Ajouter à ma commande
          </button>
        </div>

        <AddItemDialog open={addOpen} onClose={() => setAddOpen(false)} siteName={site.name} onAdd={addItem} />
        {overlays}
      </div>
    );
  }

  // ── Grille des 10 sites
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <main className="flex-1 w-full max-w-3xl mx-auto px-5 py-8 sm:py-12">
        <button onClick={onBack} className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-3.5 h-3.5" /> Retour
        </button>
        <h1 className="text-2xl sm:text-4xl font-bold tracking-tight">Commander en ligne</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-lg">
          Naviguez sur vos sites préférés, ajoutez les articles à votre commande — Yobbanté vérifie les prix réels
          et vous envoie un devis unique tout compris. Aucun complément ne vous sera jamais demandé après paiement.
        </p>

        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {SITES.map((s, i) => (
            <motion.button
              key={s.id}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.35 }}
              onClick={() => setSite(s)}
              className="group p-5 rounded-2xl border-2 border-border bg-card hover:border-foreground hover:-translate-y-0.5 transition-all text-left"
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-black"
                   style={{ background: s.accent }}>
                {s.name[0]}
              </div>
              <p className="mt-3 font-bold text-sm">{s.name}</p>
              <p className="text-[11px] text-muted-foreground">{RELAY_LABEL[s.relay].replace('Relais Yobbanté ', '')}</p>
            </motion.button>
          ))}
        </div>

        <p className="mt-8 text-xs text-muted-foreground text-center">
          Sans engagement · L'achat n'est déclenché qu'après validation de votre devis
        </p>
      </main>

      {overlays}
    </div>
  );
}

function AddItemDialog({ open, onClose, siteName, onAdd }: {
  open: boolean; onClose: () => void; siteName: string;
  onAdd: (i: { url: string; qty: number; note: string }) => void;
}) {
  const [url, setUrl] = useState('');
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-card text-foreground rounded-t-2xl sm:rounded-2xl border border-border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm">Ajouter un article — {siteName}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary" aria-label="Fermer"><X className="w-4 h-4" /></button>
        </div>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Lien de la page produit *</span>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Collez l'URL de l'article"
                 className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20" />
        </label>
        <div className="grid grid-cols-3 gap-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Quantité</span>
            <input type="number" min={1} value={qty} onChange={e => setQty(Math.max(1, Number(e.target.value) || 1))}
                   className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20" />
          </label>
          <label className="col-span-2 block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Taille / couleur / variante</span>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Ex : 42, noir"
                   className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20" />
          </label>
        </div>
        <button
          onClick={() => { if (!/^https?:\/\//i.test(url.trim())) { toast.error('Collez un lien valide (https://…)'); return; } onAdd({ url: url.trim(), qty, note: note.trim() }); setUrl(''); setQty(1); setNote(''); }}
          className="w-full px-4 py-3 rounded-xl bg-yellow-400 text-zinc-950 font-bold text-sm hover:opacity-90 transition-opacity"
        >
          Ajouter au panier
        </button>
      </div>
    </div>
  );
}

function FloatingCart({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      aria-label="Ouvrir le panier"
      className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-yellow-400 text-zinc-950 shadow-xl shadow-yellow-400/20 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
    >
      <ShoppingCart className="w-6 h-6" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-zinc-950 text-yellow-400 text-[11px] font-bold flex items-center justify-center border border-yellow-400/40">
          {count}
        </span>
      )}
    </button>
  );
}

function CartDrawer({ open, onClose, groups, count, onRemove, onQty, onCheckout }: {
  open: boolean; onClose: () => void; groups: [string, CartItem[]][]; count: number;
  onRemove: (url: string) => void; onQty: (url: string, qty: number) => void; onCheckout: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      onClick={onClose} className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" />
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="fixed right-0 top-0 bottom-0 z-[70] w-full sm:max-w-md bg-card border-l border-border flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-bold flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" /> Ma commande ({count})
              </h2>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary transition-colors" aria-label="Fermer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {count === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">
                  Panier vide — ouvrez un site et ajoutez des articles.
                </p>
              ) : groups.map(([siteName, items]) => (
                <div key={siteName} className="space-y-2">
                  <p className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">
                    {siteName} · 1 colis attendu
                  </p>
                  {items.map(it => (
                    <div key={it.url} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-background">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-muted-foreground truncate">{it.url}</p>
                        {it.note && <p className="text-xs mt-0.5">{it.note}</p>}
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-[11px] text-muted-foreground">Qté</span>
                          <input type="number" min={1} value={it.qty}
                                 onChange={e => onQty(it.url, Math.max(1, Number(e.target.value) || 1))}
                                 className="w-16 rounded-lg border border-border bg-card px-2 py-1 text-xs" />
                        </div>
                      </div>
                      <button onClick={() => onRemove(it.url)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" aria-label="Retirer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-border">
              <button
                onClick={onCheckout} disabled={count === 0}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-yellow-400 text-zinc-950 font-bold text-sm hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                <Send className="w-4 h-4" /> Valider ma commande
              </button>
              <p className="mt-2 text-[11px] text-muted-foreground text-center">
                Vous ne payez rien maintenant. Devis unique tout compris sous 24h.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function CheckoutDialog({ open, onClose, sending, onSubmit }: {
  open: boolean; onClose: () => void; sending: boolean;
  onSubmit: (i: { budget: string; address: string; phone: string }) => void;
}) {
  const [budget, setBudget] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-card text-foreground rounded-t-2xl sm:rounded-2xl border border-border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">Valider ma commande</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary" aria-label="Fermer"><X className="w-4 h-4" /></button>
        </div>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Budget maximum estimé (FCFA)</span>
          <input type="number" min="0" value={budget} onChange={e => setBudget(e.target.value)} placeholder="Ex : 150000"
                 className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Adresse de livraison à Dakar</span>
          <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Quartier, rue, repère"
                 className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Téléphone</span>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+221 …"
                 className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20" />
        </label>
        <button
          onClick={() => onSubmit({ budget, address, phone })} disabled={sending}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-yellow-400 text-zinc-950 font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Envoyer pour devis
        </button>
        <p className="text-[11px] text-muted-foreground text-center">
          Frais d'acheminement estimés et légèrement majorés pour vous garantir qu'aucun complément ne vous sera jamais demandé.
        </p>
      </div>
    </div>
  );
}
