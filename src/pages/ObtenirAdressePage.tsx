import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Globe, MapPin, Sparkles, ShieldCheck } from 'lucide-react';
import { PublicNav } from '@/components/PublicNav';
import { PublicFooter } from '@/components/PublicFooter';
import { GetAddressDialog } from '@/components/GetAddressDialog';

const PERKS = [
  { icon: Globe, label: '6 hubs internationaux', desc: 'France, Chine, USA, Dubai, Allemagne, Canada.' },
  { icon: Sparkles, label: 'Génération en < 30s', desc: 'Vos adresses sont prêtes immédiatement.' },
  { icon: ShieldCheck, label: '0€, sans engagement', desc: 'Vous ne payez que ce que vous expédiez.' },
];

export default function ObtenirAdressePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicNav />

      <main className="flex-1">
        <section className="max-w-6xl mx-auto px-5 sm:px-6 pt-10 md:pt-16 pb-10 md:pb-16">
          <div className="grid lg:grid-cols-[1fr_1.1fr] gap-8 lg:gap-12 items-start">
            {/* LEFT — narrative */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="lg:sticky lg:top-24"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-xs font-medium text-primary mb-5">
                <MapPin className="w-3.5 h-3.5" /> Adresses internationales
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-[1.05] text-balance">
                Achetez partout. Recevez chez nous.
              </h1>
              <p className="mt-4 md:mt-5 text-base text-muted-foreground max-w-md text-pretty">
                Recevez vos adresses Yobbanté dans 6 pays. Commandez sur Amazon, Alibaba, 1688
                ou n'importe quel site marchand — comme un local.
              </p>

              <div className="mt-8 space-y-3">
                {PERKS.map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => navigate(-1)}
                className="mt-6 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Retour
              </button>
            </motion.div>

            {/* RIGHT — flow */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <GetAddressDialog
                open
                onOpenChange={(o) => { if (!o) navigate(-1); }}
                onConfideDossier={() => navigate('/confier-dossier')}
                mode="page"
              />
            </motion.div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
