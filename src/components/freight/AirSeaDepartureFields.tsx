import { Plane, Ship } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { AirSeaDepartureForm, CONTAINER_TYPES } from './airSeaDeparture';

type Props = {
  value: AirSeaDepartureForm;
  onChange: (next: AirSeaDepartureForm) => void;
  /** Style sombre (espace partenaire). */
  dark?: boolean;
  /** Masque le sélecteur de mode (partenaire mono-mode). */
  lockMode?: boolean;
};

const DARK_INPUT = { background: '#0A0F1E', borderColor: 'rgba(212,175,55,0.18)', color: 'white' } as const;

export function AirSeaDepartureFields({ value, onChange, dark, lockMode }: Props) {
  const set = (patch: Partial<AirSeaDepartureForm>) => onChange({ ...value, ...patch });
  const style = dark ? DARK_INPUT : undefined;
  const isAir = value.transport_mode === 'air';

  const field = (id: string, label: string, node: React.ReactNode) => (
    <div className="space-y-1.5">
      <Label htmlFor={id} className={cn('text-xs', dark && 'text-white/70')}>{label}</Label>
      {node}
    </div>
  );

  return (
    <div className="space-y-4">
      {!lockMode && (
        <div className="grid grid-cols-2 gap-2">
          {([['air', 'Aérien', Plane], ['sea_lcl', 'Maritime', Ship]] as const).map(([id, label, Icon]) => (
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {field('as-company', isAir ? 'Compagnie aérienne' : 'Armateur / compagnie',
          <Input id="as-company" style={style} value={value.carrier_company}
                 placeholder={isAir ? 'Air Sénégal, Turkish…' : 'Maersk, CMA CGM…'}
                 onChange={e => set({ carrier_company: e.target.value })} />)}
        {field('as-vessel', isAir ? 'N° de vol' : 'Navire / voyage',
          <Input id="as-vessel" style={style} value={value.flight_or_vessel}
                 placeholder={isAir ? 'HC402' : 'MSC Lucia — V.214'}
                 onChange={e => set({ flight_or_vessel: e.target.value })} />)}

        {field('as-ocity', 'Ville de départ',
          <Input id="as-ocity" style={style} value={value.origin_city} placeholder="Paris"
                 onChange={e => set({ origin_city: e.target.value })} />)}
        {field('as-ocountry', 'Pays de départ',
          <Input id="as-ocountry" style={style} value={value.origin_country} placeholder="France"
                 onChange={e => set({ origin_country: e.target.value })} />)}

        {field('as-dcity', 'Ville d’arrivée',
          <Input id="as-dcity" style={style} value={value.destination_city} placeholder="Dakar"
                 onChange={e => set({ destination_city: e.target.value })} />)}
        {field('as-dcountry', 'Pays d’arrivée',
          <Input id="as-dcountry" style={style} value={value.destination_country} placeholder="Sénégal"
                 onChange={e => set({ destination_country: e.target.value })} />)}

        {field('as-po', isAir ? 'Aéroport de départ' : 'Port de chargement',
          <Input id="as-po" style={style} value={value.port_origin}
                 placeholder={isAir ? 'CDG' : 'Le Havre'}
                 onChange={e => set({ port_origin: e.target.value })} />)}
        {field('as-pd', isAir ? 'Aéroport d’arrivée' : 'Port de déchargement',
          <Input id="as-pd" style={style} value={value.port_destination}
                 placeholder={isAir ? 'DSS' : 'Dakar'}
                 onChange={e => set({ port_destination: e.target.value })} />)}

        {field('as-dep', 'Date de départ',
          <Input id="as-dep" type="date" style={style} value={value.departure_date}
                 onChange={e => set({ departure_date: e.target.value })} />)}
        {field('as-cut', 'Date limite de dépôt (cut-off)',
          <Input id="as-cut" type="date" style={style} value={value.cutoff_date}
                 onChange={e => set({ cutoff_date: e.target.value })} />)}

        {field('as-arr', 'Arrivée estimée',
          <Input id="as-arr" type="date" style={style} value={value.arrival_estimate}
                 onChange={e => set({ arrival_estimate: e.target.value })} />)}
        {field('as-transit', 'Transit (jours)',
          <Input id="as-transit" type="number" min={0} style={style} value={value.transit_days}
                 onChange={e => set({ transit_days: e.target.value })} />)}

        {field('as-kg', 'Capacité (kg)',
          <Input id="as-kg" type="number" min={0} style={style} value={value.total_capacity_kg}
                 onChange={e => set({ total_capacity_kg: e.target.value })} />)}

        {isAir
          ? field('as-pkg', 'Prix au kg (XOF)',
              <Input id="as-pkg" type="number" min={0} style={style} value={value.price_per_kg_xof}
                     onChange={e => set({ price_per_kg_xof: e.target.value })} />)
          : field('as-cbm', 'Capacité (CBM)',
              <Input id="as-cbm" type="number" min={0} step="0.1" style={style} value={value.capacity_cbm}
                     onChange={e => set({ capacity_cbm: e.target.value })} />)}

        {!isAir && field('as-pcbm', 'Prix au CBM (XOF)',
          <Input id="as-pcbm" type="number" min={0} style={style} value={value.price_per_cbm_xof}
                 onChange={e => set({ price_per_cbm_xof: e.target.value })} />)}

        {!isAir && field('as-ct', 'Type de chargement',
          <select
            id="as-ct" value={value.container_type}
            onChange={e => set({ container_type: e.target.value })}
            className="w-full h-10 rounded-md border px-3 text-sm bg-background"
            style={style}
          >
            {CONTAINER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>)}
      </div>

      {field('as-notes', 'Notes',
        <Textarea id="as-notes" rows={2} style={style} value={value.notes}
                  placeholder="Conditions, marchandises interdites, contact sur place…"
                  onChange={e => set({ notes: e.target.value })} />)}
    </div>
  );
}
