import { useEffect, useMemo, useRef, useState } from 'react';
import { geoEquirectangular, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { FeatureCollection, Geometry } from 'geojson';
import { ALL_CITIES } from '@/lib/worldCities';
import { ratePerKgForCorridor } from '@/lib/startingPrice';
import { useIsMobile } from '@/hooks/use-mobile';


/* ──────────────────────────────────────────────────────────────────────
   LandingWorldMap — D3 + TopoJSON world map for the landing page.
   - Dakar = special origin marker (white fill, gold ring, pulse, label)
   - 36 city markers (r=5, gold) with declustering offset
   - Click a city dot → fixed tooltip below the map with CTA
   - CTA prefills the hero quote form and scrolls there
   ────────────────────────────────────────────────────────────────────── */

type CityMarker = { city: string; country: string; flag: string; lat: number; lon: number };

const CITIES_36: CityMarker[] = [
  { city: 'Abidjan',     country: 'CI', flag: '🇨🇮', lat: 5.36,  lon: -4.0  },
  { city: 'Alméria',     country: 'ES', flag: '🇪🇸', lat: 36.84, lon: -2.46 },
  { city: 'Bamako',      country: 'ML', flag: '🇲🇱', lat: 12.65, lon: -8.0  },
  { city: 'Barcelone',   country: 'ES', flag: '🇪🇸', lat: 41.39, lon: 2.17  },
  { city: 'Berlin',      country: 'DE', flag: '🇩🇪', lat: 52.52, lon: 13.4  },
  { city: 'Beyrouth',    country: 'LB', flag: '🇱🇧', lat: 33.89, lon: 35.5  },
  { city: 'Bordeaux',    country: 'FR', flag: '🇫🇷', lat: 44.84, lon: -0.58 },
  { city: 'Brazzaville', country: 'CG', flag: '🇨🇬', lat: -4.27, lon: 15.28 },
  { city: 'Bruxelles',   country: 'BE', flag: '🇧🇪', lat: 50.85, lon: 4.35  },
  { city: 'Casablanca',  country: 'MA', flag: '🇲🇦', lat: 33.57, lon: -7.59 },
  { city: 'Conakry',     country: 'GN', flag: '🇬🇳', lat: 9.64,  lon: -13.58 },
  { city: 'Douala',      country: 'CM', flag: '🇨🇲', lat: 4.05,  lon: 9.77  },
  { city: 'Dubaï',       country: 'AE', flag: '🇦🇪', lat: 25.2,  lon: 55.27 },
  { city: 'Düsseldorf',  country: 'DE', flag: '🇩🇪', lat: 51.23, lon: 6.78  },
  { city: 'Gatineau',    country: 'CA', flag: '🇨🇦', lat: 45.48, lon: -75.7 },
  { city: 'Genève',      country: 'CH', flag: '🇨🇭', lat: 46.2,  lon: 6.14  },
  { city: 'Istanbul',    country: 'TR', flag: '🇹🇷', lat: 41.0,  lon: 28.97 },
  { city: 'Kinshasa',    country: 'CD', flag: '🇨🇩', lat: -4.33, lon: 15.31 },
  { city: 'Libreville',  country: 'GA', flag: '🇬🇦', lat: 0.42,  lon: 9.45  },
  { city: 'Lille',       country: 'FR', flag: '🇫🇷', lat: 50.63, lon: 3.06  },
  { city: 'Lyon',        country: 'FR', flag: '🇫🇷', lat: 45.76, lon: 4.84  },
  { city: 'Madrid',      country: 'ES', flag: '🇪🇸', lat: 40.42, lon: -3.7  },
  { city: 'Malabo',      country: 'GQ', flag: '🇬🇶', lat: 3.75,  lon: 8.78  },
  { city: 'Marseille',   country: 'FR', flag: '🇫🇷', lat: 43.3,  lon: 5.37  },
  { city: 'Milan',       country: 'IT', flag: '🇮🇹', lat: 45.46, lon: 9.19  },
  { city: 'Montpellier', country: 'FR', flag: '🇫🇷', lat: 43.61, lon: 3.88  },
  { city: 'Montréal',    country: 'CA', flag: '🇨🇦', lat: 45.5,  lon: -73.57 },
  { city: "N'Djamena",   country: 'TD', flag: '🇹🇩', lat: 12.13, lon: 15.05 },
  { city: 'New York',    country: 'US', flag: '🇺🇸', lat: 40.71, lon: -74.0 },
  { city: 'Nîmes',       country: 'FR', flag: '🇫🇷', lat: 43.84, lon: 4.36  },
  { city: 'Ottawa',      country: 'CA', flag: '🇨🇦', lat: 45.42, lon: -75.7 },
  { city: 'Paris',       country: 'FR', flag: '🇫🇷', lat: 48.85, lon: 2.35  },
  { city: 'Providence',  country: 'US', flag: '🇺🇸', lat: 41.82, lon: -71.4 },
  { city: 'Rennes',      country: 'FR', flag: '🇫🇷', lat: 48.11, lon: -1.68 },
  { city: 'Rouen',       country: 'FR', flag: '🇫🇷', lat: 49.44, lon: 1.1   },
  { city: 'Washington',  country: 'US', flag: '🇺🇸', lat: 38.9,  lon: -77.04 },
  { city: 'Yaoundé',     country: 'CM', flag: '🇨🇲', lat: 3.87,  lon: 11.52 },
];

const DAKAR: CityMarker = { city: 'Dakar', country: 'SN', flag: '🇸🇳', lat: 14.69, lon: -17.45 };

const TOPO_URL = 'https://unpkg.com/world-atlas@2.0.2/countries-110m.json';

let cachedLand: FeatureCollection<Geometry> | null = null;
let inflight: Promise<FeatureCollection<Geometry>> | null = null;

function loadLand(): Promise<FeatureCollection<Geometry>> {
  if (cachedLand) return Promise.resolve(cachedLand);
  if (inflight) return inflight;
  inflight = fetch(TOPO_URL)
    .then((r) => r.json())
    .then((topo: any) => {
      const land = feature(topo, topo.objects.countries) as unknown as FeatureCollection<Geometry>;
      cachedLand = land;
      return land;
    })
    .finally(() => { inflight = null; });
  return inflight;
}

/** Pull country label + canonical id from the worldCities catalog. */
function lookupCity(c: CityMarker) {
  const found = ALL_CITIES.find((x) => x.city === c.city && x.country === c.country);
  return {
    id: found?.id ?? `${c.country}-${c.city}`,
    countryLabel: found?.countryLabel ?? c.country,
  };
}

/** Simple iterative declustering: offsets overlapping points apart. */
function decluster(points: Array<{ x: number; y: number }>, minDist = 15, maxIter = 6) {
  const pts = points.map((p) => ({ ...p }));
  for (let iter = 0; iter < maxIter; iter++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[j].x - pts[i].x;
        const dy = pts[j].y - pts[i].y;
        const d = Math.hypot(dx, dy);
        if (d < minDist && d > 0.0001) {
          const push = (minDist - d) / 2 + 0.5;
          const nx = dx / d;
          const ny = dy / d;
          pts[i].x -= nx * push;
          pts[i].y -= ny * push;
          pts[j].x += nx * push;
          pts[j].y += ny * push;
          moved = true;
        } else if (d === 0) {
          pts[j].x += 4;
          pts[j].y += 4;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
  return pts;
}

type Selected = {
  city: string;
  country: string;
  countryLabel: string;
  flag: string;
};

export function LandingWorldMap({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(960);
  const [land, setLand] = useState<FeatureCollection<Geometry> | null>(cachedLand);
  const [selected, setSelected] = useState<Selected | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!wrapRef.current) return;
    const el = wrapRef.current;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? el.clientWidth;
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    setWidth(el.clientWidth || 960);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let alive = true;
    loadLand().then((l) => { if (alive) setLand(l); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // Allow external triggers (e.g. destination pills) to open the tooltip.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { cityId?: string } | undefined;
      if (!detail?.cityId) return;
      const found = ALL_CITIES.find((c) => c.id === detail.cityId);
      if (found) {
        setSelected({
          city: found.city,
          country: found.country,
          countryLabel: found.countryLabel,
          flag: found.flag,
        });
      }
    };
    window.addEventListener('yobbante:show-city-tooltip', handler as EventListener);
    return () => window.removeEventListener('yobbante:show-city-tooltip', handler as EventListener);
  }, []);

  const height = Math.round(width / 2);
  const projection = useMemo(
    () => geoEquirectangular().scale(width / (2 * Math.PI)).translate([width / 2, height / 2]),
    [width, height],
  );
  const pathGen = useMemo(() => geoPath(projection as any), [projection]);

  const dakarPt = useMemo(() => {
    const p = projection([DAKAR.lon, DAKAR.lat]);
    return p ? { x: p[0], y: p[1] } : null;
  }, [projection]);

  // Scale dot size / declustering to the viewport — mobile maps are tiny.
  const dotR = isMobile ? 2.5 : 5;
  const touchR = isMobile ? 14 : 20;
  const minDist = isMobile ? 7 : 15;

  const cityPoints = useMemo(() => {
    const raw = CITIES_36.map((c) => {
      const p = projection([c.lon, c.lat]);
      return p ? { ...c, x: p[0], y: p[1] } : null;
    }).filter(Boolean) as (CityMarker & { x: number; y: number })[];

    const offsets = decluster(raw.map(({ x, y }) => ({ x, y })), minDist);
    return raw.map((c, i) => ({ ...c, x: offsets[i].x, y: offsets[i].y }));
  }, [projection, minDist]);

  const openCity = (c: CityMarker) => {
    const meta = lookupCity(c);
    setSelected({
      city: c.city,
      country: c.country,
      countryLabel: meta.countryLabel,
      flag: c.flag,
    });
  };

  const ratePerKg = selected ? ratePerKgForCorridor('SN', selected.country) : null;
  const rateLabel = ratePerKg
    ? `À partir de ${ratePerKg.toLocaleString('fr-FR')} FCFA/kg`
    : 'Tarif sur devis';

  const handleCta = () => {
    if (!selected) return;
    const found = ALL_CITIES.find(
      (c) => c.city === selected.city && c.country === selected.country,
    );
    if (found) {
      window.dispatchEvent(
        new CustomEvent('yobbante:prefill-destination', {
          detail: {
            city: found.city,
            country: found.country,
            countryLabel: found.countryLabel,
          },
        }),
      );
    }
    setSelected(null);
    const target = document.getElementById('hero-quote-form');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Click-outside to dismiss
  useEffect(() => {
    if (!selected) return;
    const onDocClick = (e: MouseEvent) => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      if (!wrap.contains(e.target as Node)) setSelected(null);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [selected]);

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{ position: 'relative', width: '100%', background: 'transparent' }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: 'block', width: '100%', height: 'auto' }}
        role="img"
        aria-label="Carte des 36 destinations Yobbanté"
      >
        <defs>
          <style>{`
            @keyframes yobb-pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.55 } }
            .yobb-dakar-pulse { animation: yobb-pulse 2.4s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
            @keyframes yobb-ring { 0% { r: 6; opacity: 0.5 } 100% { r: 16; opacity: 0 } }
            .yobb-dakar-ring { animation: yobb-ring 2.4s ease-out infinite; }
            @keyframes yobb-dot-in { 0% { opacity: 0; transform: scale(0.4) } 100% { opacity: 1; transform: scale(1) } }
            .yobb-dot { animation: yobb-dot-in 0.5s ease-out both; transform-origin: center; transform-box: fill-box; transition: r 0.18s ease, fill 0.18s ease; }
            .yobb-dot:hover { fill: #FFFFFF; }
            .yobb-dot.is-active { fill: #FFFFFF; }
          `}</style>
        </defs>

        {land && (
          <g>
            {land.features.map((f, i) => (
              <path
                key={i}
                d={pathGen(f as any) ?? undefined}
                fill="#1C2A4A"
                stroke="#2E4070"
                strokeWidth={0.5}
                strokeLinejoin="round"
              />
            ))}
          </g>
        )}

        {/* City dots + invisible touch targets */}
        <g>
          {cityPoints.map((c) => {
            const isActive = selected?.city === c.city && selected?.country === c.country;
            return (
              <g key={`${c.country}-${c.city}`}>
                <circle
                  className={`yobb-dot${isActive ? ' is-active' : ''}`}
                  cx={c.x}
                  cy={c.y}
                  r={isActive ? dotR + 1.5 : dotR}
                  fill="#D4AF37"
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => { e.stopPropagation(); openCity(c); }}
                >
                  <title>{`${c.flag} ${c.city}`}</title>
                </circle>
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={touchR}
                  fill="transparent"
                  style={{ cursor: 'pointer', pointerEvents: 'all' }}
                  onClick={(e) => { e.stopPropagation(); openCity(c); }}
                />
              </g>
            );
          })}
        </g>


        {/* Dakar — origin marker */}
        {dakarPt && (
          <g>
            <circle
              className="yobb-dakar-ring"
              cx={dakarPt.x}
              cy={dakarPt.y}
              r={6}
              fill="none"
              stroke="#D4AF37"
              strokeWidth={1.25}
            />
            <circle
              className="yobb-dakar-pulse"
              cx={dakarPt.x}
              cy={dakarPt.y}
              r={isMobile ? 4 : 6}
              fill="#FFFFFF"
              stroke="#D4AF37"
              strokeWidth={1.5}
              style={{ cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); openCity(DAKAR); }}
            >
              <title>🇸🇳 Dakar</title>
            </circle>
            {!isMobile && (
              <text
                x={dakarPt.x}
                y={dakarPt.y + 18}
                textAnchor="middle"
                fill="#D4AF37"
                style={{ fontSize: 10, fontWeight: 700, pointerEvents: 'none' }}
              >
                Dakar
              </text>
            )}
          </g>
        )}
      </svg>

      {/* Fixed tooltip below map */}
      {selected && (
        <div
          style={
            isMobile
              ? {
                  position: 'fixed',
                  bottom: 80,
                  left: 16,
                  right: 16,
                  zIndex: 100,
                  animation: 'fade-in 0.2s ease-out',
                }
              : {
                  marginTop: 16,
                  display: 'flex',
                  justifyContent: 'center',
                  animation: 'fade-in 0.2s ease-out',
                }
          }
        >
          <div
            style={{
              position: 'relative',
              background: 'rgba(10, 15, 30, 0.96)',
              border: '1px solid rgba(212, 175, 55, 0.5)',
              borderRadius: 14,
              padding: '14px 44px 14px 16px',
              color: '#fff',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              minWidth: isMobile ? undefined : 260,
              maxWidth: isMobile ? undefined : 380,
              width: isMobile ? '100%' : undefined,
            }}
          >
            <button
              type="button"
              aria-label="Fermer"
              onClick={() => setSelected(null)}
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                width: 28,
                height: 28,
                borderRadius: 999,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff',
                cursor: 'pointer',
                lineHeight: 1,
                fontSize: 14,
              }}
            >
              ×
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 22 }}>{selected.flag}</span>
              <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.1 }}>
                {selected.city}
                <div style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.6)' }}>
                  {selected.countryLabel}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: '#D4AF37', fontWeight: 600, margin: '4px 0 12px' }}>
              {rateLabel}
            </div>
            <button
              type="button"
              onClick={handleCta}
              style={{
                width: '100%',
                background: '#D4AF37',
                color: '#0A0F1E',
                fontWeight: 700,
                fontSize: 13,
                padding: '10px 14px',
                borderRadius: 10,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Expédier vers {selected.city} →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default LandingWorldMap;
