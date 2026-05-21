import { DekkFooter } from './DekkFooter';

/** Wraps a Boutique Dëkk page with the shared Dëkk footer (header is per-page). */
export function DekkLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <DekkFooter />
    </>
  );
}
