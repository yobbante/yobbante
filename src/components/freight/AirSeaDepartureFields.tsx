import { Plane, Ship } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { AirSeaDepartureForm, CONTAINER_TYPES, AIR_SEA_MODE_LABEL } from './airSeaDeparture';

type Props = {
  value: AirSeaDepartureForm;
  onChange: (next: AirSeaDepartureForm) => void;
  /** Style sombre (espace partenaire). */
  dark?: boolean;
  /** Masque le sélecteur de mode (partenaire mono-mode). */
  lockMode?: boolean;
};

const DARK_INPUT = { background: '#0A0F1E', borderColor: 'rgba(212,175,55,0.18)', color: 'white' } as const;

type Ctx = {
  value: AirSeaDepartureForm;
  set: (patch: Partial<AirSeaDepartureForm>) => void;
  style?: React.CSSProperties;
  dark?: boolean;
};

function Field({ id, label, dark, children }: { id: string; label: string; dark?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className={cn('text-xs', dark && 'text-white/70')}>{label}</Label>
      {children}
    </div>
  );
}

function SectionTitle({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <p className={cn('text-[11px] uppercase tracking-[0.14em] font-semibold',
      dark ? 'text-[#D4AF37]' : 'text-muted-foreground')}>{children}</p>
  );
}

/** Trajet commun (villes) — identique dans les deux modes. */
function RouteFields({ value, set, style, dark }: Ctx) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field id="as-ocity" label="Ville de départ" dark={dark}>
        <Input id="as-ocity" style={style} value={value.origin_city} placeholder="Paris"
               onChange={e => set({ origin_city: e.target.value })} />
      </Field>
      <Field id="as-ocountry" label="Pays de départ" dark={dark}>
        <Input id="as-ocountry" style={style} value={value.origin_country} placeholder="France"
               onChange={e => set({ origin_country: e.target.value })} />
      </Field>
      <Field id="as-dcity" label="Ville d’arrivée" dark={dark}>
        <Input id="as-dcity" style={style} value={value.destination_city} placeholder="Dakar"
               onChange={e => set({ destination_city: e.target.value })} />
      </Field>
      <Field id="as-dcountry" label="Pays d’arrivée" dark={dark}>
        <Input id="as-dcountry" style={style} value={value.destination_country} placeholder="Sénégal"
               onChange={e => set({ destination_country: e.target.value })} />
      </Field>
    </div>
  );
}

function NotesField({ value, set, style, dark }: Ctx) {
  return (
    <Field id="as-notes" label="Notes" dark={dark}>
      <Textarea id="as-notes" rows={2} style={style} value={value.notes}
                placeholder="Conditions, marchandises interdites, contact sur place…"
                onChange={e => set({ notes: e.target.value })} />
    </Field>
  );
}

/** Formulaire dédié CARGO AÉRIEN (vol, aéroports, cut-off, kg). */
export function AirCargoDepartureFields(ctx: Ctx) {
  const { value, set, style, dark } = ctx;
  return (
    <div className="space-y-4">
      <SectionTitle dark={dark}>Vol</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field id="as-company" label="Compagnie aérienne" dark={dark}>
          <Input id="as-company" style={style} value={value.carrier_company} placeholder="Air Sénégal, Turkish…"
                 onChange={e => set({ carrier_company: e.target.value })} />
        </Field>
        <Field id="as-vessel" label="N° de vol" dark={dark}>
          <Input id="as-vessel" style={style} value={value.flight_or_vessel} placeholder="HC402"
                 onChange={e => set({ flight_or_vessel: e.target.value })} />
        </Field>
        <Field id="as-po" label="Aéroport de départ" dark={dark}>
          <Input id="as-po" style={style} value={value.port_origin} placeholder="CDG"
                 onChange={e => set({ port_origin: e.target.value })} />
        </Field>
        <Field id="as-pd" label="Aéroport d’arrivée" dark={dark}>
          <Input id="as-pd" style={style} value={value.port_destination} placeholder="DSS"
                 onChange={e => set({ port_destination: e.target.value })} />
        </Field>
      </div>

      <SectionTitle dark={dark}>Trajet</SectionTitle>
      <RouteFields {...ctx} />

      <SectionTitle dark={dark}>Dates</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field id="as-dep" label="Date de départ" dark={dark}>
          <Input id="as-dep" type="date" style={style} value={value.departure_date}
                 onChange={e => set({ departure_date: e.target.value })} />
        </Field>
        <Field id="as-cut" label="Cut-off (dernier dépôt)" dark={dark}>
          <Input id="as-cut" type="date" style={style} value={value.cutoff_date}
                 onChange={e => set({ cutoff_date: e.target.value })} />
        </Field>
        <Field id="as-arr" label="Arrivée estimée" dark={dark}>
          <Input id="as-arr" type="date" style={style} value={value.arrival_estimate}
                 onChange={e => set({ arrival_estimate: e.target.value })} />
        </Field>
        <Field id="as-transit" label="Délai d’acheminement (jours)" dark={dark}>
          <Input id="as-transit" type="number" min={0} style={style} value={value.transit_days}
                 onChange={e => set({ transit_days: e.target.value })} />
        </Field>
      </div>

      <SectionTitle dark={dark}>Capacité & tarif</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field id="as-kg" label="Capacité disponible (kg)" dark={dark}>
          <Input id="as-kg" type="number" min={0} style={style} value={value.total_capacity_kg}
                 onChange={e => set({ total_capacity_kg: e.target.value })} />
        </Field>
        <Field id="as-pkg" label="Prix au kg (XOF)" dark={dark}>
          <Input id="as-pkg" type="number" min={0} style={style} value={value.price_per_kg_xof}
                 onChange={e => set({ price_per_kg_xof: e.target.value })} />
        </Field>
      </div>

      <NotesField {...ctx} />
    </div>
  );
}

/** Formulaire dédié MARITIME (navire, ports, LCL/FCL, CBM). */
export function SeaDepartureFields(ctx: Ctx) {
  const { value, set, style, dark } = ctx;
  return (
    <div className="space-y-4">
      <SectionTitle dark={dark}>Navire</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field id="as-company" label="Armateur / compagnie" dark={dark}>
          <Input id="as-company" style={style} value={value.carrier_company} placeholder="Maersk, CMA CGM…"
                 onChange={e => set({ carrier_company: e.target.value })} />
        </Field>
        <Field id="as-vessel" label="Navire / n° de voyage" dark={dark}>
          <Input id="as-vessel" style={style} value={value.flight_or_vessel} placeholder="MSC Lucia — V.214"
                 onChange={e => set({ flight_or_vessel: e.target.value })} />
        </Field>
        <Field id="as-po" label="Port de chargement" dark={dark}>
          <Input id="as-po" style={style} value={value.port_origin} placeholder="Le Havre"
                 onChange={e => set({ port_origin: e.target.value })} />
        </Field>
        <Field id="as-pd" label="Port de déchargement" dark={dark}>
          <Input id="as-pd" style={style} value={value.port_destination} placeholder="Dakar"
                 onChange={e => set({ port_destination: e.target.value })} />
        </Field>
      </div>

      <SectionTitle dark={dark}>Trajet</SectionTitle>
      <RouteFields {...ctx} />

      <SectionTitle dark={dark}>Dates</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field id="as-dep" label="Date de départ (ETD)" dark={dark}>
          <Input id="as-dep" type="date" style={style} value={value.departure_date}
                 onChange={e => set({ departure_date: e.target.value })} />
        </Field>
        <Field id="as-cut" label="Cut-off empotage" dark={dark}>
          <Input id="as-cut" type="date" style={style} value={value.cutoff_date}
                 onChange={e => set({ cutoff_date: e.target.value })} />
        </Field>
        <Field id="as-arr" label="Arrivée estimée (ETA)" dark={dark}>
          <Input id="as-arr" type="date" style={style} value={value.arrival_estimate}
                 onChange={e => set({ arrival_estimate: e.target.value })} />
        </Field>
        <Field id="as-transit" label="Transit (jours)" dark={dark}>
          <Input id="as-transit" type="number" min={0} style={style} value={value.transit_days}
                 onChange={e => set({ transit_days: e.target.value })} />
        </Field>
      </div>

      <SectionTitle dark={dark}>Chargement & tarif</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field id="as-ct" label="Type de chargement" dark={dark}>
          <select
            id="as-ct" value={value.container_type}
            onChange={e => set({ container_type: e.target.value })}
            className="w-full h-10 rounded-md border px-3 text-sm bg-background"
            style={style}
          >
            {CONTAINER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field id="as-cbm" label="Capacité (CBM)" dark={dark}>
          <Input id="as-cbm" type="number" min={0} step="0.1" style={style} value={value.capacity_cbm}
                 onChange={e => set({ capacity_cbm: e.target.value })} />
        </Field>
        <Field id="as-pcbm" label="Prix au CBM (XOF)" dark={dark}>
          <Input id="as-pcbm" type="number" min={0} style={style} value={value.price_per_cbm_xof}
                 onChange={e => set({ price_per_cbm_xof: e.target.value })} />
        </Field>
        <Field id="as-kg" label="Capacité (kg) — optionnel" dark={dark}>
          <Input id="as-kg" type="number" min={0} style={style} value={value.total_capacity_kg}
                 onChange={e => set({ total_capacity_kg: e.target.value })} />
        </Field>
      </div>

      <NotesField {...ctx} />
    </div>
  );
}

/** Aiguillage : chaque mode a son propre formulaire, jamais de champs mélangés. */
export function AirSeaDepartureFields({ value, onChange, dark, lockMode }: Props) {
  const set = (patch: Partial<AirSeaDepartureForm>) => onChange({ ...value, ...patch });
  const style = dark ? DARK_INPUT : undefined;
  const ctx: Ctx = { value, set, style, dark };

  return (
    <div className="space-y-4">
      {!lockMode && (
        <div className="grid grid-cols-2 gap-2">
          {([['air', AIR_SEA_MODE_LABEL.air, Plane], ['sea_lcl', AIR_SEA_MODE_LABEL.sea_lcl, Ship]] as const).map(([id, label, Icon]) => (
            <button
              key={id} type="button"
              onClick={() => set({ transport_mode: id })}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition',
                value.transport_mode === id
                  ? (dark ? 'border-[#D4AF37] text-[#D4AF37]' : 'border-primary bg-primary/10 text-primary')
                  : (dark ? 'border-white/10 text-white/60' : 'border-border text-muted-foreground'),
              )}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
      )}

      {value.transport_mode === 'air' ? <AirCargoDepartureFields {...ctx} /> : <SeaDepartureFields {...ctx} />}
    </div>
  );
}
