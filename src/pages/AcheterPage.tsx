import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Factory, Inbox, ArrowRight, ArrowLeft, ListChecks } from 'lucide-react';
import { PublicNav } from '@/components/PublicNav';
import { SourcingFlow } from '@/components/flows/SourcingFlow';
import { ReceiveFlow } from '@/components/flows/ReceiveFlow';
import { FlowCompactHeader } from '@/components/flows/FlowPrimitives';

type Mode = 'sourcing' | 'recevoir';

/**
 * /acheter — page d'entrée "Acheter un produit".
 *
 * Deux parcours possibles :
 *  - Sourcing : Yobbanté trouve, négocie et achète chez un fournisseur.
 *  - Recevoir : le client achète lui-même sur un site marchand et utilise
 *               une adresse relais Yobbanté pour la livraison internationale.
 *
 * Cette page ne fait QUE proposer le choix : les flows réels sont les
 * mêmes composants utilisés ailleurs (SourcingFlow, ReceiveFlow).
 */
export default function AcheterPage() {
  const navigate = useNavigate();
  const { mode: urlMode } = useParams<{ mode?: Mode }>();
  const [mode, setMode] = useState<Mode | null>(urlMode ?? null);

  useEffect(() => { setMode(urlMode ?? null); }, [urlMode]);

  useEffect(() => {
    document.title =
      mode === 'sourcing' ? 'Sourcing produit · Yobbanté' :
      mode === 'recevoir' ? 'Recevoir une commande · Yobbanté' :
                            'Acheter un produit · Yobbanté';
  }, [mode]);

  function selectMode(m: Mode) {
    setMode(m);
    window.history.replaceState({}, '', `/acheter/${m}`);
  }
  function swapMode() {
    setMode(null);
    window.history.replaceState({}, '', '/acheter');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Flow mode : delegate to the existing flow components.
  if (mode === 'sourcing') {
    return (
      <SourcingFlow
        compactHeader={
          <FlowCompactHeader
            eyebrow="Acheter · Sourcing"
            title="Lancer un sourcing produit"
            onSwap={swapMode}
            swapLabel="Changer"
            theme="light"
          />
        }
      />
    );
  }
  if (mode === 'recevoir') {
    return (
      <ReceiveFlow
        compactHeader={
          <FlowCompactHeader
            eyebrow="Acheter · Recevoir"
            title="Recevoir une commande"
            onSwap={swapMode}
            swapLabel="Changer"
            theme="dark"
            secondaryAction={{
              label: 'Mes commandes',
              icon: <ListChecks className="w-3.5 h-3.5" />,
              variant: 'accent',
              onClick: () =>
                window.dispatchEvent(new CustomEvent('yobbante:receive-flow:goto', { detail: { step: 'orders' } })),
            }}
          />
        }
      />
    );
  }

  // ── Selection screen
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
            Comment souhaitez-vous acheter ?
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1, duration: 0.4 }}
            className="mt-3 text-base text-muted-foreground max-w-lg"
          >
            Yobbanté gère vos achats à l'international, du sourcing fournisseur jusqu'à la
            réception de vos commandes en ligne.
          </motion.p>

          <div className="mt-10 grid sm:grid-cols-2 gap-4">
            <ChoiceCard
              icon={<Factory className="w-6 h-6" />}
              title="Lancer un sourcing produit"
              desc="Yobbanté identifie les fournisseurs, négocie et contrôle pour vous."
              hint="Pour entreprises & projets"
              delay={0.15}
              onClick={() => selectMode('sourcing')}
            />
            <ChoiceCard
              icon={<Inbox className="w-6 h-6" />}
              title="Recevoir une commande"
              desc="Vous avez déjà acheté sur Amazon, AliExpress, RockAuto ? On réceptionne et on livre."
              hint="Adresse relais incluse"
              dark
              delay={0.22}
              onClick={() => selectMode('recevoir')}
            />
          </div>

          <p className="mt-8 text-xs text-muted-foreground text-center">
            Sans engagement · Réponse sous 24h
          </p>
        </div>
      </main>
    </div>
  );
}

function ChoiceCard({
  icon, title, desc, hint, onClick, delay, dark = false,
}: {
  icon: React.ReactNode; title: string; desc: string; hint?: string;
  onClick: () => void; delay: number; dark?: boolean;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
      onClick={onClick}
      className={
        dark
          ? 'group text-left p-6 sm:p-7 rounded-2xl border-2 border-zinc-900 bg-zinc-950 text-white hover:border-yellow-400 hover:-translate-y-0.5 transition-all'
          : 'group text-left p-6 sm:p-7 rounded-2xl border-2 border-border bg-card hover:border-foreground hover:-translate-y-0.5 transition-all'
      }
    >
      <div className={
        dark
          ? 'w-11 h-11 rounded-xl bg-yellow-400 text-zinc-950 flex items-center justify-center'
          : 'w-11 h-11 rounded-xl bg-foreground text-background flex items-center justify-center'
      }>
        {icon}
      </div>
      <h2 className="mt-5 text-lg font-bold tracking-tight">{title}</h2>
      <p className={dark ? 'mt-2 text-sm text-white/60 leading-relaxed' : 'mt-2 text-sm text-muted-foreground leading-relaxed'}>
        {desc}
      </p>
      {hint && (
        <p className={dark ? 'mt-3 text-[11px] uppercase tracking-wider text-yellow-400/80 font-semibold' : 'mt-3 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold'}>
          {hint}
        </p>
      )}
      <span className={
        dark
          ? 'mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-yellow-400 group-hover:gap-2.5 transition-all'
          : 'mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground group-hover:gap-2.5 transition-all'
      }>
        Continuer <ArrowRight className="w-4 h-4" />
      </span>
    </motion.button>
  );
}
