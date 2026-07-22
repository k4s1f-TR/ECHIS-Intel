"use client";

import { useEffect, useState } from "react";
import { MapPin, X } from "lucide-react";
import type { SendToIntelWatchResult } from "@/components/intel-watch/workspaceStore";

interface MarkerInfoPopupProps {
  title: string;
  location: string;
  summary: string;
  source?: string;
  time?: string;
  accent?: string;
  getPosition: () => { x: number; y: number } | null;
  onClose: () => void;
  /** One-way exit state used when the globe resumes auto-rotation. */
  closing?: boolean;
  /** Writes the item into the Intel Watch workspace; enables the action row. */
  onSendToIntelWatch?: () => SendToIntelWatchResult;
  /** Pager props — only rendered when itemCount > 1. */
  itemIndex?: number;
  itemCount?: number;
  onPrev?: () => void;
  onNext?: () => void;
}

const SEND_RESULT_LABEL: Record<SendToIntelWatchResult, string> = {
  added: "Added to Intel Watch",
  exists: "Already in Intel Watch",
  unavailable: "Could not save",
};

export function MarkerInfoPopup({
  title,
  location,
  summary,
  source,
  time,
  accent = "var(--accent-blue-text)",
  getPosition,
  onClose,
  closing = false,
  onSendToIntelWatch,
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
  const [sendResult, setSendResult] = useState<SendToIntelWatchResult | null>(null);
  // Reset the "sent" feedback when the popup switches to another item —
  // adjust-during-render pattern (no setState inside an effect).
  const itemKey = `${title}|${location}`;
  const [sendResultKey, setSendResultKey] = useState(itemKey);
  if (sendResultKey !== itemKey) {
    setSendResultKey(itemKey);
    setSendResult(null);
  }

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
        opacity: closing ? 0 : 1,
        transform: closing
          ? "translate(-50%, calc(-100% - 10px)) scale(0.965)"
          : "translate(-50%, calc(-100% - 18px)) scale(1)",
        transformOrigin: "50% 100%",
        transition:
          "opacity 420ms cubic-bezier(0.22, 0.8, 0.22, 1), transform 500ms cubic-bezier(0.22, 0.8, 0.22, 1)",
        pointerEvents: closing ? "none" : "auto",
        willChange: "opacity, transform",
      }}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        style={{
          background: "var(--bg-panel)",
          border: "1px solid rgba(255,255,255,0.11)",
          borderRadius: 10,
          boxShadow: "var(--shadow-inset-highlight), 0 18px 44px rgba(0,0,0,0.5)",
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
                  color: "var(--c-t1)",
                  fontSize: 12,
                  fontWeight: 750,
                }}
              >
                {title}
              </p>
              <p
                className="mt-1 truncate"
                style={{ color: "var(--c-t4)", fontSize: 10.5 }}
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
                color: "var(--c-t3)",
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
              color: "var(--c-t3)",
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
                color: "var(--c-t4)",
                fontSize: 9.5,
              }}
            >
              {source && <span className="truncate">{source}</span>}
              {time && <span className="flex-shrink-0">{time}</span>}
            </div>
          )}

          {onSendToIntelWatch && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setSendResult(onSendToIntelWatch());
              }}
              className="mt-2 flex w-full items-center justify-center gap-1.5 uppercase"
              style={{
                padding: "5px 8px",
                borderRadius: 6,
                fontSize: 8.5,
                fontWeight: 800,
                letterSpacing: "0.09em",
                lineHeight: 1,
                color: sendResult === "added" ? accent : "var(--c-t4)",
                background:
                  sendResult === "added"
                    ? "var(--accent-blue-bg)"
                    : "rgba(255,255,255,0.04)",
                border:
                  sendResult === "added"
                    ? "1px solid var(--accent-blue-border)"
                    : "1px solid rgba(255,255,255,0.1)",
                cursor: sendResult ? "default" : "pointer",
              }}
            >
              <MapPin size={10} />
              {sendResult ? SEND_RESULT_LABEL[sendResult] : "Send to Intel Watch"}
            </button>
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
                color: "var(--c-t5)",
                marginBottom: 5,
                lineHeight: 1,
              }}
            >
              Report{" "}
              <span style={{ color: "var(--accent-blue-text)" }}>
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
                  color: isFirst ? "var(--c-t6)" : "var(--c-t3)",
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
                  color: isLast ? "var(--c-t6)" : "var(--c-t3)",
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
          background: "var(--c-panel-bg)",
          borderRight: "1px solid rgba(255,255,255,0.11)",
          borderBottom: "1px solid rgba(255,255,255,0.11)",
        }}
      />
    </div>
  );
}
