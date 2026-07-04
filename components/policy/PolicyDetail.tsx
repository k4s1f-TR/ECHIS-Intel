"use client";

import type { CSSProperties } from "react";
import { POLICY_SEV, type PolicyReport } from "@/types/policy";
import { fmtAgo, minutesAgo } from "./policyView";

function SeverityBadge({ sev }: { sev: PolicyReport["sev"] }) {
  const s = POLICY_SEV[sev];
  return (
    <span
      className="c-mono inline-block uppercase"
      style={{
        fontSize: "8.5px",
        fontWeight: 600,
        letterSpacing: ".1em",
        padding: "2.5px 7px",
        borderRadius: "4px",
        color: s.color,
        background: s.bg,
        border: `1px solid ${s.border}`,
      }}
    >
      {s.label}
    </span>
  );
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="c-mono uppercase"
        style={{ fontSize: "9px", letterSpacing: ".14em", color: "var(--c-t5)", marginBottom: "4px" }}
      >
        {label}
      </div>
      <div style={{ fontSize: "13px", color: "var(--c-silver)" }}>{value}</div>
    </div>
  );
}

function MetaDivider() {
  return (
    <span style={{ width: "1px", height: "28px", background: "rgba(255,255,255,0.08)" }} />
  );
}

const EYEBROW: CSSProperties = {
  fontSize: "9.5px",
  letterSpacing: ".2em",
  textTransform: "uppercase",
  color: "var(--c-t5)",
};

export function PolicyDetail({
  report,
  related,
  isLoading,
  error,
  onSelectRelated,
}: {
  report: PolicyReport | null;
  related: PolicyReport[];
  isLoading: boolean;
  error: string | null;
  onSelectRelated: (id: string) => void;
}) {
  const sourceUrl =
    report && "url" in report && typeof report.url === "string" ? report.url : undefined;

  return (
    <div className="tm-scrollbar flex-1 min-w-0 overflow-y-auto">
      {!report ? (
        <div
          className="flex h-full flex-col items-center justify-center gap-2 px-10 text-center"
          style={{ color: "var(--c-t5)" }}
        >
          <div
            className="c-mono uppercase"
            style={{ fontSize: "10px", letterSpacing: ".16em", color: "var(--c-t4)" }}
          >
            {isLoading ? "Loading Dossier" : error ? "Feed Error" : "No Report Selected"}
          </div>
          <div style={{ maxWidth: "360px", fontSize: "13px", lineHeight: 1.5 }}>
            {isLoading
              ? "Waiting for live RSS reports."
              : error
                ? "All configured policy sources failed to respond."
                : "No reports match the active filters."}
          </div>
        </div>
      ) : (
        <div style={{ maxWidth: "880px", margin: "0 auto", padding: "48px 64px 56px 64px", zoom: 0.93 }}>
          {/* eyebrow */}
          <div className="flex items-center gap-[11px]" style={{ marginBottom: "26px" }}>
            <SeverityBadge sev={report.sev} />
            <span
              className="c-mono uppercase"
              style={{ fontSize: "10px", letterSpacing: ".14em", color: "var(--c-accent-text)" }}
            >
              {report.topic}
            </span>
            <span
              className="rounded-full"
              style={{ width: "3px", height: "3px", background: "var(--c-t6)" }}
            />
            <span
              className="c-mono"
              style={{ fontSize: "10px", letterSpacing: ".06em", color: "var(--c-t4)" }}
            >
              {report.region}
            </span>
          </div>

          {/* title */}
          <h2
            className="pd-serif"
            style={{
              margin: "0 0 22px 0",
              fontSize: "34px",
              fontWeight: 600,
              lineHeight: 1.18,
              letterSpacing: "-0.01em",
              color: "rgba(238,240,244,0.98)",
              textWrap: "pretty",
            }}
          >
            {report.title}
          </h2>

          {/* lead */}
          <p
            className="pd-serif"
            style={{
              margin: "0 0 28px 0",
              fontStyle: "italic",
              fontSize: "18px",
              lineHeight: 1.5,
              color: "var(--c-t3)",
              textWrap: "pretty",
            }}
          >
            {report.summary}
          </p>

          {/* meta strip (Source · Channel · Region — no confidence) */}
          <div
            className="flex items-center"
            style={{
              gap: "18px",
              padding: "16px 0",
              borderTop: "1px solid rgba(255,255,255,0.07)",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
              marginBottom: "30px",
            }}
          >
            <MetaField label="Source" value={report.source} />
            <MetaDivider />
            <MetaField label="Channel" value={report.sourceType} />
            <MetaDivider />
            <MetaField label="Region" value={report.region} />
          </div>

          {/* body */}
          <div className="flex flex-col" style={{ gap: "20px" }}>
            {report.body.split("\n\n").map((para, ix) => (
              <p
                key={ix}
                className="pd-serif"
                style={{
                  margin: 0,
                  fontSize: "17px",
                  lineHeight: 1.8,
                  color: "var(--c-t2)",
                  textWrap: "pretty",
                }}
              >
                {para}
              </p>
            ))}
          </div>

          {/* tags */}
          <div className="flex flex-wrap" style={{ marginTop: "30px", gap: "8px" }}>
            {report.tags.map((tag) => (
              <span
                key={tag}
                className="c-mono"
                style={{
                  fontSize: "10px",
                  letterSpacing: ".06em",
                  color: "var(--c-t3)",
                  padding: "5px 12px",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: "20px",
                }}
              >
                {tag}
              </span>
            ))}
          </div>

          {/* actions */}
          <div className="flex" style={{ marginTop: "30px", gap: "10px" }}>
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              aria-disabled={!sourceUrl}
              className="flex items-center"
              style={{
                gap: "8px",
                padding: "10px 18px",
                borderRadius: "8px",
                border: "1px solid var(--c-accent-border)",
                background:
                  "linear-gradient(90deg, rgba(179,18,31,0.22), rgba(255,43,61,0.16))",
                color: "var(--c-accent-text)",
                fontSize: "12.5px",
                fontWeight: 500,
                cursor: sourceUrl ? "pointer" : "default",
                opacity: sourceUrl ? 1 : 0.54,
              }}
            >
              Open Source ↗
            </a>
            <button
              type="button"
              style={{
                padding: "10px 18px",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.02)",
                color: "var(--c-silver)",
                fontSize: "12.5px",
                cursor: "pointer",
              }}
            >
              Pin to Watch
            </button>
          </div>

          {/* related signals */}
          {related.length > 0 && (
            <div
              style={{
                marginTop: "42px",
                paddingTop: "28px",
                borderTop: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div className="c-mono" style={{ ...EYEBROW, marginBottom: "18px" }}>
                Related Signals
              </div>
              <div className="flex flex-col">
                {related.map((rel) => (
                  <div
                    key={rel.id}
                    onClick={() => onSelectRelated(rel.id)}
                    className="flex cursor-pointer items-start"
                    style={{
                      gap: "16px",
                      padding: "15px 4px",
                      borderBottom: "1px solid var(--c-border-3)",
                    }}
                  >
                    <span
                      className="flex-none rounded-full"
                      style={{
                        width: "7px",
                        height: "7px",
                        background: POLICY_SEV[rel.sev].color,
                        marginTop: "6px",
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2" style={{ marginBottom: "5px" }}>
                        <span
                          className="c-mono uppercase"
                          style={{ fontSize: "9px", letterSpacing: ".1em", color: "var(--c-t4)" }}
                        >
                          {rel.topic}
                        </span>
                        <span
                          className="rounded-full"
                          style={{ width: "3px", height: "3px", background: "var(--c-t6)" }}
                        />
                        <span className="c-mono" style={{ fontSize: "9px", color: "var(--c-t5)" }}>
                          {rel.region}
                        </span>
                        <span className="flex-1" />
                        <span className="c-mono" style={{ fontSize: "9px", color: "var(--c-t5)" }}>
                          {fmtAgo(minutesAgo(rel))}
                        </span>
                      </div>
                      <div
                        className="pd-serif"
                        style={{
                          fontSize: "15.5px",
                          fontWeight: 500,
                          lineHeight: 1.36,
                          color: "var(--c-t2)",
                          textWrap: "pretty",
                        }}
                      >
                        {rel.title}
                      </div>
                    </div>
                    <span
                      className="flex-none"
                      style={{ fontSize: "15px", color: "var(--c-t5)", marginTop: "3px" }}
                    >
                      →
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
