"use client";

import { useMemo, useState } from "react";
import { Shield } from "lucide-react";
import {
  CyberMap,
  activeHighlightRoles,
  HIGHLIGHT_ROLE_LABEL,
  HIGHLIGHT_ROLE_SWATCH,
} from "./CyberMap";
import type { RegionMetric } from "@/lib/cyber";
import { CyberNewsPanel } from "./CyberNewsPanel";
import { ThreatContextPanel } from "./ThreatContextPanel";
import { MostMentionedRegionsPanel } from "./MostMentionedRegionsPanel";
import { AffectedSectorsPanel } from "./AffectedSectorsPanel";
import { useCyberNewsFeed } from "./useCyberNewsFeed";
import { analyzeCyberSignals } from "@/lib/cyber";

function MapInfoStrip({
  itemCount,
  isLoading,
  hasError,
  regions,
}: {
  itemCount: number;
  isLoading: boolean;
  hasError: boolean;
  regions: RegionMetric[];
}) {
  const status = isLoading ? "Syncing" : hasError ? "Unavailable" : "Live";
  const legendRoles = activeHighlightRoles(regions);

  return (
    <div
      className="flex flex-shrink-0 flex-wrap items-center gap-[10px]"
      style={{
        padding: "9px 15px",
        borderTop: "1px solid var(--c-border-2)",
        background: "rgba(4,3,5,0.65)",
      }}
    >
      <div className="flex items-center gap-[6px]">
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "var(--c-accent)",
            boxShadow: "0 0 7px var(--c-accent-glow)",
          }}
        />
        <span
          style={{
            fontSize: "var(--c-fs-xs)",
            fontWeight: 700,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            color: "var(--c-t5)",
          }}
        >
          Source
        </span>
        <span
          className="c-mono"
          style={{
            fontSize: "var(--c-fs-xs)",
            fontWeight: 500,
            color: "var(--c-t3)",
          }}
        >
          The Hacker News
        </span>
      </div>
      <span
        className="c-disp"
        style={{
          padding: "2.5px 7px",
          borderRadius: "var(--c-radius-xs)",
          fontSize: "var(--c-fs-2xs)",
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--c-elev)",
          background: "var(--c-elev-bg)",
          border: "1px solid var(--c-elev-border)",
        }}
      >
        RSS
      </span>
      <span style={{ fontSize: "var(--c-fs-xs)", color: "var(--c-t4)" }}>
        {status}
      </span>
      {legendRoles.length > 0 ? (
        <div className="flex items-center gap-[11px]" style={{ marginLeft: 4 }}>
          {legendRoles.map((role) => (
            <div key={role} className="flex items-center gap-[5px]">
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 2,
                  background: HIGHLIGHT_ROLE_SWATCH[role],
                  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
                }}
              />
              <span
                style={{
                  fontSize: "var(--c-fs-2xs)",
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--c-t4)",
                }}
              >
                {HIGHLIGHT_ROLE_LABEL[role]}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="flex-1" />
      <div className="flex items-center gap-[6px]">
        <span
          style={{
            fontSize: "var(--c-fs-xs)",
            fontWeight: 700,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            color: "var(--c-t5)",
          }}
        >
          RSS Items
        </span>
        <span
          className="c-mono"
          style={{
            fontSize: "var(--c-fs-xs)",
            fontWeight: 500,
            color: "var(--c-accent-text)",
          }}
        >
          {itemCount}
        </span>
      </div>
    </div>
  );
}

export function CyberSecPanel() {
  const cyberNewsFeed = useCyberNewsFeed();
  const displayedNewsItems = useMemo(
    () => cyberNewsFeed.items,
    [cyberNewsFeed.items],
  );
  const [requestedNewsId, setRequestedNewsId] = useState("");
  const selectedNewsId = displayedNewsItems.some(
    (item) => item.id === requestedNewsId,
  )
    ? requestedNewsId
    : (displayedNewsItems[0]?.id ?? "");

  // Region + sector metrics inferred from the live RSS title+summary text.
  // No mock data: panels render only what the open-source feed text yields.
  const signals = useMemo(
    () =>
      analyzeCyberSignals(
        displayedNewsItems.map((item) => ({
          id: item.id,
          title: item.headline,
          summary: item.summary,
        })),
      ),
    [displayedNewsItems],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <main
        className="flex min-h-0 flex-1 overflow-hidden"
        style={{ gap: 10, padding: 10 }}
      >
        <div
          className="flex min-h-0 min-w-0 flex-col"
          style={{ flex: "2 1 0%", gap: 10 }}
        >
          <div className="cyber-panel flex-1">
            <div className="cyber-panel-head">
              <div className="flex items-center gap-[9px]">
                <Shield size={15} style={{ color: "var(--c-silver-dim)" }} />
                <span className="cyber-panel-title">Global Threat Map</span>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <CyberMap regions={signals.regions} />
            </div>
            <MapInfoStrip
              itemCount={displayedNewsItems.length}
              isLoading={cyberNewsFeed.isLoading}
              hasError={Boolean(cyberNewsFeed.error)}
              regions={signals.regions}
            />
          </div>

          <div
            className="flex min-w-0 flex-shrink-0"
            style={{ height: 264, gap: 10 }}
          >
            <div className="min-w-0" style={{ flex: "0 0 304px" }}>
              <MostMentionedRegionsPanel
                regions={signals.regions}
                isLoading={cyberNewsFeed.isLoading}
                hasError={Boolean(cyberNewsFeed.error)}
              />
            </div>
            <div className="min-w-0 flex-1">
              <AffectedSectorsPanel
                sectors={signals.sectors}
                isLoading={cyberNewsFeed.isLoading}
                hasError={Boolean(cyberNewsFeed.error)}
              />
            </div>
          </div>
        </div>

        <div className="min-h-0 min-w-0" style={{ flex: "1.15 1 0%" }}>
          <CyberNewsPanel
            selectedNewsId={selectedNewsId}
            onSelectNews={setRequestedNewsId}
            items={displayedNewsItems}
            isLoading={cyberNewsFeed.isLoading}
            isLive={cyberNewsFeed.items.length > 0}
            error={cyberNewsFeed.error}
          />
        </div>

        <div className="min-h-0 min-w-0" style={{ flex: "1 1 0%" }}>
          <ThreatContextPanel
            selectedNewsId={selectedNewsId}
            items={displayedNewsItems}
          />
        </div>
      </main>
    </div>
  );
}
