import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DossierWizard } from '@/components/DossierWizard';

/**
 * Dedicated entry point for the "Ship/Receive" flow.
 * The wizard opens immediately on the ship intent. Closing it returns home.
 */
export default function ExpedierPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

  // SEO basics
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'Expédier un colis · Yobbanté';
    return () => { document.title = prevTitle; };
  }, []);

  const handleClose = (next: boolean) => {
    setOpen(next);
    if (!next) navigate('/');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <DossierWizard open={open} onOpenChange={handleClose} presetIntent="ship" />
    </div>
  );
}
