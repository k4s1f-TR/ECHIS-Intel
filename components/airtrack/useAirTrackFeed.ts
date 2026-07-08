"use client";

import { useEffect, useRef, useState } from "react";
import type { AirTrackContact, AirTrackFeedPayload } from "@/types/airtrack";

// Client poll cadences — each sits just above its server cache TTL (mil 8s,
// global 90s) so every tick lands on a fresh frame without ever multiplying
// upstream traffic.  The 95s global cadence keeps the OpenSky worst case at
// ~909 frames/day = ~3,636 credits, inside the 4,000/day budget; the
// military layer is credit-free, so its cadence is bounded only by polite
// use of adsb.lol.  Between frames, the globe dead-reckons every airborne
// contact along its track, so the picture moves continuously regardless of
// these cadences.
const MIL_POLL_INTERVAL_MS = 10_000;
const GLOBAL_POLL_INTERVAL_MS = 95_000;
// Regional fast lane (adsb.lol point query, credit-free): refreshes all
// traffic around the viewport while the operator is zoomed in.
const REGION_POLL_INTERVAL_MS = 10_000;

export type AirTrackFeedStatus = "loading" | "live" | "stale" | "error";

export type AirTrackFeedState = {
  /** Merged world state, one contact per icao24 (military source wins). */
  contacts: AirTrackContact[];
  /** Military layer status — the primary OSINT layer drives the HUD pill. */
  status: AirTrackFeedStatus;
  /** Civil (OpenSky) layer status; "off" while the civil layer is disabled. */
  civilStatus: AirTrackFeedStatus | "off";
  /** Epoch ms of the last successfully applied frame from either layer. */
  updatedAt: number | null;
};

// Track Store merge — one contact per icao24 across all layers.
//
// Rule 1, monotonic freshness: the record with the newer absolute fix time
// (posTimestamp) carries position and kinematics; an older fix can never
// overwrite a newer one, whatever layer it came from.  This is the only
// thing that prevents jitter when the same airframe is seen by layers
// polling at different cadences (mil 10 s, region 10 s, civil 95 s).
//
// Rule 2, field union: identity fields (callsign, registration, type,
// operator, watchlist) are backfilled from the older record when the newer
// one lacks them; military and emergency flags are OR-ed.
function mergeContacts(a: AirTrackContact, b: AirTrackContact): AirTrackContact {
  const [base, other] = a.posTimestamp >= b.posTimestamp ? [a, b] : [b, a];
  return {
    ...base,
    callsign: base.callsign ?? other.callsign,
    registration: base.registration ?? other.registration,
    typeCode: base.typeCode ?? other.typeCode,
    typeName: base.typeName ?? other.typeName,
    operator: base.operator ?? other.operator,
    watchlist: base.watchlist ?? other.watchlist,
    emergency: base.emergency || other.emergency,
    altitudeFt: base.altitudeFt ?? other.altitudeFt,
    groundSpeedKt: base.groundSpeedKt ?? other.groundSpeedKt,
    track: base.track ?? other.track,
    verticalRateFpm: base.verticalRateFpm ?? other.verticalRateFpm,
    squawk: base.squawk ?? other.squawk,
    military: base.military || other.military,
  };
}

function mergeFrames(
  mil: AirTrackContact[],
  civil: AirTrackContact[],
  region: AirTrackContact[],
): AirTrackContact[] {
  const byId = new Map<string, AirTrackContact>();
  for (const frame of [civil, region, mil]) {
    for (const contact of frame) {
      const previous = byId.get(contact.icao24);
      byId.set(
        contact.icao24,
        previous ? mergeContacts(previous, contact) : contact,
      );
    }
  }
  return Array.from(byId.values());
}

export type AirTrackRegion = { lat: number; lon: number };

// Polls the Air Track proxies while the screen is mounted and the tab is
// visible.  Pauses on document hide so an idle background tab stops consuming
// the shared upstream budget.  The civil layer only polls while enabled —
// toggling it off stops OpenSky traffic entirely.  `region` (the viewport
// center while zoomed in) activates the fast lane; null deactivates it.
export function useAirTrackFeed(
  civilEnabled: boolean,
  region: AirTrackRegion | null,
): AirTrackFeedState {
  const [state, setState] = useState<AirTrackFeedState>({
    contacts: [],
    status: "loading",
    civilStatus: civilEnabled ? "loading" : "off",
    updatedAt: null,
  });
  // Latest raw frame per layer — survives effect re-runs (civil toggle,
  // region moves) so the picture never blinks while a poller restarts.
  const milFrameRef = useRef<AirTrackContact[]>([]);
  const civilFrameRef = useRef<AirTrackContact[]>([]);
  const regionFrameRef = useRef<AirTrackContact[]>([]);

  const regionLat = region?.lat;
  const regionLon = region?.lon;

  useEffect(() => {
    let disposed = false;
    let milInFlight = false;
    let civilInFlight = false;
    let regionInFlight = false;

    function applyMerged(
      patch: Partial<Pick<AirTrackFeedState, "status" | "civilStatus">>,
      frameApplied: boolean,
    ) {
      setState((current) => ({
        contacts: mergeFrames(
          milFrameRef.current,
          civilFrameRef.current,
          regionFrameRef.current,
        ),
        status: patch.status ?? current.status,
        civilStatus: patch.civilStatus ?? current.civilStatus,
        updatedAt: frameApplied ? Date.now() : current.updatedAt,
      }));
    }

    async function fetchLayer(url: string): Promise<AirTrackFeedPayload> {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`feed responded ${res.status}`);
      const payload = (await res.json()) as AirTrackFeedPayload;
      if (!Array.isArray(payload.contacts)) throw new Error("malformed frame");
      return payload;
    }

    async function milTick() {
      if (disposed || milInFlight || document.visibilityState === "hidden")
        return;
      milInFlight = true;
      try {
        const payload = await fetchLayer("/api/airtrack/mil");
        if (disposed) return;
        milFrameRef.current = payload.contacts;
        applyMerged(
          { status: payload.cacheStatus === "stale" ? "stale" : "live" },
          true,
        );
      } catch {
        if (disposed) return;
        // Keep the last good frame on screen; only flag the layer status.
        applyMerged(
          { status: milFrameRef.current.length > 0 ? "stale" : "error" },
          false,
        );
      } finally {
        milInFlight = false;
      }
    }

    async function civilTick() {
      if (
        disposed ||
        !civilEnabled ||
        civilInFlight ||
        document.visibilityState === "hidden"
      )
        return;
      civilInFlight = true;
      try {
        const payload = await fetchLayer("/api/airtrack/global");
        if (disposed) return;
        civilFrameRef.current = payload.contacts;
        applyMerged(
          { civilStatus: payload.cacheStatus === "stale" ? "stale" : "live" },
          true,
        );
      } catch {
        if (disposed) return;
        applyMerged(
          { civilStatus: civilFrameRef.current.length > 0 ? "stale" : "error" },
          false,
        );
      } finally {
        civilInFlight = false;
      }
    }

    async function regionTick() {
      if (
        disposed ||
        regionLat === undefined ||
        regionLon === undefined ||
        regionInFlight ||
        document.visibilityState === "hidden"
      )
        return;
      regionInFlight = true;
      try {
        const payload = await fetchLayer(
          `/api/airtrack/region?lat=${regionLat}&lon=${regionLon}`,
        );
        if (disposed) return;
        regionFrameRef.current = payload.contacts;
        applyMerged({}, true);
      } catch {
        // The fast lane is an accelerator, not a load-bearing layer: on
        // failure the merged picture simply falls back to mil+civil cadence.
      } finally {
        regionInFlight = false;
      }
    }

    function handleVisibility() {
      // Refresh immediately when the operator returns to the tab.
      if (document.visibilityState === "visible") {
        void milTick();
        void civilTick();
        void regionTick();
      }
    }

    if (!civilEnabled) {
      // Drop the civil frame so the merged picture reflects the toggle at once.
      civilFrameRef.current = [];
      applyMerged({ civilStatus: "off" }, false);
    } else {
      applyMerged(
        { civilStatus: civilFrameRef.current.length > 0 ? "stale" : "loading" },
        false,
      );
    }
    if (regionLat === undefined || regionLon === undefined) {
      // Zoomed back out: the fast-lane frame no longer matches the view.
      regionFrameRef.current = [];
      applyMerged({}, false);
    }

    void milTick();
    void civilTick();
    void regionTick();
    const milTimer = window.setInterval(() => void milTick(), MIL_POLL_INTERVAL_MS);
    const civilTimer = window.setInterval(
      () => void civilTick(),
      GLOBAL_POLL_INTERVAL_MS,
    );
    const regionTimer = window.setInterval(
      () => void regionTick(),
      REGION_POLL_INTERVAL_MS,
    );
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      disposed = true;
      window.clearInterval(milTimer);
      window.clearInterval(civilTimer);
      window.clearInterval(regionTimer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [civilEnabled, regionLat, regionLon]);

  return state;
}
