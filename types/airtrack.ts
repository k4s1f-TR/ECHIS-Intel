// Air Track — normalized aircraft contact model.
//
// Every upstream provider (adsb.lol military layer, OpenSky civil layer;
// airplanes.live later as failover) is normalized into this one shape by an
// adapter in lib/airtrack/, so the UI and the map layer never see
// provider-specific fields.

export type AirTrackSource = "adsblol" | "opensky" | "airplaneslive";

export type AirTrackContact = {
  /** ICAO 24-bit hex address — globally unique aircraft key. */
  icao24: string;
  callsign: string | null;
  registration: string | null;
  /** ICAO type designator, e.g. "K35R", "H60". */
  typeCode: string | null;
  /** Full model name resolved from the static DB, e.g. "BOEING CH-47 Chinook". */
  typeName: string | null;
  /** Operator name when the aircraft is on the watchlist. */
  operator: string | null;
  /** plane-alert-db watchlist hit; null when the aircraft is not listed. */
  watchlist: { category: string; priority: boolean } | null;
  /** True when squawking 7500/7600/7700 or broadcasting an emergency state. */
  emergency: boolean;
  lat: number;
  lon: number;
  /** Barometric altitude in feet; null when unknown or on ground. */
  altitudeFt: number | null;
  onGround: boolean;
  groundSpeedKt: number | null;
  /** True track over ground in degrees (0 = north, clockwise). */
  track: number | null;
  verticalRateFpm: number | null;
  squawk: string | null;
  /** Provider-flagged military aircraft. */
  military: boolean;
  source: AirTrackSource;
  /** Age of the last position fix in seconds at collection time. */
  positionAgeSec: number;
  /**
   * Absolute epoch ms of the position fix.  The merge layer compares fixes
   * from different providers only through this clock (monotonic freshness:
   * an older fix never overwrites a newer one).
   */
  posTimestamp: number;
};

export type AirTrackFeedPayload = {
  contacts: AirTrackContact[];
  /** Total aircraft reported upstream (before position filtering). */
  upstreamTotal: number;
  collectedAt: string;
  cacheStatus: "fresh" | "stale";
  source: AirTrackSource;
};

// ---------------------------------------------------------------------------
// On-demand enrichment (/api/airtrack/lookup/[hex]) — registration data,
// flight route and photo for the contact card.  Everything is nullable: each
// upstream (adsbdb, planespotters, hexdb) can independently miss an airframe.
// ---------------------------------------------------------------------------

export type AirTrackLookupAirport = {
  icao: string | null;
  iata: string | null;
  name: string | null;
  municipality: string | null;
  countryName: string | null;
};

export type AirTrackLookupPayload = {
  hex: string;
  registration: string | null;
  typeCode: string | null;
  /** Full model name, e.g. "Boeing 737-8AS". */
  typeName: string | null;
  /** Registered owner / operator. */
  operator: string | null;
  /** Country of registration. */
  countryName: string | null;
  route: {
    callsign: string;
    airline: string | null;
    origin: AirTrackLookupAirport;
    destination: AirTrackLookupAirport;
  } | null;
  photo: {
    thumbnailUrl: string;
    pageUrl: string | null;
    photographer: string | null;
  } | null;
  collectedAt: string;
};
