import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Package, Inbox, ArrowRight, ArrowLeft, ShieldCheck, Clock3 } from 'lucide-react';
import { DossierWizard } from '@/components/DossierWizard';
import { PublicNav } from '@/components/PublicNav';

type Mode = 'envoyer' | 'recevoir';

const MODE_META: Record<Mode, { title: string; subtitle: string; intent: 'ship-send' | 'ship-receive' }> = {
  envoyer: {
    title: 'Envoyer un colis',
    subtitle: 'Décrivez votre envoi en quelques étapes — on s’occupe du transport, de la douane et de la livraison.',
    intent: 'ship-send',
  },
  recevoir: {
    title: 'Recevoir une commande',
    subtitle: 'Vous avez acheté en ligne ? On réceptionne, regroupe vos colis puis on vous livre.',
    intent: 'ship-receive',
  },
};

/**
 * /expedier             → écran immersif "Envoyer / Recevoir"
 * /expedier/envoyer     → page complète, flow interactif (intent ship-send)
 * /expedier/recevoir    → page complète, flow interactif (intent ship-receive)
 */
export default function ExpedierPage() {
  const navigate = useNavigate();
  const { mode } = useParams<{ mode?: Mode }>();

  useEffect(() => {
    const prev = document.title;
    document.title =
      mode === 'envoyer'
        ? 'Envoyer un colis · Yobbanté'
        : mode === 'recevoir'
          ? 'Recevoir une commande · Yobbanté'
          : 'Expédier un colis · Yobbanté';
    return () => { document.title = prev; };
  }, [mode]);

  // Direct deep-link → full page flow (not a popup)
  if (mode === 'envoyer' || mode === 'recevoir') {
    const meta = MODE_META[mode];
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
        <PublicNav hideActions />
        <main className="flex-1 flex flex-col">
          {/* Hero header */}
          <section className="px-5 sm:px-8 pt-6 pb-4 sm:pt-10 sm:pb-6 max-w-4xl w-full mx-auto">
            <button
              onClick={() => navigate('/expedier')}
              className="inline-flex items-center gap-2 text-xs text-white/50 hover:text-white transition-colors mb-5"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Retour
            </button>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex items-start gap-4"
            >
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-yellow-400 text-zinc-950 flex items-center justify-center shrink-0">
                {mode === 'envoyer' ? <Package className="w-5 h-5 sm:w-6 sm:h-6" /> : <Inbox className="w-5 h-5 sm:w-6 sm:h-6" />}
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-yellow-400/80">Yobbanté · Expédition</p>
                <h1 className="text-2xl sm:text-4xl font-bold tracking-tight mt-1">{meta.title}</h1>
                <p className="text-sm sm:text-base text-white/60 mt-2 max-w-xl">{meta.subtitle}</p>
              </div>
            </motion.div>

            <div className="mt-5 flex flex-wrap gap-3 text-[11px] text-white/50">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> Sans engagement</span>
              <span className="inline-flex items-center gap-1.5"><Clock3 className="w-3.5 h-3.5" /> Réponse sous 24h</span>
              <span className="inline-flex items-center gap-1.5"><ArrowRight className="w-3.5 h-3.5" /> 6 étapes guidées</span>
            </div>
          </section>

          {/* Inline wizard — page mode (not a popup) */}
          <section className="flex-1 px-3 sm:px-8 pb-10 max-w-4xl w-full mx-auto">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
              <DossierWizard
                open={true}
                onOpenChange={(o) => { if (!o) navigate('/'); }}
                presetIntent={meta.intent}
                variant="page"
                pageTitle={meta.title}
              />
            </div>
          </section>
        </main>
      </div>
    );
  }

  // Immersive choice screen
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
              delay={0.15}
              onClick={() => navigate('/expedier/envoyer')}
            />
            <ChoiceCard
              icon={<Inbox className="w-6 h-6" />}
              title="Recevoir une commande"
              desc="Vous avez acheté en ligne ? On réceptionne, regroupe et vous livre."
              delay={0.22}
              onClick={() => navigate('/expedier/recevoir')}
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
  icon, title, desc, onClick, delay,
}: {
  icon: React.ReactNode; title: string; desc: string; onClick: () => void; delay: number;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
      onClick={onClick}
      className="group text-left p-6 sm:p-7 rounded-2xl border-2 border-border bg-card hover:border-foreground hover:-translate-y-0.5 transition-all"
    >
      <div className="w-11 h-11 rounded-xl bg-foreground text-background flex items-center justify-center">
        {icon}
      </div>
      <h2 className="mt-5 text-lg font-bold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{desc}</p>
      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground group-hover:gap-2.5 transition-all">
        Continuer <ArrowRight className="w-4 h-4" />
      </span>
    </motion.button>
  );
}
