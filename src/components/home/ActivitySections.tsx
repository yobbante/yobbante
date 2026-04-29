import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useShipments } from '@/hooks/useShipments';
import { useDossiers } from '@/hooks/useDossiers';
import { COUNTRY_FLAGS } from '@/lib/types';

/* ────────────────────────────────────────────────────────────────────
 * Tokens — from spec (kept inline as raw values per design contract).
 * ──────────────────────────────────────────────────────────────────── */
const C = {
  bg:        '#111111',
  border:    '#1E1E1E',
  text:      '#FFFFFF',
  meta:      '#555555',
  accent:    '#F5C518',
} as const;

/* ── Badge system ────────────────────────────────────────────────── */
type BadgeKind =
  | 'soumis' | 'en_cours' | 'matched' | 'livre'
  | 'on_hold' | 'annule' | 'analyse_ia';

const BADGES: Record<BadgeKind, { label: string; bg: string; fg: string; bd: string }> = {
  soumis:     { label: 'Soumis',     bg: 'rgba(59,130,246,0.12)', fg: '#3B82F6', bd: 'rgba(59,130,246,0.25)' },
  en_cours:   { label: 'En cours',   bg: 'rgba(245,158,11,0.10)', fg: '#F59E0B', bd: 'rgba(245,158,11,0.25)' },
  matched:    { label: 'Matched',    bg: 'rgba(34,197,94,0.10)',  fg: '#22C55E', bd: 'rgba(34,197,94,0.25)'  },
  livre:      { label: 'Livré',      bg: 'rgba(34,197,94,0.10)',  fg: '#22C55E', bd: 'rgba(34,197,94,0.25)'  },
  on_hold:    { label: 'On Hold',    bg: 'rgba(245,158,11,0.10)', fg: '#F59E0B', bd: 'rgba(245,158,11,0.25)' },
  annule:     { label: 'Annulé',     bg: 'rgba(239,68,68,0.10)',  fg: '#EF4444', bd: 'rgba(239,68,68,0.25)'  },
  analyse_ia: { label: 'Analyse IA', bg: 'rgba(245,197,24,0.08)', fg: '#F5C518', bd: 'rgba(245,197,24,0.20)' },
};

function Badge({ kind }: { kind: BadgeKind }) {
  const b = BADGES[kind];
  return (
    <span
      className="font-mono uppercase"
      style={{
        fontSize: 10, letterSpacing: '0.06em',
        padding: '3px 8px', borderRadius: 20,
        background: b.bg, color: b.fg, border: `0.5px solid ${b.bd}`,
        whiteSpace: 'nowrap',
      }}
    >
      {b.label}
    </span>
  );
}

/* ── Status mappers ──────────────────────────────────────────────── */
function shipmentBadge(s: string): BadgeKind {
  switch (s) {
    case 'PENDING':           return 'soumis';
    case 'CONFIRMED':
    case 'WAITING_FOR_MATCH': return 'soumis';
    case 'MATCHED':           return 'matched';
    case 'IN_PREPARATION':
    case 'IN_TRANSIT':
    case 'CUSTOMS':
    case 'ARRIVED':
    case 'OUT_FOR_DELIVERY':  return 'en_cours';
    case 'DELIVERED':         return 'livre';
    case 'ON_HOLD':           return 'on_hold';
    case 'CANCELLED':         return 'annule';
    default:                  return 'en_cours';
  }
}
function dossierBadge(s: string): BadgeKind {
  switch (s) {
    case 'SUBMITTED':                 return 'soumis';
    case 'UNDER_REVIEW':
    case 'QUOTED':                    return 'analyse_ia';
    case 'IN_PROGRESS':
    case 'SOURCING':
    case 'CONFIRMED':
    case 'IN_TRANSIT':                return 'en_cours';
    case 'DELIVERED':                 return 'livre';
    case 'CANCELLED':                 return 'annule';
    default:                          return 'en_cours';
  }
}
function receptionBadge(s: string): BadgeKind {
  switch (s) {
    case 'pending_arrival': return 'soumis';
    case 'received':
    case 'inspected':
    case 'shipped':         return 'en_cours';
    case 'delivered':       return 'livre';
    case 'cancelled':       return 'annule';
    default:                return 'en_cours';
  }
}

/* ── Reference formatters ────────────────────────────────────────── */
function fmtExpRef(tracking: string | null | undefined, id: string): string {
  if (tracking?.startsWith('YOB-')) {
    // YOB-2026-00042 → YBT-EXP-2026-0042
    return tracking.replace(/^YOB-/, 'YBT-EXP-');
  }
  const yr = new Date().getFullYear();
  return `YBT-EXP-${yr}-${id.slice(0, 4).toUpperCase()}`;
}
function fmtRecvRef(reference: string | null | undefined, id: string): string {
  if (reference?.startsWith('YOB-REC-')) {
    return reference.replace(/^YOB-REC-/, 'YBT-RECV-');
  }
  if (reference?.startsWith('YBT-')) return reference.replace('YBT-', 'YBT-RECV-');
  const yr = new Date().getFullYear();
  return `YBT-RECV-${yr}-${id.slice(0, 4).toUpperCase()}`;
}
function fmtSrcRef(reference: string): string {
  // reference is "YBT-2026-XXXX" → "YBT-SRC-2026-XXXX"
  if (reference.startsWith('YBT-SRC-')) return reference;
  return reference.replace(/^YBT-/, 'YBT-SRC-');
}

function fmtEta(d: string | null | undefined): string | null {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return null; }
}

/* ────────────────────────────────────────────────────────────────────
 * Reusable shell
 * ──────────────────────────────────────────────────────────────────── */
function SectionHeader({
  icon, title, onSeeAll,
}: { icon: string; title: string; onSeeAll: () => void }) {
  return (
    <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
      <h3 className="m-0" style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
        <span style={{ marginRight: 6 }}>{icon}</span>{title}
      </h3>
      <button
        type="button"
        onClick={onSeeAll}
        className="font-mono hover:opacity-80 transition-opacity"
        style={{ fontSize: 11, color: C.accent, background: 'transparent', border: 0, cursor: 'pointer' }}
      >
        Tout voir →
      </button>
    </div>
  );
}

function EmptyRow() {
  return (
    <p
      className="font-mono italic text-center"
      style={{ fontSize: 12, color: C.meta, padding: '24px 0', margin: 0 }}
    >
      Aucun élément pour l'instant
    </p>
  );
}

function CardShell({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left transition-colors hover:border-foreground/30"
      style={{
        background: C.bg,
        border: `0.5px solid ${C.border}`,
        borderRadius: 12,
        padding: '14px 16px',
        marginBottom: 8,
        display: 'block',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {children}
    </button>
  );
}

const RowMeta: React.CSSProperties = {
  borderTop: `0.5px solid ${C.border}`,
  paddingTop: 8,
  marginTop: 10,
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: 12,
};

/* ────────────────────────────────────────────────────────────────────
 * SECTION 1 — Mes envois
 * ──────────────────────────────────────────────────────────────────── */
function MesEnvois({ goAll }: { goAll: () => void }) {
  const navigate = useNavigate();
  const { shipments } = useShipments();
  const items = shipments.slice(0, 2);

  return (
    <section style={{ marginBottom: 28 }}>
      <SectionHeader icon="📦" title="Mes envois" onSeeAll={goAll} />
      {items.length === 0 ? <EmptyRow /> : items.map(s => {
        const originFlag = COUNTRY_FLAGS[s.origin_country as keyof typeof COUNTRY_FLAGS] ?? '🌍';
        const destFlag   = COUNTRY_FLAGS[s.destination_country as keyof typeof COUNTRY_FLAGS] ?? '🌍';
        const eta = fmtEta(s.eta);
        return (
          <CardShell key={s.id} onClick={() => navigate('/expedier')}>
            {/* ROW 1 */}
            <div className="flex items-center justify-between gap-2">
              <span
                className="font-mono"
                style={{ fontSize: 11, color: C.accent, letterSpacing: '0.06em' }}
              >
                {fmtExpRef(s.tracking_number, s.id)}
              </span>
              <Badge kind={shipmentBadge(s.status as string)} />
            </div>
            {/* ROW 2 */}
            <p className="m-0" style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: C.text }}>
              {(s as any).client_note?.trim() || `Envoi · ${s.weight_kg ?? '?'} kg`}
            </p>
            {/* ROW 3 */}
            <div style={RowMeta}>
              <span className="font-mono" style={{ fontSize: 11, color: C.meta }}>
                {originFlag} → {destFlag} {s.destination_country}
              </span>
              <div className="text-right">
                <div className="font-mono" style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                  {s.total_cost != null ? `${Math.round(s.total_cost)} €` : '—'}
                </div>
                {eta && (
                  <div className="font-mono" style={{ fontSize: 10, color: C.meta, marginTop: 2 }}>
                    ETA {eta}
                  </div>
                )}
              </div>
            </div>
          </CardShell>
        );
      })}
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────
 * SECTION 2 — Mes réceptions
 * ──────────────────────────────────────────────────────────────────── */
type Reception = {
  id: string;
  reference: string;
  status: string;
  merchant_name: string;
  order_description: string;
  carrier_tracking?: string | null;
  eta?: string | null;
};

function MesReceptions({ goAll }: { goAll: () => void }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<Reception[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from('reception_orders')
        .select('id, reference, status, merchant_name, order_description, internal_note, created_at')
        .order('created_at', { ascending: false })
        .limit(2);
      if (!mounted || !data) return;
      setItems(data.map((r: any) => ({
        id: r.id,
        reference: r.reference,
        status: r.status,
        merchant_name: r.merchant_name,
        order_description: r.order_description,
        carrier_tracking: r.internal_note ?? null,
        eta: null,
      })));
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <section style={{ marginBottom: 28 }}>
      <SectionHeader icon="📬" title="Mes réceptions" onSeeAll={goAll} />
      {items.length === 0 ? <EmptyRow /> : items.map(r => {
        const eta = fmtEta(r.eta);
        return (
          <CardShell key={r.id} onClick={() => navigate('/expedier/recevoir')}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono" style={{ fontSize: 11, color: C.accent, letterSpacing: '0.06em' }}>
                {fmtRecvRef(r.reference, r.id)}
              </span>
              <Badge kind={receptionBadge(r.status)} />
            </div>
            <p className="m-0" style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: C.text }}>
              {r.merchant_name} · {r.order_description}
            </p>
            <div style={RowMeta}>
              <span className="font-mono" style={{ fontSize: 11, color: C.meta }}>
                {r.carrier_tracking ?? 'Tracking en attente'}
              </span>
              <span className="font-mono" style={{ fontSize: 11, color: C.meta }}>
                {eta ? `ETA ${eta}` : '—'}
              </span>
            </div>
          </CardShell>
        );
      })}
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────
 * SECTION 3 — Mes dossiers sourcing
 * ──────────────────────────────────────────────────────────────────── */
function MesDossiersSourcing({ goAll }: { goAll: () => void }) {
  const navigate = useNavigate();
  const { dossiers } = useDossiers();
  const sourcing = dossiers.filter(d => d.needs_sourcing).slice(0, 2);

  return (
    <section style={{ marginBottom: 28 }}>
      <SectionHeader icon="🔍" title="Mes dossiers sourcing" onSeeAll={goAll} />
      {sourcing.length === 0 ? <EmptyRow /> : sourcing.map(d => {
        const profileTag = (d.notes ?? '').includes('Revente') ? 'Commerçant'
          : (d.notes ?? '').includes('personnel') ? 'Particulier' : '—';
        const cost = d.estimated_cost ?? d.budget_eur ?? null;
        const fcfa = cost != null ? Math.round(cost * 655.957).toLocaleString('fr-FR') + ' FCFA' : '—';
        return (
          <CardShell key={d.id} onClick={() => navigate('/acheter/sourcing')}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono" style={{ fontSize: 11, color: C.accent, letterSpacing: '0.06em' }}>
                {fmtSrcRef(d.reference)}
              </span>
              <Badge kind={dossierBadge(d.status as string)} />
            </div>
            <p className="m-0" style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: C.text }}>
              {d.product_description}
            </p>
            <p
              className="font-mono m-0"
              style={{ marginTop: 4, fontSize: 11, color: C.meta }}
            >
              {d.origin_country} · {profileTag}
            </p>
            <div style={RowMeta}>
              <span className="font-mono" style={{ fontSize: 11, color: C.meta }}>
                ✈️ Aérien · 3-7j
              </span>
              <span className="font-mono" style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                {fcfa}
              </span>
            </div>
          </CardShell>
        );
      })}
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────
 * Public component
 * ──────────────────────────────────────────────────────────────────── */
export function ActivitySections({
  onNavigateOrders,
}: {
  onNavigateOrders?: (kind?: 'sourcing' | 'receive' | 'send') => void;
}) {
  return (
    <div>
      <MesEnvois        goAll={() => onNavigateOrders?.('send')} />
      <MesReceptions    goAll={() => onNavigateOrders?.('receive')} />
      <MesDossiersSourcing goAll={() => onNavigateOrders?.('sourcing')} />
    </div>
  );
}
