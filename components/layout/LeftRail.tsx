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
  action?: "bookmarks";
};

const topIcons: RailItem[] = [
  { icon: Globe, label: "Global View", viewKey: "global" },
  { icon: Radio, label: "SOCMINT Watch", viewKey: "signals" },
  { icon: Plane, label: "Air Track" },
  { icon: Ship, label: "Ship Track" },
  { icon: Bookmark, label: "Bookmarks", action: "bookmarks" },
  { icon: BarChart2, label: "Analytics" },
];

const bottomIcons = [{ icon: LogOut, label: "Exit" }];

function RailIcon({
  icon: Icon,
  label,
  active = false,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      className="relative w-full flex items-center justify-center h-10 rounded-lg transition-all duration-200 group"
      style={
        active
          ? {
              background: "var(--accent-blue-bg)",
              color: "var(--icon-active)",
            }
          : {
              color: "var(--icon-default)",
            }
      }
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.color = "var(--icon-hover)";
          (e.currentTarget as HTMLElement).style.background = "var(--bg-surface-hover)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.color = "var(--icon-default)";
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }
      }}
    >
      {/* Active left bar */}
      {active && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-r-full"
          style={{ background: "var(--accent-blue-text)" }}
        />
      )}
      <Icon size={16} strokeWidth={active ? 1.8 : 1.5} />
    </button>
  );
}

export function LeftRail({
  activeView,
  activeBookmarks,
  onViewChange,
  onBookmarks,
  onHome,
}: {
  activeView: ViewMode | null;
  activeBookmarks: boolean;
  onViewChange: (view: ViewMode) => void;
  onBookmarks: () => void;
  onHome: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center py-3 flex-shrink-0"
      style={{
        width: "68px",
        minWidth: "68px",
        background: "var(--bg-shell)",
        borderRight: "1px solid var(--border-dim)",
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
            background: "linear-gradient(145deg, #0f2545 0%, #091830 100%)",
            border: "1px solid var(--accent-blue-border)",
            boxShadow: "0 0 14px var(--accent-blue-glow)",
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
            active={
              item.action === "bookmarks"
                ? activeBookmarks
                : item.viewKey !== undefined
                  ? activeView === item.viewKey
                  : false
            }
            onClick={
              item.action === "bookmarks"
                ? onBookmarks
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
