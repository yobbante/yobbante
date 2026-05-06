/**
 * Capacity bar — 4px height, semantic green/amber/red.
 * Spec: 0-69% success, 70-89% warning, 90-100% danger.
 */
interface CapacityBarProps {
  value: number; // 0..100
  className?: string;
  ariaLabel?: string;
}

export function CapacityBar({ value, className = '', ariaLabel }: CapacityBarProps) {
  const v = Math.max(0, Math.min(100, value));
  const color = v >= 90 ? '#A32D2D' : v >= 70 ? '#BA7517' : '#1D9E75';
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
      className={`w-full overflow-hidden rounded-full ${className}`}
      style={{ height: 4, background: 'hsl(var(--color-border-tertiary))' }}
    >
      <div
        style={{
          width: `${v}%`,
          height: '100%',
          background: color,
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  );
}
