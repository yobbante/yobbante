import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Inbox, ArrowRight, ArrowLeft, ListChecks } from 'lucide-react';
import { PublicNav } from '@/components/PublicNav';
import { SendFlow } from '@/components/flows/SendFlow';
import { ReceiveFlow } from '@/components/flows/ReceiveFlow';
import { FlowCompactHeader } from '@/components/flows/FlowPrimitives';

type Mode = 'envoyer' | 'recevoir';

/**
 * /expedier  → écran fusionné : sélection en haut + flow inline dessous.
 * /expedier/envoyer & /expedier/recevoir restent valides (deep links) et
 * ouvrent directement le flow correspondant.
 */
export default function ExpedierPage() {
  const navigate = useNavigate();
  const { mode: urlMode } = useParams<{ mode?: Mode }>();
  // No more selection screen: /expedier defaults directly to "envoyer".
  const [mode, setMode] = useState<Mode>((urlMode as Mode) ?? 'envoyer');

  useEffect(() => { setMode((urlMode as Mode) ?? 'envoyer'); }, [urlMode]);

  useEffect(() => {
    document.title =
      mode === 'envoyer'  ? 'Envoyer un colis · Yobbanté' :
      mode === 'recevoir' ? 'Recevoir une commande · Yobbanté' :
                            'Expédier un colis · Yobbanté';
  }, [mode]);

  function selectMode(m: Mode) {
    setMode(m);
    // sync URL without reload, for shareable deep links
    window.history.replaceState({}, '', `/expedier/${m}`);
  }
  function swapMode() {
    const next: Mode = mode === 'envoyer' ? 'recevoir' : 'envoyer';
    setMode(next);
    window.history.replaceState({}, '', `/expedier/${next}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ─────────── FLOW MODE: render dedicated flow with compact header ───────────
  const header = (
    <FlowCompactHeader
      eyebrow={mode === 'envoyer' ? 'Expédier · Envoyer' : 'Expédier · Recevoir'}
      title={mode === 'envoyer' ? 'Envoyer un colis' : 'Recevoir une commande'}
      onSwap={swapMode}
      swapLabel={mode === 'envoyer' ? 'Recevoir plutôt' : 'Envoyer plutôt'}
      theme={mode === 'envoyer' ? 'light' : 'dark'}
      secondaryAction={
        mode === 'recevoir'
          ? {
              label: 'Mes commandes',
              icon: <ListChecks className="w-3.5 h-3.5" />,
              variant: 'accent',
              onClick: () =>
                window.dispatchEvent(new CustomEvent('yobbante:receive-flow:goto', { detail: { step: 'orders' } })),
            }
          : undefined
      }
    />
  );
  return mode === 'envoyer'
    ? <SendFlow compactHeader={header} />
    : <ReceiveFlow compactHeader={header} />;
}

  // ─────────── SELECTION MODE ───────────
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
            Que souhaitez-vous faire ?
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1, duration: 0.4 }}
            className="mt-3 text-base text-muted-foreground max-w-lg"
          >
            Yobbanté gère votre envoi ou votre réception, de bout en bout.
          </motion.p>

          <div className="mt-10 grid sm:grid-cols-2 gap-4">
            <ChoiceCard
              icon={<Package className="w-6 h-6" />}
              title="Envoyer un colis"
              desc="D'un point A à un point B. On organise tout : transport, douane, livraison."
              hint="Thème clair · flow guidé"
              delay={0.15}
              onClick={() => selectMode('envoyer')}
            />
            <ChoiceCard
              icon={<Inbox className="w-6 h-6" />}
              title="Recevoir une commande"
              desc="Vous avez acheté en ligne ? On réceptionne, regroupe et vous livre."
              hint="Thème nuit · accent jaune"
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
