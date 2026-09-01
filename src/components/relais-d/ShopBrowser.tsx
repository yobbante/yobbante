import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ShoppingCart, ExternalLink, Plus, Trash2, X, Globe, Send, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useDossiers } from '@/hooks/useDossiers';
import { toast } from 'sonner';

/**
 * Relais D — Chemin "Commander en ligne".
 * Grille de sites marchands → navigateur immersif (iframe) → panier flottant.
 * Le panier est envoyé à Yobbanté : l'admin constate le prix réel,
 * applique le taux de change majoré et envoie le devis.
 */

const SITES = [
  { id: 'amazon',    name: 'Amazon',     url: 'https://www.amazon.fr',      accent: '#FF9900' },
  { id: 'aliexpress',name: 'AliExpress', url: 'https://www.aliexpress.com', accent: '#E62E04' },
  { id: 'ebay',      name: 'eBay',       url: 'https://www.ebay.fr',        accent: '#0064D2' },
  { id: 'temu',      name: 'Temu',       url: 'https://www.temu.com',       accent: '#FB7701' },
  { id: 'shein',     name: 'Shein',      url: 'https://www.shein.com',      accent: '#000000' },
  { id: 'cdiscount', name: 'Cdiscount',  url: 'https://www.cdiscount.com',  accent: '#0064B0' },
  { id: 'fnac',      name: 'Fnac',       url: 'https://www.fnac.com',       accent: '#E1A000' },
  { id: 'zara',      name: 'Zara',       url: 'https://www.zara.com',       accent: '#1A1A1A' },
  { id: 'nike',      name: 'Nike',       url: 'https://www.nike.com',       accent: '#111111' },
  { id: 'alibaba',   name: 'Alibaba',    url: 'https://www.alibaba.com',    accent: '#FF6A00' },
] as const;

type Site = (typeof SITES)[number];
type CartItem = { site: string; url: string; label: string };

export function ShopBrowser({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const { createDossier } = useDossiers();
  const [site, setSite] = useState<Site | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [sending, setSending] = useState(false);

  function addCurrentPage() {
    if (!site) return;
    const item: CartItem = { site: site.name, url: site.url, label: `Article ${site.name}` };
    if (cart.some(c => c.url === item.url && c.site === item.site)) {
      toast.message('Cette page est déjà dans votre panier');
      return;
    }
    setCart(c => [...c, item]);
    toast.success('Page ajoutée au panier');
  }

  async function sendCart() {
    if (cart.length === 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.message('Connectez-vous pour envoyer votre panier — il reste enregistré.');
      navigate(`/auth?redirect=${encodeURIComponent('/relais-d/shop')}`);
      return;
    }
    setSending(true);
    try {
      await createDossier.mutateAsync({
        product_description: `Commande en ligne — ${cart.length} article(s) : ${cart.map(c => c.site).join(', ')}`,
        origin_country: 'FR',
        destination_country: 'SN',
        needs_sourcing: true,
        notes: [
          'RELAIS D — COMMANDER EN LIGNE',
          'Le client a sélectionné les pages suivantes :',
          ...cart.map((c, i) => `${i + 1}. [${c.site}] ${c.url}`),
          '',
          'Action admin : constater le prix réel sur chaque lien, appliquer le taux de change majoré, envoyer le devis. Passage en « Achat en cours » après paiement.',
        ].join('\n'),
        app_source: 'relais_d_shop',
      });
      toast.success('Panier envoyé — devis sous 24h 🛒');
      setCart([]);
      setCartOpen(false);
      onBack();
    } catch (e: any) {
      toast.error(e?.message ?? 'Erreur lors de l\'envoi');
    } finally {
      setSending(false);
    }
  }

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
            <span className="text-xs text-white/70 truncate">{site.url.replace('https://www.', '')}</span>
          </div>
          <a href={site.url} target="_blank" rel="noreferrer"
             className="p-2 rounded-lg hover:bg-white/10 transition-colors" aria-label="Ouvrir dans un nouvel onglet">
            <ExternalLink className="w-4 h-4" />
          </a>
          <button onClick={addCurrentPage}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-yellow-400 text-zinc-950 hover:opacity-90 transition-opacity">
            <Plus className="w-3.5 h-3.5" /> Ajouter au panier
          </button>
        </div>

        <div className="flex-1 relative">
          <iframe src={site.url} title={site.name} className="absolute inset-0 w-full h-full bg-white" />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 max-w-md w-[92%] rounded-xl bg-zinc-900/95 border border-white/10 backdrop-blur px-4 py-3 text-xs text-white/70 pointer-events-none">
            Si la page reste blanche, {site.name} refuse l'intégration.{' '}
            <a href={site.url} target="_blank" rel="noreferrer" className="text-yellow-400 font-semibold pointer-events-auto underline">
              Ouvrez-le dans un nouvel onglet
            </a>{' '}
            puis collez simplement le lien des articles dans votre panier.
          </div>
        </div>

        <FloatingCart count={cart.length} onOpen={() => setCartOpen(true)} />
        <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} cart={cart}
                    onRemove={i => setCart(c => c.filter((_, idx) => idx !== i))}
                    onSend={sendCart} sending={sending} />
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
          Naviguez sur vos sites préférés, ajoutez les pages au panier — Yobbanté vérifie les prix réels,
          vous envoie un devis tout compris et achète pour vous.
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
              <p className="text-[11px] text-muted-foreground">{s.url.replace('https://www.', '')}</p>
            </motion.button>
          ))}
        </div>

        <p className="mt-8 text-xs text-muted-foreground text-center">
          Sans engagement · L'achat n'est déclenché qu'après validation de votre devis
        </p>
      </main>

      <FloatingCart count={cart.length} onOpen={() => setCartOpen(true)} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} cart={cart}
                  onRemove={i => setCart(c => c.filter((_, idx) => idx !== i))}
                  onSend={sendCart} sending={sending} />
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

function CartDrawer({ open, onClose, cart, onRemove, onSend, sending }: {
  open: boolean; onClose: () => void; cart: CartItem[];
  onRemove: (i: number) => void; onSend: () => void; sending: boolean;
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
                <ShoppingCart className="w-4 h-4" /> Panier ({cart.length})
              </h2>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary transition-colors" aria-label="Fermer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
              {cart.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">
                  Panier vide — ouvrez un site et ajoutez des pages.
                </p>
              ) : cart.map((c, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-background">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{c.site}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{c.url}</p>
                  </div>
                  <button onClick={() => onRemove(i)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" aria-label="Retirer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-border">
              <button
                onClick={onSend} disabled={cart.length === 0 || sending}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-yellow-400 text-zinc-950 font-bold text-sm hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Envoyer pour devis
              </button>
              <p className="mt-2 text-[11px] text-muted-foreground text-center">
                Yobbanté constate le prix réel et vous envoie un devis tout compris sous 24h.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
