import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DossierWizard } from '@/components/DossierWizard';

/**
 * Dedicated entry point for the "Buy a product" flow.
 * The wizard opens immediately on the buy intent. Closing it returns home.
 */
export default function AcheterPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'Acheter un produit à l\'international · Yobbanté';
    return () => { document.title = prevTitle; };
  }, []);

  const handleClose = (next: boolean) => {
    setOpen(next);
    if (!next) navigate('/');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <DossierWizard open={open} onOpenChange={handleClose} presetIntent="buy" />
    </div>
  );
}
