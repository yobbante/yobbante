import { useMemo, useState } from 'react';
import { PublicNav } from '@/components/PublicNav';
import { PublicFooter } from '@/components/PublicFooter';
import { useFretTarifs } from '@/hooks/useFretTarifs';
import {
  COLIS_SIZES,
  FRET_MAX_AUTO_KG,
  fmtFcfa,
  quoteInternational,
  quoteNational,
  type ColisSize,
} from '@/lib/fretPricing';
import { whatsappLink } from '@/lib/contact';
import { createDevis } from '@/hooks/useDevis';
import { formatFrDate, devisValidUntil } from '@/lib/devis';
import { toast } from 'sonner';
import { useSeo } from '@/hooks/useSeo';
import { Loader2, MessageCircle, Truck } from 'lucide-react';

type Tab = 'national' | 'international';

export default function TerminalDPage() {
  useSeo({
    title: 'Terminal D — Tarifs fret routier Dakar | Yobbanté',
    description:
      "Prix instantané pour l'envoi de colis par bus depuis Baux Maraîchers vers les villes du Sénégal et les pays voisins.",
    path: '/terminal-d',
  });

  const { zones, destinations, isLoading } = useFretTarifs();
  const [tab, setTab] = useState<Tab>('national');
  const [destId, setDestId] = useState('');
  const [size, setSize] = useState<ColisSize>('S');
  const [weight, setWeight] = useState('');

  const scopedDest = useMemo(
    () => destinations.filter(d => d.scope === tab),
    [destinations, tab],
  );
  const dest = scopedDest.find(d => d.id === destId) ?? null;
  const zone = dest ? zones.find(z => z.id === dest.zone_id) ?? null : null;

  const weightNum = Number(String(weight).replace(',', '.'));
  const quote = useMemo(() => {
    if (!zone) return null;
    return tab === 'national' ? quoteNational(zone, size) : quoteInternational(zone, weightNum);
  }, [zone, tab, size, weightNum]);

  const waMessage = dest
    ? `Bonjour Yobbanté, je souhaite un devis fret routier Terminal D.\nDestination : ${dest.name}${zone ? ` (${zone.label})` : ''}\nPoids estimé : ${
        tab === 'international'
          ? `${weight || '?'} kg`
          : `${weight || `> ${FRET_MAX_AUTO_KG}`} kg`
      }`
    : 'Bonjour Yobbanté, je souhaite un devis fret routier Terminal D.';

  const [devisPhone, setDevisPhone] = useState('+221');
  const [devisRef, setDevisRef] = useState<string | null>(null);
  const [savingDevis, setSavingDevis] = useState(false);

  async function handleCreateDevis() {
    if (!dest || !zone || quote?.price == null) return;
    setSavingDevis(true);
    try {
      await createDevis({
        conversation_phone: devisPhone.replace(/\s/g, '') || null,
        engine: tab === 'national' ? 'fret_national' : 'fret_international',
        origin: 'Dakar (Baux Maraîchers)',
        destination: dest.name,
        weight_kg: tab === 'international' ? weightNum : null,
        colis_size: tab === 'national' ? size : null,
        mode: 'Terminal D — fret routier',
        breakdown: [{ label: `Transport routier ${zone.label}`, amountFcfa: quote.price }],
        total_fcfa: quote.price,
      });
      setDevisRef(dest.name);
      toast.success('Devis enregistré — notre équipe vous l\'envoie après vérification.');
    } catch (e) {
      toast.error('Impossible d\'enregistrer le devis', {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally { setSavingDevis(false); }
  }

  const switchTab = (t: Tab) => {
    setTab(t);
    setDestId('');
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicNav />

      <main className="flex-1 w-full max-w-3xl mx-auto px-5 py-8">
        <div className="flex items-center gap-2 text-primary">
          <Truck className="w-5 h-5" />
          <span className="text-xs font-semibold uppercase tracking-wide">Terminal D</span>
        </div>
        <h1 className="text-2xl font-semibold mt-2">Fret routier depuis Dakar</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Départs quotidiens du garage Baux Maraîchers. Prix affiché immédiatement.
        </p>

        {/* Tabs */}
        <div className="mt-5 inline-flex rounded-xl border border-border p-1 bg-card/40">
          {(['national', 'international'] as Tab[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => switchTab(t)}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              }`}
            >
              {t === 'national' ? 'Sénégal' : 'Pays voisins'}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <div className="mt-5 grid gap-4">
            {/* Origine + destination */}
            <div className="rounded-2xl border border-border bg-card/40 p-4 space-y-3">
              <div>
                <label className="text-xs uppercase tracking-wide text-muted-foreground">Départ</label>
                <div className="mt-1 h-11 flex items-center px-3 rounded-lg bg-background/60 border border-border/60 text-sm">
                  Dakar — Garage Baux Maraîchers
                </div>
              </div>
              <div>
                <label htmlFor="fret-dest" className="text-xs uppercase tracking-wide text-muted-foreground">
                  {tab === 'national' ? 'Ville de destination' : 'Pays de destination'}
                </label>
                <select
                  id="fret-dest"
                  value={destId}
                  onChange={e => setDestId(e.target.value)}
                  className="mt-1 w-full h-11 px-3 rounded-lg bg-background/60 border border-border/60 text-sm"
                >
                  <option value="">Sélectionner…</option>
                  {scopedDest.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                {zone && (
                  <p className="text-xs text-muted-foreground mt-1">Zone détectée : {zone.label}</p>
                )}
              </div>

              {tab === 'national' ? (
                <div>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Taille du colis</span>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {COLIS_SIZES.map(s => (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => setSize(s.key)}
                        className={`rounded-xl border p-3 text-left transition-colors ${
                          size === s.key ? 'border-primary bg-primary/10' : 'border-border/60 bg-background/40'
                        }`}
                      >
                        <div className="text-sm font-semibold">{s.key} · {s.label}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{s.weight}</div>
                        <div className="text-[11px] text-muted-foreground">{s.dims}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <label htmlFor="fret-weight" className="text-xs uppercase tracking-wide text-muted-foreground">
                    Poids (kg)
                  </label>
                  <input
                    id="fret-weight"
                    type="number"
                    inputMode="decimal"
                    min={0.1}
                    step={0.1}
                    value={weight}
                    onChange={e => setWeight(e.target.value)}
                    placeholder="Ex : 5"
                    className="mt-1 w-full h-11 px-3 rounded-lg bg-background/60 border border-border/60 text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Minimum facturé : 3 kg.
                  </p>
                </div>
              )}
            </div>

            {/* Prix — mis en avant, immédiat */}
            <div
              aria-live="polite"
              className="rounded-2xl border border-primary/40 bg-primary/5 p-5"
            >
              {!zone ? (
                <p className="text-sm text-muted-foreground">
                  Choisissez une destination pour voir le prix immédiatement.
                </p>
              ) : quote?.price != null ? (
                <>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Prix total</p>
                  <p className="text-4xl font-semibold mt-1">{fmtFcfa(quote.price)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{quote.detail}</p>
                </>
              ) : quote?.manualQuote ? (
                <>
                  <p className="text-base font-semibold">Devis sur mesure — contactez-nous</p>
                  <p className="text-xs text-muted-foreground mt-1">{quote.detail}</p>
                  <a
                    href={whatsappLink(waMessage)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
                  >
                    <MessageCircle className="w-4 h-4" /> Demander un devis WhatsApp
                  </a>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{quote?.detail}</p>
              )}
            </div>

            {quote?.price != null && (
              <div className="rounded-2xl border border-border bg-card/40 p-4 space-y-2">
                <p className="text-sm font-medium">Recevoir ce devis</p>
                {devisRef ? (
                  <p className="text-xs text-muted-foreground">
                    Devis enregistré pour {devisRef} · valable jusqu'au {formatFrDate(devisValidUntil())}.
                    Notre équipe le vérifie puis vous l'envoie sur WhatsApp.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <input
                      value={devisPhone}
                      onChange={(e) => setDevisPhone(e.target.value)}
                      placeholder="+221 77 123 45 67"
                      aria-label="Numéro WhatsApp"
                      className="h-11 px-3 rounded-xl bg-background border border-border text-sm flex-1 min-w-[180px]"
                    />
                    <button
                      type="button"
                      onClick={handleCreateDevis}
                      disabled={savingDevis}
                      className="h-11 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
                    >
                      {savingDevis ? 'Enregistrement…' : 'Enregistrer mon devis'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {tab === 'national' && (
              <div className="rounded-2xl border border-border bg-card/40 p-4">
                <p className="text-sm">Colis de plus de {FRET_MAX_AUTO_KG} kg ?</p>
                <a
                  href={whatsappLink(waMessage)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <MessageCircle className="w-4 h-4" /> Devis sur mesure — contactez-nous
                </a>
              </div>
            )}
          </div>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}
