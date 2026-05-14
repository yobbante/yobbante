import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const VILLES = ['Dakar', 'Thiès', 'Saint-Louis', 'Ziguinchor', 'Kaolack', 'Touba', 'Autre'];

const TYPES = [
  { id: 'gp_express', icon: '📦', label: 'GP Express' },
  { id: 'aerien', icon: '✈️', label: 'Aérien' },
  { id: 'maritime', icon: '🚢', label: 'Maritime' },
  { id: 'routier', icon: '🚛', label: 'Routier' },
  { id: 'taxi_vtc', icon: '🚕', label: 'Taxi / VTC' },
  { id: 'moto', icon: '🏍️', label: 'Moto' },
  { id: 'minibus_bus', icon: '🚐', label: 'Minibus / Bus' },
  { id: 'autre', icon: '📦', label: 'Autre' },
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
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-14 md:py-20">
        <p className="text-label mb-2">Vous êtes transporteur</p>
        <h2 className="text-[22px] md:text-[28px] mb-3">Rejoignez le réseau Yobbanté.</h2>
        <p
          className="mb-8"
          style={{ fontSize: 13, lineHeight: 1.6, color: 'hsl(var(--muted-foreground))' }}
        >
          GP express, aérien, maritime, routier — inscrivez-vous et recevez des missions.
        </p>

        <div
          className="rounded-2xl p-5"
          style={{
            background: 'hsl(var(--background-surface))',
            border: '0.5px solid hsl(var(--color-border-tertiary))',
          }}
        >
          {success ? (
            <div className="flex flex-col items-center text-center py-6">
              <CheckCircle2 className="w-12 h-12 mb-3" style={{ color: '#1D9E75' }} />
              <p className="text-[16px] font-bold text-foreground">Inscription reçue !</p>
              <p
                className="mt-2 max-w-xs"
                style={{ fontSize: 13, lineHeight: 1.5, color: 'hsl(var(--muted-foreground))' }}
              >
                Notre équipe vous contacte sous 24h sur votre WhatsApp.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <Field label="Prénom" required>
                <input
                  type="text"
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  placeholder="Votre prénom"
                  className="form-input"
                  maxLength={80}
                />
              </Field>

              <Field label="Nom" required>
                <input
                  type="text"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder="Votre nom"
                  className="form-input"
                  maxLength={80}
                />
              </Field>

              <Field label="Téléphone WhatsApp" required hint="Vous recevrez vos missions ici">
                <input
                  type="tel"
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  placeholder="+221"
                  className="form-input"
                  maxLength={32}
                />
              </Field>

              <Field label="Ville" required>
                <select
                  value={ville}
                  onChange={(e) => setVille(e.target.value)}
                  className="form-input"
                >
                  {VILLES.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </Field>

              <div>
                <label
                  className="block mb-2"
                  style={{ fontSize: 13, fontWeight: 500, color: 'hsl(var(--foreground))' }}
                >
                  Type de transport <span style={{ color: 'hsl(var(--destructive))' }}>*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {TYPES.map((t) => {
                    const active = types.includes(t.id);
                    return (
                      <button
                        type="button"
                        key={t.id}
                        onClick={() => toggleType(t.id)}
                        className={cn(
                          'rounded-xl p-3 text-center transition-colors',
                          active
                            ? 'border-2 border-primary bg-primary/10 text-primary'
                            : 'bg-background border border-border text-foreground hover:border-foreground/30',
                        )}
                      >
                        <div style={{ fontSize: 20, lineHeight: 1 }}>{t.icon}</div>
                        <div className="mt-1.5 text-[12px] font-medium">{t.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit}
                className="w-full rounded-xl font-semibold disabled:opacity-50"
                style={{
                  background: 'hsl(var(--primary))',
                  color: 'hsl(var(--primary-foreground))',
                  padding: '14px',
                  fontSize: 14,
                }}
              >
                {submitting ? 'Envoi…' : 'Rejoindre le réseau →'}
              </button>

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
