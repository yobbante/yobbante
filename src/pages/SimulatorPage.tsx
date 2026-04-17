import { Link, useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { SmartImportInline } from '@/components/SmartImportInline';
import { PublicNav } from '@/components/PublicNav';
import { PublicFooter } from '@/components/PublicFooter';
import type { WarehouseCountry } from '@/lib/types';

export default function SimulatorPage() {
  const navigate = useNavigate();
  const goDossier = (preset?: { product: string; estimatedWeight: string; origin: WarehouseCountry; destination: string; estimatedCost: number }) => {
    navigate('/confier-dossier', preset ? { state: { preset } } : undefined);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav extraItems={[{ label: 'Confier un dossier', onClick: () => goDossier() }]} />

      <section className="max-w-5xl mx-auto px-5 sm:px-6 pt-12 pb-8 md:pt-24 md:pb-14 text-center md:text-left">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-xs font-medium text-muted-foreground mb-5 md:mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          Smart Import Assistant
        </div>
        <h1 className="text-[2.25rem] sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.05] text-balance">
          Estimez votre import en 30 secondes.
        </h1>
        <p className="mt-5 text-base md:text-lg text-muted-foreground max-w-xl mx-auto md:mx-0 leading-relaxed text-pretty">
          Notre IA analyse votre demande et propose 3 routes — express, équilibrée, économique — avec coût et délai pour chacune.
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-5 sm:px-6 pb-16 md:pb-20">
        <SmartImportInline
          onConfideDossier={(p) => {
            goDossier({
              product: p.product,
              estimatedWeight: String(p.weight),
              origin: p.origin,
              destination: p.destination,
              estimatedCost: p.estimatedCost,
            });
          }}
        />
      </section>

      <section className="bg-secondary py-20">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-10">Comment ça marche</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { num: '01', title: 'Décrivez', desc: 'Produit, poids, pays d\'achat et destination. Optionnel : votre budget cible.' },
              { num: '02', title: 'Comparez', desc: 'L\'IA propose 3 routes optimisées avec coût et délai pour chacune.' },
              { num: '03', title: 'Confiez', desc: 'Validez en un clic et notre équipe prend le relais sous 24h.' },
            ].map(s => (
              <div key={s.num}>
                <span className="text-xs font-mono text-muted-foreground">{s.num}</span>
                <h3 className="text-lg font-semibold text-foreground mt-1">{s.title}</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
