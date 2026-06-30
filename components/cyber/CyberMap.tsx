"use client";

import { useMemo } from "react";
import {
  SharedWorldMap2D,
  type SharedWorldMap2DCountryFills,
} from "@/components/map/SharedWorldMap2D";
import { ATLAS_NAME_TO_REGION } from "@/lib/cyber/atlasRegions";
import type { RegionId, RegionMetric } from "@/lib/cyber";

/* Dark continents + crimson coastlines, applied only to this map instance.
   SharedWorldMap2D renders identically for every other consumer (no theme).

   Region highlight layer: the macro-regions listed in "Most Mentioned Regions"
   are filled as solid blocks. Tones are muted and role-coded (not neon) so the
   screen keeps its weight:
     • target / affected regions → muted oxblood (crimson family)
     • attacker-origin regions   → muted steel-grey
     • neutral mentions          → muted graphite
   Intensity steps up with how often the region is mentioned. */
const CYBER_MAP_THEME = {
  land: "#221a1e",
  border: "rgba(255,72,84,0.40)",
  graticule: "rgba(255,72,84,0.04)",
  background: "radial-gradient(120% 100% at 50% 36%, #0c0a0d 0%, #070507 58%, #040305 100%)",
};

type ColoringRole = "target" | "origin" | "neutral";
type Intensity = "strong" | "mid" | "low";

// Muted, desaturated palette tuned to sit above the #221a1e land without
// glowing. Each role has three intensity steps.
const REGION_PALETTE: Record<ColoringRole, Record<Intensity, { fill: string; stroke: string }>> = {
  target: {
    strong: { fill: "#7e2c36", stroke: "rgba(214,96,108,0.55)" },
    mid: { fill: "#5e2730", stroke: "rgba(196,86,98,0.46)" },
    low: { fill: "#46222a", stroke: "rgba(176,80,90,0.36)" },
  },
  origin: {
    strong: { fill: "#3b4b59", stroke: "rgba(150,182,206,0.50)" },
    mid: { fill: "#32414d", stroke: "rgba(140,170,194,0.42)" },
    low: { fill: "#2b3741", stroke: "rgba(130,160,184,0.34)" },
  },
  neutral: {
    strong: { fill: "#3a3441", stroke: "rgba(178,168,192,0.42)" },
    mid: { fill: "#322d39", stroke: "rgba(166,156,180,0.36)" },
    low: { fill: "#2b2731", stroke: "rgba(152,144,168,0.30)" },
  },
};

/** Region's coloring role: any target presence ⇒ target; else origin; else neutral. */
function coloringRole(metric: RegionMetric): ColoringRole {
  if (metric.roleBreakdown.target > 0) return "target";
  if (metric.roleBreakdown.origin > 0) return "origin";
  return "neutral";
}

function intensityFor(ratio: number): Intensity {
  if (ratio >= 0.66) return "strong";
  if (ratio >= 0.33) return "mid";
  return "low";
}

/** Build per-country fills: every country of a listed macro-region gets its color. */
function buildCountryFills(regions: RegionMetric[]): SharedWorldMap2DCountryFills {
  if (regions.length === 0) return {};

  // Top regions only (mirrors the panel) so the map never floods.
  const top = regions.slice(0, 6);
  const maxCount = top.reduce((m, r) => Math.max(m, r.itemCount), 0) || 1;

  const colorByRegion = new Map<RegionId, { fill: string; stroke: string }>();
  for (const region of top) {
    if (region.regionId === "global") continue; // not a fillable block
    const role = coloringRole(region);
    const tier = intensityFor(region.itemCount / maxCount);
    colorByRegion.set(region.regionId, REGION_PALETTE[role][tier]);
  }

  const fills: SharedWorldMap2DCountryFills = {};
  for (const [nameKey, regionId] of Object.entries(ATLAS_NAME_TO_REGION)) {
    const color = colorByRegion.get(regionId);
    if (color) fills[nameKey] = { fill: color.fill, stroke: color.stroke };
  }
  return fills;
}

export function CyberMap({ regions = [] }: { regions?: RegionMetric[] }) {
  const countryFills = useMemo(() => buildCountryFills(regions), [regions]);

  return (
    <SharedWorldMap2D
      ariaLabel="Cyber Threat world map"
      theme={CYBER_MAP_THEME}
      countryFills={countryFills}
    />
  );
}

/** Roles present in the current highlight set — used by the map legend. */
export function activeHighlightRoles(regions: RegionMetric[]): ColoringRole[] {
  const present = new Set<ColoringRole>();
  for (const region of regions.slice(0, 6)) {
    if (region.regionId === "global") continue;
    present.add(coloringRole(region));
  }
  const order: ColoringRole[] = ["target", "origin", "neutral"];
  return order.filter((r) => present.has(r));
}

export const HIGHLIGHT_ROLE_LABEL: Record<ColoringRole, string> = {
  target: "Affected",
  origin: "Origin",
  neutral: "Mentioned",
};

export const HIGHLIGHT_ROLE_SWATCH: Record<ColoringRole, string> = {
  target: REGION_PALETTE.target.strong.fill,
  origin: REGION_PALETTE.origin.strong.fill,
  neutral: REGION_PALETTE.neutral.strong.fill,
};

export type { ColoringRole as HighlightRole };
