"use client";
import { Sun } from "lucide-react";
import { GeoLiveClock } from "@/components/ui/GeoLiveClock";
import type { ReactNode } from "react";

type TopNavTab = "situation" | "politics" | "intel" | "cyber" | "defense" | "sources" | "contact";

const NAV_TABS: { label: string; key?: TopNavTab }[] = [
  { label: "Monitor", key: "situation" },
  { label: "Intel Watch", key: "intel" },
  { label: "Cyber News", key: "cyber" },
  { label: "Defense Industry", key: "defense" },
  { label: "Policy", key: "politics" },
  { label: "Sources", key: "sources" },
  { label: "Contact", key: "contact" },
];

function IconBtn({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors duration-150 ${className}`}
      style={{ color: "var(--icon-default)" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.color = "var(--icon-hover)";
        (e.currentTarget as HTMLElement).style.background = "var(--bg-surface-hover)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.color = "var(--icon-default)";
        (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      {children}
    </button>
  );
}

export function HeaderNav({
  activeTab,
  onTabSelect,
}: {
  activeTab: TopNavTab;
  onTabSelect: (tab: TopNavTab) => void;
}) {
  return (
    <header
      className="flex items-center flex-shrink-0 px-5"
      style={{
        height: "52px",
        background: "linear-gradient(180deg, #09090b 0%, #050506 100%)",
        borderBottom: "1px solid var(--c-border-2)",
        boxShadow: "0 1px 0 rgba(255,255,255,0.035) inset",
      }}
    >
      {/* Brand */}
      <div className="flex flex-col justify-center mr-10" style={{ minWidth: "208px" }}>
        <span
          className="leading-none font-bold uppercase"
          style={{
            fontFamily: "var(--font-display), 'Space Grotesk', sans-serif",
            fontSize: "20px",
            fontWeight: 700,
            letterSpacing: "0.18em",
            background: "linear-gradient(180deg, #ff5d6a 0%, #ff3548 52%, #d4172a 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            WebkitTextStroke: "0.8px #ff3548",
            color: "#ff3548",
            filter: "drop-shadow(0 1px 6px rgba(255,43,61,0.26))",
          }}
        >
          E C H I S
        </span>
      </div>

      {/* Nav */}
      <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
        {NAV_TABS.map((tab) => {
          const tabKey = tab.key;
          const active = tabKey === activeTab;
          return (
            <button
              key={tab.label}
              onClick={tabKey ? () => onTabSelect(tabKey) : undefined}
              className="relative flex h-full flex-shrink-0 items-center whitespace-nowrap px-2.5 transition-opacity duration-150 sm:px-3"
              style={{
                height: "52px",
                fontSize: "13.5px",
                fontWeight: active ? 700 : 600,
                letterSpacing: "0.01em",
                opacity: active ? 1 : 0.5,
                cursor: tabKey ? "pointer" : "default",
              }}
              onMouseEnter={(e) => {
                if (!active)
                  (e.currentTarget as HTMLElement).style.opacity = "0.85";
              }}
              onMouseLeave={(e) => {
                if (!active)
                  (e.currentTarget as HTMLElement).style.opacity = "0.5";
              }}
            >
              <span className="accent-grad-text">{tab.label}</span>
              {active && (
                <span
                  className="absolute bottom-0 left-2 right-2 h-[2px] rounded-t-full"
                  style={{ background: "var(--accent-grad)" }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Right controls */}
      <div className="flex items-center gap-1">
        {/* Live IP timezone clock */}
        <div
          className="flex items-center mr-2 px-2.5 py-1 rounded-md select-none"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-primary)",
            fontSize: "var(--fs-md)",
            fontWeight: 500,
            color: "var(--text-secondary)",
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "0.04em",
            fontFamily: "var(--font-mono), ui-monospace, monospace",
          }}
        >
          <GeoLiveClock />
        </div>

        <IconBtn>
          <Sun size={14} />
        </IconBtn>

        <div
          className="ml-1.5 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer select-none"
          style={{
            fontSize: "var(--fs-sm)",
            fontWeight: 700,
            color: "rgba(255,205,208,0.95)",
            background: "linear-gradient(145deg, #4a1418 0%, #e02834 100%)",
            border: "1px solid var(--accent-blue-border)",
          }}
        >
          AB
        </div>
      </div>
    </header>
  );
}
