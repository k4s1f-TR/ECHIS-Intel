"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { SocmintReport } from "@/types/socmint";
import {
  SOCMINT_PLATFORM_LABELS,
  SOCMINT_STATUS_LABELS,
  SOCMINT_TYPE_BADGE_LABELS,
} from "@/types/socmint";

interface SocmintDetailModalProps {
  report: SocmintReport;
  onClose: () => void;
}

const MODAL_ANIMATION_MS = 260;

export function SocmintDetailModal({
  report,
  onClose,
}: SocmintDetailModalProps) {
  const closeTimerRef = useRef<number | null>(null);
  const [animationState, setAnimationState] = useState<"opening" | "open" | "closing">("opening");
  const entityItems: Array<[string, string | undefined]> = report.entities
    ? ([
        ["Country", report.entities.country],
        ["City", report.entities.city],
        ["Organization", report.entities.organization],
        ["Actor", report.entities.actor],
        ["Sector", report.entities.sector],
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
          background: "#070b0f",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          boxShadow: "0 32px 90px rgba(0, 0, 0, 0.55)",
          color: "rgba(232, 238, 244, 0.94)",
          pointerEvents: "auto",
        }}
        onClick={(clickEvent) => clickEvent.stopPropagation()}
        onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
      >
        <div style={{ height: 3, background: "#60a5fa", opacity: 0.95 }} />
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
                    background: "#60a5fa",
                    boxShadow: "0 0 10px rgba(96, 165, 250, 0.42)",
                    flex: "0 0 auto",
                  }}
                />
                <span
                  className="uppercase"
                  style={{
                    color: "rgba(148, 163, 184, 0.78)",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.12em",
                    lineHeight: 1,
                  }}
                >
                  SOCMINT Report Detail
                </span>
              </div>
              <h2
                className="leading-tight"
                style={{
                  color: "rgba(248, 250, 252, 0.96)",
                  fontSize: 18,
                  fontWeight: 850,
                }}
              >
                {report.title}
              </h2>
              <div
                className="mt-2"
                style={{
                  color: "rgba(177, 190, 205, 0.86)",
                  fontSize: 13,
                  fontWeight: 650,
                  lineHeight: 1.25,
                }}
              >
                {report.locationName}
              </div>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <span
                className="uppercase"
                style={{
                  borderRadius: 4,
                  border: "1px solid rgba(96, 165, 250, 0.34)",
                  background: "rgba(96, 165, 250, 0.1)",
                  color: "rgba(205, 225, 255, 0.95)",
                  padding: "5px 7px",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  lineHeight: 1,
                }}
              >
                {SOCMINT_STATUS_LABELS[report.status]}
              </span>
              <button
                aria-label="Close SOCMINT report detail"
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
                  color: "rgba(190,205,220,0.82)",
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
                ["Location", report.locationName],
                ["Region", formatValue(report.region)],
                ["Source", report.sourceName],
                ["Platform", SOCMINT_PLATFORM_LABELS[report.platform]],
                ["Detected", report.timestamp],
                ["Category", SOCMINT_TYPE_BADGE_LABELS[report.type]],
                ["Status", SOCMINT_STATUS_LABELS[report.status]],
              ]}
            />
          </section>

          <section className="mt-5">
            <SectionLabel tone="accent">Detailed Summary</SectionLabel>
            <p
              style={{
                marginTop: 10,
                color: "rgba(203, 213, 225, 0.9)",
                fontSize: 13,
                fontWeight: 500,
                lineHeight: 1.65,
              }}
            >
              {report.detailedSummary ?? report.summary}
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
              color: "rgba(148, 163, 184, 0.62)",
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
              color: "rgba(220, 228, 238, 0.9)",
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
        color: tone === "accent" ? "rgba(205, 225, 255, 0.9)" : "rgba(148, 163, 184, 0.72)",
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

function formatValue(value: string) {
  return value
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
