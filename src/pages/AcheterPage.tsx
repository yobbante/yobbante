import { useEffect } from 'react';
import { SourcingFlow } from '@/components/flows/SourcingFlow';

/**
 * /acheter — flow continu (no wizard) de sourcing produit fournisseur.
 * Renommé en "Lancer un sourcing produit" pour éviter la confusion avec
 * un achat e-commerce one-click.
 */
export default function AcheterPage() {
  useEffect(() => {
    const prev = document.title;
    document.title = 'Lancer un sourcing produit · Yobbanté';
    return () => { document.title = prev; };
  }, []);

  return <SourcingFlow />;
}
