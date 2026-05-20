"use client";

import { X } from "lucide-react";
import type { IntelWatchMapItem } from "@/data/intel-watch/intelWatchMapItems";

const CONFIDENCE_TONE: Record<string, string> = {
  High: "rgba(160,190,170,0.9)",
  Medium: "rgba(200,180,120,0.9)",
  Low: "rgba(170,170,170,0.85)",
};

const IMPACT_TONE: Record<string, string> = {
  High: "rgba(220,140,110,0.9)",
  Medium: "rgba(200,180,120,0.9)",
  Low: "rgba(150,170,180,0.85)",
};

function MetaRow({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span
        style={{
          fontSize: "8.5px",
          fontWeight: 600,
          color: "rgba(120,135,150,0.7)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: "10px",
          fontWeight: 500,
          color: tone ?? "rgba(195,210,220,0.85)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function IntelWatchMarkerPopup({
  item,
  categoryColor,
  onClose,
  onFocus,
  zIndex,
}: {
  item: IntelWatchMapItem;
  categoryColor: { fill: string; ring: string };
  onClose: () => void;
  onFocus: () => void;
  zIndex: number;
}) {
  return (
    <div
      onMouseDown={onFocus}
      className="flex flex-col"
      style={{
        width: 232,
        background: "rgba(10,14,22,0.92)",
        backdropFilter: "blur(6px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "7px",
        boxShadow: "0 6px 18px rgba(0,0,0,0.45)",
        zIndex,
        pointerEvents: "auto",
      }}
    >
      {/* Header */}
      <div
        className="flex items-start gap-2 px-2.5 py-2"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: categoryColor.fill,
            flexShrink: 0,
            marginTop: 4,
          }}
        />
        <span
          className="flex-1 leading-snug"
          style={{
            fontSize: "10.5px",
            fontWeight: 600,
            color: "rgba(220,230,240,0.92)",
          }}
        >
          {item.title}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="flex-shrink-0 flex items-center justify-center"
          style={{
            width: 16,
            height: 16,
            borderRadius: "3px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
            color: "rgba(180,195,210,0.75)",
            cursor: "pointer",
          }}
          aria-label="Close"
        >
          <X size={9} />
        </button>
      </div>

      {/* Body */}
      <div className="px-2.5 py-2 flex flex-col">
        <MetaRow label="Country / Region" value={item.countryRegion} />
        <div className="flex items-center justify-between py-1">
          <span
            style={{
              fontSize: "8.5px",
              fontWeight: 600,
              color: "rgba(120,135,150,0.7)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Category
          </span>
          <span
            className="px-1.5 py-0.5 rounded"
            style={{
              fontSize: "8.5px",
              fontWeight: 600,
              color: categoryColor.fill,
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${categoryColor.ring}`,
            }}
          >
            {item.category}
          </span>
        </div>
        <MetaRow label="Source" value={item.source} />

        <p
          style={{
            fontSize: "10px",
            color: "rgba(165,180,195,0.78)",
            lineHeight: 1.55,
            marginTop: 6,
            marginBottom: 6,
          }}
        >
          {item.summary}
        </p>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 4 }}>
          <MetaRow
            label="Confidence"
            value={item.confidence}
            tone={CONFIDENCE_TONE[item.confidence]}
          />
          <MetaRow label="Impact" value={item.impact} tone={IMPACT_TONE[item.impact]} />
          <MetaRow label="Last Update" value={item.lastUpdate} />
        </div>
      </div>
    </div>
  );
}
