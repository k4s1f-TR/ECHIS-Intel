import type { EventSeverity } from "@/types/event";

type SeverityStyle = {
  text: string;
  bg: string;
  border: string;
};

export const SEVERITY_COLORS: Record<EventSeverity, SeverityStyle> = {
  critical: {
    text: "var(--sev-critical-text)",
    bg: "var(--sev-critical-bg)",
    border: "var(--sev-critical-border)",
  },
  high: {
    text: "var(--sev-high-text)",
    bg: "var(--sev-high-bg)",
    border: "var(--sev-high-border)",
  },
  medium: {
    text: "var(--sev-medium-text)",
    bg: "var(--sev-medium-bg)",
    border: "var(--sev-medium-border)",
  },
  low: {
    text: "var(--sev-low-text)",
    bg: "var(--sev-low-bg)",
    border: "var(--sev-low-border)",
  },
};

export type SeverityFilter = "all" | EventSeverity;

export const SEVERITY_PILL_ACTIVE: Record<
  SeverityFilter,
  { text: string; border: string; bg: string }
> = {
  all: {
    text: "var(--icon-active)",
    border: "var(--border-accent)",
    bg: "var(--accent-blue-bg)",
  },
  critical: {
    text: "var(--sev-critical-text)",
    border: "rgba(239, 68, 68, 0.5)",
    bg: "rgba(239, 68, 68, 0.12)",
  },
  high: {
    text: "var(--sev-high-text)",
    border: "rgba(249, 115, 22, 0.5)",
    bg: "rgba(249, 115, 22, 0.12)",
  },
  medium: {
    text: "var(--sev-medium-text)",
    border: "rgba(234, 179, 8, 0.5)",
    bg: "rgba(234, 179, 8, 0.12)",
  },
  low: {
    text: "var(--sev-low-text)",
    border: "rgba(100, 100, 100, 0.4)",
    bg: "rgba(100, 100, 100, 0.1)",
  },
};
