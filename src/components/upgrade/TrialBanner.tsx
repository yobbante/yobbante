import { Link } from 'react-router-dom';
import { MONO_FONT, UPGRADE_COLORS } from './upgradeStyles';

interface TrialBannerProps {
  /** Account creation date — trial starts here. */
  createdAt?: string | null;
  /** Hide if account is on a paying plan. */
  enabled?: boolean;
  trialDays?: number;
}

/**
 * Sticky, non-dismissible 30-day trial banner shown on every /business page.
 */
export function TrialBanner({ createdAt, enabled = true, trialDays = 30 }: TrialBannerProps) {
  if (!enabled || !createdAt) return null;
  const start = new Date(createdAt).getTime();
  const day = Math.min(
    trialDays,
    Math.max(1, Math.floor((Date.now() - start) / (24 * 60 * 60 * 1000)) + 1),
  );
  // After the trial window, don't render the J+X banner anymore.
  if (Date.now() - start > trialDays * 24 * 60 * 60 * 1000) return null;

  return (
    <div
      style={{
        background: UPGRADE_COLORS.panel,
        borderBottom: `1px solid ${UPGRADE_COLORS.panelBorder}`,
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ fontFamily: MONO_FONT, fontSize: 11 }}>
        <span style={{ color: UPGRADE_COLORS.muted }}>Essai gratuit — </span>
        <span style={{ color: UPGRADE_COLORS.yellow, fontWeight: 700 }}>
          J+{day} / {trialDays}
        </span>
      </div>
      <Link
        to="/business/pricing"
        style={{
          fontFamily: MONO_FONT,
          fontSize: 12,
          color: UPGRADE_COLORS.yellow,
          textDecoration: 'none',
        }}
      >
        Choisir un plan →
      </Link>
    </div>
  );
}
