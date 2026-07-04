"use client";

import { useMemo, useState } from "react";
import {
  POLICY_TIME_WINDOWS,
  type PolicyTimeWindow,
  type PolicyTopicKey,
} from "@/types/policy";
import { computePolicyView } from "./policyView";
import { usePolicyFeed } from "./usePolicyFeed";
import { PolicyFeed } from "./PolicyFeed";
import { PolicyDetail } from "./PolicyDetail";
import { PolicyMetaColumn } from "./PolicyMetaColumn";

export function PolicyDossierScreen() {
  // Four pieces of state; everything else is derived (see computePolicyView).
  const [time, setTime] = useState<PolicyTimeWindow>(24);
  const [topic, setTopic] = useState<PolicyTopicKey>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const feed = usePolicyFeed();

  const view = useMemo(
    () => computePolicyView(feed.items, time, topic, query, selectedId),
    [feed.items, time, topic, query, selectedId],
  );

  const selected = view.selected;

  return (
    <div
      className="policy-dossier flex h-full w-full flex-col overflow-hidden"
      style={{ background: "var(--c-bg-base)" }}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <div
        className="flex flex-none items-center justify-between"
        style={{ height: "60px", padding: "0 28px", background: "var(--c-panel-grad)" }}
      >
        <div className="flex items-center" style={{ gap: "11px" }}>
          <span
            className="rounded-full"
            style={{
              width: "8px",
              height: "8px",
              background: "var(--c-accent)",
              boxShadow: "0 0 12px rgba(255,43,61,0.7)",
              animation: "pulseDot 2.4s ease-in-out infinite",
            }}
          />
          <span
            className="c-disp"
            style={{
              fontSize: "16px",
              fontWeight: 600,
              letterSpacing: ".05em",
              color: "rgba(238,240,244,0.98)",
            }}
          >
            POLICY
          </span>
          <span
            className="c-mono uppercase"
            style={{
              fontSize: "10px",
              letterSpacing: ".16em",
              color: "var(--c-t5)",
              borderLeft: "1px solid rgba(255,255,255,0.1)",
              paddingLeft: "11px",
            }}
          >
            Dossier · Foreign Affairs Desk
          </span>
        </div>

        <div className="flex items-center" style={{ gap: "18px" }}>
          {/* search */}
          <div className="relative" style={{ width: "230px" }}>
            <span
              className="absolute"
              style={{
                left: "11px",
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: "12px",
                color: "var(--c-t5)",
              }}
            >
              ⌕
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              style={{
                width: "100%",
                height: "33px",
                padding: "0 12px 0 28px",
                background: "rgba(255,255,255,0.022)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "18px",
                color: "var(--c-t2)",
                fontSize: "12px",
                outline: "none",
              }}
            />
          </div>

          {/* time window pills */}
          <div className="flex items-center" style={{ gap: "6px" }}>
            {POLICY_TIME_WINDOWS.map((h) => {
              const active = time === h;
              return (
                <button
                  key={h}
                  type="button"
                  onClick={() => setTime(h)}
                  className="c-mono"
                  style={{
                    minWidth: "36px",
                    height: "27px",
                    padding: "0 11px",
                    borderRadius: "14px",
                    cursor: "pointer",
                    fontSize: "10.5px",
                    fontWeight: 600,
                    letterSpacing: ".04em",
                    border: `1px solid ${active ? "var(--c-accent-border)" : "rgba(255,255,255,0.07)"}`,
                    color: active ? "var(--c-accent-text)" : "var(--c-t4)",
                    background: active ? "rgba(255,43,61,0.08)" : "transparent",
                  }}
                >
                  {h}H
                </button>
              );
            })}
          </div>

          {/* live count */}
          <span
            className="c-mono flex items-center"
            style={{
              gap: "7px",
              fontSize: "10px",
              color: "var(--c-t5)",
              borderLeft: "1px solid rgba(255,255,255,0.1)",
              paddingLeft: "14px",
            }}
          >
            <span
              className="rounded-full"
              style={{
                width: "5px",
                height: "5px",
                background: "var(--c-accent)",
                animation: "liveBlink 1.8s infinite",
              }}
            />
            {feed.relevantItems}/{feed.totalItems}
          </span>
        </div>
      </div>

      {/* ── Topic tabs ─────────────────────────────────────────── */}
      <div
        className="tm-scrollbar flex flex-none items-center overflow-x-auto"
        style={{
          height: "46px",
          gap: "24px",
          padding: "0 28px",
          borderTop: "1px solid var(--c-border-3)",
          borderBottom: "1px solid var(--c-border-3)",
          background:
            "linear-gradient(180deg, rgba(20,16,18,0.12), rgba(7,5,7,0.25))",
        }}
      >
        {view.topics.map((c) => {
          const active = c.active;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setTopic(c.key)}
              className="relative inline-flex items-center"
              style={{
                gap: "7px",
                padding: "10px 2px",
                cursor: "pointer",
                background: "transparent",
                border: "none",
                borderBottom: `2px solid ${active ? "var(--c-accent)" : "transparent"}`,
                fontSize: "13px",
                fontWeight: active ? 600 : 400,
                letterSpacing: ".01em",
                whiteSpace: "nowrap",
                color: active ? "rgba(238,240,244,0.98)" : "var(--c-t4)",
              }}
            >
              {c.label}
              <span
                className="c-mono"
                style={{
                  fontSize: "9.5px",
                  padding: "1px 5px",
                  borderRadius: "8px",
                  background: active ? "rgba(255,43,61,0.14)" : "rgba(255,255,255,0.04)",
                  color: active ? "var(--c-accent-text)" : "var(--c-t5)",
                }}
              >
                {c.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Body ───────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        <PolicyFeed
          items={view.list}
          selectedId={selected?.id ?? null}
          time={time}
          isLoading={feed.isLoading}
          error={feed.error}
          onSelect={setSelectedId}
        />
        <PolicyDetail
          report={selected}
          related={view.related}
          isLoading={feed.isLoading}
          error={feed.error}
          onSelectRelated={setSelectedId}
        />
        <PolicyMetaColumn
          regions={view.regions}
          sources={view.sources}
          trend={view.trend}
          time={time}
          isLoading={feed.isLoading}
          error={feed.error}
        />
      </div>
    </div>
  );
}
