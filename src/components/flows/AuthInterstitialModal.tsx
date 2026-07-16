import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldCheck, Apple } from 'lucide-react';
import { lovable } from '@/integrations/lovable';
import { toast } from 'sonner';

interface AuthInterstitialModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Path the user should land on after auth (will receive ?resume=1). */
  resumePath: string;
}

/**
 * Modale interstitielle « Dernière étape ! » présentée juste avant la création
 * de la commande quand l'utilisateur n'est pas connecté. Évite toute redirection
 * brutale vers /auth — le devis est préservé via le draft, et l'utilisateur
 * revient exactement à la même étape grâce à ?resume=1.
 */
export function AuthInterstitialModal({ open, onOpenChange, resumePath }: AuthInterstitialModalProps) {
  const [loading, setLoading] = useState<'google' | 'apple' | null>(null);

  async function handleOAuth(provider: 'google' | 'apple') {
    setLoading(provider);
    try {
      const sep = resumePath.includes('?') ? '&' : '?';
      const fullResume = `${resumePath}${sep}resume=1`;
      const redirectAfterAuth = `${window.location.origin}/auth?redirect=${encodeURIComponent(fullResume)}`;
      const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: redirectAfterAuth });
      if (result.error) {
        toast.error(result.error.message || `Connexion ${provider === 'google' ? 'Google' : 'Apple'} échouée`);
        return;
      }
      // Si le navigateur redirige, on ne fait rien de plus.
    } finally {
      setLoading(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-border bg-card">
        <div className="px-6 pt-6 pb-2 text-center">
          <div className="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
               style={{ background: 'rgba(245,197,24,0.12)' }}>
            <ShieldCheck className="w-6 h-6" style={{ color: '#F5C518' }} />
          </div>
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="text-xl font-bold tracking-tight">Dernière étape !</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Créez votre espace Yobbanté gratuit pour confirmer.<br />
              <span className="text-foreground font-medium">Toutes vos infos sont sauvegardées</span> — vous reviendrez exactement ici après la connexion.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 pt-4 pb-6 space-y-2.5">
          <Button
            type="button"
            variant="outline"
            disabled={loading !== null}
            onClick={() => handleOAuth('google')}
            className="w-full h-12 rounded-xl border-2 font-semibold text-sm flex items-center justify-center gap-3"
          >
            {loading === 'google' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.5 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C33.9 5.1 29.2 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.2-.1-2.5-.4-3.5z"/>
                <path fill="#FF3D00" d="M6.3 14.1l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C33.9 5.1 29.2 3 24 3 16.3 3 9.7 7.4 6.3 14.1z"/>
                <path fill="#4CAF50" d="M24 45c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.9 26.8 37 24 37c-5.3 0-9.7-3.4-11.3-8.1l-6.6 5.1C9.4 40.6 16.1 45 24 45z"/>
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.7 2.1-2.1 3.9-3.9 5.2l6.2 5.2c-.4.4 6.7-4.9 6.7-14.4 0-1.2-.1-2.5-.3-3.5z"/>
              </svg>
            )}
            Continuer avec Google
          </Button>

          <Button
            type="button"
            disabled={loading !== null}
            onClick={() => handleOAuth('apple')}
            className="w-full h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-3 bg-foreground text-background hover:bg-foreground/90"
          >
            {loading === 'apple' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Apple className="w-4 h-4" />
            )}
            Continuer avec Apple
          </Button>

          <p className="pt-2 text-center text-[11px] text-muted-foreground">
            En continuant, vous acceptez nos CGU et notre politique de confidentialité.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
