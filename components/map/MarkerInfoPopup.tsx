"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface MarkerInfoPopupProps {
  title: string;
  location: string;
  summary: string;
  source?: string;
  time?: string;
  accent?: string;
  getPosition: () => { x: number; y: number } | null;
  onClose: () => void;
  /** Pager props — only rendered when itemCount > 1. */
  itemIndex?: number;
  itemCount?: number;
  onPrev?: () => void;
  onNext?: () => void;
}

export function MarkerInfoPopup({
  title,
  location,
  summary,
  source,
  time,
  accent = "#3b82f6",
  getPosition,
  onClose,
  itemIndex,
  itemCount,
  onPrev,
  onNext,
}: MarkerInfoPopupProps) {
  const showPager = itemCount !== undefined && itemCount > 1;
  const currentDisplay = (itemIndex ?? 0) + 1;
  const isFirst = (itemIndex ?? 0) === 0;
  const isLast = itemCount !== undefined && (itemIndex ?? 0) >= itemCount - 1;
  const [position, setPosition] = useState(() => getPosition());

  useEffect(() => {
    let frame = 0;
    function updatePosition() {
      setPosition(getPosition());
      frame = window.requestAnimationFrame(updatePosition);
    }

    frame = window.requestAnimationFrame(updatePosition);
    return () => window.cancelAnimationFrame(frame);
  }, [getPosition]);

  if (!position) return null;

  return (
    <div
      className="absolute z-40"
      style={{
        left: position.x,
        top: position.y,
        width: 248,
        transform: "translate(-50%, calc(-100% - 18px))",
        pointerEvents: "auto",
      }}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        style={{
          background: "#070b0f",
          border: "1px solid rgba(255,255,255,0.11)",
          borderRadius: 10,
          boxShadow: "0 18px 44px rgba(0,0,0,0.5)",
          overflow: "hidden",
        }}
      >
        <div style={{ height: 2, background: accent, opacity: 0.95 }} />
        <div style={{ padding: "10px 11px 11px" }}>
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p
                className="leading-snug"
                style={{
                  color: "rgba(235,242,250,0.95)",
                  fontSize: 12,
                  fontWeight: 750,
                }}
              >
                {title}
              </p>
              <p
                className="mt-1 truncate"
                style={{ color: "rgba(150,165,182,0.85)", fontSize: 10.5 }}
                title={location}
              >
                {location}
              </p>
            </div>
            <button
              aria-label="Close marker popup"
              className="flex flex-shrink-0 items-center justify-center"
              onClick={onClose}
              style={{
                width: 22,
                height: 22,
                borderRadius: 5,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(190,205,220,0.82)",
                cursor: "pointer",
              }}
              type="button"
            >
              <X size={12} />
            </button>
          </div>

          <p
            className="line-clamp-3"
            style={{
              color: "rgba(170,182,196,0.86)",
              fontSize: 11,
              lineHeight: 1.55,
              margin: 0,
            }}
          >
            {summary}
          </p>

          {(source || time) && (
            <div
              className="mt-2 flex items-center justify-between gap-2"
              style={{
                borderTop: "1px solid rgba(255,255,255,0.06)",
                paddingTop: 7,
                color: "rgba(126,138,152,0.88)",
                fontSize: 9.5,
              }}
            >
              {source && <span className="truncate">{source}</span>}
              {time && <span className="flex-shrink-0">{time}</span>}
            </div>
          )}
        </div>

        {showPager && (
          <div
            style={{
              borderTop: "1px solid rgba(255,255,255,0.07)",
              padding: "7px 11px 9px",
            }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <p
              className="uppercase tracking-widest"
              style={{
                fontSize: 8.5,
                fontWeight: 800,
                letterSpacing: "0.13em",
                color: "rgba(148,163,184,0.55)",
                marginBottom: 5,
                lineHeight: 1,
              }}
            >
              Report{" "}
              <span style={{ color: "rgba(205,220,240,0.78)" }}>
                {String(currentDisplay).padStart(2, "0")}
              </span>
              {" / "}
              {String(itemCount).padStart(2, "0")}
            </p>
            <div className="flex items-center justify-between">
              <button
                type="button"
                disabled={isFirst}
                onClick={(e) => {
                  e.stopPropagation();
                  onPrev?.();
                }}
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: isFirst ? "rgba(80,95,115,0.4)" : "rgba(148,163,184,0.82)",
                  background: "transparent",
                  border: "none",
                  padding: "2px 0",
                  cursor: isFirst ? "default" : "pointer",
                  letterSpacing: "0.01em",
                }}
              >
                ‹ Previous
              </button>
              <button
                type="button"
                disabled={isLast}
                onClick={(e) => {
                  e.stopPropagation();
                  onNext?.();
                }}
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: isLast ? "rgba(80,95,115,0.4)" : "rgba(148,163,184,0.82)",
                  background: "transparent",
                  border: "none",
                  padding: "2px 0",
                  cursor: isLast ? "default" : "pointer",
                  letterSpacing: "0.01em",
                }}
              >
                Next ›
              </button>
            </div>
          </div>
        )}
      </div>
      <div
        style={{
          width: 10,
          height: 10,
          margin: "-5px auto 0",
          transform: "rotate(45deg)",
          background: "#070b0f",
          borderRight: "1px solid rgba(255,255,255,0.11)",
          borderBottom: "1px solid rgba(255,255,255,0.11)",
        }}
      />
    </div>
  );
}
