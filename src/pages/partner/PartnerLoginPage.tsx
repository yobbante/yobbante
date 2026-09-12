import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowRight, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import logoYobbante from '@/assets/logo-yobbante.png';
import { useSeo } from '@/hooks/useSeo';

const BG = '#0A0F1E';
const GOLD = '#D4AF37';
const SURFACE = '#121828';
const BORDER = 'rgba(212,175,55,0.18)';

export default function PartnerLoginPage() {
  useSeo({
    title: 'Espace partenaire fret | Yobbanté',
    description: 'Connexion des partenaires aériens et maritimes de Yobbanté pour publier leurs départs.',
    path: '/partenaire/connexion',
    index: false,
  });

  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [issued, setIssued] = useState<{ token: string; company_name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const link = issued ? `${window.location.origin}/partenaire/auth?token=${issued.token}` : '';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setNotFound(false);
    setIssued(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('fp_request_auth' as any, {
        p_phone: `+221${phone.replace(/\D/g, '')}`,
      });
      if (error) throw error;
      const r = data as any;
      if (!r?.found) { setNotFound(true); return; }
      setIssued({ token: r.token, company_name: r.company_name });
    } catch (err) {
      toast.error((err as Error).message || 'Erreur, réessayez');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: BG, color: 'white' }}>
      <header className="border-b" style={{ borderColor: BORDER }}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/"><img src={logoYobbante} alt="Yobbanté" className="h-7" /></Link>
          <span className="text-xs" style={{ color: GOLD }}>Espace partenaire</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl p-6 sm:p-8 space-y-6"
             style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold">Connexion partenaire</h1>
            <p className="text-sm text-white/60">Transitaires aériens et maritimes</p>
          </div>

          {!issued ? (
            <form onSubmit={submit} className="space-y-4">
              <label className="text-xs text-white/70 block" htmlFor="fp-phone">Numéro WhatsApp</label>
              <div className="flex gap-2">
                <div className="flex items-center px-3 rounded-md border text-sm"
                     style={{ borderColor: BORDER, background: BG }}>🇸🇳 +221</div>
                <Input
                  id="fp-phone" type="tel" inputMode="numeric" placeholder="77 123 45 67"
                  value={phone} onChange={e => setPhone(e.target.value)} required
                  className="flex-1" style={{ background: BG, borderColor: BORDER, color: 'white' }}
                />
              </div>
              <Button type="submit" disabled={loading || phone.replace(/\D/g, '').length < 9}
                      className="w-full font-semibold" style={{ background: GOLD, color: BG }}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Se connecter <ArrowRight className="w-4 h-4 ml-1" /></>}
              </Button>
              {notFound && (
                <p className="text-center text-sm text-red-300">
                  Numéro non reconnu. Contactez Yobbanté pour créer votre compte partenaire.
                </p>
              )}
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <p className="text-sm text-white/70">Bonjour {issued.company_name} — votre lien d'accès est prêt.</p>
              <a href={link} className="block w-full rounded-md py-2.5 font-semibold"
                 style={{ background: GOLD, color: BG }}>Ouvrir mon espace</a>
              <Button variant="ghost" className="w-full text-white/70"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(link);
                          setCopied(true); toast.success('Lien copié');
                          setTimeout(() => setCopied(false), 2000);
                        } catch { toast.error('Impossible de copier'); }
                      }}>
                {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />} Copier le lien
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
