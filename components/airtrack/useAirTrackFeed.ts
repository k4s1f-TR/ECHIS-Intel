"use client";

import { useEffect, useRef, useState } from "react";
import type { AirTrackContact, AirTrackFeedPayload } from "@/types/airtrack";

// Client poll cadence — matches the server cache TTL (25s) so every tick
// lands on a fresh frame without ever multiplying upstream traffic.
const POLL_INTERVAL_MS = 30_000;

export type AirTrackFeedStatus = "loading" | "live" | "stale" | "error";

export type AirTrackFeedState = {
  contacts: AirTrackContact[];
  status: AirTrackFeedStatus;
  /** Epoch ms of the last successfully applied frame. */
  updatedAt: number | null;
};

// Polls the Air Track military-layer proxy while the screen is mounted and
// the tab is visible.  Pauses on document hide so an idle background tab
// stops consuming the shared upstream budget.
export function useAirTrackFeed(): AirTrackFeedState {
  const [state, setState] = useState<AirTrackFeedState>({
    contacts: [],
    status: "loading",
    updatedAt: null,
  });
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let disposed = false;
    let inFlight = false;

    async function tick() {
      if (disposed || inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        const res = await fetch("/api/airtrack/mil", {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`feed responded ${res.status}`);
        const payload = (await res.json()) as AirTrackFeedPayload;
        if (disposed || !Array.isArray(payload.contacts)) return;
        setState({
          contacts: payload.contacts,
          status: payload.cacheStatus === "stale" ? "stale" : "live",
          updatedAt: Date.now(),
        });
      } catch {
        if (disposed) return;
        // Keep the last good frame on screen; only flag the status.
        setState((current) => ({
          ...current,
          status: current.contacts.length > 0 ? "stale" : "error",
        }));
      } finally {
        inFlight = false;
      }
    }

    function handleVisibility() {
      // Refresh immediately when the operator returns to the tab.
      if (document.visibilityState === "visible") void tick();
    }

    void tick();
    timerRef.current = window.setInterval(() => void tick(), POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      disposed = true;
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return state;
}
