"use client";

import { useMemo } from "react";
import {
  SharedWorldMap2D,
  type SharedWorldMap2DCountryFills,
} from "@/components/map/SharedWorldMap2D";
import type { DefenseFeedItemLive } from "@/lib/defense";

/* Warm amber-tinted variant of the shared 2D map, applied only to this
   instance (SharedWorldMap2D renders unchanged for every other consumer).
   Uses the defense screen's warm coastline palette. */
const DEFENSE_MAP_THEME = {
  land: "#211c19",
  border: "rgba(255,166,87,0.32)",
  graticule: "rgba(255,166,87,0.045)",
  background:
    "radial-gradient(120% 100% at 50% 36%, #0d0a08 0%, #070605 58%, #040303 100%)",
};

type HighlightRole = "buyer" | "supplier" | "neutral";
type Intensity = "strong" | "mid" | "low";

/* Role-coded, muted country fills tuned to sit above the warm #211c19 land
   without glowing:
     • buyer / operator countries   → warm amber
     • supplier / producer countries → muted steel-blue (mirrors CyberMap's
       "origin" family so the two screens read as one system)
     • neutral mentions             → muted graphite
   Intensity steps up with how often the country is mentioned in the feed. */
const ROLE_PALETTE: Record<HighlightRole, Record<Intensity, { fill: string; stroke: string }>> = {
  buyer: {
    strong: { fill: "#7c5a1f", stroke: "rgba(255,196,110,0.58)" },
    mid: { fill: "#5f4620", stroke: "rgba(236,180,104,0.46)" },
    low: { fill: "#47361d", stroke: "rgba(214,164,98,0.36)" },
  },
  supplier: {
    strong: { fill: "#3b4b59", stroke: "rgba(150,182,206,0.52)" },
    mid: { fill: "#32414d", stroke: "rgba(140,170,194,0.44)" },
    low: { fill: "#2b3741", stroke: "rgba(130,160,184,0.34)" },
  },
  neutral: {
    strong: { fill: "#3a3441", stroke: "rgba(178,168,192,0.42)" },
    mid: { fill: "#322d39", stroke: "rgba(166,156,180,0.36)" },
    low: { fill: "#2b2731", stroke: "rgba(152,144,168,0.30)" },
  },
};

/* geoLexicon canonical name → world-atlas (countries-110m) lowercased
   `properties.name` key. Only names that differ need an entry; the default is
   the lowercased canonical name. Entries mapped to null have no polygon in the
   110m atlas and are skipped. */
const ATLAS_KEY_EXCEPTIONS: Record<string, string | null> = {
  "United States": "united states of america",
  "Türkiye": "turkey",
  "Hong Kong": null,
  "Singapore": null,
};

function atlasKeyFor(country: string): string | null {
  if (country in ATLAS_KEY_EXCEPTIONS) return ATLAS_KEY_EXCEPTIONS[country];
  return country.toLowerCase();
}

function intensityFor(ratio: number): Intensity {
  if (ratio >= 0.66) return "strong";
  if (ratio >= 0.33) return "mid";
  return "low";
}

interface CountryAgg {
  buyer: number;
  supplier: number;
  mentions: number;
}

function aggregateCountries(items: DefenseFeedItemLive[]): Map<string, CountryAgg> {
  const agg = new Map<string, CountryAgg>();
  for (const item of items) {
    for (const hit of item.countries ?? []) {
      const rec = agg.get(hit.country) ?? { buyer: 0, supplier: 0, mentions: 0 };
      rec.mentions += 1;
      if (hit.role === "buyer") rec.buyer += 1;
      else if (hit.role === "supplier") rec.supplier += 1;
      agg.set(hit.country, rec);
    }
  }
  return agg;
}

function roleFor(rec: CountryAgg): HighlightRole {
  if (rec.buyer === 0 && rec.supplier === 0) return "neutral";
  return rec.buyer >= rec.supplier ? "buyer" : "supplier";
}

/* Top mentioned countries only, so the map never floods. */
const MAX_HIGHLIGHTED_COUNTRIES = 14;

function rankedCountries(items: DefenseFeedItemLive[]) {
  return [...aggregateCountries(items).entries()]
    .sort((a, b) => b[1].mentions - a[1].mentions)
    .slice(0, MAX_HIGHLIGHTED_COUNTRIES);
}

function buildCountryFills(items: DefenseFeedItemLive[]): SharedWorldMap2DCountryFills {
  const ranked = rankedCountries(items);
  if (ranked.length === 0) return {};
  const maxMentions = ranked[0][1].mentions || 1;

  const fills: SharedWorldMap2DCountryFills = {};
  for (const [country, rec] of ranked) {
    const key = atlasKeyFor(country);
    if (!key) continue;
    const tier = intensityFor(rec.mentions / maxMentions);
    fills[key] = ROLE_PALETTE[roleFor(rec)][tier];
  }
  return fills;
}

/** Roles present in the current highlight set — used by the map legend. */
export function activeDefenseHighlightRoles(items: DefenseFeedItemLive[]): HighlightRole[] {
  const present = new Set<HighlightRole>();
  for (const [country, rec] of rankedCountries(items)) {
    if (!atlasKeyFor(country)) continue;
    present.add(roleFor(rec));
  }
  const order: HighlightRole[] = ["buyer", "supplier", "neutral"];
  return order.filter((r) => present.has(r));
}

export const DEFENSE_ROLE_LABEL: Record<HighlightRole, string> = {
  buyer: "Buyer / Operator",
  supplier: "Supplier / Producer",
  neutral: "Mentioned",
};

export const DEFENSE_ROLE_SWATCH: Record<HighlightRole, string> = {
  buyer: ROLE_PALETTE.buyer.strong.fill,
  supplier: ROLE_PALETTE.supplier.strong.fill,
  neutral: ROLE_PALETTE.neutral.strong.fill,
};

export type { HighlightRole as DefenseHighlightRole };

export function DefenseIndustryMap({ items = [] }: { items?: DefenseFeedItemLive[] }) {
  const countryFills = useMemo(() => buildCountryFills(items), [items]);

  return (
    <SharedWorldMap2D
      ariaLabel="Defense Industry world map"
      theme={DEFENSE_MAP_THEME}
      countryFills={countryFills}
    />
  );
}
