// Air Track — normalized aircraft contact model.
//
// Every upstream provider (adsb.lol today; airplanes.live / OpenSky later)
// is normalized into this one shape by an adapter in lib/airtrack/, so the
// UI and the map layer never see provider-specific fields.

export type AirTrackSource = "adsblol";

export type AirTrackContact = {
  /** ICAO 24-bit hex address — globally unique aircraft key. */
  icao24: string;
  callsign: string | null;
  registration: string | null;
  /** ICAO type designator, e.g. "K35R", "H60". */
  typeCode: string | null;
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
};

export type AirTrackFeedPayload = {
  contacts: AirTrackContact[];
  /** Total aircraft reported upstream (before position filtering). */
  upstreamTotal: number;
  collectedAt: string;
  cacheStatus: "fresh" | "stale";
  source: AirTrackSource;
};
