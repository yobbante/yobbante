import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ShoppingCart, ExternalLink, Trash2, X, Send, Loader2,
  Search, Sparkles, Link2, Plus, Wand2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useDossiers } from '@/hooks/useDossiers';
import { toast } from 'sonner';
import { SHOP_SITES, RELAY_LABEL, detectSiteFromUrl, type ShopSite } from '@/lib/shopSites';

/**
 * Relais D — Chemin « Commander en ligne ».
 *
 * Expérience hybride en 3 niveaux (l'iframe est abandonnée : les marchands la
 * bloquent via X-Frame-Options / CSP) :
 *   1. Vitrine interne Yobbanté par site (catégories + tendances gérées en admin)
 *   2. Recherche assistée → nouvel onglet marchand, ou bascule vers Sourcing D
 *   3. Collage de lien avec aperçu serveur (OpenGraph) → panier Yobbanté
 *
 * Le reste du flow (panier, validation, budget, notification agent, devis)
 * est inchangé.
 */

type CartItem = {
  site: string; relay: string; url: string; qty: number; note: string;
  title?: string | null; image?: string | null;
};

type Trending = {
  id: string; site_id: string; title: string;
  image_url: string | null; product_url: string; price_label: string | null;
};

const openTab = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

export function ShopBrowser({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const { createDossier } = useDossiers();
  const [site, setSite] = useState<ShopSite | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [sending, setSending] = useState(false);

  // Regroupement par site : un panier Amazon avec 3 articles = 1 colis attendu.
  const groups = useMemo(() => {
    const map = new Map<string, CartItem[]>();
    cart.forEach(i => map.set(i.site, [...(map.get(i.site) ?? []), i]));
    return [...map.entries()];
  }, [cart]);

  function addItem(item: { url: string; qty: number; note: string; title?: string | null; image?: string | null }, forSite?: ShopSite) {
    const detected = detectSiteFromUrl(item.url);
    // Le lien collé prime sur la vitrine ouverte : un lien Decathlon collé depuis
    // la vitrine Amazon doit être regroupé sous Decathlon (1 site = 1 colis).
    const matched = SHOP_SITES.find(s => s.id === detected.id);
    const target = matched ?? forSite ?? site;
    const siteName = target?.name ?? detected.name;
    const relay = target?.relay ?? 'FR';
    if (cart.some(c => c.url === item.url)) {
      toast.message('Ce lien est déjà dans votre commande');
      return;
    }
    setCart(c => [...c, { site: siteName, relay, ...item }]);
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
          lines.push(`   ${i + 1}. ${it.title ? `${it.title} — ` : ''}${it.url}`);
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

      // Lignes structurées : l'admin y saisira prix réel + poids estimé majoré.
      const dossierId = (dossier as any)?.id ?? null;
      if (dossierId) {
        const { error: itemsError } = await supabase.from('sourcing_items').insert(
          cart.map(i => ({
            dossier_id: dossierId,
            site: i.site,
            relay_country: i.relay,
            url: i.url,
            qty: i.qty,
            note: [i.title, i.note].filter(Boolean).join(' · ') || null,
          })),
        );
        if (itemsError) console.error('sourcing_items insert failed', itemsError);
      }

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

  // ── Vitrine interne d'un site
  if (site) {
    return (
      <>
        <SiteStorefront
          site={site}
          onBack={() => setSite(null)}
          onAdd={(item) => addItem(item, site)}
          onSourcing={(q) => navigate(`/relais-d/sourcing?q=${encodeURIComponent(q)}`)}
        />
        {overlays}
      </>
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
          Choisissez un site : catégories, tendances et recherche directe. Ajoutez vos articles —
          Yobbanté vérifie les prix réels et vous envoie un devis unique tout compris.
          Aucun complément ne vous sera jamais demandé après paiement.
        </p>

        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {SHOP_SITES.map((s, i) => (
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

/* ─────────────────────────── Vitrine interne ─────────────────────────── */

function SiteStorefront({ site, onBack, onAdd, onSourcing }: {
  site: ShopSite;
  onBack: () => void;
  onAdd: (i: { url: string; qty: number; note: string; title?: string | null; image?: string | null }) => void;
  onSourcing: (q: string) => void;
}) {
  const [q, setQ] = useState('');
  const [trending, setTrending] = useState<Trending[]>([]);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('shop_trending_products' as never)
      .select('id, site_id, title, image_url, product_url, price_label')
      .eq('site_id', site.id)
      .eq('active', true)
      .order('position', { ascending: true })
      .limit(12)
      .then(({ data }) => { if (!cancelled) setTrending((data ?? []) as unknown as Trending[]); });
    return () => { cancelled = true; };
  }, [site.id]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* En-tête vitrine */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-secondary transition-colors" aria-label="Retour aux sites">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-black shrink-0"
               style={{ background: site.accent }}>
            {site.name[0]}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm leading-tight truncate">{site.name}</p>
            <p className="text-[11px] text-muted-foreground truncate">{RELAY_LABEL[site.relay]}</p>
          </div>
          <button
            onClick={() => openTab(site.url)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ouvrir {site.name}</span>
            <span className="sm:hidden">Ouvrir</span>
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-6 space-y-8 pb-28">
        {/* Niveau 2 — Recherche assistée */}
        <section className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Que cherchez-vous sur {site.name} ?</span>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && q.trim()) openTab(site.search(q.trim())); }}
                placeholder="Ex : nike air max 42"
                className="w-full rounded-xl border border-border bg-background pl-10 pr-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
              />
            </div>
          </label>
          <div className="grid sm:grid-cols-2 gap-2">
            <button
              disabled={!q.trim()}
              onClick={() => openTab(site.search(q.trim()))}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-yellow-400 text-zinc-950 font-bold text-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              <ExternalLink className="w-4 h-4" /> Chercher sur {site.name}
            </button>
            <button
              disabled={!q.trim()}
              onClick={() => onSourcing(q.trim())}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-border bg-card font-semibold text-sm disabled:opacity-40 hover:border-foreground transition-colors"
            >
              <Wand2 className="w-4 h-4" /> Demander à Yobbanté de le trouver
            </button>
          </div>
        </section>

        {/* Niveau 1 — Catégories populaires */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold">Catégories populaires</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {site.categories.map(c => (
              <button
                key={c.label}
                onClick={() => openTab(c.path)}
                className="group flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-border bg-card text-left text-sm font-medium hover:border-foreground transition-colors"
              >
                <span className="truncate">{c.label}</span>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Chaque catégorie ouvre {site.name} dans un nouvel onglet — revenez ici pour coller le lien du produit.
          </p>
        </section>

        {/* Niveau 1 — Tendances du moment */}
        {trending.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-bold flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-yellow-500" /> Tendances du moment
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {trending.map(t => (
                <div key={t.id} className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
                  {t.image_url
                    ? <img src={t.image_url} alt={t.title} loading="lazy" className="w-full aspect-square object-cover" />
                    : <div className="w-full aspect-square bg-secondary" />}
                  <div className="p-3 flex-1 flex flex-col gap-2">
                    <p className="text-xs font-semibold leading-snug line-clamp-2">{t.title}</p>
                    {t.price_label && <p className="text-[11px] text-muted-foreground">{t.price_label}</p>}
                    <div className="mt-auto flex items-center gap-1.5">
                      <button
                        onClick={() => onAdd({ url: t.product_url, qty: 1, note: '', title: t.title, image: t.image_url })}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-2 rounded-lg bg-yellow-400 text-zinc-950 text-[11px] font-bold hover:opacity-90 transition-opacity"
                      >
                        <Plus className="w-3 h-3" /> Ajouter
                      </button>
                      <button
                        onClick={() => openTab(t.product_url)}
                        className="p-2 rounded-lg border border-border hover:border-foreground transition-colors"
                        aria-label="Voir sur le site"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Niveau 3 — Collage intelligent */}
        <PastePanel siteName={site.name} onAdd={onAdd} />
      </main>
    </div>
  );
}

/* ────────────────── Niveau 3 — Collage intelligent ────────────────── */

function PastePanel({ siteName, onAdd }: {
  siteName: string;
  onAdd: (i: { url: string; qty: number; note: string; title?: string | null; image?: string | null }) => void;
}) {
  const [url, setUrl] = useState('');
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ title: string | null; image: string | null; host: string } | null>(null);

  const valid = /^https?:\/\/\S+$/i.test(url.trim());
  const detected = valid ? detectSiteFromUrl(url.trim()) : null;

  // Aperçu serveur (OpenGraph) — jamais bloquant : timeout géré côté fonction.
  useEffect(() => {
    if (!valid) { setPreview(null); return; }
    const target = url.trim();
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const { data } = await supabase.functions.invoke('link-preview', { body: { url: target } });
        if (cancelled) return;
        const d = (data ?? {}) as { title?: string | null; image?: string | null; host?: string };
        setPreview({ title: d.title ?? null, image: d.image ?? null, host: d.host ?? '' });
      } catch {
        if (!cancelled) setPreview({ title: null, image: null, host: '' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(t); setLoading(false); };
  }, [url, valid]);

  return (
    <section className="rounded-2xl border-2 border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Link2 className="w-4 h-4 text-yellow-500" />
        <h2 className="text-sm font-bold">Vous avez trouvé votre produit ? Collez son lien ici</h2>
      </div>

      <input
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder={`https://… (lien de la page produit ${siteName})`}
        className="w-full rounded-xl border border-border bg-background px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
      />

      {valid && (
        <div className="flex items-start gap-3 p-3 rounded-xl border border-border bg-background">
          {loading ? (
            <div className="w-16 h-16 rounded-lg bg-secondary flex items-center justify-center shrink-0">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : preview?.image ? (
            <img src={preview.image} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-secondary flex items-center justify-center shrink-0">
              <Link2 className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold line-clamp-2">
              {loading ? 'Lecture de la page…' : (preview?.title || 'Produit détecté')}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{detected?.name}</p>
            <p className="text-[10px] text-muted-foreground truncate mt-0.5">{url.trim()}</p>
            {!loading && !preview?.title && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Ce site masque ses informations — pas de souci, l'ajout au panier fonctionne quand même.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Quantité</span>
          <input type="number" min={1} value={qty}
                 onChange={e => setQty(Math.max(1, Number(e.target.value) || 1))}
                 className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20" />
        </label>
        <label className="col-span-2 block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Taille / couleur / variante</span>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="Ex : 42, noir"
                 className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20" />
        </label>
      </div>

      <button
        onClick={() => {
          if (!valid) { toast.error('Collez un lien valide (https://…)'); return; }
          onAdd({ url: url.trim(), qty, note: note.trim(), title: preview?.title ?? null, image: preview?.image ?? null });
          setUrl(''); setQty(1); setNote(''); setPreview(null);
        }}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-yellow-400 text-zinc-950 font-bold text-sm hover:opacity-90 transition-opacity"
      >
        <Plus className="w-4 h-4" /> Ajouter à ma commande
      </button>
    </section>
  );
}

/* ───────────────────────── Panier & validation ───────────────────────── */

function FloatingCart({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      aria-label="Ouvrir le panier"
      className="fixed bottom-24 right-5 z-50 w-14 h-14 rounded-full bg-yellow-400 text-zinc-950 shadow-xl shadow-yellow-400/20 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
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
                  Panier vide — ouvrez une vitrine et ajoutez des articles.
                </p>
              ) : groups.map(([siteName, items]) => (
                <div key={siteName} className="space-y-2">
                  <p className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">
                    {siteName} · 1 colis attendu
                  </p>
                  {items.map(it => (
                    <div key={it.url} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-background">
                      {it.image && <img src={it.image} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />}
                      <div className="flex-1 min-w-0">
                        {it.title && <p className="text-xs font-semibold line-clamp-2">{it.title}</p>}
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
