import { Check } from 'lucide-react';

const TRUST = [
  'Prix instantané, sans devis',
  'Enlèvement gratuit à Dakar',
  'Suivi en temps réel',
  'Wave · Orange Money · CB',
];

export function TrustBar() {
  return (
    <div
      className="flex flex-wrap gap-x-6 gap-y-2 px-6 py-3.5 max-w-[580px] w-full rounded-b-[12px] -mt-[1px]"
      style={{
        background: 'hsl(var(--secondary))',
        borderTop: '0.5px solid hsl(var(--color-border-tertiary))',
      }}
    >
      {TRUST.map(t => (
        <div key={t} className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#1D9E75' }} />
          <span className="text-[12px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{t}</span>
        </div>
      ))}
    </div>
  );
}
