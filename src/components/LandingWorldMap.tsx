import { useEffect, useMemo, useRef, useState } from 'react';
import { geoEquirectangular, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { FeatureCollection, Geometry } from 'geojson';

/* ──────────────────────────────────────────────────────────────────────
   LandingWorldMap — D3 + TopoJSON world map for the landing page.
   - Continents only (no graticules, no country borders)
   - 36 city markers (gold dots) with hover tooltip (flag + city name)
   - Responsive to its parent container width
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
  { city: 'Dakar',       country: 'SN', flag: '🇸🇳', lat: 14.69, lon: -17.45 },
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

const TOPO_URL = 'https://unpkg.com/world-atlas@2.0.2/countries-110m.json';

// Module-level cache to avoid re-fetching on remounts
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

export function LandingWorldMap({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(960);
  const [land, setLand] = useState<FeatureCollection<Geometry> | null>(cachedLand);
  const [hover, setHover] = useState<{ city: string; flag: string; x: number; y: number } | null>(null);

  // Responsive width observer
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

  // Load TopoJSON
  useEffect(() => {
    let alive = true;
    loadLand().then((l) => { if (alive) setLand(l); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const height = Math.round(width / 2); // equirectangular ratio
  const projection = useMemo(
    () => geoEquirectangular().scale(width / (2 * Math.PI)).translate([width / 2, height / 2]),
    [width, height]
  );
  const pathGen = useMemo(() => geoPath(projection as any), [projection]);

  const cityPoints = useMemo(
    () => CITIES_36.map((c) => {
      const p = projection([c.lon, c.lat]);
      return p ? { ...c, x: p[0], y: p[1] } : null;
    }).filter(Boolean) as (CityMarker & { x: number; y: number })[],
    [projection]
  );

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
        {/* Continents */}
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

        {/* City dots (gold) */}
        <g>
          {cityPoints.map((c) => (
            <circle
              key={`${c.country}-${c.city}`}
              cx={c.x}
              cy={c.y}
              r={4}
              fill="#D4AF37"
              stroke="rgba(0,0,0,0.4)"
              strokeWidth={0.75}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHover({ city: c.city, flag: c.flag, x: c.x, y: c.y })}
              onMouseLeave={() => setHover(null)}
              onTouchStart={() => setHover({ city: c.city, flag: c.flag, x: c.x, y: c.y })}
            >
              <title>{`${c.flag} ${c.city}`}</title>
            </circle>
          ))}
        </g>
      </svg>

      {/* Floating tooltip */}
      {hover && (
        <div
          style={{
            position: 'absolute',
            left: hover.x,
            top: hover.y - 12,
            transform: 'translate(-50%, -100%)',
            background: 'rgba(10, 15, 30, 0.95)',
            color: '#fff',
            border: '1px solid rgba(212, 175, 55, 0.5)',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 12,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            zIndex: 10,
          }}
        >
          <span style={{ marginRight: 6 }}>{hover.flag}</span>
          {hover.city}
        </div>
      )}
    </div>
  );
}

export default LandingWorldMap;
