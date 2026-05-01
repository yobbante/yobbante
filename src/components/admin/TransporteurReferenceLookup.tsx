import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetchTransporteurByRef, type Transporteur } from '@/hooks/useTransporteurs';

interface Props {
  value: string;
  onChange: (ref: string) => void;
  onMatch: (t: Transporteur | null) => void;
}

export function TransporteurReferenceLookup({ value, onChange, onMatch }: Props) {
  const [matched, setMatched] = useState<Transporteur | null>(null);
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!/^[0-9]{4}$/.test(value)) {
      setMatched(null);
      setChecked(false);
      onMatch(null);
      return;
    }
    setLoading(true);
    fetchTransporteurByRef(value).then((t) => {
      if (cancelled) return;
      setMatched(t);
      setChecked(true);
      setLoading(false);
      onMatch(t);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="space-y-2">
      <Label>Référence transporteur</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
        placeholder="4 chiffres ex: 2241"
        inputMode="numeric"
        maxLength={4}
      />
      {!checked && (
        <p className="text-[11px] text-muted-foreground">
          Nouveau transporteur ? Les infos seront enregistrées automatiquement.
        </p>
      )}
      {checked && matched && (
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2.5 font-mono text-[12px]"
          style={{
            background: 'rgba(34,197,94,0.08)',
            border: '1px solid rgba(34,197,94,0.2)',
            color: '#22C55E',
          }}
        >
          <span>✅ Transporteur connu — infos pré-remplies</span>
        </div>
      )}
      {checked && !matched && !loading && (
        <p className="font-mono text-[11px]" style={{ color: '#F5C518' }}>
          Nouveau transporteur · Réf. {value}
        </p>
      )}
    </div>
  );
}
