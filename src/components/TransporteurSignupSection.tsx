import { useState } from 'react';
import {
  CheckCircle2,
  Package,
  Plane,
  Ship,
  Truck,
  Car,
  Bike,
  Bus,
  Boxes,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const VILLES = ['Dakar', 'Thiès', 'Saint-Louis', 'Ziguinchor', 'Kaolack', 'Touba', 'Autre'];

const TYPES: { id: string; Icon: typeof Package; label: string }[] = [
  { id: 'gp_express', Icon: Package, label: 'GP Express' },
  { id: 'aerien', Icon: Plane, label: 'Aérien' },
  { id: 'maritime', Icon: Ship, label: 'Maritime' },
  { id: 'routier', Icon: Truck, label: 'Routier' },
  { id: 'taxi_vtc', Icon: Car, label: 'Taxi / VTC' },
  { id: 'moto', Icon: Bike, label: 'Moto' },
  { id: 'minibus_bus', Icon: Bus, label: 'Minibus / Bus' },
  { id: 'autre', Icon: Boxes, label: 'Autre' },
];

export function TransporteurSignupSection() {
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('+221');
  const [ville, setVille] = useState('Dakar');
  const [types, setTypes] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleType = (id: string) =>
    setTypes((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));

  const canSubmit =
    prenom.trim().length >= 1 &&
    nom.trim().length >= 1 &&
    telephone.trim().length >= 6 &&
    ville.trim().length >= 2 &&
    types.length >= 1 &&
    !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const { error: insErr } = await supabase.from('transporteur_inscriptions').insert({
      prenom: prenom.trim().slice(0, 80),
      nom: nom.trim().slice(0, 80),
      telephone: telephone.trim().slice(0, 32),
      ville: ville.trim().slice(0, 80),
      types_transport: types,
      source: 'landing_home',
    });
    setSubmitting(false);
    if (insErr) {
      setError('Une erreur est survenue. Réessayez ou contactez-nous sur WhatsApp.');
      return;
    }
    setSuccess(true);
  };

  return (
    <section style={{ borderTop: '0.5px solid hsl(var(--color-border-tertiary))' }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 md:py-24">
        <div className="text-center mb-10">
          <p
            className="inline-block mb-3 uppercase"
            style={{
              fontSize: 11,
              letterSpacing: '0.18em',
              color: 'hsl(var(--muted-foreground))',
              fontWeight: 500,
            }}
          >
            Devenir partenaire
          </p>
          <h2
            className="text-foreground"
            style={{
              fontSize: 'clamp(24px, 4vw, 34px)',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
            }}
          >
            Rejoignez le réseau logistique Yobbanté.
          </h2>
          <p
            className="mx-auto mt-4 max-w-xl"
            style={{ fontSize: 14, lineHeight: 1.65, color: 'hsl(var(--muted-foreground))' }}
          >
            GP express, aérien, maritime, routier — recevez des missions qualifiées,
            sécurisées et payées via la plateforme. Aucun frais d'inscription.
          </p>
          <a
            href={`https://wa.me/221781221891?text=${encodeURIComponent('Bonjour, je souhaite devenir transporteur GP avec Yobbanté.')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-full transition-opacity hover:opacity-90"
            style={{
              background: '#F5C518',
              color: '#0A0E1A',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            💬 WhatsApp transporteurs · +221 78 122 18 91
          </a>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { k: 'Missions régulières', v: 'Flux constant' },
            { k: 'Paiement sécurisé', v: 'Sous 48h' },
            { k: 'Support dédié', v: '7j/7' },
          ].map((s) => (
            <div
              key={s.k}
              className="text-center"
              style={{
                padding: '12px 8px',
                borderRadius: 12,
                background: 'hsl(var(--background-surface))',
                border: '0.5px solid hsl(var(--color-border-tertiary))',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--foreground))' }}>{s.v}</div>
              <div style={{ fontSize: 10.5, color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>{s.k}</div>
            </div>
          ))}
        </div>

        <div
          className="rounded-2xl p-6 md:p-8"
          style={{
            background: 'hsl(var(--background-surface))',
            border: '0.5px solid hsl(var(--color-border-tertiary))',
          }}
        >
          {success ? (
            <div className="flex flex-col items-center text-center py-8">
              <CheckCircle2 className="w-12 h-12 mb-3" style={{ color: '#1D9E75' }} />
              <p className="text-[16px] font-semibold text-foreground">Inscription reçue</p>
              <p
                className="mt-2 max-w-sm"
                style={{ fontSize: 13, lineHeight: 1.6, color: 'hsl(var(--muted-foreground))' }}
              >
                Notre équipe partenaires vous contacte sous 24 heures par WhatsApp
                pour finaliser votre profil.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Prénom" required>
                  <input
                    type="text"
                    value={prenom}
                    onChange={(e) => setPrenom(e.target.value)}
                    placeholder="Votre prénom"
                    className="w-full bg-transparent outline-none px-3 h-11 text-[14px] text-foreground placeholder:text-muted-foreground"
                    style={{ border: '0.5px solid hsl(var(--color-border-tertiary))', borderRadius: 8 }}
                    maxLength={80}
                  />
                </Field>

                <Field label="Nom" required>
                  <input
                    type="text"
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    placeholder="Votre nom"
                    className="w-full bg-transparent outline-none px-3 h-11 text-[14px] text-foreground placeholder:text-muted-foreground"
                    style={{ border: '0.5px solid hsl(var(--color-border-tertiary))', borderRadius: 8 }}
                    maxLength={80}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Téléphone WhatsApp" required hint="Canal officiel d'attribution des missions.">
                  <input
                    type="tel"
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    placeholder="+221"
                    className="w-full bg-transparent outline-none px-3 h-11 text-[14px] text-foreground placeholder:text-muted-foreground"
                    style={{ border: '0.5px solid hsl(var(--color-border-tertiary))', borderRadius: 8 }}
                    maxLength={32}
                  />
                </Field>

                <Field label="Ville d'opération" required>
                  <select
                    value={ville}
                    onChange={(e) => setVille(e.target.value)}
                    className="w-full bg-transparent outline-none px-3 h-11 text-[14px] text-foreground placeholder:text-muted-foreground"
                    style={{ border: '0.5px solid hsl(var(--color-border-tertiary))', borderRadius: 8 }}
                  >
                    {VILLES.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div>
                <label
                  className="block mb-2"
                  style={{ fontSize: 13, fontWeight: 500, color: 'hsl(var(--foreground))' }}
                >
                  Modes de transport opérés <span style={{ color: 'hsl(var(--destructive))' }}>*</span>
                </label>
                <p
                  className="mb-3"
                  style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))' }}
                >
                  Sélectionnez tous les modes que vous opérez régulièrement.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {TYPES.map(({ id, Icon, label }) => {
                    const active = types.includes(id);
                    return (
                      <button
                        type="button"
                        key={id}
                        onClick={() => toggleType(id)}
                        className={cn(
                          'rounded-xl px-3 py-3.5 text-center transition-colors flex flex-col items-center justify-center gap-1.5',
                          active
                            ? 'border-2 border-primary bg-primary/10 text-primary'
                            : 'bg-background border border-border text-foreground hover:border-foreground/30',
                        )}
                      >
                        <Icon className="w-5 h-5" strokeWidth={1.5} />
                        <div className="text-[12px] font-medium leading-tight">{label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit}
                className="w-full rounded-xl font-semibold disabled:opacity-50 transition-opacity"
                style={{
                  background: 'hsl(var(--foreground))',
                  color: 'hsl(var(--background))',
                  padding: '14px',
                  fontSize: 14,
                }}
              >
                {submitting ? 'Envoi en cours…' : 'Soumettre ma candidature'}
              </button>

              <p
                className="text-center"
                style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}
              >
                En soumettant, vous acceptez nos conditions partenaires.
                Aucun frais ne vous sera demandé.
              </p>

              {error && (
                <p className="text-destructive text-sm text-center">{error}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="block mb-1.5"
        style={{ fontSize: 13, fontWeight: 500, color: 'hsl(var(--foreground))' }}
      >
        {label} {required && <span style={{ color: 'hsl(var(--destructive))' }}>*</span>}
      </label>
      {children}
      {hint && (
        <p className="mt-1" style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
          {hint}
        </p>
      )}
    </div>
  );
}
