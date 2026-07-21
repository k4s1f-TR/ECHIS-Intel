"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ArrowUpRight, Globe2, Plane, Radio } from "lucide-react";
import {
  EchisGlobe,
  type EchisGlobeHandle,
  type GlobeMarker,
} from "@/components/map/EchisGlobe";

/**
 * MonitorLanding (design "2A" — Refined Theatre).
 *
 * Self-contained welcome screen: it hosts the hero globe itself and wires the
 * Priority-watch rows + "Open Globe View" button to the globe via an internal
 * ref. Drop it into a full-bleed container (position: relative; the component
 * fills it). All chrome is inline-styled so no globals.css additions are needed.
 */

export type MonitorLandingProps = {
  onGlobalView?: () => void;
  onSocmint?: () => void;
  onAirTrack?: () => void;
};

const WATCH_REGIONS: GlobeMarker[] = [
  { id: "eastern-europe", label: "Eastern Europe", detail: "ELEVATED · 12 SIGNALS", level: "high", lng: 31, lat: 49 },
  { id: "levant", label: "Levant", detail: "CRITICAL · 31 SIGNALS", level: "critical", lng: 35, lat: 32 },
  { id: "red-sea", label: "Red Sea", detail: "ELEVATED · 8 SIGNALS", level: "high", lng: 40, lat: 18 },
];

type CardZone =
  | "north-america"
  | "latin-america"
  | "europe"
  | "africa"
  | "west-asia"
  | "asia-pacific";

type CountryCardLocation = {
  key: string;
  zone: CardZone;
  label: string;
  detail: string;
  lng: number;
  lat: number;
};

const CARD_TARGET_VISIBLE = 10;
const CARD_MAX_ACTIVE = 14;
const CARD_RECENT_COUNTRY_LIMIT = 42;

// Ambient welcome-screen categories only; these labels do not represent live events.
const WELCOME_SIGNAL_LABELS = [
  "CONFLICT WATCH",
  "CRISIS WATCH",
  "DIPLOMATIC ACTIVITY",
  "OFFICIAL VISIT",
  "POLICY UPDATE",
  "SECURITY DIALOGUE",
  "ECONOMIC TALKS",
  "DEFENSE MEETING",
  "PUBLIC STATEMENT",
  "HUMANITARIAN UPDATE",
  "ELECTION WATCH",
  "REGIONAL TENSION",
] as const;

const COUNTRY_CARD_LOCATIONS: CountryCardLocation[] = [
  { key: "canada", zone: "north-america", label: "Canada", detail: "NORTH AMERICA · PUBLIC SOURCES", lng: -106, lat: 56 },
  { key: "united-states", zone: "north-america", label: "United States", detail: "NORTH AMERICA · PUBLIC SOURCES", lng: -98, lat: 38 },
  { key: "mexico", zone: "north-america", label: "Mexico", detail: "NORTH AMERICA · PUBLIC SOURCES", lng: -102, lat: 23 },
  { key: "brazil", zone: "latin-america", label: "Brazil", detail: "LATIN AMERICA · PUBLIC SOURCES", lng: -52, lat: -10 },
  { key: "argentina", zone: "latin-america", label: "Argentina", detail: "LATIN AMERICA · PUBLIC SOURCES", lng: -64, lat: -34 },
  { key: "colombia", zone: "latin-america", label: "Colombia", detail: "LATIN AMERICA · PUBLIC SOURCES", lng: -74, lat: 4 },
  { key: "chile", zone: "latin-america", label: "Chile", detail: "LATIN AMERICA · PUBLIC SOURCES", lng: -71, lat: -30 },
  { key: "united-kingdom", zone: "europe", label: "United Kingdom", detail: "EUROPE · PUBLIC SOURCES", lng: -3, lat: 55 },
  { key: "france", zone: "europe", label: "France", detail: "EUROPE · PUBLIC SOURCES", lng: 2, lat: 46 },
  { key: "germany", zone: "europe", label: "Germany", detail: "EUROPE · PUBLIC SOURCES", lng: 10, lat: 51 },
  { key: "poland", zone: "europe", label: "Poland", detail: "EUROPE · PUBLIC SOURCES", lng: 19, lat: 52 },
  { key: "ukraine", zone: "europe", label: "Ukraine", detail: "EUROPE · PUBLIC SOURCES", lng: 31, lat: 49 },
  { key: "turkiye", zone: "europe", label: "Türkiye", detail: "EUROPE · PUBLIC SOURCES", lng: 35, lat: 39 },
  { key: "spain", zone: "europe", label: "Spain", detail: "EUROPE · PUBLIC SOURCES", lng: -4, lat: 40 },
  { key: "morocco", zone: "africa", label: "Morocco", detail: "AFRICA · PUBLIC SOURCES", lng: -6, lat: 32 },
  { key: "egypt", zone: "africa", label: "Egypt", detail: "AFRICA · PUBLIC SOURCES", lng: 30, lat: 27 },
  { key: "nigeria", zone: "africa", label: "Nigeria", detail: "AFRICA · PUBLIC SOURCES", lng: 8, lat: 9 },
  { key: "kenya", zone: "africa", label: "Kenya", detail: "AFRICA · PUBLIC SOURCES", lng: 37, lat: 0 },
  { key: "south-africa", zone: "africa", label: "South Africa", detail: "AFRICA · PUBLIC SOURCES", lng: 25, lat: -29 },
  { key: "ethiopia", zone: "africa", label: "Ethiopia", detail: "AFRICA · PUBLIC SOURCES", lng: 40, lat: 9 },
  { key: "saudi-arabia", zone: "west-asia", label: "Saudi Arabia", detail: "WEST ASIA · PUBLIC SOURCES", lng: 45, lat: 24 },
  { key: "united-arab-emirates", zone: "west-asia", label: "United Arab Emirates", detail: "WEST ASIA · PUBLIC SOURCES", lng: 54, lat: 24 },
  { key: "iran", zone: "west-asia", label: "Iran", detail: "WEST ASIA · PUBLIC SOURCES", lng: 53, lat: 32 },
  { key: "jordan", zone: "west-asia", label: "Jordan", detail: "WEST ASIA · PUBLIC SOURCES", lng: 36, lat: 31 },
  { key: "india", zone: "asia-pacific", label: "India", detail: "ASIA PACIFIC · PUBLIC SOURCES", lng: 79, lat: 22 },
  { key: "china", zone: "asia-pacific", label: "China", detail: "ASIA PACIFIC · PUBLIC SOURCES", lng: 104, lat: 35 },
  { key: "japan", zone: "asia-pacific", label: "Japan", detail: "ASIA PACIFIC · PUBLIC SOURCES", lng: 138, lat: 37 },
  { key: "south-korea", zone: "asia-pacific", label: "South Korea", detail: "ASIA PACIFIC · PUBLIC SOURCES", lng: 128, lat: 36 },
  { key: "indonesia", zone: "asia-pacific", label: "Indonesia", detail: "ASIA PACIFIC · PUBLIC SOURCES", lng: 118, lat: -2 },
  { key: "australia", zone: "asia-pacific", label: "Australia", detail: "OCEANIA · PUBLIC SOURCES", lng: 134, lat: -25 },
  { key: "new-zealand", zone: "asia-pacific", label: "New Zealand", detail: "OCEANIA · PUBLIC SOURCES", lng: 174, lat: -41 },
  { key: "philippines", zone: "asia-pacific", label: "Philippines", detail: "ASIA PACIFIC · PUBLIC SOURCES", lng: 122, lat: 13 },
  { key: "guatemala", zone: "north-america", label: "Guatemala", detail: "CENTRAL AMERICA · PUBLIC SOURCES", lng: -90, lat: 15 },
  { key: "cuba", zone: "north-america", label: "Cuba", detail: "CARIBBEAN · PUBLIC SOURCES", lng: -79, lat: 22 },
  { key: "dominican-republic", zone: "north-america", label: "Dominican Republic", detail: "CARIBBEAN · PUBLIC SOURCES", lng: -70, lat: 19 },
  { key: "panama", zone: "north-america", label: "Panama", detail: "CENTRAL AMERICA · PUBLIC SOURCES", lng: -80, lat: 9 },
  { key: "peru", zone: "latin-america", label: "Peru", detail: "LATIN AMERICA · PUBLIC SOURCES", lng: -76, lat: -10 },
  { key: "ecuador", zone: "latin-america", label: "Ecuador", detail: "LATIN AMERICA · PUBLIC SOURCES", lng: -78, lat: -2 },
  { key: "bolivia", zone: "latin-america", label: "Bolivia", detail: "LATIN AMERICA · PUBLIC SOURCES", lng: -64, lat: -17 },
  { key: "uruguay", zone: "latin-america", label: "Uruguay", detail: "LATIN AMERICA · PUBLIC SOURCES", lng: -56, lat: -33 },
  { key: "venezuela", zone: "latin-america", label: "Venezuela", detail: "LATIN AMERICA · PUBLIC SOURCES", lng: -66, lat: 7 },
  { key: "paraguay", zone: "latin-america", label: "Paraguay", detail: "LATIN AMERICA · PUBLIC SOURCES", lng: -58, lat: -23 },
  { key: "italy", zone: "europe", label: "Italy", detail: "EUROPE · PUBLIC SOURCES", lng: 12, lat: 42 },
  { key: "sweden", zone: "europe", label: "Sweden", detail: "EUROPE · PUBLIC SOURCES", lng: 16, lat: 62 },
  { key: "norway", zone: "europe", label: "Norway", detail: "EUROPE · PUBLIC SOURCES", lng: 9, lat: 62 },
  { key: "romania", zone: "europe", label: "Romania", detail: "EUROPE · PUBLIC SOURCES", lng: 25, lat: 46 },
  { key: "greece", zone: "europe", label: "Greece", detail: "EUROPE · PUBLIC SOURCES", lng: 22, lat: 39 },
  { key: "netherlands", zone: "europe", label: "Netherlands", detail: "EUROPE · PUBLIC SOURCES", lng: 5, lat: 52 },
  { key: "algeria", zone: "africa", label: "Algeria", detail: "AFRICA · PUBLIC SOURCES", lng: 2, lat: 28 },
  { key: "ghana", zone: "africa", label: "Ghana", detail: "AFRICA · PUBLIC SOURCES", lng: -2, lat: 8 },
  { key: "senegal", zone: "africa", label: "Senegal", detail: "AFRICA · PUBLIC SOURCES", lng: -14, lat: 14 },
  { key: "tanzania", zone: "africa", label: "Tanzania", detail: "AFRICA · PUBLIC SOURCES", lng: 35, lat: -6 },
  { key: "dr-congo", zone: "africa", label: "DR Congo", detail: "AFRICA · PUBLIC SOURCES", lng: 23, lat: -3 },
  { key: "angola", zone: "africa", label: "Angola", detail: "AFRICA · PUBLIC SOURCES", lng: 18, lat: -12 },
  { key: "tunisia", zone: "africa", label: "Tunisia", detail: "AFRICA · PUBLIC SOURCES", lng: 9, lat: 34 },
  { key: "libya", zone: "africa", label: "Libya", detail: "NORTH AFRICA", lng: 18, lat: 27 },
  { key: "mauritania", zone: "africa", label: "Mauritania", detail: "NORTH AFRICA", lng: -11, lat: 21 },
  { key: "sudan", zone: "africa", label: "Sudan", detail: "NORTH AFRICA", lng: 30, lat: 16 },
  { key: "iraq", zone: "west-asia", label: "Iraq", detail: "WEST ASIA · PUBLIC SOURCES", lng: 44, lat: 33 },
  { key: "qatar", zone: "west-asia", label: "Qatar", detail: "WEST ASIA · PUBLIC SOURCES", lng: 51, lat: 25 },
  { key: "oman", zone: "west-asia", label: "Oman", detail: "WEST ASIA · PUBLIC SOURCES", lng: 57, lat: 21 },
  { key: "azerbaijan", zone: "west-asia", label: "Azerbaijan", detail: "WEST ASIA · PUBLIC SOURCES", lng: 47, lat: 40 },
  { key: "georgia", zone: "west-asia", label: "Georgia", detail: "WEST ASIA · PUBLIC SOURCES", lng: 44, lat: 42 },
  { key: "kazakhstan", zone: "west-asia", label: "Kazakhstan", detail: "CENTRAL ASIA · PUBLIC SOURCES", lng: 68, lat: 48 },
  { key: "vietnam", zone: "asia-pacific", label: "Vietnam", detail: "ASIA PACIFIC · PUBLIC SOURCES", lng: 108, lat: 16 },
  { key: "thailand", zone: "asia-pacific", label: "Thailand", detail: "ASIA PACIFIC · PUBLIC SOURCES", lng: 101, lat: 15 },
  { key: "malaysia", zone: "asia-pacific", label: "Malaysia", detail: "ASIA PACIFIC · PUBLIC SOURCES", lng: 102, lat: 4 },
  { key: "pakistan", zone: "asia-pacific", label: "Pakistan", detail: "SOUTH ASIA · PUBLIC SOURCES", lng: 69, lat: 30 },
  { key: "bangladesh", zone: "asia-pacific", label: "Bangladesh", detail: "SOUTH ASIA · PUBLIC SOURCES", lng: 90, lat: 24 },
  { key: "singapore", zone: "asia-pacific", label: "Singapore", detail: "ASIA PACIFIC · PUBLIC SOURCES", lng: 104, lat: 1 },
  { key: "mongolia", zone: "asia-pacific", label: "Mongolia", detail: "ASIA PACIFIC · PUBLIC SOURCES", lng: 104, lat: 47 },
];

type CountryLabelFile = {
  countries?: Array<{ n: string; lng: number; lat: number }>;
};

type ProjectedCountry = {
  location: CountryCardLocation;
  point: { x: number; y: number; visible: boolean };
};

const NORTH_AFRICA_COUNTRIES = new Set([
  "Algeria",
  "Egypt",
  "Libya",
  "Mauritania",
  "Morocco",
  "Sudan",
  "Tunisia",
  "Western Sahara",
]);

function classifyCountry(
  label: string,
  lng: number,
  lat: number,
): Pick<CountryCardLocation, "zone" | "detail"> {
  if (NORTH_AFRICA_COUNTRIES.has(label)) {
    return { zone: "africa", detail: "NORTH AFRICA" };
  }
  if (lat < 15 && (lng > 110 || lng < -140)) {
    return { zone: "asia-pacific", detail: "OCEANIA & PACIFIC" };
  }
  if (lng < -30) {
    if (lat >= 20) return { zone: "north-america", detail: "NORTH AMERICA" };
    if (lat >= 7) return { zone: "north-america", detail: "CENTRAL AMERICA & CARIBBEAN" };
    return { zone: "latin-america", detail: "SOUTH AMERICA" };
  }
  if (lat <= -10 && lng >= 105) {
    return { zone: "asia-pacific", detail: "OCEANIA & PACIFIC" };
  }
  if (lng >= -20 && lng <= 55 && lat > -38 && lat < 20) {
    if (lat <= -18) return { zone: "africa", detail: "SOUTHERN AFRICA" };
    if (lng < 12) return { zone: "africa", detail: "WEST AFRICA" };
    if (lng >= 28) return { zone: "africa", detail: "EAST AFRICA" };
    return { zone: "africa", detail: "CENTRAL AFRICA" };
  }
  if (lat >= 35 && lng < 45) {
    if (lat >= 56) return { zone: "europe", detail: "NORTHERN EUROPE" };
    if (lat < 45) return { zone: "europe", detail: "SOUTHERN EUROPE" };
    if (lng >= 20) return { zone: "europe", detail: "EASTERN EUROPE" };
    return { zone: "europe", detail: "WESTERN EUROPE" };
  }
  if (lng < 60) return { zone: "west-asia", detail: "WEST ASIA" };
  if (lng < 90 && lat >= 35) return { zone: "west-asia", detail: "CENTRAL ASIA" };
  if (lng < 95 && lat < 35) return { zone: "asia-pacific", detail: "SOUTH ASIA" };
  if (lng < 130 && lat < 22) return { zone: "asia-pacific", detail: "SOUTHEAST ASIA" };
  return { zone: "asia-pacific", detail: "EAST ASIA" };
}

function countryPoolFromLabels(data: CountryLabelFile): CountryCardLocation[] {
  return (data.countries ?? []).map((country, index) => ({
    key: `${index}-${country.n}`,
    label: country.n,
    lng: country.lng,
    lat: country.lat,
    ...classifyCountry(country.n, country.lng, country.lat),
  }));
}

function pickWelcomeSignalLabel(activeCards: GlobeMarker[]): string {
  const usage = new Map<string, number>(
    WELCOME_SIGNAL_LABELS.map((label) => [label, 0]),
  );
  activeCards.forEach((card) => {
    if (card.detail && usage.has(card.detail)) {
      usage.set(card.detail, (usage.get(card.detail) ?? 0) + 1);
    }
  });
  const minimumUsage = Math.min(...usage.values());
  const availableLabels = WELCOME_SIGNAL_LABELS.filter(
    (label) => usage.get(label) === minimumUsage,
  );
  return availableLabels[Math.floor(Math.random() * availableLabels.length)];
}

function pickCountryCard(
  pool: CountryCardLocation[],
  activeCards: GlobeMarker[],
  recentLabels: Set<string>,
  regionUsage: Map<string, number>,
  globe: EchisGlobeHandle,
  now: number,
  sequence: number,
): GlobeMarker | null {
  const activeLabels = new Set(activeCards.map((card) => card.label));
  const activeProjected = activeCards
    .map((card) => ({ card, point: globe.projectMarker(card.lng, card.lat) }))
    .filter((item): item is { card: GlobeMarker; point: { x: number; y: number; visible: boolean } } =>
      Boolean(item.point?.visible),
    );
  const projectCandidates = (ignoreRecent: boolean) => pool
    .filter((location) =>
      !activeLabels.has(location.label) &&
      (ignoreRecent || !recentLabels.has(location.label)),
    )
    .map((location) => ({ location, point: globe.projectMarker(location.lng, location.lat) }))
    .filter((item): item is ProjectedCountry => Boolean(item.point?.visible));
  let candidates = projectCandidates(false);
  if (candidates.length === 0) candidates = projectCandidates(true);
  if (candidates.length === 0) return null;

  const activeRegionCounts = new Map<string, number>();
  activeProjected.forEach(({ card }) => {
    const region = card.regionKey ?? "GLOBAL";
    activeRegionCounts.set(region, (activeRegionCounts.get(region) ?? 0) + 1);
  });
  const candidateRegions = Array.from(new Set(candidates.map(({ location }) => location.detail)));
  candidateRegions.sort((a, b) => {
    const activeDelta = (activeRegionCounts.get(a) ?? 0) - (activeRegionCounts.get(b) ?? 0);
    if (activeDelta !== 0) return activeDelta;
    const usageDelta = (regionUsage.get(a) ?? 0) - (regionUsage.get(b) ?? 0);
    return usageDelta !== 0 ? usageDelta : Math.random() - 0.5;
  });
  const leastActiveCount = activeRegionCounts.get(candidateRegions[0]) ?? 0;
  const balancedRegions = candidateRegions.filter(
    (region) => (activeRegionCounts.get(region) ?? 0) === leastActiveCount,
  );
  const minimumUsage = Math.min(...balancedRegions.map((region) => regionUsage.get(region) ?? 0));
  const fairestRegions = balancedRegions.filter(
    (region) => (regionUsage.get(region) ?? 0) === minimumUsage,
  );
  const selectedRegion = fairestRegions[Math.floor(Math.random() * fairestRegions.length)];
  candidates = candidates.filter(({ location }) => location.detail === selectedRegion);

  const ranked = candidates
    .map((candidate) => ({
      ...candidate,
      spacing: activeProjected.length === 0
        ? Number.POSITIVE_INFINITY
        : Math.min(...activeProjected.map(({ point }) => {
            const dx = candidate.point.x - point.x;
            const dy = candidate.point.y - point.y;
            return dx * dx + dy * dy;
          })),
    }))
    .sort((a, b) => b.spacing - a.spacing);
  const variedTopCount = Math.min(4, ranked.length);
  const selected = ranked[Math.floor(Math.random() * variedTopCount)].location;

  return {
    id: `country-card-${sequence}-${selected.key}`,
    label: selected.label,
    detail: pickWelcomeSignalLabel(activeCards),
    regionKey: selected.detail,
    lng: selected.lng,
    lat: selected.lat,
    level: "low",
    displayStartedAtMs: now + 100 + Math.random() * 350,
    displayDurationMs: 4_500 + Math.random() * 3_000,
  };
}

const MONO = "var(--font-mono, 'JetBrains Mono', monospace)";
const DISPLAY = "var(--font-display, 'Space Grotesk', sans-serif)";
const BODY = "var(--font-ui, 'Hanken Grotesk', sans-serif)";

export const MonitorLanding = forwardRef<EchisGlobeHandle, MonitorLandingProps>(
  function MonitorLanding({ onGlobalView, onSocmint, onAirTrack }, ref) {
  const globeRef = useRef<EchisGlobeHandle>(null);
  const [countryCards, setCountryCards] = useState<GlobeMarker[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    let timeoutId: number | undefined;
    let sequence = 0;
    let pool: CountryCardLocation[] = [];
    let currentCards: GlobeMarker[] = [];
    let recentLabels: string[] = [];
    const regionUsage = new Map<string, number>();

    const scheduleNext = (delayMs: number) => {
      timeoutId = window.setTimeout(runCardCycle, delayMs);
    };

    const runCardCycle = () => {
      if (disposed) return;
      const now = performance.now();
      const previousCards = currentCards;
      let nextCards = previousCards.filter((card) =>
        (card.displayStartedAtMs ?? 0) + (card.displayDurationMs ?? 0) > now,
      );
      const globe = globeRef.current;
      const visibleCount = globe
        ? nextCards.filter((card) => globe.projectMarker(card.lng, card.lat)?.visible).length
        : 0;

      if (
        globe &&
        pool.length > 0 &&
        visibleCount < CARD_TARGET_VISIBLE &&
        nextCards.length < CARD_MAX_ACTIVE
      ) {
        const nextCard = pickCountryCard(
          pool,
          nextCards,
          new Set(recentLabels),
          regionUsage,
          globe,
          now,
          sequence,
        );
        if (nextCard) {
          nextCards = [...nextCards, nextCard];
          sequence += 1;
          const label = nextCard.label ?? nextCard.id;
          recentLabels = [...recentLabels, label].slice(-CARD_RECENT_COUNTRY_LIMIT);
          const region = nextCard.regionKey ?? "GLOBAL";
          regionUsage.set(region, (regionUsage.get(region) ?? 0) + 1);
        }
      }

      const changed =
        nextCards.length !== previousCards.length ||
        nextCards.some((card, index) => card !== previousCards[index]);
      if (changed) {
        currentCards = nextCards;
        setCountryCards(nextCards);
      }

      const nextVisibleCount = globe
        ? nextCards.filter((card) => globe.projectMarker(card.lng, card.lat)?.visible).length
        : 0;
      const fillingViewport = nextVisibleCount < CARD_TARGET_VISIBLE;
      scheduleNext(
        fillingViewport
          ? 320 + Math.random() * 480
          : 650 + Math.random() * 900,
      );
    };

    fetch("/data/home-globe-labels.json", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Country label data unavailable");
        return response.json() as Promise<CountryLabelFile>;
      })
      .then((data) => {
        if (disposed) return;
        pool = countryPoolFromLabels(data);
        runCardCycle();
      })
      .catch(() => {
        if (disposed) return;
        pool = COUNTRY_CARD_LOCATIONS.map((location) => ({
          ...location,
          ...classifyCountry(location.label, location.lng, location.lat),
        }));
        runCardCycle();
      });

    return () => {
      disposed = true;
      controller.abort();
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, []);

  // Expose the internal globe handle so AppShell's homeGlobeRef keeps working.
  useImperativeHandle(ref, () => ({
    zoomIn: () => globeRef.current?.zoomIn(),
    zoomOut: () => globeRef.current?.zoomOut(),
    centerView: () => globeRef.current?.centerView(),
    focusMarker: (lng, lat) => globeRef.current?.focusMarker(lng, lat),
    projectMarker: (lng, lat) => globeRef.current?.projectMarker(lng, lat) ?? null,
    setAutoRotatePaused: (paused) => globeRef.current?.setAutoRotatePaused(paused),
  }), []);

  const bracket = (corner: "tl" | "tr" | "bl" | "br"): React.CSSProperties => {
    const v = corner[0] === "t" ? { top: 15 } : { bottom: 15 };
    const h = corner[1] === "l" ? { left: 15 } : { right: 15 };
    const c = "1px solid rgba(255,64,78,.4)";
    return {
      position: "absolute",
      width: 20,
      height: 20,
      zIndex: 5,
      ...v,
      ...h,
      borderTop: corner[0] === "t" ? c : undefined,
      borderBottom: corner[0] === "b" ? c : undefined,
      borderLeft: corner[1] === "l" ? c : undefined,
      borderRight: corner[1] === "r" ? c : undefined,
    };
  };

  const quietButton: React.CSSProperties = {
    height: 40,
    padding: "0 16px",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    borderRadius: 9,
    fontFamily: BODY,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: ".05em",
    whiteSpace: "nowrap",
    color: "rgba(199,204,213,.78)",
    background: "rgba(255,255,255,.025)",
    border: "1px solid rgba(255,255,255,.08)",
    cursor: "pointer",
  };

  return (
    <div
      aria-label="ECHIS monitor overview"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        fontFamily: BODY,
        background:
          "radial-gradient(ellipse at 50% 56%,rgba(48,11,16,.3),transparent 46%),radial-gradient(ellipse at 50% 50%,#0b0c0f 0%,#08080b 52%,#040405 100%)",
      }}
    >
      {/* Hero globe */}
      <EchisGlobe
        ref={globeRef}
        size="hero"
        markers={countryCards}
        showLabels
        showMarkerCore={false}
        showMarkerWaves={false}
      />

      {/* Depth vignette above globe, below chrome */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse at 50% 54%,transparent 42%,rgba(3,2,3,.62) 100%),linear-gradient(180deg,rgba(5,4,6,.58),transparent 22%,transparent 76%,rgba(4,3,4,.74))",
        }}
      />

      {/* Corner brackets */}
      <span style={bracket("tl")} />
      <span style={bracket("tr")} />
      <span style={bracket("bl")} />
      <span style={bracket("br")} />

      {/* Header */}
      <div
        style={{
          position: "absolute",
          top: 34,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 6,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 13,
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              width: 15,
              height: 15,
              borderRadius: 4,
              background: "linear-gradient(135deg,#b3121f,#ff2b3d)",
              boxShadow: "0 0 14px rgba(236,47,59,.5),inset 0 1px 0 rgba(255,255,255,.3)",
            }}
          />
          <span style={{ fontFamily: DISPLAY, fontSize: 15, fontWeight: 600, letterSpacing: ".14em", color: "rgba(238,240,244,.96)" }}>
            ECHIS
          </span>
          <span style={{ width: 1, height: 13, background: "rgba(255,255,255,.1)" }} />
          <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: ".22em", color: "rgba(132,142,156,.64)" }}>
            MONITOR
          </span>
        </div>
        <h1
          style={{
            margin: "2px 0 0",
            fontFamily: DISPLAY,
            fontSize: 38,
            fontWeight: 520,
            lineHeight: 1,
            letterSpacing: "-.04em",
            color: "rgba(239,241,244,.97)",
            textShadow: "0 2px 28px rgba(0,0,0,.9),0 0 60px rgba(0,0,0,.6)",
          }}
        >
          Global awareness, <span style={{ color: "rgba(143,149,159,.62)", fontWeight: 430 }}>distilled.</span>
        </h1>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 8.5,
            fontWeight: 600,
            letterSpacing: ".24em",
            textTransform: "uppercase",
            color: "rgba(150,158,170,.56)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            textShadow: "0 1px 16px rgba(0,0,0,.9)",
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "#ef394a",
              boxShadow: "0 0 12px rgba(239,57,74,.5)",
            }}
          />
          Strategic intelligence environment · Global coverage
        </div>
      </div>

      {/* Priority watch — bottom left */}
      <div style={{ position: "absolute", left: 34, bottom: 34, zIndex: 6, display: "flex", flexDirection: "column", gap: 2 }}>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 7.5,
            letterSpacing: ".2em",
            textTransform: "uppercase",
            color: "rgba(119,127,139,.55)",
            marginBottom: 10,
            paddingLeft: 4,
          }}
        >
          Priority watch
        </div>
        {WATCH_REGIONS.map((region) => (
          <button
            type="button"
            key={region.id}
            onClick={() => globeRef.current?.focusMarker(region.lng, region.lat)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 11,
              width: 188,
              padding: "8px 6px",
              border: 0,
              background: "transparent",
              textAlign: "left",
              cursor: "pointer",
              borderRadius: 7,
            }}
          >
            <span
              style={{
                width: 3,
                height: 22,
                borderRadius: 3,
                background: region.level === "critical" ? "#ef3d4f" : "#c8752e",
                boxShadow:
                  region.level === "critical" ? "0 0 10px rgba(239,61,79,.45)" : "0 0 8px rgba(242,115,28,.3)",
              }}
            />
            <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <strong style={{ fontFamily: BODY, fontSize: 11, fontWeight: 600, color: "rgba(214,218,224,.84)" }}>
                {region.label}
              </strong>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 7.5,
                  letterSpacing: ".12em",
                  color: region.level === "critical" ? "rgba(235,72,72,.85)" : "rgba(200,117,46,.82)",
                }}
              >
                {region.level === "critical" ? "CRITICAL" : "ELEVATED"}
              </span>
            </span>
          </button>
        ))}
      </div>

      {/* Side rails */}
      <div
        style={{
          position: "absolute",
          left: 20,
          top: "50%",
          transform: "translateY(-50%) rotate(-90deg)",
          zIndex: 5,
          fontFamily: MONO,
          fontSize: 7.5,
          letterSpacing: ".28em",
          color: "rgba(96,104,115,.4)",
          whiteSpace: "nowrap",
        }}
      >
        GLOBE MODE · AUTO-ROTATE
      </div>
      <div
        style={{
          position: "absolute",
          right: 20,
          top: "50%",
          transform: "translateY(-50%) rotate(90deg)",
          zIndex: 5,
          fontFamily: MONO,
          fontSize: 7.5,
          letterSpacing: ".28em",
          color: "rgba(96,104,115,.4)",
          whiteSpace: "nowrap",
        }}
      >
        SECURE · GLOBAL COVERAGE
      </div>

      {/* Glass dock — bottom center */}
      <div
        style={{
          position: "absolute",
          bottom: 34,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 7,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "13px 15px",
          border: "1px solid rgba(255,255,255,.08)",
          borderRadius: 15,
          background: "linear-gradient(180deg,rgba(20,17,20,.72),rgba(8,7,9,.8))",
          backdropFilter: "blur(20px) saturate(120%)",
          boxShadow: "0 24px 70px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.05)",
        }}
      >
        <button
          type="button"
          onClick={() => {
            globeRef.current?.centerView();
            onGlobalView?.();
          }}
          style={{
            height: 40,
            minWidth: 172,
            whiteSpace: "nowrap",
            padding: "0 15px",
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            borderRadius: 9,
            fontFamily: BODY,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: ".05em",
            color: "rgba(255,238,240,.98)",
            background: "linear-gradient(135deg,rgba(124,15,29,.98),rgba(214,34,51,.95))",
            border: "1px solid rgba(255,98,111,.34)",
            boxShadow: "0 10px 28px rgba(112,8,22,.34),inset 0 1px 0 rgba(255,255,255,.16)",
            cursor: "pointer",
          }}
        >
          <Globe2 size={15} />
          Open Globe View
          <ArrowUpRight size={14} style={{ marginLeft: "auto", opacity: 0.7 }} />
        </button>
        <button type="button" onClick={onSocmint} style={quietButton}>
          <Radio size={14} />
          SOCMINT
        </button>
        <button type="button" onClick={onAirTrack} style={quietButton}>
          <Plane size={14} />
          Air Track
        </button>
        <span style={{ width: 1, height: 26, background: "rgba(255,255,255,.1)" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingRight: 4 }}>
          <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: ".1em", color: "rgba(150,158,170,.62)" }}>
            07 REGIONS · 1,284 SIGNALS/24H · 63 SOURCES
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 7, letterSpacing: ".14em", color: "rgba(120,128,140,.55)" }}>
            <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#b0b8c4", boxShadow: "0 0 8px rgba(176,184,196,.5)" }} />
            SECURE SESSION
          </span>
        </div>
      </div>
    </div>
  );
});
