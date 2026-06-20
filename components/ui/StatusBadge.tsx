"use client";
import {
  EventCategory,
  EventSeverity,
  SourceType,
  VerificationStatus,
} from "@/types/event";

type BadgeVariant =
  | EventCategory
  | EventSeverity
  | SourceType
  | VerificationStatus;

// Each badge: [text color, background, border color]
const BADGE_STYLES: Record<string, [string, string, string]> = {
  // Category
  politics:       ["var(--c-elev)",          "var(--c-elev-bg)",        "var(--c-elev-border)"],
  conflict:       ["var(--c-crit)",          "var(--c-crit-bg)",        "var(--c-crit-border)"],
  intel:          ["var(--c-high)",          "var(--c-high-bg)",        "var(--c-high-border)"],
  maritime:       ["var(--c-silver-dim)",    "var(--c-silver-bg)",      "var(--c-silver-border)"],
  humanitarian:   ["var(--c-elev)",          "var(--c-elev-bg)",        "var(--c-elev-border)"],
  energy:         ["var(--c-med)",           "var(--c-med-bg)",         "var(--c-med-border)"],
  air:            ["var(--c-silver-dim)",    "var(--c-silver-bg)",      "var(--c-silver-border)"],
  // Severity
  low:            ["var(--c-elev)",          "var(--c-elev-bg)",        "var(--c-elev-border)"],
  medium:         ["var(--c-med)",           "var(--c-med-bg)",         "var(--c-med-border)"],
  high:           ["var(--c-high)",          "var(--c-high-bg)",        "var(--c-high-border)"],
  critical:       ["var(--c-crit)",          "var(--c-crit-bg)",        "var(--c-crit-border)"],
  // Source
  official:       ["var(--c-elev)",          "var(--c-elev-bg)",        "var(--c-elev-border)"],
  media:          ["var(--c-elev)",          "var(--c-elev-bg)",        "var(--c-elev-border)"],
  specialist:     ["var(--c-high)",          "var(--c-high-bg)",        "var(--c-high-border)"],
  unverified:     ["var(--c-med)",           "var(--c-med-bg)",         "var(--c-med-border)"],
  ngo:            ["var(--c-elev)",          "var(--c-elev-bg)",        "var(--c-elev-border)"],
  maritime_source:["var(--c-silver-dim)",    "var(--c-silver-bg)",      "var(--c-silver-border)"],
  intel_source:   ["var(--c-high)",          "var(--c-high-bg)",        "var(--c-high-border)"],
  // Verification
  confirmed:      ["var(--c-elev)",          "var(--c-elev-bg)",        "var(--c-elev-border)"],
  reported:       ["var(--c-med)",           "var(--c-med-bg)",         "var(--c-med-border)"],
  single_source:  ["var(--c-high)",          "var(--c-high-bg)",        "var(--c-high-border)"],
  disputed:       ["var(--c-crit)",          "var(--c-crit-bg)",        "var(--c-crit-border)"],
};

const BADGE_LABELS: Record<string, string> = {
  politics: "POLITICS", conflict: "CONFLICT", intel: "INTEL",
  maritime: "MARITIME", humanitarian: "HUMANITARIAN", energy: "ENERGY", air: "AIR",
  low: "LOW", medium: "MEDIUM", high: "HIGH", critical: "CRITICAL",
  official: "OFFICIAL", media: "MEDIA", specialist: "SPECIALIST",
  unverified: "UNVERIFIED", ngo: "NGO",
  maritime_source: "MARITIME SOURCE", intel_source: "INTEL SOURCE",
  confirmed: "CONFIRMED", reported: "REPORTED",
  single_source: "SINGLE SOURCE", disputed: "DISPUTED",
};

const FALLBACK: [string, string, string] = [
  "var(--c-elev)",
  "var(--c-elev-bg)",
  "var(--c-elev-border)",
];

export function StatusBadge({ variant }: { variant: BadgeVariant }) {
  const [color, bg, border] = BADGE_STYLES[variant] ?? FALLBACK;
  const label = BADGE_LABELS[variant] ?? variant.toUpperCase().replace(/_/g, " ");

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "1.5px 5px",
        borderRadius: "4px",
        fontSize: "9.5px",
        fontWeight: 600,
        letterSpacing: "0.06em",
        color,
        background: bg,
        border: `1px solid ${border}`,
        lineHeight: 1.4,
      }}
    >
      {label}
    </span>
  );
}
