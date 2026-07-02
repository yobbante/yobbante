/**
 * EntityLink — cross-linking primitives for the admin.
 *
 * Every reference to a GP, dossier, client or départ across the admin
 * should render through one of these components so it becomes a clickable
 * jump to that entity's detail view. Public site pages must NOT import
 * from here.
 *
 * Behaviour :
 *  - GpLink        → /admin/terrain?tab=gp&gp=<ref>          (highlight)
 *  - DossierLink   → /admin/dossiers?dossier=<id>            (opens sheet)
 *  - ClientLink    → /admin/clients?q=<phone|name>           (filter)
 *  - DepartureLink → /admin/departs?tab=liste&departure=<id> (highlight)
 *
 * If the target `id`/`ref` is missing, the link degrades to plain text so
 * we never break on incomplete data.
 */
import { forwardRef, MouseEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

const BASE =
  'inline text-primary hover:underline underline-offset-2 font-medium cursor-pointer bg-transparent border-0 p-0 m-0 text-inherit';

interface CommonProps {
  children?: ReactNode;
  className?: string;
  title?: string;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  /** When true, keeps default sizing/weight from parent (useful in tables). */
  plain?: boolean;
}

function useJump() {
  const navigate = useNavigate();
  return (to: string, e?: MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    navigate(to);
  };
}

/* ---------------- Dossier ---------------- */
interface DossierLinkProps extends CommonProps {
  /** Dossier UUID (preferred). */
  id?: string | null;
  /** Fallback : tracking id / reference — shown as label if no children. */
  reference?: string | null;
}
export const DossierLink = forwardRef<HTMLButtonElement, DossierLinkProps>(
  ({ id, reference, children, className, plain, onClick, title }, ref) => {
    const jump = useJump();
    const label = children ?? reference ?? '—';
    if (!id) return <span className={className}>{label}</span>;
    return (
      <button
        ref={ref}
        type="button"
        title={title || `Ouvrir dossier ${reference ?? ''}`.trim()}
        onClick={(e) => {
          onClick?.(e);
          jump(`/admin/dossiers?dossier=${encodeURIComponent(id)}`, e);
        }}
        className={cn(plain ? 'text-primary hover:underline underline-offset-2 cursor-pointer bg-transparent border-0 p-0 m-0 text-inherit' : BASE, className)}
      >
        {label}
      </button>
    );
  },
);
DossierLink.displayName = 'DossierLink';

/* ---------------- GP / Transporteur ---------------- */
interface GpLinkProps extends CommonProps {
  reference?: string | null;
}
export const GpLink = forwardRef<HTMLButtonElement, GpLinkProps>(
  ({ reference, children, className, plain, onClick, title }, ref) => {
    const jump = useJump();
    const label = children ?? (reference ? `GP ${reference}` : '—');
    if (!reference) return <span className={className}>{label}</span>;
    return (
      <button
        ref={ref}
        type="button"
        title={title || `Ouvrir fiche GP ${reference}`}
        onClick={(e) => {
          onClick?.(e);
          jump(`/admin/terrain?tab=gp&gp=${encodeURIComponent(reference)}`, e);
        }}
        className={cn(plain ? 'text-primary hover:underline underline-offset-2 cursor-pointer bg-transparent border-0 p-0 m-0 text-inherit' : BASE, className)}
      >
        {label}
      </button>
    );
  },
);
GpLink.displayName = 'GpLink';

/* ---------------- Client ---------------- */
interface ClientLinkProps extends CommonProps {
  phone?: string | null;
  name?: string | null;
}
export const ClientLink = forwardRef<HTMLButtonElement, ClientLinkProps>(
  ({ phone, name, children, className, plain, onClick, title }, ref) => {
    const jump = useJump();
    const query = (phone || name || '').trim();
    const label = children ?? name ?? phone ?? '—';
    if (!query) return <span className={className}>{label}</span>;
    return (
      <button
        ref={ref}
        type="button"
        title={title || `Voir client ${name || phone || ''}`.trim()}
        onClick={(e) => {
          onClick?.(e);
          jump(`/admin/clients?q=${encodeURIComponent(query)}`, e);
        }}
        className={cn(plain ? 'text-primary hover:underline underline-offset-2 cursor-pointer bg-transparent border-0 p-0 m-0 text-inherit' : BASE, className)}
      >
        {label}
      </button>
    );
  },
);
ClientLink.displayName = 'ClientLink';

/* ---------------- Départ ---------------- */
interface DepartureLinkProps extends CommonProps {
  id?: string | null;
  reference?: string | null; // e.g. "#1234"
}
export const DepartureLink = forwardRef<HTMLButtonElement, DepartureLinkProps>(
  ({ id, reference, children, className, plain, onClick, title }, ref) => {
    const jump = useJump();
    const label = children ?? reference ?? (id ? `#${id.slice(0, 6)}` : '—');
    if (!id) return <span className={className}>{label}</span>;
    return (
      <button
        ref={ref}
        type="button"
        title={title || `Ouvrir départ ${reference ?? ''}`.trim()}
        onClick={(e) => {
          onClick?.(e);
          jump(`/admin/departs?tab=liste&departure=${encodeURIComponent(id)}`, e);
        }}
        className={cn(plain ? 'text-primary hover:underline underline-offset-2 cursor-pointer bg-transparent border-0 p-0 m-0 text-inherit' : BASE, className)}
      >
        {label}
      </button>
    );
  },
);
DepartureLink.displayName = 'DepartureLink';
