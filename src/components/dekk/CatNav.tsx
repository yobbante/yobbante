import React from 'react';

export const CAT_PILLS = [
  { key: 'all', label: 'Tout' },
  { key: 'merch-identite', label: 'Merch & identité' },
  { key: 'voyage-mobilite', label: 'Voyage & mobilité' },
  { key: 'tech-productivite', label: 'Tech & productivité' },
  { key: 'guides-outils-digitaux', label: 'Guides & outils digitaux' },
  { key: 'packs-cadeaux', label: 'Packs cadeaux' },
  { key: 'equipement-pro', label: 'Équipement pro' },
  { key: 'cachettes', label: 'Cachettes' },
  { key: 'gaming', label: 'Gaming' },
  { key: 'rc-gadgets', label: 'RC & Gadgets' },
  { key: 'lifestyle-deco', label: 'Lifestyle & Déco' },
  { key: 'bien-etre', label: 'Bien-être' },
] as const;

export type CatKey = (typeof CAT_PILLS)[number]['key'];

export interface CatNavProps {
  active: CatKey;
  onChange: (key: CatKey) => void;
}

export function CatNav({ active, onChange }: CatNavProps) {
  return (
    <div
      style={{
        borderBottom: '0.5px solid hsl(var(--color-border-tertiary))',
        padding: '14px 0',
        position: 'sticky',
        top: 90,
        zIndex: 30,
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div
        className="catnav-scroll max-w-6xl mx-auto px-4 md:px-6"
        style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {CAT_PILLS.map((pill) => {
          const isActive = pill.key === active;
          return (
            <button
              key={pill.key}
              type="button"
              onClick={() => onChange(pill.key)}
              className="catnav-scroll"
              style={{
                flex: '0 0 auto',
                padding: '5px 12px',
                borderRadius: 99,
                border: isActive
                  ? '0.5px solid #C97B3A'
                  : '0.5px solid hsl(var(--color-border-tertiary))',
                fontSize: 12,
                fontWeight: 500,
                color: isActive ? '#fff' : 'hsl(var(--text-tertiary))',
                background: isActive ? '#C97B3A' : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", system-ui, sans-serif',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = '#C97B3A';
                  e.currentTarget.style.color = '#C97B3A';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = 'hsl(var(--color-border-tertiary))';
                  e.currentTarget.style.color = 'hsl(var(--text-tertiary))';
                }
              }}
            >
              {pill.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
