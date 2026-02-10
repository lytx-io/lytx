"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from "react-simple-maps";
import { DashboardCard } from "@components/DashboardCard";

// [lng, lat] centroids for countries keyed by ISO-2 code
const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  AF: [67.7, 33.9], AL: [20.2, 41.2], DZ: [3.0, 28.0], AO: [17.5, -12.3],
  AR: [-63.6, -38.4], AM: [45.0, 40.1], AU: [133.8, -25.3], AT: [14.6, 47.5],
  AZ: [47.6, 40.1], BD: [90.4, 23.7], BY: [27.9, 53.7], BE: [4.5, 50.5],
  BZ: [-88.5, 17.2], BJ: [2.3, 9.3], BT: [90.4, 27.5], BO: [-65.0, -17.0],
  BA: [17.7, 43.9], BW: [24.7, -22.3], BR: [-51.9, -14.2], BN: [114.7, 4.9],
  BG: [25.5, 42.7], BF: [-1.6, 12.4], BI: [29.9, -3.4], KH: [105.0, 12.6],
  CM: [12.4, 5.9], CA: [-106.3, 56.1], CF: [21.0, 6.6], TD: [18.7, 15.5],
  CL: [-71.5, -35.7], CN: [104.2, 35.9], CO: [-74.3, 4.6], CR: [-84.0, 10.0],
  HR: [15.2, 45.1], CU: [-77.8, 21.5], CY: [33.4, 35.1], CZ: [15.5, 49.8],
  CD: [21.8, -4.0], DK: [9.5, 56.3], DJ: [42.6, 11.8], DO: [-70.2, 18.7],
  EC: [-78.2, -1.8], EG: [30.8, 26.8], SV: [-88.9, 13.8], GQ: [10.3, 1.6],
  ER: [39.8, 15.2], EE: [25.0, 58.6], ET: [40.5, 9.1], FI: [25.7, 61.9],
  FR: [2.2, 46.2], GA: [11.6, -0.8], GM: [-15.3, 13.4], GE: [43.4, 42.3],
  DE: [10.5, 51.2], GH: [-1.0, 7.9], GR: [21.8, 39.1], GL: [-42.6, 71.7],
  GT: [-90.2, 15.8], GN: [-9.7, 9.9], GW: [-15.2, 12.0], GY: [-58.9, 5.0],
  HT: [-72.3, 19.1], HN: [-86.2, 15.2], HU: [19.5, 47.2], IS: [-19.0, 65.0],
  IN: [79.0, 21.0], ID: [114.0, -0.8], IR: [53.7, 32.4], IQ: [43.7, 33.2],
  IE: [-8.2, 53.4], IL: [34.9, 31.0], IT: [12.6, 41.9], CI: [-5.5, 7.5],
  JM: [-77.3, 18.1], JP: [138.3, 36.2], JO: [36.2, 30.6], KZ: [66.9, 48.0],
  KE: [37.9, 0.0], KW: [47.5, 29.3], KG: [74.8, 41.2], LA: [102.5, 19.9],
  LV: [24.6, 56.9], LB: [35.9, 33.9], LS: [28.2, -29.6], LR: [-9.4, 6.4],
  LY: [17.2, 26.3], LT: [23.9, 55.2], LU: [6.1, 49.8], MK: [21.7, 41.5],
  MG: [46.9, -18.8], MW: [34.3, -13.3], MY: [101.7, 4.2], ML: [-4.0, 17.6],
  MR: [-10.9, 21.0], MX: [-102.6, 23.6], MD: [28.4, 47.4], MN: [103.8, 46.9],
  ME: [19.4, 42.7], MA: [-7.1, 31.8], MZ: [35.5, -18.7], MM: [96.0, 19.8],
  NA: [18.5, -22.0], NP: [84.1, 28.4], NL: [5.3, 52.1], NZ: [174.9, -40.9],
  NI: [-85.2, 12.9], NE: [8.1, 17.6], NG: [8.7, 9.1], NO: [8.5, 60.5],
  OM: [55.9, 21.5], PK: [69.3, 30.4], PA: [-80.8, 8.5], PG: [143.9, -6.3],
  PY: [-58.4, -23.4], PE: [-75.0, -9.2], PH: [121.8, 12.9], PL: [19.1, 51.9],
  PT: [-8.2, 39.4], QA: [51.2, 25.4], RO: [24.9, 45.9], RU: [105.3, 61.5],
  RW: [29.9, -1.9], SA: [45.1, 23.9], SN: [-14.5, 14.5], RS: [21.0, 44.0],
  SL: [-11.8, 8.5], SK: [19.7, 48.7], SI: [14.6, 46.2], SO: [46.2, 5.2],
  ZA: [22.9, -30.6], KR: [128.0, 35.9], SS: [31.3, 6.9], ES: [-3.7, 40.5],
  LK: [80.8, 7.9], SD: [30.2, 12.9], SR: [-56.0, 4.0], SZ: [31.5, -26.5],
  SE: [18.6, 60.1], CH: [8.2, 46.8], SY: [38.0, 35.0], TW: [121.0, 23.7],
  TJ: [71.3, 38.9], TZ: [34.9, -6.4], TH: [100.5, 15.9], TG: [1.2, 8.6],
  TT: [-61.2, 10.7], TN: [9.5, 33.9], TR: [35.2, 38.9], TM: [58.4, 38.0],
  UG: [32.3, 1.4], UA: [31.2, 48.4], AE: [53.8, 23.4], GB: [-3.4, 55.4],
  US: [-95.7, 37.1], UY: [-55.8, -32.5], UZ: [64.6, 41.4], VE: [-66.6, 6.4],
  VN: [108.3, 14.1], YE: [48.5, 15.6], ZM: [27.8, -13.1], ZW: [29.2, -19.0],
  XK: [21.0, 42.6], PS: [35.2, 31.9],
};

const ISO2_TO_GEOJSON_NAME: Record<string, string> = {
  US: "USA", GB: "UK", KR: "Korea", KP: "Korea", CI: "Ivory Coast",
  BS: "The Bahamas", SZ: "Swaziland", MK: "Macedonia", TL: "East Timor",
  FK: "Falkland Islands", NC: "New Caledonia", PG: "Papua New Guinea",
  SB: "Solomon Islands", GQ: "Equatorial Guinea", GW: "Guinea Bissau",
  BA: "Bosnia and Herzegovina", TT: "Trinidad and Tobago",
  CF: "Central African Republic", CD: "Democratic Republic of the Congo",
  CG: "Republic of the Congo", AE: "United Arab Emirates", SA: "Saudi Arabia",
  SS: "South Sudan", ZA: "South Africa", SL: "Sierra Leone", BF: "Burkina Faso",
  LK: "Sri Lanka", DO: "Dominican Republic", SV: "El Salvador", CR: "Costa Rica",
  WS: "Western Sahara", PS: "West Bank", NZ: "New Zealand",
};

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    return null;
  }
})();

function iso2ToDisplayName(code: string): string {
  const upper = code.trim().toUpperCase();
  return regionNames?.of(upper) ?? ISO2_TO_GEOJSON_NAME[upper] ?? upper;
}

interface TooltipState {
  x: number;
  y: number;
  name: string;
  value: number;
}

interface BubbleDatum {
  iso2: string;
  name: string;
  coordinates: [number, number];
  value: number;
}

export const WorldMapCard = React.memo(function WorldMapCard({
  aggregatedCountries,
  isDark,
  metricLabel = "visitors",
}: {
  aggregatedCountries: Array<[string, number]>;
  isDark: boolean;
  metricLabel?: string;
}) {
  const [geoData, setGeoData] = useState<any>(null);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([0, 0]);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    import("@lib/geojson/world_countries.json").then((mod) => {
      setGeoData(mod.default || mod);
    });
  }, []);

  const bubbles = useMemo<BubbleDatum[]>(() => {
    return aggregatedCountries
      .map(([iso2, count]) => {
        const upper = iso2.trim().toUpperCase();
        const coords = COUNTRY_CENTROIDS[upper];
        if (!coords || count <= 0) return null;
        return {
          iso2: upper,
          name: iso2ToDisplayName(upper),
          coordinates: coords,
          value: count,
        };
      })
      .filter((d): d is BubbleDatum => d !== null)
      .sort((a, b) => b.value - a.value);
  }, [aggregatedCountries]);

  const maxValue = useMemo(() => {
    if (!bubbles.length) return 1;
    return Math.max(...bubbles.map((b) => b.value));
  }, [bubbles]);

  const getRadius = useCallback(
    (value: number) => {
      const minR = 4;
      const maxR = 24;
      return minR + (maxR - minR) * Math.sqrt(value / maxValue);
    },
    [maxValue],
  );

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(z * 1.5, 8));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(z / 1.5, 1));
  }, []);

  const handleReset = useCallback(() => {
    setZoom(1);
    setCenter([0, 0]);
  }, []);

  if (!geoData) {
    return (
      <DashboardCard title="Visitor Map" titleAs="h3">
        <div
          style={{ height: "380px" }}
          className="w-full rounded-md bg-[var(--theme-bg-secondary)] animate-pulse"
        />
      </DashboardCard>
    );
  }

  const baseFill = isDark ? "rgba(55,65,81,0.5)" : "rgba(229,231,235,0.8)";
  const borderColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";
  const bubbleFill = isDark ? "rgba(249,115,22,0.55)" : "rgba(249,115,22,0.45)";
  const bubbleStroke = isDark ? "rgba(253,186,116,0.8)" : "rgba(234,88,12,0.6)";

  return (
    <DashboardCard
      title="Visitor Map"
      titleAs="h3"
      empty={bubbles.length === 0}
    >
      <div className="relative" style={{ height: "380px" }}>
        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
          <button
            type="button"
            onClick={handleZoomIn}
            className="w-7 h-7 flex items-center justify-center rounded bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-secondary)] transition-colors text-sm font-bold"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="w-7 h-7 flex items-center justify-center rounded bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-secondary)] transition-colors text-sm font-bold"
            aria-label="Zoom out"
          >
            −
          </button>
          {zoom > 1 && (
            <button
              type="button"
              onClick={handleReset}
              className="w-7 h-7 flex items-center justify-center rounded bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-secondary)] transition-colors text-[10px] font-semibold"
              aria-label="Reset zoom"
            >
              ↺
            </button>
          )}
        </div>

        {tooltip && (
          <div
            className="pointer-events-none absolute z-20"
            style={{
              left: tooltip.x,
              top: tooltip.y,
              transform: "translate(-50%, -110%)",
            }}
          >
            <div
              style={{
                padding: "5px 10px",
                background: isDark ? "#484743" : "#fff",
                color: isDark ? "#fff" : "#111827",
                border: `1px solid ${isDark ? "#575353" : "#E5E7EB"}`,
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              {tooltip.name}: {tooltip.value.toLocaleString()} {metricLabel}
            </div>
          </div>
        )}

        <ComposableMap
          projection="geoEqualEarth"
          projectionConfig={{ scale: 160 }}
          width={800}
          height={380}
          style={{ width: "100%", height: "100%" }}
        >
          <ZoomableGroup
            zoom={zoom}
            center={center}
            onMoveEnd={({ zoom: z, coordinates }) => {
              setZoom(z);
              if (Array.isArray(coordinates) && coordinates.length === 2) {
                setCenter([coordinates[0], coordinates[1]]);
              }
            }}
            maxZoom={8}
          >
            <Geographies geography={geoData}>
              {({ geographies }) =>
                geographies.map((geo) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={baseFill}
                    stroke={borderColor}
                    strokeWidth={0.4}
                    style={{
                      default: { outline: "none" },
                      hover: { outline: "none", fill: baseFill },
                      pressed: { outline: "none" },
                    }}
                  />
                ))
              }
            </Geographies>

            {bubbles.map((bubble) => (
              <Marker key={bubble.iso2} coordinates={bubble.coordinates}>
                <circle
                  r={getRadius(bubble.value) / zoom}
                  fill={bubbleFill}
                  stroke={bubbleStroke}
                  strokeWidth={1 / zoom}
                  onMouseEnter={(evt) => {
                    const svg = (evt.target as SVGElement).closest("svg");
                    if (!svg) return;
                    const rect = svg.getBoundingClientRect();
                    setTooltip({
                      x: evt.clientX - rect.left,
                      y: evt.clientY - rect.top,
                      name: bubble.name,
                      value: bubble.value,
                    });
                  }}
                  onMouseMove={(evt) => {
                    const svg = (evt.target as SVGElement).closest("svg");
                    if (!svg) return;
                    const rect = svg.getBoundingClientRect();
                    setTooltip({
                      x: evt.clientX - rect.left,
                      y: evt.clientY - rect.top,
                      name: bubble.name,
                      value: bubble.value,
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  style={{ cursor: "pointer" }}
                />
              </Marker>
            ))}
          </ZoomableGroup>
        </ComposableMap>
      </div>
    </DashboardCard>
  );
});
