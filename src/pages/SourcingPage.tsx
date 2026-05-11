import { useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';
import { PublicNav } from '@/components/PublicNav';
import { SourcingFlow } from '@/components/flows/SourcingFlow';
import { FlowCompactHeader } from '@/components/flows/FlowPrimitives';
import { useSeo } from '@/hooks/useSeo';

/**
 * /sourcing — URL canonique du parcours sourcing produit.
 * Rend directement le SourcingFlow (pas d'écran de sélection intermédiaire)
 * pour garantir un contenu visible dès l'ouverture, même sur connexion lente.
 */
export default function SourcingPage() {
  const navigate = useNavigate();
  useSeo({
    title: 'Sourcing international — On achète pour vous | Yobbanté',
    description: "Vous cherchez un produit introuvable au Sénégal ? Yobbanté l'achète pour vous en France, Chine, USA et vous le livre à Dakar.",
    path: '/sourcing',
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicNav hideActions />
      <SourcingFlow
        compactHeader={
          <FlowCompactHeader
            eyebrow="Sourcing"
            title="Lancer un sourcing produit"
            theme="light"
            secondaryAction={{
              label: 'Accueil',
              icon: <Home className="w-3.5 h-3.5" />,
              variant: 'ghost',
              onClick: () => navigate('/'),
            }}
          />
        }
      />
    </div>
  );
}
