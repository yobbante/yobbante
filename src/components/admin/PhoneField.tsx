import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { DIAL_CODES, splitPhone, joinPhone, DEFAULT_DIAL } from '@/lib/dialCodes';

interface Props {
  label: string;
  /** Valeur complète E.164 (ex. +221771234567) */
  value: string;
  onChange: (next: string) => void;
  /** Indicatif suggéré (déduit de la ville/pays). */
  suggestedDial?: string;
  /** Verrouille l'indicatif (ex. téléphone principal toujours +221). */
  lockedDial?: string;
  placeholder?: string;
  hint?: string;
}

/** Champ téléphone avec sélecteur d'indicatif intelligent. */
export function PhoneField({
  label, value, onChange, suggestedDial, lockedDial, placeholder, hint,
}: Props) {
  const fallback = lockedDial ?? suggestedDial ?? DEFAULT_DIAL;
  const { dial, local } = useMemo(() => splitPhone(value, fallback), [value, fallback]);
  const effectiveDial = lockedDial ?? dial;

  const options = useMemo(() => {
    const seen = new Set<string>();
    return DIAL_CODES.filter((d) => {
      const key = `${d.dial}-${d.country}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, []);

  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2 mt-1">
        {lockedDial ? (
          <div className="flex items-center px-3 rounded-md border border-border bg-muted text-sm font-mono shrink-0">
            🇸🇳 {lockedDial}
          </div>
        ) : (
          <Select
            value={`${effectiveDial}`}
            onValueChange={(d) => onChange(joinPhone(d, local))}
          >
            <SelectTrigger className="w-[124px] shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              {options.map((d) => (
                <SelectItem key={`${d.country}${d.dial}`} value={d.dial}>
                  {d.flag} {d.dial}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Input
          type="tel"
          inputMode="tel"
          value={local}
          onChange={(e) => onChange(joinPhone(effectiveDial, e.target.value))}
          placeholder={placeholder ?? '77 123 45 67'}
        />
      </div>
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}
