import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarIcon, Plane, Check, AlertCircle, Loader2, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ALL_CITIES } from '@/lib/worldCities';
import { cn } from '@/lib/utils';
import { useSeo } from '@/hooks/useSeo';

const YELLOW = '#F5C518';

type Ctx = {
  ok: boolean;
  reference?: string;
  prenom?: string;
  nom?: string;
  telephone?: string;
  destinations?: string[];
  reason?: string;
};

type PublishResult = {
  ok: boolean;
  departure_id?: string;
  transporteur_name?: string;
  destination?: string;
  date?: string;
  kg?: number;
  reason?: string;
};

export default function GpDepartPage() {
  const { ref } = useParams<{ ref: string }>();
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [loading, setLoading] = useState(true);

  const [destinationId, setDestinationId] = useState<string>('');
  const [date, setDate] = useState<Date | undefined>();
  const [kg, setKg] = useState<string>('');
  const [phone, setPhone] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<PublishResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useSeo({ title: 'Publier mon départ · Yobbanté GP', path: `/gp/depart/${ref ?? ''}` });

  useEffect(() => {
    let cancelled = false;
    if (!ref) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('gp_get_context', { p_ref: ref });
      if (!cancelled) {
        if (error) {
          setCtx({ ok: false, reason: 'rpc_error' });
        } else {
          const r = data as Ctx;
          setCtx(r);
          if (r?.ok && r.telephone) setPhone(r.telephone);
        }
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [ref]);

  const destination = useMemo(
    () => ALL_CITIES.find(c => c.id === destinationId) ?? null,
    [destinationId],
  );

  const canSubmit = !!destination && !!date && !!kg && Number(kg) > 0 && !!phone.trim();

  async function onSubmit() {
    if (!ref || !destination || !date || !kg) return;
    setSubmitting(true);
    setError(null);
    const { data, error } = await supabase.rpc('gp_publish_departure', {
      p_ref: ref,
      p_destination_city: destination.city,
      p_destination_country: destination.country,
      p_departure_date: format(date, 'yyyy-MM-dd'),
      p_kg: Number(kg),
      p_phone: phone.trim(),
    });
    setSubmitting(false);
    if (error) { setError(error.message); return; }
    const r = data as PublishResult;
    if (!r?.ok) {
      setError(r?.reason === 'invalid_kg' ? 'Poids invalide (entre 1 et 500 kg).'
        : r?.reason === 'invalid_date' ? 'La date doit être aujourd\'hui ou dans le futur.'
        : 'Erreur de publication. Réessayez.');
      return;
    }
    setSuccess(r);
  }

  function resetForm() {
    setDestinationId(''); setDate(undefined); setKg(''); setSuccess(null); setError(null);
  }

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement…
        </div>
      </Shell>
    );
  }

  if (!ctx?.ok) {
    return (
      <Shell>
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <AlertCircle className="w-10 h-10 mx-auto text-destructive mb-3" />
          <h2 className="text-lg font-semibold">Lien invalide</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Cette URL ne correspond à aucun GP actif. Contactez l'équipe Yobbanté au +221 78 122 18 91.
          </p>
        </div>
      </Shell>
    );
  }

  if (success) {
    return (
      <Shell>
        <div className="text-center py-8">
          <div
            className="inline-flex w-16 h-16 rounded-2xl items-center justify-center mb-5"
            style={{ background: YELLOW, color: '#0A0E1A' }}
          >
            <Check className="w-8 h-8" strokeWidth={3} />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Départ publié !</h2>
          <p className="mt-3 text-sm text-muted-foreground max-w-sm mx-auto">
            On cherche des colis pour vous. Vous serez notifié dès qu'on en trouve.
          </p>
          <div className="mt-6 inline-flex flex-col items-center gap-1 rounded-xl border border-border bg-card px-5 py-3">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Récap</span>
            <span className="text-sm font-semibold">
              {success.destination} · {success.date && format(new Date(success.date), 'dd/MM/yyyy')} · {success.kg} kg
            </span>
          </div>
          <div className="mt-8 flex flex-col gap-2">
            <Button onClick={resetForm} style={{ background: YELLOW, color: '#0A0E1A' }} className="font-semibold hover:opacity-90">
              Déclarer un autre départ
            </Button>
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
              Retour au site
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-6 text-center">
        <div
          className="inline-flex w-12 h-12 rounded-xl items-center justify-center mb-3"
          style={{ background: YELLOW, color: '#0A0E1A' }}
        >
          <Plane className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          Salam {ctx.prenom || 'GP'} !
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Publiez votre prochain départ en 30 secondes.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Destination *</Label>
          <Select value={destinationId} onValueChange={setDestinationId}>
            <SelectTrigger className="h-12 text-base">
              <SelectValue placeholder="Choisir une ville" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {ALL_CITIES.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="mr-2">{c.flag}</span>{c.city} <span className="text-muted-foreground text-xs">· {c.countryLabel}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Date de départ *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'h-12 w-full justify-start text-left font-normal text-base',
                  !date && 'text-muted-foreground',
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, 'EEEE d MMMM yyyy', { locale: fr }) : 'Choisir une date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                initialFocus
                locale={fr}
                className={cn('p-3 pointer-events-auto')}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Kilos disponibles *</Label>
          <div className="relative">
            <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={500}
              placeholder="25"
              value={kg}
              onChange={(e) => setKg(e.target.value)}
              className="h-12 pl-10 text-base"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">kg</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Contact WhatsApp *</Label>
          <Input
            type="tel"
            inputMode="tel"
            placeholder="+221 78 000 00 00"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-12 text-base"
          />
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button
          onClick={onSubmit}
          disabled={!canSubmit || submitting}
          className="w-full h-14 text-base font-semibold hover:opacity-90 disabled:opacity-50"
          style={{ background: YELLOW, color: '#0A0E1A' }}
        >
          {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Publication…</> : 'Publier mon départ →'}
        </Button>

        <p className="text-[11px] text-center text-muted-foreground">
          Réf GP : <span className="font-mono">{ctx.reference}</span> · Yobbanté
        </p>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-md px-4 sm:px-6 py-8 sm:py-12">
        {children}
      </div>
    </div>
  );
}
