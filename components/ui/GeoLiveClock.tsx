"use client";

import { useEffect, useMemo, useState } from "react";

type ClientTimezoneResponse = {
  timezone: string;
  city: string | null;
  region: string | null;
  country: string | null;
  source: "findip" | "fallback";
};

const FALLBACK_TIMEZONE = "UTC";

const COUNTRY_LABEL_BY_NAME: Record<string, string> = {
  tr: "Türkiye",
  turkey: "Türkiye",
  turkiye: "Türkiye",
  türkiye: "Türkiye",
  us: "US",
  usa: "US",
  "united states": "US",
  "united states of america": "US",
};

function formatClock(timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: FALLBACK_TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date());
  }
}

function countryLabel(country: string | null): string | null {
  if (!country) return null;

  const trimmed = country.trim();
  return COUNTRY_LABEL_BY_NAME[trimmed.toLowerCase()] ?? trimmed;
}

function samePlace(a: string | null | undefined, b: string | null | undefined): boolean {
  return a?.trim().toLowerCase() === b?.trim().toLowerCase();
}

export function GeoLiveClock() {
  const [clock, setClock] = useState("--:--:--");
  const [timezone, setTimezone] = useState<string | null>(null);
  const [location, setLocation] = useState<Pick<
    ClientTimezoneResponse,
    "city" | "region" | "country" | "source"
  > | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function resolveTimezone() {
      try {
        const response = await fetch("/api/client-timezone", {
          cache: "no-store",
        });

        if (!response.ok) throw new Error("timezone_request_failed");

        const data = (await response.json()) as ClientTimezoneResponse;
        if (!cancelled) {
          setTimezone(data.timezone || FALLBACK_TIMEZONE);
          setLocation({
            city: data.city,
            region: data.region,
            country: data.country,
            source: data.source,
          });
        }
      } catch {
        if (!cancelled) {
          setTimezone(FALLBACK_TIMEZONE);
          setLocation({
            city: null,
            region: null,
            country: null,
            source: "fallback",
          });
        }
      }
    }

    void resolveTimezone();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!timezone) return;

    const updateClock = () => {
      setClock(formatClock(timezone));
    };

    updateClock();
    const intervalId = window.setInterval(updateClock, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [timezone]);

  const locationText = useMemo(() => {
    if (!location) return null;

    const city = location.city;
    const region =
      location.region && !samePlace(location.region, city) ? location.region : null;
    const country = countryLabel(location.country);

    if (city && region) return `${city}, ${region}`;
    if (city && country) return `${city}, ${country}`;
    if (region && country) return `${region}, ${country}`;

    return city ?? region ?? country;
  }, [location]);

  const title = useMemo(() => {
    if (!timezone) return "Resolving clock location";
    if (locationText) return locationText;
    if (location?.source === "fallback") return "UTC fallback";
    return timezone;
  }, [location, locationText, timezone]);

  return (
    <span
      aria-label={`Current time, ${title}`}
      className="flex flex-col items-center leading-none"
      title={title}
    >
      <span className="font-mono tabular-nums tracking-[0.16em]">{clock}</span>

      {locationText ? (
        <span className="mt-1 max-w-[132px] truncate text-[9px] tracking-[0.08em] text-zinc-500">
          {locationText}
        </span>
      ) : null}
    </span>
  );
}
