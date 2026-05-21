import { Link } from 'react-router-dom';

/**
 * Footer Boutique Dëkk — sobre, branding Dëkk + mention "Powered by Yobbanté".
 * Mutualise les pages légales du groupe.
 */
export function DekkFooter() {
  return (
    <footer
      style={{
        background: '#0A0A0A',
        color: 'rgba(255,255,255,0.72)',
        padding: '32px 16px 80px',
        fontFamily: '"DM Sans", system-ui, sans-serif',
        fontSize: 13,
        marginTop: 48,
      }}
    >
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'grid', gap: 24 }}>
        <div>
          <div style={{ fontFamily: '"Playfair Display", serif', fontSize: 22, color: '#fff', letterSpacing: '0.04em' }}>
            Dëkk
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
            Mode & lifestyle, livré par Yobbanté.
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, fontSize: 12 }}>
          <Link to="/boutique" style={{ color: 'rgba(255,255,255,0.72)', textDecoration: 'none' }}>Catalogue</Link>
          <Link to="/panier" style={{ color: 'rgba(255,255,255,0.72)', textDecoration: 'none' }}>Panier</Link>
          <Link to="/mon-compte" style={{ color: 'rgba(255,255,255,0.72)', textDecoration: 'none' }}>Mon compte</Link>
          <Link to="/suivre" style={{ color: 'rgba(255,255,255,0.72)', textDecoration: 'none' }}>Suivre un colis</Link>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
          <Link to="/cgv" style={{ color: 'inherit', textDecoration: 'none' }}>CGV</Link>
          <Link to="/cgu" style={{ color: 'inherit', textDecoration: 'none' }}>CGU</Link>
          <Link to="/confidentialite" style={{ color: 'inherit', textDecoration: 'none' }}>Confidentialité</Link>
          <Link to="/cookies" style={{ color: 'inherit', textDecoration: 'none' }}>Cookies</Link>
          <Link to="/mentions-legales" style={{ color: 'inherit', textDecoration: 'none' }}>Mentions légales</Link>
        </div>

        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.08)',
            paddingTop: 14,
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
            fontSize: 11,
            color: 'rgba(255,255,255,0.4)',
          }}
        >
          <span>© {new Date().getFullYear()} Dëkk</span>
          <a
            href="https://yobbante.com"
            target="_blank"
            rel="noreferrer"
            style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}
          >
            Powered by Yobbanté →
          </a>
        </div>
      </div>
    </footer>
  );
}
