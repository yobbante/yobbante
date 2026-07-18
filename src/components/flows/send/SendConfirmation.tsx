import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Phone, Truck, Package, Plane, CheckCircle2, MessageCircle,
  FileText, Search, ShieldCheck,
} from 'lucide-react';
import { FlowShell, FlowSuccess } from '../FlowPrimitives';
import { EmailRecapCard, RecapRow } from './pieces';
import { TRANSPORT_MODES, GOODS_TYPES } from './constants';
import type { CountryProfile } from '@/lib/countryProfile';
import { formatLocalAmount } from '@/lib/countryProfile';

export type SendConfirmationData = {
  reference: string;
  trackingId: string;
  eta: string;
  dossierId?: string | null;
  price: number;
};

type CityLite = { city: string; country: string } | null | undefined;

export function SendConfirmation({
  confirmed, compactHeader,
  originCity, destCity, originProfile, destProfile,
  pickupDate, pickupSlot, pickupAddress,
  senderName, senderPhone,
  recipientName, recipientPhone,
  transportMode, priority, insurance,
  goodsType, description, weight, parcelCount,
}: {
  confirmed: SendConfirmationData;
  compactHeader?: React.ReactNode;
  originCity: CityLite; destCity: CityLite;
  originProfile: CountryProfile; destProfile: CountryProfile;
  pickupDate: string; pickupSlot: 'morning' | 'afternoon' | null; pickupAddress: string;
  senderName: string; senderPhone: string;
  recipientName: string; recipientPhone: string;
  transportMode: 'AIR' | 'SEA' | 'ROAD' | null;
  priority: 'normal' | 'express';
  insurance: 'none' | 'standard' | 'premium';
  goodsType: string | null;
  description: string;
  weight: number; parcelCount: number;
}) {
  const navigate = useNavigate();

  const waMessage = `Bonjour Yobbanté, je viens de créer l'expédition ${confirmed.reference} (${originCity?.city} → ${destCity?.city}). Je souhaite confirmer le créneau de collecte.`;
  const waHref = `https://wa.me/221786078080?text=${encodeURIComponent(waMessage)}`;

  const nextSteps = [
    {
      icon: <Phone className="w-4 h-4" />, title: 'Appel de confirmation',
      desc: 'Notre équipe vous contacte sous 2 h pour valider le créneau de collecte.',
      eta: 'Sous 2 h', active: true,
    },
    {
      icon: <Truck className="w-4 h-4" />, title: 'Collecte à domicile',
      desc: `Un coursier passe le ${pickupDate || 'jour convenu'} (${pickupSlot === 'morning' ? 'matin' : 'après-midi'}) à l'adresse indiquée.`,
      eta: pickupDate || 'À programmer',
    },
    {
      icon: <Package className="w-4 h-4" />, title: 'Réception en hub',
      desc: 'Votre colis est pesé, scellé et préparé pour le départ groupé.',
      eta: '24-48 h',
    },
    {
      icon: <Plane className="w-4 h-4" />, title: 'Transport international',
      desc: `Acheminement ${TRANSPORT_MODES.find(t => t.id === transportMode)?.label.toLowerCase() ?? ''} vers ${destCity?.city}, suivi en temps réel.`,
      eta: `${confirmed.eta}`,
    },
    {
      icon: <CheckCircle2 className="w-4 h-4" />, title: 'Livraison au destinataire',
      desc: `${recipientName || 'Le destinataire'} est notifié à chaque étape jusqu'à la remise.`,
      eta: 'Sur RDV',
    },
  ];

  const payHref = `/pay/${confirmed.trackingId}`;

  return (
    <FlowShell theme="light" compactHeader={compactHeader}>
      <FlowSuccess
        reference={confirmed.trackingId}
        title="Commande confirmée !"
        subtitle="Votre commande est enregistrée. Notre équipe vous contacte sous 24h pour organiser la collecte."
        ctaHref="/app" ctaLabel="Suivre ma commande →"
      />

      {/* F4 — Accusé WhatsApp + CTA paiement (évite les paniques post-clic) */}
      <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <MessageCircle className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-emerald-900">
              Récapitulatif WhatsApp envoyé{senderPhone ? ` au ${senderPhone}` : ''}
            </p>
            <p className="mt-0.5 text-xs text-emerald-800/80">
              Vous recevez le lien de suivi et le lien de paiement sur WhatsApp dans quelques secondes.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={payHref}
             className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium px-3.5 py-2 transition-colors">
            Payer maintenant →
          </a>
          <a href={`/suivre/${confirmed.trackingId}`}
             className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white text-emerald-800 text-sm font-medium px-3.5 py-2 hover:bg-emerald-50 transition-colors">
            <Search className="w-3.5 h-3.5" /> Suivre l'envoi
          </a>
        </div>
      </div>

      {/* Dual reference block */}
      <div className="mt-5 rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:p-5">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
          🔍 Pour suivre votre colis
        </p>
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Référence suivi</p>
            <p className="font-mono text-sm font-bold">{confirmed.trackingId}</p>
            <p className="text-[11px] text-muted-foreground mt-1">À utiliser sur la page de suivi.</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Référence commande</p>
            <p className="font-mono text-sm font-bold">{confirmed.reference}</p>
            <p className="text-[11px] text-muted-foreground mt-1">Pour vos échanges avec notre équipe.</p>
          </div>
        </div>
        <p className="text-[12px] text-foreground/80 break-all">
          <span className="text-muted-foreground">Lien direct&nbsp;: </span>
          <a href={`/suivre/${confirmed.trackingId}`} className="underline font-medium">
            yobbante.com/suivre/{confirmed.trackingId}
          </a>
        </p>
      </div>

      {confirmed.dossierId && <EmailRecapCard dossierId={confirmed.dossierId} />}

      <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-2">
        <a href={waHref} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card hover:bg-accent transition-colors px-3 py-2.5 text-sm font-medium">
          <MessageCircle className="w-4 h-4 text-primary" /> WhatsApp
        </a>
        <button type="button"
          onClick={() => { navigator.clipboard.writeText(confirmed.trackingId); toast.success('Référence suivi copiée'); }}
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card hover:bg-accent transition-colors px-3 py-2.5 text-sm font-medium">
          <FileText className="w-4 h-4 text-primary" /> Copier la réf.
        </button>
        <button type="button" onClick={() => navigate(`/suivre/${confirmed.trackingId}`)}
          className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 rounded-xl border border-border bg-card hover:bg-accent transition-colors px-3 py-2.5 text-sm font-medium">
          <Search className="w-4 h-4 text-primary" /> Suivre l'envoi
        </button>
      </div>


      <section className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold tracking-tight">Prochaines étapes</h3>
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Suivi en direct</span>
        </div>
        <ol className="space-y-0">
          {nextSteps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border ${
                  s.active
                    ? 'bg-primary text-primary-foreground border-primary ring-4 ring-primary/15'
                    : 'bg-secondary text-muted-foreground border-border'
                }`}>
                  {s.icon}
                </div>
                {i < nextSteps.length - 1 && (
                  <div className="w-px flex-1 min-h-[24px] bg-border my-1" />
                )}
              </div>
              <div className={`flex-1 pb-5 ${s.active ? '' : 'opacity-90'}`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">{s.title}</p>
                  <span className="text-[11px] font-medium text-muted-foreground bg-secondary border border-border rounded-full px-2 py-0.5 whitespace-nowrap">
                    {s.eta}
                  </span>
                </div>
                <p className="mt-1 text-xs sm:text-[13px] text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5 flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Une question ? On reste joignable.</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Notre équipe support répond 7j/7 sur WhatsApp et par téléphone au +221 78 607 80 80.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={waHref} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
              <MessageCircle className="w-3.5 h-3.5" /> Discuter sur WhatsApp
            </a>
            <a href="tel:+221786078080"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
              <Phone className="w-3.5 h-3.5" /> Appeler
            </a>
          </div>
        </div>
      </section>

      <section className="mt-4 mb-20 rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-3 text-sm">
        <h3 className="text-base font-semibold tracking-tight">Récapitulatif</h3>
        <RecapRow label="Trajet"       value={`${originProfile.flag} ${originCity?.city} → ${destProfile.flag} ${destCity?.city}`} />
        <RecapRow label="Expéditeur"   value={`${senderName} · ${senderPhone} · ${originCity?.city}`} />
        <RecapRow label="Collecte"     value={`${pickupDate} · ${pickupSlot === 'morning' ? 'Matin' : 'Après-midi'} · ${pickupAddress}`} />
        <RecapRow label="Destinataire" value={`${recipientName} · ${recipientPhone} · ${destCity?.city}`} />
        <RecapRow label="Article"    value={`${GOODS_TYPES.find(g => g.id === goodsType)?.label} — ${description}`} />
        <RecapRow label="Poids"      value={`${weight} kg · ${parcelCount} colis`} />
        <RecapRow label="Transport"  value={`${TRANSPORT_MODES.find(t => t.id === transportMode)?.label} · ${priority === 'express' ? 'Express' : 'Standard'}`} />
        <RecapRow label="Assurance"  value={insurance === 'none' ? 'Sans' : insurance === 'standard' ? 'Standard' : 'Premium'} />
        <RecapRow label="Total"      value={formatLocalAmount(confirmed.price, originProfile)} strong />
      </section>
    </FlowShell>
  );
}
