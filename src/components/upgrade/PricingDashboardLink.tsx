import { Link } from 'react-router-dom';
import { MONO_FONT, UPGRADE_COLORS } from './upgradeStyles';

/** Subtle "trial · see plans" link placed under the dashboard action cards. */
export function PricingDashboardLink({ enabled = true }: { enabled?: boolean }) {
  if (!enabled) return null;
  return (
    <div className="text-center" style={{ marginTop: 12 }}>
      <Link
        to="/business/pricing"
        style={{
          fontFamily: MONO_FONT,
          fontSize: 11,
          color: UPGRADE_COLORS.muted,
          textDecoration: 'none',
        }}
      >
        Vous êtes en essai gratuit · Voir les plans{' '}
        <span style={{ color: UPGRADE_COLORS.yellow }}>→</span>
      </Link>
    </div>
  );
}
