"use client";
import { Crosshair, Plus, Minus } from "lucide-react";

const BTNS = [
  { icon: Crosshair, label: "Center view", action: "center" },
  { icon: Plus, label: "Zoom in", action: "zoomIn" },
  { icon: Minus, label: "Zoom out", action: "zoomOut" },
] as const;

interface MapControlsProps {
  onCenterView: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  panelOffset?: number;
}

export function MapControls({
  onCenterView,
  onZoomIn,
  onZoomOut,
  panelOffset = 0,
}: MapControlsProps) {
  const handlers = {
    center: onCenterView,
    zoomIn: onZoomIn,
    zoomOut: onZoomOut,
  };

  return (
    <div
      className="absolute bottom-12 right-4 flex flex-col gap-1 z-10"
      style={{
        transform: `translateX(-${panelOffset}px)`,
        transition: "transform 220ms ease",
        willChange: "transform",
      }}
    >
      {BTNS.map(({ icon: Icon, label, action }) => (
        <button
          key={label}
          type="button"
          onClick={handlers[action]}
          title={label}
          aria-label={label}
          className="w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-150"
          style={{
            background: "var(--bg-panel)",
            border: "1px solid var(--c-border-1)",
            backdropFilter: "blur(10px)",
            color: "var(--c-t5)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color =
              "rgba(190,190,190,0.9)";
            (e.currentTarget as HTMLElement).style.background =
              "var(--accent-blue-bg)";
            (e.currentTarget as HTMLElement).style.borderColor =
              "var(--accent-blue-border)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color =
              "var(--c-t5)";
            (e.currentTarget as HTMLElement).style.background =
              "var(--bg-panel)";
            (e.currentTarget as HTMLElement).style.borderColor =
              "rgba(255,255,255,0.07)";
          }}
        >
          <Icon size={13} strokeWidth={1.5} />
        </button>
      ))}
    </div>
  );
}
