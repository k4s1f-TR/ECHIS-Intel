"use client";
import {
  Globe,
  Radio,
  Plane,
  Ship,
  Bookmark,
  BarChart2,
  LogOut,
  Eye,
} from "lucide-react";
import type { ViewMode } from "./AppShell";

type RailItem = {
  icon: React.ElementType;
  label: string;
  viewKey?: ViewMode;
  action?: "bookmarks" | "airtrack";
  /** Planned feature — rendered dimmed with a SOON badge, not clickable. */
  soon?: boolean;
};

const topIcons: RailItem[] = [
  { icon: Globe, label: "Global View", viewKey: "global" },
  { icon: Radio, label: "SOCMINT Watch", viewKey: "signals" },
  { icon: Plane, label: "Air Track", action: "airtrack" },
  { icon: Ship, label: "Ship Track", soon: true },
  { icon: Bookmark, label: "Bookmarks", action: "bookmarks" },
  { icon: BarChart2, label: "Analytics", soon: true },
];

const bottomIcons: RailItem[] = [{ icon: LogOut, label: "Exit", soon: true }];

function RailIcon({
  icon: Icon,
  label,
  active = false,
  soon = false,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  soon?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      title={soon ? `${label} — coming soon` : label}
      aria-label={soon ? `${label} (coming soon)` : label}
      aria-disabled={soon || undefined}
      onClick={soon ? undefined : onClick}
      className="relative w-full flex items-center justify-center h-10 rounded-lg transition-all duration-200 group"
      style={
        active
          ? {
              background: "var(--accent-blue-bg)",
              color: "var(--icon-active)",
            }
          : {
              color: "var(--icon-default)",
              opacity: soon ? 0.55 : 1,
              cursor: soon ? "default" : "pointer",
            }
      }
      onMouseEnter={(e) => {
        if (!active && !soon) {
          (e.currentTarget as HTMLElement).style.color = "var(--icon-hover)";
          (e.currentTarget as HTMLElement).style.background = "var(--bg-surface-hover)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active && !soon) {
          (e.currentTarget as HTMLElement).style.color = "var(--icon-default)";
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }
      }}
    >
      {/* Active left bar */}
      {active && (
        <span
          className="rail-active-indicator absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-r-full"
          style={{ background: "var(--accent-blue-text)" }}
        />
      )}
      <Icon size={16} strokeWidth={active ? 1.8 : 1.5} />
      {soon && (
        <span
          aria-hidden
          className="absolute select-none uppercase"
          style={{
            top: "3px",
            right: "3px",
            fontSize: "6.5px",
            fontWeight: 800,
            letterSpacing: "0.08em",
            lineHeight: 1,
            padding: "2px 3px",
            borderRadius: "4px",
            color: "var(--c-t5)",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          Soon
        </span>
      )}
    </button>
  );
}

export function LeftRail({
  activeView,
  activeBookmarks,
  activeAirTrack,
  onViewChange,
  onBookmarks,
  onAirTrack,
  onHome,
}: {
  activeView: ViewMode | null;
  activeBookmarks: boolean;
  activeAirTrack: boolean;
  onViewChange: (view: ViewMode) => void;
  onBookmarks: () => void;
  onAirTrack: () => void;
  onHome: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center py-3 flex-shrink-0"
      style={{
        width: "68px",
        minWidth: "68px",
        background: "#050506",
        borderRight: "1px solid var(--c-border-2)",
        boxShadow: "1px 0 0 rgba(255,255,255,0.02) inset",
      }}
    >
      {/* Logo mark */}
      <div className="mb-5 mt-1">
        <button
          type="button"
          title="Monitor home"
          aria-label="Monitor home"
          onClick={onHome}
          className="w-8 h-8 rounded-[9px] flex items-center justify-center"
          style={{
            background: "linear-gradient(145deg, #4a1418 0%, #1c0b0e 100%)",
            border: "1px solid var(--accent-blue-border)",
          }}
        >
          <Eye size={16} strokeWidth={1.6} color="var(--accent-blue-text)" />
        </button>
      </div>

      {/* Primary nav icons */}
      <div className="flex flex-col w-full px-2 gap-0.5 flex-1">
        {topIcons.map((item) => (
          <RailIcon
            key={item.label}
            icon={item.icon}
            label={item.label}
            soon={item.soon}
            active={
              item.action === "bookmarks"
                ? activeBookmarks
                : item.action === "airtrack"
                  ? activeAirTrack
                  : item.viewKey !== undefined
                    ? activeView === item.viewKey
                    : false
            }
            onClick={
              item.action === "bookmarks"
                ? onBookmarks
                : item.action === "airtrack"
                  ? onAirTrack
                  : item.viewKey !== undefined
                    ? () => onViewChange(item.viewKey!)
                    : undefined
            }
          />
        ))}
      </div>

      {/* Footer icons */}
      <div className="flex flex-col w-full px-2 gap-0.5 mt-2">
        <div
          className="mx-1 mb-2"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        />
        {bottomIcons.map((item) => (
          <RailIcon key={item.label} {...item} />
        ))}
      </div>
    </div>
  );
}
