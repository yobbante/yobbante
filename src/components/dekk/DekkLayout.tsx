import { DekkFooter } from './DekkFooter';
import { DekkCartDrawer } from './DekkCartDrawer';

/** Wraps a Boutique Dëkk page with the shared Dëkk footer + global cart drawer. */
export function DekkLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <DekkFooter />
      <DekkCartDrawer />
    </>
  );
}
