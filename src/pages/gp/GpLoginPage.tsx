import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Copy, Check, MessageCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import logoYobbante from '@/assets/logo-yobbante.png';
import { YOBBANTE_GP_WHATSAPP, YOBBANTE_GP_WHATSAPP_DISPLAY } from '@/lib/contact';

const BG = '#0A0F1E';
const GOLD = '#D4AF37';
const SURFACE = '#121828';
const BORDER = 'rgba(212,175,55,0.18)';

type Issued = { token: string; ref_gp: string; prenom?: string | null };

export default function GpLoginPage() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [copied, setCopied] = useState(false);

  const link = issued ? `${window.location.origin}/gp/auth?token=${issued.token}` : '';
  const waCode = issued ? `CODE GP${issued.ref_gp}` : '';
  const waUrl = `https://wa.me/${YOBBANTE_GP_WHATSAPP}?text=${encodeURIComponent(waCode)}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setNotFound(false);
    setIssued(null);
    setLoading(true);
    try {
      const fullPhone = `+221${phone.replace(/\D/g, '')}`;
      const { data, error } = await supabase.rpc('gp_request_auth' as any, { p_phone: fullPhone });
      if (error) throw error;
      const r = data as any;
      if (!r?.found) {
        setNotFound(true);
        return;
      }
      setIssued({ token: r.token, ref_gp: r.ref_gp, prenom: r.prenom });
    } catch (err: any) {
      toast.error(err?.message || 'Erreur, réessayez');
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success('Lien copié');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Impossible de copier');
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: BG, color: 'white' }}>
      <header className="border-b" style={{ borderColor: BORDER }}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/"><img src={logoYobbante} alt="Yobbanté logo" className="h-7" /></Link>
          <div className="text-xs" style={{ color: GOLD }}>Espace GP</div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl p-6 sm:p-8 space-y-6"
             style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold">Connexion GP</h1>
            <p className="text-sm text-white/60">Entrez votre numéro de téléphone</p>
          </div>

          {!issued && (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="text-xs text-white/70 mb-1 block">Numéro WhatsApp</label>
                <div className="flex gap-2">
                  <div className="flex items-center px-3 rounded-md border text-sm"
                       style={{ borderColor: BORDER, background: BG }}>
                    🇸🇳 +221
                  </div>
                  <Input
                    type="tel"
                    inputMode="numeric"
                    placeholder="77 123 45 67"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className="flex-1"
                    style={{ background: BG, borderColor: BORDER, color: 'white' }}
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading || phone.replace(/\D/g, '').length < 9}
                className="w-full font-semibold"
                style={{ background: GOLD, color: BG }}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Se connecter <ArrowRight className="w-4 h-4 ml-1" /></>}
              </Button>

              {notFound && (
                <div className="text-center text-sm space-y-2 pt-2">
                  <div className="text-red-300">Numéro non reconnu.</div>
                  <Link to="/rejoindre-konnekt" className="underline" style={{ color: GOLD }}>
                    Rejoindre Konnekt
                  </Link>
                  <div className="text-white/60 text-xs">
                    Ou contactez : <a href={`tel:+${YOBBANTE_GP_WHATSAPP}`} className="underline">{YOBBANTE_GP_WHATSAPP_DISPLAY}</a>
                  </div>
                </div>
              )}
            </form>
          )}

          {issued && (
            <div className="space-y-4">
              <div className="text-center text-sm text-white/70">
                Bonjour {issued.prenom ?? ''} — choisissez votre méthode :
              </div>

              {/* Option 1 — Magic link */}
              <div className="rounded-xl p-4 space-y-3" style={{ background: BG, border: `1px solid ${BORDER}` }}>
                <div className="font-semibold" style={{ color: GOLD }}>Accès instantané</div>
                <Button
                  type="button"
                  onClick={copyLink}
                  className="w-full font-semibold"
                  style={{ background: GOLD, color: BG }}
                >
                  {copied ? <><Check className="w-4 h-4 mr-1" /> Lien copié</> : <><Copy className="w-4 h-4 mr-1" /> Copier mon lien d'accès</>}
                </Button>
                <div className="text-xs text-white/60">
                  Ouvrez ce lien depuis n'importe quel appareil. Valable 15 minutes.
                </div>
                <a href={link} className="block text-center text-xs underline truncate" style={{ color: GOLD }}>
                  Ou ouvrir directement
                </a>
              </div>

              {/* Option 2 — WhatsApp */}
              <div className="rounded-xl p-4 space-y-3" style={{ background: BG, border: `1px solid ${BORDER}` }}>
                <div className="font-semibold text-white/90">Recevoir un code par WhatsApp</div>
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full rounded-md py-2.5 font-semibold text-white"
                  style={{ background: '#25D366' }}
                >
                  <MessageCircle className="w-4 h-4" /> Envoyer {waCode}
                </a>
                <div className="text-xs text-white/60">
                  Uniquement si vous avez déjà échangé avec Konnekt sur WhatsApp.
                </div>
              </div>

              <button
                type="button"
                onClick={() => { setIssued(null); setPhone(''); }}
                className="w-full text-xs text-white/50 hover:text-white/80 underline"
              >
                Utiliser un autre numéro
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
