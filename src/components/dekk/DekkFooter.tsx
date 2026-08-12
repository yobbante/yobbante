import { Link } from 'react-router-dom';
import { Instagram, Facebook, MessageCircle } from 'lucide-react';
import { DEKK, SERIF, SANS, MONO } from './dekkTheme';
import { YOBBANTE_WHATSAPP } from '@/lib/contact';

const COLS: { title: string; links: { label: string; to: string; external?: boolean }[] }[] = [
  {
    title: 'Boutique',
    links: [
      { label: 'Tout le catalogue', to: '/boutique' },
      { label: 'Nouveautés', to: '/boutique?sort=new' },
      { label: 'Packs cadeaux', to: '/boutique?cat=packs-cadeaux' },
      { label: 'Mon panier', to: '/panier' },
    ],
  },
  {
    title: 'Aide',
    links: [
      { label: 'Suivre ma commande', to: '/suivre' },
      { label: 'Livraison & délais', to: '/cgv' },
      { label: 'Paiement sécurisé', to: '/cgv' },
      { label: 'Mon compte', to: '/mon-compte' },
    ],
  },
  {
    title: 'À propos',
    links: [
      { label: 'Dëkk by Yobbanté', to: '/boutique' },
      { label: 'CGV', to: '/cgv' },
      { label: 'Confidentialité', to: '/confidentialite' },
      { label: 'Mentions légales', to: '/mentions-legales' },
    ],
  },
];

/** Footer éditorial de la boutique Dëkk — crème, serif, or en accent. */
export function DekkFooter() {
  return (
    <footer style={{ background: DEKK.creamDeep, color: DEKK.ink, fontFamily: SANS, fontSize: 13, borderTop: `1px solid ${DEKK.line}` }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '56px 20px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 36 }}>
          <div>
            <div style={{ fontFamily: SERIF, fontSize: 26, letterSpacing: '0.28em' }}>DËKK</div>
            <p style={{ margin: '10px 0 0', fontSize: 12.5, color: DEKK.muted, maxWidth: 220, lineHeight: 1.6 }}>
              Le monde, livré ici. Une sélection choisie, importée et livrée par Yobbanté.
            </p>
            <div style={{ display: 'flex', gap: 14, marginTop: 18 }}>
              <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram" style={{ color: DEKK.ink }}>
                <Instagram size={17} />
              </a>
              <a href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook" style={{ color: DEKK.ink }}>
                <Facebook size={17} />
              </a>
              <a href={`https://wa.me/${YOBBANTE_WHATSAPP}`} target="_blank" rel="noreferrer" aria-label="WhatsApp" style={{ color: DEKK.ink }}>
                <MessageCircle size={17} />
              </a>
            </div>
          </div>

          {COLS.map((col) => (
            <div key={col.title}>
              <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: DEKK.muted, marginBottom: 14 }}>
                {col.title}
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 9 }}>
                {col.links.map((l) => (
                  <li key={l.label + l.to}>
                    <Link to={l.to} style={{ color: DEKK.ink, textDecoration: 'none', fontSize: 12.5 }}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: DEKK.muted, marginBottom: 14 }}>
              Contact
            </div>
            <a href={`https://wa.me/${YOBBANTE_WHATSAPP}`} target="_blank" rel="noreferrer"
              style={{ color: DEKK.ink, textDecoration: 'none', fontSize: 12.5, display: 'block' }}>
              WhatsApp · +221 78 607 80 80
            </a>
            <p style={{ margin: '10px 0 0', fontSize: 12, color: DEKK.muted, lineHeight: 1.6 }}>
              Dakar, Sénégal<br />Lun – Sam · 9h – 20h
            </p>
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${DEKK.line}`, marginTop: 40, paddingTop: 18, display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', fontSize: 11, color: DEKK.muted }}>
          <span>© {new Date().getFullYear()} Dëkk. Tous droits réservés.</span>
          <a href="https://yobbante.com" target="_blank" rel="noreferrer" style={{ color: DEKK.muted, textDecoration: 'none' }}>
            Powered by Yobbanté →
          </a>
        </div>
      </div>
    </footer>
  );
}
