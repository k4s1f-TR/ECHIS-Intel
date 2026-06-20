"use client";

import { SharedWorldMap2D } from "@/components/map/SharedWorldMap2D";

/* Dark continents + crimson coastlines, applied only to this map instance.
   SharedWorldMap2D renders identically for every other consumer (no theme).

   NOTE: markers + attack-arc animations were intentionally removed — the marker
   and animation system for this screen is being redesigned. Only the map base
   (themed land/coastline/graticule/background) remains. */
const CYBER_MAP_THEME = {
  land: "#221a1e",
  border: "rgba(255,72,84,0.40)",
  graticule: "rgba(255,72,84,0.04)",
  background: "radial-gradient(120% 100% at 50% 36%, #0c0a0d 0%, #070507 58%, #040305 100%)",
};

export function CyberMap() {
  return <SharedWorldMap2D ariaLabel="Cyber Threat world map" theme={CYBER_MAP_THEME} />;
}
