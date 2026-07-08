import type {
  AirTrackLookupAirport,
  AirTrackLookupPayload,
} from "@/types/airtrack";

// On-demand enrichment for a single airframe.  Three independent upstreams
// are queried in parallel; any of them may miss and the payload degrades
// field by field instead of failing whole:
//   adsbdb        — registration / type / operator, and flight route by
//                   callsign (also proxies planespotters photo URLs)
//   planespotters — photo with photographer credit (preferred over adsbdb's
//                   copy because it carries attribution)
//   hexdb         — registration/type fallback when adsbdb misses the hex
// All are free, keyless, and fine with light per-aircraft click traffic.
const ADSBDB_BASE = "https://api.adsbdb.com/v0";
const PLANESPOTTERS_PHOTO_URL = "https://api.planespotters.net/pub/photos/hex";
const HEXDB_AIRCRAFT_URL = "https://hexdb.io/api/v1/aircraft";
const UPSTREAM_TIMEOUT_MS = 10_000;

const HEX_RE = /^[0-9a-f]{6}$/;
const CALLSIGN_RE = /^[a-z0-9]{2,8}$/i;

type AdsbdbAircraft = {
  type?: string;
  icao_type?: string;
  manufacturer?: string;
  registration?: string;
  registered_owner?: string;
  registered_owner_country_name?: string;
  url_photo?: string | null;
  url_photo_thumbnail?: string | null;
};

type AdsbdbAirport = {
  name?: string;
  icao_code?: string;
  iata_code?: string;
  municipality?: string;
  country_name?: string;
};

type AdsbdbFlightroute = {
  callsign?: string;
  airline?: { name?: string } | null;
  origin?: AdsbdbAirport;
  destination?: AdsbdbAirport;
};

type PlanespottersPhoto = {
  thumbnail_large?: { src?: string };
  thumbnail?: { src?: string };
  link?: string;
  photographer?: string;
};

type HexdbAircraft = {
  Registration?: string;
  ICAOTypeCode?: string;
  Type?: string;
  Manufacturer?: string;
  RegisteredOwners?: string;
};

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${url} responded ${response.status}`);
  return response.json();
}

// adsbdb wraps every result as { response: ... } and signals a miss with a
// string body ("unknown aircraft" / "unknown callsign").
function adsbdbResponse(body: unknown): unknown {
  if (!body || typeof body !== "object") return null;
  const inner = (body as { response?: unknown }).response;
  return inner && typeof inner === "object" ? inner : null;
}

async function fetchAdsbdbAircraft(hex: string): Promise<AdsbdbAircraft | null> {
  const inner = adsbdbResponse(await fetchJson(`${ADSBDB_BASE}/aircraft/${hex}`));
  const aircraft = (inner as { aircraft?: unknown } | null)?.aircraft;
  return aircraft && typeof aircraft === "object"
    ? (aircraft as AdsbdbAircraft)
    : null;
}

async function fetchAdsbdbRoute(
  callsign: string,
): Promise<AdsbdbFlightroute | null> {
  const inner = adsbdbResponse(
    await fetchJson(`${ADSBDB_BASE}/callsign/${callsign}`),
  );
  const route = (inner as { flightroute?: unknown } | null)?.flightroute;
  return route && typeof route === "object"
    ? (route as AdsbdbFlightroute)
    : null;
}

async function fetchPlanespottersPhoto(
  hex: string,
): Promise<PlanespottersPhoto | null> {
  const body = await fetchJson(`${PLANESPOTTERS_PHOTO_URL}/${hex}`);
  const photos = (body as { photos?: unknown } | null)?.photos;
  return Array.isArray(photos) && photos.length > 0
    ? (photos[0] as PlanespottersPhoto)
    : null;
}

async function fetchHexdbAircraft(hex: string): Promise<HexdbAircraft | null> {
  const body = await fetchJson(`${HEXDB_AIRCRAFT_URL}/${hex}`);
  return body && typeof body === "object" ? (body as HexdbAircraft) : null;
}

function toAirport(airport: AdsbdbAirport | undefined): AirTrackLookupAirport {
  return {
    icao: cleanString(airport?.icao_code),
    iata: cleanString(airport?.iata_code),
    name: cleanString(airport?.name),
    municipality: cleanString(airport?.municipality),
    countryName: cleanString(airport?.country_name),
  };
}

function settled<T>(result: PromiseSettledResult<T | null>): T | null {
  return result.status === "fulfilled" ? result.value : null;
}

export async function fetchAirTrackLookup(
  hexRaw: string,
  callsignRaw: string | null,
): Promise<AirTrackLookupPayload> {
  const hex = hexRaw.toLowerCase();
  if (!HEX_RE.test(hex)) {
    // Non-ICAO addresses (TIS-B "~" prefixes etc.) have no registry entry —
    // return an empty enrichment instead of querying upstreams with garbage.
    return emptyPayload(hexRaw);
  }
  const callsign =
    callsignRaw && CALLSIGN_RE.test(callsignRaw.trim())
      ? callsignRaw.trim().toUpperCase()
      : null;

  const [aircraftResult, routeResult, photoResult] = await Promise.allSettled([
    fetchAdsbdbAircraft(hex),
    callsign ? fetchAdsbdbRoute(callsign) : Promise.resolve(null),
    fetchPlanespottersPhoto(hex),
  ]);
  const aircraft = settled(aircraftResult);
  const route = settled(routeResult);
  const photo = settled(photoResult);

  // hexdb is a second round-trip, so only pay for it when adsbdb missed.
  let hexdb: HexdbAircraft | null = null;
  if (!aircraft) {
    const hexdbResult = await Promise.allSettled([fetchHexdbAircraft(hex)]);
    hexdb = settled(hexdbResult[0]);
  }

  const manufacturer = cleanString(aircraft?.manufacturer);
  const model = cleanString(aircraft?.type);
  const typeName =
    manufacturer && model
      ? `${manufacturer} ${model}`
      : (model ?? manufacturer ?? cleanString(hexdb?.Type));

  const photoThumb =
    cleanString(photo?.thumbnail_large?.src) ??
    cleanString(photo?.thumbnail?.src) ??
    cleanString(aircraft?.url_photo_thumbnail);

  return {
    hex,
    registration:
      cleanString(aircraft?.registration) ?? cleanString(hexdb?.Registration),
    typeCode:
      cleanString(aircraft?.icao_type) ?? cleanString(hexdb?.ICAOTypeCode),
    typeName,
    operator:
      cleanString(aircraft?.registered_owner) ??
      cleanString(hexdb?.RegisteredOwners),
    countryName: cleanString(aircraft?.registered_owner_country_name),
    route:
      route && callsign
        ? {
            callsign,
            airline: cleanString(route.airline?.name),
            origin: toAirport(route.origin),
            destination: toAirport(route.destination),
          }
        : null,
    photo: photoThumb
      ? {
          thumbnailUrl: photoThumb,
          pageUrl: cleanString(photo?.link) ?? cleanString(aircraft?.url_photo),
          photographer: cleanString(photo?.photographer),
        }
      : null,
    collectedAt: new Date().toISOString(),
  };
}

function emptyPayload(hex: string): AirTrackLookupPayload {
  return {
    hex,
    registration: null,
    typeCode: null,
    typeName: null,
    operator: null,
    countryName: null,
    route: null,
    photo: null,
    collectedAt: new Date().toISOString(),
  };
}
