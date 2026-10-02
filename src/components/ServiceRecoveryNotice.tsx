import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { whatsappLink } from '@/lib/contact';

const NOTICE_START = Date.parse('2026-10-02T00:00:00Z');
const NOTICE_END = Date.parse('2026-11-02T00:00:00Z');
const INTERNAL_PREFIXES = ['/admin', '/app', '/auth', '/gp/', '/partenaire/', '/chauffeur', '/recu/'];
const RECOVERY_MESSAGE =
  "Bonjour Yobbanté, j’ai envoyé un message ou une demande entre le 10 septembre et le 1er octobre 2026 et je souhaite la reprendre. Voici mon besoin : ";

function isPublicPath(pathname: string) {
  return !INTERNAL_PREFIXES.some((prefix) => pathname === prefix.replace(/\/$/, '') || pathname.startsWith(prefix));
}

export function ServiceRecoveryNotice() {
  const { pathname } = useLocation();
  const [expanded, setExpanded] = useState(true);
  const now = Date.now();
  const visible = now >= NOTICE_START && now < NOTICE_END && isPublicPath(pathname);

  useEffect(() => {
    document.documentElement.style.setProperty('--service-notice-height', visible ? (expanded ? '88px' : '38px') : '0px');
    return () => document.documentElement.style.setProperty('--service-notice-height', '0px');
  }, [expanded, visible]);

  if (!visible) return null;

  return (
    <aside
      aria-label="Information de service"
      className="fixed inset-x-0 top-0 z-[70] border-b border-warning/30 bg-warning-soft text-warning-soft-foreground"
    >
      {expanded ? (
        <div className="mx-auto flex min-h-[88px] max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold sm:text-[13px]">Service rétabli — vérifiez votre demande</p>
            <p className="mt-0.5 text-[11px] leading-4 opacity-85 sm:text-[12px]">
              Suite à des difficultés techniques du 10 septembre au 1er octobre, certains messages et demandes peuvent ne pas nous être parvenus. Nous vous présentons nos excuses. Si vous êtes concerné, renvoyez votre demande : notre équipe la traitera en priorité.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <a href={whatsappLink(RECOVERY_MESSAGE)} target="_blank" rel="noopener noreferrer">
                <MessageCircle aria-hidden="true" /> Renvoyer ma demande
              </a>
            </Button>
            <Button asChild size="sm" variant="outline" className="hidden md:inline-flex">
              <Link to="/demande-devis">Devis en ligne</Link>
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setExpanded(false)} aria-label="Réduire l’information">
              <ChevronUp aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="mx-auto flex h-[38px] max-w-6xl items-center gap-2 px-4 sm:px-6">
          <p className="min-w-0 flex-1 truncate text-[11px] font-medium sm:text-[12px]">
            Demande envoyée du 10 sept. au 1er oct. ? Merci de nous la renvoyer.
          </p>
          <a
            href={whatsappLink(RECOVERY_MESSAGE)}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-[11px] font-semibold underline underline-offset-2 sm:text-[12px]"
          >
            La renvoyer
          </a>
          <Button size="icon" variant="ghost" onClick={() => setExpanded(true)} aria-label="Afficher toute l’information">
            <ChevronDown aria-hidden="true" />
          </Button>
        </div>
      )}
    </aside>
  );
}