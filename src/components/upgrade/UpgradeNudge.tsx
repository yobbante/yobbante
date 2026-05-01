import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { useDismissibleNudge } from '@/hooks/useDismissibleNudge';
import { MONO_FONT, NUDGE_STYLE, UPGRADE_COLORS } from './upgradeStyles';

interface UpgradeNudgeProps {
  /** Stable id used to remember the 7-day dismissal. */
  id: string;
  /** Body text (the leading 💡 is added automatically). */
  text: string;
  /** CTA label. */
  ctaLabel?: string;
  /** Where the CTA points. */
  ctaTo?: string;
  /** Hide the nudge entirely (e.g. paying subscriber). */
  enabled?: boolean;
  /** Hide dismiss button (used inside replacements like the team modal). */
  dismissible?: boolean;
  className?: string;
}

/**
 * Generic Yobbanté Business upgrade nudge — yellow accent on dark surface.
 * Strictly cosmetic, never alters surrounding flow.
 */
export function UpgradeNudge({
  id,
  text,
  ctaLabel = 'Voir les plans →',
  ctaTo = '/business/pricing',
  enabled = true,
  dismissible = true,
  className,
}: UpgradeNudgeProps) {
  const [visible, dismiss] = useDismissibleNudge(id, enabled);
  if (!enabled || !visible) return null;

  return (
    <div className={className} style={NUDGE_STYLE} role="status">
      <div className="flex items-start gap-3">
        <span aria-hidden style={{ color: UPGRADE_COLORS.yellow, fontSize: 16, lineHeight: '20px' }}>💡</span>
        <div className="flex-1 min-w-0">
          <p style={{ color: UPGRADE_COLORS.text, fontSize: 13, lineHeight: 1.5, margin: 0 }}>
            {text}
          </p>
          {ctaTo && (
            <Link
              to={ctaTo}
              style={{
                display: 'inline-block',
                marginTop: 8,
                fontSize: 12,
                fontFamily: MONO_FONT,
                color: UPGRADE_COLORS.yellow,
                textDecoration: 'none',
              }}
            >
              {ctaLabel}
            </Link>
          )}
        </div>
        {dismissible && (
          <button
            type="button"
            onClick={dismiss}
            aria-label="Masquer"
            style={{
              background: 'transparent',
              border: 0,
              padding: 4,
              color: UPGRADE_COLORS.muted,
              cursor: 'pointer',
              lineHeight: 0,
            }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
