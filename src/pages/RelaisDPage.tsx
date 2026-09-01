import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Factory, Home, ShoppingBag } from 'lucide-react';
import { PublicNav } from '@/components/PublicNav';
import { ReceiveFlow } from '@/components/flows/ReceiveFlow';
import { FlowCompactHeader } from '@/components/flows/FlowPrimitives';
import { ShopBrowser } from '@/components/relais-d/ShopBrowser';
import { SourcingDForm } from '@/components/relais-d/SourcingDForm';
import { useSeo } from '@/hooks/useSeo';

type Mode = 'shop' | 'sourcing' | 'recevoir';

/**
 * /relais-d — POINT D'ENTRÉE UNIQUE « Relais D » (ex-Réception / Sourcing / Recherche Chine).
 *
 * 3 chemins :
 *  1. « Commander en ligne » (principal) — grille de 10 sites, navigateur immersif, panier flottant.
 *  2. « Sourcing D » — photo + description + budget, recherche fournisseur en Chine.
 *  3. « J'ai déjà commandé » (lien discret) — adresse relais Yobbanté (ReceiveFlow existant).
 */
export default function RelaisDPage() {
  const navigate = useNavigate();
  const { mode: urlMode } = useParams<{ mode?: Mode }>();
  const [mode, setMode] = useState<Mode | null>(urlMode ?? null);

  useEffect(() => { setMode(urlMode ?? null); }, [urlMode]);

  useSeo({
    title: 'Relais D — Achetez à l\'international, on livre à Dakar | Yobbanté',
    description: 'Commandez en ligne sur Amazon, AliExpress, Temu ou faites sourcer un produit en Chine : Yobbanté vérifie le prix réel, achète et livre à Dakar.',
    path: '/relais-d',
  });

  function selectMode(m: Mode) {
    setMode(m);
    window.history.replaceState({}, '', `/relais-d/${m}`);
  }
  function back() {
    setMode(null);
    window.history.replaceState({}, '', '/relais-d');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (mode === 'shop') return <ShopBrowser onBack={back} />;
  if (mode === 'sourcing') return <SourcingDForm onBack={back} />;
  if (mode === 'recevoir') {
    return (
      <ReceiveFlow
        compactHeader={
          <FlowCompactHeader
            eyebrow="Relais D · Adresse relais"
            title="J'ai déjà commandé"
            onSwap={back}
            swapLabel="Changer"
            theme="dark"
            secondaryAction={{
              label: 'Accueil',
              icon: <Home className="w-3.5 h-3.5" />,
              variant: 'ghost',
              onClick: () => navigate('/'),
            }}
          />
        }
      />
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicNav hideActions />
      <main className="flex-1 flex items-center justify-center px-5 py-10 sm:py-16">
        <div className="w-full max-w-3xl">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Retour
          </button>

          <motion.h1
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
            className="text-3xl sm:text-5xl font-bold tracking-tight text-balance"
          >
            Relais D — achetez partout, recevez à Dakar
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1, duration: 0.4 }}
            className="mt-3 text-base text-muted-foreground max-w-lg"
          >
            Un seul service pour vos achats internationaux : commandez en ligne ou laissez
            Yobbanté trouver le produit pour vous.
          </motion.p>

          <div className="mt-10 grid sm:grid-cols-2 gap-4">
            {/* Chemin principal — Commander en ligne */}
            <motion.button
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
              onClick={() => selectMode('shop')}
              className="group text-left p-6 sm:p-7 rounded-2xl border-2 border-zinc-900 bg-zinc-950 text-white hover:border-yellow-400 hover:-translate-y-0.5 transition-all"
            >
              <div className="w-11 h-11 rounded-xl bg-yellow-400 text-zinc-950 flex items-center justify-center">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <h2 className="mt-5 text-lg font-bold tracking-tight">Commander en ligne</h2>
              <p className="mt-2 text-sm text-white/60 leading-relaxed">
                Amazon, AliExpress, Temu, Shein… Naviguez, ajoutez au panier : on vérifie le prix réel,
                on vous envoie le devis, on achète pour vous.
              </p>
              <p className="mt-3 text-[11px] uppercase tracking-wider text-yellow-400/80 font-semibold">
                10 sites intégrés · Panier → devis 24h
              </p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-yellow-400 group-hover:gap-2.5 transition-all">
                Commencer <ArrowRight className="w-4 h-4" />
              </span>
            </motion.button>

            {/* Sourcing D */}
            <motion.button
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22, duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
              onClick={() => selectMode('sourcing')}
              className="group text-left p-6 sm:p-7 rounded-2xl border-2 border-border bg-card hover:border-foreground hover:-translate-y-0.5 transition-all"
            >
              <div className="w-11 h-11 rounded-xl bg-foreground text-background flex items-center justify-center">
                <Factory className="w-6 h-6" />
              </div>
              <h2 className="mt-5 text-lg font-bold tracking-tight">Sourcing D</h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Vous cherchez un produit précis ? Envoyez photo + description + budget :
                on le recherche en Chine et on négocie pour vous.
              </p>
              <p className="mt-3 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Short-list fournisseurs sous 24-48h
              </p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground group-hover:gap-2.5 transition-all">
                Décrire mon produit <ArrowRight className="w-4 h-4" />
              </span>
            </motion.button>
          </div>

          {/* Chemin discret — J'ai déjà commandé */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.32, duration: 0.4 }}
            className="mt-6 text-center"
          >
            <button
              onClick={() => selectMode('recevoir')}
              className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
            >
              J'ai déjà commandé — utiliser mon adresse relais Yobbanté
            </button>
          </motion.div>

          <p className="mt-8 text-xs text-muted-foreground text-center">
            Sans engagement · L'achat n'est déclenché qu'après validation de votre devis
          </p>
        </div>
      </main>
    </div>
  );
}
