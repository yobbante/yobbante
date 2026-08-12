import { DekkFooter } from './DekkFooter';
import { DekkCartDrawer } from './DekkCartDrawer';
import { DekkOrderConfirm } from './DekkOrderConfirm';
import { DekkStyles } from './DekkStyles';

/** Wraps a Boutique Dëkk page with the shared Dëkk chrome: styles, footer, cart drawer, order confirmation. */
export function DekkLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DekkStyles />
      {children}
      <DekkFooter />
      <DekkCartDrawer />
      <DekkOrderConfirm />
    </>
  );
}
