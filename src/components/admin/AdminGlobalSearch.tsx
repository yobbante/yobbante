import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ArrowRight } from 'lucide-react';
import type { AdminSection } from './AdminSidebar';

type Item = {
  id: string;
  label: string;
  hint?: string;
  section: AdminSection;
  query?: string; // optional search-param payload
  keywords?: string;
};

const SECTION_ITEMS: Item[] = [
  { id: 'overview',      label: 'Vue globale',              section: 'overview', keywords: 'accueil home stats dashboard' },
  { id: 'dossiers',      label: 'Dossiers',                 section: 'dossiers', keywords: 'demandes devis quote inbox shipments orders reception sourcing' },
  { id: 'departs',       label: 'Départs',                  section: 'departs',  keywords: 'depart vol semaine konnekt manuel' },
  { id: 'terrain',       label: 'Équipe terrain',           section: 'terrain',  keywords: 'gp transporteur livreur operations base' },
  { id: 'clients',       label: 'Clients',                  section: 'clients',  keywords: 'crm utilisateur user' },
  { id: 'messages',      label: 'Messages WhatsApp',        section: 'messages', keywords: 'whatsapp chat conversation' },
  { id: 'leads',         label: 'Leads & devis',            section: 'leads',    keywords: 'devis quote particulier entreprise b2b' },
  { id: 'revenus',       label: 'Revenus',                  section: 'revenus',  keywords: 'finance ca chiffre affaire paiement' },
  { id: 'finances',      label: 'Paiements GP',             section: 'finances', keywords: 'gp wallet payout' },
  { id: 'boutique',      label: 'Boutique Dëkk',            section: 'boutique', keywords: 'shop produit catalog commande' },
  { id: 'hubs',          label: 'Hubs & Konnekt',           section: 'hubs',     keywords: 'reseau ville port transport tracking' },
  { id: 'settings',      label: 'Paramètres',               section: 'settings', keywords: 'config admin role' },
];

const ACTIONS: Item[] = [
  { id: 'a-new-product',   label: 'Nouveau produit Dëkk',         hint: 'Action', section: 'boutique', keywords: 'creer add ajouter' },
  { id: 'a-orders',        label: 'Voir les commandes Dëkk',      hint: 'Action', section: 'boutique', keywords: 'order livraison' },
  { id: 'a-import-gp',     label: 'Importer une base GP (Excel)', hint: 'Action', section: 'terrain',  keywords: 'import xlsx' },
  { id: 'a-blast',         label: 'Inviter les GP sur Konnekt',   hint: 'Action', section: 'terrain',  keywords: 'whatsapp invitation' },
  { id: 'a-departure',     label: 'Créer un départ manuel',       hint: 'Action', section: 'departs',  keywords: 'vol bateau' },
  { id: 'a-pending-quotes',label: 'Devis en attente',             hint: 'Action', section: 'dossiers', keywords: 'pending nouveau' },
];

const ALL = [...SECTION_ITEMS, ...ACTIONS];

export function AdminGlobalSearch({ onJump, isAdmin }: {
  onJump: (s: AdminSection) => void;
  isAdmin: boolean;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd/Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const results = useMemo(() => {
    const items = ALL.filter(i => i.id !== 'transporteurs' || isAdmin);
    if (!q.trim()) return items.slice(0, 8);
    const needle = q.toLowerCase();
    return items
      .map(i => {
        const hay = `${i.label} ${i.keywords ?? ''}`.toLowerCase();
        const score = hay.includes(needle) ? (i.label.toLowerCase().startsWith(needle) ? 0 : 1) : 99;
        return { i, score };
      })
      .filter(x => x.score < 99)
      .sort((a, b) => a.score - b.score)
      .slice(0, 10)
      .map(x => x.i);
  }, [q, isAdmin]);

  const pick = (i: Item) => {
    onJump(i.section);
    setQ('');
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div className="px-2 pt-2 pb-1 relative">
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'hsl(var(--muted-foreground))' }} />
        <input
          ref={inputRef}
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); setActive(0); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
            else if (e.key === 'Enter' && results[active]) { pick(results[active]); }
          }}
          placeholder="Rechercher…"
          className="w-full pl-8 pr-10 py-1.5 text-[12.5px] outline-none rounded-md"
          style={{
            background: 'hsl(var(--background-secondary))',
            border: '0.5px solid hsl(var(--color-border-tertiary))',
            color: 'hsl(var(--foreground))',
          }}
        />
        <span
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] px-1 py-0.5 rounded"
          style={{ background: 'hsl(var(--background-primary))', color: 'hsl(var(--muted-foreground))', border: '0.5px solid hsl(var(--color-border-tertiary))', fontFamily: '"DM Mono", monospace' }}
        >
          ⌘K
        </span>
      </div>

      {open && results.length > 0 && (
        <div
          className="absolute left-2 right-2 mt-1 z-50 rounded-md overflow-hidden shadow-lg"
          style={{ background: 'hsl(var(--background-primary))', border: '0.5px solid hsl(var(--color-border-tertiary))' }}
        >
          {results.map((r, idx) => (
            <button
              key={r.id}
              onMouseDown={e => { e.preventDefault(); pick(r); }}
              onMouseEnter={() => setActive(idx)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-[12.5px]"
              style={{
                background: idx === active ? 'hsl(var(--secondary))' : 'transparent',
                color: 'hsl(var(--foreground))',
                borderTop: idx === 0 ? 'none' : '0.5px solid hsl(var(--color-border-tertiary))',
              }}
            >
              <span className="flex-1 truncate">{r.label}</span>
              {r.hint && (
                <span className="text-[9px] uppercase tracking-wider px-1 py-0.5 rounded" style={{ background: 'hsl(var(--background-secondary))', color: 'hsl(var(--muted-foreground))' }}>
                  {r.hint}
                </span>
              )}
              <ArrowRight className="w-3 h-3 opacity-50" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
