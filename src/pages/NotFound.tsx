import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div
        className="text-center mx-auto"
        style={{ padding: '80px 24px', maxWidth: 480 }}
      >
        <div
          style={{
            fontSize: 48,
            fontWeight: 500,
            letterSpacing: '-0.02em',
            color: 'hsl(var(--text-tertiary))',
            lineHeight: 1,
            marginBottom: 12,
          }}
        >
          404
        </div>
        <h2 className="mb-2">Page introuvable</h2>
        <p className="text-[14px] mb-6" style={{ color: 'hsl(var(--muted-foreground))' }}>
          La page que vous recherchez n'existe pas ou a été déplacée.
        </p>
        <Link to="/" className="btn-cta inline-flex">
          Retour à l'accueil
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
