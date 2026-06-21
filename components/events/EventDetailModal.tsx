"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { mockSources } from "@/data/mockSources";
import type { OsintEvent } from "@/types/event";

interface EventDetailModalProps {
  event: OsintEvent;
  onClose: () => void;
}

const MODAL_ANIMATION_MS = 260;

export function EventDetailModal({ event, onClose }: EventDetailModalProps) {
  const closeTimerRef = useRef<number | null>(null);
  const [animationState, setAnimationState] = useState<"opening" | "open" | "closing">("opening");
  const source = mockSources.find((item) => item.id === event.sourceId);
  const entityItems: Array<[string, string | undefined]> = event.entities
    ? ([
        ["Country", event.entities.country],
        ["City", event.entities.city],
        ["Organization", event.entities.organization],
        ["Actor", event.entities.actor],
        ["Sector", event.entities.sector],
      ] satisfies Array<[string, string | undefined]>)
    : [];
  const entities = entityItems.filter(([, value]) => Boolean(value));

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setAnimationState("open"));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  function requestClose() {
    if (animationState === "closing") return;
    window.requestAnimationFrame(() => setAnimationState("closing"));
    closeTimerRef.current = window.setTimeout(onClose, MODAL_ANIMATION_MS);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") requestClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const modalVisible = animationState === "open";
  const modalTransform = modalVisible ? "scale(1)" : "scale(0.98)";

  return (
    <div
      className="absolute inset-0 z-50"
      style={{
        display: "grid",
        gridTemplateColumns: "220px minmax(0, 1fr) 400px",
        alignItems: "center",
        justifyItems: "center",
        padding: 24,
        cursor: "default",
        pointerEvents: "none",
      }}
    >
      <div
        aria-modal="true"
        role="dialog"
        style={{
          gridColumn: 2,
          width: "min(540px, 100%)",
          maxHeight: "min(560px, calc(100% - 48px))",
          opacity: modalVisible ? 1 : 0,
          transform: modalTransform,
          transformOrigin: "50% 50%",
          transition: `opacity ${MODAL_ANIMATION_MS}ms ease, transform ${MODAL_ANIMATION_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`,
          overflow: "hidden",
          borderRadius: 18,
          background: "var(--bg-panel)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          boxShadow: "var(--shadow-inset-highlight), 0 32px 90px rgba(0, 0, 0, 0.55)",
          color: "var(--c-t1)",
          pointerEvents: "auto",
        }}
        onClick={(clickEvent) => clickEvent.stopPropagation()}
        onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
      >
        <div
          style={{
            height: 3,
            background: "var(--accent-blue-text)",
            opacity: 0.95,
          }}
        />
        <div
          style={{
            maxHeight: "calc(min(560px, calc(100vh - 48px)) - 3px)",
            overflowY: "auto",
            padding: "18px 20px 20px",
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2">
                <span
                  aria-hidden="true"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: "var(--accent-blue-text)",
                    boxShadow: "0 0 10px var(--accent-blue-glow)",
                    flex: "0 0 auto",
                  }}
                />
                <span
                  className="uppercase"
                  style={{
                    color: "var(--c-t4)",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.12em",
                    lineHeight: 1,
                  }}
                >
                  Event Detail
                </span>
              </div>
              <h2
                className="leading-tight"
                style={{
                  color: "var(--c-t1)",
                  fontSize: 18,
                  fontWeight: 850,
                }}
              >
                {event.title}
              </h2>
              <div
                className="mt-2"
                style={{
                  color: "var(--c-t3)",
                  fontSize: 13,
                  fontWeight: 650,
                  lineHeight: 1.25,
                }}
              >
                {event.location}
              </div>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <span
                className="uppercase"
                style={{
                  borderRadius: 4,
                  border: "1px solid var(--accent-blue-border)",
                  background: "var(--accent-blue-bg)",
                  color: "var(--accent-blue-text)",
                  padding: "5px 7px",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  lineHeight: 1,
                }}
              >
                {event.severity}
              </span>
              <button
                aria-label="Close event detail"
                className="flex items-center justify-center"
                onClick={requestClose}
                style={{
                  width: 28,
                  minWidth: 28,
                  height: 28,
                  padding: 0,
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "var(--c-t3)",
                  cursor: "pointer",
                }}
                type="button"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <section
            style={{
              marginTop: 18,
              padding: "12px 0",
              borderTop: "1px solid rgba(255, 255, 255, 0.09)",
              borderBottom: "1px solid rgba(255, 255, 255, 0.09)",
            }}
          >
            <SectionLabel>Metadata</SectionLabel>
            <DetailGrid
              items={[
                ["Location", event.location],
                ["Country", event.entities?.country],
                ["Region", formatRegion(event.region)],
                ["Source", source?.name ?? event.sourceId],
                ["Published", event.time],
                ["Category", formatValue(event.category)],
                ["Severity", formatValue(event.severity)],
              ]}
            />
          </section>

          {event.originalSourceUrl && (
            <section className="mt-5">
              <SectionLabel>Original source URL</SectionLabel>
              <a
                href={event.originalSourceUrl}
                target="_blank"
                rel="noreferrer"
                className="break-all"
                style={{
                  color: "var(--accent-blue-text)",
                  fontSize: 12,
                  fontWeight: 600,
                  lineHeight: 1.5,
                }}
              >
                {event.originalSourceUrl}
              </a>
            </section>
          )}

          <section className="mt-5">
            <SectionLabel tone="accent">Detailed Summary</SectionLabel>
            <p
              style={{
                marginTop: 10,
                color: "var(--c-t2)",
                fontSize: 13,
                fontWeight: 500,
                lineHeight: 1.65,
              }}
            >
              {event.detailedSummary ?? event.summary}
            </p>
          </section>

          {entities.length > 0 && (
            <section
              style={{
                marginTop: 18,
                paddingTop: 16,
                borderTop: "1px solid rgba(255, 255, 255, 0.07)",
              }}
            >
              <SectionLabel>Entities</SectionLabel>
              <DetailGrid items={entities} />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailGrid({ items }: { items: Array<[string, string | undefined]> }) {
  const visibleItems = items.filter(([, value]) => Boolean(value));
  if (visibleItems.length === 0) return null;

  return (
    <dl
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: "12px 14px",
        marginTop: 12,
      }}
    >
      {visibleItems.map(([label, value]) => (
        <div key={`${label}-${value}`} className="min-w-0">
          <dt
            className="uppercase"
            style={{
              color: "var(--c-t5)",
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: "0.11em",
              lineHeight: 1,
            }}
          >
            {label}
          </dt>
          <dd
            className="mt-1.5 truncate"
            title={value}
            style={{
              color: "var(--c-t2)",
              fontSize: 12,
              fontWeight: 600,
              lineHeight: 1.35,
            }}
          >
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function SectionLabel({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "accent";
}) {
  return (
    <div
      className="uppercase"
      style={{
        color: tone === "accent" ? "var(--accent-blue-text)" : "var(--c-t4)",
        fontSize: 10,
        fontWeight: 850,
        letterSpacing: "0.12em",
        lineHeight: 1,
      }}
    >
      {children}
    </div>
  );
}

function formatRegion(region: OsintEvent["region"]) {
  if (region === "middle-east") return "Middle East";
  if (region === "asia-pacific") return "Asia-Pacific";
  return formatValue(region);
}

function formatValue(value: string) {
  return value
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
