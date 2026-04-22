import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface BackButtonProps {
  /** Where to go. If omitted, falls back to navigate(-1). */
  to?: string;
  /** Visible label, defaults to "Retour". */
  label?: string;
  /** Visual variant. */
  variant?: 'subtle' | 'pill';
  /** Force a dark theme palette (for the Recevoir-style flow). */
  dark?: boolean;
  className?: string;
}

/**
 * Shared back button used across public pages and flows.
 * Defaults to a minimal "← Retour" link; `pill` variant is a bordered chip.
 */
export function BackButton({
  to,
  label = 'Retour',
  variant = 'subtle',
  dark = false,
  className,
}: BackButtonProps) {
  const navigate = useNavigate();

  function handle() {
    if (to) navigate(to);
    else if (window.history.length > 1) navigate(-1);
    else navigate('/');
  }

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={handle}
        className={cn(
          'inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors',
          dark
            ? 'border border-white/15 text-white/80 hover:text-white hover:border-white/40'
            : 'border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40',
          className,
        )}
      >
        <ArrowLeft className="w-3.5 h-3.5" /> {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handle}
      className={cn(
        'inline-flex items-center gap-1.5 text-xs transition-colors',
        dark ? 'text-white/55 hover:text-white' : 'text-muted-foreground hover:text-foreground',
        className,
      )}
    >
      <ArrowLeft className="w-3.5 h-3.5" /> {label}
    </button>
  );
}
