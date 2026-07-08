import typeNamesJson from "@/data/airtrack/type-names.json";
import watchlistJson from "@/data/airtrack/watchlist.json";

// Static enrichment DB — server-side only (imported by the airtrack API
// route via the adapter).  Regenerate the JSON files with:
//   node scripts/airtrack/build-static-db.mjs

const typeNames = typeNamesJson as Record<string, string>;
// hex -> [operator, typeName, category]
const watchlist = watchlistJson as unknown as Record<
  string,
  [string, string, string]
>;

// plane-alert-db categories that warrant a distinct visual highlight on the
// globe.  The rest of the list (routine air-force transports, police,
// medevac, …) still enriches the contact card but renders as normal military.
const PRIORITY_CATEGORIES = new Set([
  "Dictator Alert",
  "Governments",
  "Head of State",
  "Royal Aircraft",
  "Oligarch",
  "Special Forces",
  "Nuclear",
  "Oxcart", // strategic reconnaissance
  "Gunship",
  "Hired Gun", // private military contractors
  "Da Comrade",
  "Ukraine",
  "UAV",
]);

export type WatchlistHit = {
  operator: string | null;
  typeName: string | null;
  category: string;
  priority: boolean;
};

export function lookupTypeName(typeCode: string | null): string | null {
  if (!typeCode) return null;
  return typeNames[typeCode.toUpperCase()] ?? null;
}

export function lookupWatchlist(icao24: string): WatchlistHit | null {
  const entry = watchlist[icao24.toLowerCase()];
  if (!entry) return null;
  const [operator, typeName, category] = entry;
  return {
    operator: operator || null,
    typeName: typeName || null,
    category,
    priority: PRIORITY_CATEGORIES.has(category),
  };
}
