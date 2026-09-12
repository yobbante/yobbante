import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loader2, Plane, Ship, Plus, LogOut, X, Pencil, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import logoYobbante from '@/assets/logo-yobbante.png';
import { clearFpSession, hasFpSessionFor, readFpSession } from '@/lib/fpSession';
import { usePartnerDepartures, usePartnerProfile, type PartnerDeparture } from '@/hooks/usePartnerSpace';
import { AirSeaDepartureFields } from '@/components/freight/AirSeaDepartureFields';
import {
  AirSeaDepartureForm, EMPTY_AIR_SEA, airSeaFormError, fromAirSeaRow, toAirSeaPayload,
} from '@/components/freight/airSeaDeparture';

const BG = '#0A0F1E';
const GOLD = '#D4AF37';
const SURFACE = '#121828';
const BORDER = 'rgba(212,175,55,0.18)';

function fmt(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function PartnerDashboardPage() {
  const { ref = '' } = useParams();
  const navigate = useNavigate();
  const session = readFpSession();
  const { data: partner, isLoading: loadingMe } = usePartnerProfile();
  const { list, save, cancel } = usePartnerDepartures();
  const [form, setForm] = useState<AirSeaDepartureForm | null>(null);

  useEffect(() => {
    if (!hasFpSessionFor(ref)) navigate('/partenaire/connexion', { replace: true });
  }, [ref, navigate]);

  const departures = list.data ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const { upcoming, past } = useMemo(() => ({
    upcoming: departures.filter(d => d.departure_date >= today && d.status !== 'cancelled'),
    past: departures.filter(d => d.departure_date < today || d.status === 'cancelled'),
  }), [departures, today]);

  const defaultMode: 'air' | 'sea_lcl' = partner?.mode === 'sea' ? 'sea_lcl' : 'air';

  function openNew() {
    setForm({
      ...EMPTY_AIR_SEA,
      transport_mode: defaultMode,
      carrier_company: partner?.company_name ?? '',
      price_per_kg_xof: partner?.default_price_per_kg_xof ? String(partner.default_price_per_kg_xof) : '',
      price_per_cbm_xof: partner?.default_price_per_cbm_xof ? String(partner.default_price_per_cbm_xof) : '',
      transit_days: partner?.default_transit_days ? String(partner.default_transit_days) : '',
    });
  }

  async function submit() {
    if (!form) return;
    const err = airSeaFormError(form);
    if (err) { toast.error(err); return; }
    try {
      await save.mutateAsync(toAirSeaPayload(form));
      toast.success(form.id ? 'Départ mis à jour' : 'Départ publié');
      setForm(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (loadingMe) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: GOLD }} />
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: BG, color: 'white' }}>
        <div className="max-w-sm w-full text-center space-y-4 rounded-2xl p-8"
             style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
          <p className="text-sm text-white/80">Votre session a expiré.</p>
          <Link to="/partenaire/connexion" className="inline-block rounded-md px-4 py-2 font-semibold"
                style={{ background: GOLD, color: BG }}>Se reconnecter</Link>
        </div>
      </div>
    );
  }

  const totalKg = upcoming.reduce((s, d) => s + (d.available_capacity_kg ?? 0), 0);
  const reserved = upcoming.reduce((s, d) => s + Number(d.reserved_capacity_kg ?? 0), 0);

  const card = (d: PartnerDeparture) => (
    <div key={d.id} className="rounded-xl p-4 space-y-2" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold">
            {d.transport_mode === 'air' ? <Plane className="w-4 h-4" style={{ color: GOLD }} />
                                        : <Ship className="w-4 h-4" style={{ color: GOLD }} />}
            <span className="truncate">{d.origin_city} → {d.destination_city}</span>
          </div>
          <p className="text-xs text-white/60 mt-1">
            Départ {fmt(d.departure_date)}
            {d.cutoff_date ? ` · Cut-off ${fmt(d.cutoff_date)}` : ''}
            {d.arrival_estimate ? ` · Arrivée ${fmt(d.arrival_estimate)}` : ''}
          </p>
          <p className="text-xs text-white/60">
            {d.flight_or_vessel ? `${d.flight_or_vessel} · ` : ''}
            {d.transport_mode === 'air'
              ? `${d.total_capacity_kg} kg${d.price_per_kg_xof ? ` · ${d.price_per_kg_xof} XOF/kg` : ''}`
              : `${d.capacity_cbm ?? d.total_capacity_kg} ${d.capacity_cbm ? 'CBM' : 'kg'}${d.price_per_cbm_xof ? ` · ${d.price_per_cbm_xof} XOF/CBM` : ''}`}
          </p>
          {Number(d.reserved_capacity_kg) > 0 && (
            <p className="text-xs" style={{ color: GOLD }}>{d.reserved_capacity_kg} kg déjà réservés par Yobbanté</p>
          )}
        </div>
        {d.status !== 'cancelled' && (
          <div className="flex gap-1 shrink-0">
            <Button size="icon" variant="ghost" className="text-white/60 hover:text-white"
                    aria-label="Modifier" onClick={() => setForm(fromAirSeaRow(d))}>
              <Pencil className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" className="text-white/60 hover:text-red-300"
                    aria-label="Annuler le départ"
                    onClick={async () => { await cancel.mutateAsync(d.id); toast.success('Départ annulé'); }}>
              <Ban className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
      {d.status === 'cancelled' && <span className="text-[11px] text-red-300">Annulé</span>}
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: BG, color: 'white' }}>
      <header className="border-b sticky top-0 z-10" style={{ borderColor: BORDER, background: BG }}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/"><img src={logoYobbante} alt="Yobbanté" className="h-7" /></Link>
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: GOLD }}>{partner.reference}</span>
            <button className="text-white/60 hover:text-white" aria-label="Se déconnecter"
                    onClick={() => { clearFpSession(); navigate('/partenaire/connexion'); }}>
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold">{partner.company_name}</h1>
          <p className="text-sm text-white/60">
            Partenaire {partner.mode === 'air' ? 'aérien' : partner.mode === 'sea' ? 'maritime' : 'aérien & maritime'}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[['Départs à venir', String(upcoming.length)],
            ['Capacité libre', `${totalKg} kg`],
            ['Réservé', `${reserved} kg`]].map(([label, val]) => (
            <div key={label} className="rounded-xl p-3 text-center"
                 style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
              <p className="text-lg font-bold" style={{ color: GOLD }}>{val}</p>
              <p className="text-[11px] text-white/60">{label}</p>
            </div>
          ))}
        </div>

        <Button className="w-full font-semibold" style={{ background: GOLD, color: BG }} onClick={openNew}>
          <Plus className="w-4 h-4 mr-1" /> Publier un départ
        </Button>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-white/80">Départs à venir</h2>
          {list.isLoading ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: GOLD }} />
            : upcoming.length === 0
              ? <p className="text-sm text-white/50">Aucun départ programmé pour le moment.</p>
              : upcoming.map(card)}
        </section>

        {past.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-white/80">Historique</h2>
            {past.map(card)}
          </section>
        )}
      </main>

      {form && (
        <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="min-h-full flex items-start justify-center p-4">
            <div className="w-full max-w-lg rounded-2xl p-5 space-y-4"
                 style={{ background: SURFACE, border: `1px solid ${BORDER}`, color: 'white' }}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{form.id ? 'Modifier le départ' : 'Nouveau départ'}</h3>
                <button onClick={() => setForm(null)} aria-label="Fermer" className="text-white/60 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <AirSeaDepartureFields
                value={form} onChange={setForm} dark
                lockMode={partner.mode !== 'both'}
              />
              <Button className="w-full font-semibold" style={{ background: GOLD, color: BG }}
                      disabled={save.isPending} onClick={submit}>
                {save.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                {form.id ? 'Enregistrer' : 'Publier le départ'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
