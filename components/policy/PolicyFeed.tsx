"use client";

import { POLICY_SEV, type PolicyReport } from "@/types/policy";
import { fmtAgo, minutesAgo } from "./policyView";

function FeedCard({
  item,
  selected,
  onSelect,
}: {
  item: PolicyReport;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className="relative cursor-pointer"
      style={{ padding: "16px 22px" }}
    >
      {selected && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,43,61,0.14), rgba(255,43,61,0.03))",
            borderLeft: "2px solid var(--c-accent)",
          }}
        />
      )}
      <div className="relative" style={{ zIndex: 1 }}>
        <div className="flex items-center gap-2" style={{ marginBottom: "9px" }}>
          <span
            className="flex-none rounded-full"
            style={{ width: "6px", height: "6px", background: POLICY_SEV[item.sev].color }}
          />
          <span
            className="c-mono uppercase"
            style={{ fontSize: "9.5px", letterSpacing: ".1em", color: "var(--c-t4)" }}
          >
            {item.topic}
          </span>
          <span className="flex-1" />
          <span className="c-mono" style={{ fontSize: "9.5px", color: "var(--c-t5)" }}>
            {fmtAgo(minutesAgo(item))}
          </span>
        </div>
        <div
          className="pd-serif"
          style={{
            fontSize: "16px",
            fontWeight: 500,
            lineHeight: 1.34,
            color: "rgba(238,240,244,0.96)",
            marginBottom: "8px",
            textWrap: "pretty",
          }}
        >
          {item.title}
        </div>
        <div
          className="c-mono flex items-center"
          style={{ gap: "7px", fontSize: "9.5px", letterSpacing: ".04em", color: "var(--c-silver-dim)" }}
        >
          <span>
            {item.source} · {item.sourceType}
          </span>
          {item.stateAffiliated && (
            <span
              title="Publicly documented as state-owned or state-funded"
              className="uppercase"
              style={{
                fontSize: "8px",
                fontWeight: 700,
                letterSpacing: ".09em",
                lineHeight: 1,
                padding: "2.5px 5px",
                borderRadius: "4px",
                color: "var(--c-t4)",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.12)",
                whiteSpace: "nowrap",
              }}
            >
              State
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function PolicyFeed({
  items,
  selectedId,
  time,
  isLoading,
  error,
  onSelect,
}: {
  items: PolicyReport[];
  selectedId: string | null;
  time: number;
  isLoading: boolean;
  error: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      className="flex flex-none flex-col min-h-0"
      style={{
        // Slightly narrower + a touch zoomed out. Height is divided by the
        // zoom factor so the scaled column still fills the full panel height
        // (no empty strip at the bottom). Right meta column is untouched.
        width: "416px",
        height: "calc(100% / 0.93)",
        zoom: 0.93,
        borderRight: "1px solid var(--c-border-3)",
      }}
    >
      <div
        className="flex flex-none items-center justify-between"
        style={{ height: "40px", padding: "0 22px" }}
      >
        <span
          className="c-mono uppercase"
          style={{ fontSize: "10px", letterSpacing: ".16em", color: "var(--c-t4)" }}
        >
          Latest
        </span>
        <span className="c-mono" style={{ fontSize: "10px", color: "var(--c-t5)" }}>
          {items.length} · {time}H
        </span>
      </div>
      <div
        className="tm-scrollbar flex-1 min-h-0 overflow-y-auto"
        style={{ padding: "4px 0 20px 0" }}
      >
        {isLoading ? (
          <div
            className="flex h-full flex-col items-center justify-center gap-1 px-6 text-center"
            style={{ fontSize: "11.5px", color: "var(--c-t5)" }}
          >
            <span style={{ color: "var(--c-t4)", fontWeight: 600 }}>Loading live policy feed</span>
            <span>Collecting public RSS reports.</span>
          </div>
        ) : error ? (
          <div
            className="flex h-full flex-col items-center justify-center gap-1 px-6 text-center"
            style={{ fontSize: "11.5px", color: "var(--c-t5)" }}
          >
            <span style={{ color: "var(--c-t4)", fontWeight: 600 }}>Live feed unavailable</span>
            <span>All configured sources failed to respond.</span>
          </div>
        ) : items.length === 0 ? (
          <div
            className="flex h-full flex-col items-center justify-center gap-1 px-6 text-center"
            style={{ fontSize: "11.5px", color: "var(--c-t5)" }}
          >
            <span style={{ color: "var(--c-t4)", fontWeight: 600 }}>No reports in view</span>
            <span>Widen the time window or clear the search.</span>
          </div>
        ) : (
          items.map((item) => (
            <FeedCard
              key={item.id}
              item={item}
              selected={selectedId === item.id}
              onSelect={() => onSelect(item.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
