import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { whatsappLink } from '@/lib/contact';
import { UPGRADE_COLORS } from './upgradeStyles';

interface UpgradeLimitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  body: string;
  primaryLabel?: string;
  primaryTo?: string;
  contactMessage?: string;
}

/**
 * Hard-limit reached modal. Used e.g. when the 6th customs document of the
 * month is requested on a Starter plan.
 */
export function UpgradeLimitModal({
  open,
  onOpenChange,
  title = 'Limite atteinte ce mois',
  body,
  primaryLabel = 'Passer au Business →',
  primaryTo = '/business/pricing#business',
  contactMessage = 'Bonjour, je souhaite passer au plan Yobbanté Business.',
}: UpgradeLimitModalProps) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        style={{ background: '#111111', border: `1px solid ${UPGRADE_COLORS.panelBorder}` }}
      >
        <h2 style={{ color: UPGRADE_COLORS.textStrong, fontSize: 14, fontWeight: 700, margin: 0 }}>
          {title}
        </h2>
        <p style={{ color: UPGRADE_COLORS.text, fontSize: 13, lineHeight: 1.55, margin: '8px 0 16px' }}>
          {body}
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              navigate(primaryTo);
            }}
            style={{
              flex: 1,
              background: UPGRADE_COLORS.yellow,
              color: '#0A0A0A',
              fontWeight: 600,
              fontSize: 13,
              padding: '10px 14px',
              borderRadius: 10,
              border: 0,
              cursor: 'pointer',
            }}
          >
            {primaryLabel}
          </button>
          <a
            href={whatsappLink(contactMessage)}
            target="_blank"
            rel="noreferrer"
            style={{
              flex: 1,
              textAlign: 'center',
              border: `1px solid ${UPGRADE_COLORS.panelBorder}`,
              color: UPGRADE_COLORS.text,
              fontSize: 13,
              padding: '10px 14px',
              borderRadius: 10,
              textDecoration: 'none',
            }}
          >
            Nous contacter
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
