// Yobbanté Business — isolated styling tokens for upgrade nudges.
// Kept inline (not in tailwind config) to avoid touching the global design system.

export const UPGRADE_COLORS = {
  yellow: '#F5C518',
  bg: 'rgba(245,197,24,0.06)',
  border: 'rgba(245,197,24,0.20)',
  text: '#AAAAAA',
  textStrong: '#FFFFFF',
  muted: '#555555',
  panel: '#161616',
  panelBorder: '#1E1E1E',
  cardActiveBg: 'rgba(245,197,24,0.08)',
} as const;

export const NUDGE_STYLE: React.CSSProperties = {
  background: UPGRADE_COLORS.bg,
  border: `1px solid ${UPGRADE_COLORS.border}`,
  borderRadius: 10,
  padding: '12px 14px',
  position: 'relative',
};

export const MONO_FONT =
  'ui-monospace, SFMono-Regular, "DM Mono", "JetBrains Mono", Menlo, monospace';
