import { forwardRef } from 'react';
import type { ManualDeparture } from '@/hooks/useManualDepartures';

const MODE_LABEL: Record<string, string> = {
  air: 'Air',
  sea_lcl: 'Mer',
  road: 'Route',
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

interface Props {
  departures: ManualDeparture[];
  format: 'square' | 'story';
}

export const WeekExportTemplate = forwardRef<HTMLDivElement, Props>(({ departures, format }, ref) => {
  const width = 1080;
  const height = format === 'story' ? 1920 : 1080;
  const sorted = [...departures].sort((a, b) => a.departure_date.localeCompare(b.departure_date));

  return (
    <div
      ref={ref}
      style={{
        width,
        height,
        background: 'linear-gradient(160deg, #0A0E1A 0%, #111827 100%)',
        color: '#fff',
        padding: format === 'story' ? '120px 80px' : '80px',
        fontFamily: 'Inter, system-ui, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 60 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: '#F5C518',
              color: '#0A0E1A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: 32,
            }}
          >
            Y
          </div>
          <div>
            <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: -0.5 }}>YOBBANTÉ</div>
            <div style={{ fontSize: 18, opacity: 0.6 }}>Logistique Afrique ↔ Monde</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, opacity: 0.6 }}>Prochains</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#F5C518' }}>Départs</div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {sorted.slice(0, format === 'story' ? 12 : 7).map((d) => (
          <div
            key={d.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '24px 32px',
              borderRadius: 20,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
              <div
                style={{
                  minWidth: 110,
                  fontSize: 22,
                  fontWeight: 700,
                  color: '#F5C518',
                  textTransform: 'uppercase',
                }}
              >
                {fmtDate(d.departure_date)}
              </div>
              <div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>
                  {d.origin_city} → {d.destination_city}
                </div>
                <div style={{ fontSize: 16, opacity: 0.6, marginTop: 4 }}>
                  {MODE_LABEL[d.transport_mode] ?? d.transport_mode}
                  {d.carrier_name ? ` · ${d.carrier_name}` : ''}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, opacity: 0.5, letterSpacing: 2 }}>RÉF</div>
              <div style={{ fontSize: 36, fontWeight: 900, fontFamily: 'monospace', color: '#F5C518' }}>
                #{d.short_ref ?? '----'}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 60,
          paddingTop: 30,
          borderTop: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ fontSize: 20 }}>
          <div style={{ opacity: 0.6, fontSize: 14 }}>Réservez via WhatsApp</div>
          <div style={{ fontWeight: 700, fontSize: 26, color: '#F5C518' }}>+221 78 122 18 91</div>
        </div>
        <div style={{ fontSize: 18, opacity: 0.7 }}>yobbante.com</div>
      </div>
    </div>
  );
});
WeekExportTemplate.displayName = 'WeekExportTemplate';
